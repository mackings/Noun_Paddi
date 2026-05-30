export function extractVideoId(value) {
  const input = String(value || '').trim();
  if (/^[a-zA-Z0-9_-]{6,20}$/.test(input)) return input;

  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/,
    /youtube\.com\/shorts\/([^?]+)/,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }

  return null;
}

export const LOCKED_OPTS = {
  width: '100%',
  height: '100%',
  playerVars: {
    autoplay: 0,
    controls: 0,
    cc_load_policy: 0,
    disablekb: 1,
    fs: 0,
    iv_load_policy: 3,
    modestbranding: 1,
    playsinline: 1,
    rel: 0,
    origin: typeof window !== 'undefined' ? window.location.origin : 'https://paddi.com.ng',
  },
};
