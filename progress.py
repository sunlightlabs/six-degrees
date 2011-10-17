class ProgressCounter(object):
    def __init__(self, start, target, terminal):
        self.terminal = terminal
        self.start = start
        self.target = target
        self.current = self.start

    def tick(self, erase_line=True):
        self.current += 1
        n = self.current - self.start
        d = self.target - self.start
        pct = round(float(n) * 100 / float(d), 2)
        if erase_line:
            self.terminal.write("\x1B[2K")
            self.terminal.write("\x1B[1G")
        self.terminal.write("%d / %d (%s%%) " % (n, d, pct))


    def done(self):
        pass

    def percentage(self):
        return (self.current - self.start) / (self.target - self.start)

    def isdone(self):
        return self.current >= self.target

class ProgressSpinner(object):
    def __init__(self, terminal):
        self.progress_chars = list(['|', '/', '-', '\\'])
        self.count = 0
        self.terminal = terminal

    def tick(self):
        self.terminal.write("\x1B[1D")
        self.terminal.write(self.progress_chars[self.count % len(self.progress_chars)])
        self.terminal.flush()
        self.count += 1

    def done(self):
        self.terminal.write("\x1B[1D")
        self.terminal.write('Done\n')
        self.terminal.flush()

if __name__ == "__main__":
    import sys
    import time
    spinner = ProgressSpinner(sys.stdout)
    try:
        while spinner.count < 100:
            spinner.tick()
            time.sleep(0.1)
        spinner.done()
    except KeyboardInterrupt:
        spinner.done()
