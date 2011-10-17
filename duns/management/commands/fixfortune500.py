import sys
import os
import re
from django.core.management.base import BaseCommand
from duns.models import Name

def slurp_lines(path):
    with file(path) as fil:
        return list((line.strip() for line in fil))

class Command(BaseCommand):
    help = "Ensures that names similar to names on the Fortune 500 list appear in the autocomplete list."
    option_list = BaseCommand.option_list

    def handle(self, *args, **kwargs):
        names_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), "fortune500.txt")
        names = slurp_lines(names_path)
        for index, name in enumerate(names, start=1):
            print >>sys.stderr, "%d%% (%d / %d)" % (round(index * 100 / len(names)), index, len(names))
            name = name.strip()
            name_records = Name.objects.filter(name=name)
            if len(name_records) > 0:
                for name_record in name_records:
                    if name_record.autocomplete_candidate == False:
                        name_record.autocomplete_candidate = True
                        name_record.save()
            else:
                words = re.split('([!@#$%^&*()~\s]|CORP|INC|THE|COMPAN(Y|IES)|INCORPORATED)+', name)
                words = filter(lambda w: w not in [None, ' '], words)
                if len(words) > 1 or (len(words) == 1 and len(words[0]) > 3):
                    query = Name.objects
                    for word in words:
                        query = query.filter(name__icontains=word)
                    name_records = query.order_by('-duns_count')
                    for name_record in name_records:
                        if name_record.autocomplete_candidate == False:
                            name_record.autocomplete_candidate = True
                            name_record.save()

