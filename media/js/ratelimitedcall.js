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

function ArgumentQueue () {
	var that = this;
	this.queue = [];

	this.dequeue = function () {
		if (this.queue.length > 0) {
			var args = this.queue.shift();
			if (this.queue.length == 0) {
				$(this).trigger('emptied', []);
			}
			return args;
		} else {
			return undefined;
		}
	};

	this.enqueue = function (args) {
		this.queue.push(args);
	};

	this.backlog_size = function () {
		return this.queue.length;
	};

	this.is_empty = function () {
		return this.queue.length == 0;
	};
	
	return that;
};

function QueuedRateLimitedCall (min_delay, f, thisarg) {
	var that = this,
		last_call = new Date().getTime() - min_delay,
		call_queue = new ArgumentQueue();

	this.pump_queue = function () {
		if (call_queue.backlog_size() == 0) {
			return;
		}
		var now = new Date().getTime(),
			since = now - last_call;
		if (since >= min_delay) {
			args = call_queue.dequeue();
			last_call = now;
			f.apply(thisarg, args);
			if (call_queue.backlog_size() > 0) {
				setTimeout(function (){ that.pump_queue(); }, min_delay);
			}
		} else if (call_queue.backlog_size() > 0) {
			setTimeout(function (){ that.pump_queue(); }, min_delay - since);
		}
	};

	var g = function () {
		call_queue.enqueue(Array.prototype.slice.call(arguments, [0]));
		that.pump_queue();
	};
	g.queue = call_queue;
	return g;
}
