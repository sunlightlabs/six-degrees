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

function Centroid3D (smoothness, width, height) {
    Centroid3D.superclass.constructor.call(this, smoothness);
    this.width = width;
    this.height = height;
}
extend(Centroid3D, Smoother3D);
Centroid3D.prototype.recalc = function (particles) {
    var extents = particles.reduce(function(state, curr, idx, arr) {
            return { x_min: Math.min(state.x_min, curr.position.x),
                     y_min: Math.min(state.y_min, curr.position.y),
                     x_max: Math.max(state.x_max, curr.position.x),
                     y_max: Math.max(state.y_max, curr.position.y) };
         },
         { x_min: 999999, y_min: 999999,
           x_max: -999999, y_max: -999999 });

    var dx = extents.x_max - extents.x_min,
        dy = extents.y_max - extents.y_min;
    this.x0.setTarget(extents.x_min + 0.5 * dx);
    this.y0.setTarget(extents.y_min + 0.5 * dy);
    this.z0.setValue(Math.min(1, this.width / (dx * 1.15), this.height / (dy * 1.15)));
};

function ParticleGraphNode (type, value, parent_node, particle) {
    this.type = type;
    this.value = value;
    this.parent_node = parent_node;
    this.children = [];
    this.particle = particle;
    if (parent_node != null) {
        parent_node.children.push(this);
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
        mass: 100,
        edge_strength: 0.007,
        spacer_strength: 1200,
        node_size: 3,
        background: {r: 99, g: 99, b: 99}
    };
    var opts = $.extend(true, {}, defaults);
        opts = $.extend(true, opts, options || {});

    var that = this;
    var physics = new ParticleSystem(0.0, 0.8);
    var centroid = new Centroid3D(1.8, opts.width, opts.height);
    var x_positioning_ratio = opts.width / opts.height;
    var y_positioning_ratio = opts.height / opts.width;
    // nodes and particles are parallel arrays where the particle at a given
    // offset corresponds to the node value at that same offset on the nodes array
    var root_node = null;
    var particles = [];
    var edges = [];
    var selected_node = null;

    var drag_adjust = new Vector(0, 0, 0);
    var zoom_level = null;

    var z_scale = function () {
        if (zoom_level == null) {
            return centroid.z();
        } else {
            return zoom_level;
        }
    };

    this.offset_for_position = function (x, y) {
        var x1 = ((x - centroid.x()) * z_scale()) + drag_adjust.x + (opts.width / 2);
        var y1 = ((y - centroid.y()) * z_scale()) + drag_adjust.y + (opts.height / 2);
        return new Vector(x1, y1, 0);
    };

    this.position_for_offset = function (x, y) {
        var x1 = (x + centroid.x() - drag_adjust.x - (opts.width / 2)) * (1/z_scale());
        var y1 = (y + centroid.y() - drag_adjust.y - (opts.height / 2)) * (1/z_scale());
        return new Vector(x1, y1, 0);
    };

    this.node_at = function (x, y) {
        var position = that.position_for_offset(x, y);
        for (var idx = 0; idx < particles.length; idx++) {
            var distance = position.distanceTo(particles[idx].position);
            if (distance <= opts.node_size * 5) {
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
        var particle = physics.makeParticle(4, centroid.x(), centroid.y(), 0);
        particles.push(particle);
        root_node = new ParticleGraphNode('name', name_value, null, particle);
        return root_node;
    };

    var add_name_node = function (name_value, duns_node) {
        var xrnd = Math.random(),
            yrnd = Math.random(),
            nearx = duns_node.parent_node.particle.position.x,
            neary = duns_node.parent_node.particle.position.y,
            cdx = nearx - centroid.x(),
            cdy = neary - centroid.y();
        cdx = (cdx == 0) ? xrnd * 2 - 1 : cdx;
        cdy = (cdy == 0) ? yrnd * 2 - 1 : cdy;
        xrnd = xrnd * 4 - 2;
        yrnd = yrnd * 4 - 2;
        var xdir = cdy / Math.abs(cdy) * x_positioning_ratio * (xrnd / Math.abs(xrnd)) + xrnd;
            ydir = cdx / Math.abs(cdx) * y_positioning_ratio * (yrnd / Math.abs(yrnd)) + yrnd;

        var scale = Math.sqrt(Math.max(1, particles.length)),
            p = physics.makeParticle(1 + (2/scale),
                                     nearx + xdir,
                                     neary + ydir,
                                     0);

        var node = new ParticleGraphNode('name', name_value, duns_node, p);
        var grandparent_node = node.parent_node.parent_node;
        add_edge(node.particle, grandparent_node.particle);
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

    var add_edge = function (a_prtcl, b_prtcl) {
        physics.makeSpring(a_prtcl, b_prtcl,
                           opts.edge_strength * 1.5, opts.edge_strength * 0.5,
                           opts.node_size * 30);
        for (var idx = 0; idx < particles.length; idx++) {
            physics.makeAttraction(a_prtcl, particles[idx], 
                                   -opts.spacer_strength,
                                   opts.node_size * 2);
        }
        edges.push([a_prtcl, b_prtcl]);
    };

    var reset = function () {
        add_root_node(root);
        centroid.x0.setValue(0.0);
        centroid.y0.setValue(0.0);
        centroid.z0.setValue(1.0);
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

    this.sketch_proc = function (processing) {
        processing.draw = function(){
            if ((processing.frameCount > 60) && (processing.frameRate < 24)) 
                $(that).trigger('lowframerate', [processing.frameRate]);

            physics.tick();
            if (particles.length > 1)
                centroid.recalc(particles);
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
                set_color(idx, deep_hue, function(r,g,b){
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
            }


            // Draw text for number of nodes, edges
            processing.scale(1/z_scale());
            processing.translate(-drag_adjust.x, -drag_adjust.y);
            processing.text('Nodes: ' + particles.length, 
                            (-opts.width / 2) + 5, 
                            (-opts.height / 2) + 25);
            processing.text('Edges: ' + edges.length, 
                            -opts.width / 2 + 5, 
                            -opts.height / 2 + 40);
            processing.text('Z-scale: ' + z_scale(),
                            -opts.width / 2 + 5,
                            -opts.height / 2 + 55);
        };
        processing.setup = function(){
            processing.frameRate(24);
            processing.colorMode(processing.RGB);
            processing.size(opts.width, opts.height);
            $(opts.target).mousewheel(function (evt, delta) {
                if (zoom_level == null) {
                    zoom_level = centroid.z();
                } else {
                    zoom_level += (0.1 * delta);
                }
                if (zoom_level < 0.25) {
                    zoom_level = 0.25;
                } else if (zoom_level > 2.75) {
                    zoom_level = 2.75;
                }

                var mouse_position = that.position_for_offset(processing.mouseX, processing.mouseY);
                var diff = new Vector(root_node.particle.position);
                diff.subtract(mouse_position);

                drag_adjust.add(diff);
                evt.preventDefault();
            });
        };
        processing.mouseClicked = function(){
            $(that).trigger('mouseClicked', [processing.mouseX, processing.mouseY]);
            var node = that.node_at(processing.mouseX, processing.mouseY);
            if (node != null) {
                selected_node = node;
                $(that).trigger('nodeSelected', [node]);
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
            drag_adjust.add(new Vector(processing.mouseX - drag_x,
                                       processing.mouseY - drag_y,
                                       0));
            drag_x = processing.mouseX;
            drag_y = processing.mouseY;
        };
    };

    reset();
}

