function delay (ms, f, args) {
    setTimeout(function(){ f.apply(undefined, args); }, ms);
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

function retrieve_node_details (selected_node) {
    $("#node-details *").remove();

    var create_element_for_node = function (node) {
        var elem = $("<li></li>");
        elem.text(node.value);
        elem.addClass(node.type + '-value');
//        elem.click(node.type == 'duns' ? show_duns : show_name);
        return elem;
    }

    var path = selected_node.path_to_root();
    path.reverse();
    for (var idx = 0; idx < path.length; idx++) {
        var node = path[idx];
        var element = create_element_for_node(node);
        if (idx > 0) {
            element.prepend("<b>&raquo;&nbsp;</b>");
        }
        $("#node-details").append(element);
    }
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
    
    $("#cancel-search-btn").hide();
    $("#cancel-search-btn").click(function(){
        $("#cancel-search-btn").hide();
    });
    $("#show-entity-btn").click(function(){
        var seed = $("#entity-name").val().toUpperCase();

        $("#results-graph-container *").remove();
        $("#node-details *").remove();
        $("#overlay").show("Appear");
        var canvas = document.getElementById("graph");
        $(canvas).attr("width", 1000);
        $(canvas).attr("height", 700);
        var crawler = new Crawler({delay: 100});
        var graph = new ParticleGraph(seed, {node_size: 5,
                                             frames_per_second: 24,
                                             updates_per_second: 12,
                                             target: canvas,
                                             width: canvas.width,
                                             height: canvas.height});
        var p = new Processing(canvas, graph.sketch_proc);
        $(graph).bind('lowframerate', function (event, frame_rate) {
            setTimeout(graph.pause, 15 * 1000);
            crawler.stop();
            $("#low-frame-rate-warning").show();
        });
        $("#show-entity-btn").click(function(){
            p.exit();
        });
        $(graph).bind('nodeSelected', function (event, node) {
            retrieve_node_details(node);
        });
        var ui_ready = function () {
            $("#cancel-search-btn").hide();
            $("#low-frame-rate-warning").hide();
        };
        $(crawler).bind('done', function(){ ui_ready(); setTimeout(graph.pause, 15 * 1000); });
        $("#cancel-search-btn").click(function(){
            crawler.stop();
			$("#search-queue-length").text("");
        });
        $(crawler).bind('noderesult', function (event, node_value, result_type) {
        });
        $(crawler).bind('linkresult', function (event, link_value, result_type) {
            var inverted_type = (result_type == 'name') ? 'duns' : 'name';
            var a = { type: inverted_type,
                      value: link_value[0].toUpperCase() },
                b = { type: result_type,
                      value: link_value[1].toUpperCase() };
            graph.add_link(a, b);

			var search_queue_length = crawler.name_queue_length() + crawler.duns_queue_length();
			$("#search-queue-length").text("Items left to search for: " + search_queue_length);
       });

        crawler.start(seed, 'name');
        $("#cancel-search-btn").show();
    });

    var q = query_params['q'];
    if (q != null) {
        q = q.trim();
        if (q.length > 0) {
            $("#entity-name").val(q);
            lookup_duns_numbers(q);
        }
    }   
});
