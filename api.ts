import { Hono } from "hono";
import { etag } from "hono/etag";
import { logger } from "hono/logger";
import supabase from "./lib/supabase.ts";
import { startSession } from "./session.ts";
import yt from "./lib/yt.ts";
import { randomPush, similar } from "./algo.ts";
import { currentUtcIso } from "./lib/time.ts";
import { PrefItem, VideoRes } from "./types.ts";
import { randomId } from "./lib/random.ts";
import { cors } from "hono/cors";

const cachedPrefs = new Map<string, PrefItem>();

async function changeWeight(
  userId: string,
  songId: string,
  weight: number,
  pref?: PrefItem,
  vid?: VideoRes
) {
  const now = Date.now();
  const playedAt = currentUtcIso();
  vid = vid || (await yt.getVideoDetails(songId));
  const fullId = `${userId}-${songId}`;

  if (!vid) {
    return { message: "Can't read video info" };
  }

  if (!pref) {
    const { data: exist } = await supabase
      .from("prefs")
      .select()
      .eq("userId", userId)
      .eq("videoId", songId)
      .limit(1);

    if (exist && exist.length > 0) {
      pref = exist[0] as PrefItem;
    }
  }

  if (!pref) {
    const newPref: PrefItem = {
      id: undefined as any,
      weight: weight,
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
      return error;
    }

    cachedPrefs.set(fullId, newPref);
    return weight;
  }

  pref.lastPlayedAt = playedAt;
  pref.weight += weight;
  pref.timePoints.push(playedAt);
  pref.atN = now;

  let supabaseError;

  if (pref.weight <= 0) {
    const { error } = await supabase
      .from("prefs")
      .delete()
      .eq("userId", userId)
      .eq("videoId", songId);

    supabaseError = error;
  } else {
    const { error } = await supabase
      .from("prefs")
      .update(pref)
      .eq("userId", userId)
      .eq("videoId", songId);

    supabaseError = error;
  }

  if (supabaseError) {
    console.error(supabaseError);
    return supabaseError;
  }

  cachedPrefs.set(fullId, pref);
  return pref.weight;
}

export const app = new Hono();
app.use(
  cors({
    origin: "*", // Allow all origins
    allowMethods: ["GET", "POST", "PUT", "DELETE"],
  })
);

app.use(etag(), logger());

app.options("*", (c) => {
  c.res.headers.set("Access-Control-Allow-Origin", "*");
  c.res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  c.res.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  return c.text("", 204);
});

app.get("/user-session/:id", async (c) => {
  const userId = c.req.param("id");

  const { data: user, error } = await supabase
    .from("users")
    .select("userId")
    .eq("userId", userId);

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

  const { data: top } = await supabase
    .from("prefs")
    .select("keywords")
    .eq("userId", userId)
    .order("weight", { ascending: false })
    .limit(20);

  const selectedTop = similar(
    vid.keywords || [],
    top?.map((t) => t.keywords) || []
  );

  const res = randomPush(
    sugs,
    selectedTop.map((s) => s.videoId)
  );

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

app.get("/search", async (c) => {
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
  let body: { weight: number } = await c.req.json();

  if (!body || !body.weight) {
    body = { weight: 1 };
  }

  const res = await changeWeight(userId, songId, body.weight);

  if (typeof res !== "number") {
    c.status(500);
    return c.json({
      success: false,
      error: `Failed to change song weight: ${res.message}`,
    });
  }

  return c.json({ success: true });
});

app.post("/like/:userId/:songId", async (c) => {
  const userId = c.req.param("userId");
  const songId = c.req.param("songId");

  const vid = await yt.getVideoDetails(songId);

  if (!vid) {
    c.status(400);
    return c.json({ error: "Can't read video data" });
  }

  const { data } = await supabase
    .from("likes")
    .select()
    .eq("userId", userId)
    .eq("videoId", songId);

  if (data && data.length > 0) {
    return c.json({ success: true });
  }

  const { error } = await supabase.from("likes").insert({
    userId,
    videoId: songId,
    data: vid,
  });

  if (error) {
    c.status(500);
    return c.json({ error: `Error inserting to likes: ${error.message}` });
  }

  const res = await changeWeight(userId, songId, 1, undefined, vid);

  if (typeof res !== "number") {
    c.status(500);
    return c.json({
      success: false,
      error: `Error changing song weight: ${res.message}`,
    });
  }

  return c.json({ success: true });
});

app.post("/dislike/:userId/:songId", async (c) => {
  const userId = c.req.param("userId");
  const songId = c.req.param("songId");

  const { error: deleteLikeError } = await supabase
    .from("likes")
    .delete()
    .eq("userId", userId)
    .eq("videoId", songId);

  if (deleteLikeError) {
    c.status(500);
    return c.json({ success: false, error: deleteLikeError.message });
  }

  const res = await changeWeight(userId, songId, -0.7);
  if (typeof res !== "number") {
    c.status(500);
    return c.json({
      success: false,
      error: `Error changing song weight: ${res.message}`,
    });
  }

  if (res < 0) {
    return c.json({ success: true });
  }

  if (res === 0) {
    const { error } = await supabase
      .from("likes")
      .delete()
      .eq("userId", userId)
      .eq("videoId", songId);

    if (error) {
      c.status(500);
      return c.json({ success: false, error: error.message });
    }
  }

  return c.json({ success: true });
});
