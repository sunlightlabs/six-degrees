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


function TraerGraph (root, options) {
    if (this === window)
        return new TraerGraph(options);

    var defaults = {
        width: 1000,
        height: 700,
        mass: 100,
        edge_strength: 0.001,
        spacer_strength: 900,
        node_size: 3,
        background: {r: 99, g: 99, b: 99}
    };
    var opts = $.extend(true, {}, defaults);
        opts = $.extend(true, opts, options || {});

    var that = this;
    var physics = new ParticleSystem(0.0, 0.8);
    var centroid = new Smoother3D(0.8);
    centroid.x0.setValue(0.0);
    centroid.y0.setValue(0.0);
    centroid.z0.setValue(1.0);
    // nodes and particles are parallel arrays where the particle at a given
    // offset corresponds to the node value at that same offset on the nodes array
    var nodes = [];
    var particles = [];
    // edges is an array of 2-element arrays that hold the offset into the
    // nodes & particle arrays for each end of the link.
    var edges = [];

    var update_centroid = function () {
        var x_min = 999999.9,
            x_max = -999999.9,
            y_min = 999999.9,
            y_max = -999999.9;

        for (var idx = 0; idx < particles.length; idx++) {
            var pos = particles[idx].position;
            x_min = Math.min(x_min, pos.x);
            x_max = Math.max(x_max, pos.x);
            y_min = Math.min(y_min, pos.y);
            y_max = Math.max(y_max, pos.y);
        }

        var dx = x_max - x_min,
            dy = y_max - y_min;
        centroid.x0.setTarget(x_min + 0.5 * dx);
        centroid.y0.setTarget(y_min + 0.5 * dy);
        centroid.z0.setValue(Math.min(1, opts.width / dx, opts.height / dy));
    };

    this.node_at = function (x, y) {
        var x1 = (x + centroid.x() - (opts.width / 2)) * (1/centroid.z());
        var y1 = (y + centroid.y() - (opts.height / 2)) * (1/centroid.z());
        for (var idx = 0; idx < particles.length; idx++) {
            var x2 = particles[idx].position.x;
            var y2 = particles[idx].position.y;
            var distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
            if (distance <= opts.node_size * 5) {
                return nodes[idx];
            }
        }
        return null;
    };

    this.add_link = function (a, b) {
        var a_offset = nodes.indexOf(a);
        var b_offset = nodes.indexOf(b);
        if ((a_offset == -1) && (b_offset == -1)) {
            console.log("The universe is falling apart.");
            throw "The universe is falling apart.";
        } else if (a_offset == -1) {
            a_offset = append_node(a, {near: particles[b_offset].position});
        } else if (b_offset == -1) {
            b_offset = append_node(b, {near: particles[a_offset].position});
        }
        var a_node = nodes[a_offset];
        var a_prtcl = particles[a_offset];
        var b_node = nodes[b_offset];
        var b_prtcl = particles[b_offset];
        physics.makeSpring(a_prtcl, b_prtcl, 
                           opts.edge_strength * 0.5, opts.edge_strength * 1.5, 
                           opts.node_size * 30);
        edges.push([a_offset, b_offset]);
    };

    var append_node = function (value, options) {
        var near = options.near || particles[0].position;
        var p = physics.makeParticle();
        p.position.x = near.x + Math.floor((Math.random() * 6 - 3));
        p.position.y = near.y + Math.floor((Math.random() * 2 - 1));
        for (var idx = 0; idx < particles.length; idx++) {
            var q = particles[idx];
            physics.makeAttraction(p, q, -opts.spacer_strength, opts.node_size * 2);
        }
        nodes.push(value);
        particles.push(p);
        return nodes.length - 1;
    };

    var reset = function () {
        //physics.clear();
        append_node(root, {near: {x: 0, y: 0}});
    };

    this.sketch_proc = function (processing) {
        processing.draw = function(){
            physics.tick();
            if (particles.length > 1)
                update_centroid();
            processing.translate(opts.width / 2, opts.height / 2);
            processing.scale(centroid.z());
            processing.translate(-centroid.x(), -centroid.y());

            processing.background(opts.background.r, opts.background.g, opts.background.b);

            // Draw edges
            for (var idx = 0; idx < edges.length; idx++) {
                var a_prtcl = particles[edges[idx][0]];
                var b_prtcl = particles[edges[idx][1]];
                set_color(edges[idx][0], deep_hue, processing.stroke);
                processing.line(a_prtcl.position.x, a_prtcl.position.y,
                                b_prtcl.position.x, b_prtcl.position.y);
            }

            // Draw nodes
            for (var idx = 0; idx < particles.length; idx++) {
                var prtcl = particles[idx];
                var cx = prtcl.position.x,
                    cy = prtcl.position.y;
                processing.noStroke();
                set_color(idx, (idx % 2 == 1) ? deep_hue : pastel_hue, processing.fill);
                processing.ellipse(cx,
                                   cy,
                                   opts.node_size * 5,
                                   opts.node_size * 5);
                processing.fill(0, 0, 0, 255);
                processing.ellipse(cx,
                                   cy,
                                   opts.node_size,
                                   opts.node_size);
            }
        };
        processing.setup = function(){
            processing.frameRate(24);
            processing.colorMode(processing.RGB);
            processing.size(opts.width, opts.height);
        };
        processing.mouseClicked = function(){
            $(that).trigger('mouseClicked', [processing.mouseX, processing.mouseY]);
        };
    };

    reset();
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
        var traer = new TraerGraph(seed, {node_size: 5,
                                          target: canvas,
                                          width: canvas.width,
                                          height: canvas.height});
        var p = new Processing(canvas, traer.sketch_proc);
        $(traer).bind('mouseClicked', function (event, x, y) {
            var node = traer.node_at(x, y);
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
            p.exit();
        });
        $(crawler).bind('noderesult', function (event, node_value, result_type) {
            //console.log(result_type + ': ' + node_value);
        });
        $(crawler).bind('linkresult', function (event, link_value, result_type) {
            traer.add_link(link_value[0].toUpperCase(), link_value[1].toUpperCase());
            //console.log(result_type + ' link: ' + link_value);
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
