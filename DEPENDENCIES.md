# Dependencies Dependabot doesn't update

Dependabot handles the npm packages, the uv packages and the workflow's actions (`.github/dependabot.yml`). Check these by hand now and then.

| Dependency | Set in | Upstream | When updating |
|---|---|---|---|
| Departure Mono | `DEPARTURE_VERSION`, `DEPARTURE_SHA256` in `tools/build-fonts.py` | [releases](https://github.com/rektdeckard/departure-mono/releases) | Update the hash too |
| Fusion Pixel Font | `FUSION_VERSION`, `FUSION_SHA256` in `tools/build-fonts.py` | [releases](https://github.com/TakWolf/fusion-pixel-font/releases) | Update the hash too |
| Node | `devEngines.runtime` in `package.json` | [releases](https://nodejs.org/en/about/previous-releases) | Bump `@types/node` to the same major; Dependabot skips its majors |
| pnpm | `packageManager` in `package.json` | [releases](https://github.com/pnpm/pnpm/releases) | Run `pnpm install` to update the lockfile |
| Python | `.python-version` | [releases](https://www.python.org/downloads/) | `requires-python` in `pyproject.toml` is the minimum |
| uv | `required-version` in `pyproject.toml` | [releases](https://github.com/astral-sh/uv/releases) | A minimum; CI installs the newest that matches |
| Workers runtime | `compatibility_date` in `wrangler.jsonc` | [flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/) | No newer than the pinned wrangler supports |

Follow upstream on their own, with nothing to bump: Alpine and its packages (`ALPINE` in `image/Dockerfile` is `latest`, rebuilt on every CI run), and v86's BIOS images and tools, which `tools/fetch-v86.mjs` takes from the v86 npm version.
