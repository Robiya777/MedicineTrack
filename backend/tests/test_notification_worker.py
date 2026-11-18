import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from care.models import Notification

pytestmark = pytest.mark.django_db


@pytest.mark.django_db(transaction=True)
def test_notification_command_delivers_once(world, task):
    # The standalone worker owns its DB connection lifecycle; do not embed it
    # inside pytest's long-running transaction, which close_old_connections closes.
    call_command("process_notifications")
    rows = Notification.objects.filter(recipient=world.doctor, task=task)
    assert rows.count() == 1
    call_command("process_notifications")
    assert rows.count() == 1


def test_notification_command_rejects_invalid_interval():
    with pytest.raises(CommandError):
        call_command("process_notifications", watch=True, interval=0)
