import random
import sys
from django.db.models import Count
from duns.models import FPDS, Name, DUNS
from duns.views import DUNSBlacklist


class Node(object):
    def __init__(self, nodevalue):
        self.value = nodevalue
        self.children = []

def duns_get_or_none(number):
    try:
        return DUNS.objects.get(pk=number)
    except DUNS.DoesNotExist:
        return None

def parents(duns, fiscal_year=None):
    assert isinstance(duns, DUNS) == True
    parent_query = duns.fpds
    if isinstance(fiscal_year, int):
        parent_query = parent_query.filter(fiscal_year=fiscal_year)
    elif isinstance(fiscal_year, (str, unicode)):
        parent_query = parent_query.filter(fiscal_year__in=fiscal_year)
    parent_counts = parent_query.values('duns_parent').annotate(Count('duns_parent'))
    parents = [duns_get_or_none(c['duns_parent']) for c in parent_counts]
    return parents

def children(duns, fiscal_year=None):
    assert isinstance(duns, DUNS) == True
    child_query = duns.fpds_parent
    if isinstance(fiscal_year, int):
        child_query = child_query.filter(fiscal_year=fiscal_year)
    elif isinstance(fiscal_year, (str, unicode)):
        child_query = child_query.filter(fiscal_year__in=fiscal_year)
    child_counts = child_query.values('duns').annotate(Count('duns'))
    children = [duns_get_or_none(c['duns']) for c in child_counts]
    return children

def related_duns(seed, fiscal_year=None):
    assert isinstance(seed, DUNS) == True
    queue = [seed]
    duns = [seed]

    if len(queue) > 0:
        subject = queue.pop(0)
        if subject.number in DUNSBlacklist:
            print >>sys.stderr, 'Ignoring blacklisted %s' % subject.number
        else:
            print >>sys.stderr, "Considering %s" % subject.number
            for d in children(subject, fiscal_year):
                if d not in duns:
                    if d.number in DUNSBlacklist:
                        print >>sys.stderr, "Ignoring blacklisted %s" % d.number
                    else:
                        print >>sys.stderr, "Queueing child %s" % d.number
                        queue.append(d)
                        duns.append(d)
            for d in parents(subject, fiscal_year):
                if d not in duns:
                    if d.number in DUNSBlacklist:
                        print >>sys.stderr, "Ignoring blacklisted %s" % d.number
                    else:
                        #print >>sys.stderr, "Queueing parent %s" % d.number
                        #queue.append(d)
                        duns.append(d)
    return duns

def dump_dot(subject, dunslist):
    edgelist = []
    def add_edge(newedge):
        (a, b) = newedge
        if a != b:
            if a not in DUNSBlacklist and b not in DUNSBlacklist:
                if newedge not in edgelist:
                    edgelist.append(newedge)
    for duns in dunslist:
        for p in parents(duns):
            add_edge((p.number, duns.number))
        for c in children(duns):
            add_edge((duns.number, c.number))
    print "digraph dunsheirarchy {"
    print "  %s [style=filled,fontcolor=white,fillcolor=black];" % subject
    for (index, (a, b)) in enumerate(edgelist):
        print "  %s -> %s;" % (a, b)
    print "}"

def main():
    for arg in sys.argv:
        try:
            duns = DUNS.objects.get(number=arg)
            print >>sys.stderr, 'Starting at %s' % duns.number
            relatives = related_duns(duns, fiscal_year=None)
            dump_dot(arg, relatives)
        except DUNS.DoesNotExist:
            print >>sys.stderr, 'Does not exist %s' % arg

if __name__ == "__main__":
    main()
