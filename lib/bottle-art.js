// lib/bottle-art.js — v136 (Доп. 449): нарисованная бутылка вместо пустой рамки. Без React.
//
// Владелец (04.11): «Как думаешь, ещё удобнее и красивее барную карту можно сделать?» — на десять предложений «Давай все».
// У позиций без фото в списке была пунктирная рамка с серым значком. Теперь — бутылка, как бокалы у коктейлей: у вина — в
// его цвете (игристое — бутылка шампанского с золотой фольгой, белое и розовое — прозрачное стекло с вином внутри, красное —
// тёмное стекло, десертное — узкая бутылка), у крепкого — в форме вида (виски — квадратные плечи и пробка, коньяк — круглая
// фляга, джин — прозрачная с голубизной, водка — высокая матовая, ром, текила, ликёр, биттер). Без надписей: этикетка — светлая
// полоса с золотой рамкой, чтобы не путать с настоящей. Одна и та же картинка — в строке, в карточке и на листе печати
// (ui/bar-print.jsx): SVG строкой, на экране — <img> с data:-адресом.

const SHAPE = {
  bordeaux: "M25 8H35V44C35 52 48 54 48 64V140Q48 146 42 146H18Q12 146 12 140V64C12 54 25 52 25 44Z",
  champagne: "M26 6H34V40C34 58 49 60 49 76V140Q49 146 43 146H17Q11 146 11 140V76C11 60 26 58 26 40Z",
  slender: "M26.5 20H33.5V52C33.5 60 43 62 43 70V140Q43 146 38 146H22Q17 146 17 140V70C17 62 26.5 60 26.5 52Z",
  square: "M24 18H36V36Q36 40 40 42L46 46Q50 48 50 54V140Q50 146 44 146H16Q10 146 10 140V54Q10 48 14 46L20 42Q24 40 24 36Z",
  flask: "M26 14H34V48C34 56 52 62 52 96C52 132 42 146 30 146C18 146 8 132 8 96C8 62 26 56 26 48Z",
  round: "M25 20H35V40C35 50 48 50 48 62V140Q48 146 42 146H18Q12 146 12 140V62C12 50 25 50 25 40Z",
  tall: "M26 8H34V40C34 48 46 50 46 58V140Q46 146 40 146H20Q14 146 14 140V58C14 50 26 48 26 40Z",
  slim: "M27 10H33V44C33 52 44 54 44 62V140Q44 146 38 146H22Q16 146 16 140V62C16 54 27 52 27 44Z",
  squat: "M26 24H34V46C34 54 50 58 50 84V138Q50 146 42 146H18Q10 146 10 138V84C10 58 26 54 26 46Z",
};
// сколько места у бутылки по высоте под этикетку: [верх, низ] и края по ширине
const LABEL = { bordeaux: [86, 122, 15, 45], champagne: [92, 126, 14, 46], slender: [90, 124, 19, 41], square: [80, 118, 13, 47], flask: [84, 116, 14, 46],
  round: [82, 120, 15, 45], tall: [84, 122, 17, 43], slim: [86, 122, 19, 41], squat: [94, 126, 13, 47] };

// стекло [тёмный край, светлая середина], вино или напиток внутри (с какой высоты, цвета), колпачок или пробка (цвета, высота, ширина)
const DARK_CAP = ["#4A1A1A", "#8A3434"], GOLD_CAP = ["#B88E3E", "#F0D48C"], CORK = ["#3A2414", "#7A5232"], SILVER = ["#8E9296", "#E2E6E8"];
const WINE = {
  sparkling: { s: "champagne", glass: ["#1E321C", "#4E6E3E"], cap: GOLD_CAP, capY: [3, 40], capW: 10 },
  white: { s: "bordeaux", clear: true, glass: ["#6F8A4E", "#D4E2B0"], liquid: { y: 54, c: ["#A99A48", "#E6DCA0"], a: 0.72 }, cap: GOLD_CAP, capY: [5, 22], capW: 12 },
  rose: { s: "bordeaux", clear: true, glass: ["#D6A6AC", "#F7E0E3"], liquid: { y: 54, c: ["#D07080", "#F4C0C8"], a: 0.82 }, cap: GOLD_CAP, capY: [5, 22], capW: 12 },
  orange: { s: "bordeaux", clear: true, glass: ["#C9A27A", "#F3E2CC"], liquid: { y: 54, c: ["#C8782E", "#EDB06A"] }, cap: CORK, capY: [5, 22], capW: 12 },
  red: { s: "bordeaux", glass: ["#26090E", "#6E1F2B"], cap: DARK_CAP, capY: [5, 24], capW: 12 },
  dessert: { s: "slender", clear: true, glass: ["#B79A6A", "#EFE2C4"], liquid: { y: 62, c: ["#B9741C", "#E8B25A"] }, cap: GOLD_CAP, capY: [17, 32], capW: 9 },
  fortified: { s: "bordeaux", glass: ["#2A140A", "#6A3818"], cap: DARK_CAP, capY: [5, 24], capW: 12 },
  other: { s: "bordeaux", glass: ["#3A2414", "#7A5232"], cap: GOLD_CAP, capY: [5, 22], capW: 12 },
};
const AMBER = ["#8A4A12", "#D9963A"];
const SPIRIT = {
  whisky: { s: "square", clear: true, glass: ["#B9A27A", "#F1E9D6"], liquid: { y: 56, c: AMBER }, cap: CORK, capY: [8, 20], capW: 16 },
  cognac: { s: "flask", clear: true, glass: ["#B9A27A", "#F1E9D6"], liquid: { y: 62, c: ["#7A3A10", "#CC8030"] }, cap: CORK, capY: [5, 16], capW: 12 },
  rum: { s: "round", clear: true, glass: ["#A88E6A", "#EADCC2"], liquid: { y: 58, c: ["#4E2208", "#A65A1E"] }, cap: CORK, capY: [10, 22], capW: 13 },
  gin: { s: "square", clear: true, glass: ["#8FB3C0", "#EAF4F7"], liquid: { y: 56, c: ["#BFD8E0", "#F4FAFC"] }, cap: SILVER, capY: [8, 20], capW: 15 },
  agave: { s: "slim", clear: true, glass: ["#A9B9AE", "#F0F5F0"], liquid: { y: 60, c: ["#D9DFC8", "#F7F8EE"] }, cap: CORK, capY: [3, 14], capW: 9 },
  vodka: { s: "tall", clear: true, glass: ["#B6C5CC", "#F6FAFB"], liquid: { y: 58, c: ["#DDE7EB", "#FBFDFE"] }, cap: SILVER, capY: [2, 14], capW: 11 },
  liqueur: { s: "squat", clear: true, glass: ["#B39A86", "#EFE3D8"], liquid: { y: 64, c: ["#6A2A1A", "#B8603A"] }, cap: GOLD_CAP, capY: [16, 28], capW: 11 },
  bitter: { s: "round", clear: true, glass: ["#C29A92", "#F3E2DE"], liquid: { y: 58, c: ["#9A1A12", "#E0432E"] }, cap: SILVER, capY: [10, 22], capW: 13 },
  other: { s: "round", clear: true, glass: ["#A88E6A", "#EADCC2"], liquid: { y: 58, c: AMBER }, cap: CORK, capY: [10, 22], capW: 13 },
};

/** Как выглядит бутылка позиции: kind — "wine" | "spirit", rec — запись (цвет вина или вид крепкого). */
export function bottleLook(kind, rec) {
  if (kind === "spirit") return SPIRIT[rec && rec.cat] || SPIRIT.other;
  return WINE[rec && rec.color] || WINE.other;
}
const grad = (id, [a, b]) => `<linearGradient id="${id}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${a}"/><stop offset=".45" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></linearGradient>`;

/** SVG бутылки строкой (60 × 150): стекло, напиток в прозрачном стекле, колпачок или пробка, этикетка без надписей, блик. */
export function bottleSvg(kind, rec) {
  const L = bottleLook(kind, rec), d = SHAPE[L.s], [lt, lb, lx1, lx2] = LABEL[L.s];
  const cx = 30, cw = L.capW, [c1, c2] = L.capY;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 150" width="60" height="150"><defs>${grad("g", L.glass)}${L.liquid ? grad("q", L.liquid.c) : ""}${grad("c", L.cap)}`
    + `<clipPath id="b"><path d="${d}"/></clipPath></defs>`
    + `<path d="${d}" fill="url(#g)"${L.clear ? ' opacity=".55"' : ""}/>`
    + (L.liquid ? `<g clip-path="url(#b)"><rect x="0" y="${L.liquid.y}" width="60" height="${150 - L.liquid.y}" fill="url(#q)" opacity="${L.liquid.a || 0.95}"/></g>` : "")
    + `<rect x="${cx - cw / 2}" y="${c1}" width="${cw}" height="${c2 - c1}" rx="2" fill="url(#c)"/>`
    + `<rect x="${lx1}" y="${lt}" width="${lx2 - lx1}" height="${lb - lt}" rx="2" fill="#F4EBD7"/>`
    + `<rect x="${lx1 + 2.5}" y="${lt + 2.5}" width="${lx2 - lx1 - 5}" height="${lb - lt - 5}" rx="1" fill="none" stroke="#B08A47" stroke-width="1"/>`
    + `<rect x="${lx1 + 7}" y="${lt + 11}" width="${lx2 - lx1 - 14}" height="2.2" rx="1" fill="#B08A47" opacity=".75"/>`
    + `<rect x="${lx1 + 9}" y="${lt + 17}" width="${lx2 - lx1 - 18}" height="1.6" rx=".8" fill="#B08A47" opacity=".5"/>`
    + `<g clip-path="url(#b)"><rect x="16" y="${Math.round(lt * 0.6)}" width="3.2" height="${146 - Math.round(lt * 0.6) - 6}" rx="1.6" fill="#FFFFFF" opacity=".22"/></g>`
    + `<path d="${d}" fill="none" stroke="#000000" stroke-opacity=".35" stroke-width=".8"/></svg>`;
}

const cache = new Map();
/** data:-адрес картинки (для <img> и для листа печати); одинаковые бутылки — из кэша. */
export function bottleUrl(kind, rec) {
  const key = kind + ":" + (kind === "spirit" ? (rec && rec.cat) || "" : (rec && rec.color) || "");
  if (!cache.has(key)) cache.set(key, "data:image/svg+xml;charset=utf-8," + encodeURIComponent(bottleSvg(kind, rec)));
  return cache.get(key);
}

/** Та же бутылка на холсте (лист печати, ui/bar-print.jsx): рисуем путями, а не картинкой SVG — холст с картинкой SVG
 *  Safari мог пометить «чужим», и лист потом не сохранить. Вписывается в W × H по центру. */
export function drawBottle(x, kind, rec, X, Y, W, H) {
  if (typeof Path2D === "undefined") return;
  const L = bottleLook(kind, rec), path = new Path2D(SHAPE[L.s]), [lt, lb, lx1, lx2] = LABEL[L.s];
  const k = Math.min(W / 60, H / 150), ox = X + (W - 60 * k) / 2, oy = Y + (H - 150 * k) / 2;
  const lin = (cols) => { const g = x.createLinearGradient(0, 0, 60, 0); g.addColorStop(0, cols[0]); g.addColorStop(0.45, cols[1]); g.addColorStop(1, cols[0]); return g; };
  const rr = (a, b, w, h, r) => { const p = new Path2D(); p.moveTo(a + r, b); p.arcTo(a + w, b, a + w, b + h, r); p.arcTo(a + w, b + h, a, b + h, r); p.arcTo(a, b + h, a, b, r); p.arcTo(a, b, a + w, b, r); p.closePath(); return p; };
  x.save(); x.translate(ox, oy); x.scale(k, k);
  x.globalAlpha = L.clear ? 0.55 : 1; x.fillStyle = lin(L.glass); x.fill(path); x.globalAlpha = 1;
  if (L.liquid) { x.save(); x.clip(path); x.globalAlpha = L.liquid.a || 0.95; x.fillStyle = lin(L.liquid.c); x.fillRect(0, L.liquid.y, 60, 150 - L.liquid.y); x.restore(); }
  const [c1, c2] = L.capY; x.fillStyle = lin(L.cap); x.fill(rr(30 - L.capW / 2, c1, L.capW, c2 - c1, 2));
  x.fillStyle = "#F4EBD7"; x.fill(rr(lx1, lt, lx2 - lx1, lb - lt, 2));
  x.strokeStyle = "#B08A47"; x.lineWidth = 1; x.stroke(rr(lx1 + 2.5, lt + 2.5, lx2 - lx1 - 5, lb - lt - 5, 1));
  x.globalAlpha = 0.75; x.fillStyle = "#B08A47"; x.fill(rr(lx1 + 7, lt + 11, lx2 - lx1 - 14, 2.2, 1));
  x.globalAlpha = 0.5; x.fill(rr(lx1 + 9, lt + 17, lx2 - lx1 - 18, 1.6, 0.8));
  x.save(); x.clip(path); x.globalAlpha = 0.22; x.fillStyle = "#FFFFFF"; const hy = Math.round(lt * 0.6); x.fill(rr(16, hy, 3.2, 146 - hy - 6, 1.6)); x.restore();
  x.globalAlpha = 1; x.strokeStyle = "rgba(0,0,0,0.35)"; x.lineWidth = 0.8; x.stroke(path);
  x.restore();
}
