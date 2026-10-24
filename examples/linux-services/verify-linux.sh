#!/usr/bin/env bash
set -euo pipefail
if [[ "$(uname -s)" != "Linux" ]]; then
  echo 'SKIP: Linux/systemd required; no host service operation performed.' >&2
  exit 77
fi
for tool in python3 systemctl timeout sudo runuser useradd userdel journalctl; do
  command -v "$tool" >/dev/null || { echo "Missing required tool: $tool" >&2; exit 78; }
done
python3 -c 'import sys; assert sys.version_info[:2] == (3, 12), sys.version'
sudo -n true
root_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
python3 --version
cat /etc/os-release
systemctl --version
uname -r
timeout 45s python3 "$root_dir/test_process.py"
# The Python orchestrator owns cleanup; its subprocesses have individual deadlines.
# Its finally removes only its generated atlas-lab-* user, units and /var/tmp tree.
python3 "$root_dir/verify_systemd.py"
python3 "$root_dir/verify-article.py"
