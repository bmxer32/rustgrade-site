/* ============================================================
   rustgrade.pro — витрина
   Колесо повторяет логику приложения: шанс = ставка / цель × 100
   с потолком 75 %, прокрутка идёт по той же кривой замедления.
   ============================================================ */
(() => {
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const calm = matchMedia('(prefers-reduced-motion: reduce)');

/* ─────────── формат чисел, как в приложении ─────────── */
const rub = n => n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽';
const pct = n => n.toFixed(2).replace('.', ',') + '%';

/* ─────────── каталог демо ─────────── */
const STAKE = { name: 'Hunter SMG', price: 145.43 };
const MAX_CHANCE = 75;

const TARGETS = [
  { slug: 'aircraft-parts-ak47',  name: 'Aircraft Parts AK47', price: 151.19,     tier: '#467edf' },
  { slug: 'redemption-revolver',  name: 'Redemption Revolver', price: 336.06,     tier: '#ae6eee' },
  { slug: 'comics-jackhammer',    name: 'Comics Jackhammer',   price: 580.10,     tier: '#d2290f' },
  { slug: 'after-death-ar',       name: 'After Death AR',      price: 5615.26,    tier: '#ffdd59' },
  { slug: 'alien-relic-smg',      name: 'Alien Relic SMG',     price: 144633.58,  tier: '#ffdd59' },
];

const chanceOf = t => Math.min((STAKE.price / t.price) * 100, MAX_CHANCE);

const category = c => c >= 70 ? 'высокий шанс'
                    : c >= 40 ? 'средний шанс'
                    : c >= 15 ? 'низкий шанс'
                    : 'экстремальный шанс';

const chanceColor = c => c >= 70 ? '#84b030' : c >= 40 ? '#ffe32c' : '#fa3c1f';

/* ─────────── узлы ─────────── */
const wheel   = $('#wheel');
const pin     = $('#pin');
const pctEl   = $('#pct');
const catEl   = $('#cat');
const dstImg  = $('#dst-img');
const dstName = $('#dst-name');
const dstCost = $('#dst-price');
const spinBtn = $('#spin');
const verdict = $('#verdict');
const tally   = $('#tally');
const row     = $('#targets');
const alt     = $('#wheel-alt');

if (!wheel) return;

let current = TARGETS[2];      // Comics Jackhammer — 25,07 %, как на промо
let rest    = 0;               // угол покоя стрелки, рад
let busy    = false;
let spins   = 0, wins = 0;

/* ─────────── карточки выбора цели ─────────── */
row.innerHTML = TARGETS.map((t, i) => `
  <label class="chip">
    <input type="radio" name="target" value="${i}"${t === current ? ' checked' : ''}>
    <span class="chip__box">
      <img src="assets/items/${t.slug}.webp" alt="${t.name}" loading="lazy" decoding="async">
      <span class="chip__pct" style="color:${chanceColor(chanceOf(t))}">${pct(chanceOf(t))}</span>
      <span class="chip__price">${rub(t.price)}</span>
    </span>
  </label>`).join('');

row.addEventListener('change', e => {
  if (busy || !e.target.name) return;
  current = TARGETS[+e.target.value];
  render();
  verdict.className = 'rig__hint';
  verdict.textContent = 'Демо на настоящем каталоге. Прогресс никуда не сохраняется.';
});

/* ─────────── отрисовка шанса ─────────── */

/* Дуга догоняет новое значение за 450 мс, как в приложении, а не прыгает. */
let sweepNow = 0, sweepJob = 0;
function sweepTo(deg, ms = 450) {
  cancelAnimationFrame(sweepJob);
  if (calm.matches || ms === 0) {
    sweepNow = deg;
    wheel.style.setProperty('--sweep', deg.toFixed(3) + 'deg');
    return;
  }
  const from = sweepNow, t0 = performance.now();
  sweepJob = requestAnimationFrame(function step(now) {
    const t = Math.min((now - t0) / ms, 1);
    const e = 1 - Math.pow(1 - t, 3);           // easeOutCubic
    sweepNow = from + (deg - from) * e;
    wheel.style.setProperty('--sweep', sweepNow.toFixed(3) + 'deg');
    if (t < 1) sweepJob = requestAnimationFrame(step);
  });
}

function render(animate = true) {
  const c = chanceOf(current);
  sweepTo(c * 3.6, animate ? 450 : 0);
  pctEl.textContent = pct(c);
  pctEl.style.color = chanceColor(c);
  catEl.textContent = category(c);
  dstImg.src = `assets/items/${current.slug}.webp`;
  dstName.textContent = current.name;
  dstName.style.color = current.tier;
  dstCost.textContent = rub(current.price);
  alt.textContent = `Колесо апгрейда, шанс ${pct(c)}, цель ${current.name}`;
}

/* ─────────── кривая прокрутки ───────────
   v(t) = разгон(t) · [ (1−t)^fastDecay + slow · (1−t)^slowDecay ]
   Короткий рывок плюс длинный хвост: одной степенью так не выйдет. */
function spinCurve(fastDecay, slowDecay, slow) {
  const N = 512, path = new Float64Array(N + 1), sp = new Float64Array(N + 1);
  const smoother = x => { const t = Math.min(Math.max(x, 0), 1); return t * t * t * (t * (t * 6 - 15) + 10); };
  for (let i = 0; i <= N; i++) {
    const t = i / N, left = 1 - t;
    sp[i] = smoother(t / 0.04) * (Math.pow(left, fastDecay) + slow * Math.pow(left, slowDecay));
  }
  let total = 0;
  for (let i = 1; i <= N; i++) { total += (sp[i - 1] + sp[i]) / 2; path[i] = total; }
  if (total > 0) for (let i = 0; i <= N; i++) path[i] /= total;
  path[N] = 1;
  return t => {
    const x = Math.min(Math.max(t, 0), 1) * N, i = Math.min(Math.floor(x), N - 1);
    return path[i] + (path[i + 1] - path[i]) * (x - i);
  };
}

const between = (a, b) => a + Math.random() * (b - a);

/* Куда встать при выигрыше: в пятой части случаев — у самой границы зоны. */
function winAngle(half) {
  const limit = Math.max(0, half - Math.min(0.02, half * 0.2));
  if (limit <= 0) return 0;
  const side = Math.random() < 0.5 ? 1 : -1;
  return Math.random() < 0.2
    ? side * between(Math.max(0, limit - 0.25), limit)
    : between(-limit, limit);
}

/* Куда встать при промахе: распределение смещено к дуге, чтобы промах
   читался как «чуть не хватило», а не как случайная точка наверху. */
function loseAngle(half) {
  const loseSweep = 2 * Math.PI - 2 * half;
  const near = half + Math.min(0.02, loseSweep * 0.2);
  const far = Math.PI;
  if (near >= far) return near;
  const side = Math.random() < 0.5 ? 1 : -1;
  const roll = Math.random();
  const halfCircle = Math.max(near, Math.PI / 2);
  if (roll < 0.2) return side * between(near, Math.min(near + 0.30, far));
  if (roll < 0.65 && halfCircle > near) return side * between(Math.min(near + 0.30, halfCircle), halfCircle);
  return side * between(near, far);
}

/* ─────────── прокрутка ─────────── */
spinBtn.addEventListener('click', () => {
  if (busy) return;
  const chance = chanceOf(current);
  const win = Math.random() * 100 < chance;
  const half = Math.PI * (chance / 100);

  let target = (win ? winAngle(half) : loseAngle(half)) % (2 * Math.PI);
  if (target < 0) target += 2 * Math.PI;
  let delta = target - rest;
  if (delta < 0) delta += 2 * Math.PI;

  const turns = Math.min(7, Math.max(4, Math.round(5.5 - delta / (2 * Math.PI))));
  const total = turns * 2 * Math.PI + delta;

  busy = true;
  spinBtn.disabled = true;
  verdict.className = 'rig__hint';
  verdict.textContent = 'Крутится…';

  if (calm.matches) { rest = target; pin.style.transform = `rotate(${target * 180 / Math.PI}deg)`; finish(win); return; }

  const curve = spinCurve(5.3 + Math.random() * 0.4, 1.30 + Math.random() * 0.10, 0.40 + Math.random() * 0.05);
  const dur = 3400, t0 = performance.now(), from = rest;

  requestAnimationFrame(function step(now) {
    const t = Math.min((now - t0) / dur, 1);
    const a = from + total * curve(t);
    pin.style.transform = `rotate(${a * 180 / Math.PI}deg)`;
    if (t < 1) { requestAnimationFrame(step); return; }
    rest = a % (2 * Math.PI);
    finish(win);
  });
});

function finish(win) {
  spins++; if (win) wins++;
  tally.textContent = `прокруток ${spins} · побед ${wins}`;
  verdict.className = 'rig__hint ' + (win ? 'is-win' : 'is-lose');
  if (win) {
    verdict.innerHTML = `<b>Есть.</b> ${current.name} ваш — ${rub(current.price)} в инвентарь.`;
  } else {
    const prize = Math.max(11, STAKE.price * between(0.10, 0.15));
    verdict.innerHTML = `<b>Мимо.</b> Ставка сгорела, утешительный приз — ${rub(prize)}.`;
  }
  busy = false;
  spinBtn.disabled = false;
}

/* ─────────── лента каталога ─────────── */
const CATALOG = [
  ['Chocolate Easter Vest', '44,37 ₽', '#939893'],
  ['Melting Snowman Water Purifier', '52,59 ₽', '#939893'],
  ['Kraken Shell Chestplate', '60,80 ₽', '#939893'],
  ['Iron Jaws Hatchet', '67,38 ₽', '#939893'],
  ['Small Rabbit Box', '74,77 ₽', '#939893'],
  ['Sea Monster Launcher', '89,56 ₽', '#939893'],
  ['Ice Eye Hatchet', '96,96 ₽', '#939893'],
  ['Cargo Heli Large Box', '102,71 ₽', '#939893'],
  ['Base Invaders Pants', '119,96 ₽', '#467edf'],
  ['Hunter SMG', '145,43 ₽', '#467edf'],
  ['Spider Web Rug', '178,30 ₽', '#467edf'],
  ['Mystical Rock', '210,35 ₽', '#467edf'],
  ['Troll Daddy Roadsign Pants', '235,00 ₽', '#467edf'],
  ['Metalhead Revolver', '272,79 ₽', '#ae6eee'],
  ['Redemption Revolver', '336,06 ₽', '#ae6eee'],
  ['Eater Hatchet', '432,20 ₽', '#ae6eee'],
  ['Dynasty SAP', '510,25 ₽', '#ae6eee'],
  ['Comics Jackhammer', '580,10 ₽', '#d2290f'],
  ['Forest Camo Cap', '768,26 ₽', '#d2290f'],
  ['Wasteland Hunter Pants', '1 213,60 ₽', '#d2290f'],
  ['After Death AR', '5 615,26 ₽', '#ffdd59'],
  ['Glory AK47', '24 133,12 ₽', '#ffdd59'],
  ['Big Grin', '95 063,35 ₽', '#ffdd59'],
  ['Alien Relic SMG', '144 633,58 ₽', '#ffdd59'],
  ['Punishment Mask', '229 281,51 ₽', '#ffdd59'],
  ['Metal Tree Door', '1 180 141,01 ₽', '#ffdd59'],
];
const tape = $('#tape');
if (tape) {
  const line = CATALOG.map(([n, p, c]) =>
    `<span class="tape__item"><i style="color:${c}">■</i><b>${n}</b>${p}</span>`).join('');
  tape.innerHTML = line + line;   // вторая копия — чтобы лента замыкалась
}

/* ─────────── появление блоков ───────────
   Только постеры и блок с оговорками: текстовые полосы, всплывающие
   по одной, превращают прокрутку в аттракцион. */
if (!calm.matches && 'IntersectionObserver' in window) {
  const marks = document.querySelectorAll('.shot, .honest');
  marks.forEach(el => el.classList.add('reveal'));
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      obs.unobserve(en.target);
    });
  }, { rootMargin: '0px 0px -12% 0px' });
  marks.forEach(el => io.observe(el));
}

/* ─────────── старт: дуга выезжает на место вслед за заголовком ─────────── */
if (calm.matches) {
  render(false);
} else {
  setTimeout(() => render(true), 430);
}

})();
