import itertools

class flattened(object):
    """An iterator class that automatically chains sub-iterators."""

    def __init__(self, iterable, as_is=(str, unicode, bytes)):
        self.iterator = iter(iterable)
        self.as_is = as_is

    def __iter__(self):
        return self

    def next(self):
        item = self.iterator.next()
        
        if not isinstance(item, self.as_is):
            try:
                new_iter = iter(item)
                self.iterator = itertools.chain(new_iter, self.iterator)
                return self.next()
            except TypeError:
                pass
        
        return item
