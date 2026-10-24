#!/usr/bin/env bash
set -euo pipefail
sdk_root="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
[[ -n "$sdk_root" && -d "$sdk_root" ]] || { echo 'Hosted runner Android SDK directory missing'; exit 1; }
echo "Hosted SDK: $sdk_root"
manager="$(command -v sdkmanager || true)"
if [[ -z "$manager" ]]; then
  for candidate in "$sdk_root"/cmdline-tools/*/bin/sdkmanager; do
    if [[ -x "$candidate" ]]; then manager="$candidate"; break; fi
  done
fi
[[ -n "$manager" ]] || { echo 'Hosted SDK command line tools missing'; exit 1; }
echo "SDK manager: $manager"
java -version
node --version
"$manager" --install 'platforms;android-37' 'build-tools;37.0.0' 'ndk;27.1.12297006' 'cmake;3.30.5'
echo "$sdk_root/platform-tools" >> "$GITHUB_PATH"
"$sdk_root/platform-tools/adb" version
