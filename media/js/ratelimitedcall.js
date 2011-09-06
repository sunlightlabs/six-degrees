function RateLimitedCall (min_delay, f, thisarg) {
    var last_call = new Date().getTime() - min_delay;
    return function () {
        var now = new Date().getTime(),
            since = now - last_call;
        if (since >= min_delay) {
            last_call = now;
            return f.apply(thisarg, arguments);
        } else {
            return null;
        }
    };
}

