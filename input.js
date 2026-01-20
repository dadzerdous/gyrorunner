// input.js
export class InputHandler {
    constructor() {
        this.touchStart = { x: 0, y: 0 };
        this.command = null; // Stores 'JUMP', 'DASH', etc.
        this.moveDir = { x: 0, y: 0 };
        this.joystickActive = false;

        // --- KEYBOARD STATE ---
        this.keys = {};

        // Mouse/Touch Events (Joystick)
        window.addEventListener('touchstart', e => this.handleStart(e.touches[0].clientX, e.touches[0].clientY));
        window.addEventListener('touchmove', e => this.handleMove(e.touches[0].clientX, e.touches[0].clientY));
        window.addEventListener('touchend', () => this.handleEnd());

        // Keyboard Events
        window.addEventListener('keydown', e => {
            this.keys[e.code] = true;
            // Map Keys to Commands
            if (e.code === 'Space') this.command = 'UP_SWIPE'; // Jump
            if (e.code === 'ShiftLeft') this.command = 'RIGHT_SWIPE'; // Dash
        });
        window.addEventListener('keyup', e => {
            this.keys[e.code] = false;
        });
    }

    handleStart(x, y) {
        this.touchStart.x = x;
        this.touchStart.y = y;
        this.joystickActive = true;
    }

    handleMove(x, y) {
        const dx = x - this.touchStart.x;
        const dy = y - this.touchStart.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 10) {
            this.moveDir.x = dx / dist;
            this.moveDir.y = dy / dist;
        }

        // Swipe Detection
        if (dy < -70 && Math.abs(dx) < 30) this.command = 'UP_SWIPE';
        if (dx > 70 && Math.abs(dy) < 30) this.command = 'RIGHT_SWIPE';
    }

    handleEnd() {
        this.joystickActive = false;
        this.moveDir = { x: 0, y: 0 };
    }

    /**
     * Updated to merge Joystick + Keyboard movement logic
     */
    getMovement() {
        let x = this.moveDir.x;
        let y = this.moveDir.y;

        // WASD / Arrows
        if (this.keys['KeyW'] || this.keys['ArrowUp']) y = -1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) y = 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) x = -1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) x = 1;

        // Normalize diagonal speed
        if (x !== 0 && y !== 0) {
            const mag = Math.hypot(x, y);
            x /= mag;
            y /= mag;
        }

        return { x, y };
    }

    consumeCommand() {
        const cmd = this.command;
        this.command = null;
        return cmd;
    }
}
