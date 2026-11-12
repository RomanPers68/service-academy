// ui/look-v146.js — v146 (Доп. 467): «Линза» без лишнего — главная кнопка золотом, меньше колец, треки цветом.
// Отдельным файлом и отдельным тегом <style> после правил ui/home-look.jsx (ensureLookCss зовёт ensureLookV146Css): разделы
// home-look.jsx закрыты своими проверками («v122 — последний»), а здесь правила, которые их перекрывают.
// Все правила — под html.sa-lens: в виде «как сейчас» экраны прежние до пикселя (как у всей «Линзы», v102).
// :not(#sa-v146) — вес селектора как у id: правило перекрывает прежние, сколько бы классов у тех ни было.
export const LOOK_V146_CSS = `
/* ── v146 (Доп. 467). Владелец (12.11) на разбор «чтобы человек захотел остаться» — «Давай все»:
   1) «Одна главная кнопка на экране, залитая золотом»: в v146 — «Начать» на главной золотым корешком и золото на всех кнопках
      data-lens-btn="main" и .tb-main. v147 (Доп. 470–471) вернул кнопкам линзы с одним кольцом, «Начать» — линза с подсветкой.
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
/* v147 (Доп. 470): кнопки — снова линзы. Золото v146 легло на все кнопки с data-lens-btn="main" и .tb-main (их ~170 на ~45
   экранах, в «Графике» — до трёх золотых рядом); владелец: «Некоторые кнопки сменили линзы на золотые». Остаётся только
   одно кольцо — внешнее (::after) скрыто, как у остальных «меньше колец»; стекло, ободок и свет — прежние (ui/home-look.jsx). */
html.sa-lens [data-lens-btn="main"]:not(#sa-v146)::after,html.sa-lens .tb-main:not(#sa-v146)::after{display:none!important}
/* «Начать» на карточке «сейчас» — v147 (Доп. 471): линза с подсветкой и одним кольцом. В v146 был золотой корешок билета;
   владелец: «Давай подумаем над этой кнопкой. Как будто она не вписывается. Особенно заметно в теме для чтения». Из трёх
   вариантов («как было» — линза с двумя кольцами, линза с подсветкой, золотая монета) — линза с подсветкой: стекло светлее,
   ободок ярче, вокруг — мягкое свечение, второе кольцо (span в линзе) скрыто, надпись — золотом. Корешок уже (84 px вместо 98),
   чтобы заголовку оставалось места, как в v146; длинное («Начать проверку», «Другие треки ›») — в две строки по центру. */
html.sa-lens .sa-look-lens [data-now-stub]:not(#sa-v146){width:84px!important;background:radial-gradient(80% 55% at 50% 40%,rgba(232,201,131,0.15),rgba(232,201,131,0) 72%)}
html.sa-lens .sa-look-lens [data-now-stub] [data-now-lens]:not(#sa-v146){width:50px!important;height:50px!important;
  background:radial-gradient(circle at 50% 28%,rgba(240,214,150,0.34),rgba(200,169,110,0.13) 72%)!important;
  box-shadow:inset 0 0 0 1.5px rgba(232,201,131,0.9),inset 0 0 16px rgba(255,230,170,0.16),inset 0 1.5px 0 rgba(255,255,255,0.32),0 0 20px rgba(232,201,131,0.3)!important}
html.sa-lens .sa-look-lens [data-now-stub] [data-now-lens]:not(#sa-v146)>span{display:none!important}
html.sa-lens .sa-look-lens [data-now-stub] [data-now-lens]:not(#sa-v146) svg{stroke:#F1DBA4!important}
html.sa-lens .sa-look-lens [data-now-stub] [data-now-cta]:not(#sa-v146){color:#E8C983!important;font-size:16px!important;font-weight:bold!important;text-align:center;line-height:1.15}
html.sa-lens.sa-light .sa-look-lens [data-now-stub]:not(#sa-v146){background:radial-gradient(80% 55% at 50% 40%,rgba(176,138,70,0.12),rgba(176,138,70,0) 72%)}
html.sa-lens.sa-light .sa-look-lens [data-now-stub] [data-now-lens]:not(#sa-v146){background:radial-gradient(circle at 50% 28%,rgba(255,255,255,0.95),rgba(176,138,70,0.2) 75%)!important;
  box-shadow:inset 0 0 0 1.5px rgba(139,106,48,0.8),inset 0 0 14px rgba(255,255,255,0.6),inset 0 1.5px 0 #fff,0 0 16px rgba(176,138,70,0.28)!important}
html.sa-lens.sa-light .sa-look-lens [data-now-stub] [data-now-lens]:not(#sa-v146) svg{stroke:#6B4E1A!important}
html.sa-lens.sa-light .sa-look-lens [data-now-stub] [data-now-cta]:not(#sa-v146){color:#6B4E1A!important}
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
