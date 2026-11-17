import time

from django.core.management.base import BaseCommand, CommandError
from django.db import close_old_connections

from care.jobs import deliver_outbox, scan_deadlines
from messaging.jobs import scan_responses


class Command(BaseCommand):
    help = "Deliver in-app notifications locally; use --watch without Redis/Celery."

    def add_arguments(self, parser):
        parser.add_argument("--watch", action="store_true")
        parser.add_argument("--interval", type=int, default=15)

    def handle(self, *args, **options):
        interval = options["interval"]
        if interval < 1:
            raise CommandError("Interval must be at least one second.")
        try:
            while True:
                close_old_connections()
                try:
                    scan_deadlines()
                    scan_responses()
                    count = deliver_outbox()
                    self.stdout.write(f"Notification cycle: {count} queued events examined.")
                finally:
                    close_old_connections()
                if not options["watch"]:
                    return
                time.sleep(interval)
        except KeyboardInterrupt:
            self.stdout.write("Notification worker stopped.")
