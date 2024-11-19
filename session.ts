import supabase from "./lib/supabase.ts";
import { PrefItem, VideoRes } from "./types.ts";
import { sSelection } from "./algo.ts";
import yt from "./lib/yt.ts";
import { shuffle } from "./lib/random.ts";

export async function startSession(userId: string, exclude: string[] = []) {
    const latest = supabase.from("prefs").select()
        .eq("userId", userId)
        .order("atN", { ascending: false })
        .limit(10);

    const top = supabase.from("prefs").select()
        .eq("userId", userId)
        .order("weight", { ascending: false })
        .limit(10);

    const all = await Promise.all([latest, top]);

    if (all[0].error || all[1].error) {
        console.error(all[0].error || all[1].error);
        return undefined;
    }

    let latestData = all[0].data as PrefItem[];
    let topData = all[1].data as PrefItem[];

    if (latestData.length < 1) {
        return { data: [], length: 0 };
    }

    const selected: PrefItem[] = [
        latestData.shift()!,
        topData.shift()!,
    ];

    const ids = selected.map((s) => s.id);
    latestData = latestData.filter((a) => ids.indexOf(a.id) === -1);
    topData = topData.filter((a) => ids.indexOf(a.id) === -1);

    for (let i = 0; i < 5; i++) {
        const s = sSelection({
            top: topData,
            latest: latestData,
        });
        latestData = latestData.filter((a) => a.id !== s.id);
        topData = topData.filter((a) => a.id !== s.id);

        selected.push(s);

        if (latestData.length < 1) break;
    }

    const promises: Promise<VideoRes | undefined>[] = [];

    console.log(selected.map((s) => s.id));
    for (const sel of selected) {
        promises.push(yt.getVideoDetails(sel.videoId));
    }

    const solved = await Promise.all(promises);
    const videos = solved.filter((s) => typeof s !== "undefined");
    const allSugs = videos.map((v) => v.suggestions);

    const cache = new Map<string, boolean>();
    const session: string[] = selected.map((s) => s.videoId);

    let index = 0;
    for (let i = 0; i < allSugs.length; i++) {
        let j = 0;
        const thisData: string[] = [];

        for (let n = 0; n < allSugs.length; n++) {
            const vid = allSugs?.[n]?.[index];
            if (!vid) continue;

            if (cache.get(vid.id)) continue;

            thisData.push(vid.id);
            cache.set(vid.id, true);
            j++;
        }

        session.push(...shuffle(thisData));
        index++;
    }

    return {
        data: session,
        length: session.length,
    };
}

(async () => {
    console.time("initial");
    const data = await startSession("123");
    console.timeEnd("initial");

    if (!data) return;

    console.log("length:", data.length);
    console.time("items");
    for (const item of data.data) {
        const video = await yt.getVideoDetails(item);
        console.log(video?.title);
    }
    console.timeEnd("items");
})();
