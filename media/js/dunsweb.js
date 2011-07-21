var duns_search_active = null;

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
var hue = function (n,phase) { return Math.sin(32*n+phase) * 127 + 128; }
var color = function (n) { return rgb2hex(hue(n, 0), hue(n, 2), hue(n, 4)); }
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

var connect_elements = function (source_id, target_id) {
    try {
        jsPlumb.connect({ source: source_id,
                          target: target_id,
                          anchors: [ "RightMiddle", "LeftMiddle" ],
                          endpoint: "Blank",
                          paintStyle: { lineWidth: 2, 
                                        strokeStyle: connector_colors.next() } 
                        });
    } catch (err) {
        console.log(err);
    }
};
        
var lookup_duns_numbers = function (entity_name) {
    duns_search_active = true;
    $("#cancel-search-btn").show();
    $("#duns-results").empty();
    $("#names-results").empty();
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
		for (var idx = 0; idx < data.length; idx++) {
			var duns = data[idx];
            var duns_element = build_duns_result_element(duns);
            $("#duns-results").prepend(duns_element);
            duns_element.show("Slide");
		}
        if (duns_search_active) {
            lookup_names(data);
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
                $("#names-results").prepend(name_element);
                name_element.show();
                delay(500, connect_elements, ["duns-result-" + duns, 
                                              name_element_id]);
            } else {
                connect_elements("duns-result-" + duns,
                                 name_element_id);
            }
        }
        if (duns_search_active) {
            setTimeout(function(){ lookup_names(duns_numbers); }, 1000);
        }
    };

	if (duns == null) {
        duns_search_active = false;
        $("#cancel-search-btn").hide();
        // Cancel crawling animation
    } else {
        $.ajax("/duns/" + duns,
               { data: "q=",
                 success: display_entity_names });
	}
};


$(document).ready(function(){
    jsPlumb.setRenderMode(jsPlumb.VML);
    $("#cancel-search-btn").hide();
    $("#cancel-search-btn").click(function(){
        duns_search_active = false;
        $("#cancel-search-btn").hide();
    });
	$("#show-entity-btn").click(function(){
		$("#overlay").show("Appear");
   		lookup_duns_numbers($("#entity-name").val());
    });
});
