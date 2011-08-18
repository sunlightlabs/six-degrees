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
    var centroid = new Centroid3D(20.8, opts.width, opts.height);
    var x_positioning_ratio = opts.width / opts.height;
    var y_positioning_ratio = opts.height / opts.width;
    // nodes and particles are parallel arrays where the particle at a given
    // offset corresponds to the node value at that same offset on the nodes array
    var root_node = null;
    var particles = [];
    var edges = [];

    this.node_at = function (x, y) {
        var x1 = (x + centroid.x() - (opts.width / 2)) * (1/centroid.z());
        var y1 = (y + centroid.y() - (opts.height / 2)) * (1/centroid.z());
        for (var idx = 0; idx < particles.length; idx++) {
            var x2 = particles[idx].position.x;
            var y2 = particles[idx].position.y;
            var distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
            if (distance <= opts.node_size * 5) {
                return find_node_by_particle(root_node, particles[idx]);
            }
        }
        return null;
    };

    this.add_link = function (a, b) {
        var a_node = find_node_by_value(root_node, a.value);
        var b_node = find_node_by_value(root_node, b.value);
        var new_node = null;
        if ((a_node == null) && (b_node == null)) {
            throw "The universe is falling apart: " + a + ", " + b;
        } else if (a_node == null) {
            a_node = add_node(a.type, a.value, b_node);
            console.log("A is new");
        } else if (b_node == null) {
            b_node = add_node(b.type, b.value, a_node);
        }
    };

    var add_root_node = function (name_value) {
        root_node = {
            type: 'name',
            value: name_value,
            children: [],
            parent_node: null,
            particle: physics.makeParticle(4, centroid.x(), centroid.y(), 0)
        };
        particles.push(root_node.particle);
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
        var node = { 
            type: 'name',
            value: name_value, 
            children: [], 
            parent_node: duns_node,
            particle: p 
        };
        duns_node.children.push(node);

        var grandparent_node = node.parent_node.parent_node;
        add_edge(node.particle, grandparent_node.particle);

        particles.push(p);
        return node;
    };

    var add_duns_node = function (duns_value, name_node) {
        var node = {
            type: 'duns',
            value: duns_value,
            children: [],
            parent_node: name_node
        };
        name_node.children.push(node);
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

    this.sketch_proc = function (processing) {
        processing.draw = function(){
            if ((processing.frameCount > 60) && (processing.frameRate < 24)) 
                $(that).trigger('lowframerate', [processing.frameRate]);

            physics.tick();
            if (particles.length > 1)
                centroid.recalc(particles);
            processing.translate(opts.width / 2, opts.height / 2);
            processing.scale(centroid.z());
            processing.translate(-centroid.x(), -centroid.y());

            processing.background(opts.background.r, opts.background.g, opts.background.b);

            // Draw edges
            for (var idx = 0; idx < edges.length; idx++) {
                var a_prtcl = edges[idx][0],
                    b_prtcl = edges[idx][1];
                set_color(idx, deep_hue, processing.stroke);
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

            // Draw text for number of nodes, edges
            processing.scale(1/centroid.z());
            processing.text('Nodes: ' + particles.length, 
                            (-opts.width / 2) + 5, 
                            (-opts.height / 2) + 25);
            processing.text('Edges: ' + edges.length, 
                            -opts.width / 2 + 5, 
                            -opts.height / 2 + 40);
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

