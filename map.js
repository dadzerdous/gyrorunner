// map.js
export class MapSystem {
    constructor(totalFloors = 10) {
        this.floors = [];
        this.currentFloorIndex = -1;
        this.generateMap(totalFloors);
    }

    generateMap(totalFloors) {
        const types = ['Combat', 'Combat', 'Elite', 'Mystery', 'Rest'];
        for (let i = 0; i < totalFloors; i++) {
            // Generate 2-3 branching options for each floor
            const options = [];
            const numOptions = Math.floor(Math.random() * 2) + 2; 
            for (let j = 0; j < numOptions; j++) {
                options.push(types[Math.floor(Math.random() * types.length)]);
            }
            this.floors.push(options);
        }
        // Always make the last floor a Boss
        this.floors[totalFloors - 1] = ['Boss'];
    }

    getNextOptions() {
        this.currentFloorIndex++;
        return this.floors[this.currentFloorIndex];
    }
}
