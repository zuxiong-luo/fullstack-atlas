#!/usr/bin/env bash
set -euo pipefail
if [[ "$(uname -s)" != Linux || "${CI:-}" != true ]]; then
  echo 'SKIP: disposable Linux CI only; no signing account or real-device operations.' >&2
  exit 77
fi
for tool in node npm java python3 timeout adb; do command -v "$tool" >/dev/null; done
node -e 'if(process.versions.node!=="24.14.1")throw Error("Node24.14.1 required")'
root_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
: "${ATLAS_LAB_ARTIFACT_DIR:?new private artifact directory required}"
timeout --signal=TERM --kill-after=60s 3900s python3 "$root_dir/build_android.py"
if [[ "${ATLAS_LAB_BUILD_ONLY:-}" == 1 ]]; then exit 0; fi
: "${ATLAS_LAB_EMULATOR_SERIAL:?explicit emulator serial required}"
timeout --signal=TERM --kill-after=15s 180s npm ci --prefix "$root_dir" --ignore-scripts --no-fund --audit=false
timeout --signal=TERM --kill-after=30s 240s python3 "$root_dir/verify_emulator.py"
