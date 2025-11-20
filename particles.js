const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
document.body.appendChild(canvas);

canvas.style.position = 'fixed';
canvas.style.top = '0';
canvas.style.left = '0';
canvas.style.width = '100%';
canvas.style.height = '100%';
canvas.style.zIndex = '-1';
canvas.style.pointerEvents = 'none';

let width, height;
let particles = [];
const particleCount = 150; // Increased count for better flocking effect
const connectionDistance = 100;
const mouseDistance = 200;

let mouse = { x: null, y: null };

// Flocking parameters
const maxSpeed = 2;
const maxForce = 0.05;
const perceptionRadius = 50;

// Shape formation
let state = 'FLOCKING'; // FLOCKING, FORMING
let targetShape = [];
let lastStateChange = Date.now();
const stateDuration = 5000; // Switch every 5 seconds

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);
resize();

window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

window.addEventListener('mouseout', () => {
    mouse.x = null;
    mouse.y = null;
});

class Particle {
    constructor() {
        this.position = { x: Math.random() * width, y: Math.random() * height };
        this.velocity = { x: (Math.random() - 0.5) * maxSpeed, y: (Math.random() - 0.5) * maxSpeed };
        this.acceleration = { x: 0, y: 0 };
        this.size = Math.random() * 2 + 1;
        this.color = '#C3FFBD';
        this.target = null;
    }

    update() {
        if (state === 'FLOCKING') {
            this.flock(particles);
        } else if (state === 'FORMING' && this.target) {
            this.seek(this.target);
        }

        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
        this.acceleration.x = 0;
        this.acceleration.y = 0;

        // Wrap around edges
        if (this.position.x > width) this.position.x = 0;
        else if (this.position.x < 0) this.position.x = width;
        if (this.position.y > height) this.position.y = 0;
        else if (this.position.y < 0) this.position.y = height;
    }

    applyForce(force) {
        this.acceleration.x += force.x;
        this.acceleration.y += force.y;
    }

    flock(particles) {
        let alignment = this.align(particles);
        let cohesion = this.cohere(particles);
        let separation = this.separate(particles);
        let mouseAttraction = this.attractToMouse();

        alignment.x *= 1.0; alignment.y *= 1.0;
        cohesion.x *= 1.0; cohesion.y *= 1.0;
        separation.x *= 1.5; separation.y *= 1.5; // Stronger separation
        mouseAttraction.x *= 2.0; mouseAttraction.y *= 2.0;

        this.applyForce(alignment);
        this.applyForce(cohesion);
        this.applyForce(separation);
        this.applyForce(mouseAttraction);

        // Limit speed
        const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
        if (speed > maxSpeed) {
            this.velocity.x = (this.velocity.x / speed) * maxSpeed;
            this.velocity.y = (this.velocity.y / speed) * maxSpeed;
        }
        
        // Add velocity to position (done in update)
        this.velocity.x += this.acceleration.x;
        this.velocity.y += this.acceleration.y;
    }

    seek(target) {
        let desired = { x: target.x - this.position.x, y: target.y - this.position.y };
        let d = Math.sqrt(desired.x ** 2 + desired.y ** 2);
        
        // Arrive behavior (slow down when close)
        let speed = maxSpeed;
        if (d < 100) {
            speed = (d / 100) * maxSpeed;
        }

        desired.x = (desired.x / d) * speed;
        desired.y = (desired.y / d) * speed;

        let steer = { x: desired.x - this.velocity.x, y: desired.y - this.velocity.y };
        
        // Limit force
        const steerLen = Math.sqrt(steer.x ** 2 + steer.y ** 2);
        if (steerLen > maxForce) {
            steer.x = (steer.x / steerLen) * maxForce;
            steer.y = (steer.y / steerLen) * maxForce;
        }

        this.applyForce(steer);
        this.velocity.x += this.acceleration.x;
        this.velocity.y += this.acceleration.y;
    }

    attractToMouse() {
        if (!mouse.x || !mouse.y) return { x: 0, y: 0 };
        
        let desired = { x: mouse.x - this.position.x, y: mouse.y - this.position.y };
        let d = Math.sqrt(desired.x ** 2 + desired.y ** 2);

        if (d < mouseDistance) {
            desired.x = (desired.x / d) * maxSpeed;
            desired.y = (desired.y / d) * maxSpeed;
            
            let steer = { x: desired.x - this.velocity.x, y: desired.y - this.velocity.y };
             const steerLen = Math.sqrt(steer.x ** 2 + steer.y ** 2);
            if (steerLen > maxForce) {
                steer.x = (steer.x / steerLen) * maxForce;
                steer.y = (steer.y / steerLen) * maxForce;
            }
            return steer;
        }
        return { x: 0, y: 0 };
    }

    align(particles) {
        let steering = { x: 0, y: 0 };
        let total = 0;
        for (let other of particles) {
            let d = Math.sqrt((this.position.x - other.position.x) ** 2 + (this.position.y - other.position.y) ** 2);
            if (other !== this && d < perceptionRadius) {
                steering.x += other.velocity.x;
                steering.y += other.velocity.y;
                total++;
            }
        }
        if (total > 0) {
            steering.x /= total;
            steering.y /= total;
            
            const speed = Math.sqrt(steering.x ** 2 + steering.y ** 2);
            if (speed > 0) {
                steering.x = (steering.x / speed) * maxSpeed;
                steering.y = (steering.y / speed) * maxSpeed;
            }
            
            steering.x -= this.velocity.x;
            steering.y -= this.velocity.y;
            
            const steerLen = Math.sqrt(steering.x ** 2 + steering.y ** 2);
            if (steerLen > maxForce) {
                steering.x = (steering.x / steerLen) * maxForce;
                steering.y = (steering.y / steerLen) * maxForce;
            }
        }
        return steering;
    }

    cohere(particles) {
        let steering = { x: 0, y: 0 };
        let total = 0;
        for (let other of particles) {
            let d = Math.sqrt((this.position.x - other.position.x) ** 2 + (this.position.y - other.position.y) ** 2);
            if (other !== this && d < perceptionRadius) {
                steering.x += other.position.x;
                steering.y += other.position.y;
                total++;
            }
        }
        if (total > 0) {
            steering.x /= total;
            steering.y /= total;
            
            // Seek the average position
            let desired = { x: steering.x - this.position.x, y: steering.y - this.position.y };
             let d = Math.sqrt(desired.x ** 2 + desired.y ** 2);
             if (d > 0) {
                 desired.x = (desired.x / d) * maxSpeed;
                 desired.y = (desired.y / d) * maxSpeed;
                 
                 steering.x = desired.x - this.velocity.x;
                 steering.y = desired.y - this.velocity.y;
                 
                 const steerLen = Math.sqrt(steering.x ** 2 + steering.y ** 2);
                if (steerLen > maxForce) {
                    steering.x = (steering.x / steerLen) * maxForce;
                    steering.y = (steering.y / steerLen) * maxForce;
                }
             }
        }
        return steering;
    }

    separate(particles) {
        let steering = { x: 0, y: 0 };
        let total = 0;
        for (let other of particles) {
            let d = Math.sqrt((this.position.x - other.position.x) ** 2 + (this.position.y - other.position.y) ** 2);
            if (other !== this && d < perceptionRadius / 2) { // Smaller radius for separation
                let diff = { x: this.position.x - other.position.x, y: this.position.y - other.position.y };
                if (d > 0) {
                    diff.x /= d;
                    diff.y /= d;
                }
                steering.x += diff.x;
                steering.y += diff.y;
                total++;
            }
        }
        if (total > 0) {
            steering.x /= total;
            steering.y /= total;
            
             const speed = Math.sqrt(steering.x ** 2 + steering.y ** 2);
            if (speed > 0) {
                steering.x = (steering.x / speed) * maxSpeed;
                steering.y = (steering.y / speed) * maxSpeed;
            }
            
            steering.x -= this.velocity.x;
            steering.y -= this.velocity.y;
            
             const steerLen = Math.sqrt(steering.x ** 2 + steering.y ** 2);
            if (steerLen > maxForce) {
                steering.x = (steering.x / steerLen) * maxForce;
                steering.y = (steering.y / steerLen) * maxForce;
            }
        }
        return steering;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}

function generateShape() {
    const shapeType = Math.random();
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 4;

    if (shapeType < 0.33) {
        // Circle
        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2;
            particles[i].target = {
                x: centerX + Math.cos(angle) * radius,
                y: centerY + Math.sin(angle) * radius
            };
        }
    } else if (shapeType < 0.66) {
        // Spiral
        for (let i = 0; i < particleCount; i++) {
            const angle = 0.1 * i;
            const r = 2 * i; 
            particles[i].target = {
                x: centerX + Math.cos(angle) * r,
                y: centerY + Math.sin(angle) * r
            };
        }
    } else {
        // Random Clusters
         const clusterCount = 5;
         const clusters = [];
         for(let i=0; i<clusterCount; i++) {
             clusters.push({
                 x: Math.random() * width,
                 y: Math.random() * height
             });
         }
         for (let i = 0; i < particleCount; i++) {
             const cluster = clusters[i % clusterCount];
             particles[i].target = {
                 x: cluster.x + (Math.random() - 0.5) * 100,
                 y: cluster.y + (Math.random() - 0.5) * 100
             };
         }
    }
}

function init() {
    particles = [];
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }
}

function animate() {
    ctx.clearRect(0, 0, width, height);
    
    const now = Date.now();
    if (now - lastStateChange > stateDuration) {
        state = state === 'FLOCKING' ? 'FORMING' : 'FLOCKING';
        if (state === 'FORMING') {
            generateShape();
        }
        lastStateChange = now;
    }

    particles.forEach(particle => {
        particle.update();
        particle.draw();
    });

    requestAnimationFrame(animate);
}

init();
animate();
