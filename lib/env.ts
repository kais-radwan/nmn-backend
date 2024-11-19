import "jsr:@std/dotenv/load";

export default function readEnv(key: string) {
    if (typeof process !== "undefined") {
        return process.env[key];
    }

    return Deno.env.get(key);
}
