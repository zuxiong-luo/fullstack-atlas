"""Observe a bounded cgroup OOM; keep a small PID1 reader after the allocator dies."""
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path('/sys/fs/cgroup')


def snapshot():
    values = {name: (ROOT / name).read_text().strip()
              for name in ('memory.max', 'memory.swap.max', 'memory.current', 'memory.peak')}
    values['memory.events'] = {key: int(value) for line in (ROOT / 'memory.events').read_text().splitlines()
                              for key, value in [line.split()]}
    return values


def main():
    before = snapshot()
    print(json.dumps({'event': 'oom_before', 'cgroup': before}), flush=True)
    program = ('import json;chunks=[];'
               'print(json.dumps({"event":"allocator_started"}),flush=True);'
               'exec("for _ in range(32):\\n chunks.append(bytearray(8*1024*1024))");'
               'print(json.dumps({"event":"unexpected_allocation_success"}),flush=True)')
    child = subprocess.Popen([sys.executable, '-u', '-c', program])
    try:
        result = child.wait(timeout=20)
    finally:
        if child.poll() is None:
            child.kill()
            child.wait(timeout=2)
    after = snapshot()
    killed = after['memory.events']['oom_kill'] - before['memory.events']['oom_kill']
    print(json.dumps({'event': 'oom_after', 'allocator_exit': result,
                      'oom_kill_delta': killed, 'cgroup': after}), flush=True)
    if result != -9 or killed < 1:
        raise RuntimeError('expected allocator SIGKILL and real cgroup oom_kill increment')
    # Translate the verified allocator death to a deliberate fixture exit status.
    # Docker OOMKilled and memory.events are checked separately by the controller.
    raise SystemExit(137)


if __name__ == '__main__':
    main()
