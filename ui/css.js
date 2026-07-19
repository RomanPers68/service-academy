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
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
    }
    .sa-glass:active {
      transform: scale(0.97);
      opacity: 0.88;
    }
    .sa-dot { transition: background 0.2s ease, transform 0.2s ease; }
    .sa-dot-active { transform: scale(1.3); }
    html, body { overflow-x: hidden !important; touch-action: pan-y; }
    * { touch-action: pan-y !important; }
    /* Плавное перелистывание карточек (уроки, тренажёры): въезд с той стороны, куда листаешь */
    @keyframes saCardR { from { opacity: 0; transform: translateX(26px); } to { opacity: 1; transform: none; } }
    @keyframes saCardL { from { opacity: 0; transform: translateX(-26px); } to { opacity: 1; transform: none; } }
    .sa-cardpage-r { animation: saCardR .34s cubic-bezier(.16,1,.3,1) both; }
    .sa-cardpage-l { animation: saCardL .34s cubic-bezier(.16,1,.3,1) both; }
    @media (prefers-reduced-motion: reduce) { .sa-cardpage-r, .sa-cardpage-l { animation: none; } }
    /* Исключение: горизонтальные ленты (вкладки книги и т.п.) можно листать пальцем */
    .sa-hscroll, .sa-hscroll * { touch-action: pan-x pan-y !important; }

    /* Переход между экранами: каждый мягко въезжает (fade + сдвиг) */
    @keyframes saPageIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
    .sa-pagein { animation: saPageIn .28s cubic-bezier(.16,1,.3,1) both; }
    /* Мерцающий скелетон стеклянных карточек на время ленивой подгрузки */
    @keyframes saShimmer { from { background-position:-200% 0; } to { background-position:200% 0; } }
    .sa-skel { background: linear-gradient(100deg, rgba(200,169,110,0.07) 40%, rgba(230,200,140,0.16) 50%, rgba(200,169,110,0.07) 60%); background-size:200% 100%; animation: saShimmer 1.4s linear infinite; }
    @media (prefers-reduced-motion: reduce) { .sa-pagein, .sa-skel { animation:none; } }
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
