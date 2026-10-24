#!/usr/bin/env bash
set -euo pipefail
if [[ "$(uname -s)" != Linux ]]; then
  echo 'SKIP: Linux /proc required; no host tuning performed.' >&2
  exit 77
fi
for tool in python3 timeout; do command -v "$tool" >/dev/null; done
python3 -c 'import sys; assert sys.version_info[:2] == (3,12), sys.version'
root_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
python3 --version
uname -r
cat /etc/os-release
timeout --signal=TERM --kill-after=5s 45s python3 "$root_dir/test_linux.py"
