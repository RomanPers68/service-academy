// lib/theme.js — v59 (Доп. 372): тема «как в системе».
// «Для чтения» (светлый фон, текст крупнее) раньше включалась только руками. Теперь есть переключатель
// «Тема как в системе»: светлая тема телефона (или Telegram) → «Для чтения», тёмная → обычная тёмная.
// Выбор руками («Для чтения» вкл/выкл) снимает автоматику. Чистые функции — их проверяют тесты в Node.
export const THEME_AUTO_KEY = "sa_theme_auto";

export function themeAutoOn() {
  try { return localStorage.getItem(THEME_AUTO_KEY) === "1"; } catch (e) { return false; }
}
export function setThemeAuto(on) {
  try { localStorage.setItem(THEME_AUTO_KEY, on ? "1" : "0"); } catch (e) {}
}

// Светлая ли тема у системы: Telegram говорит первым (colorScheme), иначе — медиазапрос браузера
export function systemLight(win = typeof window !== "undefined" ? window : null) {
  if (!win) return false;
  try {
    const tg = win.Telegram && win.Telegram.WebApp;
    if (tg && (tg.colorScheme === "light" || tg.colorScheme === "dark")) return tg.colorScheme === "light";
  } catch (e) {}
  try { return !!(win.matchMedia && win.matchMedia("(prefers-color-scheme: light)").matches); } catch (e) { return false; }
}

// Подписка на смену темы системы: вызывает cb(light) и возвращает отписку
export function watchSystemTheme(cb, win = typeof window !== "undefined" ? window : null) {
  if (!win) return () => {};
  const offs = [];
  try {
    const mq = win.matchMedia && win.matchMedia("(prefers-color-scheme: light)");
    if (mq) { const h = () => cb(systemLight(win)); if (mq.addEventListener) mq.addEventListener("change", h); else mq.addListener(h);
      offs.push(() => { if (mq.removeEventListener) mq.removeEventListener("change", h); else mq.removeListener(h); }); }
  } catch (e) {}
  try {
    const tg = win.Telegram && win.Telegram.WebApp;
    if (tg && tg.onEvent) { const h = () => cb(systemLight(win)); tg.onEvent("themeChanged", h); offs.push(() => { try { tg.offEvent && tg.offEvent("themeChanged", h); } catch (e) {} }); }
  } catch (e) {}
  return () => offs.forEach((f) => f());
}
