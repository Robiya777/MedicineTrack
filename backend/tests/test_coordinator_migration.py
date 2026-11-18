from datetime import date, timedelta
import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.utils import timezone

def _exercise():
    executor = MigrationExecutor(connection)
    old = [('accounts', '0003_user_can_approve_medication_schedule'), ('care', '0002_initial')]
    executor.migrate(old)
    apps = executor.loader.project_state(old).apps
    try:
        territory = apps.get_model('care', 'Territory').objects.create(name='Synthetic migration territory')
        org = apps.get_model('care', 'Organization').objects.create(name='Synthetic migration hospital', type='HOSPITAL', territory=territory)
        user = apps.get_model('accounts', 'User').objects.create(username='legacy.staff', role='HOSPITAL', organization=org)
        session = apps.get_model('accounts', 'AuthSession').objects.create(user=user, client='web', current_jti='legacy-test', expires_at=timezone.now()+timedelta(days=1))
        patient = apps.get_model('care', 'Patient').objects.create(created_by=user, created_by_org=org, full_name='Synthetic migration patient', birth_date=date(1980,1,1), address='Synthetic', territory=territory, no_phone_reason='Synthetic')
        discharge = apps.get_model('care', 'Discharge').objects.create(patient=patient, hospital=org, created_by=user, discharged_at=timezone.now(), recommendations='Original advice', follow_up_reason='Original reason')
    finally:
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())
    from accounts.models import AuthSession, User
    from care.models import Discharge
    assert User.objects.get(pk=user.pk).role == 'COORDINATOR'
    assert AuthSession.objects.get(pk=session.pk).revoked_at is not None
    current = Discharge.objects.get(pk=discharge.pk)
    assert current.managing_organization_id == org.pk and current.created_by_id == user.pk
    assert current.recommendations == 'Original advice'
    from rest_framework_simplejwt.tokens import AccessToken
    from rest_framework.test import APIClient
    token = AccessToken.for_user(User.objects.get(pk=user.pk))
    token['sid'] = str(session.pk)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION='Bearer ' + str(token))
    assert client.get('/api/v1/me').status_code == 401


def test_hospital_migration_preserves_documents_and_revokes_sessions(tmp_path):
    import os
    import subprocess
    import sys
    env = {**os.environ, "DATABASE_URL": "sqlite:///" + str(tmp_path / "migration.sqlite3"), "DJANGO_SETTINGS_MODULE": "config.settings"}
    result = subprocess.run([sys.executable, "-c", "import django,runpy; django.setup(); runpy.run_path('tests/test_coordinator_migration.py')['_exercise']()"], env=env, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
