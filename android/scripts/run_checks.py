#!/usr/bin/env python3
"""Run client checks against synthetic demo data without printing the password."""
import argparse
import os
from pathlib import Path
import shlex
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--serial', default='emulator-5554')
parser.add_argument('--base', default='http://10.0.2.2:8011/api/v1')
args = parser.parse_args()
password = os.environ.get('MEDICINETRACK_TEST_PASSWORD')
if not password:
    raise SystemExit('Set MEDICINETRACK_TEST_PASSWORD for a synthetic seeded backend.')
root = Path(__file__).resolve().parents[1]
sdk = os.environ.get('ANDROID_HOME', os.environ.get('ANDROID_SDK_ROOT', ''))
adb = str(Path(sdk) / 'platform-tools/adb') if sdk else 'adb'
for apk in ('app/build/outputs/apk/debug/app-debug.apk', 'app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk'):
    subprocess.run([adb, '-s', args.serial, 'install', '-r', str(root/apk)], check=True)
remote = shlex.join(['am', 'instrument', '-w', '-e', 'base', args.base, '-e', 'password', password, 'uz.medicinetrack.app.test/uz.medicinetrack.app.FlowChecks'])
result = subprocess.run([adb, '-s', args.serial, 'shell', remote], capture_output=True, text=True, timeout=120)
output = (result.stdout+result.stderr).replace(password, '[redacted]')
print(output)
raise SystemExit(0 if result.returncode == 0 and 'PASS:' in output and 'FAIL:' not in output else 1)
