// lib/yt.ts
var youtubeEndpoint = "https://www.youtube.com";
var searchTypes = {
  video: "sp=EgIQAQ%3D%3D",
  channel: "sp=EgIQAg%3D%3D",
  playlist: "sp=EgIQAw%3D%3D"
};
async function getInitData(url) {
  try {
    const page = await fetch(encodeURI(url), { mode: "no-cors" });
    const pageContent = await page.text();
    const initData = pageContent.split("var ytInitialData =");
    if (!initData || (initData.length || 0) < 2) {
      const err = "cannot_get_initial_data";
      throw Error(err);
    }
    let apiToken = null;
    let context = null;
    const data = initData[1].split("</script>")[0].slice(0, -1);
    if (pageContent.split("innertubeApiKey").length > 0) {
      apiToken = pageContent.split("innertubeApiKey")[1].trim().split(",")[0].split('"')[2];
    }
    if (pageContent.split("INNERTUBE_CONTEXT").length > 0) {
      context = JSON.parse(
        pageContent.split("INNERTUBE_CONTEXT")[1].trim().slice(2, -2)
      );
    }
    const ytInitData = JSON.parse(data);
    return { initData: ytInitData, apiToken, context };
  } catch (err) {
    console.error(err);
    return Promise.reject(err);
  }
}
function readVideo(item) {
  var _a;
  try {
    if (!item || !(item.videoRenderer || item.playlistVideoRenderer)) {
      return void 0;
    }
    const video = item.videoRenderer || item.playlistVideoRenderer;
    let isLive = false;
    if (video.badges && video.badges.length > 0 && video.badges[0].metadataBadgeRenderer && video.badges[0].metadataBadgeRenderer.style == "BADGE_STYLE_TYPE_LIVE_NOW") {
      isLive = true;
    }
    if (!isLive && video.thumbnailOverlays) {
      for (const i of video.thumbnailOverlays) {
        if (i.thumbnailOverlayTimeStatusRenderer && i.thumbnailOverlayTimeStatusRenderer.style && i.thumbnailOverlayTimeStatusRenderer.style == "LIVE") {
          isLive = true;
          break;
        }
      }
    }
    let seconds = 0;
    const length = ((_a = video.lengthText) == null ? void 0 : _a.simpleText) || "0:00";
    if (length !== "0:00") {
      const parts = length.split(":");
      seconds += Number(parts[0]) * 60;
      seconds += Number(parts[1]);
    }
    return {
      type: "video",
      id: video.videoId,
      thumbnail: video.thumbnail,
      title: video.title.runs[0].text,
      length: {
        simpleText: length,
        seconds
      },
      channelTitle: video.ownerText && video.ownerText.runs ? video.ownerText.runs[0].text : void 0
    };
  } catch (err) {
    console.error(err);
    return void 0;
  }
}
async function getYoutubePlayerDetails(url) {
  try {
    const page = await fetch(encodeURI(url));
    const pageContent = await page.text();
    const ytInitialData = pageContent.split(
      "var ytInitialPlayerResponse ="
    );
    if (!ytInitialData || (ytInitialData.length || 0) < 2) {
      throw new Error("cannot_get_player_data");
    }
    const data = ytInitialData[1].split("</script>")[0].slice(0, -1);
    const initData = JSON.parse(data);
    return { ...initData.videoDetails };
  } catch (err) {
    console.error(err);
    return Promise.reject(err);
  }
}
async function getData(keyword, limit = 0, options = {}) {
  let endpoint = `${youtubeEndpoint}/results?search_query=${keyword}`;
  let include = options.include;
  if (!include || include.length < 1) {
    include = ["video", "playlist", "channel"];
  }
  try {
    if (options.type) {
      endpoint += "&" + searchTypes[options.type];
    }
    const page = await getInitData(endpoint);
    const sectionListRenderer = page.initData.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer;
    let contToken = "DEFAULT_VALUE";
    const items = [];
    for (const content of sectionListRenderer.contents) {
      if (content.continuationItemRenderer) {
        contToken = content.continuationItemRenderer.continuationEndpoint.continuationCommand.token;
        continue;
      }
      if (!content.itemSectionRenderer) continue;
      for (const item of content.itemSectionRenderer.contents) {
        if (item.channelRenderer && include.indexOf("channel") !== -1) {
          const channel = item.channelRenderer;
          items.push({
            type: "channel",
            id: channel.channelId,
            thumbnail: channel.thumbnail,
            title: channel.title.simpleText
          });
          continue;
        }
        const playlist = item.playlistRenderer;
        if (playlist && playlist.playlistId && include.indexOf("playlist") !== -1) {
          items.push({
            type: "playlist",
            id: playlist.playlistId,
            thumbnail: playlist.thumbnails,
            title: playlist.title.simpleText,
            length: playlist.videoCount,
            videos: playlist.videos,
            videoCount: playlist.videoCount,
            isLive: false
          });
        }
        const videoRen = item.videoRenderer;
        if (videoRen && videoRen.videoId) {
          const video = readVideo(item);
          if (video) items.push(video);
        }
        if (limit !== 0 && items.length >= limit) break;
      }
    }
    const nextPage2 = {
      context: page.context,
      continuation: contToken
    };
    const results = limit !== 0 ? items.slice(0, limit) : items;
    return {
      items: results,
      nextPage: {
        nextPageToken: page.apiToken,
        nextPageContext: nextPage2
      }
    };
  } catch (err) {
    console.error(err);
    return Promise.reject(err);
  }
}
async function nextPage(nextPage2, include = ["video", "playlist"], limit = 0) {
  const endpoint = `${youtubeEndpoint}/youtubei/v1/search?key=${nextPage2.nextPageToken}`;
  try {
    const page = await fetch(endpoint, {
      method: "POST",
      body: JSON.stringify(nextPage2.nextPageContext)
    });
    const pageContent = await page.json();
    const data = pageContent.onResponseReceivedCommands[0].appendContinuationItemsAction;
    const items = [];
    for (const conitem of data.continuationItems) {
      if (conitem.continuationItemRenderer) {
        nextPage2.nextPageContext.continuation = conitem.continuationItemRenderer.continuationEndpoint.continuationCommand.token;
        continue;
      }
      if (!conitem.itemSectionRenderer) continue;
      for (const item of conitem.itemSectionRenderer.contents) {
        const videoRen = item.videoRenderer;
        if (videoRen && videoRen.videoId && include.indexOf("video") !== -1) {
          const video = readVideo(item);
          if (video) items.push(video);
          continue;
        }
        const playlistRen = item.playlistRenderer;
        if (playlistRen && playlistRen.playlistId && include.indexOf("playlist") !== -1) {
          const playlistData = await getPlaylistData(
            playlistRen.playlistId
          );
          if (!playlistData) continue;
          items.push({
            type: "playlist",
            id: playlistRen.playlistId,
            thumbnail: playlistRen.thumbnails,
            title: playlistRen.title.simpleText,
            length: playlistRen.videoCount,
            videos: playlistData,
            videoCount: playlistRen.videoCount,
            isLive: false
          });
        }
      }
    }
    const results = limit !== 0 ? items.slice(0, limit) : items;
    return {
      items: results,
      nextPage: nextPage2
    };
  } catch (err) {
    console.error(err);
  }
}
async function getPlaylistData(id, limit = 0) {
  const endpoint = `${youtubeEndpoint}/playlist?list=${id}`;
  try {
    const initData = await getInitData(endpoint);
    const sectionRen = initData.initData;
    const metadata = sectionRen.metadat;
    if (!sectionRen || !sectionRen.contents) return;
    const videoItems = sectionRen.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents[0].itemSectionRenderer.contents[0].playlistVideoListRenderer.contents;
    const items = [];
    for (const item of videoItems) {
      const videoRen = item.playlistVideoRenderer;
      if (videoRen && videoRen.videoId) {
        const video = readVideo(item);
        if (video) items.push(video);
      }
    }
    const results = limit !== 0 ? items.slice(0, limit) : items;
    return { items: results, metadata };
  } catch (err) {
    console.error(err);
  }
}
async function getChannelById(id) {
  const endpoint = `${youtubeEndpoint}/channel/${id}`;
  try {
    const page = await getInitData(endpoint);
    const tabs = page.initData.contents.twoColumnBrowseResultsRenderer.tabs;
    const items = tabs.map((json) => {
      if (json && json.tabRenderer) {
        const tabRenderer = json.tabRenderer;
        const title = tabRenderer.title;
        const content = tabRenderer.content;
        return { title, content };
      }
    }).filter((y) => typeof y != "undefined");
    return items;
  } catch (err) {
    console.error(err);
  }
}
async function getVideoDetails(id) {
  var _a;
  const endpoint = `${youtubeEndpoint}/watch?v=${id}`;
  try {
    const page = await getInitData(endpoint);
    const playerData = await getYoutubePlayerDetails(endpoint);
    const result = page.initData.contents.twoColumnWatchNextResults;
    const firstContent = result.results.results.contents[0].videoPrimaryInfoRenderer;
    const secondContent = result.results.results.contents[1].videoSecondaryInfoRenderer;
    const suggestions = result.secondaryResults.secondaryResults.results.filter((i) => i.hasOwnProperty("compactVideoRenderer")).map((i) => compactVideoRenderer(i));
    const channel = playerData.author || secondContent.owner.videoOwnerRenderer.title.runs[0].text;
    let length = playerData.lengthText || "";
    const seconds = Number(playerData.lengthSeconds || "0");
    if (!length && !seconds) {
      length = "0:00";
    }
    if (!length && seconds) {
      let holder = Number(seconds);
      let minutes = 0;
      while (holder > 60) {
        minutes++;
        holder -= 60;
      }
      length = `${minutes}:${holder || "00"}`;
    }
    const res = {
      type: "video",
      id: playerData.videoId,
      title: firstContent.title.runs[0].text,
      thumbnail: playerData.thumbnail,
      channelTitle: channel,
      channel,
      channelId: playerData.channelId,
      description: playerData.shortDescription,
      keywords: playerData.keywords,
      suggestions,
      length: {
        simpleText: length,
        seconds
      },
      views: Number(playerData.viewCount || "0"),
      date: ((_a = firstContent == null ? void 0 : firstContent.dateText) == null ? void 0 : _a.simpleText) || "unknown"
    };
    return res;
  } catch (err) {
    console.error(err);
  }
}
function compactVideoRenderer(data) {
  const videoRen = data.compactVideoRenderer;
  const res = {
    type: "video",
    id: videoRen.videoId,
    thumbnail: videoRen.thumbnail.thumbnails,
    title: videoRen.title.simpleText,
    channelTitle: videoRen.shortBylineText.runs[0].text,
    length: videoRen.lengthText
  };
  return res;
}
var funcs = {
  search: getData,
  nextPage,
  getVideoDetails,
  getChannelById,
  getPlaylistData
};
var yt_default = funcs;
export {
  yt_default as default
};
