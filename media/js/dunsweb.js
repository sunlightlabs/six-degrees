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
var set_color = function (n, hue_func, setf) {
    var r = hue_func(n, 0 + n),
        g = hue_func(n, 2 + n),
        b = hue_func(n, 4 + n);
    setf.call(r, g, b, 150);
    return rgb2hex(r, g, b, 150);
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

function retrieve_node_details (node) {
    $("#node-name").text(node);
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
        var seed = $("#entity-name").val().toUpperCase();

        $("#results-graph-container *").remove();
        $("#overlay").show("Appear");
        var canvas = document.getElementById("graph");
        $(canvas).attr("width", 1000);
        $(canvas).attr("height", 700);
        var crawler = new Crawler({delay: 500});
        var graph = new ParticleGraph(seed, {node_size: 5,
                                             target: canvas,
                                             width: canvas.width,
                                             height: canvas.height});
        var p = new Processing(canvas, graph.sketch_proc);
        $(graph).bind('lowframerate', function (frame_rate) {
            p.exit();
            crawler.exit();
            console.log("Stopped the crawler due to a low frame rate.");
        });
        $("#show-entity-btn").click(function(){
            p.exit();
        });
        $(graph).bind('mouseClicked', function (event, x, y) {
            var node = graph.node_at(x, y);
            if (node != null) {
                retrieve_node_details(node);
            }
        });
        var ui_ready = function () {
            $("#cancel-search-btn").hide();
        };
        $(crawler).bind('stop', ui_ready);
        $(crawler).bind('done', ui_ready);
        $("#cancel-search-btn").click(function(){
            crawler.stop();
        });
        $(crawler).bind('noderesult', function (event, node_value, result_type) {
        });
        $(crawler).bind('linkresult', function (event, link_value, result_type) {
            graph.add_link(link_value[0].toUpperCase(), link_value[1].toUpperCase());
       });

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
