const $ = id => document.getElementById(id);
const N = 1200; // divisible por 2, 3 y 6: las transiciones de V_in caen justo en la malla
const P = {}, S = {};
let tSim = 0, playing = true, flow = 0;

function vinAt(t) {
  if (P.mode === 'carga') return P.Vdd;
  if (P.mode === 'descarga') return 0;
  if (P.mode === 'pulso') return t < P.w ? P.Vdd : 0;
  return Math.floor(t / P.w + 1e-9) % 2 === 0 ? P.Vdd : 0;
}
const fmt = (x, u) => (Math.abs(x) >= 100 ? x.toFixed(0) : Math.abs(x) >= 10 ? x.toFixed(1) : x.toFixed(2)) + ' ' + u;
const interp = (a, t) => { const f = Math.min(Math.max(t / S.win * N, 0), N), i = Math.min(Math.floor(f), N - 1); return a[i] + (a[i + 1] - a[i]) * (f - i); };

function build() {
  P.mode = $('mode').value;
  for (const k of ['R', 'C', 'Vdd', 'w', 'h', 'speed']) P[k] = +$(k).value;
  P.euler = $('euler').checked;
  const tau = P.tau = P.R * P.C; // kΩ·pF = ns
  const win = S.win = /carga/.test(P.mode) ? 6 * tau : P.mode === 'pulso' ? 2 * P.w : 6 * P.w;
  const dt = win / N, a = Math.exp(-dt / tau);
  let V = P.mode === 'descarga' ? P.Vdd : 0;
  S.v = [V]; S.vin = [];
  for (let k = 0; k < N; k++) { const u = vinAt(k * dt); S.vin.push(u); V = u + (V - u) * a; S.v.push(V); } // exacta si Vin es constante en cada paso
  S.vin.push(S.vin[N - 1]);
  // Euler
  const h = Math.max(P.h * tau, win / 20000);
  let t = 0; V = S.v[0]; S.eu = [[0, V]]; S.err = 0;
  while (t < win - 1e-12) { V += h * (vinAt(t) - V) / tau; t += h; S.eu.push([t, V]); if (t <= win) S.err = Math.max(S.err, Math.abs(V - interp(S.v, t))); }
  $('Rv').textContent = P.R.toFixed(1) + ' kΩ'; $('Cv').textContent = P.C + ' pF';
  $('Vddv').textContent = P.Vdd.toFixed(1) + ' V'; $('wv').textContent = P.w + ' ns';
  $('hv').textContent = P.h.toFixed(2) + ' τ' + (P.h > 2 ? ' (inestable)' : ''); $('sv').textContent = P.speed + '×';
  $('w').disabled = /carga/.test(P.mode);
  $('lgE').style.display = P.euler ? '' : 'none';
  $('mTau').textContent = fmt(tau, 'ns'); $('mPd').textContent = fmt(tau * Math.LN2, 'ns'); $('mTr').textContent = fmt(tau * Math.log(9), 'ns');
  $('mErr').textContent = P.euler ? S.err.toFixed(3) + ' V' : '—';
  const sq = P.mode === 'pulso' || P.mode === 'cuadrada';
  $('mP').textContent = P.mode === 'cuadrada' ? fmt(P.C * P.Vdd ** 2 / (2 * P.w), 'mW') : '—'; // pF·V²/ns = mW
  const d = $('diag');
  if (!sq) { d.textContent = 'Con 5τ el nodo alcanza el 99,3 % del valor final; la ventana mostrada es de 6τ.'; d.style.color = 'var(--muted)'; }
  else if (P.w >= Math.LN10 * tau) { d.textContent = `✔ w = ${P.w} ns ≥ 2,3τ = ${(Math.LN10 * tau).toFixed(1)} ns: la señal alcanza el 90 % y el bus funciona.`; d.style.color = 'var(--ok)'; }
  else { d.textContent = `✘ w = ${P.w} ns < 2,3τ = ${(Math.LN10 * tau).toFixed(1)} ns: el nodo no llega a un nivel lógico válido (error de señal).`; d.style.color = 'var(--bad)'; }
  tSim = Math.min(tSim, win);
}

function draw() {
  const cv = $('plot'), dpr = devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext('2d'), css = getComputedStyle(document.documentElement), c = n => css.getPropertyValue(n).trim();
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const m = { l: 46, r: 12, t: 10, b: 32 }, win = S.win, vmax = P.Vdd * 1.2;
  const X = t => m.l + t / win * (W - m.l - m.r), Y = v => H - m.b - v / vmax * (H - m.t - m.b);
  g.font = '11px system-ui'; g.lineWidth = 1;
  for (let i = 0; i <= 5; i++) { // eje t
    const t = win * i / 5, x = X(t);
    g.strokeStyle = c('--grid'); g.beginPath(); g.moveTo(x, m.t); g.lineTo(x, H - m.b); g.stroke();
    g.fillStyle = c('--muted'); g.textAlign = 'center'; g.fillText(t >= 100 ? t.toFixed(0) : t.toFixed(1), x, H - m.b + 14);
  }
  g.textAlign = 'right'; g.fillText('t (ns)', W - m.r, H - 4);
  for (let i = 0; i <= 4; i++) { // eje V
    const v = P.Vdd * i / 4, y = Y(v);
    g.strokeStyle = c('--grid'); g.beginPath(); g.moveTo(m.l, y); g.lineTo(W - m.r, y); g.stroke();
    g.fillStyle = c('--muted'); g.textAlign = 'right'; g.fillText(v.toFixed(1) + ' V', m.l - 6, y + 4);
  }
  g.setLineDash([2, 4]); g.strokeStyle = c('--warn');
  for (const f of [.3, .7]) { g.beginPath(); g.moveTo(m.l, Y(f * P.Vdd)); g.lineTo(W - m.r, Y(f * P.Vdd)); g.stroke(); }
  g.setLineDash([]);
  g.save(); g.beginPath(); g.rect(m.l, m.t, W - m.l - m.r, H - m.t - m.b); g.clip();
  g.lineWidth = 1.5; g.strokeStyle = c('--vin'); g.setLineDash([6, 4]); g.beginPath(); // Vin
  for (let k = 0; k <= N; k++) { const x = X(k * win / N), y = Y(S.vin[k]); k ? (g.lineTo(x, Y(S.vin[k - 1])), g.lineTo(x, y)) : g.moveTo(x, y); }
  g.stroke(); g.setLineDash([]);
  if (P.euler) {
    g.strokeStyle = c('--euler'); g.lineWidth = 1.8; g.setLineDash([2, 3]); g.beginPath();
    let first = true;
    for (const [t, v] of S.eu) { if (t > tSim) break; first ? g.moveTo(X(t), Y(v)) : g.lineTo(X(t), Y(v)); first = false; }
    g.stroke(); g.setLineDash([]);
  }
  const kEnd = tSim / win * N;
  g.strokeStyle = c('--accent'); g.lineWidth = 2.5; g.beginPath();
  for (let k = 0; k <= Math.floor(kEnd); k++) k ? g.lineTo(X(k * win / N), Y(S.v[k])) : g.moveTo(X(0), Y(S.v[0]));
  g.lineTo(X(tSim), Y(interp(S.v, tSim))); g.stroke();
  g.restore();
  g.fillStyle = c('--accent'); g.beginPath(); g.arc(X(tSim), Y(interp(S.v, tSim)), 5, 0, 7); g.fill();
}

function update(dt) {
  const v = interp(S.v, tSim), u = S.vin[Math.min(Math.floor(tSim / S.win * N), N)], i = (u - v) / P.R; // V/kΩ = mA
  $('mT').textContent = fmt(tSim, 'ns'); $('mV').textContent = v.toFixed(2) + ' V'; $('mI').textContent = fmt(i, 'mA');
  const r = v / P.Vdd, L = $('mLog');
  L.innerHTML = r >= .7 ? '<span class="badge b1">1</span>' : r <= .3 ? '<span class="badge b0">0</span>' : '<span class="badge bx">indefinido</span>';
  $('tV').textContent = 'V = ' + v.toFixed(2) + ' V'; $('tVin').textContent = u.toFixed(1) + ' V';
  $('capFill').setAttribute('opacity', (0.15 + 0.6 * r).toFixed(2));
  flow -= dt * 90 * (u - v) / P.Vdd; // puntos avanzan según corriente y su signo
  $('f1').style.strokeDashoffset = $('f2').style.strokeDashoffset = flow;
  $('scrub').value = tSim / S.win * 1000;
}

let last = 0;
function frame(ts) {
  const dt = Math.min((ts - last) / 1000, .1); last = ts;
  if (playing) { tSim += dt * S.win / 8 * P.speed; if (tSim >= S.win) tSim = 0; }
  draw(); update(dt); requestAnimationFrame(frame);
}

for (const id of ['mode', 'R', 'C', 'Vdd', 'w', 'h', 'speed', 'euler']) $(id).addEventListener('input', build);
$('scrub').addEventListener('input', e => { tSim = e.target.value / 1000 * S.win; });
$('play').onclick = () => { playing = !playing; $('play').textContent = playing ? 'Pausa' : 'Reanudar'; };
$('reset').onclick = () => { tSim = 0; };
build(); requestAnimationFrame(frame);
