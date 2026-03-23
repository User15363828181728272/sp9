const https = require('https');
const http  = require('http');

function nodeFetch(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method: opts.method || 'GET', headers: opts.headers || {} }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end',  () => resolve({ ok: r.statusCode < 400, status: r.statusCode, text: () => d, json: () => JSON.parse(d) }));
    });
    req.on('error', reject);
    if (opts.body) req.write(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body));
    req.end();
  });
}

const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36';

const GENRES = [
  'lofi hip hop chill','indie pop 2024','r&b vibes','acoustic guitar',
  'jazz cafe','pop hits Indonesia','urban beats','trending viral',
  'alternative indie','folk songs','midnight slow','afrobeat 2024',
  'phonk drift','electronic chill','soul music','trap beats 2024',
];

function fmtMs(ms) {
  if (!ms) return '0:00';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function parseSC(html) {
  const hyd = html.match(/window\.__sc_hydration\s*=\s*(\[[\s\S]*?\]);/);
  if (!hyd) return [];
  try {
    const data  = JSON.parse(hyd[1]);
    const col   = data.find(h => h.hydratable === 'search' || h.hydratable === 'sound_collection');
    const items = col?.data?.collection || [];
    return items.filter(t => t.kind === 'track').slice(0, 12).map(t => ({
      id:          't_' + t.id,
      title:       t.title,
      artist:      t.user?.username || t.user?.full_name || 'Unknown',
      thumbnail:   (t.artwork_url || t.user?.avatar_url || '').replace('-large', '-t300x300'),
      duration:    fmtMs(t.duration),
      duration_ms: t.duration || 0,
      url:         t.permalink_url,
    }));
  } catch { return []; }
}

const cors = require('./_cors');

module.exports = async (req, res) => {
  cors(res, 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, q, genre } = req.query;

  if (action === 'search') {
    if (!q) return res.status(400).json({ error: 'q wajib' });
    try {
      const r = await nodeFetch(`https://m.soundcloud.com/search?q=${encodeURIComponent(q)}`, { headers: { 'User-Agent': UA } });
      return res.json({ results: parseSC(r.text()) });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (action === 'random') {
    const g = genre || GENRES[Math.floor(Math.random() * GENRES.length)];
    try {
      const r = await nodeFetch(`https://m.soundcloud.com/search?q=${encodeURIComponent(g)}`, { headers: { 'User-Agent': UA } });
      const results = parseSC(r.text()).sort(() => Math.random() - 0.5).slice(0, 8);
      return res.json({ results, genre: g });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (action === 'download' && req.method === 'POST') {
    const { url: scUrl } = req.body || {};
    if (!scUrl) return res.status(400).json({ error: 'url wajib' });
    try {
      const r1   = await nodeFetch('https://sc.snapfirecdn.com/soundcloud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': UA },
        body: JSON.stringify({ target: scUrl, gsc: 'x' }),
      });
      const info = r1.json();
      if (!info?.sound?.progressive_url) throw new Error('Tidak ada stream URL');
      const r2 = await nodeFetch(`https://sc.snapfirecdn.com/soundcloud-get-dl?target=${encodeURIComponent(info.sound.progressive_url)}`, { headers: { 'Accept': 'application/json', 'User-Agent': UA } });
      const dl = r2.json();
      if (!dl?.url) throw new Error('Tidak ada download URL');
      return res.json({
        audio_url:   dl.url,
        title:       info.sound.title || '',
        artist:      info.metadata?.username || '',
        thumbnail:   (info.metadata?.artwork_url || info.metadata?.profile_picture_url || '').replace('-large', '-t300x300'),
        duration:    fmtMs(info.sound.full_duration || info.sound.duration),
        duration_ms: info.sound.full_duration || info.sound.duration || 0,
      });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  return res.status(400).json({ error: 'Action tidak dikenali' });
};
