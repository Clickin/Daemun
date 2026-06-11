# Docker CI TODO

- Keep Docker CI runtime images pinned to an explicit Alpine minor version.
- Before moving the base from `node:26-alpine3.23`, verify both `Dockerfile` and
  `Dockerfile.nginx` build for `linux/amd64` and `linux/arm64`.
- Do not reintroduce the upstream `nginx.org` Alpine APK repository unless it
  publishes packages for the selected Alpine minor version.
- If nginx package freshness becomes important, prefer a deliberate base bump
  with CI validation over a floating `node:26-alpine` tag.
