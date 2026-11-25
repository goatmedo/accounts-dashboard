// Small stand-in for the claude.ai dashboard runtime, so index.html works as a plain web page.
// Loads data/<name>.csv, runs the page's dash.calc() tables, and redraws every [data-draw] element.
(function () {
  const draws = new Map();
  const calcs = new Map();
  const store = {};
  const onData = [];
  const get = (n) => store[n] || { status: 'loading', data: null };

  window.dash = {
    colors: ['#1f9e89', '#e0663a', '#3b82f6'],
    data: get,
    calc(name, def) { calcs.set(name, def); },
    onData(cb) { onData.push(cb); },
    draw(name, fn) {
      if (fn) draws.set(name, fn);
      const f = draws.get(name);
      if (!f) return;
      document.querySelectorAll('[data-draw="' + name + '"]').forEach((el) => {
        try { f(el); } catch (e) { console.error('draw ' + name, e); }
      });
    },
  };
  const drawAll = () => { for (const n of draws.keys()) dash.draw(n); };

  async function load() {
    const files = ['accounts', 'posts', 'history'];
    await Promise.all(files.map(async (n) => {
      try { store[n] = { status: 'ok', data: await d3.csv('data/' + n + '.csv?v=' + Date.now()) }; }
      catch (e) { console.error(n, e); store[n] = { status: 'error', data: null }; }
    }));
    for (const [n, def] of calcs) {
      const ins = def.inputs.map(get);
      store[n] = ins.every((i) => i.status === 'ok') ? { status: 'ok', data: def.fn(...ins.map((i) => i.data)) } : { status: 'error', data: null };
    }
    onData.forEach((cb) => cb());
    drawAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(drawAll, 150); });
})();
