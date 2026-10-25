#!/usr/bin/env bash
set -euo pipefail
if [[ "$(uname -s)" != Linux || "${CI:-}" != true ]]; then
  echo 'SKIP: disposable Linux CI only; no host SDK or real device operations.' >&2
  exit 77
fi
for tool in node npm java python3 timeout adb; do command -v "$tool" >/dev/null; done
node -e 'if(process.versions.node!=="24.14.1")throw Error("Node24.14.1 required")'
root_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
: "${ATLAS_LAB_ARTIFACT_DIR:?new private artifact directory required}"
timeout --signal=TERM --kill-after=45s 2100s python3 "$root_dir/build_android.py"
if [[ "${ATLAS_LAB_BUILD_ONLY:-}" == 1 ]]; then exit 0; fi
: "${ATLAS_LAB_EMULATOR_SERIAL:?explicit emulator serial required}"
timeout --signal=TERM --kill-after=20s 180s python3 "$root_dir/verify_emulator.py"
