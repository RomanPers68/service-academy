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
    /* Раскрытие ступеней профессии на главной (RoleSelect).
       Контейнер присутствует всегда — так число детей .sa-stagger не меняется
       и колонка ниже не переанимируется при каждом тапе. */
    .sa-tracksub {
      display: flex; flex-direction: column; gap: 8px;
      max-height: 0; overflow: hidden; opacity: 0;
      /* Ограничиваем перерисовку контейнером: иначе на каждом кадре
         пересчитывается и перерисовывается весь список треков ниже. */
      contain: layout paint;
      /* Анимируем ОДИН элемент, а не контейнер плюс каждую ступень отдельно:
         max-height пересчитывает раскладку на каждом кадре, и лишние
         параллельные анимации на телефоне дают рваность.
         Потолок держим близко к реальной высоте двух карточек — чем он выше,
         тем раньше движение фактически заканчивается. */
      transition: max-height 0.62s cubic-bezier(0.25,0.8,0.25,1),
                  opacity 0.44s cubic-bezier(0.25,0.8,0.25,1),
                  margin-bottom 0.62s cubic-bezier(0.25,0.8,0.25,1);
    }
    .sa-tracksub.open { max-height: 190px; opacity: 1; }
    .sa-stagger > .sa-tracksub { animation: none; }
    /* Ступени профессии: нить с номерами слева и компактная строка.
       Так подуровень не путается с самостоятельным треком. */
    .sa-branch{position:relative;padding-left:34px}
    .sa-branch::before{content:"";position:absolute;left:16px;top:3px;bottom:15px;width:2px;border-radius:2px;
      background:linear-gradient(180deg,rgba(200,169,110,0.5),rgba(200,169,110,0.12))}
    .sa-step{position:relative;display:flex;align-items:center;gap:11px;padding:10px 13px;border-radius:14px;
      cursor:pointer;background:rgba(226,186,116,0.07);border:1px solid rgba(145,108,40,0.30);
      border-top:1px solid rgba(210,168,65,0.34);
      box-shadow:inset 0 0 16px rgba(255,248,230,0.05),inset 0 1px 0 rgba(255,255,255,0.10),
                 0 5px 16px rgba(0,0,0,0.30);
      transition:border-color .2s ease,background .2s ease,transform .12s ease}
    .sa-step:active{transform:scale(.99)}
    .sa-step.locked{opacity:.45;cursor:default}
    .sa-step::before{content:"";position:absolute;left:-17px;top:50%;width:15px;height:2px;
      background:rgba(200,169,110,0.34)}
    .sa-stepnum{position:absolute;left:-27px;top:50%;transform:translateY(-50%);z-index:2;
      width:20px;height:20px;border-radius:50%;display:grid;place-items:center;
      background:linear-gradient(160deg,rgba(226,186,116,0.16),rgba(20,17,10,0.96) 62%),#14110A;
      border:2px solid rgba(200,169,110,0.85);border-top-color:rgba(226,186,116,1);
      box-shadow:inset 0 0 8px rgba(255,248,230,0.10),inset 0 1px 0 rgba(255,255,255,0.16),
                 0 2px 6px rgba(0,0,0,0.45);
      font-family:ui-monospace,Menlo,monospace;font-size:9px;color:#C8A96E}
    .sa-step.done .sa-stepnum{background:linear-gradient(160deg,#7FD3A6,#4AA377);
      border-color:#5DBB8A;border-top-color:#8FE0B4;color:#0d2318;
      box-shadow:inset 0 1px 0 rgba(255,255,255,0.35),0 2px 6px rgba(0,0,0,0.35)}
    .sa-step.locked .sa-stepnum{border-color:rgba(255,255,255,0.22);color:rgba(255,255,255,0.35)}
    .sa-steptext{flex:1;min-width:0}
    .sa-steptext b{display:block;font-size:15px;font-weight:normal;line-height:1.2}
    .sa-steptext span{font-size:11.5px;color:#756A58}
    .sa-steppct{font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#D4A85A}
    html.sa-light .sa-branch::before{background:linear-gradient(180deg,rgba(139,106,48,0.45),rgba(139,106,48,0.10))}
    html.sa-light .sa-step{background:rgba(250,242,222,0.60);border-color:rgba(175,140,65,0.22);
      border-top-color:rgba(255,240,200,0.66);
      box-shadow:inset 0 0 16px rgba(255,255,255,0.5),inset 0 1px 0 rgba(255,255,255,0.85),
                 0 3px 12px rgba(120,90,30,0.10)}
    html.sa-light .sa-step::before{background:rgba(139,106,48,0.30)}
    html.sa-light .sa-stepnum{background:linear-gradient(160deg,rgba(255,252,244,0.95),rgba(238,228,204,0.98));
      border-color:rgba(139,106,48,0.8);border-top-color:rgba(255,240,200,0.95);color:#8B6A30;
      box-shadow:inset 0 1px 0 rgba(255,255,255,0.9),0 2px 5px rgba(120,90,30,0.18)}
    html.sa-light .sa-step.done .sa-stepnum{background:linear-gradient(160deg,#3C8A5C,#245C3C);
      border-color:#2A6B45;border-top-color:#4E9E70;color:#fff;
      box-shadow:inset 0 1px 0 rgba(255,255,255,0.28),0 2px 5px rgba(30,70,45,0.28)}
    html.sa-light .sa-steptext span{color:#6B5B40}
    html.sa-light .sa-steppct{color:#8B6A30}
    /* Ступени отдельных анимаций не имеют — проявляются вместе с контейнером */
    .sa-tracksub > * { animation: none !important; }
    @media (prefers-reduced-motion: reduce) {
      .sa-tracksub { transition: none; }
    }
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

    /* ══ График смен ══════════════════════════════════════════════
       Фактура «морозного льда»: тёплый полупрозрачный фон, светлая
       кромка сверху, мягкое внутреннее свечение, никакого блюра. */
    .sa-schedwrap{touch-action:pan-y}
    .sa-schedgrid{max-height:64vh;overflow:auto;-webkit-overflow-scrolling:touch;border-radius:12px}
    .sa-schedgrid table{border-collapse:separate;border-spacing:0}
    /* липкая шапка с числами */
    .sa-schedgrid tr:first-child th{position:sticky;top:0;z-index:4;
      background:linear-gradient(180deg,rgba(226,186,116,0.12),rgba(25,19,9,0.985) 62%),#191309;
      box-shadow:inset 0 1px 0 rgba(255,255,255,0.10),0 2px 8px rgba(0,0,0,0.45)}
    .sa-schedgrid tr:first-child th.sa-schednm{z-index:5}
    /* липкая колонка имён: плотная, иначе строки просвечивают */
    .sa-schednm{position:sticky;left:0;z-index:3;text-align:left;
      background:linear-gradient(100deg,rgba(226,186,116,0.10),rgba(25,19,9,0.985) 58%),#191309;
      border-right:1px solid rgba(200,169,110,0.22);
      box-shadow:inset 1px 0 0 rgba(255,255,255,0.07),inset 0 0 16px rgba(255,248,230,0.04)}
    .sa-schedgrp{background:rgba(200,169,110,0.10);
      border-top:1px solid rgba(210,168,65,0.42);border-bottom:1px solid rgba(200,169,110,0.22);
      box-shadow:inset 0 1px 0 rgba(255,255,255,0.09)}
    .sa-schednm.sa-schedgrp{
      background:linear-gradient(100deg,rgba(226,186,116,0.20),rgba(34,26,13,0.99) 58%),#221a0d;
      box-shadow:inset 0 1px 0 rgba(255,255,255,0.12),inset 0 0 16px rgba(255,248,230,0.07)}
    .sa-schedcell{border-bottom:1px solid rgba(255,255,255,0.05)}
    .sa-schedwe{background:rgba(200,169,110,0.045)}
    .sa-schedzeb td:not(.sa-schednm){background:rgba(255,255,255,0.014)}
    .sa-schedzeb td.sa-schedwe{background:rgba(200,169,110,0.06)}
    .sa-schedrow{background:rgba(226,186,116,0.07);border:1px solid rgba(145,108,40,0.28);
      border-top:1px solid rgba(210,168,65,0.32);
      box-shadow:inset 0 0 14px rgba(255,248,230,0.05),inset 0 1px 0 rgba(255,255,255,0.10)}
    .sa-schedrow.off{background:rgba(255,255,255,0.02);border-color:rgba(255,255,255,0.07)}
    .sa-schednote{padding:10px 12px;border-radius:12px;font-size:13px;line-height:1.5}
    .sa-schednote.ok{background:rgba(93,187,138,0.10);border:1px solid rgba(93,187,138,0.38);
      border-top-color:rgba(140,215,175,0.5);color:#BFE6D0;
      box-shadow:inset 0 0 14px rgba(93,187,138,0.09),inset 0 1px 0 rgba(255,255,255,0.10)}
    .sa-schednote.bad{background:rgba(224,120,120,0.09);border:1px solid rgba(224,120,120,0.38);
      border-top-color:rgba(240,160,160,0.5);color:#F0C9C9;
      box-shadow:inset 0 0 14px rgba(224,120,120,0.08),inset 0 1px 0 rgba(255,255,255,0.09)}
    .sa-schedbar{flex:1;height:3px;border-radius:2px;background:rgba(0,0,0,0.4);overflow:hidden}

    /* ── светлая тема: то же стекло, только свечение белое ── */
    html.sa-light .sa-schedgrid tr:first-child th{
      background:linear-gradient(180deg,rgba(255,250,235,0.98),rgba(240,232,212,0.99));
      box-shadow:inset 0 1px 0 rgba(255,255,255,0.9),0 2px 8px rgba(120,90,30,0.12)}
    html.sa-light .sa-schednm{
      background:linear-gradient(100deg,rgba(255,250,235,0.98),rgba(242,234,214,0.99));
      border-right-color:rgba(175,140,65,0.3);
      box-shadow:inset 0 0 16px rgba(255,255,255,0.6),inset 1px 0 0 rgba(255,255,255,0.8)}
    html.sa-light .sa-schedgrp{background:rgba(200,169,110,0.22);
      border-top-color:rgba(175,140,65,0.5);box-shadow:inset 0 1px 0 rgba(255,255,255,0.7)}
    html.sa-light .sa-schednm.sa-schedgrp{
      background:linear-gradient(100deg,rgba(234,223,198,0.99),rgba(226,214,186,0.99))}
    html.sa-light .sa-schedcell{border-bottom-color:rgba(120,90,30,0.10)}
    html.sa-light .sa-schedwe{background:rgba(200,169,110,0.10)}
    html.sa-light .sa-schedzeb td:not(.sa-schednm){background:rgba(120,90,30,0.035)}
    html.sa-light .sa-schedzeb td.sa-schedwe{background:rgba(200,169,110,0.14)}
    html.sa-light .sa-schedrow{background:rgba(250,242,222,0.72);border-color:rgba(175,140,65,0.26);
      border-top-color:rgba(255,240,200,0.8);
      box-shadow:inset 0 0 18px rgba(255,255,255,0.6),inset 0 1px 0 rgba(255,255,255,0.9)}
    html.sa-light .sa-schedrow.off{background:rgba(255,252,244,0.5);border-color:rgba(175,140,65,0.16)}
    html.sa-light .sa-schednote.ok{background:rgba(42,107,69,0.12);border-color:rgba(42,107,69,0.4);color:#1E4A30}
    html.sa-light .sa-schednote.bad{background:rgba(139,48,32,0.10);border-color:rgba(139,48,32,0.38);color:#6B2418}
    html.sa-light .sa-schedbar{background:rgba(120,90,30,0.16)}

    /* ══ «Сборка» — фирменный формат практики роли «Бар» (ui/build.jsx) ══ */
    .sa-bld-term{display:inline-block;margin-top:10px;padding:4px 10px;border-radius:999px;
      font-family:Georgia,serif;font-size:11px;color:#D4A85A;background:rgba(200,169,110,0.12);
      border:1px solid rgba(200,169,110,0.34);cursor:pointer;transition:background .4s ease,border-color .4s ease,opacity .4s ease,color .4s ease}
    .sa-bld-term:active{transform:scale(.96)}
    .sa-bld-term.flat{cursor:default;opacity:.85}
    .sa-bld-term.open{background:rgba(200,169,110,0.20);border-color:rgba(200,169,110,0.5)}
    .sa-bld-article{margin-top:8px;padding:9px 11px;border-radius:10px;font-size:12.5px;line-height:1.5;
      background:rgba(255,250,238,0.05);border:1px solid rgba(145,108,40,0.28);
      border-top:1px solid rgba(210,168,65,0.32);box-shadow:inset 0 0 14px rgba(255,248,230,0.05);
      animation:saStepIn .28s cubic-bezier(0.25,0.8,0.25,1) both}
    .sa-bld-article b{display:block;color:#D4A85A;font-weight:normal;margin-bottom:3px}
    .sa-bld-article span{color:#C8BFAE}
    html.sa-light .sa-bld-article{background:rgba(252,246,232,0.7);border-color:rgba(175,140,65,0.24);
      border-top-color:rgba(255,244,214,0.7)}
    html.sa-light .sa-bld-article b{color:#8B6A30}
    html.sa-light .sa-bld-article span{color:#4A3D28}

    .sa-bld-opt{width:100%;text-align:left;display:flex;align-items:center;gap:11px;
      cursor:pointer;font-family:Georgia,serif;
      transition:border-color .2s,box-shadow .2s,opacity .2s,transform .12s}
    .sa-bld-opt:active{transform:scale(.985)}
    .sa-bld-opt[disabled]{cursor:default}
    .sa-bld-optk{flex:0 0 24px;height:24px;border-radius:7px;display:grid;place-items:center;
      font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#B09060;
      border:1px solid rgba(200,169,110,0.35);transition:background .4s ease,border-color .4s ease,opacity .4s ease,color .4s ease}
    .sa-bld-fb{margin-top:12px}
    /* Общая сцена: все носители стоят на одной линии стойки */
    .sa-bld-counter{position:relative;display:flex;gap:14px;align-items:flex-end;margin:12px 0 14px;padding-bottom:11px;
      contain:layout paint}
    .sa-bld-counter::after{content:"";position:absolute;left:-4px;right:-4px;bottom:0;height:3px;border-radius:2px;
      background:linear-gradient(90deg,rgba(200,169,110,0.06),rgba(200,169,110,0.44),rgba(200,169,110,0.06));
      box-shadow:0 3px 10px rgba(0,0,0,0.42)}
    .sa-bld-shadow{position:absolute;left:50%;bottom:-3px;width:74px;height:9px;margin-left:-37px;
      border-radius:50%;background:radial-gradient(ellipse at center,rgba(0,0,0,0.5),transparent 72%);
      z-index:0;pointer-events:none}
    /* Прогресс-нить: движение к финалу видно, а не только «3 / 6» */
    .sa-bld-thread{height:2.5px;border-radius:2px;margin-top:9px;overflow:hidden;background:rgba(0,0,0,0.35)}
    .sa-bld-thread i{display:block;width:100%;height:100%;border-radius:2px;transform-origin:left;
      background:linear-gradient(90deg,#D4A85A,#C8A96E);box-shadow:0 0 6px rgba(200,169,110,0.55);
      transition:transform 0.5s cubic-bezier(0.25,0.8,0.25,1)}
    /* Смена шага: вопрос и варианты мягко въезжают */
    @keyframes saStepIn{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:none}}
    .sa-bld-stepin{animation:saStepIn 0.34s cubic-bezier(0.25,0.8,0.25,1) both}
    @media (prefers-reduced-motion: reduce){ .sa-bld-stepin{animation:none} }
    /* Отклик на верный шаг: короткий импульс у правильного варианта */
    @keyframes saOptPop{0%{transform:scale(1)}38%{transform:scale(1.025)}100%{transform:scale(1)}}
    .sa-bld-opt.pop{animation:saOptPop .38s cubic-bezier(.3,1.4,.5,1)}
    /* Финальный кадр: носитель крупнее и по центру */
    .sa-bld-hero{transform:scale(1.14);transform-origin:center top;padding:6px 0 12px}
    /* Печать на итоге — та же метафора, что в книге отзывов */
    @keyframes saSealIn{0%{transform:scale(.6) rotate(-16deg);opacity:0}
      62%{transform:scale(1.07) rotate(3deg);opacity:1}100%{transform:scale(1) rotate(-4deg)}}
    .sa-bld-seal{position:relative;width:104px;height:104px;margin:0 auto;border-radius:50%;
      display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
      transform:rotate(-4deg);animation:saSealIn .7s cubic-bezier(.3,1.3,.5,1) both;
      box-shadow:inset 0 2px 6px rgba(255,255,255,0.28),inset 0 -4px 10px rgba(0,0,0,0.30),0 6px 16px rgba(0,0,0,0.42)}
    .sa-bld-seal::before{content:"";position:absolute;inset:0;border-radius:50%;
      border:2px dashed rgba(255,255,255,0.22);transform:scale(.86)}
    .sa-bld-sealtop{font-family:Georgia,serif;font-size:26px;line-height:1;position:relative;z-index:2}
    .sa-bld-sealtext{font-family:ui-monospace,Menlo,monospace;font-size:7.5px;letter-spacing:1.6px;
      text-transform:uppercase;position:relative;z-index:2;opacity:.92}
    .sa-bld-seal.ok{background:radial-gradient(circle at 34% 28%,#3E8E63,#215A3C);color:#EAF6EE}
    .sa-bld-seal.warn{background:radial-gradient(circle at 34% 28%,#C8A050,#8B6A30);color:#FFF7E4}
    .sa-bld-seal.bad{background:radial-gradient(circle at 34% 28%,#A8402F,#6E1F16);color:#FBE7E2}
    @media (prefers-reduced-motion: reduce){ .sa-bld-seal{animation:none} }
    @media (prefers-reduced-motion: reduce){ .sa-bld-opt.pop{animation:none} }
    /* носитель: сосуд */
    .sa-bld-vessel{position:relative;margin:0 auto;overflow:hidden;
      border:2px solid rgba(210,190,160,0.42);border-top:0;
      background:linear-gradient(100deg,rgba(255,255,255,0.055) 0%,rgba(255,255,255,0.012) 42%,rgba(255,255,255,0.05) 100%);
      transition:width .45s cubic-bezier(.3,1,.4,1),height .45s cubic-bezier(.3,1,.4,1),border-radius .45s}
    .sa-bld-vessel.high{width:62px;height:152px;border-radius:4px 4px 9px 9px}
    .sa-bld-vessel.rocks{width:84px;height:96px;border-radius:3px 3px 6px 6px;border-width:3px;
      box-shadow:inset 0 -14px 18px rgba(255,255,255,0.07)}
    /* Винный бокал: чаша + ножка + основание. Чаша шире книзу и сужается кверху. */
    .sa-bld-vessel.wine{width:80px;height:86px;border-radius:5px 5px 38px 38px;border-width:2px;
      box-shadow:inset 0 -10px 16px rgba(255,255,255,0.06)}
    .sa-bld-vessel.coupe{width:92px;height:54px;border-radius:3px 3px 46px 46px;border-width:2px;
      box-shadow:inset 0 -8px 14px rgba(255,255,255,0.07)}
    .sa-bld-stem{width:6px;height:40px;margin:0 auto;flex-shrink:0;
      background:linear-gradient(90deg,rgba(180,160,130,0.22),rgba(255,255,255,0.34),rgba(180,160,130,0.22))}
    .sa-bld-foot{width:54px;height:7px;margin:0 auto;flex-shrink:0;border-radius:50%;
      background:linear-gradient(180deg,rgba(255,255,255,0.28),rgba(200,182,150,0.14));
      box-shadow:0 3px 7px rgba(0,0,0,0.38)}
    /* Пивной: чуть уже книзу, высокий */
    .sa-bld-vessel.pint{width:74px;height:156px;border-radius:5px 5px 12px 12px;
      box-shadow:inset 0 -18px 22px rgba(255,255,255,0.05)}
    /* Пена: нарастает и оседает, поверх жидкости */
    .sa-bld-foam{position:absolute;left:0;right:0;z-index:3;border-radius:7px 7px 3px 3px;
      background:linear-gradient(180deg,rgba(255,253,246,0.96),rgba(242,231,206,0.82));
      box-shadow:inset 0 -4px 7px rgba(190,168,124,0.35),0 -1px 3px rgba(255,255,255,0.4);
      transform-origin:bottom;
      transition:transform 0.55s cubic-bezier(0.3,1,0.4,1),bottom 0.55s cubic-bezier(0.3,1,0.4,1)}
    .sa-bld-foam::after{content:"";position:absolute;inset:0;border-radius:inherit;opacity:0.75;
      background:radial-gradient(circle at 26% 36%,rgba(255,255,255,0.92) 1.6px,transparent 2.6px),
                 radial-gradient(circle at 72% 64%,rgba(255,255,255,0.8) 1.6px,transparent 2.6px)}
    @keyframes saFoamRise{from{transform:scaleY(0);opacity:0}}
    .sa-bld-foam.fresh{animation:saFoamRise 0.62s cubic-bezier(0.3,1,0.4,1)}
    /* Блик по стеклу — отклик на шаг про чистоту бокала */
    @keyframes saShine{0%{transform:translateX(-130%) skewX(-18deg);opacity:0}
      18%{opacity:0.85}82%{opacity:0.85}100%{transform:translateX(130%) skewX(-18deg);opacity:0}}
    .sa-bld-shine{position:absolute;top:0;bottom:0;left:0;width:46%;z-index:6;pointer-events:none;
      background:linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent);
      animation:saShine 0.9s ease-out forwards}
    .sa-bld-vessel::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;
      box-shadow:inset 3px 0 7px rgba(255,255,255,0.13),inset -4px 0 8px rgba(0,0,0,0.34)}
    .sa-bld-vessel.spoiled{border-color:rgba(224,120,120,0.45)}
    .sa-bld-vessel.spoiled .sa-bld-layer{filter:saturate(.4) brightness(.85)}
    .sa-bld-rim{position:absolute;top:-2px;left:-2px;right:-2px;height:5px;border-radius:50%;z-index:4;
      background:linear-gradient(90deg,rgba(255,255,255,0.10),rgba(255,255,255,0.42),rgba(255,255,255,0.10))}
    .sa-bld-layers{position:absolute;inset:0;display:flex;flex-direction:column-reverse}
    .sa-bld-layer{width:100%;transform-origin:bottom}
    .sa-bld-layer.fresh{animation:saPourGrow .75s cubic-bezier(.25,.9,.35,1)}
    .sa-bld-surface{position:absolute;left:0;right:0;height:5px;border-radius:50%;z-index:3;
      background:rgba(255,255,255,0.30);transition:bottom .6s cubic-bezier(.3,1,.4,1)}
    .sa-bld-surface.fresh{animation:saSettle .85s cubic-bezier(.3,1.4,.5,1) .1s}
    .sa-bld-pour{position:absolute;top:0;left:50%;margin-left:-2px;width:4px;height:100%;z-index:3;
      transform-origin:top;border-radius:2px;
      background:linear-gradient(180deg,rgba(255,255,255,0.55),rgba(255,255,255,0.06));
      animation:saPourStream .75s ease-out forwards}
    .sa-bld-cube{position:absolute;border-radius:3px;background:rgba(238,248,255,0.26);z-index:2;
      border:1px solid rgba(255,255,255,0.30);box-shadow:inset 0 2px 3px rgba(255,255,255,0.3)}
    .sa-bld-cube.fresh{animation:saIceDrop .55s cubic-bezier(.35,1.1,.45,1) backwards}
    /* Конечное число повторов: на старом WebKit непрерывная анимация не даёт
       странице «уснуть» и жрёт кадры даже когда человек просто читает. */
    .sa-bld-bubble{position:absolute;border-radius:50%;background:rgba(255,255,255,0.55);z-index:3;
      animation:saBubble linear 7}
    .sa-bld-drop{position:absolute;border-radius:50%;background:rgba(255,255,255,0.16);z-index:5;
      animation:saDropSlide ease-in 3}
    .sa-bld-pulp{position:absolute;border-radius:50% 40% 50% 40%;z-index:2;
      background:linear-gradient(140deg,rgba(150,196,92,0.9),rgba(96,140,52,0.95));
      box-shadow:0 0 3px rgba(0,0,0,0.25)}
    .sa-bld-wedge{position:absolute;width:16px;height:11px;border-radius:0 0 16px 16px;z-index:2;
      background:linear-gradient(180deg,rgba(206,226,120,0.9),rgba(160,190,70,0.95));
      border-top:2px solid rgba(240,248,200,0.75)}
    .sa-bld-garnish{position:absolute;top:-10px;left:50%;font-size:28px;z-index:6;
      transform:translateX(-50%);text-shadow:0 3px 5px rgba(0,0,0,0.5);
      animation:saGarnishIn .6s cubic-bezier(.3,1.4,.5,1),saGarnishSway 4.5s ease-in-out .6s 4}
    /* Рост через scaleY: браузер не пересчитывает раскладку на каждом кадре. */
    @keyframes saPourGrow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
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

    /* носитель: путь льда — вертикальный маршрут кубика */
    .sa-bld-icecol{flex:0 0 118px;display:flex;flex-direction:column;gap:5px;padding:7px;
      border-radius:10px;background:rgba(226,186,116,0.09);
      border:1px solid rgba(145,108,40,0.34);border-top:1px solid rgba(210,168,65,0.42);
      box-shadow:inset 0 0 20px rgba(255,248,230,0.06),inset 0 1px 0 rgba(255,255,255,0.10);
      transition:background .4s ease,border-color .4s ease,opacity .4s ease,color .4s ease}
    .sa-bld-icecol.murky{border-color:rgba(224,120,120,0.35)}
    .sa-bld-icegen,.sa-bld-icetub,.sa-bld-iceglass{position:relative;overflow:hidden;
      border-radius:6px;background:rgba(255,250,238,0.03);border:1px dashed rgba(145,108,40,0.26);
      box-shadow:inset 0 0 12px rgba(255,248,230,0.04);transition:background .45s ease,border-color .45s ease,opacity .45s ease}
    .sa-bld-icegen{height:36px} .sa-bld-icetub{height:34px} .sa-bld-iceglass{height:44px;border-radius:4px 4px 9px 9px}
    .sa-bld-icegen.on,.sa-bld-icetub.on,.sa-bld-iceglass.on{border-style:solid;
      border-color:rgba(160,200,230,0.42);border-top-color:rgba(190,225,245,0.5);
      background:rgba(150,195,230,0.12);
      box-shadow:inset 0 0 14px rgba(200,235,255,0.10),inset 0 1px 0 rgba(255,255,255,0.14)}
    .sa-bld-icegen > span,.sa-bld-icetub > span,.sa-bld-iceglass > span{position:absolute;left:6px;top:4px;
      font-family:ui-monospace,Menlo,monospace;font-size:6.5px;letter-spacing:1.1px;color:#756A58;z-index:2}
    .sa-bld-iceglass > span{top:auto;bottom:4px;left:0;right:0;text-align:center}
    .sa-bld-icearrow{height:16px;display:grid;place-items:center;color:#5C5244;font-size:11px;transition:color .4s ease}
    .sa-bld-icearrow.on{color:#C8A96E}
    @keyframes saCubeIn{0%{transform:translateY(-26px) scale(.6);opacity:0}100%{opacity:1}}
    .sa-bld-icecube{position:absolute;border-radius:2px;z-index:1;
      background:rgba(238,248,255,0.34);border:1px solid rgba(255,255,255,0.34);
      box-shadow:inset 0 2px 3px rgba(255,255,255,0.35);
      animation:saCubeIn .5s cubic-bezier(.35,1.1,.45,1) backwards;transition:background .4s ease,border-color .4s ease}
    .sa-bld-icecube.murky{background:rgba(190,195,190,0.26);border-color:rgba(200,200,190,0.22);box-shadow:none}

    /* носитель: уборка смены — станция пустеет, поверхность светлеет */
    .sa-bld-clean{flex:0 0 152px;padding:8px;border-radius:10px;position:relative;overflow:hidden;
      background:rgba(226,186,116,0.09);
      border:1px solid rgba(145,108,40,0.34);border-top:1px solid rgba(210,168,65,0.42);
      box-shadow:inset 0 0 20px rgba(255,248,230,0.06),inset 0 1px 0 rgba(255,255,255,0.10)}
    .sa-bld-clean::before{content:"";position:absolute;left:0;right:0;bottom:0;height:100%;
      transform:scaleY(var(--clean,0));transform-origin:bottom;
      background:linear-gradient(0deg,rgba(200,169,110,0.16),rgba(200,169,110,0));
      transition:transform .55s cubic-bezier(.3,1,.4,1);pointer-events:none}
    .sa-bld-cleanhead{display:flex;justify-content:space-between;gap:6px;position:relative;z-index:2;
      font-family:ui-monospace,Menlo,monospace;font-size:7px;letter-spacing:1.3px;color:#756A58;margin-bottom:6px}
    .sa-bld-cslot{display:flex;align-items:center;gap:6px;padding:5px 7px;margin-bottom:4px;
      border-radius:7px;position:relative;z-index:2;
      background:rgba(255,250,238,0.035);border:1px solid rgba(145,108,40,0.22);
      border-top:1px solid rgba(210,168,65,0.26);box-shadow:inset 0 0 12px rgba(255,248,230,0.05);
      transition:opacity .45s ease,background .45s ease,border-color .45s ease}
    .sa-bld-cslot.cleared{opacity:.42;background:rgba(93,187,138,0.10);border-color:rgba(93,187,138,0.30);
      border-top-color:rgba(140,215,175,0.36);box-shadow:inset 0 0 12px rgba(93,187,138,0.10)}
    .sa-bld-cico{display:flex;flex-shrink:0}
    .sa-bld-clabel{flex:1;min-width:0;font-size:9px;color:#E8DEC8;line-height:1.2}
    .sa-bld-cslot.cleared .sa-bld-clabel{text-decoration:line-through}
    .sa-bld-cmark{font-size:9px;color:#5DBB8A}

    /* носитель: станция сверху */
    .sa-bld-station{flex:0 0 152px;padding:8px;border-radius:10px;background:rgba(226,186,116,0.09);
      border:1px solid rgba(145,108,40,0.34);border-top:1px solid rgba(210,168,65,0.42);
      box-shadow:inset 0 0 20px rgba(255,248,230,0.06),inset 0 1px 0 rgba(255,255,255,0.10),0 5px 16px rgba(0,0,0,0.30);
      transition:background .4s ease,border-color .4s ease,opacity .4s ease,color .4s ease}
    .sa-bld-station.clean{border-color:rgba(200,169,110,0.5);box-shadow:inset 0 0 20px rgba(214,170,80,0.08)}
    .sa-bld-station.spoiled{border-color:rgba(224,120,120,0.35)}
    .sa-bld-icebin{position:relative;height:26px;border-radius:7px;margin-bottom:6px;overflow:hidden;
      display:flex;align-items:center;padding:0 7px;font-size:8.5px;color:#756A58;
      background:rgba(255,250,238,0.03);border:1px dashed rgba(145,108,40,0.26);
      box-shadow:inset 0 0 12px rgba(255,248,230,0.04);transition:background .4s ease,border-color .4s ease,opacity .4s ease,color .4s ease}
    .sa-bld-icebin.on{color:#CFE4EF;border-style:solid;border-color:rgba(160,200,230,0.38);
      border-top-color:rgba(190,225,245,0.48);background:rgba(150,195,230,0.13);
      box-shadow:inset 0 0 14px rgba(200,235,255,0.10),inset 0 1px 0 rgba(255,255,255,0.14)}
    .sa-bld-icebin i{position:absolute;width:7px;height:7px;border-radius:2px;background:rgba(235,248,255,0.5)}
    .sa-bld-zone{padding:5px 7px;border-radius:7px;margin-bottom:4px;
      background:rgba(255,250,238,0.035);border:1px solid rgba(145,108,40,0.22);
      border-top:1px solid rgba(210,168,65,0.26);
      box-shadow:inset 0 0 12px rgba(255,248,230,0.05);transition:background .4s ease,border-color .4s ease,opacity .4s ease}
    .sa-bld-zone.on{background:rgba(200,169,110,0.11);border-color:rgba(200,169,110,0.36)}
    .sa-bld-zname{font-family:ui-monospace,Menlo,monospace;font-size:7px;letter-spacing:1.1px;
      text-transform:uppercase;color:#756A58;margin-bottom:3px}
    .sa-bld-zone.on .sa-bld-zname{color:#D4A85A}
    .sa-bld-zchip{font-size:8.5px;padding:2px 5px;border-radius:999px;color:#E8DEC8;
      background:rgba(200,169,110,0.17);border:1px solid rgba(200,169,110,0.3)}

    /* носитель: гость за стойкой */
    .sa-bld-guest{flex:0 0 132px;padding:9px 8px;border-radius:10px;text-align:center;
      background:rgba(226,186,116,0.09);border:1px solid rgba(145,108,40,0.34);
      border-top:1px solid rgba(210,168,65,0.42);
      box-shadow:inset 0 0 20px rgba(255,248,230,0.06),inset 0 1px 0 rgba(255,255,255,0.10)}
    .sa-bld-gfig{width:52px;height:52px;margin:0 auto;border-radius:50%;display:grid;place-items:center;
      border:1.5px solid;background:rgba(255,250,238,0.035);
      box-shadow:inset 0 0 16px rgba(255,248,230,0.06),inset 0 1px 0 rgba(255,255,255,0.10);
      transition:border-color .45s ease}
    .sa-bld-gmood{display:flex;gap:4px;justify-content:center;margin-top:9px}
    .sa-bld-gdot{width:7px;height:7px;border-radius:50%;border:1px solid;transition:background .4s ease,border-color .4s ease}
    .sa-bld-glabel{font-family:ui-monospace,Menlo,monospace;font-size:8px;letter-spacing:1.2px;
      text-transform:uppercase;margin-top:6px;transition:color .4s ease}
    .sa-bld-gbar{margin-top:9px;padding-top:8px;border-top:1px solid rgba(200,169,110,0.28);
      display:flex;gap:5px;justify-content:center;flex-wrap:wrap;min-height:26px;align-items:center}
    @keyframes saServeIn{from{opacity:0;transform:translateY(8px) scale(.8)}to{opacity:1;transform:none}}
    .sa-bld-gitem{display:flex;animation:saServeIn .42s cubic-bezier(.3,1.3,.5,1) both}
    .sa-bld-gempty{font-size:8.5px;color:#5C5244;font-style:italic}

    /* носитель: выдача в час пик */
    .sa-bld-pass{flex:0 0 142px;padding:8px;border-radius:10px;
      background:rgba(226,186,116,0.09);border:1px solid rgba(145,108,40,0.34);
      border-top:1px solid rgba(210,168,65,0.42);
      box-shadow:inset 0 0 20px rgba(255,248,230,0.06),inset 0 1px 0 rgba(255,255,255,0.10)}
    .sa-bld-passhead{display:flex;justify-content:space-between;gap:6px;
      font-family:ui-monospace,Menlo,monospace;font-size:7px;letter-spacing:1.3px;color:#756A58;margin-bottom:8px}
    .sa-bld-rail{display:flex;gap:5px;justify-content:center;align-items:flex-end;min-height:34px}
    .sa-bld-slot{width:28px;height:32px;border-radius:6px;display:grid;place-items:center;
      background:rgba(255,250,238,0.03);border:1px dashed rgba(145,108,40,0.26);
      box-shadow:inset 0 0 12px rgba(255,248,230,0.04);color:#5C5244;font-size:11px;transition:background .4s ease,border-color .4s ease,opacity .4s ease}
    .sa-bld-slot.on{border-style:solid;border-color:rgba(200,169,110,0.45);
      border-top-color:rgba(226,186,116,0.55);background:rgba(200,169,110,0.13);
      box-shadow:inset 0 0 14px rgba(255,248,230,0.09),inset 0 1px 0 rgba(255,255,255,0.12);
      animation:saServeIn .42s cubic-bezier(.3,1.3,.5,1) both}
    .sa-bld-railline{height:3px;margin-top:5px;border-radius:2px;
      background:linear-gradient(90deg,rgba(200,169,110,0.10),rgba(200,169,110,0.42),rgba(200,169,110,0.10))}
    .sa-bld-passfoot{font-size:8px;color:#756A58;text-align:center;margin-top:7px;font-style:italic}

    /* носитель: полка склада */
    .sa-bld-shelf{flex:0 0 146px;padding:8px;border-radius:10px;
      background:rgba(226,186,116,0.09);border:1px solid rgba(145,108,40,0.34);
      border-top:1px solid rgba(210,168,65,0.42);
      box-shadow:inset 0 0 20px rgba(255,248,230,0.06),inset 0 1px 0 rgba(255,255,255,0.10)}
    .sa-bld-shelfhead{display:flex;justify-content:space-between;gap:6px;
      font-family:ui-monospace,Menlo,monospace;font-size:7px;letter-spacing:1.3px;color:#756A58;margin-bottom:7px}
    .sa-bld-bottles{display:flex;gap:4px;align-items:flex-end;justify-content:center;
      padding-bottom:6px;border-bottom:2px solid rgba(200,169,110,0.32)}
    .sa-bld-bottle{position:relative;width:17px;height:40px;border-radius:3px 3px 4px 4px;overflow:hidden;
      background:rgba(255,250,238,0.035);border:1px solid rgba(145,108,40,0.22);
      border-top:1px solid rgba(210,168,65,0.26);box-shadow:inset 0 0 12px rgba(255,248,230,0.05);transition:background .45s ease,border-color .45s ease,opacity .45s ease}
    .sa-bld-bottle.on{border-color:rgba(200,169,110,0.45);border-top-color:rgba(226,186,116,0.55)}
    .sa-bld-bottle i{position:absolute;left:0;right:0;bottom:0;display:block;height:100%;
      transform-origin:bottom;
      background:linear-gradient(180deg,rgba(200,169,110,0.55),rgba(150,110,45,0.72));
      transition:transform .55s cubic-bezier(.3,1,.4,1)}
    .sa-bld-bottle b{position:absolute;left:0;right:0;bottom:2px;text-align:center;z-index:2;
      font-family:ui-monospace,Menlo,monospace;font-size:6.5px;font-weight:normal;color:#F0E8D8}
    .sa-bld-crate{display:flex;align-items:center;gap:5px;margin-top:5px;padding:4px 6px;border-radius:6px;
      background:rgba(255,250,238,0.035);border:1px solid rgba(145,108,40,0.22);
      border-top:1px solid rgba(210,168,65,0.26);box-shadow:inset 0 0 12px rgba(255,248,230,0.05);transition:background .4s ease,border-color .4s ease,opacity .4s ease}
    .sa-bld-crate.on{background:rgba(200,169,110,0.11);border-color:rgba(200,169,110,0.34);
      border-top-color:rgba(226,186,116,0.44);box-shadow:inset 0 0 12px rgba(255,248,230,0.08)}
    .sa-bld-crate span{font-size:8px;color:#948872;line-height:1.2}
    .sa-bld-crate.on span{color:#E8DEC8}

    /* носитель: цепочка стадий */
    .sa-bld-fstage{flex:1;min-width:0;text-align:center;position:relative}
    .sa-bld-fring{width:38px;height:38px;margin:0 auto;border-radius:50%;display:grid;place-items:center;
      font-size:17px;background:rgba(226,186,116,0.09);border:1.5px solid rgba(145,108,40,0.34);
      border-top-color:rgba(210,168,65,0.46);
      box-shadow:inset 0 0 14px rgba(255,248,230,0.06),inset 0 1px 0 rgba(255,255,255,0.10);
      transition:background .4s ease,border-color .4s ease,opacity .4s ease,color .4s ease;position:relative;z-index:2;opacity:.55}
    .sa-bld-fnm{font-size:9px;color:#756A58;margin-top:6px;line-height:1.2;
      font-family:ui-monospace,Menlo,monospace;letter-spacing:.3px}
    .sa-bld-fstage.on .sa-bld-fring{opacity:1;background:rgba(200,169,110,0.16);border-color:#C8A96E;
      box-shadow:0 0 14px rgba(200,169,110,0.28)}
    .sa-bld-fstage.on .sa-bld-fnm{color:#D4A85A}
    .sa-bld-fstage.on .sa-bld-fbar{background:linear-gradient(90deg,rgba(200,169,110,0.2),#C8A96E)}
    .sa-bld-fstage.bad .sa-bld-fring{opacity:1;background:rgba(224,120,120,0.15);border-color:#E07878}
    .sa-bld-fstage.bad .sa-bld-fnm{color:#E07878}
    .sa-bld-fstage.bad .sa-bld-fbar{background:linear-gradient(90deg,rgba(224,120,120,0.2),#E07878)}
    .sa-bld-fstage.now .sa-bld-fring{opacity:1;border-color:#C8A96E;border-style:dashed}
    .sa-bld-fstage.now .sa-bld-fnm{color:#C8A96E}
    @media (prefers-reduced-motion: reduce){
      .sa-bld-layer,.sa-bld-surface,.sa-bld-pour,.sa-bld-cube,.sa-bld-bubble,.sa-bld-drop,.sa-bld-garnish{animation:none}
      .sa-bld-bubble,.sa-bld-drop,.sa-bld-pour{opacity:0}
    }

    /* «Сборка» в светлой теме (режим чтения) */
    html.sa-light .sa-bld-term{color:#8B6A30;background:rgba(139,106,48,0.10);border-color:rgba(139,106,48,0.35)}
    html.sa-light .sa-bld-vessel{border-color:rgba(107,78,26,0.55);
      background:linear-gradient(100deg,rgba(255,255,255,0.55) 0%,rgba(255,255,255,0.25) 42%,rgba(255,255,255,0.5) 100%)}
    html.sa-light .sa-bld-vessel::after{box-shadow:inset 3px 0 7px rgba(255,255,255,0.5),inset -4px 0 8px rgba(107,78,26,0.18)}
    html.sa-light .sa-bld-rim{background:linear-gradient(90deg,rgba(107,78,26,0.15),rgba(107,78,26,0.4),rgba(107,78,26,0.15))}
    html.sa-light .sa-bld-surface{background:rgba(255,255,255,0.75)}
    html.sa-light .sa-bld-cube{background:rgba(160,200,230,0.45);border-color:rgba(70,120,160,0.45)}
    html.sa-light .sa-bld-bubble{background:rgba(90,140,175,0.55)}
    html.sa-light .sa-bld-drop{background:rgba(70,120,160,0.28)}
    html.sa-light .sa-bld-stem{background:linear-gradient(90deg,rgba(150,120,60,0.22),rgba(255,255,255,0.6),rgba(150,120,60,0.22))}
    html.sa-light .sa-bld-foot{background:linear-gradient(180deg,rgba(255,255,255,0.7),rgba(180,150,90,0.18));
      box-shadow:0 3px 7px rgba(120,90,30,0.18)}
    html.sa-light .sa-bld-foam{background:linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,240,222,0.9));
      box-shadow:inset 0 -4px 7px rgba(180,155,105,0.28),0 -1px 3px rgba(255,255,255,0.7)}
    html.sa-light .sa-bld-shine{background:linear-gradient(90deg,transparent,rgba(255,255,255,0.8),transparent)}
    html.sa-light .sa-bld-icecol,html.sa-light .sa-bld-clean{background:rgba(250,242,222,0.60);
      border-color:rgba(175,140,65,0.20);border-top-color:rgba(255,240,200,0.66);
      box-shadow:inset 0 0 20px rgba(255,255,255,0.5),inset 0 1px 0 rgba(255,255,255,0.85)}
    html.sa-light .sa-bld-icegen,html.sa-light .sa-bld-icetub,html.sa-light .sa-bld-iceglass{
      background:rgba(255,255,255,0.5);border-color:rgba(107,78,26,0.22)}
    html.sa-light .sa-bld-icegen.on,html.sa-light .sa-bld-icetub.on,html.sa-light .sa-bld-iceglass.on{
      background:rgba(150,195,230,0.26);border-color:rgba(70,120,160,0.45)}
    html.sa-light .sa-bld-icecube{background:rgba(160,200,230,0.45);border-color:rgba(70,120,160,0.42)}
    html.sa-light .sa-bld-icecube.murky{background:rgba(170,170,160,0.35);border-color:rgba(140,140,130,0.3)}
    html.sa-light .sa-bld-cslot{background:rgba(255,255,255,0.55);border-color:rgba(175,140,65,0.22)}
    html.sa-light .sa-bld-cslot.cleared{background:rgba(42,107,69,0.10);border-color:rgba(42,107,69,0.3)}
    html.sa-light .sa-bld-clabel{color:#2E2412}
    html.sa-light .sa-bld-cmark{color:#2A6B45}
    html.sa-light .sa-bld-station{background:rgba(250,242,222,0.60);border-color:rgba(175,140,65,0.20);
      border-top-color:rgba(255,240,200,0.66);
      box-shadow:inset 0 0 20px rgba(255,255,255,0.5),inset 0 1px 0 rgba(255,255,255,0.85),0 3px 12px rgba(120,90,30,0.10)}
    html.sa-light .sa-bld-station.clean{border-color:rgba(139,106,48,0.55);box-shadow:inset 0 0 20px rgba(200,160,60,0.15)}
    html.sa-light .sa-bld-icebin{color:#6B5B40;background:rgba(255,255,255,0.45);border-color:rgba(107,78,26,0.3)}
    html.sa-light .sa-bld-icebin.on{color:#2E5A73;background:rgba(150,195,230,0.28);border-color:rgba(70,120,160,0.5)}
    html.sa-light .sa-bld-icebin i{background:rgba(120,170,205,0.6)}
    html.sa-light .sa-bld-zone{background:rgba(252,246,232,0.62);border-color:rgba(175,140,65,0.18);
      border-top-color:rgba(255,244,214,0.7);box-shadow:inset 0 0 12px rgba(255,255,255,0.45)}
    html.sa-light .sa-bld-zone.on{background:rgba(200,169,110,0.24);border-color:rgba(139,106,48,0.5)}
    html.sa-light .sa-bld-zname{color:#8A7A5C}
    html.sa-light .sa-bld-zone.on .sa-bld-zname{color:#8B6A30}
    html.sa-light .sa-bld-zchip{color:#2E2412;background:rgba(200,169,110,0.3);border-color:rgba(139,106,48,0.45)}
    html.sa-light .sa-bld-counter::after{background:linear-gradient(90deg,rgba(139,106,48,0.08),rgba(139,106,48,0.40),rgba(139,106,48,0.08));
      box-shadow:0 3px 10px rgba(120,90,30,0.18)}
    html.sa-light .sa-bld-shadow{background:radial-gradient(ellipse at center,rgba(120,90,30,0.26),transparent 72%)}
    html.sa-light .sa-bld-thread{background:rgba(120,90,40,0.16)}
    html.sa-light .sa-bld-guest,html.sa-light .sa-bld-pass,html.sa-light .sa-bld-shelf{
      background:rgba(250,242,222,0.60);border-color:rgba(175,140,65,0.20);
      border-top-color:rgba(255,240,200,0.66);
      box-shadow:inset 0 0 20px rgba(255,255,255,0.5),inset 0 1px 0 rgba(255,255,255,0.85)}
    html.sa-light .sa-bld-gfig{background:rgba(255,255,255,0.5)}
    html.sa-light .sa-bld-gbar{border-top-color:rgba(175,140,65,0.3)}
    html.sa-light .sa-bld-slot{border-color:rgba(107,78,26,0.22);color:#8A7A5C}
    html.sa-light .sa-bld-slot.on{background:rgba(200,169,110,0.26);border-color:rgba(139,106,48,0.5)}
    html.sa-light .sa-bld-passfoot,html.sa-light .sa-bld-crate span{color:#6B5B40}
    html.sa-light .sa-bld-bottle{background:rgba(255,255,255,0.55);border-color:rgba(107,78,26,0.22)}
    html.sa-light .sa-bld-bottle b{color:#2E2412}
    html.sa-light .sa-bld-crate{background:rgba(255,255,255,0.5);border-color:rgba(175,140,65,0.18)}
    html.sa-light .sa-bld-crate.on{background:rgba(200,169,110,0.24);border-color:rgba(139,106,48,0.42)}
    html.sa-light .sa-bld-crate.on span{color:#2E2412}
    html.sa-light .sa-bld-fring{background:rgba(250,242,222,0.60);border-color:rgba(175,140,65,0.22);
      border-top-color:rgba(255,240,200,0.7);
      box-shadow:inset 0 0 14px rgba(255,255,255,0.5),inset 0 1px 0 rgba(255,255,255,0.85)}
    html.sa-light .sa-bld-fnm{color:#8A7A5C}
    html.sa-light .sa-bld-fstage.on .sa-bld-fring{opacity:1;background:rgba(200,169,110,0.3);border-color:#8B6A30;box-shadow:none}
    html.sa-light .sa-bld-fstage.on .sa-bld-fnm{color:#8B6A30}
    html.sa-light .sa-bld-fstage.on .sa-bld-fbar{background:linear-gradient(90deg,rgba(139,106,48,0.25),#8B6A30)}
    html.sa-light .sa-bld-fstage.bad .sa-bld-fring{background:rgba(139,48,32,0.12);border-color:#8B3020}
    html.sa-light .sa-bld-fstage.bad .sa-bld-fnm{color:#8B3020}
    html.sa-light .sa-bld-fstage.bad .sa-bld-fbar{background:linear-gradient(90deg,rgba(139,48,32,0.25),#8B3020)}
    html.sa-light .sa-bld-fstage.now .sa-bld-fring{border-color:#8B6A30}
    html.sa-light .sa-bld-fstage.now .sa-bld-fnm{color:#8B6A30}
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
