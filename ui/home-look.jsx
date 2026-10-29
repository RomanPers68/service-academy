// ui/home-look.jsx — v101 (Доп. 414): вид главной «Линза» (lib/home-look.js — выбор). Раскладка RoleSelect прежняя;
// здесь только стили по классу на корне главной (.sa-look-lens): всё круглое — линзы, как кнопка AI, карточки — тем же
// стеклом с той же кромкой и светом. Блоки помечены data-атрибутами (их ставят ui/screens-roleselect.jsx,
// ui/day-cards.jsx, ui/now-hero.jsx, ui/tracks-row.jsx); у части блоков стили заданы прямо в разметке — их перекрываем
// с !important.
//   Кружки инструментов: кольцо — по краю кружка, стекло — внутри (::before). Ряд инструментов обрезан по высоте (подписи
//   выезжают вбок), и кольцо снаружи срезалось сверху и снизу (владелец: «линзы выглядят не ровными, как будто обрезаны»);
//   по той же причине у инструментов нет внешней тени.
// v102 (Доп. 415): «Линза» на всех экранах — правила под html.sa-lens (класс ставит App в виде «Линза»). Линзой
// становится только то, что на экранах уже круглое: кнопка «назад» (T.backBtn2, data-lens="back"), поиск в верхней
// строке, стрелки графика, кружки значков SOS, сертификатов, книги отзывов, номера навыков наставника, аватарки
// (data-lens="disc" | "sos" | "avatar"), «Все темы списком», кружок «Я это умею», «Подробнее» квеста смены (по классам).
// Новых плашек под значками нет (значки без плашек — намеренно, v78); кружки с состоянием (подтверждён, выбран,
// отмечен) — прежние. Стекло — фон самого кружка (содержимое всегда поверх), кольцо — снаружи (::after), как у
// медальонов на главной.
// v105 (Доп. 418): линза в переписке — стекло и свет на пузырях, карточках и полях (раздел v105 в стилях ниже).

// v105: хвостик пузыря продолжает ободок. Две маски той же формы, что TAIL в ui/chat.jsx: под ::before — форма с
// краем (красится цветом ободка), под ::after — та же форма на 1 px внутрь (заливка пузыря). Ободок самого пузыря
// у хвостика закрывает заливка, и ободок идёт по кромке пузыря и хвостика без шва.
const tailSvg = (d) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 11 16'><path d='${d}'/></svg>`)}")`;
const TAIL_RIM = tailSvg("M6 0C6 7.5 4.6 12.6 0 16h11v-5H7V0z"), TAIL_FILL = tailSvg("M7 0C7 7.3 5.7 12 2.6 15H11v-4H7z");

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

/* ── v102: «Линза» на всех экранах (html.sa-lens): что уже круглое — то же стекло, ободок и кольцо ── */
html.sa-lens{--lk-gold:#C8A96E;--lk-hi:#E8C983;--lk-glass:rgba(200,169,110,0.12);--lk-rim:rgba(214,178,102,0.45);--lk-glow:rgba(255,230,170,0.12);
  --lk-hl:rgba(255,255,255,0.18);--lk-ring:rgba(214,178,102,0.44);--lk-sos:234,140,140}
html.sa-lens.sa-light{--lk-gold:#7A5D2A;--lk-hi:#8A6524;--lk-glass:rgba(139,106,48,0.09);--lk-rim:rgba(139,106,48,0.48);--lk-glow:rgba(255,255,255,0.5);
  --lk-hl:rgba(255,255,255,0.95);--lk-ring:rgba(139,106,48,0.32);--lk-sos:163,58,42}
html.sa-lens [data-lens]{position:relative}
html.sa-lens [data-lens]::after,html.sa-lens .tbp-view::after,html.sa-lens .tbm-act:not([disabled]) .tbm-act-ic::after,html.sa-lens .tg-more::after{
  content:"";position:absolute;inset:-3.5px;border-radius:50%;border:1px solid var(--lk-ring);pointer-events:none}
html.sa-lens [data-lens="disc"],html.sa-lens [data-lens="back"],html.sa-lens .tbp-view,html.sa-lens .tbm-act:not([disabled]) .tbm-act-ic,html.sa-lens .tg-more{
  background:var(--lk-glass)!important;border-color:transparent!important;
  box-shadow:inset 0 0 0 1px var(--lk-rim),inset 0 0 12px var(--lk-glow),inset 0 1.5px 0 var(--lk-hl),inset 0 -9px 12px -7px var(--tint,transparent)!important}
html.sa-lens .tbp-view,html.sa-lens .tbm-act:not([disabled]) .tbm-act-ic,html.sa-lens .tg-more{position:relative}
html.sa-lens .tbm-act.hot .tbm-act-ic{--tint:rgba(255,248,230,0.35)}
html.sa-lens .tbm-act.gold .tbm-act-ic{--tint:rgba(232,197,106,0.45)}
html.sa-lens [data-lens="sos"]{background:rgba(var(--lk-sos),0.10)!important;border-color:transparent!important;
  box-shadow:inset 0 0 0 1px rgba(var(--lk-sos),0.62),inset 0 0 14px rgba(var(--lk-sos),0.16),inset 0 1.5px 0 var(--lk-hl)!important}
html.sa-lens [data-lens="sos"]::after{border-color:rgba(var(--lk-sos),0.42)}
html.sa-lens [data-lens="avatar"]{box-shadow:inset 0 0 0 1px var(--lk-rim),inset 0 1.5px 0 var(--lk-hl),0 2px 10px rgba(0,0,0,0.25)!important}
/* кнопка «назад»: круглая линза 32 px со стрелкой посередине (была стрелка без кружка) */
html.sa-lens [data-lens="back"]{width:32px!important;height:32px!important;min-width:32px!important;min-height:32px!important;border-radius:50%!important;
  display:inline-flex!important;align-items:center!important;justify-content:center!important;flex-shrink:0;box-sizing:border-box;
  font-size:21px!important;line-height:1!important;color:var(--lk-gold)!important;padding:0 1px 3px 0!important}
/* поиск в верхней строке — круглая линза 28 px (был скруглённый квадрат 28 × 26) */
html.sa-lens [data-top-search][data-lens]{height:28px!important;border-radius:50%!important}

/* ── v103: чат (ui/chat.jsx, ui/chat-cards.jsx — стили по классам): кружок чата и людей (в шапке, списке, поиске,
   упоминаниях), «назад» в шапке, кружки листа действий («Фото» … «Опаздываю»), «вниз», колокольчик — линзы.
   Сообщения и карточки в переписке, «отправить» (главное действие — золотом), значки без кружка — прежние ── */
html.sa-lens .ch-ava,html.sa-lens .ch-tile-i,html.sa-lens .ch-back,html.sa-lens .ch-down,html.sa-lens .ch-bell{
  background:var(--lk-glass)!important;border-color:transparent!important;
  box-shadow:inset 0 0 0 1px var(--lk-rim),inset 0 0 12px var(--lk-glow),inset 0 1.5px 0 var(--lk-hl)!important}
html.sa-lens .ch-ava.team,html.sa-lens .ch-tile-i,html.sa-lens .ch-back{color:var(--lk-gold)!important}
html.sa-lens .ch-tile-i,html.sa-lens .ch-back,html.sa-lens .ch-bell{position:relative}
html.sa-lens .ch-ava::after,html.sa-lens .ch-tile-i::after,html.sa-lens .ch-back::after,html.sa-lens .ch-down::after,html.sa-lens .ch-bell::after{
  content:"";position:absolute;inset:-3.5px;border-radius:50%;border:1px solid var(--lk-ring);pointer-events:none}
html.sa-lens .ch-back{width:34px;height:34px;margin:3px}
html.sa-lens .ch-back:active{opacity:.7}

/* ── v104: листы чата («Задание», «Стоп-лист», «Поменяться», «Отдать смену», «Опаздываю», «Опрос»…). Владелец: «по
   настройкам, в чате… тоже можем линзы сделать, особенно кнопки подтверждения, ну и всё остальное?».
   «Готово»-кнопки листов (.ch-main: «Предложить обмен», «Отправить»…) — стеклянная плашка с золотым ободком, светом
   сверху и тонким кольцом, надпись золотом (было сплошное золото с тёмной надписью); «отправить» (.ch-send) — линза;
   значки строк выбора (.ch-opt-i) — круглые линзы, фото блюда — в круге с ободком; «закрыть» листа (.ch-x) — линза,
   как «назад». Выбранная строка (золотая кромка), чипы, поля ввода, сообщения и карточки переписки — прежние ── */
html.sa-lens .ch-main{position:relative;color:var(--lk-hi)!important;
  background:radial-gradient(120% 160% at 50% 0%,rgba(232,201,131,0.24),rgba(200,169,110,0.12) 62%)!important;
  box-shadow:inset 0 0 0 1px var(--lk-rim),inset 0 0 18px var(--lk-glow),inset 0 1.5px 0 var(--lk-hl),0 4px 14px rgba(0,0,0,0.28)!important}
html.sa-lens.sa-light .ch-main{background:radial-gradient(120% 160% at 50% 0%,rgba(255,255,255,0.85),rgba(176,138,70,0.22) 70%)!important;
  box-shadow:inset 0 0 0 1px rgba(139,106,48,0.6),inset 0 0 18px var(--lk-glow),inset 0 1.5px 0 var(--lk-hl),0 3px 10px rgba(120,85,25,0.16)!important}
html.sa-lens.sa-light .ch-main::after{border-color:rgba(139,106,48,0.45)}
html.sa-lens .ch-main::after{content:"";position:absolute;inset:-3.5px;border-radius:999px;border:1px solid var(--lk-ring);pointer-events:none}
html.sa-lens .ch-send,html.sa-lens .ch-x,html.sa-lens .ch-opt-i{position:relative;background:var(--lk-glass)!important;border-color:transparent!important;
  box-shadow:inset 0 0 0 1px var(--lk-rim),inset 0 0 12px var(--lk-glow),inset 0 1.5px 0 var(--lk-hl)!important}
html.sa-lens .ch-send,html.sa-lens .ch-x,html.sa-lens .ch-opt-i{color:var(--lk-gold)!important}
html.sa-lens .ch-send{color:var(--lk-hi)!important}
html.sa-lens .ch-send::after,html.sa-lens .ch-x::after,html.sa-lens .ch-opt-i::after{content:"";position:absolute;inset:-3.5px;border-radius:50%;border:1px solid var(--lk-ring);pointer-events:none}
html.sa-lens .ch-x{width:32px;height:32px;margin:2px}
html.sa-lens .ch-opt-i{border-radius:50%!important;overflow:visible!important}
html.sa-lens .ch-opt-i img{border-radius:50%}

/* ── v105: переписка. Владелец (29.10, снимок «Вся команда»): «может, в чат линзу интегрируем?». Сообщения читают,
   поэтому колец вокруг пузырей нет: в переписке линза — стекло и свет, как у карточек на главной. Чужие пузыри —
   тёмное стекло с золотым ободком и бликом сверху, свои — золото с бликом и светлым ободком; хвостик продолжает
   ободок (раньше у пузыря «тебя упомянули» на хвостике был шов). Карточки и вызов — стекло с бликом, их кнопки
   («Иду», «Забрать»…) — стеклянные плашки с кольцом, как кнопки листов (v104); «Сегодня» и «Показать раньше» —
   плашки с кольцом; строка ввода, поиск и поля листов — стекло с ободком; подсказки над строкой, кружок Наставника и
   стрелка ответа при свайпе — стекло. Размеры, цвет и кегль текста прежние; бледные и выбранные состояния — прежние ── */
html.sa-lens .sa-dlg.ch{--tail-o:${TAIL_RIM};--tail-i:${TAIL_FILL};
  --lk-rim-in:rgba(214,178,102,0.30);--lk-sheen-in:rgba(232,201,131,0.09);--lk-hl-in:rgba(255,255,255,0.07);
  --lk-rim-out:rgba(255,244,214,0.42);--lk-sheen-out:rgba(255,250,232,0.40);--lk-hl-out:rgba(255,255,255,0.6);
  --lk-sh-b:0 2px 8px rgba(0,0,0,0.30);--lk-sh-c:0 8px 22px rgba(0,0,0,0.32)}
html.sa-lens .sa-dlg.ch.lt{--lk-rim-in:rgba(139,106,48,0.30);--lk-sheen-in:rgba(250,238,208,0.6);--lk-hl-in:rgba(255,255,255,1);
  --lk-rim-out:rgba(255,248,226,0.55);--lk-sheen-out:rgba(255,252,240,0.5);--lk-hl-out:rgba(255,255,255,0.75);
  --lk-sh-b:0 2px 7px rgba(120,85,25,0.16);--lk-sh-c:0 6px 18px rgba(120,85,25,0.16)}
html.sa-lens .ch-in,html.sa-lens .ch-typing{background:radial-gradient(140% 120% at 18% 0%,var(--lk-sheen-in),transparent 58%),var(--in);
  box-shadow:inset 0 0 0 1px var(--lk-rim-in),inset 0 1.5px 0 var(--lk-hl-in),var(--lk-sh-b)}
html.sa-lens .ch-out{background:radial-gradient(140% 120% at 18% 0%,var(--lk-sheen-out),transparent 55%),linear-gradient(180deg,var(--out-a),var(--out-b));
  box-shadow:inset 0 0 0 1px var(--lk-rim-out),inset 0 1.5px 0 var(--lk-hl-out),var(--lk-sh-b)}
html.sa-lens .ch-row.atme .ch-in{--lk-rim-in:rgba(228,200,140,0.78);box-shadow:inset 0 0 0 1px var(--lk-rim-in),inset 0 1.5px 0 var(--lk-hl-in),var(--lk-sh-b)}
html.sa-lens .sa-dlg.ch.lt .ch-row.atme .ch-in{--lk-rim-in:rgba(139,106,48,0.72)}
html.sa-lens .ch-b.ai{--lk-rim-in:transparent}
html.sa-lens .ch-row.tail .ch-b::before{-webkit-mask-image:var(--tail-o);mask-image:var(--tail-o)}
html.sa-lens .ch-row.tail .ch-in::before{background:linear-gradient(var(--lk-rim-in),var(--lk-rim-in)),var(--in)}
html.sa-lens .ch-row.tail .ch-out::before{background:linear-gradient(var(--lk-rim-out),var(--lk-rim-out)),var(--out-b)}
html.sa-lens .ch-row.tail .ch-b::after{content:"";position:absolute;bottom:0;width:11px;height:16px;pointer-events:none;
  -webkit-mask:var(--tail-i) no-repeat 0 0/100% 100%;mask:var(--tail-i) no-repeat 0 0/100% 100%}
html.sa-lens .ch-row.tail .ch-in::after{left:-6px;background:var(--in)}
html.sa-lens .ch-row.tail .ch-out::after{right:-6px;background:var(--out-b);transform:scaleX(-1)}
html.sa-lens .ch-card,html.sa-lens .ch-call{background:radial-gradient(120% 90% at 30% 0%,var(--lk-sheen-in),transparent 60%),var(--card);
  box-shadow:inset 0 1.5px 0 var(--lk-hl-in),inset 0 0 22px rgba(255,230,170,0.05),var(--lk-sh-c)}
html.sa-lens .ch-card:not(.done):not(.stopc) .ch-card-tile{box-shadow:inset -10px 0 18px rgba(26,16,8,0.08),inset 0 1.5px 0 rgba(255,255,255,0.6),inset 0 0 18px rgba(255,248,225,0.22)}
html.sa-lens .ch-go,html.sa-lens .ch-cbtn:not(.ghost):not(.bad){position:relative;color:var(--lk-hi);
  background:radial-gradient(120% 160% at 50% 0%,rgba(232,201,131,0.24),rgba(200,169,110,0.12) 62%);
  box-shadow:inset 0 0 0 1px var(--lk-rim),inset 0 0 18px var(--lk-glow),inset 0 1.5px 0 var(--lk-hl),0 4px 14px rgba(0,0,0,0.28)}
html.sa-lens.sa-light .ch-go,html.sa-lens.sa-light .ch-cbtn:not(.ghost):not(.bad){background:radial-gradient(120% 160% at 50% 0%,rgba(255,255,255,0.85),rgba(176,138,70,0.22) 70%);
  box-shadow:inset 0 0 0 1px rgba(139,106,48,0.6),inset 0 0 18px var(--lk-glow),inset 0 1.5px 0 var(--lk-hl),0 3px 10px rgba(120,85,25,0.16)}
html.sa-lens .ch-go::after,html.sa-lens .ch-cbtn:not(.ghost):not(.bad)::after,html.sa-lens .ch-more::after{
  content:"";position:absolute;inset:-3.5px;border-radius:999px;border:1px solid var(--lk-ring);pointer-events:none}
html.sa-lens.sa-light .ch-go::after,html.sa-lens.sa-light .ch-cbtn:not(.ghost):not(.bad)::after{border-color:rgba(139,106,48,0.45)}
html.sa-lens .ch-day,html.sa-lens .ch-sys{position:relative;background:rgba(22,17,9,0.66);box-shadow:inset 0 0 0 1px var(--lk-rim),inset 0 1px 0 var(--lk-hl)}
html.sa-lens .sa-dlg.ch.lt .ch-day,html.sa-lens .sa-dlg.ch.lt .ch-sys{background:rgba(255,252,242,0.72)}
html.sa-lens .ch-day::after{content:"";position:absolute;inset:-3.5px;border-radius:15.5px;border:1px solid var(--lk-ring);pointer-events:none}
html.sa-lens .ch-more{position:relative;background:var(--lk-glass);border-color:transparent;box-shadow:inset 0 0 0 1px var(--lk-rim),inset 0 1.5px 0 var(--lk-hl)}
html.sa-lens .ch-input,html.sa-lens .ch-search,html.sa-lens .ch-field{background:var(--lk-glass);border-color:transparent;
  box-shadow:inset 0 0 0 1px var(--lk-rim),inset 0 0 14px var(--lk-glow),inset 0 1.5px 0 var(--lk-hl)}
html.sa-lens .ch-input:focus,html.sa-lens .ch-search:focus,html.sa-lens .ch-field:focus{box-shadow:inset 0 0 0 1px var(--lk-hi),inset 0 0 14px var(--lk-glow),inset 0 1.5px 0 var(--lk-hl)}
html.sa-lens .ch-sg,html.sa-lens .ch-mc,html.sa-lens .ch-ai-nm .ch-ai-d,html.sa-lens .ch-swipe{background:var(--lk-glass);border-color:transparent;
  box-shadow:inset 0 0 0 1px var(--lk-rim),inset 0 1.5px 0 var(--lk-hl)}
html.sa-lens .ch-ai-nm .ch-ai-d{color:var(--lk-gold)}

`;
export function ensureLookCss() {
  if (typeof document === "undefined" || !document.head || !document.createElement) return;
  if (document.getElementById("sa-home-look-css")) return;
  const st = document.createElement("style"); st.id = "sa-home-look-css"; st.textContent = CSS; document.head.appendChild(st);
}
