export interface Thumbnail {
    url: string;
    width: number;
    height: number;
}

export interface SearchChannel {
    id: string;
    type: "channel";
    title: string;
    thumbnail: {
        thumbnails: Thumbnail[];
    };
}

export interface SearchRes {
    items: (SearchVideo | SearchChannel)[];
}

export interface SearchVideo {
    id: string;
    type: "video";
    thumbnail: {
        thumbnails: Thumbnail[];
    };
    title: string;
    channelTitle?: string;
    length: {
        simpleText: string;
        seconds?: number;
    };
}

export interface SearchPlaylist {
    id: string;
    type: "playlist";
    thumbnail: Thumbnail[];
    title: string;
    length: number;
    videos: any;
    videoCount: number;
    isLive: false;
}

export interface VideoRes extends SearchVideo {
    channel: string;
    channelId: string;
    description?: string;
    keywords?: string[];
    suggestions: SearchVideo[];
    views?: number;
    date?: string;
}

export interface GetDataOptions {
    type?: "video" | "playlist" | "channel";
    include?: ("video" | "playlist" | "channel")[];
}

export interface NextPage {
    nextPageToken: string;
    nextPageContext: any;
}

export interface Cut {
    id: string;
    videoId: string;
    title: string;
    thumbnail: Thumbnail[];
    channelId: string;
}

export interface PrefItem {
    id: string;
    weight: number;
    at: string;
    lastPlayedAt: string;
    timePoints: string[];
    videoId: string;
    keywords?: string[];
    userId?: string;
    atN?: number;
}

export interface SessionVideo {
    videoId: string;
    index: number;
}

export interface Session {
    data: SessionVideo[];
}
