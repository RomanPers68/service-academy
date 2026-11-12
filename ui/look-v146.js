// ui/look-v146.js — v146 (Доп. 467): «Линза» без лишнего — главная кнопка золотом, меньше колец, треки цветом.
// Отдельным файлом и отдельным тегом <style> после правил ui/home-look.jsx (ensureLookCss зовёт ensureLookV146Css): разделы
// home-look.jsx закрыты своими проверками («v122 — последний»), а здесь правила, которые их перекрывают.
// Все правила — под html.sa-lens: в виде «как сейчас» экраны прежние до пикселя (как у всей «Линзы», v102).
// :not(#sa-v146) — вес селектора как у id: правило перекрывает прежние, сколько бы классов у тех ни было.
export const LOOK_V146_CSS = `
/* ── v146 (Доп. 467). Владелец (12.11) на разбор «чтобы человек захотел остаться» — «Давай все»:
   1) «Одна главная кнопка на экране, залитая золотом»: главная кнопка (data-lens-btn="main") и главная кнопка уроков у стола,
      радио и «Живого гостя» (.tb-main) — золотая заливка и тёмная надпись (контраст 5,7–13), без внешнего кольца; всё
      внутри кнопки — цветом надписи (значки тоже). «Начать» на карточке «сейчас» главной — золотой корешок билета.
   2) «Меньше колец»: внешнее кольцо (--lk-ring) больше не рисуется у простых значков, «назад», «закрыть», вкладок и
      строк — у них остаётся одно стекло. Кольцо осталось там, где оно что-то показывает: медальоны главной (серия, цель,
      путь), кружки треков (прогресс), кнопка AI и чат внизу, SOS, «Слушать» у радио.
   3) «Цвет со смыслом»: кружки треков — стекло, ободок и кольцо прогресса цветом трека (переменные --tc, --tc-a, --tc-r
      ставит ui/tracks-row.jsx), под кружком — подпись. Инструменты главной — линзы, как были, но с одним кольцом (Доп. 468:
      голые значки без стекла владелец назвал «невзрачными»).
   :not(#sa-v146) — вес селектора как у id: правила раздела перекрывают прежние, сколько бы классов у тех ни было ── */
html.sa-lens:not(#sa-v146),html.sa-lens .sa-look:not(#sa-v146),html.sa-lens.sa-light .sa-look:not(#sa-v146){--lk-ring:transparent}
html.sa-lens .de-medal:not(#sa-v146),html.sa-lens [data-tracks-row]:not(#sa-v146),html.sa-lens [data-tab-ai]:not(#sa-v146),
html.sa-lens [data-chat-dock]:not(#sa-v146),html.sa-lens .rd-ctl .play:not(#sa-v146){--lk-ring:rgba(214,178,102,0.44)}
html.sa-lens.sa-light .de-medal:not(#sa-v146),html.sa-lens.sa-light [data-tracks-row]:not(#sa-v146),html.sa-lens.sa-light [data-tab-ai]:not(#sa-v146),
html.sa-lens.sa-light [data-chat-dock]:not(#sa-v146),html.sa-lens.sa-light .rd-ctl .play:not(#sa-v146){--lk-ring:rgba(139,106,48,0.32)}
html.sa-lens [data-lens="glyph"]:not(#sa-v146)::after{border-color:transparent!important}
html.sa-lens [data-lens-btn="main"]:not(#sa-v146),html.sa-lens .tb-table .tb-main:not(:disabled):not(#sa-v146),
html.sa-lens .tb-radio .tb-main:not(:disabled):not(#sa-v146),html.sa-lens .tb-guest .tb-main:not(:disabled):not(#sa-v146){
  color:#24180A!important;border-color:transparent!important;text-shadow:none!important;
  background:linear-gradient(172deg,#F1DBA4 0%,#DDBE7F 46%,#BC9A5E 100%)!important;
  box-shadow:inset 0 1px 0 rgba(255,250,235,0.7),inset 0 -1px 0 rgba(120,82,28,0.45),0 6px 16px rgba(214,178,102,0.2),0 2px 6px rgba(0,0,0,0.3)!important}
html.sa-lens.sa-light [data-lens-btn="main"]:not(#sa-v146),html.sa-lens.sa-light .tb-table .tb-main:not(:disabled):not(#sa-v146),
html.sa-lens.sa-light .tb-radio .tb-main:not(:disabled):not(#sa-v146),html.sa-lens.sa-light .tb-guest .tb-main:not(:disabled):not(#sa-v146){
  color:#24180A!important;background:linear-gradient(172deg,#EFD69C 0%,#D7B470 48%,#B48F50 100%)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,0.75),inset 0 -1px 0 rgba(120,82,28,0.4),0 4px 12px rgba(150,110,40,0.28)!important}
html.sa-lens [data-lens-btn="main"]:not(#sa-v146)::after,html.sa-lens .tb-main:not(#sa-v146)::after{display:none!important}
html.sa-lens [data-lens-btn="main"]:not(#sa-v146) *{color:inherit!important}
html.sa-lens [data-lens-btn="main"]:not(#sa-v146) svg[stroke]:not([stroke="none"]),html.sa-lens [data-lens-btn="main"]:not(#sa-v146) svg [stroke]:not([stroke="none"]){stroke:currentColor!important}
html.sa-lens [data-lens-btn="main"]:not(#sa-v146) svg[fill]:not([fill="none"]),html.sa-lens [data-lens-btn="main"]:not(#sa-v146) svg [fill]:not([fill="none"]){fill:currentColor!important}
html.sa-lens [data-lens-btn="main"]:not(#sa-v146):active{filter:brightness(0.94)}
html.sa-lens [data-lens-btn="main"]:disabled:not(#sa-v146),html.sa-lens [data-lens-btn="main"][aria-disabled="true"]:not(#sa-v146){filter:saturate(0.35) brightness(0.82);opacity:0.6}
/* «Начать» на карточке «сейчас» — золотой корешок билета (перфорация остаётся слева) */
html.sa-lens .sa-look-lens [data-now-stub]:not(#sa-v146){position:relative;width:84px!important;margin:8px 8px 8px 0;gap:6px!important;border-radius:12px;
  background:linear-gradient(165deg,#F0D9A4 0%,#D6B577 48%,#B08F55 100%);
  box-shadow:0 8px 22px rgba(214,178,102,0.26),inset 0 1px 0 rgba(255,255,255,0.6),inset 0 -1px 0 rgba(120,82,28,0.4)}
html.sa-lens.sa-light .sa-look-lens [data-now-stub]:not(#sa-v146){background:linear-gradient(165deg,#EFD69C 0%,#D7B470 48%,#B48F50 100%);
  box-shadow:0 6px 16px rgba(150,110,40,0.3),inset 0 1px 0 rgba(255,255,255,0.75),inset 0 -1px 0 rgba(120,82,28,0.4)}
html.sa-lens .sa-look-lens [data-now-stub] [data-now-lens]:not(#sa-v146){background:rgba(42,31,14,0.1)!important;box-shadow:none!important}
html.sa-lens .sa-look-lens [data-now-stub] [data-now-lens]:not(#sa-v146)>span{display:none!important}
html.sa-lens .sa-look-lens [data-now-stub] [data-now-lens]:not(#sa-v146) svg{stroke:#2A1F0E!important}
html.sa-lens .sa-look-lens [data-now-stub] [data-now-cta]:not(#sa-v146){color:#1A1008!important;font-size:17px!important;font-weight:bold!important}
html.sa-lens .sa-look-lens [data-now-stub]>span:last-child:not([data-now-cta]):not([data-now-lens]):not(#sa-v146){color:rgba(42,31,14,0.75)!important;margin-top:-3px!important}
/* инструменты главной — линзы, как были (стекло, ободок, свет сверху и отсвет цвета инструмента снизу), но без второго
   кольца (Доп. 468, владелец: «Может их сделаем линзами, как были, только без второго кольца»): внешнее кольцо (::after)
   скрыто, стекло (::before) — во весь кружок, и его ободок — единственное кольцо */
html.sa-lens .sa-look-lens [data-tool-disc]:not(#sa-v146)::after{display:none!important}
html.sa-lens .sa-look-lens [data-tool-disc]:not(#sa-v146)::before{inset:0}
/* кружки треков — цветом трека */
html.sa-lens .sa-look-lens [data-track-chip]:not([data-track-locked]):not(#sa-v146) [data-orb-glass]{background:var(--tc-a,var(--lk-glass))!important;
  box-shadow:inset 0 0 0 1px var(--tc-r,var(--lk-rim)),inset 0 0 16px var(--lk-glow),inset 0 1.5px 0 var(--lk-hl)!important}
html.sa-lens .sa-look-lens [data-track-chip][data-track-sel]:not([data-track-locked]):not(#sa-v146) [data-orb-glass]{
  box-shadow:inset 0 0 0 1.5px var(--tc,var(--lk-hi)),inset 0 0 16px var(--lk-glow),0 0 0 3px var(--tc-a,rgba(214,178,102,0.16)),0 0 18px var(--tc-r,rgba(214,178,102,0.38))!important}
html.sa-lens .sa-look-lens [data-track-chip]:not([data-track-locked]):not(#sa-v146) svg circle+circle{stroke:var(--tc,var(--lk-gold))}
html.sa-lens .sa-look-lens [data-track-chip]:not([data-track-locked]):not(#sa-v146) [data-track-pct]{color:var(--tc)!important;border-color:var(--tc-r)!important}
`;

export function ensureLookV146Css() {
  if (typeof document === "undefined" || !document.head || !document.createElement) return;
  if (document.getElementById && document.getElementById("sa-look-v146-css")) return;
  const st = document.createElement("style"); st.id = "sa-look-v146-css"; st.textContent = LOOK_V146_CSS; document.head.appendChild(st);
}
