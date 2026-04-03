/* 
 High-performance HTML5 Canvas Starfield with Interactivity
 */

class Starfield {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.stars = [];
        this.numStars = 400; // High-density for a "Grok-like" vista
        this.mouseX = 0;
        this.mouseY = 0;
        this.targetMouseX = 0;
        this.targetMouseY = 0;

        this.init();
        this.setupListeners();
        this.animate();
    }

    init() {
        this.resize();
        this.stars = [];
        for (let i = 0; i < this.numStars; i++) {
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 1.5,
                speedX: (Math.random() - 0.5) * 0.15, // Subtle drift
                speedY: (Math.random() - 0.5) * 0.15,
                alpha: Math.random(),
                twinkleSpeed: 0.005 + Math.random() * 0.015,
                parallaxFactor: 0.01 + Math.random() * 0.04 // Varying depth
            });
        }
    }

    setupListeners() {
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('mousemove', (e) => {
            this.targetMouseX = (e.clientX - window.innerWidth / 2);
            this.targetMouseY = (e.clientY - window.innerHeight / 2);
        });
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Smooth mouse follow for parallax (lerping)
        this.mouseX += (this.targetMouseX - this.mouseX) * 0.05;
        this.mouseY += (this.targetMouseY - this.mouseY) * 0.05;

        this.stars.forEach(star => {
            // Calculate depth-based movement
            let drawX = star.x + (this.mouseX * star.parallaxFactor);
            let drawY = star.y + (this.mouseY * star.parallaxFactor);

            // Wrap around canvas edges
            if (drawX < 0) star.x += this.canvas.width;
            if (drawX > this.canvas.width) star.x -= this.canvas.width;
            if (drawY < 0) star.y += this.canvas.height;
            if (drawY > this.canvas.height) star.y -= this.canvas.height;

            // Twinkle logic (alpha oscillation)
            star.alpha += star.twinkleSpeed;
            if (star.alpha > 1 || star.alpha < 0) star.twinkleSpeed *= -1;

            // Drifting motion
            star.x += star.speedX;
            star.y += star.speedY;

            // Rendering
            this.ctx.beginPath();
            this.ctx.arc(drawX, drawY, star.size, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.1, Math.min(1, star.alpha))})`;
            this.ctx.fill();
        });
    }

    animate() {
        this.draw();
        requestAnimationFrame(() => this.animate());
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    new Starfield('bg-canvas');
});
