// ui/css.js
// Инъекция CSS-анимаций и блокировка горизонтального свайпа.
// Из App.jsx (строки 4055–4173). Вызов injectStyles() остаётся в App.jsx.

export const injectStyles = () => {
  if (document.getElementById("sa-styles")) return;
  const style = document.createElement("style");
  style.id = "sa-styles";
  style.textContent = `
    /* Убираем мерцающий «квадрат»/системную подсветку при тапе на мобильных */
    * { -webkit-tap-highlight-color: transparent; }
    /* Фокус-рамку у кнопок и тап-элементов прячем при тапе/мыши, но оставляем для клавиатуры (доступность) */
    button:focus:not(:focus-visible),
    [role="button"]:focus:not(:focus-visible),
    [tabindex]:focus:not(:focus-visible) { outline: none; }
    input, textarea, select, button { font-family: inherit; }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeInFast {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes slideInRight {
      from { opacity: 0; transform: translateX(24px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes slideInLeft {
      from { opacity: 0; transform: translateX(-24px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes popIn {
      from { opacity: 0; transform: scale(0.92); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes pulse {
      0%   { box-shadow: 0 0 0 0 rgba(212,168,90,0.4); }
      70%  { box-shadow: 0 0 0 10px rgba(212,168,90,0); }
      100% { box-shadow: 0 0 0 0 rgba(212,168,90,0); }
    }
    @keyframes shimmer {
      0%   { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
    @keyframes progressFill {
      from { width: 0%; }
    }
    @keyframes logoPulse {
      0%, 100% { opacity: 0.45; transform: scale(0.96); }
      50%      { opacity: 1;    transform: scale(1); }
    }
    .sa-screen   { animation: fadeIn 0.45s cubic-bezier(0.16,1,0.3,1) both; }
    .sa-slide-r  { animation: slideInRight 0.28s cubic-bezier(0.4,0,0.2,1) both; }
    .sa-slide-l  { animation: slideInLeft 0.28s cubic-bezier(0.4,0,0.2,1) both; }
    .sa-pop      { animation: popIn 0.4s cubic-bezier(0.16,1,0.3,1) both; }
    .sa-fast     { animation: fadeInFast 0.2s ease both; }

    .sa-tiles-strip::-webkit-scrollbar { display: none; }
    .sa-card {
      transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
    }
    .sa-card:active {
      transform: scale(0.97);
      box-shadow: none !important;
      opacity: 0.85;
    }
    .sa-btn {
      transition: transform 0.12s ease, opacity 0.12s ease, box-shadow 0.2s ease;
    }
    @keyframes chipPop {
      0% { transform: scale(0.9); }
      60% { transform: scale(1.07); }
      100% { transform: scale(1); }
    }
    .sa-chip-on {
      animation: chipPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .sa-btn:active {
      transform: scale(0.96);
      opacity: 0.85;
    }
    .sa-btn-pulse:active {
      animation: pulse 0.4s ease;
    }
    .sa-opt {
      transition: background 0.18s ease, border-color 0.18s ease, transform 0.12s ease;
    }
    .sa-opt:active {
      transform: scale(0.98);
    }
    .sa-stagger > * {
      animation: fadeIn 0.3s cubic-bezier(0.4,0,0.2,1) both;
    }
    .sa-stagger > *:nth-child(1) { animation-delay: 0.04s; }
    .sa-stagger > *:nth-child(2) { animation-delay: 0.08s; }
    .sa-stagger > *:nth-child(3) { animation-delay: 0.12s; }
    .sa-stagger > *:nth-child(4) { animation-delay: 0.16s; }
    .sa-stagger > *:nth-child(5) { animation-delay: 0.20s; }
    .sa-stagger > *:nth-child(6) { animation-delay: 0.24s; }
    .sa-stagger > *:nth-child(7) { animation-delay: 0.28s; }
    .sa-stagger > *:nth-child(8) { animation-delay: 0.32s; }
    .sa-stagger > *:nth-child(n+9) { animation-delay: 0.36s; }
    .sa-progress { animation: progressFill 0.8s cubic-bezier(0.4,0,0.2,1) both; }
    .sa-glass {
      /* Блюр снят: на скролле он пересэмплировался каждый кадр и давал
         мерцание карточек ролей/уроков. Лёд по всему приложению без блюра. */
    }
    .sa-glass:active {
      transform: scale(0.97);
      opacity: 0.88;
    }
    .sa-dot { transition: background 0.2s ease, transform 0.2s ease; }
    .sa-dot-active { transform: scale(1.3); }
    /* Скролл живёт в контейнере #root, а не в документе: на Android
       Telegram-шторка перехватывает вертикальные жесты документа (и на
       старых клиентах disableVerticalSwipes отсутствует). Контейнерный
       скролл она не трогает — работает на любой версии клиента. */
    html, body { height: 100%; overflow: hidden !important; touch-action: pan-y; }
    #root { height: 100%; overflow-y: auto; overflow-x: hidden;
      -webkit-overflow-scrolling: touch; overscroll-behavior-y: contain; touch-action: pan-y; }
    #root { scrollbar-width: none; }
    #root::-webkit-scrollbar { display: none; }
    * { touch-action: pan-y !important; }
    /* Плавное перелистывание карточек (уроки, тренажёры): въезд с той стороны, куда листаешь */
    @keyframes saCardR { from { opacity: 0; transform: translateX(26px); } to { opacity: 1; transform: none; } }
    @keyframes saCardL { from { opacity: 0; transform: translateX(-26px); } to { opacity: 1; transform: none; } }
    .sa-cardpage-r { animation: saCardR .34s cubic-bezier(.16,1,.3,1) backwards; }
    .sa-cardpage-l { animation: saCardL .34s cubic-bezier(.16,1,.3,1) backwards; }
    @media (prefers-reduced-motion: reduce) { .sa-cardpage-r, .sa-cardpage-l { animation: none; } }
    /* Исключение: горизонтальные ленты (вкладки книги и т.п.) можно листать пальцем */
    .sa-hscroll, .sa-hscroll * { touch-action: pan-x pan-y !important; }
    /* Лента жетонов: скроллбар прячем, свайп остаётся */
    .sa-tilesrow { scrollbar-width: none; }
    .sa-tilesrow::-webkit-scrollbar { display: none; }
    /* ВСЕ поля ввода приложения: золотая каретка и читаемый плейсхолдер
       в обеих темах (тема задаётся классом sa-light на <html>) */
    input, textarea, select { caret-color: #C8A96E; }
    input::placeholder, textarea::placeholder { color: rgba(200, 180, 152, 0.65); opacity: 1; }
    .sa-light input, .sa-light textarea, .sa-light select { caret-color: #8B6A30; }
    .sa-light input::placeholder, .sa-light textarea::placeholder { color: rgba(90, 70, 50, 0.62); opacity: 1; }
    /* Поля чатов (Наставник, AI-интервью): инеевый плейсхолдер в тёмной —
       в тон ледяным пузырям */
    .sa-aiinput-dark::placeholder { color: rgba(216, 206, 190, 0.58); opacity: 1; }
    /* Живой диалог: под шторкой страница не должна «резинить» (iOS rubber-band).
       Жесты запрещены везде, кроме ленты реплик — ей разрешена только вертикаль. */
    .sa-dlg, .sa-dlg * { touch-action: none !important; }
    .sa-dlg .sa-dlgscroll, .sa-dlg .sa-dlgscroll * { touch-action: pan-y !important; }
    /* Android строже iOS: жест требует разрешения по ВСЕЙ цепочке предков
       скролл-зоны. Корню шторки и промежуточным контейнерам (sa-dlgpath)
       разрешаем вертикаль; мёртвые зоны (шапка, кнопки) остаются none. */
    .sa-dlg, .sa-dlg .sa-dlgpath { touch-action: pan-y !important; }
    html, body { overscroll-behavior: none; }

    /* Переход между экранами: каждый мягко въезжает (fade + сдвиг) */
    @keyframes saPageIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
    .sa-pagein { animation: saPageIn .28s cubic-bezier(.16,1,.3,1) backwards; }
    /* Мерцающий скелетон стеклянных карточек на время ленивой подгрузки */
    @keyframes saShimmer { from { background-position:-200% 0; } to { background-position:200% 0; } }
    .sa-skel { background: linear-gradient(100deg, rgba(200,169,110,0.07) 40%, rgba(230,200,140,0.16) 50%, rgba(200,169,110,0.07) 60%); background-size:200% 100%; animation: saShimmer 1.4s linear infinite; }
    @keyframes saPulse { 0%,100% { opacity:.35; } 50% { opacity:.85; } }
    .sa-pulse { animation: saPulse 1.15s ease-in-out infinite; }
    /* Онбординг: появление подложки, «выпрыгивание» иконки, всплытие подсказки */
    @keyframes saFadeIn { from { opacity:0; } to { opacity:1; } }
    .sa-fadein { animation: saFadeIn .3s ease both; }
    @keyframes saPop { from { opacity:0; transform:scale(0.7); } 60% { transform:scale(1.06); } to { opacity:1; transform:scale(1); } }
    .sa-pop { animation: saPop .45s cubic-bezier(.16,1,.3,1) backwards; }
    @keyframes saHintIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }
    .sa-hintin { animation: saHintIn .38s cubic-bezier(.16,1,.3,1) both; }
    @media (prefers-reduced-motion: reduce) { .sa-pagein, .sa-skel, .sa-pulse, .sa-fadein, .sa-pop, .sa-hintin { animation:none; } }

    /* ══ «Сборка» — фирменный формат практики роли «Бар» (ui/build.jsx) ══ */
    .sa-opt{width:100%;text-align:left;display:flex;align-items:center;gap:11px;
      padding:13px 14px;margin-bottom:8px;border-radius:12px;cursor:pointer;
      background:rgba(255,250,238,0.045);border:1px solid #4A3525;color:#E8DEC8;
      font-family:Georgia,serif;font-size:14.5px;line-height:1.35;
      transition:border-color .2s,background .2s,transform .12s}
    .sa-opt:active{transform:scale(.985)}
    .sa-opt[disabled]{cursor:default}
    .sa-optk{flex:0 0 24px;height:24px;border-radius:7px;display:grid;place-items:center;
      font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#B09060;
      border:1px solid rgba(200,169,110,0.35)}
    .sa-opt.win{border-color:#5DBB8A;background:rgba(93,187,138,0.13)}
    .sa-opt.win .sa-optk{background:#5DBB8A;color:#0d2318;border-color:#5DBB8A}
    .sa-opt.lose{border-color:#E07878;background:rgba(224,120,120,0.11)}
    .sa-opt.lose .sa-optk{background:#E07878;color:#2a0d0d;border-color:#E07878}
    .sa-opt.off{opacity:.4}
    .sa-fb{margin-top:12px;padding:12px 14px;border-radius:12px;font-size:13.5px;line-height:1.5}
    .sa-fb.win{background:rgba(93,187,138,0.10);border:1px solid rgba(93,187,138,0.4);color:#BFE6D0}
    .sa-fb.lose{background:rgba(224,120,120,0.09);border:1px solid rgba(224,120,120,0.38);color:#F0C9C9}
    .sa-term{display:inline-block;margin-top:10px;padding:4px 10px;border-radius:999px;
      font-size:11px;color:#D4A85A;background:rgba(200,169,110,0.12);
      border:1px solid rgba(200,169,110,0.34)}

    /* носитель: сосуд */
    .sa-vessel{position:relative;margin:0 auto;overflow:hidden;
      border:2px solid rgba(210,190,160,0.42);border-top:0;
      background:linear-gradient(100deg,rgba(255,255,255,0.055) 0%,rgba(255,255,255,0.012) 42%,rgba(255,255,255,0.05) 100%);
      transition:width .45s cubic-bezier(.3,1,.4,1),height .45s cubic-bezier(.3,1,.4,1),border-radius .45s}
    .sa-vessel.high{width:62px;height:152px;border-radius:4px 4px 9px 9px}
    .sa-vessel.rocks{width:84px;height:96px;border-radius:3px 3px 6px 6px;border-width:3px;
      box-shadow:inset 0 -14px 18px rgba(255,255,255,0.07)}
    .sa-vessel::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;
      box-shadow:inset 3px 0 7px rgba(255,255,255,0.13),inset -4px 0 8px rgba(0,0,0,0.34)}
    .sa-vessel.spoiled{border-color:rgba(224,120,120,0.45)}
    .sa-vessel.spoiled .sa-layer{filter:saturate(.4) brightness(.85)}
    .sa-rim{position:absolute;top:-2px;left:-2px;right:-2px;height:5px;border-radius:50%;z-index:4;
      background:linear-gradient(90deg,rgba(255,255,255,0.10),rgba(255,255,255,0.42),rgba(255,255,255,0.10))}
    .sa-layers{position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column-reverse}
    .sa-layer{width:100%}
    .sa-layer.fresh{animation:saPourGrow .75s cubic-bezier(.25,.9,.35,1)}
    .sa-surface{position:absolute;left:0;right:0;height:5px;border-radius:50%;z-index:3;
      background:rgba(255,255,255,0.30);transition:bottom .6s cubic-bezier(.3,1,.4,1)}
    .sa-surface.fresh{animation:saSettle .85s cubic-bezier(.3,1.4,.5,1) .1s}
    .sa-pour{position:absolute;top:0;left:50%;margin-left:-2px;width:4px;height:100%;z-index:3;
      transform-origin:top;border-radius:2px;
      background:linear-gradient(180deg,rgba(255,255,255,0.55),rgba(255,255,255,0.06));
      animation:saPourStream .75s ease-out forwards}
    .sa-cube{position:absolute;border-radius:3px;background:rgba(238,248,255,0.26);z-index:2;
      border:1px solid rgba(255,255,255,0.30);box-shadow:inset 0 2px 3px rgba(255,255,255,0.3)}
    .sa-cube.fresh{animation:saIceDrop .55s cubic-bezier(.35,1.1,.45,1) backwards}
    .sa-bubble{position:absolute;border-radius:50%;background:rgba(255,255,255,0.55);z-index:3;
      animation:saBubble linear infinite}
    .sa-drop{position:absolute;border-radius:50%;background:rgba(255,255,255,0.16);z-index:5;
      animation:saDropSlide ease-in infinite}
    .sa-pulp{position:absolute;border-radius:50% 40% 50% 40%;z-index:2;
      background:linear-gradient(140deg,rgba(150,196,92,0.9),rgba(96,140,52,0.95));
      box-shadow:0 0 3px rgba(0,0,0,0.25)}
    .sa-wedge{position:absolute;width:16px;height:11px;border-radius:0 0 16px 16px;z-index:2;
      background:linear-gradient(180deg,rgba(206,226,120,0.9),rgba(160,190,70,0.95));
      border-top:2px solid rgba(240,248,200,0.75)}
    .sa-garnish{position:absolute;top:-10px;left:50%;font-size:28px;z-index:6;
      transform:translateX(-50%);filter:drop-shadow(0 3px 5px rgba(0,0,0,0.5));
      animation:saGarnishIn .6s cubic-bezier(.3,1.4,.5,1),saGarnishSway 4.5s ease-in-out .6s infinite}
    @keyframes saPourGrow{from{height:0}}
    @keyframes saPourStream{0%{opacity:0;transform:scaleY(0)}12%{opacity:.85;transform:scaleY(1)}
      72%{opacity:.85}100%{opacity:0}}
    @keyframes saSettle{0%{transform:scaleY(2.4)}45%{transform:scaleY(.65)}72%{transform:scaleY(1.3)}100%{transform:scaleY(1)}}
    @keyframes saBubble{0%{transform:translateY(0) scale(.5);opacity:0}14%{opacity:.85}
      82%{opacity:.7}100%{transform:translateY(var(--rise)) scale(1.1);opacity:0}}
    @keyframes saIceDrop{0%{transform:translateY(-72px) rotate(0);opacity:0}55%{opacity:1}
      74%{transform:translateY(6px) rotate(var(--rot))}100%{transform:translateY(0) rotate(var(--rot));opacity:1}}
    @keyframes saGarnishIn{0%{transform:translate(-50%,-26px) rotate(-22deg);opacity:0}
      70%{transform:translate(-50%,3px) rotate(6deg);opacity:1}100%{transform:translate(-50%,0) rotate(0);opacity:1}}
    @keyframes saGarnishSway{0%,100%{transform:translate(-50%,0) rotate(-3deg)}50%{transform:translate(-50%,0) rotate(3deg)}}
    @keyframes saDropSlide{0%{transform:translateY(0);opacity:0}18%{opacity:.6}100%{transform:translateY(var(--slide));opacity:0}}

    /* носитель: станция сверху */
    .sa-station{flex:0 0 152px;padding:8px;border-radius:10px;background:rgba(0,0,0,0.32);
      border:1px solid rgba(150,112,42,0.28);transition:.4s}
    .sa-station.clean{border-color:rgba(200,169,110,0.5);box-shadow:inset 0 0 20px rgba(214,170,80,0.08)}
    .sa-station.spoiled{border-color:rgba(224,120,120,0.35)}
    .sa-icebin{position:relative;height:26px;border-radius:7px;margin-bottom:6px;overflow:hidden;
      display:flex;align-items:center;padding:0 7px;font-size:8.5px;color:#756A58;
      background:rgba(255,255,255,0.03);border:1px dashed rgba(255,255,255,0.12);transition:.4s}
    .sa-icebin.on{color:#CFE4EF;border-style:solid;border-color:rgba(160,200,230,0.38);background:rgba(150,195,230,0.13)}
    .sa-icebin i{position:absolute;width:7px;height:7px;border-radius:2px;background:rgba(235,248,255,0.5)}
    .sa-zone{padding:5px 7px;border-radius:7px;margin-bottom:4px;
      background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.07);transition:.4s}
    .sa-zone.on{background:rgba(200,169,110,0.11);border-color:rgba(200,169,110,0.36)}
    .sa-zname{font-family:ui-monospace,Menlo,monospace;font-size:7px;letter-spacing:1.1px;
      text-transform:uppercase;color:#756A58;margin-bottom:3px}
    .sa-zone.on .sa-zname{color:#D4A85A}
    .sa-zchip{font-size:8.5px;padding:2px 5px;border-radius:999px;color:#E8DEC8;
      background:rgba(200,169,110,0.17);border:1px solid rgba(200,169,110,0.3)}

    /* носитель: цепочка стадий */
    .sa-fstage{flex:1;min-width:0;text-align:center;position:relative}
    .sa-fring{width:38px;height:38px;margin:0 auto;border-radius:50%;display:grid;place-items:center;
      font-size:17px;background:rgba(255,255,255,0.03);border:1.5px solid rgba(255,255,255,0.10);
      filter:grayscale(1) opacity(.45);transition:.45s;position:relative;z-index:2}
    .sa-fnm{font-size:9px;color:#756A58;margin-top:6px;line-height:1.2;
      font-family:ui-monospace,Menlo,monospace;letter-spacing:.3px}
    .sa-fbar{position:absolute;top:19px;left:-50%;width:100%;height:2px;
      background:rgba(255,255,255,0.09);z-index:1;transition:.45s}
    .sa-fstage.on .sa-fring{filter:none;background:rgba(200,169,110,0.16);border-color:#C8A96E;
      box-shadow:0 0 14px rgba(200,169,110,0.28)}
    .sa-fstage.on .sa-fnm{color:#D4A85A}
    .sa-fstage.on .sa-fbar{background:linear-gradient(90deg,rgba(200,169,110,0.2),#C8A96E)}
    .sa-fstage.bad .sa-fring{filter:none;background:rgba(224,120,120,0.15);border-color:#E07878}
    .sa-fstage.bad .sa-fnm{color:#E07878}
    .sa-fstage.bad .sa-fbar{background:linear-gradient(90deg,rgba(224,120,120,0.2),#E07878)}
    .sa-fstage.now .sa-fring{filter:none;border-color:#C8A96E;border-style:dashed}
    .sa-fstage.now .sa-fnm{color:#C8A96E}
    @media (prefers-reduced-motion: reduce){
      .sa-layer,.sa-surface,.sa-pour,.sa-cube,.sa-bubble,.sa-drop,.sa-garnish{animation:none}
      .sa-bubble,.sa-drop,.sa-pour{opacity:0}
    }
  `;
  document.head.appendChild(style);

  // Блокируем горизонтальный свайп через JS (кроме лент с классом sa-hscroll)
  let startX = 0, startY = 0, inHScroll = false;
  document.addEventListener("touchstart", e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    inHScroll = !!(e.target && e.target.closest && e.target.closest(".sa-hscroll"));
  }, { passive: true });
  document.addEventListener("touchmove", e => {
    if (inHScroll) return; // внутри горизонтальной ленты жест отдаём браузеру
    const dx = Math.abs(e.touches[0].clientX - startX);
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (dx > dy) e.preventDefault();
  }, { passive: false });
};
