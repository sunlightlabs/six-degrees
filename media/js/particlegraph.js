function byte2hex (n) {
    var nybHexString = "0123456789ABCDEF";
    return String(nybHexString.substr((n >> 4) & 0x0F,1)) + nybHexString.substr(n & 0x0F,1);
}
function rgb2hex (r,g,b) {
    return '#' + byte2hex(r) + byte2hex(g) + byte2hex(b);
}
function pastel_hue (n, phase) {
    return Math.sin(0.8979777 * n + phase) * 45 + 205; 
};
function deep_hue (n, phase) {
    return Math.sin(0.8979777 * n + phase) * 95 + 155;
};
function black_hue (n, phase) {
    return 0;
};
function deep_color (n) {
    return [deep_hue(n, 0 + n), 
            deep_hue(n, 2 + n),
            deep_hue(n, 4 + n)]
};

function color (n, hue_func) {
    return rgb2hex(hue_func(n, 0 + n), 
                   hue_func(n, 2 + n), 
                   hue_func(n, 4 + n)); 
};

function generate_colors (n, hue_func, alpha) {
    var colors = [];
    for (var idx = 0; idx < n; idx++) {
        colors.push([hue_func(idx, 0 + idx),
                     hue_func(idx, 2 + idx),
                     hue_func(idx, 4 + idx),
                     alpha]);
    }
    return colors;
};

function sorensen_index (a, b) {
    function bigrams (s) {
        var results = [];
        for (var i = 0; i < s.length - 1; i++) {
          results.push(s[i] + s[i+1]);
        }
        return results;
    }
    var A = bigrams(a),
        B = bigrams(b),
        C = A.filter(function(_){ return B.indexOf(_) >= 0; });
    var index = (2 * C.length) / (A.length + B.length);
    return index;
}

function find_node_by_value (root, value) {
    return find_node(root, function (n) { return (n.value == value); });
}

function find_node_by_particle (root, particle) {
    return find_node(root, function (n) { return (n.particle == particle); });
}

function find_node (root, pred) {
    if (pred(root)) {
        return root;
    } else {
        for (var idx = 0; idx < root.children.length; idx++) {
            var node = find_node(root.children[idx], pred);
            if (node != null) {
                return node;
            }
        }
        return null;
    }
}

function bounded (x, min, max) {
	if (x < min) {
		return min;
	} else if (x > max) {
		return max;
	} else {
		return x;
	}
}

function Centroid2D (smoothness, width, height) {
    Centroid2D.superclass.constructor.call(this, smoothness);
    this.width = width;
    this.height = height;
    this.extents = { x_min: 0, x_max: width, y_min: 0, y_max: height };
}
extend(Centroid2D, Smoother2D);
Centroid2D.prototype.recalc = function (particles) {
    this.extents = particles.reduce(function(state, curr, idx, arr) {
            return { x_min: Math.min(state.x_min, curr.position.x),
                     y_min: Math.min(state.y_min, curr.position.y),
                     x_max: Math.max(state.x_max, curr.position.x),
                     y_max: Math.max(state.y_max, curr.position.y) };
         },
         { x_min: 999999, y_min: 999999,
           x_max: -999999, y_max: -999999 });

    var dx = this.extents.x_max - this.extents.x_min,
        dy = this.extents.y_max - this.extents.y_min;
    this.x0.setTarget(this.extents.x_min + 0.5 * dx);
    this.y0.setTarget(this.extents.y_min + 0.5 * dy);
};

Centroid2D.prototype.scale = function () {
    var dx = this.extents.x_max - this.extents.x_min,
        dy = this.extents.y_max - this.extents.y_min;
    return Math.min(1, this.width / (dx * 1.15), this.height / (dy * 1.15));
};

function ParticleGraphNode (type, value, parent_node, particle) {
    this.type = type;
    this.value = value;
    this.parent_node = parent_node;
    this.children = [];
    this.particle = particle;
	this.child_direction = Math.random() * 360;
    if (parent_node != null) {
        this.depth = parent_node.depth + 1;
        parent_node.children.push(this);
    } else {
        this.depth = 1;
    }
};

ParticleGraphNode.prototype.path_to_root = function () {
    var path = [];
    var node = this;
    while (node != null) {
        path.push(node);
        node = node.parent_node;
    }
    return path;
};

function ParticleGraph (root, options) {
    if (this === window)
        return new ParticleGraph(options);

    var defaults = {
        width: 1000,
        height: 700,
		frames_per_second: 24,
		updates_per_second: 4,
		zoom_min: 0.10,
		zoom_max: 1.5,
        mass: 100,
        edge_strength: 0.007,
        spacer_strength: 1200,
        node_size: 5,
        label_size: 10,
        label_color: [0, 0, 0, 0xff],
        label_background: [0xf0, 0xf0, 0xf0, 0xff],
        label_border_color: [0, 0, 0, 0x70],
        edge_color: [0xe0, 0xe0, 0xe0, 0xff],
        node_border_color: [0x20, 0x20, 0x20, 0xff],
        selection_colors: {
                node_main: null,
                node_border: null,
                edge: null
            },
        background: [99, 99, 99, 255],
        debug: false
    };
    var opts = $.extend(true, {}, defaults);
        opts = $.extend(true, opts, options || {});

    var that = this;
	var running = true;
	var frame_rate_buffer = new MeanBuffer(opts.frames_per_second * 5);
    var physics = new ParticleSystem(0.6);
	    physics.tick = new RateLimitedCall(Math.round(1000 / (opts.updates_per_second - 1)), 
				                           physics.tick, physics);
    var centroid = new Centroid2D(1.8, opts.width, opts.height);
    var x_positioning_ratio = opts.width / opts.height;
    var y_positioning_ratio = opts.height / opts.width;
    var root_node = null;
    var particles = [];
    var edges = [];
    var selected_node = null;
    var background_image = null;

    var drag_adjust = new Vector(0, 0);
    var zoom_level = null;

    var zoom_width = (opts.width / 2) - (opts.label_size * 2),
        zoom_left = opts.width / 2,
        zoom_right = zoom_left + zoom_width,
        zoom_height = opts.label_size * 1.66,
        zoom_top = opts.height - zoom_height,
        zoom_bottom = opts.height,
        zoom_mid = zoom_bottom - (zoom_height / 2),
        baseline = zoom_top + zoom_height * 0.65;

    var z_scale = function () {
        if (zoom_level == null) {
            return centroid.scale();
        } else {
            return zoom_level;
        }
    };

    var in_zoom_control = function (mx, my) {
		return ((mx >= zoom_left) && (my >= zoom_top) && (mx <= zoom_right) && (my <= zoom_bottom));
    };

	var handle_zoom_control_click = function (mx, my) {
        if (in_zoom_control(mx, my)) {
			var zoom_pct = (mx - zoom_left) / zoom_width;
			zoom_level = bounded(opts.zoom_min + (opts.zoom_max - opts.zoom_min) * zoom_pct, 
					             opts.zoom_min, opts.zoom_max);
			return true;
		} else {
			return false;
		}
	};

	var draw_zoom_control = function (processing) {
		processing.resetMatrix();
        processing.fill(137, 130, 126, 255);
        processing.rect(0, opts.height - opts.label_size * 2, opts.width, opts.label_size * 2);

        processing.fill(250, 250, 250, 255);
        processing.stroke(250, 250, 250, 255);
        processing.text('Use your scroll wheel to zoom, drag & drop to pan around', opts.label_size, baseline);
        processing.strokeWeight(1);
        processing.fill(250, 250, 250, 255);
        processing.rect(zoom_left, zoom_mid - 4, zoom_width, 4);
        processing.rectMode(processing.RADIUS);

        processing.fill(250, 250, 250, 255);
        processing.noStroke();
        processing.rect(zoom_left - opts.label_size, zoom_mid - 2, opts.label_size * 0.5, opts.label_size * 0.1);
        processing.rect(zoom_right + opts.label_size, zoom_mid - 2, opts.label_size * 0.5, opts.label_size * 0.1);
        processing.rect(zoom_right + opts.label_size, zoom_mid - 2, opts.label_size * 0.1, opts.label_size * 0.5);

		var zoom_pct = (z_scale() - opts.zoom_min) / (opts.zoom_max - opts.zoom_min),
			zoom_x_offset = Math.round(zoom_width * zoom_pct);
        processing.noStroke();
        processing.fill(250, 250, 250, 255);
        processing.rect(zoom_left + zoom_x_offset, zoom_mid - 2, opts.label_size / 2, zoom_height * 0.4);
        processing.rectMode(processing.CORNER);
	}

    this.offset_for_position = function (x, y) {
        var x1 = ((x - centroid.x()) * z_scale()) + drag_adjust.x + (opts.width / 2);
        var y1 = ((y - centroid.y()) * z_scale()) + drag_adjust.y + (opts.height / 2);
        return new Vector(x1, y1);
    };

    this.position_for_offset = function (x, y) {
        var x1 = (x + centroid.x() - drag_adjust.x - (opts.width / 2)) * (1/z_scale());
        var y1 = (y + centroid.y() - drag_adjust.y - (opts.height / 2)) * (1/z_scale());
        return new Vector(x1, y1);
    };

    this.node_at = function (x, y) {
        var position = that.position_for_offset(x, y),
            closest = null,
            closest_distance = opts.node_size * 6;
        for (var idx = 0; idx < particles.length; idx++) {
            var distance = position.distanceTo(particles[idx].position);
            if (distance <= opts.node_size * 5) {
                if (distance < closest_distance) {
                    closest = particles[idx];
                    closest_distance = distance;
                }
            }
        }
        if (closest == null) {
            return null;
        } else {
            return find_node_by_particle(root_node, closest);
        }
    };

    this.add_link = function (a, b) {
        var a_node = find_node_by_value(root_node, a.value);
        var b_node = find_node_by_value(root_node, b.value);
        if ((a_node == null) && (b_node == null)) {
            throw "The universe is falling apart: both nodes returned by the query are 'new'."
        } else if (a_node == null) {
            throw "The universe is falling apart: the 'A' node is 'new'.";
        } else if (b_node == null) {
            b_node = add_node(b.type, b.value, a_node);
        }
    };
	this.add_link = QueuedRateLimitedCall(41, this.add_link);

    var add_root_node = function (name_value) {
        var particle = physics.makeParticle(4, centroid.x(), centroid.y());
        particles.push(particle);
        root_node = new ParticleGraphNode('name', name_value, null, particle);
        selected_node = root_node;
        return root_node;
    };

    var add_name_node = function (name_value, duns_node) {
		var grandparent_node = duns_node.parent_node;
        var grandchilden_of_grandparent = grandparent_node.children.reduce(
                                            function(acc, chld){return acc + chld.children.length;},
                                            0);
                
		var near = new Vector(grandparent_node.particle.position.x,
							  grandparent_node.particle.position.y);
        var inverter = (grandchilden_of_grandparent % 2 == 0) ? 1 : -1;
        var direction = new Vector(grandparent_node.particle.position.x - root_node.particle.position.x,
                                   grandparent_node.particle.position.y - root_node.particle.position.y);
        var direction = new Vector(grandparent_node.particle.velocity.x,
                                   grandparent_node.particle.velocity.y);
        if (direction.isZero()) {
            direction = new Vector(Math.random(), Math.random());
        } else {
            direction.unit();
        }
        direction.rotate((grandchilden_of_grandparent * 173 - 173) * (Math.PI / 180));
		direction.scale(opts.node_size);
		near.add(direction.x, direction.y);

        var scale = Math.sqrt(Math.max(1, particles.length)),
            p = physics.makeParticle(2 + 1/duns_node.depth,
                                     near.x,
                                     near.y);

        var node = new ParticleGraphNode('name', name_value, duns_node, p);
        add_edge(node.particle, grandparent_node.particle, node.parent_node.value, node.depth,
				 sorensen_index(node.value, grandparent_node.value));
        particles.push(p);
        return node;
    };

    var add_duns_node = function (duns_value, name_node) {
        var node = new ParticleGraphNode('duns', duns_value, name_node, null);
        return node;
    };

    var add_node = function (type, value, parent_node) {
        if (type == 'name') {
            return add_name_node(value, parent_node);
        } else {
            return add_duns_node(value, parent_node);
        }
    }

    var add_edge = function (a_prtcl, b_prtcl, label, multiplier, dampening) {
		dampening = Math.min(0.9, dampening);
        physics.makeSpring(a_prtcl, b_prtcl,
                           opts.edge_strength * multiplier, opts.edge_strength * multiplier,
                           opts.node_size * 30 * (1 - dampening));
        root_node.particle.mass = Math.max(4 / Math.sqrt(particles.length), 1);
        for (var idx = 0; idx < particles.length; idx++) {
            physics.makeAttraction(a_prtcl, particles[idx], 
                                   -opts.spacer_strength * Math.min(multiplier, 3) * (1 - dampening),
                                   opts.node_size * 4);
        }
        edges.push([a_prtcl, b_prtcl, label]);
    };

    var reset = function () {
        add_root_node(root);
        centroid.x0.setValue(0.0);
        centroid.y0.setValue(0.0);
    };

    var selected_particles = function () {
        var selection = [];
        if (selected_node != null) {
            selection = selected_node.path_to_root()
                                     .filter(function(n){return n.type=='name';})
                                     .map(function(n){return n.particle;});
        }
        return selection;
    };

    var selected_edges = function (particle_selection) {
        var edge_selection = [];
        for (var idx = 0; idx < edges.length; idx++) {
            if (particle_selection.indexOf(edges[idx][0]) >= 0) {
                edge_selection.push(edges[idx]);
            }
        }
        return edge_selection;
    };

	this.pause = function () {
		var _pause = function () {
			running = false;
			$(that).trigger('paused', []);
		};
		if (that.add_link.queue.is_empty()) {
			setTimeout(_pause, 15 * 1000);
		} else {
			$(that.add_link.queue).bind('emptied', function(evt){
				setTimeout(_pause, 15 * 1000);
			});
		}
	};

	this.resume = function () {
		running = true;
		$(that).trigger('resumed', []);
	};

    this.sketch_proc = function (processing) {
        processing.draw = function(){
			frame_rate_buffer.put(processing.__frameRate);
			if (running == true) {
				if (processing.frameCount > opts.frames_per_second * 5) {
					if (frame_rate_buffer.mean() < 6) {
						$(that).trigger('lowframerate', [frame_rate_buffer.mean()]);
					}
				}

				physics.tick(1);
				if (particles.length > 1) {
					centroid.recalc(particles);
				}
			}
            processing.translate(opts.width / 2, opts.height / 2);
            processing.translate(drag_adjust.x, drag_adjust.y);
            processing.scale(z_scale());
            processing.translate(-centroid.x(), -centroid.y());

            if (background_image == null) {
                processing.background.apply(processing, opts.background);
            } else {
                processing.image(background_image, -opts.width / 2, -opts.height / 2);
            }

            var particle_selection = selected_particles();
            var edge_selection = selected_edges(particle_selection);

            // Draw edges
            for (var idx = 0; idx < edges.length; idx++) {
                if (edge_selection.indexOf(edges[idx]) >= 0)
                    continue;
                var a_prtcl = edges[idx][0],
                    b_prtcl = edges[idx][1];
                processing.strokeWeight(opts.node_size/2/z_scale());
                processing.stroke.apply(processing, opts.edge_color);
                processing.line(a_prtcl.position.x, a_prtcl.position.y,
                                b_prtcl.position.x, b_prtcl.position.y);
            }

            // Draw nodes
            for (var idx = 0; idx < particles.length; idx++) {
                if (particle_selection.indexOf(particles[idx]) >= 0) 
                    continue;
                var prtcl = particles[idx];
                var cx = prtcl.position.x,
                    cy = prtcl.position.y;
                processing.strokeWeight(opts.node_size);
                processing.stroke.apply(processing, opts.node_border_color);
                processing.fill.apply(processing, opts.node_main_color);
                processing.ellipse(cx,
                                   cy,
                                   opts.node_size * 5,
                                   opts.node_size * 5);
            }

            // Draw selected edges
            for (var idx = 0; idx < edge_selection.length; idx++) {
                var a_prtcl = edge_selection[idx][0],
                    b_prtcl = edge_selection[idx][1],
                    prtcl_idx = particle_selection.indexOf(a_prtcl),
                    color_idx = bounded(prtcl_idx, 0, opts.selection_colors.edge.length - 1),
                    color = opts.selection_colors.edge[color_idx];
                var dx = b_prtcl.position.x - a_prtcl.position.x,
                    dy = b_prtcl.position.y - a_prtcl.position.y,
                    mx = a_prtcl.position.x + (dx / 2),
                    my = a_prtcl.position.y + (dy / 2);

                processing.strokeWeight(opts.node_size/2/z_scale());
                processing.stroke.apply(processing, color);
                processing.fill.apply(processing, color);
                processing.line(a_prtcl.position.x, a_prtcl.position.y,
                                b_prtcl.position.x, b_prtcl.position.y);


                label_text = edge_selection[idx][2];
                label_text_width = parseInt(processing.textWidth(label_text));

                processing.pushMatrix();
                processing.translate(mx - (label_text_width / 3), my);
                processing.scale(1/z_scale());

                processing.strokeWeight(1);
                processing.stroke.apply(processing, opts.label_border_color);
                processing.fill.apply(processing, opts.label_background);
                processing.rect(-(opts.label_size / 2),
                                -(opts.label_size * 1.1),
                                label_text_width + opts.label_size,
                                opts.label_size * 1.6);

                processing.noStroke();
                processing.fill.apply(processing, opts.label_color);
                processing.text(label_text, 0, 0);
                processing.popMatrix();
            }

            // Draw selected nodes
            for (var idx = 0; idx < particle_selection.length; idx++) {
                var prtcl = particle_selection[idx],
                    color_idx = particle_selection.length - idx - 1,
                    main_color_idx = color_idx % opts.selection_colors.node_main.length,
                    main_color = opts.selection_colors.node_main[main_color_idx],
                    border_color_idx = bounded(color_idx, 0, opts.selection_colors.node_border.length - 1),
                    border_color = opts.selection_colors.node_border[border_color_idx];

                var cx = prtcl.position.x,
                    cy = prtcl.position.y;
                processing.strokeWeight(opts.node_size);
                processing.stroke.apply(processing, border_color);
                processing.fill.apply(processing, main_color);
                processing.ellipse(cx,
                                   cy,
                                   opts.node_size * 5,
                                   opts.node_size * 5);

                // Draw selection labels
                processing.pushMatrix();
                processing.translate(cx + (opts.node_size * 5), cy + opts.node_size);
                processing.scale(1/z_scale());
                processing.textSize(opts.label_size);

                label_text = find_node_by_particle(root_node, prtcl).value;
                label_text_width = parseInt(processing.textWidth(label_text));
                
                processing.strokeWeight(1);
                processing.stroke.apply(processing, opts.label_border_color);
                processing.fill.apply(processing, opts.label_background);
                processing.rect(-(opts.label_size / 2), 
                                -(opts.label_size * 1.2), 
                                label_text_width + opts.label_size, 
                                opts.label_size * 1.6);

                processing.noStroke();
                processing.fill.apply(processing, opts.label_color);
                processing.text(label_text, 0, 0);
                processing.popMatrix();
            }

			draw_zoom_control(processing);
            if (opts.debug == true) {
                processing.fill.apply(processing, opts.label_color);
                processing.text('Frame rate:' + frame_rate_buffer.mean() + ' (Setting: ' + opts.frames_per_second + ')', 5, opts.height - 20);
                processing.text('add_link queue: ' + that.add_link.queue.backlog_size(), 5, opts.height - 40);
                processing.text('Particles: ' + particles.length, 5, opts.height - 60);
            }
        };
        processing.setup = function(){
            if (opts.background_image != null) 
                background_image = processing.loadImage(opts.background_image);
            processing.frameRate(opts.frames_per_second);
            processing.colorMode(processing.RGB);
            processing.size(opts.width, opts.height);
			$(that).bind('paused', function(){
					processing.frameRate(opts.frames_per_second / 3);
			});
			$(that).bind('resumed', function(){
					processing.frameRate(opts.frames_per_second);
			});
            $(opts.target).mousewheel(function (evt, delta) {
                var mouse_position1 = that.position_for_offset(processing.mouseX, processing.mouseY);

                if (zoom_level == null) {
                    zoom_level = centroid.scale();
                } else {
                    zoom_level += bounded(zoom_level * 0.1, 0.025, 0.08) * delta;
					zoom_level = bounded(zoom_level,
						                  opts.zoom_min,
										  opts.zoom_max);
                }

				var offset_after_zoom = that.offset_for_position(mouse_position1.x, 
					                                             mouse_position1.y);
				var diff = new Vector((offset_after_zoom.x - processing.mouseX),
					                  (offset_after_zoom.y - processing.mouseY));
				drag_adjust.subtract(diff);
                evt.preventDefault();
            });
        };
        processing.mouseClicked = function(){
			if (handle_zoom_control_click(processing.mouseX, processing.mouseY)) {
				event.preventDefault();
			} else {
				$(that).trigger('mouseClicked', [processing.mouseX, processing.mouseY]);
				var node = that.node_at(processing.mouseX, processing.mouseY);
				if (node != null) {
					selected_node = node;
					$(that).trigger('nodeSelected', [node]);
				}
			}
        };

        var drag_x = null,
            drag_y = null;
        processing.mousePressed = function(){
            if (! in_zoom_control(processing.mouseX, processing.mouseY)) {
                drag_x = processing.mouseX;
                drag_y = processing.mouseY;
            }
        };
        processing.mouseReleased = function(){
            drag_x = null;
            drag_y = null;
        };
        processing.mouseDragged = function(){
            if ((drag_x != null) && (drag_y != null)) {
                drag_adjust.add(processing.mouseX - drag_x,
                                processing.mouseY - drag_y);
                drag_x = processing.mouseX;
                drag_y = processing.mouseY;
            }
        };
    };

    if (opts.selection_colors.edge == null) 
        opts.selection_colors.edge = generate_colors(30, deep_hue, 0xff);
    if (opts.selection_colors.node_main == null) 
        opts.selection_colors.node_main = generate_colors(30, deep_hue, 0xff);
    if (opts.selection_colors.node_border == null) 
        opts.selection_colors.node_border = generate_colors(30, black_hue, 0xff);
    reset();
}

