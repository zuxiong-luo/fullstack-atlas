import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
from uuid import uuid4

ROOT = Path(__file__).resolve().parent
NODE_IMAGE = "kindest/node:v1.35.8@sha256:07b2536e30b803ed61d1677a79df6115f798ce64c80f9e22f6ed45afd09323c0"


def run(arguments, *, check=True, timeout=35):
    result = subprocess.run(arguments, text=True, capture_output=True, timeout=timeout)
    if check and result.returncode:
        raise RuntimeError(f"{arguments[0]} failed ({result.returncode})\n{result.stdout}\n{result.stderr}")
    return result


def eventually(predicate, label, seconds=45):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        result = predicate()
        if result:
            return result
        time.sleep(.2)
    raise AssertionError("not observed: " + label)


def main():
    if sys.platform != "linux":
        raise SystemExit("Linux disposable Docker VM required")
    endpoint = run(["docker", "context", "inspect", "--format", "{{.Endpoints.docker.Host}}"] ).stdout.strip()
    if os.environ.get("DOCKER_HOST") or not endpoint.startswith("unix://"):
        raise SystemExit("local Unix-socket Docker context required")
    kind_version = run(["kind", "version"]).stdout
    client = json.loads(run(["kubectl", "version", "--client", "-o", "json"]).stdout)
    assert "v0.33.0" in kind_version and client["clientVersion"]["gitVersion"] == "v1.35.8"
    prefix = "atlas-lab-k8s-" + uuid4().hex[:8]
    namespace, image = prefix, prefix + ":fixture"
    if prefix in run(["kind", "get", "clusters"]).stdout.split():
        raise RuntimeError("refuse existing kind cluster")
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
    with tempfile.TemporaryDirectory(prefix=prefix + "-") as folder:
        work = Path(folder)
        kubeconfig = work / "kubeconfig"

        def kubectl(*arguments, check=True, timeout=35, namespaced=True):
            flags = ["kubectl", "--kubeconfig", str(kubeconfig), "--context", "kind-" + prefix,
                     "--request-timeout", str(timeout - 5) + "s"]
            if namespaced:
                flags += ["--namespace", namespace]
            return run(flags + list(arguments), check=check, timeout=timeout)

        def obj(*arguments):
            return json.loads(kubectl("get", *arguments, "-o", "json").stdout)

        def ready_pods():
            return [pod for pod in obj("pods", "-l", "app=atlas-notes")["items"]
                    if not pod["metadata"].get("deletionTimestamp")
                    and pod["status"].get("containerStatuses")
                    and all(c["ready"] for c in pod["status"]["containerStatuses"])]

        def rollout():
            kubectl("rollout", "status", "deployment/notes", "--timeout=90s", timeout=110)
            def two_ready():
                pods = ready_pods()
                return pods if len(pods) == 2 else None
            return eventually(two_ready, "two ready pods")

        def service_read(expected):
            pod = ready_pods()[0]["metadata"]["name"]
            host = f"notes.{namespace}.svc.cluster.local"
            program = ("import socket,json;from urllib.request import build_opener,ProxyHandler;"
                       f"host={host!r};address=socket.gethostbyname(host);"
                       "opener=build_opener(ProxyHandler({}));"
                       "response=opener.open('http://'+host+':8080/health',timeout=2);"
                       "print(json.dumps({'address':address,'body':json.load(response)}))")
            result = json.loads(kubectl("exec", pod, "--", "python", "-c", program).stdout)
            assert result["address"] == obj("service", "notes")["spec"]["clusterIP"]
            assert result["body"]["version"] == expected
            return result

        try:
            print(kind_version, flush=True)
            print(json.dumps({"kubectl_client": client["clientVersion"]["gitVersion"], "node_image": NODE_IMAGE}), flush=True)
            run(["docker", "build", "--label", "atlas.lab=" + prefix, "-t", image, str(ROOT)], timeout=180)
            run(["kind", "create", "cluster", "--name", prefix, "--image", NODE_IMAGE,
                 "--config", str(ROOT / "kind.yaml"), "--kubeconfig", str(kubeconfig), "--wait", "120s"], timeout=300)
            run(["kind", "load", "docker-image", image, "--name", prefix], timeout=90)
            kubectl("create", "namespace", namespace, namespaced=False)
            manifest = work / "workload.yaml"
            manifest.write_text((ROOT / "workload.yaml.in").read_text().replace("@IMAGE@", image))
            kubectl("apply", "-f", str(manifest))
            initial = rollout()
            server = json.loads(kubectl("version", "-o", "json", namespaced=False).stdout)["serverVersion"]["gitVersion"]
            assert server == "v1.35.8"
            baseline = service_read("v1")
            ip = obj("service", "notes")["spec"]["clusterIP"]
            print(json.dumps({"case": "deployment_service_dns", "server": server, "ready_pods": 2,
                              "service_dns": baseline["address"], "version": "v1"}), flush=True)
            old_uid = initial[0]["metadata"]["uid"]
            kubectl("delete", "pod", initial[0]["metadata"]["name"], "--wait=true", "--timeout=30s", timeout=40)
            replacement = rollout()
            assert old_uid not in {pod["metadata"]["uid"] for pod in replacement}
            assert obj("service", "notes")["spec"]["clusterIP"] == ip
            service_read("v1")
            print(json.dumps({"case": "controller_replacement", "replaced_uid": old_uid, "service_ip_unchanged": True}), flush=True)
            # A one-shot file makes health fail. Startup consumes it only after
            # the kubelet actually restarts this container; the Pod UID stays.
            target = ready_pods()[0]
            target_name, target_uid = target["metadata"]["name"], target["metadata"]["uid"]
            previous = target["status"]["containerStatuses"][0]
            kubectl("exec", target_name, "--", "python", "-c",
                    "from pathlib import Path;Path('/data/unhealthy-once').write_text('fixture')")
            def restarted():
                pod = obj("pod", target_name)
                statuses = pod["status"].get("containerStatuses", [])
                if (pod["metadata"]["uid"] == target_uid and statuses and statuses[0]["ready"]
                        and statuses[0]["restartCount"] > previous["restartCount"]):
                    return statuses[0]
                return None
            current = eventually(restarted, "liveness restart and readiness recovery", seconds=60)
            assert current["containerID"] != previous["containerID"]
            print(json.dumps({"case": "probe_restart", "same_pod_uid": True,
                              "restart_count": current["restartCount"], "last_state": current["lastState"]}), flush=True)
            kubectl("set", "env", "deployment/notes", "APP_VERSION=v2", "APP_READY=0")
            def stalled():
                conditions = obj("deployment", "notes")["status"].get("conditions", [])
                return any(c["type"] == "Progressing" and c.get("reason") == "ProgressDeadlineExceeded" for c in conditions)
            eventually(stalled, "bad readiness rollout stalled", seconds=60)
            assert kubectl("rollout", "status", "deployment/notes", "--timeout=2s", check=False, timeout=10).returncode != 0
            slices = obj("endpointslices", "-l", "kubernetes.io/service-name=notes")["items"]
            endpoints = [endpoint for item in slices for endpoint in item["endpoints"] if endpoint["conditions"].get("ready")]
            assert len(endpoints) == 2
            assert all(next(e["value"] for e in pod["spec"]["containers"][0]["env"] if e["name"] == "APP_VERSION") == "v1"
                       for pod in ready_pods())
            service_read("v1")
            print(json.dumps({"case": "failed_rollout", "reason": "ProgressDeadlineExceeded", "ready_endpoints": 2,
                              "serving_version": "v1", "auto_rollback": False}), flush=True)
            kubectl("rollout", "undo", "deployment/notes")
            rollout()
            service_read("v1")
            kubectl("set", "env", "deployment/notes", "APP_VERSION=v2", "APP_READY=1")
            final = rollout()
            assert all(next(e["value"] for e in p["spec"]["containers"][0]["env"] if e["name"] == "APP_VERSION") == "v2" for p in final)
            service_read("v2")
            print(json.dumps({"case": "explicit_undo_then_good_update", "final_version": "v2", "ready_pods": 2}), flush=True)
        finally:
            errors = []
            for arguments in [["kind", "delete", "cluster", "--name", prefix, "--kubeconfig", str(kubeconfig)], ["docker", "image", "rm", image]]:
                try:
                    run(arguments, check=False, timeout=90)
                except (OSError, subprocess.TimeoutExpired) as error:
                    errors.append(str(error))
            if prefix in run(["kind", "get", "clusters"]).stdout.split():
                errors.append("kind cluster remains")
            if run(["docker", "inspect", prefix + "-control-plane"], check=False).returncode == 0:
                errors.append("kind node container remains")
            if run(["docker", "image", "inspect", image], check=False).returncode == 0:
                errors.append("lab image tag remains")
            if errors:
                raise RuntimeError("cleanup incomplete: " + "; ".join(errors))
            print(json.dumps({"cleanup": "cluster_and_lab_image_removed", "prefix": prefix}), flush=True)
    assert not work.exists()
    print(json.dumps({"cleanup": "complete", "private_kubeconfig_removed": True}), flush=True)


if __name__ == "__main__":
    main()
