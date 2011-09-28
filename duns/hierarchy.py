import sys
from django.db.models import Count
from duns.models import DUNS
from duns.views import DUNSBlacklist


class Node(object):
    def __init__(self, nodevalue):
        self.value = nodevalue
        self.children = set()

    def __repr__(self):
        return "<Node(%s, %r children)>" % (repr(self.value), len(self.children))


class Graph(object):
    def __init__(self):
        self.roots = set()
        self.nodes = {}

    def add_node(self, value):
        if value not in self.nodes:
            node = Node(value)
            self.nodes[value] = node
            self.roots.add(node)
        return self.nodes[value]

    def add_edge(self, a, b):
        if a in self.nodes and b in self.nodes:
            node_a = self.nodes[a]
            node_b = self.nodes[b]
            node_a.children.add(node_b)
            if node_b in self.roots:
                self.roots.remove(node_b)

    def find(self, needle):
        if needle in self.nodes:
            return self.nodes[needle]
        else:
            return None

    def walk(self, visitor):
        seen = set()
        def _walk(n):
            if n not in seen:
                seen.add(n)
                visitor(n)
                for c in n.children:
                    _walk(c)
        for r in self.roots:
            _walk(r)

def duns_get_or_none(number):
    try:
        return DUNS.objects.get(pk=number)
    except DUNS.DoesNotExist:
        return None

def ancestors(subject, graph):
    assert isinstance(subject, DUNS) == True
    if subject.number not in DUNSBlacklist:
        parent_counts = subject.fpds.values('duns_parent').annotate(Count('duns_parent'))
        parents = [duns_get_or_none(c['duns_parent']) for c in parent_counts]
        for parent in parents:
            if parent.number not in DUNSBlacklist and parent.number != subject.number:
                graph.add_node(parent.number)
                graph.add_edge(parent.number, subject.number)
        for parent in parents:
            if parent.number not in DUNSBlacklist and parent.number != subject.number:
                ancestors(parent, graph)
    return ancestors

def descendants(subject, graph):
    assert isinstance(subject, DUNS) == True
    if subject.number not in DUNSBlacklist:
        child_counts = subject.fpds_parent.values('duns').annotate(Count('duns'))
        children = [duns_get_or_none(c['duns']) for c in child_counts]
        for child in children:
            if child.number not in DUNSBlacklist and child.number != subject.number:
                graph.add_node(child.number)
                graph.add_edge(subject.number, child.number)
        for child in children:
            if child.number not in DUNSBlacklist and child.number != subject.number:
                descendants(child, graph)

def related_duns(seed):
    assert isinstance(seed, DUNS) == True
    graph = Graph()
    graph.add_node(seed.number)
    ancestors(seed, graph)
    descendants(seed, graph)
    return graph

def dump_dot(subject, graph):
    def print_edges(node):
        for c in node.children:
            print "  %s -> %s;" % (node.value, c.value)

    print "digraph dunsheirarchy {"
    print "  %s [style=filled,fontcolor=white,fillcolor=black];" % subject
    graph.walk(print_edges)
    print "}"

def main():
    for arg in sys.argv[1:]:
        try:
            duns = DUNS.objects.get(number=arg)
            relatives = related_duns(duns)
            dump_dot(arg, relatives)
        except DUNS.DoesNotExist:
            print >>sys.stderr, 'Does not exist %s' % arg

if __name__ == "__main__":
    main()
