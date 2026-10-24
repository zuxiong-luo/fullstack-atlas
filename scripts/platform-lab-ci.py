"""Run an isolated teaching lab and retain bounded public diagnostics, including success evidence."""
import argparse
import os
import signal
import subprocess
import sys

parser = argparse.ArgumentParser()
parser.add_argument('--timeout', type=int, required=True)
parser.add_argument('command', nargs=argparse.REMAINDER)
args = parser.parse_args()
command = args.command[1:] if args.command[:1] == ['--'] else args.command
if not command or not 1 <= args.timeout <= 2700:
    parser.error('a command and timeout in 1..2700 seconds are required')
process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                           text=True, errors='replace', start_new_session=True)
try:
    output, _ = process.communicate(timeout=args.timeout)
except subprocess.TimeoutExpired:
    os.killpg(process.pid, signal.SIGTERM)
    try:
        output, _ = process.communicate(timeout=45)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGKILL)
        output, _ = process.communicate()
    output += '\nCI lab exceeded its explicit overall deadline.\n'
    result = 124
else:
    result = process.returncode
print(output, flush=True)
if os.environ.get('GITHUB_ACTIONS') == 'true':
    evidence = output[-14000:].replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
    print('::' + ('notice' if result == 0 else 'error') + '::' + evidence, flush=True)
raise SystemExit(result)
