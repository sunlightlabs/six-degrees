import re
from django.core.management.base import NoArgsCommand, BaseCommand
from duns.models import DUNS, Name, FPDS, FAADS
from duns.views import search_by_name, search_by_duns
from optparse import make_option
import settings

class Command(BaseCommand):
    help = "Crawl the USASpending data starting with either a DUNS number or a name."
    option_list = BaseCommand.option_list

    def process_queues(self):
        while True:
            if len(self.results_queue) > 0:
                while len(self.results_queue) > 0:
                    yield self.results_queue.pop()

            elif len(self.duns_queue) > 0:
                duns = self.duns_queue.pop()
                names = search_by_duns(duns)
                if names is not None:
                    names = [n.upper() for n in names]
                    new_names = list(set(names) - self.results_history)
                    self.results_queue.extend(new_names)
                    self.name_queue.extend(new_names)
                    self.results_history.update(set(new_names))

            elif len(self.name_queue) > 0:
                name = self.name_queue.pop()
                duns = search_by_name(name)
                if duns is not None:
                    new_duns = list(set(duns) - self.results_history)
                    self.results_queue.extend(new_duns)
                    self.duns_queue.extend(new_duns)
                    self.results_history.update(set(new_duns))

            else:
                return

    def handle(self, name_or_duns, *args, **options):
        name_or_duns = unicode(name_or_duns).upper()
        self.name_queue = []
        self.duns_queue = []
        if re.match("^\d+$", name_or_duns) is None:
            self.name_queue.append(name_or_duns)
        else:
            self.duns_queue.append(name_or_duns)
        self.results_queue = [name_or_duns]
        self.results_history = set([name_or_duns])

        for result in self.process_queues():
            print repr(result)



