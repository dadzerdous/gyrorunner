// input.js
export class InputHandler {
    constructor() {
        this.touchStart = { x: 0, y: 0 };
        this.command = null; // Stores the last action: 'JUMP', 'SHIELD', etc.
        this.moveDir = { x: 0, y: 0 };
        this.joystickActive = false;

        window.addEventListener('touchstart', e => {
            this.touchStart.x = e.touches[0].clientX;
            this.touchStart.y = e.touches[0].clientY;
            this.joystickActive = true;
        });

        window.addEventListener('touchmove', e => {
            const dx = e.touches[0].clientX - this.touchStart.x;
            const dy = e.touches[0].clientY - this.touchStart.y;
            const dist = Math.hypot(dx, dy);

            if (dist > 10) {
                this.moveDir.x = dx / dist;
                this.moveDir.y = dy / dist;
            }

            // Command Detection (Fast Swipes)
            if (dy < -70 && Math.abs(dx) < 30) this.command = 'UP_SWIPE';
            if (dx > 70 && Math.abs(dy) < 30) this.command = 'RIGHT_SWIPE';
        });

        window.addEventListener('touchend', () => {
            this.joystickActive = false;
            this.moveDir = { x: 0, y: 0 };
        });
    }

    consumeCommand() {
        const cmd = this.command;
        this.command = null;
        return cmd;
    }
}
