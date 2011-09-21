var deep_colors = [
// [red, green, blue, alpha],
    [155, 241, 83, 255],
    [244, 89, 119, 255],
    [97, 110, 249, 255],
    [102, 248, 129, 255]
];
var GraphOptions = {
    node_size: 5,
    frames_per_second: 24,
    updates_per_second: 12,
    spacer_strength: 1200,
    edge_strength: 0.007,
    background: [0, 0, 0, 0],
    edge_color: [0xe0, 0xe0, 0xe0, 0xff],
    node_center_color: [0x0, 0x0, 0x0, 0xff],
    node_main_color: [0xe0, 0xe0, 0xe0, 0xff],
    node_border_color: [0x20, 0x20, 0x20, 0xff],
    selection_colors: {
        node_center: null,
        node_main: deep_colors,
        node_border: null,
        edge: deep_colors,
    }
};

function display_node_details (data, textStatus, jqXHR) {
    var snippet = $(data);
    $("#node-details-container *").remove();
    $("#node-details-container").append(snippet);
}

function retrieve_node_details (node) {
    $("#node-details-container *").remove();
    $.ajax('/duns/details/' + encodeURIComponent(node.value) + '.html', {
           data: 'q=',
           success: display_node_details
           });
}

function display_route_to_root (selected_node) {
    $("#node-route *").remove();

    var create_element_for_node = function (node) {
        var elem = $("<li></li>");
        elem.text(node.value);
        elem.addClass(node.type + '-value');
        elem.click(function (event) { retrieve_node_details(node); });
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
        $("#node-route").append(element);
    }
}

function ui_ready () {
    $("#cancel-search-btn").hide();
    $("#low-frame-rate-warning").hide();
};

function start_crawler (debug) {
    var seed = $("#entity-name").val().toUpperCase();

    $("#results-graph-container *").remove();
    $("#node-details *").remove();
    $("#overlay").show("Appear");
    var canvas = document.getElementById("graph");
    var crawler = new Crawler({delay: 250});
    var graph_options = $.extend(true, {}, GraphOptions);
    graph_options = $.extend(true, graph_options, {target: canvas,
                                                   width: $(canvas).width(),
                                                   height: $(canvas).height(),
                                                   debug: debug});
    var graph = new ParticleGraph(seed, graph_options);
    var p = new Processing(canvas, graph.sketch_proc);
    $(graph).bind('paused', function (event) {
        ui_ready();
    });
    $(graph).bind('lowframerate', function (event, frame_rate) {
        setTimeout(graph.pause, 15 * 1000);
        crawler.stop();
        $("#low-frame-rate-warning").show();
    });
    var cancel_crawler = function (event) {
        if (p != null) {
            crawler.stop();
            p.noLoop();
            p = null; // Should be the only reference. Let the GC clean up the event bindings.
        };
    };
    $("#show-entity-btn").click(cancel_crawler);
    $("#entity-name").keyup(function(event){
        if (event.keyCode == 13) {
            cancel_crawler(event);
        }
    });
    $(graph).bind('nodeSelected', function (event, node) {
        display_route_to_root(node);
    });
    $(crawler).bind('done', function(){
        setTimeout(graph.pause, 15 * 1000);
    });
    $("#cancel-search-btn").click(function(){
        crawler.stop();
        $("#search-queue-length").text("");
    });
    $(crawler).bind('noderesult', function (event, node_value, result_type) {
        var search_queue_length = crawler.name_queue_length() + crawler.duns_queue_length();
        $("#search-queue-length").text("Items left to search for: " + search_queue_length);
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
    $("#show-entity-btn").click(function(event){
        start_crawler(!(query_params['debug'] == null));
    });
    $("#entity-name").keyup(function(event){
        if (event.keyCode == 13) {
            $("#entity-name").autocomplete('close');
            start_crawler(!(query_params['debug'] == null));
        }
    });

    $("#entity-name").autocomplete({source: '/duns/autocomplete'});
    $("#entity-name").autocomplete({source:
        function (request, callback) {
            try {
                if (request.term.length >= 3) {
                    $.ajax('/duns/autocomplete', {
                           data: request,
                           success: function (data, textStatus, jqXHR) {
                               callback(data);
                           }});
                } else {
                    callback([]);
                }
            } catch (err) {
                callback([]);
            }
        }
    });

    var q = query_params['q'];
    if (q != null) {
        q = q.trim();
        if (q.length > 0) {
            $("#entity-name").val(q);
            start_crawler(!(query_params['debug'] == null));
        }
    }   
});
