export function currentUtcIso(): string {
    return new Date().toISOString(); // Returns UTC time in ISO format
}
