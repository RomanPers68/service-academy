// ui/home-look.jsx — v101 (Доп. 414): вид главной «Линза» (lib/home-look.js — выбор). Раскладка RoleSelect прежняя;
// здесь только стили по классу на корне главной (.sa-look-lens): всё круглое — линзы, как кнопка AI, карточки — тем же
// стеклом с той же кромкой и светом. Блоки помечены data-атрибутами (их ставят ui/screens-roleselect.jsx,
// ui/day-cards.jsx, ui/now-hero.jsx, ui/tracks-row.jsx); у части блоков стили заданы прямо в разметке — их перекрываем
// с !important.
//   Кружки инструментов: кольцо — по краю кружка, стекло — внутри (::before). Ряд инструментов обрезан по высоте (подписи
//   выезжают вбок), и кольцо снаружи срезалось сверху и снизу (владелец: «линзы выглядят не ровными, как будто обрезаны»);
//   по той же причине у инструментов нет внешней тени.

const CSS = `
.sa-look{--lk-gold:#C8A96E;--lk-hi:#E8C983;--lk-glass:rgba(200,169,110,0.12);--lk-rim:rgba(214,178,102,0.45);--lk-glow:rgba(255,230,170,0.12);
  --lk-hl:rgba(255,255,255,0.18);--lk-ring:rgba(214,178,102,0.44);--lk-card:rgba(226,186,116,0.11);--lk-edge:rgba(214,178,102,0.30);
  --lk-shadow:0 5px 16px rgba(0,0,0,0.45);--lk-sos:234,140,140;--lk-light:rgba(214,178,102,0.10)}
html.sa-light .sa-look{--lk-gold:#7A5D2A;--lk-hi:#8A6524;--lk-glass:rgba(139,106,48,0.09);--lk-rim:rgba(139,106,48,0.48);--lk-glow:rgba(255,255,255,0.5);
  --lk-hl:rgba(255,255,255,0.95);--lk-ring:rgba(139,106,48,0.32);--lk-card:rgba(250,242,222,0.62);--lk-edge:rgba(139,106,48,0.30);
  --lk-shadow:0 4px 12px rgba(120,85,25,0.18);--lk-sos:163,58,42;--lk-light:rgba(255,255,255,0.55)}

/* ── «Линза»: всё круглое — линзы, как кнопка AI; карточки — тем же стеклом с той же кромкой и светом ── */
.sa-look-lens .de-medal{border-radius:50%;background:var(--lk-glass);box-shadow:inset 0 0 0 1px var(--lk-rim),inset 0 0 14px var(--lk-glow),inset 0 1.5px 0 var(--lk-hl)}
.sa-look-lens .de-medal::after{content:"";position:absolute;inset:-3.5px;border-radius:50%;border:1px solid var(--lk-ring);pointer-events:none}
.sa-look-lens .de-medal>svg>circle:not(.de-arc):not([data-medal-glow]){fill:transparent;stroke:transparent}
.sa-look-lens [data-tool-disc]{background:transparent!important}
.sa-look-lens [data-tool-disc]::before{content:"";position:absolute;inset:2.5px;border-radius:50%;background:var(--lk-glass);pointer-events:none;
  box-shadow:inset 0 0 0 1px var(--lk-rim),inset 0 0 12px var(--lk-glow),inset 0 1.5px 0 var(--lk-hl),inset 0 -9px 12px -7px var(--tint,transparent)}
.sa-look-lens [data-tool-disc]::after{content:"";position:absolute;inset:0;border-radius:50%;border:1px solid var(--lk-ring);pointer-events:none}
.sa-look-lens [data-tool-disc]>svg{position:relative}
.sa-look-lens [data-tool-disc]>span{z-index:1}
.sa-look-lens [data-sos-disc]{position:relative;border:0!important;background:rgba(var(--lk-sos),0.10)!important;
  box-shadow:inset 0 0 0 1px rgba(var(--lk-sos),0.62),inset 0 0 14px rgba(var(--lk-sos),0.16),inset 0 1.5px 0 var(--lk-hl)!important}
.sa-look-lens [data-sos-disc]::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:1px solid rgba(var(--lk-sos),0.42);pointer-events:none}
.sa-look-lens [data-orb-glass]{background:var(--lk-glass)!important;box-shadow:inset 0 0 0 1px var(--lk-rim),inset 0 0 16px var(--lk-glow),inset 0 1.5px 0 var(--lk-hl),inset 0 -12px 16px -10px var(--tint,transparent)!important}
.sa-look-lens [data-track-chip][data-track-sel] [data-orb-glass]{box-shadow:inset 0 0 0 1.5px var(--lk-hi),inset 0 0 16px var(--lk-glow),0 0 0 3px rgba(214,178,102,0.16),0 0 18px rgba(214,178,102,0.38)!important}
.sa-look-lens [data-track-chip]:not([data-track-locked]) svg circle:first-child{stroke:var(--lk-ring);stroke-width:1px}
.sa-look-lens [data-track-chip] svg circle+circle{stroke:var(--lk-gold)}
.sa-look-lens .sa-dp,.sa-look-lens [data-tile],.sa-look-lens [data-tools-capsule],.sa-look-lens [data-pulse]{border-color:var(--lk-edge)!important;
  box-shadow:inset 0 1.5px 0 var(--lk-hl),inset 0 0 22px var(--lk-glow),var(--lk-shadow)!important}
.sa-look-lens .sa-dp,.sa-look-lens [data-tile],.sa-look-lens [data-tools-capsule]{background:radial-gradient(120% 90% at 20% 0%,var(--lk-light),transparent 60%),var(--lk-card)!important}
.sa-look-lens [data-tracks-quote]{border-left-color:var(--lk-rim)!important}

`;
export function ensureLookCss() {
  if (typeof document === "undefined" || !document.head || !document.createElement) return;
  if (document.getElementById("sa-home-look-css")) return;
  const st = document.createElement("style"); st.id = "sa-home-look-css"; st.textContent = CSS; document.head.appendChild(st);
}
