def parseint(s, default=None):
    try:
        return int(s.strip())
    except ValueError:
        return default
