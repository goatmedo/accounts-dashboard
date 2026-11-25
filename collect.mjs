// Collects engagement numbers for the user's accounts and writes CSVs to ./data
//   node collect.mjs
// TikTok: headless Edge reads each profile and its video list (views, date) the way a visitor's browser does.
// Telegram: member count from the Bot API, per-post views from the public page t.me/s/<channel>.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, 'data');
mkdirSync(DATA, { recursive: true });

const TIKTOK = [
  { account: 'hamed23_12', platform: 'TikTok', label: 'tiktok_movies' },
  { account: 'meed1291', platform: 'TikTok', label: 'tiktok_business' },
];
const TELEGRAM = { account: 'movies1038', platform: 'Telegram' };
// Windows: Edge. Linux (GitHub Actions): Chrome. BROWSER_PATH overrides either.
const IS_WIN = process.platform === 'win32';
const EDGE = process.env.BROWSER_PATH || (IS_WIN ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' : '/usr/bin/google-chrome');
const PORT = 9333;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); // Riyadh date

function log(...a) { console.log(new Date().toISOString(), ...a); }
// first words of a caption, hashtags removed
const short = (s) => { s = String(s || '').replace(/#\S+/g, '').replace(/\s+/g, ' ').trim(); return s.length > 70 ? s.slice(0, 68).trim() + '…' : s; };

// ---------- CSV ----------
const esc = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const toCsv = (cols, rows) => [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n';
function readCsv(file) {
  if (!existsSync(file)) return [];
  const lines = readFileSync(file, 'utf8').trim().split(/\r?\n/);
  const cols = lines.shift().split(',');
  return lines.filter(Boolean).map((l) => {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (q) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return Object.fromEntries(cols.map((c, i) => [c, out[i] ?? '']));
  });
}

// ---------- Telegram ----------
function parseK(s) {
  s = s.trim();
  const m = s.match(/^([\d.]+)\s*([KM]?)$/i);
  if (!m) return null;
  return Math.round(parseFloat(m[1]) * (m[2].toUpperCase() === 'K' ? 1e3 : m[2].toUpperCase() === 'M' ? 1e6 : 1));
}
async function telegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  let members = null;
  if (token) {
    const r = await fetch(`https://api.telegram.org/bot${token}/getChatMemberCount?chat_id=@${TELEGRAM.account}`).then((x) => x.json());
    if (r.ok) members = r.result;
  }
  const posts = new Map();
  let before = '';
  for (let page = 0; page < 30; page++) {
    const html = await fetch(`https://t.me/s/${TELEGRAM.account}${before ? '?before=' + before : ''}`).then((r) => r.text());
    if (members === null) {
      const m = html.match(/tgme_channel_info_counter"><span class="counter_value">([^<]+)<\/span> <span class="counter_type">subscribers/);
      if (m) members = parseK(m[1]);
    }
    const blocks = html.split('tgme_widget_message_wrap').slice(1);
    let minId = Infinity, added = 0;
    for (const b of blocks) {
      const id = b.match(/data-post="[^/]+\/(\d+)"/)?.[1];
      const views = b.match(/tgme_widget_message_views">([^<]+)</)?.[1];
      const date = b.match(/<time datetime="([^"]+)"/)?.[1];
      if (!id || !date) continue;
      minId = Math.min(minId, +id);
      const raw = b.match(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/)?.[1] || '';
      const title = short(raw.replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
      if (!posts.has(id)) { added++; posts.set(id, { platform: 'Telegram', account: TELEGRAM.account, id, date: date.slice(0, 10), views: views ? parseK(views) : '', likes: '', comments: '', shares: '', title }); }
    }
    if (!added || minId === Infinity || minId <= 1) break;
    before = String(minId);
    await sleep(800);
  }
  log(`Telegram: ${members} members, ${posts.size} posts`);
  return { members, posts: [...posts.values()] };
}

// ---------- TikTok via headless Edge (Chrome DevTools Protocol) ----------
async function withEdge(fn) {
  // .edge-profile (restored from the old Windows) no longer works here, so a fresh profile is used
  const profile = process.env.BROWSER_PROFILE || join(HERE, '.edge-profile-new');
  const proc = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--window-size=1366,2000', '--lang=en-US',
    ...(IS_WIN ? [] : ['--no-sandbox', '--disable-dev-shm-usage']), 'about:blank'], { stdio: 'ignore' });
  try {
    let ver;
    for (let i = 0; i < 120 && !ver; i++) { try { ver = await fetch(`http://127.0.0.1:${PORT}/json/version`).then((r) => r.json()); } catch { await sleep(250); } }
    if (!ver) throw new Error('Edge did not start');
    return await fn();
  } finally {
    proc.kill();
  }
}
async function openPage() {
  const t = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json());
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let n = 0; const pending = new Map(); const listeners = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { const { res, rej } = pending.get(msg.id); pending.delete(msg.id); msg.error ? rej(new Error(msg.error.message)) : res(msg.result); }
    else if (msg.method) listeners.forEach((l) => l(msg));
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const id = ++n; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
  return { send, on: (l) => listeners.push(l), close: () => { ws.close(); return fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`); } };
}
async function tiktokAccount(acc) {
  const p = await openPage();
  const items = new Map(); let hasMore = true; const reqs = new Map(); let lastAt = Date.now();
  p.on(async (m) => {
    if (m.method === 'Network.responseReceived' && m.params.response.url.includes('/api/post/item_list/')) reqs.set(m.params.requestId, true);
    if (m.method === 'Network.loadingFinished' && reqs.has(m.params.requestId)) {
      try {
        const { body } = await p.send('Network.getResponseBody', { requestId: m.params.requestId });
        const j = JSON.parse(body);
        for (const it of j.itemList || []) {
          if (it.author?.uniqueId && it.author.uniqueId !== acc.account) continue;
          items.set(it.id, { platform: 'TikTok', account: acc.account, id: it.id, date: new Date((it.createTime + 3 * 3600) * 1000).toISOString().slice(0, 10),
            views: +(it.statsV2?.playCount ?? it.stats?.playCount ?? 0), likes: +(it.statsV2?.diggCount ?? it.stats?.diggCount ?? 0),
            comments: +(it.statsV2?.commentCount ?? it.stats?.commentCount ?? 0), shares: +(it.statsV2?.shareCount ?? it.stats?.shareCount ?? 0), title: short(it.desc) });
        }
        hasMore = !!j.hasMore; lastAt = Date.now();
      } catch { /* empty body: ignore */ }
    }
  });
  await p.send('Network.enable');
  await p.send('Network.setUserAgentOverride', { userAgent: UA, acceptLanguage: 'en-US,en;q=0.9', platform: 'Win32' });
  await p.send('Page.enable');
  await p.send('Page.navigate', { url: `https://www.tiktok.com/@${acc.account}` });
  await sleep(8000);
  const ev = await p.send('Runtime.evaluate', { returnByValue: true, expression: `(() => { try { const u = JSON.parse(document.querySelector('#__UNIVERSAL_DATA_FOR_REHYDRATION__').textContent).__DEFAULT_SCOPE__['webapp.user-detail'].userInfo; return { stats: u.stats, name: u.user.nickname }; } catch (e) { return null; } })()` });
  const info = ev.result.value;
  for (let i = 0; i < 40 && hasMore; i++) {
    const before = items.size;
    await p.send('Runtime.evaluate', { expression: 'window.scrollTo(0, document.documentElement.scrollHeight)' });
    await sleep(2500);
    if (items.size === before && Date.now() - lastAt > 9000) break;
  }
  await p.close();
  log(`TikTok @${acc.account}: ${info?.stats?.followerCount} followers, ${items.size}/${info?.stats?.videoCount} videos read`);
  return { info, posts: [...items.values()] };
}

// ---------- main ----------
const accounts = [];
const posts = [];
const problems = [];

try {
  const tg = await telegram();
  accounts.push({ date: today, platform: 'Telegram', account: TELEGRAM.account, name: 'قناة الأفلام', followers: tg.members, likes: '', posts: tg.posts.length, link: `https://t.me/${TELEGRAM.account}` });
  posts.push(...tg.posts);
} catch (e) { problems.push('Telegram: ' + e.message); }

await withEdge(async () => {
  for (const acc of TIKTOK) {
    try {
      let r = await tiktokAccount(acc);
      if (!r.info) { log(`@${acc.account}: profile not readable, retrying`); r = await tiktokAccount(acc); }
      if (!r.info) throw new Error('profile not readable');
      accounts.push({ date: today, platform: 'TikTok', account: acc.account, name: r.info.name, followers: r.info.stats.followerCount, likes: r.info.stats.heartCount ?? r.info.stats.heart, posts: r.info.stats.videoCount, link: `https://www.tiktok.com/@${acc.account}` });
      posts.push(...r.posts);
      if (r.posts.length < r.info.stats.videoCount) problems.push(`@${acc.account}: read ${r.posts.length} of ${r.info.stats.videoCount} videos`);
    } catch (e) { problems.push(`@${acc.account}: ${e.message}`); }
  }
}).catch((e) => problems.push('Edge: ' + e.message));

// keep last known numbers for any account that failed today
const prevAccounts = readCsv(join(DATA, 'accounts.csv'));
for (const p of prevAccounts) if (!accounts.some((a) => a.account === p.account)) accounts.push(p);
// a partial read (TikTok often cuts the video list short) must not drop videos: keep every earlier row not re-read today
const prevPosts = readCsv(join(DATA, 'posts.csv'));
const readNow = new Set(posts.map((x) => x.account + '|' + x.id));
for (const p of prevPosts) if (!readNow.has(p.account + '|' + p.id)) posts.push(p);

// daily history: one row per account per day
const history = readCsv(join(DATA, 'history.csv')).filter((h) => h.date !== today);
for (const a of accounts) if (a.date === today) history.push({ date: today, platform: a.platform, account: a.account, followers: a.followers, likes: a.likes, posts: a.posts });

writeFileSync(join(DATA, 'accounts.csv'), toCsv(['date', 'platform', 'account', 'name', 'followers', 'likes', 'posts', 'link'], accounts));
posts.sort((a, b) => (a.date < b.date ? 1 : -1));
writeFileSync(join(DATA, 'posts.csv'), toCsv(['platform', 'account', 'id', 'date', 'views', 'likes', 'comments', 'shares', 'title'], posts));
history.sort((a, b) => (a.date < b.date ? -1 : 1));
writeFileSync(join(DATA, 'history.csv'), toCsv(['date', 'platform', 'account', 'followers', 'likes', 'posts'], history));
writeFileSync(join(DATA, 'status.json'), JSON.stringify({ at: new Date().toISOString(), date: today, problems }, null, 2));
log('Done.', problems.length ? 'Problems: ' + problems.join(' | ') : 'No problems.');
