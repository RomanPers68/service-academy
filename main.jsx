import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

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
          <div style={{ fontSize:15, letterSpacing:5, marginBottom:14 }}>✦ SA</div>
          <div style={{ fontSize:15, fontWeight:"bold", marginBottom:8 }}>Приложение не запустилось</div>
          <div style={{ fontSize:12, opacity:.85, lineHeight:1.65, maxWidth:280 }}>
            Закрой мини-приложение полностью и открой заново. Если повторится — покажи менеджеру этот экран.
            <br /><br />
            <span style={{ fontSize:10, opacity:.7 }}>Техдетали: {this.state.err}</span>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BootBoundary>
      <App />
    </BootBoundary>
  </React.StrictMode>
);

// Доп. 173: сервис-воркер — приложение открывается без сети (Android-Telegram, Safari/Chrome,
// экран «Домой»). В iOS-Telegram serviceWorker недоступен — регистрация тихо пропускается.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

