'use strict';
// Stats page in the style of in-app insights screens. Reads data/accounts.csv, posts.csv, history.csv.
(() => {
  // ---------- helpers ----------
  const AR_M = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const AR_D = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const AR_DS = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
  const COLORS = ['#ff4d6d', '#22b8ff', '#ffb020', '#a855f7', '#10c98f', '#ff7a45', '#5b7cfa', '#f472b6'];
  const PLAT = {
    TikTok: { ar: 'تيك توك', icon: 'note', eng: true, link: (p) => `https://www.tiktok.com/@${enc(p.account)}/video/${enc(p.id)}`, open: 'افتح الفيديو على تيك توك' },
    Instagram: { ar: 'انستقرام', icon: 'camera', eng: true, link: (p) => `https://www.instagram.com/p/${enc(p.id)}/`, open: 'افتح المنشور على انستقرام' },
    Telegram: { ar: 'تيليجرام', icon: 'plane', eng: false, link: (p) => `https://t.me/${enc(p.account)}/${enc(p.id)}`, open: 'افتح المنشور على تيليجرام' },
  };
  const plat = (x) => PLAT[x] || { ar: x, icon: 'note', eng: true, link: () => '#', open: 'افتح' };
  const enc = encodeURIComponent;
  const NF = new Intl.NumberFormat('en-US');
  const fmt = (n) => (n == null || !isFinite(n)) ? '—' : NF.format(Math.round(n));
  const compact = (n) => {
    if (n == null || !isFinite(n)) return '—';
    const a = Math.abs(n);
    if (a >= 1e6) return +(n / 1e6).toFixed(1) + 'M';
    if (a >= 1e4) return +(n / 1e3).toFixed(1) + 'K';
    return fmt(n);
  };
  const pct = (v) => (v * 100).toFixed(Math.abs(v) < 0.1 ? 1 : 0) + '%';
  const D = (s) => new Date(s + 'T00:00:00Z');
  const iso = (d) => d.toISOString().slice(0, 10);
  const addDays = (s, k) => iso(new Date(D(s).getTime() + k * 864e5));
  const dayLabel = (s) => `${+s.slice(8, 10)} ${AR_M[+s.slice(5, 7) - 1]}`;
  const monthLabel = (s) => `${AR_M[+s.slice(5, 7) - 1]} ${s.slice(0, 4)}`;
  const sum = (ps, k) => ps.reduce((s, p) => s + (p[k] || 0), 0);
  const $ = (s) => document.querySelector(s);
  const handle = (a) => el('bdi', { dir: 'ltr' }, '@' + a);

  function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat(Infinity)) if (k != null && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
    return e;
  }
  const svgEl = (tag, attrs = {}) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };

  // fixed icon markup (no data inside)
  const ICON = {
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-9.3-9.2C1.5 7.5 3.6 4 7 4c2 0 3.3 1 5 3 1.7-2 3-3 5-3 3.4 0 5.5 3.5 4.3 6.8C19.5 15.4 12 20 12 20z"/></svg>',
    comment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5A8.5 8.5 0 1 1 21 11.5z"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M22 3 11 13"/><path d="M22 3 15 21l-4-8-8-4 19-6z"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    note: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 3h3a4 4 0 0 0 4 4v3a7 7 0 0 1-4-1.3V15a6 6 0 1 1-6-6v3.2A2.8 2.8 0 1 0 14 15V3z"/></svg>',
    plane: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 3.5 2.8 10.7c-1 .4-1 1.8.1 2.1l4.6 1.4 1.8 5.6c.3.9 1.4 1.1 2 .4l2.6-2.7 4.6 3.4c.7.5 1.7.1 1.9-.8L23 4.8c.2-1-.6-1.7-1.5-1.3zM9.5 14l8.3-7.4-6.6 8.6-.3 3.1L9.5 14z"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="5.5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg>',
  };
  const icon = (n, cls) => { const s = el('span', { class: 'ic' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true' }); s.innerHTML = ICON[n] || ''; return s; };

  // ---------- data ----------
  function parseCsv(text) {
    const lines = text.replace(/^﻿/, '').trim().split(/\r?\n/);
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
  const num = (v) => (v === '' || v == null || isNaN(+v)) ? null : +v;

  let DATA;
  const S = { acct: 'all', days: 30, sort: 'views', showAll: false, detail: null, post: null };

  async function load() {
    try {
      const [accounts, posts, history] = await Promise.all(['accounts', 'posts', 'history'].map((n) =>
        fetch(`data/${n}.csv?v=${Date.now()}`).then((r) => { if (!r.ok) throw new Error(n); return r.text(); }).then(parseCsv)));
      accounts.forEach((a, i) => { a.followers = num(a.followers); a.likes = num(a.likes); a.posts = num(a.posts); a.color = COLORS[i % COLORS.length]; });
      posts.forEach((p) => {
        for (const k of ['views', 'likes', 'comments', 'shares']) p[k] = num(p[k]);
        p.eng = plat(p.platform).eng ? (p.likes || 0) + (p.comments || 0) + (p.shares || 0) : null;
      });
      history.forEach((h) => { h.followers = num(h.followers); });
      const end = accounts.reduce((m, a) => (a.date > m ? a.date : m), '');
      const first = posts.reduce((m, p) => (p.date && p.date < m ? p.date : m), end);
      DATA = { accounts, posts, history, end, first, byId: Object.fromEntries(accounts.map((a) => [a.account, a])) };
      readHash();
      render();
    } catch (e) {
      console.error(e);
      $('#app').replaceChildren(el('p', { class: 'err' }, 'تعذّر تحميل البيانات. حدّث الصفحة بعد شوي.'));
    }
  }

  // ---------- state helpers ----------
  const PERIODS = [[7, 'آخر 7 أيام'], [30, 'آخر 30 يوم'], [90, 'آخر 90 يوم'], ['all', 'كل الفترة']];
  function readHash() {
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.get('a') && (h.get('a') === 'all' || DATA.byId[h.get('a')])) S.acct = h.get('a');
    const d = h.get('d'); if (d) S.days = d === 'all' ? 'all' : (PERIODS.some(([x]) => x === +d) ? +d : S.days);
  }
  const writeHash = () => history.replaceState(history.state, '', `#a=${enc(S.acct)}&d=${S.days}`);
  const curAccts = () => (S.acct === 'all' ? DATA.accounts.map((a) => a.account) : [S.acct]);
  const selAcct = () => (S.acct === 'all' ? null : DATA.byId[S.acct]);
  const accColor = () => (selAcct() ? selAcct().color : 'var(--acc)');
  function period() {
    const end = DATA.end;
    if (S.days === 'all') return { start: DATA.first, end, prevStart: null, prevEnd: null };
    const start = addDays(end, -(S.days - 1));
    return { start, end, prevStart: addDays(start, -S.days), prevEnd: addDays(start, -1) };
  }
  const postsIn = (a, b) => DATA.posts.filter((p) => (S.acct === 'all' || p.account === S.acct) && p.date >= a && p.date <= b);
  const engAvailable = () => (selAcct() ? plat(selAcct().platform).eng : DATA.accounts.some((a) => plat(a.platform).eng));

  const METRICS = {
    views: { label: 'المشاهدات', icon: 'eye', key: 'views', calc: (ps) => sum(ps, 'views'), desc: 'مجموع مشاهدات المنشورات اللي نزلت في هالفترة، محسوبة على يوم نشر كل منشور.' },
    engagement: { label: 'التفاعلات', icon: 'heart', key: 'eng', calc: (ps) => sum(ps, 'eng'), desc: 'الإعجابات والتعليقات والمشاركات على منشوراتك. تيليجرام ما يعطي هالأرقام، فهي محسوبة من باقي المنصات.' },
    followers: { label: 'المتابعون', icon: 'user', desc: 'صافي التغيّر في عدد المتابعين. العدد يتسجّل مرة كل يوم من 11 نوفمبر 2026.' },
    posts: { label: 'المحتوى المنشور', icon: 'grid', key: 'date', calc: (ps) => ps.length, desc: 'عدد المنشورات اللي نزلت في هالفترة.' },
  };
  const SORTS = [['views', 'المشاهدات', 'eye'], ['likes', 'الإعجابات', 'heart'], ['comments', 'التعليقات', 'comment'], ['shares', 'المشاركات', 'share'], ['rate', 'نسبة التفاعل', 'spark']];
  const postVal = (p, k) => (k === 'rate' ? (p.eng != null && p.views > 0 ? p.eng / p.views : null) : p[k]);
  const fmtVal = (k, v) => (k === 'rate' ? (v == null ? '—' : pct(v)) : compact(v));

  function metricNow(k) {
    const P = period(), m = METRICS[k];
    if (k === 'engagement' && !engAvailable()) return { cur: null, prev: null };
    return { cur: m.calc(postsIn(P.start, P.end)), prev: P.prevStart ? m.calc(postsIn(P.prevStart, P.prevEnd)) : null };
  }

  function followerSeries(accts, start, end) {
    const dates = [...new Set(DATA.history.map((h) => h.date))].sort();
    const byDate = new Map(); for (const h of DATA.history) (byDate.get(h.date) || byDate.set(h.date, []).get(h.date)).push(h);
    const last = {}, out = [];
    for (const d of dates) {
      for (const h of byDate.get(d)) if (accts.includes(h.account) && h.followers != null) last[h.account] = h.followers;
      if (d < start || d > end) continue;
      if (accts.every((a) => last[a] != null)) out.push({ date: d, label: dayLabel(d), value: accts.reduce((s, a) => s + last[a], 0) });
    }
    return out;
  }
  function followersDelta(P, accts = curAccts()) {
    const all = followerSeries(accts, '0000-00-00', P.end);
    if (!all.length) return { delta: null, series: [], current: null };
    const before = all.filter((p) => p.date < P.start), inP = all.filter((p) => p.date >= P.start);
    const base = before.length ? before[before.length - 1] : inP[0];
    const last = all[all.length - 1];
    return { delta: base ? last.value - base.value : null, since: before.length ? null : inP[0] && inP[0].date, series: inP, current: last.value };
  }

  // ---------- small pieces ----------
  function chip(cur, prev) {
    if (cur == null || prev == null || prev === 0) return null;
    const r = (cur - prev) / prev;
    const cls = Math.abs(r) < 0.005 ? 'flat' : r > 0 ? 'up' : 'down';
    return el('span', { class: 'chg ' + cls, title: 'مقارنة بالفترة اللي قبلها' }, (r > 0 ? '▲ ' : r < 0 ? '▼ ' : '') + pct(Math.abs(r)));
  }
  const deltaChip = (d) => (d == null ? null : el('span', { class: 'chg ' + (d > 0 ? 'up' : d < 0 ? 'down' : 'flat') }, (d > 0 ? '+' : '') + fmt(d)));

  function avatar(a, size = 68) {
    const ring = el('span', { class: 'ring', style: `width:${size}px;height:${size}px;--s:${size}px` });
    if (!a) {
      const cs = DATA.accounts.map((x) => x.color);
      ring.append(el('span', { class: 'av', style: `background:conic-gradient(${cs.map((c, i) => `${c} ${i / cs.length * 100}% ${(i + 1) / cs.length * 100}%`).join(',')})` }, String(DATA.accounts.length)));
    } else {
      ring.append(el('span', { class: 'av', style: `background:${a.color}` }, (a.name || a.account).trim().charAt(0).toUpperCase()));
      ring.append(el('span', { class: 'badge' }, icon(plat(a.platform).icon)));
    }
    return ring;
  }

  const LAST = {};
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function countUp(node, key, to, f = fmt) {
    if (to == null || !isFinite(to)) { node.textContent = '—'; return node; }
    const from = LAST[key] ?? 0; LAST[key] = to;
    if (RM || from === to) { node.textContent = f(to); return node; }
    const t0 = performance.now(), dur = 700;
    const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); node.textContent = f(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); };
    node.textContent = f(from); requestAnimationFrame(step);
    return node;
  }

  // time buckets: days up to 120 days, months beyond
  function buckets(start, end) {
    const span = (D(end) - D(start)) / 864e5 + 1;
    const list = [];
    if (span <= 120) { for (let d = start; d <= end; d = addDays(d, 1)) list.push({ key: d, label: dayLabel(d) }); return { unit: 'day', list }; }
    let m = start.slice(0, 7); const e = end.slice(0, 7);
    while (m <= e) { list.push({ key: m, label: monthLabel(m + '-01') }); const [y, mo] = m.split('-').map(Number); m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`; }
    return { unit: 'month', list };
  }
  function postSeries(calc, P) {
    const B = buckets(P.start, P.end), map = new Map();
    for (const p of postsIn(P.start, P.end)) { const k = B.unit === 'day' ? p.date : p.date.slice(0, 7); (map.get(k) || map.set(k, []).get(k)).push(p); }
    return B.list.map((b) => ({ label: b.label, value: calc(map.get(b.key) || []) }));
  }

  // interactive area chart: drag or hover to read each point
  function areaChart(points, { color = 'var(--acc)', zeroBase = true, unit = '' } = {}) {
    const n = points.length;
    if (!n) return el('p', { class: 'nodata' }, 'ما فيه بيانات في هالفترة.');
    const vals = points.map((p) => p.value ?? 0);
    let min = Math.min(...vals), max = Math.max(...vals);
    if (zeroBase) min = 0; else { const pad = (max - min) * 0.2 || 1; min -= pad; max += pad; }
    if (max === min) max = min + 1;
    const W = 1000, H = 300;
    const X = (i) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
    const Y = (v) => H - ((v - min) / (max - min)) * (H - 8) - 2;
    const id = 'g' + Math.random().toString(36).slice(2);
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', role: 'img', 'aria-label': 'رسم بياني' });
    const lg = svgEl('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 });
    lg.append(svgEl('stop', { offset: 0, 'stop-color': color, 'stop-opacity': 0.35 }), svgEl('stop', { offset: 1, 'stop-color': color, 'stop-opacity': 0 }));
    const defs = svgEl('defs'); defs.append(lg); svg.append(defs);
    for (const f of [0.25, 0.5, 0.75]) svg.append(svgEl('line', { x1: 0, x2: W, y1: H * f, y2: H * f, stroke: 'var(--line)', 'vector-effect': 'non-scaling-stroke', 'stroke-dasharray': '3 5' }));
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(vals[i]).toFixed(1)}`).join('');
    svg.append(svgEl('path', { d: `${line}L${X(n - 1)},${H}L${X(0)},${H}Z`, fill: `url(#${id})` }));
    svg.append(svgEl('path', { d: line, fill: 'none', stroke: color, 'stroke-width': 2.5, 'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    const vline = el('div', { class: 'vline', hidden: true });
    const dot = el('div', { class: 'dot', hidden: true, style: `background:${color}` });
    const tip = el('div', { class: 'tip', hidden: true });
    const wrap = el('div', { class: 'chart' }, svg, vline, dot, tip);
    const show = (i) => {
      const xp = X(i) / W * 100, yp = Y(vals[i]) / H * 100;
      vline.style.left = xp + '%'; dot.style.left = xp + '%'; dot.style.top = yp + '%';
      tip.style.left = `clamp(64px, ${xp}%, calc(100% - 64px))`;
      tip.replaceChildren(el('b', {}, fmt(vals[i]) + unit), points[i].label);
      vline.hidden = dot.hidden = tip.hidden = false;
    };
    const at = (e) => { const r = wrap.getBoundingClientRect(); show(Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (n - 1))); };
    wrap.addEventListener('pointermove', at);
    wrap.addEventListener('pointerdown', at);
    wrap.addEventListener('pointerleave', () => { vline.hidden = dot.hidden = tip.hidden = true; });
    const mid = n > 2 ? points[Math.floor((n - 1) / 2)].label : null;
    return el('div', { class: 'chartbox' }, wrap, el('div', { class: 'axis' }, el('span', {}, points[0].label), mid && el('span', {}, mid), n > 1 && el('span', {}, points[n - 1].label)));
  }

  // ---------- sections ----------
  const header = () => el('header', { class: 'top' }, el('h1', {}, 'الإحصائيات'), el('span', { class: 'mut' }, 'آخر تحديث ' + dayLabel(DATA.end)));

  function accountsRow() {
    const items = [['all', null], ...DATA.accounts.map((a) => [a.account, a])];
    return el('nav', { class: 'avs', 'aria-label': 'الحسابات' }, items.map(([id, a]) =>
      el('button', { class: 'av-btn', type: 'button', 'aria-pressed': String(S.acct === id), onclick: () => setAcct(id) },
        avatar(a), el('span', { class: 'av-cap' }, a ? '@' + a.account : 'الكل'))));
  }

  function periodBar() {
    const P = period();
    const y = P.start.slice(0, 4) !== P.end.slice(0, 4) ? ' ' + P.start.slice(0, 4) : '';
    return el('div', {},
      el('div', { class: 'chips', role: 'group', 'aria-label': 'الفترة' }, PERIODS.map(([d, l]) =>
        el('button', { class: 'chip', type: 'button', 'aria-pressed': String(S.days === d), onclick: () => { S.days = d; S.showAll = false; update(); } }, l))),
      el('div', { class: 'range' }, `${dayLabel(P.start)}${y} – ${dayLabel(P.end)} ${P.end.slice(0, 4)}`));
  }

  function profileCard() {
    const sel = selAcct(), list = sel ? [sel] : DATA.accounts;
    const tot = (k) => { const v = list.map((a) => a[k]).filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) : null; };
    const stat = (v, l) => el('div', {}, el('b', {}, compact(v)), el('span', { class: 'mut' }, l));
    const plats = [...new Set(DATA.accounts.map((a) => plat(a.platform).ar))].join(' و');
    return el('section', { class: 'card' },
      el('div', { class: 'prof' }, avatar(sel, 86),
        el('div', { class: 'pstats' }, stat(tot('posts'), 'منشورات'), stat(tot('followers'), 'متابعون'), stat(tot('likes'), 'إعجابات'))),
      el('div', { class: 'pname' }, el('b', {}, sel ? sel.name : 'كل الحسابات'),
        el('span', { class: 'mut' }, sel ? [handle(sel.account), ' · ' + plat(sel.platform).ar] : `${list.length} حسابات · ${plats}`)),
      sel && /^https:\/\//.test(sel.link) ? el('a', { class: 'btn ghost', href: sel.link, target: '_blank', rel: 'noopener' }, 'فتح الحساب') : null);
  }

  function overview() {
    const P = period();
    const rows = ['views', 'engagement', 'followers', 'posts'].map((k) => {
      const m = METRICS[k]; let val, c = null;
      if (k === 'followers') { const f = followersDelta(P); val = f.delta == null ? '—' : (f.delta > 0 ? '+' : '') + fmt(f.delta); }
      else { const r = metricNow(k); val = fmt(r.cur); c = chip(r.cur, r.prev); }
      return el('button', { class: 'row', type: 'button', onclick: () => openDetail(k) },
        icon(m.icon, 'ri'), el('span', { class: 'lbl' }, m.label), c, el('span', { class: 'val' }, val), icon('chev', 'chev'));
    });
    return el('section', { class: 'card' }, el('h2', {}, 'نظرة عامة'),
      el('p', { class: 'sub' }, P.prevStart ? `مقارنة بالـ ${S.days} يوم اللي قبلها. اضغط أي سطر للتفاصيل.` : 'من أول منشور مسجّل. اضغط أي سطر للتفاصيل.'), rows);
  }

  function viewsCard() {
    const P = period(), r = metricNow('views');
    return el('section', { class: 'card' },
      el('div', { class: 'hrow' }, el('h2', {}, 'المشاهدات'), el('button', { class: 'link', type: 'button', onclick: () => openDetail('views') }, 'التفاصيل')),
      el('div', { class: 'hero' }, countUp(el('div', { class: 'big' }), 'views', r.cur), chip(r.cur, r.prev)),
      areaChart(postSeries(METRICS.views.calc, P), { color: accColor() }),
      el('p', { class: 'sub', style: 'margin-top:12px' }, 'حسب يوم النشر. مرّر إصبعك أو الماوس على الرسم عشان تشوف كل يوم.'));
  }

  function tile(p, i, k) {
    const a = DATA.byId[p.account], c = a ? a.color : '#555', v = postVal(p, k), s = SORTS.find((x) => x[0] === k);
    return el('button', { class: 'tile', type: 'button', style: `background:linear-gradient(165deg, ${c}, color-mix(in srgb, ${c} 38%, #000));animation-delay:${Math.min(i, 12) * 25}ms`, onclick: () => openPost(p), 'aria-label': `${p.title || 'منشور'}: ${fmtVal(k, v)} ${s[1]}` },
      el('span', { class: 'rk' }, String(i + 1)), el('span', { class: 'pf' }, icon(plat(p.platform).icon)),
      el('span', { class: 't' }, p.title || (p.platform === 'Telegram' ? 'منشور تيليجرام' : 'فيديو')),
      el('span', { class: 'm' }, icon(s[2]), fmtVal(k, v)));
  }

  function contentCard() {
    const P = period();
    const sorts = engAvailable() ? SORTS : SORTS.slice(0, 1);
    if (!sorts.some((s) => s[0] === S.sort)) S.sort = 'views';
    const k = S.sort;
    const ps = postsIn(P.start, P.end).filter((p) => postVal(p, k) != null).sort((a, b) => postVal(b, k) - postVal(a, k));
    const shown = S.showAll ? ps : ps.slice(0, 9);
    return el('section', { class: 'card', id: 'content' },
      el('h2', {}, 'أفضل المحتوى'),
      el('p', { class: 'sub' }, `${ps.length} منشور في هالفترة، مرتبة حسب ${sorts.find((s) => s[0] === k)[1]}. اضغط أي منشور لتفاصيله.`),
      el('div', { class: 'chips inset', role: 'group', 'aria-label': 'ترتيب حسب' }, sorts.map(([key, l]) =>
        el('button', { class: 'chip', type: 'button', 'aria-pressed': String(k === key), onclick: () => { S.sort = key; update(); } }, l))),
      ps.length ? el('div', { class: 'grid' }, shown.map((p, i) => tile(p, i, k))) : el('p', { class: 'empty' }, 'ما فيه منشورات في هالفترة.'),
      ps.length > 9 ? el('button', { class: 'more', type: 'button', onclick: () => { S.showAll = !S.showAll; update(); } }, S.showAll ? 'عرض أقل' : `عرض الكل (${ps.length})`) : null);
  }

  function followersCard() {
    const P = period(), f = followersDelta(P);
    return el('section', { class: 'card' },
      el('div', { class: 'hrow' }, el('h2', {}, 'المتابعون'), el('button', { class: 'link', type: 'button', onclick: () => openDetail('followers') }, 'التفاصيل')),
      el('div', { class: 'hero' }, countUp(el('div', { class: 'big' }), 'fol', f.current), deltaChip(f.delta), el('span', { class: 'mut' }, f.since ? 'من ' + dayLabel(f.since) : 'في هالفترة')),
      f.series.length > 1 ? areaChart(f.series, { color: accColor(), zeroBase: false }) : el('p', { class: 'nodata' }, 'الرسم يبان بعد يومين من التسجيل.'));
  }

  function weekdayCard() {
    const P = period();
    let ps = postsIn(P.start, P.end).filter((p) => p.views != null), note = '';
    if (ps.length < 7) { ps = postsIn('0000', '9999').filter((p) => p.views != null); note = ' (من كل الفترة، لأن منشورات هالفترة قليلة)'; }
    const g = Array.from({ length: 7 }, () => ({ n: 0, v: 0 }));
    for (const p of ps) { const d = D(p.date).getUTCDay(); g[d].n++; g[d].v += p.views; }
    const avg = g.map((x) => (x.n ? x.v / x.n : 0));
    const max = Math.max(...avg, 1), best = avg.indexOf(Math.max(...avg));
    const info = el('p', { class: 'info' });
    const bars = el('div', { class: 'bars' }, g.map((x, i) =>
      el('button', { class: 'bar' + (i === best && x.n ? ' best' : ''), type: 'button', onclick: () => setInfo(i), onpointerenter: () => setInfo(i), 'aria-label': AR_D[i] },
        el('b', {}, x.n ? compact(avg[i]) : ''), el('span', { class: 'col' }, el('i', { style: `height:${Math.max(3, avg[i] / max * 100)}%` })), el('span', {}, AR_DS[i]))));
    function setInfo(i) {
      info.replaceChildren(el('b', {}, AR_D[i]), g[i].n ? `: ${g[i].n} منشور، متوسط ${fmt(avg[i])} مشاهدة للمنشور` : ': ما نزل فيه شي');
      bars.querySelectorAll('.bar').forEach((b, j) => b.classList.toggle('sel', j === i));
    }
    if (ps.length) setInfo(best);
    return el('section', { class: 'card' }, el('h2', {}, 'أفضل أيام النشر'),
      el('p', { class: 'sub' }, 'متوسط مشاهدات المنشور حسب اليوم اللي نزل فيه' + note), ps.length ? [bars, info] : el('p', { class: 'nodata' }, 'ما فيه منشورات.'));
  }

  function accRow(a, top, share, extra) {
    return el('button', { class: 'acc-row', type: 'button', onclick: () => { setAcct(a.account); (S.detail ? $('.page') : window).scrollTo({ top: 0, behavior: 'smooth' }); } },
      avatar(a, 44),
      el('span', { class: 'acc-mid' },
        el('span', { class: 'acc-top' }, el('span', {}, handle(a.account)), top),
        share != null ? el('span', { class: 'hbar' }, el('i', { style: `width:${(share * 100).toFixed(1)}%;background:${a.color}` })) : null,
        extra));
  }

  function byAccountCard() {
    const P = period();
    const vals = DATA.accounts.map((a) => ({ a, v: sum(DATA.posts.filter((p) => p.account === a.account && p.date >= P.start && p.date <= P.end), 'views') }));
    const tot = vals.reduce((s, x) => s + x.v, 0) || 1;
    vals.sort((x, y) => y.v - x.v);
    return el('section', { class: 'card' }, el('h2', {}, 'المشاهدات حسب الحساب'),
      el('p', { class: 'sub' }, 'اضغط أي حساب عشان تشوف إحصائياته بروحه.'),
      vals.map(({ a, v }) => accRow(a, el('b', {}, fmt(v)), v / tot, el('span', { class: 'mut' }, pct(v / tot) + ' من المشاهدات'))));
  }

  function postRow(p, k) {
    const a = DATA.byId[p.account], c = a ? a.color : '#555';
    const v = k === 'date' ? dayLabel(p.date) : fmt(p[k]);
    return el('button', { class: 'prow', type: 'button', onclick: () => openPost(p) },
      el('span', { class: 'thumb', style: `background:linear-gradient(165deg, ${c}, color-mix(in srgb, ${c} 38%, #000))` }, icon(plat(p.platform).icon)),
      el('span', { class: 'pmid' }, el('span', { class: 'tt' }, p.title || 'بدون عنوان'), el('span', { class: 'mut' }, handle(p.account), ' · ' + dayLabel(p.date))),
      el('span', { class: 'pval' }, v));
  }

  // ---------- detail page ----------
  function detailPage(k) {
    const m = METRICS[k], P = period();
    let hero, chart, breakdown = null, top = [];
    if (k === 'followers') {
      const f = followersDelta(P);
      hero = el('div', { class: 'hero' }, el('div', { class: 'big' }, fmt(f.current)), deltaChip(f.delta), el('span', { class: 'mut' }, f.since ? 'من ' + dayLabel(f.since) : 'في هالفترة'));
      chart = f.series.length > 1 ? areaChart(f.series, { color: accColor(), zeroBase: false }) : el('p', { class: 'nodata' }, 'الرسم يبان بعد يومين من التسجيل.');
      if (S.acct === 'all') breakdown = DATA.accounts.map((a) => { const x = followersDelta(P, [a.account]); return accRow(a, el('b', {}, fmt(x.current)), null, deltaChip(x.delta)); });
    } else {
      const r = metricNow(k);
      if (r.cur == null) {
        hero = el('div', { class: 'hero' }, el('div', { class: 'big' }, '—'));
        chart = el('p', { class: 'nodata' }, 'هالمنصة ما تعطي أرقام التفاعل.');
      } else {
        hero = el('div', { class: 'hero' }, el('div', { class: 'big' }, fmt(r.cur)), chip(r.cur, r.prev), r.prev ? el('span', { class: 'mut' }, `مقابل ${fmt(r.prev)} في الفترة اللي قبلها`) : null);
        chart = areaChart(postSeries(m.calc, P), { color: accColor() });
      }
      if (S.acct === 'all') {
        const vals = DATA.accounts.filter((a) => k !== 'engagement' || plat(a.platform).eng)
          .map((a) => ({ a, v: m.calc(DATA.posts.filter((p) => p.account === a.account && p.date >= P.start && p.date <= P.end)) }));
        const tot = vals.reduce((s, x) => s + x.v, 0) || 1;
        breakdown = vals.sort((x, y) => y.v - x.v).map(({ a, v }) => accRow(a, el('b', {}, fmt(v)), v / tot, null));
      }
      top = postsIn(P.start, P.end).filter((p) => p[m.key] != null).sort((a, b) => (b[m.key] > a[m.key] ? 1 : b[m.key] < a[m.key] ? -1 : 0)).slice(0, 6)
        .map((p) => postRow(p, m.key));
    }
    return el('div', { class: 'page', role: 'dialog', 'aria-modal': 'true', 'aria-label': m.label },
      el('div', { class: 'inner' },
        el('header', { class: 'top' }, el('button', { class: 'back', type: 'button', 'aria-label': 'رجوع', onclick: () => history.back() }, icon('back')), el('h1', {}, m.label),
          el('span', { class: 'mut' }, selAcct() ? handle(S.acct) : 'كل الحسابات')),
        accountsRow(), periodBar(),
        el('section', { class: 'card' }, hero, chart, el('p', { class: 'sub', style: 'margin-top:12px' }, m.desc)),
        breakdown ? el('section', { class: 'card' }, el('h2', {}, 'حسب الحساب'), el('p', { class: 'sub' }, 'اضغط أي حساب عشان تشوفه بروحه.'), breakdown) : null,
        top.length ? el('section', { class: 'card' }, el('h2', {}, k === 'posts' ? 'آخر المنشورات' : 'أعلى المنشورات'), top) : null));
  }

  // ---------- post sheet ----------
  function postSheet(p) {
    const a = DATA.byId[p.account], pl = plat(p.platform);
    const accPosts = DATA.posts.filter((x) => x.account === p.account && x.views != null);
    const avg = accPosts.length ? sum(accPosts, 'views') / accPosts.length : null;
    const rel = avg && p.views != null ? p.views / avg - 1 : null;
    const rate = postVal(p, 'rate');
    const stat = (ic, l, v) => el('div', { class: 'stat' }, icon(ic), el('b', {}, v), el('span', { class: 'mut' }, l));
    const link = pl.link(p);
    return [
      el('div', { class: 'backdrop', onclick: () => history.back() }),
      el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'تفاصيل المنشور' },
        el('div', { class: 'handle' }),
        el('div', { class: 'sh-head' }, avatar(a, 46), el('div', {}, el('b', {}, handle(p.account)), el('div', { class: 'mut' }, `${dayLabel(p.date)} ${p.date.slice(0, 4)} · ${AR_D[D(p.date).getUTCDay()]} · ${pl.ar}`))),
        el('p', { class: 'sh-title' }, p.title || 'بدون عنوان'),
        rel != null ? el('div', { class: 'cmp ' + (rel >= 0 ? 'up' : 'down') }, rel >= 0 ? `أعلى من متوسط الحساب بـ ${pct(rel)}` : `أقل من متوسط الحساب بـ ${pct(-rel)}`,
          el('span', { class: 'mut' }, ` (المتوسط ${fmt(avg)} مشاهدة)`)) : null,
        el('div', { class: 'stats' },
          stat('eye', 'المشاهدات', fmt(p.views)),
          pl.eng ? stat('heart', 'الإعجابات', fmt(p.likes)) : null,
          pl.eng ? stat('comment', 'التعليقات', fmt(p.comments)) : null,
          pl.eng && p.shares != null ? stat('share', 'المشاركات', fmt(p.shares)) : null,
          rate != null ? stat('spark', 'نسبة التفاعل', pct(rate)) : null),
        /^https:\/\//.test(link) ? el('a', { class: 'btn', href: link, target: '_blank', rel: 'noopener' }, pl.open) : null),
    ];
  }

  // ---------- rendering + navigation ----------
  function render() {
    $('#app').replaceChildren(header(), accountsRow(), periodBar(), profileCard(), overview(), viewsCard(), contentCard(), followersCard(), weekdayCard(), S.acct === 'all' ? byAccountCard() : null);
    writeHash();
  }
  function lockScroll() { document.documentElement.style.overflow = S.detail || S.post ? 'hidden' : ''; }
  function findPost() { if (!S.post) return null; const [acc, id] = S.post.split('|'); return DATA.posts.find((x) => x.account === acc && x.id === id); }
  function renderOverlay(anim) {
    const o = $('#overlay');
    const y = !anim && $('.page') ? $('.page').scrollTop : 0;
    o.classList.toggle('noanim', !anim);
    o.replaceChildren();
    if (S.detail) { o.append(detailPage(S.detail)); if (y) $('.page').scrollTop = y; }
    const p = findPost(); if (p) o.append(...postSheet(p));
    lockScroll();
  }
  function update() { render(); if (S.detail || S.post) renderOverlay(false); }
  function setAcct(id) { S.acct = id; S.showAll = false; update(); }
  function openDetail(k) { S.detail = k; history.pushState({ detail: k }, '', location.hash); renderOverlay(true); }
  function openPost(p) {
    S.post = p.account + '|' + p.id;
    history.pushState({ detail: S.detail, post: S.post }, '', location.hash);
    $('#overlay').append(...postSheet(p)); lockScroll();
  }
  window.addEventListener('popstate', (e) => {
    const st = e.state || {}, hadDetail = S.detail;
    S.detail = st.detail || null; S.post = st.post || null;
    if (S.detail !== hadDetail) renderOverlay(true);
    else { document.querySelectorAll('#overlay .backdrop, #overlay .sheet').forEach((n) => n.remove()); const p = findPost(); if (p) $('#overlay').append(...postSheet(p)); }
    lockScroll();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && (S.detail || S.post)) history.back(); });
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => DATA && update(), 200); });

  load();
})();
