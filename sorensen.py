def sorensen_index(a, b):
    def bigrams(s):
        return [t + u for (t, u) in zip(iter(s), iter(s[1:]))]

    A = bigrams(a)
    B = bigrams(b)
    C = set(A) & set(B)
    if len(A) == 0 and len(B) == 0:
        return 0
    else:
        return float(2 * len(C)) / float(len(A) + len(B))

