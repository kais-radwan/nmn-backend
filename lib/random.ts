export function shuffle<T>(array: T[]): T[] {
  return array
    .map((a) => ({ sort: Math.random(), value: a }))
    .sort((a, b) => a.sort - b.sort)
    .map((a) => a.value);
}

export function mix<T>(array1: T[], array2: T[]): T[] {
  const combinedArray = [...array1, ...array2];
  return shuffle(combinedArray);
}

export function weightedRandom<T>(items: T[], weights: number[]): T {
  const cumulativeWeights = weights.reduce(
    (acc, weight) => {
      acc.push(weight + acc[acc.length - 1]);
      return acc;
    },
    [0]
  );

  const totalWeight = cumulativeWeights[cumulativeWeights.length - 1];
  const randomValue = Math.random() * totalWeight;

  for (let i = 0; i < cumulativeWeights.length; i++) {
    if (randomValue < cumulativeWeights[i + 1]) {
      return items[i] as T;
    }
  }

  return items[0];
}

export function randomId(length: number = 10): string {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters[randomIndex];
  }

  return result;
}
