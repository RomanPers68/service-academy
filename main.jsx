import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { loadRoleModules } from "./data/modules";
import { thanksCode, isThanksLink } from "./lib/guest-thanks";

// v84 (Доп. 397): страница гостя «Сказать спасибо» по QR сотрудника (?thanks=код) — без входа, без приложения и без
// сервис-воркера: гость в зале открывает её с мобильного интернета, ждать загрузки всего приложения ему незачем.
const GUEST_THANKS = typeof location !== "undefined" && isThanksLink(location.search);

// v79 (Доп. 392): уроки своей роли просим сразу, параллельно с запуском React. Главной карточке нужно название урока,
// а раньше запрос уходил, только когда App дочитает профиль из хранилища. Повторный вызов из App — тот же промис.
try {
  const p = JSON.parse(localStorage.getItem("sa_profile") || "null");
  const uk = p && p.name ? `_${p.name}_${p.surname || ""}` : "";
  const r = uk ? JSON.parse(localStorage.getItem("sa_last_role" + uk) || "null") : null;
  if (typeof r === "string" && r) loadRoleModules(r).catch(() => {});
} catch (e) {}

// Внешний рубеж: внутренний ErrorBoundary живёт ВНУТРИ App и не ловит
// краш самого верхнего уровня App — тогда #root пустел молча, а заставка
// из index.html (z-index 9999) мерцала вечно. Здесь ловим всё, снимаем
// заставку и показываем текст ошибки — «вечная загрузка» становится
// диагнозом на экране.
class BootBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(error) {
    return { err: String(error && (error.message || error)).slice(0, 200) };
  }
  componentDidCatch(error) {
    try { const sp = document.getElementById("sa-splash"); if (sp) sp.remove(); } catch (e) {}
    try { console.error("ServiceAcademy boot crashed:", error); } catch (e) {}
  }
  render() {
    if (this.state.err) {
      return (
        <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center",
          justifyContent:"center", padding:32, textAlign:"center", background:"#171208",
          fontFamily:"Georgia, serif", color:"#C8A96E" }}>
          <div style={{ fontSize:15, letterSpacing:5, marginBottom:14 }}>SA</div>
          <div style={{ fontSize:15, fontWeight:"bold", marginBottom:8 }}>Приложение не запустилось</div>
          <div style={{ fontSize:12, opacity:.85, lineHeight:1.65, maxWidth:280 }}>
            Закрой мини-приложение полностью и открой заново. Если повторится, покажи менеджеру этот экран.
            <br /><br />
            <span style={{ fontSize:10, opacity:.7 }}>Техдетали: {this.state.err}</span>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

if (GUEST_THANKS) {
  import("./ui/guest-thanks.jsx").then(({ GuestThanksPage }) => {
    try { document.body.style.margin = "0"; document.body.style.background = "#14110A"; } catch (e) {}
    ReactDOM.createRoot(document.getElementById("root")).render(<GuestThanksPage code={thanksCode(location.search)} />);
  }).catch(() => {
    try { const sp = document.getElementById("sa-splash"); if (sp) sp.remove(); document.getElementById("root").textContent = "Страница не загрузилась. Обновите её."; } catch (e) {}
  });
} else {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <BootBoundary>
        <App />
      </BootBoundary>
    </React.StrictMode>
  );
}

// Доп. 173: сервис-воркер — приложение открывается без сети (Android-Telegram, Safari/Chrome,
// экран «Домой»). В iOS-Telegram serviceWorker недоступен — регистрация тихо пропускается.
if (!GUEST_THANKS && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then(reg => {
      // Доп. 279: свежая версия приезжает сама — новый воркер сразу берёт управление
      if (reg.waiting) reg.waiting.postMessage("skip-waiting");
      reg.addEventListener("updatefound", () => {
        const w = reg.installing; if (!w) return;
        w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) w.postMessage("skip-waiting"); });
      });
      setInterval(() => reg.update().catch(() => {}), 10 * 60 * 1000);   // раз в десять минут, пока приложение открыто
    }).catch(() => {});
    let reloaded = false;
    // v59 (Доп. 372): новый воркер взял управление. В первые секунды после открытия — перезагрузка, как раньше
    // (ничего не прервём). Позже — не дёргаем человека посреди теста: показываем тост «Готова новая версия · Обновить».
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return; reloaded = true;
      if (performance.now() < 5000) window.location.reload(); else announceUpdate();
    });
  });
}

// v59 (Доп. 372): обновление готово — приложение покажет тост (ui/update-toast.jsx), перезагрузка по кнопке
function announceUpdate() {
  try { window.__saUpdateReady = true; window.dispatchEvent(new CustomEvent("sa-update-ready")); } catch (e) {}
}

// Доп. 279: Telegram держит страницу в памяти сутками, и «обновить» приходилось жать руками.
// При каждом открытии сверяем, та ли сборка: index.html без кэша → сравниваем имя главного файла.
// Совпало — молчим; разошлось — один раз перезагружаемся (и чистим кэши, если воркер есть).
(function autoUpdate() {
  const KEY = "sa_reload_at";
  const current = () => {
    try {
      const src = [...document.querySelectorAll('script[type="module"][src]')].map(x => x.getAttribute("src"));
      const perf = performance.getEntriesByType("resource").map(e => e.name).filter(n => /\/assets\/index-[^/]+\.js$/.test(n));
      return (src.find(x => /\/assets\/index-/.test(x)) || perf[0] || "").split("/").pop();
    } catch (e) { return ""; }
  };
  const check = async (reason) => {
    if (document.visibilityState === "hidden") return;
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 60000) return;                 // не чаще раза в минуту
    try {
      const html = await fetch("/index.html?ts=" + Date.now(), { cache: "no-store" }).then(r => r.ok ? r.text() : "");
      const m = html.match(/\/assets\/(index-[A-Za-z0-9_-]+\.js)/);
      const mine = current();
      if (!m || !mine || m[1] === mine) return;
      sessionStorage.setItem(KEY, String(Date.now()));
      if ("serviceWorker" in navigator) {
        try { const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); } catch (e) {}
        try { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r => r.update())); } catch (e) {}
      }
      // v59: при открытии — перезагрузка сразу (ничего не прервём); вернулся из другого приложения — тост «Обновить»
      if (reason === "load") window.location.reload(); else announceUpdate();
    } catch (e) {}
  };
  window.addEventListener("load", () => setTimeout(() => check("load"), 1200));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check("visible"); });
})();

