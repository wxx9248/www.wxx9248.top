import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

/**
 * Make directories outside the Vite root available next to the page, keyed by
 * URL prefix: served from disk by the dev server, copied into the output
 * directory by a build.
 */
export function mountDirs(mounts: Record<string, string>): Plugin {
  let outDir = "";
  return {
    name: "mount-dirs",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url ?? "").split("?")[0]);
        for (const [prefix, dir] of Object.entries(mounts)) {
          if (!url.startsWith(prefix)) continue;
          const file = path.join(dir, url.slice(prefix.length));
          if (!file.startsWith(dir + path.sep) || !fs.existsSync(file)) break;
          res.setHeader("Content-Type", "application/octet-stream");
          fs.createReadStream(file).pipe(res);
          return;
        }
        next();
      });
    },
    closeBundle() {
      for (const [prefix, dir] of Object.entries(mounts)) {
        if (!fs.existsSync(dir))
          throw new Error(`${dir} is missing; build it with make`);
        fs.cpSync(dir, path.join(outDir, prefix), {
          recursive: true,
          dereference: true
        });
      }
    }
  };
}
