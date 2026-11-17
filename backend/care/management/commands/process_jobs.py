from django.core.management.base import BaseCommand

from care.jobs import deliver_outbox, extract_document, scan_deadlines
from care.models import AIExtraction
from messaging.jobs import scan_responses


class Command(BaseCommand):
    help = "Run one background cycle locally without Redis/Celery."

    def handle(self, *args, **options):
        scan_deadlines()
        scan_responses()
        for pk in AIExtraction.objects.filter(status="QUEUED").values_list("id", flat=True):
            extract_document(str(pk))
        count = deliver_outbox()
        self.stdout.write(f"Background cycle complete; {count} outbox events examined.")
