from django.db import migrations, models
from django.utils import timezone


def forward(apps, schema_editor):
    alias = schema_editor.connection.alias
    User = apps.get_model('accounts', 'User')
    Session = apps.get_model('accounts', 'AuthSession')
    users = User.objects.using(alias).filter(role='HOSPITAL')
    ids = list(users.values_list('pk', flat=True))
    Session.objects.using(alias).filter(user_id__in=ids, revoked_at__isnull=True).update(revoked_at=timezone.now())
    users.update(role='COORDINATOR', can_approve_medication_schedule=False)


class Migration(migrations.Migration):
    dependencies = [('accounts', '0003_user_can_approve_medication_schedule'), ('care', '0003_discharge_managing_organization')]
    operations = [
        migrations.RunPython(forward),
        migrations.AlterField(model_name='user', name='role', field=models.CharField(max_length=16, choices=[('DOCTOR', 'Oilaviy shifokor'), ('COORDINATOR', 'Koordinator'), ('ADMIN', 'Texnik admin'), ('PATIENT', 'Bemor')])),
    ]
