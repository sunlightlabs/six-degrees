var GraphOptions = {
    node_size: 4,
    frames_per_second: 24,
    updates_per_second: 12,
    spacer_strength: 800,
    edge_strength: 0.007,
    background: [0, 0, 0, 0],
    label_size: 12,
    label_color: [0, 0, 0, 255],
    label_background: [0xff, 0xff, 0xff, 0xff],
    label_border_color: [173, 159, 156, 255],
    edge_color: [173, 159, 156, 120],
    node_main_color: [251, 248, 241, 255],
    node_border_color: [173, 158, 156, 200],
    selection_colors: {
        node_main: [[230, 48, 9, 255], [251, 248, 241, 255]],
        node_border: [[230, 48, 9, 255], [205, 123, 23, 255]],
        edge: [[173, 159, 156, 255]]
    }
};

$().ready( function() {
    $( "input, textarea" ).placehold( );
});

function display_node_details (data, textStatus, jqXHR) {
    var snippet = $(data);
    $("#node-details-container *").remove();
    $("#node-details-container").append(snippet);
}

function retrieve_node_details (node) {
    $("#node-details-container *").remove();
    $.ajax('duns/details/' + encodeURIComponent(node.value) + '.html', {
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

function scroll_graph_into_view () {
    var anchoroffset = $("#jump-to-graph").offset();
    if (anchoroffset != null)
        window.scrollTo(0, anchoroffset.top);
}

function start_crawler (debug) {
    $("#low-frame-rate-warning").hide();
    $("#no-connections").hide();

    var seed = $("#company-name").val();
    if (seed == null)
        return;
    seed = seed.trim();
    if (seed == '')
        return;
    seed = seed.toUpperCase();

    var canvas = document.getElementById("graph");
    var crawler = new Crawler({delay: 250, done_after_stop: false});
    var graph_options = $.extend(true, {}, GraphOptions);
    graph_options = $.extend(true, graph_options, {target: canvas,
                                                   width: $(canvas).width(),
                                                   height: $(canvas).height(),
                                                   debug: debug});
    var graph = new ParticleGraph(seed, graph_options);
    var p = new Processing(canvas, graph.sketch_proc);
    $(graph).bind('lowframerate', function (event, frame_rate) {
        setTimeout(graph.pause, 15 * 1000);
        crawler.stop();
        $("#low-frame-rate-warning").fadeIn();
    });
    var cancel_crawler = function (event) {
        if (p != null) {
            crawler.stop();
            p.noLoop();
            p.exit();
            p = null; // Should be the only reference. Let the GC clean up the event bindings.
        };
    };
    $("#resume_btn").hide();
    $("#pause_btn").show();
    $("#loading_gif").show();
    $("#pause_btn").click(function(event){ 
        graph.pause();
        crawler.stop();
        $("#pause_btn").hide();
        $("#loading_gif").hide();
        $("#resume_btn").show();
    });
    $("#resume_btn").click(function(event){
        graph.resume();
        try {
            crawler.resume();
        } catch (e) {
            // no-op
        }
        $("#pause_btn").show();
        $("#loading_gif").show();
        $("#resume_btn").hide();
    });
    $("#search_btn").click(cancel_crawler);
    $("#company-name").keyup(function(event){
        if (event.keyCode == 13) {
            cancel_crawler(event);
        }
    });
    $(graph).bind('nodeSelected', function (event, node) {
        display_route_to_root(node);
    });
    $(crawler).bind('done', function(){
        setTimeout(graph.pause, 15 * 1000);
        $("#pause_btn").hide();
        $("#loading_gif").hide();
        $("#resume_btn").hide();
        if (graph.particle_count() == 1) {
            $("#no-connections").show();
        }
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
    $("#example-graph").hide();
    $("#viz-container:hidden").fadeIn(800);
}

$(document).ready(function(){
    $("#pause_btn").hide();
    $("#loading_gif").hide();
    $("#resume_btn").hide();

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
    
    $("#graph").bind("selectstart", function (event) { event.preventDefault(); });

    $("#cancel-search-btn").hide();
    $("#cancel-search-btn").click(function(){
        $("#cancel-search-btn").hide();
    });
    $("#search_btn").click(function(event){
        event.preventDefault();
        start_crawler(!(query_params['debug'] == null));
        scroll_graph_into_view();
        setTimeout(function(){ $("#company-name").autocomplete('close'); }, 500);
    });
    $("#company-name").keyup(function(event){
        if (event.keyCode == 13) {
            start_crawler(!(query_params['debug'] == null));
            scroll_graph_into_view();
            setTimeout(function(){ $("#company-name").autocomplete('close'); }, 500);
        }
        event.preventDefault();
    });
    $("#company-name").autocomplete({
        minLength: 3,
        source: function (request, callback) {
            try {
                $.ajax('duns/autocomplete', {
                    data: request,
                    success: function (data, textStatus, jqXHR) {
                        callback(data);
                    }});
            } catch (err) {
                callback([]);
            }
        }
    });


    if(typeof String.prototype.trim !== 'function') {
        String.prototype.trim = function() {
            return this.replace(/^\s+|\s+$/g, ''); 
        }
    }

    var q = query_params['search'];
    if (q != null) {
        q = q.trim();
        
        if (q.length > 0) {
            $("#company-name").val(q);
            start_crawler(!(query_params['debug'] == null));
        }
    }
});
