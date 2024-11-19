import { sSelection } from "../algo.ts";

function generateRandomTime() {
    const hours = Math.floor(Math.random() * 24);
    const minutes = Math.floor(Math.random() * 60);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")
        }`;
}

function generateItem(id: string, weight: number): any {
    const now = new Date().toISOString();
    return {
        id,
        weight,
        at: now,
        lastPlayedAt: now,
        timePoints: [
            generateRandomTime(),
            generateRandomTime(),
            generateRandomTime(),
        ],
    };
}

// Generate dummy data for testing
function generateDummyData() {
    const latest: any[] = [];
    const top: any[] = [];

    for (let i = 1; i <= 20; i++) {
        latest.push(
            generateItem(`latest-${i}`, Math.floor(Math.random() * 10)),
        );
        top.push(generateItem(`top-${i}`, Math.floor(Math.random() * 10) + 5));
    }

    return { latest, top };
}

function testAlgo() {
    let { latest, top } = generateDummyData();
    const results: any[] = [];

    for (let i = 0; i < 5; i++) {
        const selected = sSelection({ latest, top });
        latest = latest.filter((l) => l.id !== selected.id);
        top = top.filter((t) => t.id !== selected.id);
        results.push(selected);
    }

    console.log("Selected", results);
}

testAlgo();
