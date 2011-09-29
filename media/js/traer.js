/**
 * traer.js
 * A particle-based physics engine ported from Jeff Traer's Processing library to JavaScript. This version is intended for use with the HTML5 canvas element.
 *
 * @author Jeffrey Traer Bernstein <jeff TA traer TOD cc> (original Java library)
 * @author Adam Saponara <saponara TA gmail TOD com> (JavaScript port)
 * @version 0.2
 * @date August 8, 2010
 *
 */


/**
 * A 3-dimensional vector representation with common vector operations
 */
function Vector() {
	var argc = arguments.length;
	if (argc === 2) {
		this.x = arguments[0];
		this.y = arguments[1];
	}
	else if (argc === 1) {
		this.x = arguments[0].x;
		this.y = arguments[0].y;
	}
	else {
		this.x = 0;
		this.y = 0;
	}
}
Vector.prototype.set = function() {
	var argc = arguments.length;
	if (argc === 2) {
		this.x = arguments[0];
		this.y = arguments[1];
	}
	else if (argc === 1) {
		this.x = arguments[0].x;
		this.y = arguments[0].y;
	}
};
Vector.prototype.add = function(x, y) {
	this.x += x;
	this.y += y;
};
Vector.prototype.subtract = function(v) {
	var argc = arguments.length;
	if (argc === 2) {
		this.x -= arguments[0];
		this.y -= arguments[1];
	}
	else if (argc === 1) {
		this.x -= arguments[0].x;
		this.y -= arguments[0].y;
	}
};
Vector.prototype.unit = function () {
	var length = Math.max(Math.sqrt(this.x*this.x + this.y*this.y), 1);
	if (length > 0) {
		this.x /= length;
		this.y /= length;
	}
};
Vector.prototype.scale = function(f) { this.x *= f; this.y *= f; };
Vector.prototype.distanceTo = function() { 
	var argc = arguments.length;
	if (argc === 3) {
		var dx = this.x - arguments[0];
		var dy = this.y - arguments[1];
		return Math.sqrt(dx*dx + dy*dy);
	}
	else if (argc === 1) {
		return Math.sqrt(this.distanceSquaredTo(arguments[0]));
	}
};
Vector.prototype.distanceSquaredTo = function(v) {
	var dx = this.x - v.x;
	var dy = this.y - v.y;
	return dx*dx + dy*dy;
};
Vector.prototype.dot = function(v) { return this.x*v.x + this.y*v.y; };
Vector.prototype.length = function() { return Math.sqrt(this.x*this.x + this.y*this.y); };
Vector.prototype.lengthSquared = function() { return this.x*this.x + this.y*this.y; };
Vector.prototype.clear = function() { this.x = 0; this.y = 0; };
Vector.prototype.toString = function() { return '('+this.x+','+this.y+')'; };
Vector.prototype.isZero = function() {
	return this.x === 0 && this.y === 0;
};
Vector.prototype.rotate = function (angle) {
	this.x = this.x * Math.cos(angle) - this.y * Math.sin(angle);
	this.y = this.x * Math.sin(angle) + this.y * Math.cos(angle);
};

/**
 * A particle with position, velocity, and force vectors and mass
 */
function Particle(mass) {
	this.position = new Vector();
	this.velocity = new Vector();
	this.force = new Vector();
	this.mass = mass;
	this.age = 0;
	this.dead = false;
}
Particle.prototype.distanceTo = function(p) { return this.position.distanceTo(p.position); };
Particle.prototype.reset = function() {
	this.age = 0;
	this.dead = false;
	this.position.clear();
	this.velocity.clear();
	this.force.clear();
	this.mass = 1.0;
};


/**
 * A force between two particles based on a spring constant
 */
function Spring(a, b, k, d, l) {
	this.constant = k;
	this.damping = d;
	this.length = l;
	this.a = a;
	this.b = b;
}
Spring.prototype.currentLength = function() { return this.a.position.distanceTo(this.b.position); };
Spring.prototype.apply = function() {

	var a = this.a;
	var b = this.b;

	var a2bx = a.position.x - b.position.x;
	var a2by = a.position.y - b.position.y;

	var a2bd = Math.sqrt(a2bx*a2bx + a2by*a2by);
	if (a2bd === 0) {
		a2bx = 0;
		a2by = 0;
	}
	else {
		a2bx /= a2bd;
		a2by /= a2bd;
	}

	var fspring = -1 * (a2bd - this.length) * this.constant;

	var va2bx = a.velocity.x - b.velocity.x;
	var va2by = a.velocity.y - b.velocity.y;

	var fdamping = -1 * this.damping * (a2bx*va2bx + a2by*va2by);

	var fr = fspring + fdamping;

	a2bx *= fr;
	a2by *= fr;

	a.force.add(a2bx, a2by);
	b.force.add(-1 * a2bx, -1 * a2by);
};


/**
 * A gravitational force between two particles
 */
function Attraction(a, b, k, d) {
	this.a = a;
	this.b = b;
	this.constant = k;
	this.distanceMin = d;
	this.distanceMinSquared = d * d;
}
Attraction.prototype.apply = function() {

	// Skip if force is off or if both particles are fixed
	var a = this.a, b = this.b;

	var a2bx = a.position.x - b.position.x;
	var a2by = a.position.y - b.position.y;

	var a2bdistanceSquared = Math.max(a2bx * a2bx + a2by * a2by, this.distanceMinSquared);

	var force = (this.constant * a.mass * b.mass) / a2bdistanceSquared;

	var length = Math.sqrt(a2bdistanceSquared);

	if (force === 0 || length === 0) {
		a2bx = 0;
		a2by = 0;
	}
	else {
		// make unit vector
		a2bx /= length;
		a2by /= length;

		// multiply by force
		a2bx *= force;
		a2by *= force;
	}
	
	a.force.add(-a2bx, -a2by);
	b.force.add(a2bx, a2by);
};


function EulerIntegrator (s) {
	this.s = s;
}
EulerIntegrator.prototype.step = function (t) {
	this.s.clearForces();
	this.s.applyForces();

	for (var idx = 0; idx < this.s.particles.length; idx++) {
		var p = this.s.particles[idx];
		p.force.scale(t / p.mass);
		p.velocity.add(p.force.x, p.force.y);
		p.velocity.scale(t);
		p.position.add(p.velocity.x, p.velocity.y);
	}
};


function ModifiedEulerIntegrator (s) {
	this.s = s;
};
ModifiedEulerIntegrator.prototype.step = function (t) {
	t = 0.7;
	this.s.clearForces();
	this.s.applyForces();

	var half_t = t / 2,
		a = new Vector(0, 0),
		holder = new Vector(0, 0);

	for (var idx = 0; idx < this.s.particles.length; idx++) {
		var p = this.s.particles[idx];

		p.force.scale(1 / p.mass);
		a = new Vector(p.force.x, p.force.y);

		p.velocity.scale(t);
		p.position.add(p.velocity.x, p.velocity.y);
		holder = new Vector(p.velocity.x, p.velocity.y);

		a.scale(t);
		p.velocity.add(a.x, a.y);

		a.scale(half_t);
		p.position.add(a.x, a.y);
	}
};


/**
 * Fourth-order integration approximator
 */
function RungeKuttaIntegrator(s) {
	this.s = s;
	this.originalPositions = [];
	this.originalVelocities = [];
	this.k1Forces = [];
	this.k1Velocities = [];
	this.k2Forces = [];
	this.k2Velocities = [];
	this.k3Forces = [];
	this.k3Velocities = [];
	this.k4Forces = [];
	this.k4Velocities = [];
}
RungeKuttaIntegrator.prototype.allocateParticles = function() {
	while (this.s.particles.length > this.originalPositions.length) {
		this.originalPositions.push(new Vector());
		this.originalVelocities.push(new Vector());
		this.k1Forces.push(new Vector());
		this.k1Velocities.push(new Vector());
		this.k2Forces.push(new Vector());
		this.k2Velocities.push(new Vector());
		this.k3Forces.push(new Vector());
		this.k3Velocities.push(new Vector());
		this.k4Forces.push(new Vector());
		this.k4Velocities.push(new Vector());
	}
};
RungeKuttaIntegrator.prototype.step = function (deltaT) {
	var	p,
		i,
		originalPosition,
		originalVelocity,
		k1Velocity,
		k2Velocity,
		k3Velocity,
		k4Velocity,
		k1Force,
		k2Force,
		k3Force,
		k4Force,
		s = this.s,
		halfDeltaT = 0.5 * deltaT;

	this.allocateParticles();

	for (i = 0; i < s.particles.length; i++) {
		p = s.particles[i];
		this.originalPositions[i].set(p.position);
		this.originalVelocities[i].set(p.velocity);
		p.force.clear();	// and clear the forces
	}

	////////////////////////////////////////////////////////
	// get all the k1 values

	s.applyForces();

	// save the intermediate forces
	for (i = 0; i < s.particles.length; i++) {
		p = s.particles[i];
		this.k1Forces[i].set(p.force);
		this.k1Velocities[i].set(p.velocity);

		p.force.clear();
	}

	////////////////////////////////////////////////////////////////
	// get k2 values


	for (i = 0; i < s.particles.length; i++) {
		p = s.particles[i];
		var halfDeltaTperMass = halfDeltaT / p.mass;
		originalPosition = this.originalPositions[i];
		k1Velocity = this.k1Velocities[i];
		p.position.x = originalPosition.x + k1Velocity.x * halfDeltaT;
		p.position.y = originalPosition.y + k1Velocity.y * halfDeltaT;
		originalVelocity = this.originalVelocities[i];
		k1Force = this.k1Forces[i];
		p.velocity.x = originalVelocity.x + k1Force.x * halfDeltaTperMass;
		p.velocity.y = originalVelocity.y + k1Force.y * halfDeltaTperMass;
	}

	s.applyForces();

	// save the intermediate forces
	for (i = 0; i < s.particles.length; i++) {
		p = s.particles[i];
		this.k2Forces[i].set(p.force);
		this.k2Velocities[i].set(p.velocity);
		p.force.clear();	// and clear the forces now that we are done with them
	}


	/////////////////////////////////////////////////////
	// get k3 values

	for (i = 0; i < s.particles.length; i++) {
		p = s.particles[i];
		originalPosition = this.originalPositions[i];
		k2Velocity = this.k2Velocities[i];
		p.position.x = originalPosition.x + k2Velocity.x * halfDeltaT;
		p.position.y = originalPosition.y + k2Velocity.y * halfDeltaT;
		originalVelocity = this.originalVelocities[i];
		k2Force = this.k2Forces[i];
		p.velocity.x = originalVelocity.x + k2Force.x * halfDeltaTperMass;
		p.velocity.y = originalVelocity.y + k2Force.y * halfDeltaTperMass;
	}

	s.applyForces();

	// save the intermediate forces
	for (i = 0; i < s.particles.length; i++) {
		p = s.particles[i];
		this.k3Forces[i].set(p.force);
		this.k3Velocities[i].set(p.velocity);
		p.force.clear();	// and clear the forces now that we are done with them
	}


	//////////////////////////////////////////////////
	// get k4 values
	for (i = 0; i < s.particles.length; i++) {
		p = s.particles[i];
		originalPosition = this.originalPositions[i];
		k3Velocity = this.k3Velocities[i];
		p.position.x = originalPosition.x + k3Velocity.x * deltaT;
		p.position.y = originalPosition.y + k3Velocity.y * deltaT;
		originalVelocity = this.originalVelocities[i];
		k3Force = this.k3Forces[i];

		var deltaTperMass = deltaT / p.mass;
		p.velocity.x = originalVelocity.x + k3Force.x * deltaTperMass;
		p.velocity.y = originalVelocity.y + k3Force.y * deltaTperMass;
	}

	s.applyForces();

	// save the intermediate forces
	for (i = 0; i < s.particles.length; i++) {
		p = s.particles[i];
		this.k4Forces[i].set(p.force);
		this.k4Velocities[i].set(p.velocity);
	}

	/////////////////////////////////////////////////////////////
	// put them all together and what do you get?

	for (i = 0; i < s.particles.length; i++) {

		p = s.particles[i];
		p.age += deltaT;
		
		// update position
		originalPosition = this.originalPositions[i];
		k1Velocity = this.k1Velocities[i];
		k2Velocity = this.k2Velocities[i];
		k3Velocity = this.k3Velocities[i];
		k4Velocity = this.k4Velocities[i];
		var oneSixthDeltaT = deltaT / 6.0;
		p.position.x = originalPosition.x + oneSixthDeltaT * (k1Velocity.x + 2.0*k2Velocity.x + 2.0*k3Velocity.x + k4Velocity.x);
		p.position.y = originalPosition.y + oneSixthDeltaT * (k1Velocity.y + 2.0*k2Velocity.y + 2.0*k3Velocity.y + k4Velocity.y);

		// update velocity
		originalVelocity = this.originalVelocities[i];
		k1Force = this.k1Forces[i];
		k2Force = this.k2Forces[i];
		k3Force = this.k3Forces[i];
		k4Force = this.k4Forces[i];
		var deltaTperSixMass = deltaT / (6.0 * p.mass);
		p.velocity.x = originalVelocity.x + deltaTperSixMass * (k1Force.x + 2.0*k2Force.x + 2.0*k3Force.x + k4Force.x);
		p.velocity.y = originalVelocity.y + deltaTperSixMass * (k1Force.y + 2.0*k2Force.y + 2.0*k3Force.y + k4Force.y);
	}
};


/**
 * Applies physics rules to a collection of particles
 */
function ParticleSystem(drag) {

	this.particles = [];
	this.springs = [];
	this.attractions = [];
	this.forces = [];
    this.integrator = new RungeKuttaIntegrator(this);
	this.hasDeadParticles = false;
	this.timer = new Timer();
	this.applyForcesTimings = new MeanBuffer(100);

	var argc = arguments.length;
	if (drag == null) {
		this.drag = ParticleSystem.DEFAULT_DRAG;
	} else {
		this.drag = drag;
	}
}
ParticleSystem.DEFAULT_GRAVITY = 0;
ParticleSystem.DEFAULT_DRAG = 0.001;
/**
 * @todo Implement other integrators

ParticleSystem.RUNGE_KUTTA = 0;
ParticleSystem.EULER = 1;
ParticleSystem.MODIFIED_EULER = 2;

ParticleSystem.prototype.setIntegrator = function(integrator) {
	switch (integrator) {
		case ParticleSystem.RUNGE_KUTTA:
			this.integrator = new RungeKuttaIntegrator(this);
			break;
		case ParticleSystem.EULER:
			this.integrator = new EulerIntegrator(this);
			break;
		case ParticleSystem.MODIFIED_EULER:
			this.integrator = new ModifiedEulerIntegrator(this);
			break;
	}
}
 */
ParticleSystem.prototype.tick = function() {
	this.tick_count += 1;
	this.integrator.step(arguments.length === 0 ? 1 : arguments[0]);
};
ParticleSystem.prototype.makeParticle = function() {
	var mass = 1.0;
	var x = 0;
	var y = 0;
	if (arguments.length === 3) {
		mass = arguments[0];
		x = arguments[1];
		y = arguments[2];
	} else if (arguments.length === 1) {
        mass = arguments[0];
    }
	var p = new Particle(mass);
	p.position.set(x, y);
	this.particles.push(p);
	return p;
};
ParticleSystem.prototype.makeSpring = function(a, b, k, d, l) {
	var s = new Spring(a, b, k, d, l);
	this.springs.push(s);
	return s;
};
ParticleSystem.prototype.makeAttraction = function(a, b, k, d) {
	var m = new Attraction(a, b, k, d);
	this.attractions.push(m);
	return m;
};
ParticleSystem.prototype.clear = function() {
	this.particles.clear();
	this.springs.clear();
	this.attractions.clear();
};
ParticleSystem.prototype.applyForces = function() {
	this.timer.start();

	var t, i;

	for (i = 0; i < this.particles.length; i++) {
		t = this.particles[i];
		t.force.add(t.velocity.x * -1 * this.drag, t.velocity.y * -1 * this.drag);
	}

	for (i = 0; i < this.springs.length; i++) {
		t = this.springs[i];
		t.apply();
	}

	for (i = 0; i < this.attractions.length; i++) {
		t = this.attractions[i];
		t.apply();
	}

	for (i = 0; i < this.forces.length; i++) {
		t = this.forces[i];
		t.apply();
	}

	this.applyForcesTimings.put(this.timer.stop());
};
ParticleSystem.prototype.clearForces = function() {
	var i;
	for (i = 0; i < this.particles.length; i++) {
		this.particles[i].force.set(0, 0, 0);
	}
};


/**
 * remove method of Array type
 * @param o    If a number, removes the corresponding index. Else, removes any elements that match parameter in type & value.
 */
Array.prototype.remove = function(o) {
	var i;
	if (typeof o === 'number') {
		this.splice(o, 1);
	}
	else {
		for (i = 0; i < this.length; i++) {
			if (this[i] === o) {
				this.remove(i);
				i--;
			}
		}
	}

};


function Smoother (smoothness) {
    this.float = 0.0;
    this.a = 0.0;
    this.lastOutput = 0.0;
    this.input = 0.0;
    this.setSmoothness(smoothness);
};

Smoother.prototype.setSmoothness = function (smoothness) {
    this.a = -smoothness;
    this.gain = 1.0 + this.a;
};

Smoother.prototype.setTarget = function (target) {
    this.input = target;
};

Smoother.prototype.setValue = function (x) {
    this.input = x;
    this.lastOutput = x;
};

Smoother.prototype.getTarget = function () {
    return this.input;
};

Smoother.prototype.tick = function () {
    this.lastOutput = this.gain * this.input - this.a * this.lastOutput;
};

Smoother.prototype.getValue = function () {
    return this.lastOutput;
};


function Smoother2D (smoothness) {
    this.x0 = new Smoother(smoothness);
    this.y0 = new Smoother(smoothness);
};

Smoother2D.prototype.setSmoothness = function (smoothness) {
    this.x0.setSmoothness(smoothness);
    this.y0.setSmoothness(smoothness);
};

Smoother2D.prototype.setX = function (x) {
    this.x0.setValue(x);
};

Smoother2D.prototype.setY = function (y) {
    this.y0.setValue(y);
};

Smoother2D.prototype.x = function () {
    return this.x0.getValue();
};

Smoother2D.prototype.y = function () {
    return this.y0.getValue();
};

Smoother2D.prototype.tick = function () {
    this.x0.tick();
    this.y0.tick();
};
