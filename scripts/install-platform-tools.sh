#!/usr/bin/env bash
set -euo pipefail
lab_bin="$RUNNER_TEMP/atlas-k8s-bin"
mkdir -p "$lab_bin"
cd "$lab_bin"
curl -fL --retry 3 --max-time 60 -o kind https://kind.sigs.k8s.io/dl/v0.33.0/kind-linux-amd64
curl -fL --retry 3 --max-time 30 -o kind.sha256 https://kind.sigs.k8s.io/dl/v0.33.0/kind-linux-amd64.sha256sum
python -c 'from pathlib import Path; import hashlib,re; expected=re.search(r"[0-9a-fA-F]{64}",Path("kind.sha256").read_text()); assert expected, "invalid official kind checksum"; assert hashlib.sha256(Path("kind").read_bytes()).hexdigest()==expected[0].lower(); print("kind official checksum verified")'
curl -fL --retry 3 --max-time 60 -o kubectl https://dl.k8s.io/release/v1.35.8/bin/linux/amd64/kubectl
curl -fL --retry 3 --max-time 30 -o kubectl.sha256 https://dl.k8s.io/release/v1.35.8/bin/linux/amd64/kubectl.sha256
python -c 'from pathlib import Path; import hashlib; expected=Path("kubectl.sha256").read_text().strip(); assert hashlib.sha256(Path("kubectl").read_bytes()).hexdigest()==expected; print("kubectl official checksum verified")'
chmod +x kind kubectl
echo "$lab_bin" >> "$GITHUB_PATH"
./kind version
./kubectl version --client -o json
