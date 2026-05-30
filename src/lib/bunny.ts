// Bunny Stream API client
// Requiere en .env.local:
//   BUNNY_STREAM_API_KEY   — API key de la biblioteca (Stream > Library > API key)
//   BUNNY_LIBRARY_ID       — ID numérico de la biblioteca
//   BUNNY_CDN_HOSTNAME     — hostname del pull zone (ej: vz-abc123.b-cdn.net)

const API_KEY = process.env.BUNNY_STREAM_API_KEY!;
const LIBRARY_ID = process.env.BUNNY_LIBRARY_ID!;
const CDN_HOST = process.env.BUNNY_CDN_HOSTNAME!;

const BASE = `https://video.bunnycdn.com/library/${LIBRARY_ID}`;

export function isBunnyConfigured() {
  return !!(API_KEY && LIBRARY_ID && CDN_HOST);
}

export function bunnyHlsUrl(videoId: string) {
  return `https://${CDN_HOST}/${videoId}/playlist.m3u8`;
}

export function bunnyThumbnailUrl(videoId: string, timestamp = 0) {
  return `https://${CDN_HOST}/${videoId}/thumbnail.jpg?seek=${timestamp}`;
}

export function bunnyEmbedUrl(videoId: string) {
  return `https://iframe.mediadelivery.net/play/${LIBRARY_ID}/${videoId}`;
}

interface BunnyVideo {
  guid: string;
  title: string;
  status: number; // 0=queued, 1=processing, 2=encoding, 3=finished, 4=error
  thumbnailFileName?: string;
}

export async function createBunnyVideo(title: string): Promise<BunnyVideo> {
  const res = await fetch(`${BASE}/videos`, {
    method: "POST",
    headers: {
      AccessKey: API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`Bunny create failed: ${res.status}`);
  return res.json();
}

export async function uploadToBunny(videoId: string, data: Buffer, mimeType: string): Promise<void> {
  const res = await fetch(`${BASE}/videos/${videoId}`, {
    method: "PUT",
    headers: {
      AccessKey: API_KEY,
      "Content-Type": mimeType,
    },
    body: data as unknown as BodyInit,
  });
  if (!res.ok) throw new Error(`Bunny upload failed: ${res.status}`);
}

export async function getBunnyVideo(videoId: string): Promise<BunnyVideo> {
  const res = await fetch(`${BASE}/videos/${videoId}`, {
    headers: { AccessKey: API_KEY },
  });
  if (!res.ok) throw new Error(`Bunny get failed: ${res.status}`);
  return res.json();
}

export async function deleteBunnyVideo(videoId: string): Promise<void> {
  await fetch(`${BASE}/videos/${videoId}`, {
    method: "DELETE",
    headers: { AccessKey: API_KEY },
  });
}
