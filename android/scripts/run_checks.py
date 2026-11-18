#!/usr/bin/env python3
"""Run client checks against synthetic demo data without printing the password."""
import argparse
import json
import os
from pathlib import Path
import shlex
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--serial', default='emulator-5554')
parser.add_argument('--base', default='http://10.0.2.2:8001/api/v1')
parser.add_argument('--mode', choices=['full', 'layout'], default='full')
parser.add_argument('--patient-user', default='demo.patient')
parser.add_argument('--doctor-user', default='demo.doctor')
parser.add_argument('--linked-base')
parser.add_argument('--linked-fixture', type=Path)
parser.add_argument('--linked-report', type=Path)
args = parser.parse_args()
password = os.environ.get('MEDICINETRACK_TEST_PASSWORD')
if not password:
    raise SystemExit('Set MEDICINETRACK_TEST_PASSWORD for a synthetic seeded backend.')
root = Path(__file__).resolve().parents[1]
sdk = os.environ.get('ANDROID_HOME', os.environ.get('ANDROID_SDK_ROOT', ''))
adb = str(Path(sdk) / 'platform-tools/adb') if sdk else 'adb'
for apk in ('app/build/outputs/apk/debug/app-debug.apk', 'app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk'):
    subprocess.run([adb, '-s', args.serial, 'install', '-r', str(root/apk)], check=True)
arguments = ['am', 'instrument', '-w', '-e', 'base', args.base, '-e', 'password', password,
             '-e', 'mode', args.mode, '-e', 'patientUser', args.patient_user,
             '-e', 'doctorUser', args.doctor_user]
linked_password = os.environ.get('MEDICINETRACK_LINKED_PASSWORD', '')
if args.linked_base:
    if not args.linked_fixture or not linked_password:
        raise SystemExit('Linked checks need --linked-fixture and MEDICINETRACK_LINKED_PASSWORD.')
    fixture = json.loads(args.linked_fixture.read_text())
    if args.linked_report:
        report = json.loads(args.linked_report.read_text())
        if report['fixture_run'] != fixture['run_id']:
            raise SystemExit('Web report and linked fixture must belong to the same run.')
        evidence = [row.get('evidence', {}) for row in report['checks'] if row['passed']]
        fixture['web_task_id'] = next(row['task_id'] for row in evidence if 'task_id' in row)
        fixture['web_patient_id'] = next(row['patient_id'] for row in evidence if 'discharge_id' in row and 'patient_id' in row)

    arguments += ['-e', 'linkedBase', args.linked_base, '-e', 'linkedPassword', linked_password,
                  '-e', 'linkedFixture', json.dumps(fixture)]
arguments += ['uz.medicinetrack.app.test/uz.medicinetrack.app.FlowChecks']
remote = shlex.join(arguments)
result = subprocess.run([adb, '-s', args.serial, 'shell', remote], capture_output=True, text=True, timeout=300)
output = (result.stdout+result.stderr).replace(password, '[redacted]')
if linked_password:
    output = output.replace(linked_password, '[redacted]')
print(output)
raise SystemExit(0 if result.returncode == 0 and 'PASS:' in output and 'FAIL:' not in output else 1)
