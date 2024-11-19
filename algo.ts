import { shuffle, weightedRandom } from "./lib/random.ts";
import { PrefItem } from "./types.ts";
import stringSimilarity from "string-similarity";

interface Inputs {
    latest: PrefItem[];
    top: PrefItem[];
}

export function sSelection(args: Inputs) {
    const allData: PrefItem[] = [];
    const latestIds: string[] = [];

    const now = new Date();
    const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

    for (
        const item of args.latest
            .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
            .slice(0, 10)
    ) {
        if (!item) continue;
        allData.push(item);
        latestIds.push(item.videoId);
    }

    for (
        const item of args.top
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 10)
    ) {
        if (!item) continue;
        if (latestIds.includes(item.videoId)) {
            item.weight += 1; // Boost weight for overlap
        }

        if (item.timePoints) {
            const timeSimilarityBoost = item.timePoints.reduce(
                (boost, timePoint) => {
                    const [hours, minutes] = timePoint.split(":").map(Number);
                    const timePointMinutes = hours * 60 + minutes;
                    const difference = Math.abs(
                        currentMinutes - timePointMinutes,
                    );

                    // Apply boost if within 1 hour (60 minutes)
                    return difference <= 60
                        ? boost + (1 - difference / 60)
                        : boost;
                },
                0,
            );

            item.weight += timeSimilarityBoost;
        }

        const timeSinceLastPlayed = Date.now() -
            new Date(item.lastPlayedAt).getTime();
        const decayFactor = Math.exp(
            -timeSinceLastPlayed / (1000 * 60 * 60 * 24 * 7),
        ); // Decay daily
        item.weight *= decayFactor;

        const timeSinceAdded = Date.now() -
            new Date(item.lastPlayedAt).getTime();
        const degradationFactor = Math.exp(
            -timeSinceAdded / (1000 * 60 * 60 * 24 * 7),
        ); // Degrade weekly
        item.weight -= (1 - degradationFactor) * 2;

        allData.push(item);
    }

    const shuffledData = shuffle(allData);
    const weights = shuffledData.map((d) => d.weight);
    const selected = weightedRandom(shuffledData, weights);

    return selected;
}

export function similar(keywords: string[], top: PrefItem[]): PrefItem[] {
    return top.filter((topItem) =>
        (topItem.keywords || []).some((keyword) => keywords.includes(keyword))
    );
}

export function randomPush<T>(arr1: T[], arr2: T[]): T[] {
    const result = [...arr1];

    arr2.forEach((item) => {
        const randomIndex = Math.floor(Math.random() * (result.length + 1));
        result.splice(randomIndex, 0, item);
    });

    return result;
}
