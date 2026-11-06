// lib/page-ready.js
// v140 (Доп. 456), владелец (06.11): «В телеграмме появилась какая-то полоса снизу». Синюю полоску в 2 точки у нижнего края
// рисует сам Telegram на iPhone: это его индикатор загрузки страницы (WKWebView.estimatedProgress), он прячется на 100 %.
// WebKit считает страницу загруженной, только когда закончен последний запрос, начатый до события load, и fetch тоже.
// Приложение начинало запросы раньше load: уроки роли и логотип при загрузке скриптов, следом React и цепочка запросов
// к серверу. Полоска стояла на 90 %, пока цепочка не затихнет, на медленной сети подолгу. Теперь всё, что приложение просит
// на старте, начинается следующей задачей после load: страница загружена сразу после разбора, и запросы приложения на
// полоску больше не влияют. Задержался load (медленный шрифт заставки) — старт не позже чем через 3 с, как страховка.

export const READY_FALLBACK_MS = 3000;

// Ворота «страница загружена» для окна win и документа doc (в тестах — подделки).
// afterLoad(fn): до загрузки — fn ждёт; после — вызывается сразу. Каждая fn — один раз.
export function pageReadyGate(win, doc, fallbackMs = READY_FALLBACK_MS) {
  let ready = false;
  const waiters = [];
  const fire = () => {
    if (ready) return;
    ready = true;
    for (const f of waiters.splice(0)) { try { f(); } catch (e) { /* одна упавшая не держит остальные */ } }
  };
  // следующей задачей: WebKit отмечает загрузку законченной сразу после обработчиков load, запрос из них её бы задержал
  const soon = () => win.setTimeout(fire, 0);
  if (doc.readyState === "complete") soon();
  else {
    win.addEventListener("load", soon, { once: true });
    win.setTimeout(fire, fallbackMs);
  }
  return {
    afterLoad: (fn) => { if (ready) fn(); else waiters.push(fn); },
    isReady: () => ready,
  };
}

const gate = typeof window !== "undefined" && typeof document !== "undefined" && typeof window.addEventListener === "function"
  ? pageReadyGate(window, document) : null;
// вне браузера (тесты, сборка) — сразу
export const afterLoad = (fn) => (gate ? gate.afterLoad(fn) : fn());
export const pageIsReady = () => (gate ? gate.isReady() : true);
