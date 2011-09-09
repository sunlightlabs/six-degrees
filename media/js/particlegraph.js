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
    this.extents = { x_min: 0, x_max: width, y_min: 0, y_min: height };
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
        background: {r: 99, g: 99, b: 99},
		zoom_ctl_x: 5,
		zoom_ctl_y: 5,
		zoom_ctl_width: 165,
		zoom_ctl_height: 25
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

    var drag_adjust = new Vector(0, 0);
    var zoom_level = null;

    var z_scale = function () {
        if (zoom_level == null) {
            return centroid.scale();
        } else {
            return zoom_level;
        }
    };

	var handle_zoom_control_click = function (mx, my) {
		if ((mx >= opts.zoom_ctl_x) && (my >= opts.zoom_ctl_y) && (mx <= opts.zoom_ctl_x + opts.zoom_ctl_width) && (my <= opts.zoom_ctl_y + opts.zoom_ctl_height)) {
			var zoom_pct = (mx - opts.zoom_ctl_x) / opts.zoom_ctl_width;
			zoom_level = bounded(opts.zoom_min + (opts.zoom_max - opts.zoom_min) * zoom_pct, 
					             opts.zoom_min, opts.zoom_max);
			return true;
		} else {
			return false;
		}
	};

	var draw_zoom_control = function (processing) {
		processing.resetMatrix();
		processing.fill(0xf0, 0xf0, 0xf0, 0x80);
		processing.stroke(0xd0, 0xd0, 0xd0, 0xff);
		processing.strokeWeight(3);
		processing.triangle(opts.zoom_ctl_x, opts.zoom_ctl_y + opts.zoom_ctl_height,
							opts.zoom_ctl_x + opts.zoom_ctl_width, opts.zoom_ctl_y,
							opts.zoom_ctl_x + opts.zoom_ctl_width, opts.zoom_ctl_y + opts.zoom_ctl_height);
		var zoom_pct = (z_scale() - opts.zoom_min) / (opts.zoom_max - opts.zoom_min),
			zoom_pct_x_offset = Math.round(opts.zoom_ctl_width * zoom_pct);
		processing.line(opts.zoom_ctl_x + zoom_pct_x_offset, opts.zoom_ctl_height - (opts.zoom_ctl_height * zoom_pct),
						opts.zoom_ctl_x + zoom_pct_x_offset, opts.zoom_ctl_y + opts.zoom_ctl_height);
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
        var position = that.position_for_offset(x, y);
        for (var idx = 0; idx < particles.length; idx++) {
            var distance = position.distanceTo(particles[idx].position);
            if (distance <= opts.node_size * 5 * z_scale()) {
                return find_node_by_particle(root_node, particles[idx]);
            }
        }
        return null;
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
        direction.rotate((grandchilden_of_grandparent * 7) * (Math.PI / 180));
		near.add(direction.x, direction.y);

        var scale = Math.sqrt(Math.max(1, particles.length)),
            p = physics.makeParticle(2 + 1/duns_node.depth,
                                     near.x,
                                     near.y);

        var node = new ParticleGraphNode('name', name_value, duns_node, p);
        add_edge(node.particle, grandparent_node.particle, node.depth,
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

    var add_edge = function (a_prtcl, b_prtcl, multiplier, dampening) {
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
        edges.push([a_prtcl, b_prtcl]);
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
            return selection;

            for (var i = 0; i < selected_node.children.length; i++) {
                var child = selected_node.children[i];
                for (var j = 0; j < child.children.length; j++) {
                    // We want the grandchild because we're not showing DUNS nodes.
                    var grandchild = child.children[j];
                    selection.push(grandchild.particle);
                }
            }
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
		running = false;
		$(that).trigger('paused', []);
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
					if (frame_rate_buffer.mean() < opts.frames_per_second / 3) {
						$(that).trigger('lowframerate', [frame_rate_buffer.mean()]);
					}
				}

				physics.tick(2);
				if (particles.length > 1) {
					centroid.recalc(particles);
				}
			}
            processing.translate(opts.width / 2, opts.height / 2);
            processing.translate(drag_adjust.x, drag_adjust.y);
            processing.scale(z_scale());
            processing.translate(-centroid.x(), -centroid.y());

            processing.background(opts.background.r, opts.background.g, opts.background.b);

            var particle_selection = selected_particles();
            var edge_selection = selected_edges(particle_selection);

            // Draw edges
            for (var idx = 0; idx < edges.length; idx++) {
                if (edge_selection.indexOf(edges[idx]) >= 0)
                    continue;
                var a_prtcl = edges[idx][0],
                    b_prtcl = edges[idx][1];
                processing.strokeWeight(1.25/z_scale());
                processing.stroke(0xe0, 0xe0, 0xe0, 0xff);
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
                processing.noStroke();
                processing.fill(0xe0, 0xe0, 0xe0, 0xff);
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

            // Draw selected edges
            for (var idx = 0; idx < edge_selection.length; idx++) {
                var a_prtcl = edge_selection[idx][0],
                    b_prtcl = edge_selection[idx][1],
                    prtcl_idx = particle_selection.indexOf(b_prtcl);
                set_color(prtcl_idx, deep_hue, function(r,g,b){
                              processing.strokeWeight(1.25/z_scale());
                              processing.stroke(r,g,b);
                              processing.fill(r,g,b);
                          });
                processing.line(a_prtcl.position.x, a_prtcl.position.y,
                                b_prtcl.position.x, b_prtcl.position.y);
            }

            // Draw selected nodes
            for (var idx = 0; idx < particle_selection.length; idx++) {
                var prtcl = particle_selection[idx];
                var cx = prtcl.position.x,
                    cy = prtcl.position.y;
                set_color(particle_selection.length - idx, deep_hue, function(r,g,b){
                              processing.strokeWeight(0);
                              processing.stroke(r,g,b);
                              processing.fill(r,g,b);
                          });
                processing.ellipse(cx,
                                   cy,
                                   opts.node_size * 5,
                                   opts.node_size * 5);
                processing.fill(0, 0, 0, 255);
                processing.ellipse(cx,
                                   cy,
                                   opts.node_size,
                                   opts.node_size);

                processing.translate(cx + opts.node_size * 2, cy - opts.node_size * 2);
                processing.scale(1/z_scale() * 1.4);
                processing.noStroke();
                processing.fill(0x20);
                processing.text(find_node_by_particle(root_node, prtcl).value, 0, 0);
                processing.scale(z_scale() / 1.4);
                processing.translate(-cx - opts.node_size * 2, -cy + opts.node_size * 2);
            }

			draw_zoom_control(processing);
			processing.text('Running? ' + ((running == true) ? 'Yes' : 'No'), 5, opts.height - 80);
			processing.text('Frame rate:' + frame_rate_buffer.mean() + ' (Setting: ' + opts.frames_per_second + ')', 5, opts.height - 20);
			processing.text('applyForces: ' + physics.applyForcesTimings.mean(), 5, opts.height - 60);
			var active_attractions = 0,
				inactive_attractions = 0;
			for (var idx = 0; idx < physics.attractions.length; idx++) {
				if (physics.attractions[idx].on == true) {
					active_attractions += 1;
				} else {
					inactive_attractions += 1;
				}
			}
			processing.text('Attractions: ' + active_attractions + ' (active), ' + inactive_attractions + ' (inactive)', 5, opts.height - 40);
        };
        processing.setup = function(){
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
            drag_x = processing.mouseX;
            drag_y = processing.mouseY;
        };
        processing.mouseReleased = function(){
            drag_x = null;
            drag_y = null;
        };
        processing.mouseDragged = function(){
            drag_adjust.add(processing.mouseX - drag_x,
                            processing.mouseY - drag_y);
            drag_x = processing.mouseX;
            drag_y = processing.mouseY;
        };
    };

    reset();
}

