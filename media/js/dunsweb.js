var duns_search_active = null;
var connectors = [];

function delay (ms, f, args) {
    setTimeout(function(){ f.apply(undefined, args); }, ms);
}

function byte2hex (n) {
    var nybHexString = "0123456789ABCDEF";
    return String(nybHexString.substr((n >> 4) & 0x0F,1)) + nybHexString.substr(n & 0x0F,1);
}
function rgb2hex (r,g,b) {
    return '#' + byte2hex(r) + byte2hex(g) + byte2hex(b);
}
var pastel_hue = function (n,phase) { 
    return Math.sin(0.8979777 * n + phase) * 45 + 205; 
};
var deep_hue = function (n, phase) {
    return Math.sin(0.8979777 * n + phase) * 95 + 155;
}
var color = function (n, hue_func) { 
    return rgb2hex(hue_func(n, 0 + n), 
                   hue_func(n, 2 + n), 
                   hue_func(n, 4 + n)); 
};
var pastel_color = function (n) {
    return color(n, pastel_hue);
};
var deep_color = function (n) { 
    return color(n, deep_hue);
};
var color_cycle = function (step) {
    return {
        'state': 0, 
        'step': step,
        'next': function () {
            var n = this.state;
            this.state += this.step;
            return color(n);
        }
    }
};
var connector_colors = color_cycle(0.3);

var connect_elements = function (source_id, target_id, color) {
    connectors.push([source_id, target_id, color]);
};

var draw_connectors = function () {
    var gap_width = $("#names-results").attr("clientLeft") - $("#duns-results").attr("clientLeft") + $("#duns-results").attr("clientWidth");
    var shape = (gap_width < 450) ? "Straight" : "Bezier";

    for (var idx = 0; idx < connectors.length; idx++) {
        var connection = $.extend([], connectors[idx]);
        connection.push(shape);
        delay(0, draw_connection, connection);
    }
};

var draw_connection = function (source_id, target_id, color, shape) {
    try {
        jsPlumb.connect({ source: source_id,
                          target: target_id,
                          anchors: [ "RightMiddle", "LeftMiddle" ],
                          endpoint: "Blank",
                          connector: shape,
                          paintStyle: { lineWidth: 2, 
                                        strokeStyle: color } 
                        });
    } catch (err) {
        console.log(err);
    }
};

function Crawler (options) {
	if (this === window) 
		return new Crawler(options);

	var defaults = {
		delay: 100,
		done_after_stop: true
	};
	var opts = $.extend(true, {}, defaults);
        opts = $.extend(true, opts, options || {});

	var that = this;
	var started = false;
	var done = false;
	var stopped = false;
	var duns_queue = [];
	var name_queue = [];
	var duns_results = [];
	var name_results = [];

	var recv_results = function (data, queue, results, result_type) {
		if (stopped) {
			finish();
			return;
		}

		for (var idx = 0; idx < data.length; idx++) {
			var _ = data[idx];
			if (results.indexOf(_) == -1) {
				queue.push(_);
				results.push(_);
				$(that).trigger('result', [_, result_type]);
			}
		}
		process_queues();
	};

	var recv_names = function (data, text_status, xhr) {
		recv_results(data, name_queue, name_results, 'name');
	};

	var recv_duns = function (data, text_status, xhr) {
		recv_results(data, duns_queue, duns_results, 'duns');
	};

	var search_by_duns = function (duns) {
		$.ajax("/duns/" + duns,
				{ data: "q=",
                  success: recv_names });
	};

	var search_by_name = function (name) {
		$.ajax("/duns/" + name,
				{ data: "q=",
                  success: recv_duns });
	};

	var process_queues = function () {
		if (duns_queue.length > 0) {
			var duns = duns_queue.shift();
			setTimeout(function(){ search_by_duns(duns); },
					   opts.delay);
		} else if (name_queue.length > 0) {
			var name = name_queue.shift();
			setTimeout(function(){ search_by_name(name); },
					   opts.delay);
		} else {
			finish();
		}
	};

	var finish = function () {
		done = true;
		$(that).trigger('done', duns_results, name_results);
	}

	this.stop = function () {
		stopped = true;
		$(that).trigger('stop');
	}

	this.start = function (seed, seed_type) {
		if (started || stopped || done ) {
			console.log("Crawler objects are not restartable.");
			return;
		}

		if (seed_type.toLowerCase() == 'duns') {
			duns_queue.push(seed);
			started = true;
			process_queues();
		} else if (seed_type.toLowerCase() == 'name') {
			name_queue.push(seed);
			started = true;
			process_queues();
		} else {
			console.log('Invalid crawler seed type: ' + seed_type);
		}
	};

	this.is_running = function () { return started && !done; }
	this.is_started = function () { return started; }
	this.is_done = function () { return started && done; }

	return that;
}

function ReplaceableCall (delay, proc) {
    var that = this;
    that.timeout = null;

    var do_proc = function () {
        that.timeout = null;
        proc();
    };

    var guarded_proc = function () {
        if (that.timeout != null) {
            clearTimeout(that.timeout);
        }
        that.timeout = setTimeout(do_proc, delay);
    };

    return guarded_proc;
}

$(document).ready(function(){
    var query_params = (function(a) {
        if (a == "") return {};
        var b = {};
        for (var i = 0; i < a.length; ++i)
        {
            var p=a[i].split('=');
            if (p.length != 2) continue;
            b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
        }
        return b;
    })(window.location.search.substr(1).split('&'));
	
    jsPlumb.setRenderMode(jsPlumb.Canvas);
    $("#cancel-search-btn").hide();
    $("#cancel-search-btn").click(function(){
        duns_search_active = false;
        $("#cancel-search-btn").hide();
    });
	$("#show-entity-btn").click(function(){
		$("#overlay").show("Appear");
		var crawler = Crawler({delay: 100});
		var ui_ready = function () {
			$("#cancel-search-btn").hide();
		};
		$(crawler).bind('stop', ui_ready);
		$(crawler).bind('done', ui_ready);
		$("#cancel-search-btn").click(function(){
			crawler.stop();
		});
		$(crawler).bind('result', function (event, result, result_type) {

			console.log(result_type + ': ' + result);
		});

   		var seed = $("#entity-name").val();
		crawler.start(seed, 'name');
		$("#cancel-search-btn").show();
    });

    var rate_limited_redraw = ReplaceableCall(200, draw_connectors);
    $(window).resize(function(evt){ 
        $("._jsPlumb_connector").remove();
        rate_limited_redraw();
    });;

    var q = query_params['q'];
    if (q != null) {
        q = q.trim();
        if (q.length > 0) {
   			$("#entity-name").val(q);
            lookup_duns_numbers(q);
        }
    }   
});
