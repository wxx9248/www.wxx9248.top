import { SNAPSHOT_MANIFEST_ID, VM_STATE_URL } from "@/site.ts";
import type { ProgressListener } from "./vm.ts";

/** Written by tools/build-state.mjs and inlined into the page at build time. */
type Manifest = { size: number; parts: string[] };

export function readManifest(): Manifest {
  const element = document.getElementById(SNAPSHOT_MANIFEST_ID);
  if (!element?.textContent)
    throw new Error("the snapshot manifest is missing");
  return JSON.parse(element.textContent);
}

/**
 * Download the snapshot parts in parallel and join them into one buffer. The
 * head script has already started these requests as preloads.
 */
export async function fetchSnapshot(
  onProgress: ProgressListener
): Promise<ArrayBuffer> {
  const manifest = readManifest();
  let loaded = 0;

  const parts = await Promise.all(
    manifest.parts.map(async (part) => {
      const response = await fetch(VM_STATE_URL + part);
      if (!response.ok || !response.body)
        throw new Error(`${part}: HTTP ${response.status}`);
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.body) {
        chunks.push(chunk);
        loaded += chunk.length;
        onProgress(loaded, manifest.size);
      }
      return chunks;
    })
  );

  const snapshot = new Uint8Array(manifest.size);
  let offset = 0;
  for (const chunk of parts.flat()) {
    snapshot.set(chunk, offset);
    offset += chunk.length;
  }
  if (offset !== manifest.size)
    throw new Error(`snapshot is ${offset} bytes, expected ${manifest.size}`);
  return snapshot.buffer;
}
