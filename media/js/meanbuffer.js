function RingBuffer (size, initial) {
	this.max_length = size;
	this.buf = [];
}

RingBuffer.prototype.put = function (value) {
	var replaced_value = this.is_full() ? this.buf.shift() : null;
	this.buf.push(value);
	return replaced_value;
};

RingBuffer.prototype.length = function () {
	return this.buf.length;
};

RingBuffer.prototype.is_full = function () {
	return this.buf.length == this.max_length;
};


function MeanBuffer (size) {
	this.ring_buf = new RingBuffer(size);
	this.current = null;
}

MeanBuffer.prototype.put = function (value) {
	if (this.current == null) {
		this.ring_buf.put(value);
		this.current = value;
		return null;
	} else {
		var replaced_value = this.ring_buf.put(value);
		if (replaced_value != null) {
			this.current -= replaced_value;
		}
		this.current += value;
		return replaced_value;
	}
};

MeanBuffer.prototype.mean = function () {
	return this.current / this.ring_buf.length();
};

