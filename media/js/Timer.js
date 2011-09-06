function Timer () {
    this.begin = null;
    this.accum = 0;
}

Timer.prototype.start = function () {
    if (this.begin == null) {
        this.begin = new Date();
    }
};

Timer.prototype.stop = function () {
    if (this.begin != null) {
        var now = new Date(),
            dur = now.getTime() - this.begin.getTime();
        this.accum += dur;
        this.begin = null;
        return dur;
    }
};

