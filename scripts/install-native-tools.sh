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
if ! "$manager" --install 'platforms;android-37' 'build-tools;37.0.0' 'ndk;27.1.12297006' 'cmake;3.30.5'; then
  echo 'Exact available packages (all channels), no version substitution:'
  "$manager" --list --channel=3 | python3 -c 'import sys,re; print("".join(line for line in sys.stdin if re.search(r"(?:platforms;android-|build-tools;(?:3[567])|system-images;android-3[567];)",line)))'
  exit 1
fi
echo "$sdk_root/platform-tools" >> "$GITHUB_PATH"
"$sdk_root/platform-tools/adb" version
