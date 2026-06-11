// YouTube via public RSS at BUILD time (§8.2): no API key, no quota, no runtime cost.
// On fetch failure, falls back to the committed snapshot (build never ships an empty strip).
import snapshot from '../content/youtube-snapshot.json';

export interface Video { id: string; title: string; short: boolean }

const CHANNEL_ID = 'UCPyn9ALLFF4Z37Tc64ujd1Q';
export const CHANNEL_URL = 'https://www.youtube.com/@gotefigure';

export const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const watchUrl = (v: Video) =>
  v.short ? `https://www.youtube.com/shorts/${v.id}` : `https://www.youtube.com/watch?v=${v.id}`;

export async function getVideos(): Promise<Video[]> {
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const xml = await res.text();
    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];
    const videos: Video[] = entries.map((m) => {
      const e = m[1];
      const id = e.match(/<yt:videoId>([^<]+)/)?.[1] ?? '';
      const rawTitle = e.match(/<title>([^<]+)/)?.[1] ?? '';
      const title = rawTitle.replace(/&amp;/g, '&').replace(/\s*#\w+/g, '').replace(/[️￼​�︎⃣]|�/g, '').trim();
      return { id, title, short: /#shorts/i.test(rawTitle) };
    }).filter((v) => v.id);
    if (videos.length === 0) throw new Error('empty feed');
    return videos;
  } catch (e) {
    console.warn('[youtube] RSS fetch failed at build — using committed snapshot:', e);
    return snapshot.videos;
  }
}
