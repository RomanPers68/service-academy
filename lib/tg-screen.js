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

// v137 (Доп. 452): приложение с экрана «Домой» на iPhone. index.html ставит на <html> класс sa-pwa и viewport-fit=cover:
// без него iPhone в этом режиме не сообщает вырезы экрана, и низ (строка ввода чата, нижние панели) уходил под полоску
// «Домой» (снимки владельца, 05.11). С ним приложение может лечь и под часы: тогда оно начинается под ними так же, как под
// кнопками Telegram, — --sa-st = вырез сверху (env(safe-area-inset-top)), отступ у body — ui/css.js (html.sa-pwa body).
// Если iOS сама держит полосу под часами (вырез сверху 0), переменной нет — верх как был.
export const pwaOn = (el) => {
  try { return !!(el && el.classList && typeof el.classList.contains === "function" && el.classList.contains("sa-pwa")); } catch (e) { return false; }
};

// Вырез сверху в px — замер невидимым элементом (как в ui/viewport.js)
export function envTopPx() {
  try {
    if (typeof document === "undefined" || !document.body) return 0;
    const d = document.createElement("div");
    d.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px)";
    document.body.appendChild(d);
    const v = parseFloat(getComputedStyle(d).paddingTop) || 0;
    d.remove();
    return v > 0 ? Math.round(v) : 0;
  } catch (e) { return 0; }
}

// Включает режим и следит за ним; возвращает отписку. root — <html> (в тестах — заглушка с classList и style).
// v137: и без Telegram, если это приложение с экрана «Домой» на iPhone (envTop — замер выреза сверху, в тестах — заглушка)
export function startTgScreen(tg, root, envTop = envTopPx) {
  const el = root || (typeof document !== "undefined" ? document.documentElement : null);
  const pwa = pwaOn(el);
  if (!tg && !pwa) return () => {};
  const apply = () => {
    if (!el) return;
    const tgTop = tg ? tgTopInset(tg) : 0;
    const top = tgTop || (pwa ? envTop() : 0);
    try { el.classList.toggle("sa-tgfs", !!(tg && tg.isFullscreen) && tgTop > 0); } catch (e) {}
    try { if (top > 0) el.style.setProperty("--sa-st", top + "px"); else el.style.removeProperty("--sa-st"); } catch (e) {}
    // v72 (Доп. 385): строку кнопок Telegram не занимаем — на iPhone он накрывает её своей подложкой целиком.
    // Снимаем и следы v71, если сборка обновилась на лету.
    try { el.classList.remove("sa-tgrow"); el.style.removeProperty("--sa-tgrow"); } catch (e) {}
  };
  const EV = ["fullscreenChanged", "safeAreaChanged", "contentSafeAreaChanged", "viewportChanged"];
  if (tg) {
    try { if (tg.onEvent) EV.forEach((ev) => tg.onEvent(ev, apply)); } catch (e) {}
    // смахнуть вниз — нельзя (свернуть — кнопкой «⌄» Telegram); index.html просит то же при запуске
    try { if (typeof tg.disableVerticalSwipes === "function") tg.disableVerticalSwipes(); } catch (e) {}
    try { if (tgFullscreenWanted(tg) && !tg.isFullscreen) tg.requestFullscreen(); } catch (e) {}
  }
  // v137: экран «Домой» — поворот меняет вырез (лёжа часов нет), а iPhone сообщает новый не сразу: перечитываем ещё дважды
  let t1 = 0, t2 = 0;
  const later = () => { apply(); clearTimeout(t1); clearTimeout(t2); t1 = setTimeout(apply, 250); t2 = setTimeout(apply, 700); };
  const win = pwa && typeof window !== "undefined" && typeof window.addEventListener === "function" ? window : null;
  if (win) { win.addEventListener("resize", later); win.addEventListener("orientationchange", later); }
  apply();
  return () => {
    try { if (tg && tg.offEvent) EV.forEach((ev) => tg.offEvent(ev, apply)); } catch (e) {}
    if (win) { win.removeEventListener("resize", later); win.removeEventListener("orientationchange", later); }
    clearTimeout(t1); clearTimeout(t2);
  };
}
