#!/usr/bin/env bash
set -euo pipefail
if [[ "$(uname -s)" != "Linux" ]]; then
  echo 'SKIP: Linux verification required; no host network setting changed.' >&2
  exit 77
fi
for tool in python3 openssl timeout; do
  command -v "$tool" >/dev/null || { echo "Missing required tool: $tool" >&2; exit 78; }
done
python3 -c 'import sys; assert sys.version_info[:2] == (3,12), sys.version'
root_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
python3 --version
python3 -c 'import ssl; print(ssl.OPENSSL_VERSION)'
openssl version
uname -r
# All tests use local fixtures and bounded network/child-process waits.
timeout --signal=TERM --kill-after=5s 60s python3 "$root_dir/test_network.py"
python3 "$root_dir/verify-article.py"
