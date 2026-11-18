from django.db import migrations, models
import django.db.models.deletion


def fill(apps, schema_editor):
    Discharge = apps.get_model('care', 'Discharge')
    Discharge.objects.using(schema_editor.connection.alias).update(managing_organization_id=models.F('hospital_id'))


class Migration(migrations.Migration):
    dependencies = [('care', '0002_initial')]
    operations = [
        migrations.AddField(model_name='discharge', name='managing_organization', field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.PROTECT, related_name='managed_discharges', to='care.organization')),
        migrations.RunPython(fill, migrations.RunPython.noop),
        migrations.AlterField(model_name='discharge', name='managing_organization', field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='managed_discharges', to='care.organization')),
    ]
