import sys
import os
import re
from django.core.management.base import BaseCommand
from duns.models import Name, DUNS, FPDS

class Command(BaseCommand):
    help = "Insert easter egg database records."
    option_list = BaseCommand.option_list

    MOVIES = [ #['Animal House', 1978],
              ['Starting Over', 1979],
              ['Hero at Large', 1980],
              ['Friday the 13th', 1980],
              ['Only When I Laugh', 1981],
              ['Diner', 1982],
              ['Forty Duece', 1982],
              ['Enormous Changes at the Last Minute', 1983],
              ['Footloose', 1984],
              ['Quicksilver', 1986],
              ['White Water Summer', 1987],
              ['End of the Line', 1987],
              ['Planes, Trains, & Automobiles', 1987],
              ['She\'s Having a Baby', 1988],
              ['Criminal Law', 1988],
              ['The Big Picture', 1989],
              ['Tremors', 1990],
              ['Flatliners', 1990],
              ['Queens Logic', 1991],
              ['He Said, She Said', 1991],
              ['Pyrates', 1991],
              ['JFK', 1991],
              ['A Few Good Men', 1992],
              ['New York Skyride', 1994],
              ['The Air Up There', 1994],
              ['The River Wild', 1994],
              ['Murder in the First', 1995],
              ['Apollo 13', 1995],
              ['Balto', 1995],
              ['Sleepers', 1996],
              ['Picture Perfect', 1997],
              ['Telling Lies in America', 1997],
              ['Digging to China', 1998],
              # ['Wild Things', 1998],
              ['Stir of Echoes', 1999],
              ['My Dog Skip', 2000],
              ['Hollow Man', 2000],
              ['Novocaine', 2001],
              ['Trapped', 2002],
              # ['Mystic River', 2003],
              ['In the Cut', 2003],
              ['The Woodsman', 2004],
              ['Cavedweller', 2004],
              ['Loverboy', 2005],
              ['Beauty Shop', 2005],
              ['Where the Truth Lies', 2005],
              ['The Air I Breathe', 2007],
              ['Death Sentence', 2007],
              ['Rails & Ties', 2007],
              ['Frost/Nixon', 2008],
              ['My One and Only', 2009],
              ['SUPER', 2010]]

    def handle(self, *args, **kwargs):
        try:
            kbacon = Name.objects.get(name='Kevin Bacon')
        except Name.DoesNotExist:
            kbacon = Name(name='Kevin Bacon')
            kbacon.save()

        for ix, movie in enumerate(self.MOVIES, start=1):
            try:
                name = Name.objects.get(name=movie[0])
            except Name.DoesNotExist:
                name = Name(name=movie[0])
                name.save()

            try:
                duns = DUNS.objects.get(number=str(movie[1]))
            except DUNS.DoesNotExist:
                duns = DUNS(number=str(movie[1]))
                duns.save()

            if FPDS.objects.filter(company_name=name, duns=duns).count() == 0:
                fpds1 = FPDS(company_name=name, duns=duns, fiscal_year=movie[1], data_commons_id=-ix)
                fpds1.save()
                print "%s -> %s" % (movie[1], movie[0])

            if FPDS.objects.filter(company_name=kbacon, duns=duns).count() == 0:
                fpds2 = FPDS(company_name=kbacon, duns=duns, fiscal_year=movie[1], data_commons_id=-len(self.MOVIES)-ix)
                fpds2.save()
                print "Kevin Bacon -> %s" % movie[1]


