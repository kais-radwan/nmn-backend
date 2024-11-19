import { Hono } from "hono";
import { etag } from "hono/etag";
import { logger } from "hono/logger";
import supabase from "./lib/supabase.ts";
import { startSession } from "./session.ts";
import yt from "./lib/yt.ts";
import { randomPush, similar } from "./algo.ts";
import { currentUtcIso } from "./lib/time.ts";
import { PrefItem } from "./types.ts";
import { randomId } from "./lib/random.ts";

const cachedPrefs = new Map<string, PrefItem>();

export const app = new Hono();
app.use(etag(), logger());

app.get("/user-session/:id", async (c) => {
    const userId = c.req.param("id");

    const { data: user, error } = await supabase.from("users").select("userId")
        .eq(
            "userId",
            userId,
        );

    if (error || user.length < 1) {
        c.status(404);
        if (error) console.error(error);
        return c.json({ error: "User not found" });
    }

    const session = await startSession(user[0].userId);
    return c.json(session || { error: "Can't build a session" });
});

app.get("/song-session/:user/:id", async (c) => {
    const userId = c.req.param("user");
    const videoId = c.req.param("id");

    const vid = await yt.getVideoDetails(videoId);

    if (!vid) {
        c.status(500);
        return c.json({ error: "Can't read video data" });
    }

    const sugs = vid.suggestions.map((s) => s.id);

    const { data: top } = await supabase.from("prefs").select().eq(
        "userId",
        userId,
    ).order("weight", { ascending: false }).limit(20);

    const selectedTop = similar(vid.keywords || [], top || []);
    const res = randomPush(sugs, selectedTop.map((s) => s.videoId));

    return c.json({ data: res, length: res.length });
});

app.get("/music/:id", async (c) => {
    const id = c.req.param("id");

    try {
        const vid = await yt.getVideoDetails(id);

        if (!vid) {
            throw new Error("Can't read video data");
        }

        return c.json({ data: vid });
    } catch (err) {
        console.error(err);
        c.status(500);
        return c.json({ error: "Can't read music video" });
    }
});

app.get("/search/", async (c) => {
    const query = c.req.query("query");

    if (!query) {
        c.status(403);
        return c.json({ error: "Invalid request" });
    }

    const res = await yt.search(query);

    return c.json({ ...res });
});

app.post("/weight/:userId/:songId", async (c) => {
    const userId = c.req.param("userId");
    const songId = c.req.param("songId");
    const fullId = `${userId}-${songId}`;
    let body: { weight: number } = await c.req.json();

    if (!body || !body.weight) {
        body = { weight: 1 };
    }

    const vid = await yt.getVideoDetails(songId);

    if (!vid) {
        c.status(400);
        return c.json({ error: "Can't read video data" });
    }

    const now = Date.now();
    const playedAt = currentUtcIso();

    let pref: PrefItem | undefined = cachedPrefs.get(fullId);

    if (!pref) {
        const { data: exist } = await supabase.from("prefs").select()
            .eq("userId", userId)
            .eq("videoId", songId).limit(1);

        if (exist && exist.length > 0) {
            pref = exist[0] as PrefItem;
        }
    }

    if (!pref) {
        const newPref: PrefItem = {
            id: randomId(),
            weight: body.weight,
            userId,
            videoId: songId,
            at: playedAt,
            lastPlayedAt: playedAt,
            atN: now,
            keywords: vid.keywords,
            timePoints: [playedAt],
        };

        const { error } = await supabase.from("prefs").insert(newPref);

        if (error) {
            console.error(error);
            c.status(500);
            return c.json({ success: false });
        }

        cachedPrefs.set(fullId, newPref);
        return c.json({ success: true });
    }

    pref.lastPlayedAt = playedAt;
    pref.weight += body.weight;
    pref.timePoints.push(playedAt);
    pref.atN = now;

    const { error } = await supabase.from("prefs").update(pref)
        .eq("userId", userId)
        .eq("videoId", songId);

    if (error) {
        console.error(error);
        c.status(500);
        return c.json({ success: false });
    }

    cachedPrefs.set(fullId, pref);
    return c.json({ success: true });
});
