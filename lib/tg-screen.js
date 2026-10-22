// lib/tg-screen.js — v69 (Доп. 382): полноэкранный режим Telegram на телефоне.
// Владелец показал запись другого мини-приложения: шапки Telegram («Service Academy · мини-приложение» с серыми
// кругами) нет, фон приложения — до самого верха, сверху только маленькие кнопки Telegram: «✕ Закрыть» слева,
// «⌄» (свернуть) и «⋯» справа; смахнуть приложение вниз нельзя — для этого «⌄». Это полноэкранный режим
// (Bot API 8.0: requestFullscreen). Сами кнопки и надпись в шапке Telegram перекрасить не даёт — полноэкранный
// режим убирает шапку целиком; цвет кнопок и строки состояния Telegram подбирает к setHeaderColor (App.jsx).
//
// Только на телефоне (iOS, Android): на компьютере полноэкранный режим растянул бы окно Telegram на весь монитор.
// В полноэкранном режиме сверху — строка состояния телефона и строка кнопок Telegram; приложение начинается под
// ними: на <html> класс sa-tgfs и переменная --sa-st (сколько пикселей сверху занято), по ним — правила в ui/css.js
// и отступы шапок у слоёв поверх экрана. Не в полноэкранном режиме переменной нет — везде прежний отступ (env()).

export const TG_PHONES = ["ios", "android", "android_x"];

// Просить ли полноэкранный режим: телефон и Telegram с Bot API 8.0+ (старый клиент метода не знает — остаётся как был)
export function tgFullscreenWanted(tg) {
  if (!tg || typeof tg.requestFullscreen !== "function") return false;
  if (!TG_PHONES.includes(String(tg.platform || "").toLowerCase())) return false;
  try { return typeof tg.isVersionAtLeast === "function" ? !!tg.isVersionAtLeast("8.0") : false; } catch (e) { return false; }
}

// Сколько сверху занято в полноэкранном режиме: вырез экрана (строка состояния) + строка кнопок Telegram
export function tgTopInset(tg) {
  if (!tg || !tg.isFullscreen) return 0;
  const s = tg.safeAreaInset || {}, c = tg.contentSafeAreaInset || {};
  const v = (Number(s.top) || 0) + (Number(c.top) || 0);
  return v > 0 ? Math.round(v) : 0;
}

// Текущий верхний отступ (px) — для расчётов прокрутки и подсказок: 0, если приложение не в полноэкранном режиме
export function topInsetPx() {
  try {
    const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sa-st"));
    return v > 0 ? v : 0;
  } catch (e) { return 0; }
}

// Включает режим и следит за ним; возвращает отписку. root — <html> (в тестах — заглушка с classList и style)
export function startTgScreen(tg, root) {
  if (!tg) return () => {};
  const el = root || (typeof document !== "undefined" ? document.documentElement : null);
  const apply = () => {
    if (!el) return;
    const top = tgTopInset(tg);
    try { el.classList.toggle("sa-tgfs", !!tg.isFullscreen && top > 0); } catch (e) {}
    try { if (top > 0) el.style.setProperty("--sa-st", top + "px"); else el.style.removeProperty("--sa-st"); } catch (e) {}
  };
  const EV = ["fullscreenChanged", "safeAreaChanged", "contentSafeAreaChanged", "viewportChanged"];
  try { if (tg.onEvent) EV.forEach((ev) => tg.onEvent(ev, apply)); } catch (e) {}
  // смахнуть вниз — нельзя (свернуть — кнопкой «⌄» Telegram); index.html просит то же при запуске
  try { if (typeof tg.disableVerticalSwipes === "function") tg.disableVerticalSwipes(); } catch (e) {}
  try { if (tgFullscreenWanted(tg) && !tg.isFullscreen) tg.requestFullscreen(); } catch (e) {}
  apply();
  return () => { try { if (tg.offEvent) EV.forEach((ev) => tg.offEvent(ev, apply)); } catch (e) {} };
}
