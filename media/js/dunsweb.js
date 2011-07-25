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
        
var lookup_duns_numbers = function (entity_name) {
    duns_search_active = true;
    $("#search-form > *:enabled").attr("disabled", "true");
    $("#cancel-search-btn").show();
    $("#no-results").hide();
    $("#duns-results").empty();
    $("#names-results").empty();

    var name_element_id = "names-result-" + Base64.encode(name);
    var name_element = build_names_result_element(name, name_element_id);
    $("#names-results").prepend(name_element);

	$.ajax("/duns/" + entity_name,
			{ data: "q=",
              success: display_duns_numbers });
};

var build_duns_result_element = function (duns) {
    var duns_element = $($("#duns-result-tmpl").html());
    duns_element.attr('id', 'duns-result-' + duns);
    $("span.duns-result", duns_element).text(duns);
    return duns_element;
};    

var display_duns_numbers = function (data, text_status, xhr) {
	if (data.constructor == Array) {
        if (data.length == 0) {
            duns_search_active = false;
            $("#cancel-search-btn").hide();
            $("#search-form > *:disabled").attr("disabled", null);
            $("#no-results").show();
        } else {
            for (var idx = 0; idx < data.length; idx++) {
                var duns = data[idx];
                var duns_element = build_duns_result_element(duns);
                $(duns_element).css("background-color", pastel_color(data.length - idx - 1));
                $("#duns-results").append(duns_element);
                duns_element.show("Slide");
            }
            if (duns_search_active) {
                lookup_names(data);
            }
        }
	}
};

var build_names_result_element = function (name, id) {
    var name_element = $($("#names-result-tmpl").html());
    name_element.attr('id', id);
    $("span.names-result", name_element).text(name);
    return name_element;
};    

var lookup_names = function (duns_numbers) {
	var duns = duns_numbers.shift();
    var display_entity_names= function (data, text_status, xhr) {
        for (var idx = 0; idx < data.length; idx++) {
            var name = data[idx].trim().toUpperCase();
            var name_element_id = "names-result-" + Base64.encode(name);

            var selector = "#" + name_element_id;
            var existing_results = $(selector);
            if (existing_results.length == 0) {
                var name_element = build_names_result_element(name, 
                                                              name_element_id);
                $("#names-results").append(name_element);
                name_element.show();
                delay(500, connect_elements, ["duns-result-" + duns, 
                                              name_element_id,
                                              deep_color(duns_numbers.length)]);
            } else {
                connect_elements("duns-result-" + duns,
                                 name_element_id,
                                 deep_color(duns_numbers.length));
            }
        }
        if (duns_search_active) {
            lookup_names(duns_numbers);
        }
    };

	if (duns == null) {
        duns_search_active = false;
        // Cancel crawling animation
        setTimeout(function(){ 
                draw_connectors(); 
                $("#search-form > *").attr("disabled", null);
                $("#cancel-search-btn").hide();
            }, 
            1000);
    } else {
        $.ajax("/duns/" + duns,
               { data: "q=",
                 success: display_entity_names });
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

$(document).ready(function(){
    var resize_deadline = null;

    jsPlumb.setRenderMode(jsPlumb.Canvas);
    $("#cancel-search-btn").hide();
    $("#cancel-search-btn").click(function(){
        duns_search_active = false;
        $("#cancel-search-btn").hide();
    });
	$("#show-entity-btn").click(function(){
		$("#overlay").show("Appear");
   		lookup_duns_numbers($("#entity-name").val());
    });

    var rate_limited_redraw = ReplaceableCall(200, draw_connectors);
    $(window).resize(function(evt){ 
        $("._jsPlumb_connector").remove();
        rate_limited_redraw();
    });;
});
