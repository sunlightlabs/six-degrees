def parseint(s, default=None):
    try:
        if s is None:
            return default
        else:
            return int(s.strip())
    except ValueError:
        return default
