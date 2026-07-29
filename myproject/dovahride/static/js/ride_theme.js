(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", () => {
        const canvas = document.getElementById("ride-particles");
        const ring = document.querySelector(".ride-cursor-ring");
        const dot = document.querySelector(".ride-cursor-dot");
        const glow = document.querySelector(".ride-ambient-glow");
        const isTouch = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
        let pointerX = innerWidth * .5;
        let pointerY = innerHeight * .5;
        let cursorFramePending = false;

        if (isTouch) {
            [ring, dot, glow].forEach((node) => {
                if (node) node.style.display = "none";
            });
        } else {
            document.addEventListener("pointermove", (event) => {
                pointerX = event.clientX;
                pointerY = event.clientY;
                if (cursorFramePending) return;
                cursorFramePending = true;
                requestAnimationFrame(() => {
                    const centered = `translate3d(${pointerX}px, ${pointerY}px, 0) translate(-50%, -50%)`;
                    if (ring) ring.style.transform = centered;
                    if (dot) dot.style.transform = centered;
                    if (glow) glow.style.transform = centered;
                    cursorFramePending = false;
                });
            }, {passive: true});

            document.body.addEventListener("pointerover", (event) => {
                if (event.target.closest("a, button, input, select, textarea, .card, .leaflet-control")) {
                    ring?.classList.add("is-hovering");
                }
            });
            document.body.addEventListener("pointerout", (event) => {
                if (event.target.closest("a, button, input, select, textarea, .card, .leaflet-control")) {
                    ring?.classList.remove("is-hovering");
                }
            });
        }

        if (!canvas) return;
        const context = canvas.getContext("2d");
        const points = [];
        const colors = [
            "rgba(24,185,159,.52)",
            "rgba(53,169,214,.42)",
            "rgba(255,139,85,.38)",
        ];

        function resize() {
            const ratio = Math.min(devicePixelRatio || 1, 1.5);
            canvas.width = Math.floor(innerWidth * ratio);
            canvas.height = Math.floor(innerHeight * ratio);
            canvas.style.width = `${innerWidth}px`;
            canvas.style.height = `${innerHeight}px`;
            context.setTransform(ratio, 0, 0, ratio, 0, 0);
        }

        class TrailPoint {
            constructor() {
                this.reset(true);
            }

            reset(initial) {
                this.x = Math.random() * innerWidth;
                this.y = initial ? Math.random() * innerHeight : innerHeight + 20;
                this.radius = Math.random() * 2.1 + .7;
                this.vx = (Math.random() - .5) * .25;
                this.vy = -(Math.random() * .35 + .12);
                this.color = colors[Math.floor(Math.random() * colors.length)];
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;
                if (!isTouch) {
                    const dx = this.x - pointerX;
                    const dy = this.y - pointerY;
                    const distance = Math.hypot(dx, dy);
                    if (distance < 115 && distance > 0) {
                        const force = (115 - distance) / 115;
                        this.x += (dx / distance) * force * 1.1;
                        this.y += (dy / distance) * force * 1.1;
                    }
                }
                if (this.y < -20 || this.x < -30 || this.x > innerWidth + 30) this.reset(false);
            }

            draw() {
                context.beginPath();
                context.fillStyle = this.color;
                context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                context.fill();
            }
        }

        resize();
        for (let index = 0; index < 38; index += 1) points.push(new TrailPoint());

        function frame() {
            context.clearRect(0, 0, innerWidth, innerHeight);
            points.forEach((point, index) => {
                point.update();
                point.draw();
                for (let otherIndex = index + 1; otherIndex < points.length; otherIndex += 1) {
                    const other = points[otherIndex];
                    const distance = Math.hypot(point.x - other.x, point.y - other.y);
                    if (distance < 92) {
                        context.beginPath();
                        context.strokeStyle = `rgba(30, 145, 143, ${(1 - distance / 92) * .11})`;
                        context.lineWidth = 1;
                        context.moveTo(point.x, point.y);
                        context.lineTo(other.x, other.y);
                        context.stroke();
                    }
                }
            });
            requestAnimationFrame(frame);
        }

        addEventListener("resize", resize);
        frame();
    });
})();
