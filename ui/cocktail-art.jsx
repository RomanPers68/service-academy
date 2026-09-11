import React from "react";
// Витраж коктейля: силуэт бокала по легенде карточек заведения, жидкость
// своего цвета с глубиной, лёд, гарниш, стеклянный блик. Всё в морозном льде.
// viewBox 200×260. Бокал задаётся контуром (stroke) и областью жидкости (clip).

const GLASS = {
  rocks:     { body:"M44 98 L50 194 Q52 208 68 208 L132 208 Q148 208 150 194 L156 98 Z", liq:"M50 132 L55 194 Q57 204 68 204 L132 204 Q143 204 145 194 L150 132 Z", rim:[100,98,56,8], ribs:true, squat:true },
  highball:  { body:"M62 54 L66 222 Q66 230 74 230 L126 230 Q134 230 134 222 L138 54 Z", liq:"M65 96 L68 222 Q68 228 74 228 L126 228 Q132 228 132 222 L135 96 Z", rim:[100,54,38,6] },
  martini:   { body:"M34 70 L100 168 L166 70 Z M100 168 L100 224 M70 226 L130 226", liq:"M52 96 L100 166 L148 96 Z", rim:[100,70,66,8], stem:true },
  hurricane: { body:"M78 60 Q60 100 74 140 Q84 170 78 196 Q76 214 100 216 Q124 214 122 196 Q116 170 126 140 Q140 100 122 60 Z M92 216 L92 228 M74 230 L126 230", liq:"M80 98 Q68 120 78 144 Q88 172 82 196 Q80 212 100 213 Q120 212 118 196 Q112 172 122 144 Q132 120 120 98 Z", rim:[100,60,22,5], stem:true },
  red:       { body:"M48 78 Q40 140 100 158 Q160 140 152 78 Z M100 158 L100 222 M72 226 L128 226", liq:"M54 112 Q52 142 100 156 Q148 142 146 112 Z", rim:[100,78,52,7], stem:true },
  white:     { body:"M60 70 Q52 130 100 150 Q148 130 140 70 Z M100 150 L100 222 M74 226 L126 226", liq:"M64 104 Q60 134 100 148 Q140 134 136 104 Z", rim:[100,70,40,6], stem:true },
  irish:     { body:"M64 66 L68 190 Q70 200 82 200 L118 200 Q130 200 132 190 L136 66 Z M136 100 Q170 100 168 130 Q166 156 136 156 M100 200 L100 220 M78 224 L122 224", liq:"M68 98 L71 190 Q72 198 82 198 L118 198 Q128 198 129 190 L132 98 Z", rim:[100,66,36,6], stem:true },
  flute:     { body:"M80 40 Q74 120 100 160 Q126 120 120 40 Z M100 160 L100 222 M76 226 L124 226", liq:"M82 64 Q78 122 100 158 Q122 122 118 64 Z", rim:[100,40,20,4], stem:true },
  margarita: { body:"M40 82 Q60 100 82 104 Q88 140 100 148 Q112 140 118 104 Q140 100 160 82 Z M100 148 L100 222 M72 226 L128 226", liq:"M50 90 Q66 104 84 108 Q90 136 100 144 Q110 136 116 108 Q134 104 150 90 Z", rim:[100,82,60,7], stem:true },
  shot:      { body:"M62 92 L71 216 Q72 224 82 224 L118 224 Q128 224 129 216 L138 92 Z", liq:"M67 124 L74 216 Q75 222 82 222 L118 222 Q125 222 126 216 L133 124 Z", rim:[100,92,38,6] },
  sour:      { body:"M74 66 L78 150 Q80 166 100 168 Q120 166 122 150 L126 66 Z M100 168 L100 222 M78 226 L122 226", liq:"M77 96 L81 150 Q82 164 100 166 Q118 164 119 150 L123 96 Z", rim:[100,66,26,5], stem:true },
};

const Garnish = ({ kind, x, y }) => {
  switch (kind) {
    case "orange": case "lemon": case "lime": {
      const col = kind === "orange" ? ["#F3B14C","#C96A1E"] : kind === "lemon" ? ["#F6E27A","#D9B21E"] : ["#B9E07A","#6EA83A"];
      return (<g transform={`translate(${x} ${y}) rotate(-25)`}>
        <path d="M-17 0 A17 17 0 0 1 17 0 Z" fill={col[0]} /><path d="M-17 0 A17 17 0 0 1 17 0" stroke={col[1]} strokeWidth="2" fill="none" />
        <path d="M-14 -1 A14 14 0 0 1 14 -1 Z" fill="#FFF" fillOpacity="0.16" />
        <g stroke="#FFF7DA" strokeOpacity="0.8" strokeWidth="1"><path d="M0 0 L-14 -1" /><path d="M0 0 L-9 -12" /><path d="M0 0 L0 -15" /><path d="M0 0 L9 -12" /><path d="M0 0 L14 -1" /></g>
        <path d="M-15 -3 A17 17 0 0 1 -4 -16" stroke="#FFF" strokeOpacity="0.6" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </g>); }
    case "cherry": return (<g><circle cx={x} cy={y} r="7" fill="#B8203A" /><circle cx={x - 2} cy={y - 2} r="2" fill="#FFF" fillOpacity="0.5" /><path d={`M${x} ${y - 7} q4 -12 12 -14`} stroke="#5E8A3A" strokeWidth="1.6" fill="none" /></g>);
    case "olive": return (<g><circle cx={x} cy={y} r="6" fill="#6E8A3A" /><circle cx={x} cy={y} r="2" fill="#C8382E" /><path d={`M${x - 26} ${y - 22} L${x + 10} ${y + 6}`} stroke="#EFE4C8" strokeWidth="1.4" /></g>);
    case "onion": return (<g><circle cx={x} cy={y} r="5" fill="#F0E8D8" /><circle cx={x + 9} cy={y} r="5" fill="#F0E8D8" /><path d={`M${x - 26} ${y - 22} L${x + 14} ${y + 4}`} stroke="#EFE4C8" strokeWidth="1.4" /></g>);
    case "mint": return (<g transform={`translate(${x} ${y})`} fill="#5EA85A"><path d="M0 0 q-14 -6 -12 -22 q14 4 12 22z" /><path d="M0 0 q14 -8 10 -24 q-14 6 -10 24z" /><path d="M0 0 q2 -14 12 -18" stroke="#3F7A3A" strokeWidth="1" fill="none" /></g>);
    case "peel": case "peel-lemon": {
      // Твист: широкая плоская лента кожуры, одна петля через кромку.
      // Наружная сторона — кожура (насыщенная, с бликом), внутренняя — светлый альбедо.
      const col = kind === "peel" ? ["#F28A1E", "#B4540E", "#FFD9A8"] : ["#F2D24A", "#B99512", "#FFF6C8"];
      const rib = "M-18 -6 C -2 -14, 16 -10, 14 4 C 12 16, -4 20, -6 12 C -8 4, 8 2, 10 12 C 11 22, 2 34, -6 40";
      return (<g transform={`translate(${x - 4} ${y + 2}) rotate(-8)`}>
        <path d={rib} stroke="#000" strokeOpacity="0.28" strokeWidth="11" fill="none" strokeLinecap="round" transform="translate(2 3)" filter="none" />
        <path d={rib} stroke={col[1]} strokeWidth="11" fill="none" strokeLinecap="round" />
        <path d={rib} stroke={col[0]} strokeWidth="8.5" fill="none" strokeLinecap="round" />
        <path d={rib} stroke={col[2]} strokeOpacity="0.55" strokeWidth="2.2" fill="none" strokeLinecap="round" transform="translate(-2.4 -1.6)" />
        <path d={rib} stroke="#FFF" strokeOpacity="0.5" strokeWidth="1" fill="none" strokeLinecap="round" transform="translate(-3 -2.4)" strokeDasharray="14 10" />
      </g>); }
    case "cream": return (<ellipse cx={x} cy={y} rx="32" ry="7" fill="#FFF8EA" fillOpacity="0.9" />);
    case "salt": return (<g stroke="#FFF" strokeOpacity="0.85" strokeWidth="2.4" strokeDasharray="1.5 3"><path d={`M${x - 56} ${y + 2} Q${x} ${y + 14} ${x + 56} ${y + 2}`} fill="none" /></g>);
    default: return null;
  }
};

// Лёд как в жизни: прозрачный куб с гранью, внутренним светом и бликом,
// выступает над жидкостью. Рокс — один крупный куб, хайбол — стопка,
// «crushed» — колотая россыпь. Всё внутри контура бокала (clip по body).
const Cube = ({ x, y, s, r = 0, uid }) => {
  // Настоящий лёд почти невидим в напитке: слабое тело, яркий кант по
  // верхним рёбрам (там, где выходит из жидкости), трещины внутри, блик.
  const h = s / 2;
  const poly = `M${-h * 0.92} ${-h * 0.78} L${-h * 0.55} ${-h} L${h * 0.86} ${-h * 0.9} L${h} ${-h * 0.3} L${h * 0.9} ${h * 0.82} L${-h * 0.4} ${h} L${-h} ${h * 0.55} Z`;
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <path d={poly} fill="#FFFFFF" fillOpacity="0.10" filter={"url(#" + uid + "-blur)"} />
      <path d={poly} fill={"url(#" + uid + "-ice)"} />
      <path d={`M${-h * 0.92} ${-h * 0.78} L${-h * 0.55} ${-h} L${h * 0.86} ${-h * 0.9} L${h} ${-h * 0.3}`} stroke="#FFF" strokeOpacity="0.85" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={`M${h} ${-h * 0.3} L${h * 0.9} ${h * 0.82}`} stroke="#FFF" strokeOpacity="0.3" strokeWidth="1.1" fill="none" />
      <path d={`M${-h * 0.5} ${-h * 0.4} l${h * 0.55} ${h * 0.35} l${h * 0.25} ${h * 0.55}`} stroke="#FFF" strokeOpacity="0.35" strokeWidth="0.9" fill="none" />
      <path d={`M${h * 0.2} ${-h * 0.7} l${-h * 0.3} ${h * 0.5}`} stroke="#FFF" strokeOpacity="0.25" strokeWidth="0.8" fill="none" />
      <ellipse cx={-h * 0.45} cy={-h * 0.5} rx={s * 0.09} ry={s * 0.045} fill="#FFF" fillOpacity="0.75" transform={`rotate(-30 ${-h * 0.45} ${-h * 0.5})`} />
    </g>
  );
};
const CRUSH = [[78,134,9,20],[96,130,11,-15],[116,136,8,35],[86,148,10,-30],[108,152,9,10],[126,144,7,50],[74,164,8,-10],[100,168,10,25],[120,166,8,-40],[90,182,9,15],[112,184,7,-25],[82,196,8,40]];
const Ice = ({ c, g, uid }) => {
  if (!c.ice) return null;
  const clip = { clipPath: "url(#" + uid + "-b)" };
  if (c.ice === "crushed") return <g {...clip}>{CRUSH.map(([x, y, s, r], i) => <Cube key={i} x={x} y={y} s={s} r={r} uid={uid} />)}</g>;
  if (c.glass === "rocks") return <g {...clip}><Cube x={100} y={158} s={70} r={6} uid={uid} /></g>;
  if (c.glass === "hurricane") return <g {...clip}><Cube x={96} y={120} s={30} r={-12} uid={uid} /><Cube x={104} y={158} s={28} r={20} uid={uid} /></g>;
  return <g {...clip}><Cube x={98} y={106} s={38} r={-10} uid={uid} /><Cube x={102} y={146} s={40} r={14} uid={uid} /><Cube x={99} y={188} s={36} r={-6} uid={uid} /></g>;
};

// Пузырьки для газированных — детерминированные позиции (x, y, r)
const FIZZ = [[74,0.15,1.4],[88,0.32,1.1],[104,0.22,1.6],[121,0.4,1.2],[80,0.55,1.3],[112,0.62,1.0],[96,0.74,1.5],[126,0.8,1.1],[70,0.86,1.2],[108,0.9,1.3],[90,0.47,0.9],[118,0.12,0.9]];
// Испарина на холодном стекле — (x, y, r)
const DEW = [[58,0.28,2.2],[64,0.46,1.6],[140,0.34,2.0],[146,0.55,1.5],[60,0.66,1.3],[138,0.72,1.8],[70,0.18,1.2],[132,0.2,1.4],[56,0.84,1.5],[144,0.88,1.2]];

// Доп. 228: витраж умеет собираться — fill 0…1 (уровень жидкости), showIce, showGarnish, liquid (цвета того,
// что уже налито, вместо финального градиента). По умолчанию — как в Колоде: полный, финальный.
export function CocktailArt({ c, w = 200, light = false, fill = 1, showIce = true, showGarnish = true, liquid = null, bubbles = null }) {
  const g = GLASS[c.glass] || GLASS.rocks;
  // Светлая тема: стекло читается тёмным золотом, а не белым (на кремовом фоне белое исчезает)
  const edge = light ? "#6B4E1A" : "#FFFFFF";
  const shadowA = light ? 0.22 : 0.45;
  const uid = "cg-" + c.id;
  const [rx, ry, rw] = [g.rim[0], g.rim[1], g.rim[2]];
  const garY = c.glass === "shot" ? 88 : ry - 2;
  const nums = g.liq.match(/-?\d+(\.\d+)?/g).map(Number);
  const lx0 = nums[0], ly0 = nums[1], lx1 = nums[nums.length - 2];
  // Низ бокала — по ВСЕМУ контуру (у бокалов на ножке низ — это подставка,
  // а не чаша): тень и отсвет ложатся на стойку, а не висят под чашей
  const bnums = g.body.match(/-?\d+(\.\d+)?/g).map(Number);
  const yBottom = Math.max(...bnums.filter((_, i) => i % 2 === 1));
  const bowlBottom = Math.max(...g.body.split(" M")[0].match(/-?\d+(\.\d+)?/g).map(Number).filter((_, i) => i % 2 === 1));
  const liqH = bowlBottom - ly0;
  const lvl = Math.max(0, Math.min(1, fill)); const liqTop = bowlBottom - liqH * lvl; // текущая поверхность
  const mixed = liquid && liquid.length ? (() => { const rgb = liquid.map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))); const a = [0, 1, 2].map(k => Math.round(rgb.reduce((q, cc) => q + cc[k], 0) / rgb.length)); return "#" + a.map(v => v.toString(16).padStart(2, "0")).join(""); })() : null;
  const showFizz = bubbles == null ? !!c.fizz : bubbles;
  const cold = !!c.ice && !g.stem;
  const topCol = c.layers ? c.layers[c.layers.length - 1] : c.color[0];
  const botCol = c.layers ? c.layers[0] : c.color[1];
  return (
    <svg viewBox="0 0 200 260" width={w} height={w * 1.3} style={{ display:"block" }}>
      <defs>
        <linearGradient id={uid + "-l"} x1="0" y1="0" x2="0" y2="1">
          {c.layers ? (() => {
            const n = c.layers.length, out = [];
            c.layers.slice().reverse().forEach((col, i) => {
              out.push(<stop key={"a" + i} offset={i / n} stopColor={col} />);
              out.push(<stop key={"b" + i} offset={(i + 1) / n} stopColor={col} />);
            });
            return out;
          })() : mixed ? (<><stop offset="0" stopColor={mixed} stopOpacity="0.95" /><stop offset="1" stopColor={mixed} /></>) : (<><stop offset="0" stopColor={c.color[0]} /><stop offset="0.55" stopColor={c.color[1]} /><stop offset="1" stopColor={c.color[1]} /></>)}
        </linearGradient>
        {/* Свет сквозь напиток: тёплое сияние снизу-в-центре, тень у стенок */}
        <radialGradient id={uid + "-lum"} cx="50%" cy="78%" r="58%"><stop offset="0" stopColor="#FFF6D8" stopOpacity="0.42" /><stop offset="0.45" stopColor="#FFF6D8" stopOpacity="0.10" /><stop offset="1" stopColor="#000" stopOpacity="0.30" /></radialGradient>
        <linearGradient id={uid + "-shade"} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#000" stopOpacity="0.28" /><stop offset="0.3" stopColor="#000" stopOpacity="0" /><stop offset="0.7" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.34" /></linearGradient>
        <linearGradient id={uid + "-top"} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#000" stopOpacity="0.22" /><stop offset="0.25" stopColor="#000" stopOpacity="0" /></linearGradient>
        {/* Стекло: широкий мягкий блик слева, узкий резкий, отсвет справа */}
        <linearGradient id={uid + "-g"} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={edge} stopOpacity="0.20" /><stop offset="0.12" stopColor={edge} stopOpacity="0.05" /><stop offset="0.5" stopColor={edge} stopOpacity="0.01" /><stop offset="0.86" stopColor={edge} stopOpacity="0.04" /><stop offset="1" stopColor={edge} stopOpacity="0.18" /></linearGradient>
        <linearGradient id={uid + "-e"} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={edge} stopOpacity="0.9" /><stop offset="0.14" stopColor={edge} stopOpacity="0.06" /><stop offset="0.84" stopColor={edge} stopOpacity="0.04" /><stop offset="1" stopColor={edge} stopOpacity="0.55" /></linearGradient>
        <linearGradient id={uid + "-spec"} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={edge} stopOpacity="0" /><stop offset="0.2" stopColor={edge} stopOpacity="0.85" /><stop offset="0.8" stopColor={edge} stopOpacity="0.5" /><stop offset="1" stopColor={edge} stopOpacity="0" /></linearGradient>
        <linearGradient id={uid + "-ice"} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFF" stopOpacity="0.55" /><stop offset="0.5" stopColor="#EAF4FF" stopOpacity="0.12" /><stop offset="1" stopColor="#FFF" stopOpacity="0.36" /></linearGradient>
        <radialGradient id={uid + "-dew"} cx="35%" cy="30%" r="70%"><stop offset="0" stopColor={edge} stopOpacity="0.85" /><stop offset="0.5" stopColor={edge} stopOpacity="0.15" /><stop offset="1" stopColor={edge} stopOpacity="0.02" /></radialGradient>
        <radialGradient id={uid + "-h"} cx="50%" cy="60%" r="50%"><stop offset="0" stopColor={topCol} stopOpacity="0.32" /><stop offset="1" stopColor={topCol} stopOpacity="0" /></radialGradient>
        <linearGradient id={uid + "-refl"} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={botCol} stopOpacity="0.35" /><stop offset="1" stopColor={botCol} stopOpacity="0" /></linearGradient>
        <filter id={uid + "-blur"} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2" /></filter>
        <filter id={uid + "-soft"} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.1" /></filter>
        <clipPath id={uid + "-c"}><path d={g.liq} /></clipPath>
        <clipPath id={uid + "-lvl"}><rect x="0" y={liqTop} width="200" height={Math.max(0, bowlBottom - liqTop) + 40} /></clipPath>
        <clipPath id={uid + "-b"}><path d={g.body.split(" M")[0]} /></clipPath>
      </defs>
      {/* Сцена: сияние цвета напитка, отражение на стойке, тень */}
      <rect width="200" height="260" fill={"url(#" + uid + "-h)"} opacity={0.25 + 0.75 * lvl} style={{ transition: "opacity .5s" }} />
      <ellipse cx="100" cy={yBottom + 14} rx="60" ry="10" fill="#000" opacity={shadowA} filter={"url(#" + uid + "-blur)"} />
      <ellipse cx="100" cy={yBottom + 18} rx={g.stem ? 30 : 50} ry="9" fill={"url(#" + uid + "-refl)"} opacity="0.7" filter={"url(#" + uid + "-blur)"} />
      {/* Напиток: цвет → сияние → боковые тени → тень сверху. При сборке — обрезано по уровню */}
      <g clipPath={lvl < 1 ? "url(#" + uid + "-lvl)" : undefined} style={{ transition: "all .4s" }}>
      {lvl > 0 && <path d={g.liq} fill={"url(#" + uid + "-l)"} />}
      {showIce && <Ice c={c} g={g} uid={uid} />}
      {lvl > 0 && <path d={g.liq} fill={"url(#" + uid + "-l)"} opacity="0.34" />}
      {c.foam && lvl >= 0.99 ? <g clipPath={"url(#" + uid + "-c)"}><rect x="0" y="0" width="200" height={ry + 34} fill="#F6EEDC" fillOpacity="0.85" /></g> : null}
      {lvl > 0 && <path d={g.liq} fill={"url(#" + uid + "-lum)"} />}
      {lvl > 0 && <path d={g.liq} fill={"url(#" + uid + "-shade)"} />}
      {lvl > 0 && <path d={g.liq} fill={"url(#" + uid + "-top)"} />}
      </g>
      {/* Пузырьки — газированные */}
      {showFizz && lvl > 0 ? (
        <g clipPath={"url(#" + uid + "-c)"}>
          {FIZZ.map(([x, t, r], i) => (
            <g key={i}><circle cx={x} cy={liqTop + 6 + t * (bowlBottom - liqTop - 12)} r={r} fill="none" stroke="#FFF" strokeOpacity="0.55" strokeWidth="0.6" />
              <circle cx={x - r * 0.35} cy={liqTop + 6 + t * (bowlBottom - liqTop - 12) - r * 0.35} r={r * 0.3} fill="#FFF" fillOpacity="0.8" /></g>
          ))}
        </g>
      ) : null}
      {g.ribs ? (
        <g clipPath={"url(#" + uid + "-b)"}>
          {[52,63,74,85,96,107,118,129,140,151].map(x => (
            <g key={x}>
              <path d={`M${x} 104 L${x + (x < 100 ? 1.5 : -1.5)} 206`} stroke="#000" strokeOpacity="0.16" strokeWidth="3" />
              <path d={`M${x - 1.5} 104 L${x + (x < 100 ? 0 : -3)} 206`} stroke="#FFF" strokeOpacity="0.14" strokeWidth="1.2" />
            </g>
          ))}
        </g>
      ) : null}
      {/* Поверхность напитка: мениск с бликом — на текущем уровне */}
      {lvl > 0 && (() => { const k = g.stem ? (0.35 + 0.65 * lvl) : (0.8 + 0.2 * lvl); const hw = ((lx1 - lx0) / 2) * k; const cx = (lx0 + lx1) / 2; return (<>
        <g clipPath={"url(#" + uid + "-c)"}><rect x="0" y={liqTop} width="200" height="8" fill="#FFF" fillOpacity="0.14" /></g>
        <ellipse cx={cx} cy={liqTop} rx={hw} ry="3.4" fill="#FFF" fillOpacity="0.12" stroke="#FFF" strokeOpacity="0.5" strokeWidth="1" style={{ transition: "cy .4s, rx .4s" }} />
        <path d={`M${cx - hw + 8} ${liqTop - 1} q${hw * 0.5} -3 ${hw} 0`} stroke="#FFF" strokeOpacity="0.7" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      </>); })()}
      {/* Толстое дно */}
      {!g.stem ? (
        <g clipPath={"url(#" + uid + "-b)"}>
          <rect x="0" y={g.squat ? 182 : 206} width="200" height="36" fill={edge} fillOpacity={g.squat ? 0.10 : 0.07} />
          <rect x="0" y={g.squat ? 182 : 206} width="200" height="3" fill={edge} fillOpacity="0.28" />
          {g.squat ? <ellipse cx="100" cy="194" rx="46" ry="5" fill="none" stroke={edge} strokeOpacity="0.35" strokeWidth="1.2" /> : null}
        </g>
      ) : null}
      {/* Стекло: тело, лит край, толщина кромки */}
      <path d={g.body} fill={g.stem ? "none" : "url(#" + uid + "-g)"} stroke={edge} strokeOpacity="0.16" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d={g.body} fill="none" stroke={"url(#" + uid + "-e)"} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      {!g.stem ? (<>
        <ellipse cx={rx} cy={ry} rx={rw} ry={g.rim[3]} fill={edge} fillOpacity="0.05" stroke={edge} strokeOpacity="0.55" strokeWidth="1.5" />
        <ellipse cx={rx} cy={ry} rx={rw - 4} ry={Math.max(2, g.rim[3] - 2)} fill="none" stroke={edge} strokeOpacity="0.28" strokeWidth="1" />
        <path d={`M${rx - rw} ${ry} A${rw} ${g.rim[3]} 0 0 1 ${rx - rw * 0.3} ${ry - g.rim[3]}`} stroke={edge} strokeOpacity="0.9" strokeWidth="2" fill="none" strokeLinecap="round" />
      </>) : null}
      {/* Резкий узкий блик + мягкий широкий */}
      <path d={c.glass === "margarita" ? `M${rx - 34} ${ry + 10} q4 10 14 16` : c.glass === "shot" ? "M74 108 q-1 46 5 96" : g.squat ? "M56 110 q-2 44 6 84" : g.stem ? `M${rx - rw + 12} ${ry + 12} q-2 26 6 46` : "M62 100 q-2 60 6 112"}
        stroke={"url(#" + uid + "-spec)"} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d={g.squat ? "M64 112 q-3 40 4 80" : g.stem ? `M${rx - rw + 20} ${ry + 14} q-2 26 4 44` : "M70 104 q-3 56 4 108"}
        stroke="#FFF" strokeOpacity="0.14" strokeWidth="7" fill="none" strokeLinecap="round" filter={"url(#" + uid + "-soft)"} />
      <path d={g.stem ? `M${rx + rw - 10} ${ry + 16} q3 22 -2 40` : "M136 104 q3 56 -2 108"} stroke={edge} strokeOpacity="0.2" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {/* Испарина на холодном стекле */}
      {cold ? (
        <g clipPath={"url(#" + uid + "-b)"}>
          {DEW.map(([x, t, r], i) => <circle key={i} cx={g.squat ? 44 + (x - 56) * 1.25 : x} cy={ry + 10 + t * (bowlBottom - ry - 24)} r={r} fill={"url(#" + uid + "-dew)"} />)}
        </g>
      ) : null}
      {showGarnish ? (c.garnish === "cream" ? <Garnish kind="cream" x={100} y={ry + 30} /> : c.garnish === "salt" ? <Garnish kind="salt" x={rx} y={ry} /> : <Garnish kind={c.garnish} x={rx + rw - 4} y={garY} />) : null}
    </svg>
  );
}

// ── Доп. 229: сосуды в языке витражей — шейкер (бостон), смесительный стакан, блендер ─────────────
// Те же приёмы, что у бокалов: стекло/металл с бликами, жидкость с сиянием, мениск, лёд, тень и отсвет.
const VESSELS = {
  // бостонский шейкер: стеклянная пинта (видно, что внутри) + металлический тин сверху
  shaker:  { body: "M66 74 L134 74 L130 222 Q130 234 118 234 L82 234 Q70 234 70 222 Z", cap: "M60 74 L140 74 L134 40 Q134 28 122 26 L78 26 Q66 28 66 40 Z", liq: "M70 80 L130 80 L127 221 Q127 229 118 229 L82 229 Q73 229 73 221 Z", metal: false, capMetal: true, rim: [100, 74, 40] },
  mixing:  { body: "M60 40 L140 40 L134 224 Q134 236 122 236 L78 236 Q66 236 66 224 Z M60 40 L52 32", liq: "M64 46 L136 46 L131 222 Q131 231 122 231 L78 231 Q69 231 69 222 Z", spoon: true, rim: [100, 40, 40] },
  blender: { body: "M66 52 L134 52 L142 214 Q142 232 124 232 L76 232 Q58 232 58 214 Z M78 36 L122 36 L124 52 L76 52 Z M56 236 L144 236 L140 254 L60 254 Z", liq: "M70 58 L130 58 L137 213 Q137 227 124 227 L76 227 Q63 227 63 213 Z", ribs: true, rim: [100, 52, 34] },
};
export function VesselArt({ kind = "shaker", w = 120, light = false, fill = 0, liquid = null, ice = null, frost = false, shake = false, tilt = false, uidSuffix = "" }) {
  const v = VESSELS[kind] || VESSELS.shaker;
  const auto = React.useRef(Math.random().toString(36).slice(2, 7)); const uid = "vs-" + kind + (uidSuffix || "-" + auto.current); // id уникален на экземпляр — несколько сосудов на странице не делят маски
  const edge = light ? "#6B4E1A" : "#FFFFFF";
  const nums = v.liq.match(/-?\d+(\.\d+)?/g).map(Number); const ys = nums.filter((_, i) => i % 2 === 1); const ly0 = Math.min(...ys), lyB = Math.max(...ys);
  const lvl = Math.max(0, Math.min(1, fill)); const liqTop = lyB - (lyB - ly0) * lvl;
  const mixed = liquid && liquid.length ? (() => { const rgb = liquid.map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))); const a = [0, 1, 2].map(k => Math.round(rgb.reduce((q, cc) => q + cc[k], 0) / rgb.length)); return "#" + a.map(x => x.toString(16).padStart(2, "0")).join(""); })() : "#D6B266";
  const xs = nums.filter((_, i) => i % 2 === 0); const lx0 = Math.min(...xs), lx1 = Math.max(...xs);
  return (
    <svg viewBox="0 0 200 260" width={w} height={w * 1.3} style={{ display: "block", overflow: "visible", transformOrigin: "50% 92%", transform: tilt ? "rotate(-42deg) translate(16px,-10px)" : "none", transition: "transform .45s cubic-bezier(.3,1.2,.4,1)", animation: shake ? "saLabShake .8s ease-in-out" : "none" }}>
      <defs>
        <linearGradient id={uid + "-m"} x1="0" x2="1"><stop offset="0" stopColor="#F2F3F7" stopOpacity="0.55" /><stop offset="0.18" stopColor="#8A8E99" stopOpacity="0.45" /><stop offset="0.42" stopColor="#F6F7FA" stopOpacity="0.6" /><stop offset="0.62" stopColor="#A9ADB8" stopOpacity="0.4" /><stop offset="0.85" stopColor="#5C606B" stopOpacity="0.55" /><stop offset="1" stopColor="#D9DCE3" stopOpacity="0.4" /></linearGradient>
        <linearGradient id={uid + "-g"} x1="0" x2="1"><stop offset="0" stopColor={edge} stopOpacity="0.2" /><stop offset="0.12" stopColor={edge} stopOpacity="0.05" /><stop offset="0.5" stopColor={edge} stopOpacity="0.01" /><stop offset="0.86" stopColor={edge} stopOpacity="0.04" /><stop offset="1" stopColor={edge} stopOpacity="0.18" /></linearGradient>
        <linearGradient id={uid + "-e"} x1="0" x2="1"><stop offset="0" stopColor={edge} stopOpacity="0.9" /><stop offset="0.14" stopColor={edge} stopOpacity="0.06" /><stop offset="0.84" stopColor={edge} stopOpacity="0.04" /><stop offset="1" stopColor={edge} stopOpacity="0.55" /></linearGradient>
        <linearGradient id={uid + "-l"} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={mixed} stopOpacity="0.95" /><stop offset="1" stopColor={mixed} /></linearGradient>
        <radialGradient id={uid + "-lum"} cx="50%" cy="78%" r="58%"><stop offset="0" stopColor="#FFF6D8" stopOpacity="0.42" /><stop offset="0.45" stopColor="#FFF6D8" stopOpacity="0.10" /><stop offset="1" stopColor="#000" stopOpacity="0.30" /></radialGradient>
        <linearGradient id={uid + "-shade"} x1="0" x2="1"><stop offset="0" stopColor="#000" stopOpacity="0.28" /><stop offset="0.3" stopColor="#000" stopOpacity="0" /><stop offset="0.7" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.34" /></linearGradient>
        <linearGradient id={uid + "-spec"} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={edge} stopOpacity="0" /><stop offset="0.2" stopColor={edge} stopOpacity="0.85" /><stop offset="0.8" stopColor={edge} stopOpacity="0.5" /><stop offset="1" stopColor={edge} stopOpacity="0" /></linearGradient>
        <radialGradient id={uid + "-h"} cx="50%" cy="60%" r="50%"><stop offset="0" stopColor={mixed} stopOpacity="0.28" /><stop offset="1" stopColor={mixed} stopOpacity="0" /></radialGradient>
        <linearGradient id={uid + "-refl"} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={mixed} stopOpacity="0.35" /><stop offset="1" stopColor={mixed} stopOpacity="0" /></linearGradient>
        <radialGradient id={uid + "-dew"} cx="35%" cy="30%" r="70%"><stop offset="0" stopColor={edge} stopOpacity="0.85" /><stop offset="0.5" stopColor={edge} stopOpacity="0.15" /><stop offset="1" stopColor={edge} stopOpacity="0.02" /></radialGradient>
        <filter id={uid + "-blur"} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2" /></filter>
        <clipPath id={uid + "-c"}><path d={v.liq} /></clipPath>
        <clipPath id={uid + "-b"}><path d={v.body.split(" M")[0]} /></clipPath>
        <clipPath id={uid + "-lvl"}><rect x="0" y={liqTop} width="200" height={lyB - liqTop + 40} /></clipPath>
      </defs>
      <rect width="200" height="260" fill={"url(#" + uid + "-h)"} opacity={0.2 + 0.8 * lvl} style={{ transition: "opacity .5s" }} />
      <ellipse cx="100" cy="246" rx="60" ry="10" fill="#000" opacity={light ? 0.22 : 0.45} filter={"url(#" + uid + "-blur)"} />
      <ellipse cx="100" cy="250" rx="46" ry="9" fill={"url(#" + uid + "-refl)"} opacity="0.7" filter={"url(#" + uid + "-blur)"} />
      {/* тело: металл или стекло */}
      <path d={v.body.split(" M")[0]} fill={v.metal ? "url(#" + uid + "-m)" : "url(#" + uid + "-g)"} />
      <g clipPath={lvl < 1 ? "url(#" + uid + "-lvl)" : undefined}>
        {lvl > 0 && <><path d={v.liq} fill={"url(#" + uid + "-l)"} opacity={v.metal ? 0.55 : 0.92} /><path d={v.liq} fill={"url(#" + uid + "-lum)"} /><path d={v.liq} fill={"url(#" + uid + "-shade)"} /></>}
        {ice && <g clipPath={"url(#" + uid + "-c)"}>{(ice === "crushed" ? Array.from({ length: 16 }).map((_, i) => [74 + (i * 37) % 50, lyB - 14 - (i * 23) % 100, 4]) : [[82, lyB - 22, 0], [108, lyB - 30, 6], [92, lyB - 52, -8], [116, lyB - 58, 4]]).map(([cx, cy, rot], i) => ice === "crushed"
          ? <circle key={i} cx={cx} cy={cy} r="4" fill="#FFF" fillOpacity="0.5" />
          : <g key={i} transform={`rotate(${rot} ${cx} ${cy})`} style={{ animation: `saLabBob ${2.2 + i * 0.4}s ease-in-out infinite` }}><rect x={cx - 10} y={cy - 10} width="20" height="20" rx="4" fill="#FFF" fillOpacity="0.28" stroke="#FFF" strokeOpacity="0.7" strokeWidth="1.2" /><path d={`M${cx - 6} ${cy - 4} l4 -4`} stroke="#FFF" strokeOpacity="0.9" strokeWidth="1.2" strokeLinecap="round" /></g>)}</g>}
        {lvl > 0 && (() => { const k = 0.85 + 0.15 * lvl; const hw = ((lx1 - lx0) / 2) * k; return (<><g clipPath={"url(#" + uid + "-c)"}><rect x="0" y={liqTop} width="200" height="8" fill="#FFF" fillOpacity="0.14" /></g><ellipse cx="100" cy={liqTop} rx={hw} ry="3.4" fill="#FFF" fillOpacity="0.12" stroke="#FFF" strokeOpacity="0.5" strokeWidth="1" /></>); })()}
      </g>
      {v.ribs && <g clipPath={"url(#" + uid + "-b)"}>{[70, 84, 98, 112, 126].map(x => <path key={x} d={`M${x} 60 L${x + (x < 100 ? 2 : -2)} 226`} stroke="#000" strokeOpacity="0.14" strokeWidth="3" />)}</g>}
      <path d={v.body} fill="none" stroke={edge} strokeOpacity="0.16" strokeWidth="1.2" strokeLinejoin="round" />
      <path d={v.body} fill="none" stroke={"url(#" + uid + "-e)"} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      {v.cap && <><path d={v.cap} fill={"url(#" + uid + "-m)"} stroke={"url(#" + uid + "-e)"} strokeWidth="2" strokeLinejoin="round" /><path d="M70 60 L130 60" stroke={edge} strokeOpacity="0.35" strokeWidth="1" /><path d="M76 34 q0 18 3 34" stroke={edge} strokeOpacity="0.7" strokeWidth="2" fill="none" strokeLinecap="round" /></>}
      <ellipse cx={v.rim[0]} cy={v.rim[1]} rx={v.rim[2]} ry="5" fill={edge} fillOpacity="0.05" stroke={edge} strokeOpacity="0.5" strokeWidth="1.4" />
      <path d={kind === "shaker" ? "M76 84 q-2 60 4 128" : "M72 54 q-2 70 6 158"} stroke={"url(#" + uid + "-spec)"} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      {v.spoon && <><path d="M146 8 L92 200" stroke={edge} strokeOpacity="0.85" strokeWidth="2.4" strokeLinecap="round" /><path d="M146 8 L92 200" stroke={edge} strokeOpacity="0.35" strokeWidth="5" strokeLinecap="round" /><ellipse cx="90" cy="206" rx="8" ry="5" fill={edge} fillOpacity="0.85" transform="rotate(-70 90 206)" /></>}
      {frost && <g clipPath={"url(#" + uid + "-b)"} style={{ animation: "saLabFrost 2.6s ease-out forwards" }}>{[[78, 0.2, 5], [118, 0.35, 3.5], [90, 0.55, 4], [124, 0.7, 5], [82, 0.82, 3], [104, 0.9, 4.5], [110, 0.15, 2.5], [96, 0.42, 2.5]].map(([x, t, r], i) => <circle key={i} cx={x} cy={ly0 + 10 + t * (lyB - ly0 - 24)} r={r} fill={"url(#" + uid + "-dew)"} />)}</g>}
    </svg>
  );
}

