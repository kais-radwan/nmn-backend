import ys from "./lib/yt.ts";
import { SearchVideo } from "./types.ts";

async function main() {
    const res = await ys.search("NF no name");
    const video = await ys.getVideoDetails(res.items[0].id!);

    // const res2 = await ys.search(video?.channelTitle!);
    // console.log(res2.items.slice(0, 3));
    // console.log(video?.channelId);
    //
    console.log(res.items[0].id);
    console.log(res.items[2].id);
    console.log(res.items[3].id);
    console.log(res.items[4].id);
}

async function playlist() {
    const res = await ys.getPlaylistData("UUedvOgsKFzcK3hA5taf3KoQ");
    console.log(res);
}

async function test(n: number = 10) {
    const calls: any[] = [];
    console.time("test");

    for (let i = 0; i < n; i++) {
        calls.push(ys.search(`eminem ${i}`));
    }

    const results = await Promise.all(calls) as unknown as {
        items: (SearchVideo)[];
    }[];
    console.log(results.map((r) => r.items.map((i) => i.id)));
    console.timeEnd("test");
}

main();
// playlist();
// test(1);
