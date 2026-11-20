// lib/floor-art.js — v179 (Доп. 504): стол на схеме зала — как на плане, вид сверху: столешница и стулья вокруг.
//
// Владелец (20.11): «Давай улучшим рассадку, сделаем ее более удобной и красивой». Раньше стол был рамкой с номером и
// подписью «4 м.»; теперь видно форму стола и сколько за ним мест, а у стола с гостями закрашено столько стульев,
// сколько сидит гостей. Здесь только расчёт (размеры в точках экрана); рисует ui/table-art.jsx.

/** Больше стульев не рисуем: мелкие сливаются (сколько мест — всё равно в подписи и в карточке стола). */
export const CHAIRS_MAX = { sq: 12, rd: 12, long: 20, tall: 20 };
const count = (shape, seats) => Math.max(0, Math.min(CHAIRS_MAX[shape] || 12, Math.round(Number(seats) || 0)));

/**
 * Сколько стульев на каждой стороне прямоугольного стола: [верх, низ, лево, право].
 * Квадратный — по кругу (2 — друг напротив друга, 4 — по одному с каждой стороны). Длинный — вдоль длинных сторон,
 * с пяти мест — ещё по торцам (6: 2 + 2 + 1 + 1, 8: 3 + 3 + 1 + 1); вертикальный — так же, только стоя.
 */
export function sideCounts(shape, seats) {
  const n = count(shape, seats);
  // v180 (Доп. 505): вертикальный длинный — как длинный, повёрнутый: вдоль левой и правой стороны, торцы сверху и снизу
  if (shape === "tall") { const [a, b, e1, e2] = sideCounts("long", n); return [e1, e2, a, b]; }
  if (shape === "long") {
    if (n <= 2) return [n >= 1 ? 1 : 0, n >= 2 ? 1 : 0, 0, 0];
    const ends = n >= 5 ? (n % 2 ? 1 : 2) : 0, rest = n - ends;
    return [Math.ceil(rest / 2), Math.floor(rest / 2), ends >= 1 ? 1 : 0, ends === 2 ? 1 : 0];
  }
  const c = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) c[i % 4]++;
  return c;
}

/**
 * Геометрия стола в рамке W × H: столешница (прямоугольник или круг) и стулья — прямоугольники с центром (cx, cy),
 * шириной w вдоль стола, глубиной h и поворотом rot (градусы). Стулья — по кругу сторон (верх, низ, лево, право…),
 * в этом же порядке закрашиваются гости.
 */
export function tableGeom(shape, seats, W, H) {
  const m = Math.max(8, Math.min(W, H));
  const d = Math.max(2.5, Math.min(9, m * 0.13));   // глубина стула
  const g = Math.max(1, d * 0.38);                   // зазор между стулом и столешницей
  const ins = d + g + 0.5;
  const chairs = [];
  if (shape === "rd") {
    // v181: у круглого стулья чуть тоньше и ближе к столешнице — столешница не меньше, чем была, хотя рисунок стола
    // теперь меньше клетки (проход между столами): подпись на ней помещается, как раньше
    const dr = Math.max(2.5, Math.min(9, m * 0.12)), gr = Math.max(0.8, dr * 0.25);
    const cx = W / 2, cy = H / 2, r = Math.max(4, m / 2 - (dr + gr + 0.5)), n = count("rd", seats), R = r + gr + dr / 2;
    const cw = n ? Math.max(2.5, Math.min(dr * 2.4, ((2 * Math.PI * R) / n) * 0.66)) : 0;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      chairs.push({ cx: cx + R * Math.cos(a), cy: cy + R * Math.sin(a), w: cw, h: dr, rot: (a * 180) / Math.PI + 90 });
    }
    return { top: { kind: "circle", cx, cy, r }, chairs, d: dr };
  }
  const tx = ins, ty = ins, tw = Math.max(6, W - 2 * ins), th = Math.max(6, H - 2 * ins);
  const [nt, nb, nl, nr] = sideCounts(shape, seats);
  const along = (n, len) => {
    if (!n) return [];
    const step = len / n, cw = Math.max(2.5, Math.min(d * 2.4, step * 0.68));
    return Array.from({ length: n }, (_, i) => ({ p: (i + 0.5) * step, cw }));
  };
  const sides = [
    along(nt, tw).map(({ p, cw }) => ({ cx: tx + p, cy: ty - g - d / 2, w: cw, h: d, rot: 0 })),
    along(nb, tw).map(({ p, cw }) => ({ cx: tx + p, cy: ty + th + g + d / 2, w: cw, h: d, rot: 0 })),
    along(nl, th).map(({ p, cw }) => ({ cx: tx - g - d / 2, cy: ty + p, w: cw, h: d, rot: 90 })),
    along(nr, th).map(({ p, cw }) => ({ cx: tx + tw + g + d / 2, cy: ty + p, w: cw, h: d, rot: 90 })),
  ];
  const most = Math.max(0, ...sides.map((s) => s.length));
  for (let i = 0; i < most; i++) for (const s of sides) if (s[i]) chairs.push(s[i]);
  return { top: { kind: "rect", x: tx, y: ty, w: tw, h: th, r: Math.max(2, Math.min(tw, th) * (shape === "long" || shape === "tall" ? 0.16 : 0.2)) }, chairs, d };
}

/** Сколько стульев закрасить: гости за столом (сидят или попросили счёт) и гости брони; больше стульев — все. */
export function filledChairs(status, cnt, nChairs) {
  if (status !== "seat" && status !== "bill" && status !== "res") return 0;
  return Math.max(0, Math.min(nChairs, Math.round(Number(cnt) || 0)));
}
