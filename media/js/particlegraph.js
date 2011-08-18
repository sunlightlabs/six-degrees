function generate_edges (root, depth, callback) {
    for (var a = 0; a < root.children.length; a++) {
        var child = root.children[a];
        for (var b = 0; b < child.children.length; b++) {
            var grandchild = child.children[b];
            callback.call(null, root, child, grandchild, depth);
            generate_edges(grandchild, depth + 1, callback);
        }
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
    var nodes = [];
    var particles = [];
    // edges is an array of 2-element arrays that hold the offset into the
    // nodes & particle arrays for each end of the link.
    var edges = [];

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
        var scale = Math.sqrt(Math.max(1, particles.length));
        physics.makeSpring(a_prtcl, b_prtcl, 
                           opts.edge_strength * 1.5, opts.edge_strength * 0.5,
                           opts.node_size * 30);
        edges.push([a_offset, b_offset]);
    };

    var append_node = function (value, options) {
        var near = options.near || particles[0].position;
        var scale = Math.sqrt(Math.max(1, particles.length));
        var p = physics.makeParticle(1 + (2/scale));
        var xrnd = Math.random(),
            yrnd = Math.random(),
            cdx = near.x - centroid.x(),
            cdy = near.y - centroid.y();
        cdx = (cdx == 0) ? xrnd * 2 - 1 : cdx;
        cdy = (cdy == 0) ? yrnd * 2 - 1 : cdy;
        xrnd = xrnd * 4 - 2;
        yrnd = yrnd * 4 - 2;
        var xdir = cdy / Math.abs(cdy) * x_positioning_ratio * (xrnd / Math.abs(xrnd)) + xrnd;
            ydir = cdx / Math.abs(cdx) * y_positioning_ratio * (yrnd / Math.abs(yrnd)) + yrnd;
        p.position.x = near.x + xdir;
        p.position.y = near.y + ydir; 
        for (var idx = 0; idx < particles.length; idx++) {
            var q = particles[idx];
            physics.makeAttraction(p, q, -opts.spacer_strength, opts.node_size * 2);
        }
        nodes.push(value);
        particles.push(p);
        return nodes.length - 1;
    };

    var reset = function () {
        append_node(root, {near: {x: 0, y: 0}});
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

