import sys
import itertools
import time
from django.core.management.base import BaseCommand
from duns.models import Name
from duns.views import search_by_name, search_by_duns
from optparse import make_option
from progress import ProgressCounter
from sorensen import sorensen_index
import settings

def drop_last_word(name):
    words = name.split(' ')
    count = len(words)
    if count == 2:
        return words
    else:
        return words[:count-1]

class Command(BaseCommand):
    help = "Generates a table of auto-complete names."
    option_list = BaseCommand.option_list + (
        make_option('--singlename',
                    action='store',
                    dest='singlename',
                    type='string',
                    default=None),
    )

    def __init__(self, *args, **kwargs):
        super(BaseCommand, self).__init__(*args, **kwargs)

    def handle(self, singlename, *args, **options):
        name_query = (Name.objects.filter(duns_count__isnull=False,
                                          autocomplete_candidate=True)
                                  .order_by('-duns_count'))
        if singlename is None:
            names = name_query
        else:
            names = name_query.filter(name=singlename)
        self.spinner = ProgressCounter(0, len(names), sys.stdout)
        self.main(names)

    def main(self, names):
        for pass_number in itertools.count(1):
            print "[%s] Pass %d, names left: %d" % (time.strftime('%H:%M:%S'), pass_number, len(names))

            for name in names:
                name1 = Name.objects.get(name=name.name)
                if name1.autocomplete_candidate == True:
                    revocation_set = self.find_revocation_set(name)
                    num_revoked = self.revoke_names(revocation_set)
                self.spinner.tick()
                try:
                    sys.stdout.write("%s: revoked %d of %d" % (name.name, num_revoked, len(revocation_set)))
                except UnicodeEncodeError, e:
                    print str(e)
                sys.stdout.flush()

    def find_revocation_set(self, name):
        # A set of name strings to set autocomplete_candidate = False
        revocation_set = set()
        duns_found = search_by_name(name.name)
        if duns_found is not None:
            for duns_number in duns_found:
                names_found = search_by_duns(duns_number)
                if names_found is not None:
                    for name1 in names_found:
                        if sorensen_index(name.name, name1) > 0.7:
                            revocation_set.add(name1)
        return revocation_set
    
    def revoke_names(self, revocation_set):
        num_revoked = 0
        for name_string in revocation_set:
            name = Name.objects.get(name=name_string)
            if name.autocomplete_candidate == True:
                name.autocomplete_candidate = False
                name.save()
                num_revoked += 1
        return num_revoked


            


