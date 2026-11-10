# Dependencies Dependabot doesn't update

| Dependency | Set in | Upstream | When updating |
|---|---|---|---|
| Linux | `KERNEL_VERSION`, `KERNEL_SHA256` in `kernel/build.sh` | [6.18 long-term](https://www.kernel.org/) | Update the hash too; run `kernel/scripts/compare-config.py` against Alpine's matching `virt` config |
| Departure Mono | `DEPARTURE_VERSION`, `DEPARTURE_SHA256` in `fonts/build.py` | [releases](https://github.com/rektdeckard/departure-mono/releases) | Update the hash too |
| Fusion Pixel Font | `FUSION_VERSION`, `FUSION_SHA256` in `fonts/build.py` | [releases](https://github.com/TakWolf/fusion-pixel-font/releases) | Update the hash too |
| Node | `devEngines.runtime` in `package.json` | [releases](https://nodejs.org/en/about/previous-releases) | Bump `@types/node` to the same major; Dependabot skips its majors |
| pnpm | `packageManager` in `package.json` | [releases](https://github.com/pnpm/pnpm/releases) | Run `pnpm install` to update the lockfile |
| Python | `.python-version` | [releases](https://www.python.org/downloads/) | `requires-python` in `pyproject.toml` is the minimum |
| uv | `required-version` in `pyproject.toml` | [releases](https://github.com/astral-sh/uv/releases) | A minimum; CI installs the newest that matches |
| Workers runtime | `compatibility_date` in `wrangler.jsonc` | [flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/) | No newer than the pinned wrangler supports |
