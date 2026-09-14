import React from "react";
import { onActivate, vibrate } from "../lib/utils";

// ── Дополнение 173: экран «Без сети» ──────────────────────────────────────────
// Объясняет честно: где офлайн работает сам, где нужен экран «Домой», что
// доступно без связи. Кнопка «Открыть в браузере» — путь для iPhone.
export function OfflineScreen({ T, a11y, onBack }) {
  const gold = a11y ? "#8B6A30" : "#D2A85A";
  const text = T.modTitle.color, sub = T.modSub.color;
  const [copied, setCopied] = React.useState(false);
  const tg = typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp;
  const inTg = !!(tg && tg.initData);
  const ios = typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const standalone = typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true);
  const swOk = typeof navigator !== "undefined" && "serviceWorker" in navigator;
  const url = typeof window !== "undefined" ? window.location.origin + "/" : "";
  const frost = {
    background: a11y ? "rgba(250,242,222,0.62)" : "rgba(226,186,116,0.09)",
    border: a11y ? "1px solid rgba(139,106,48,0.30)" : "1px solid rgba(255,255,255,0.13)",
    boxShadow: a11y ? "inset 0 0 26px rgba(255,255,255,0.55), 0 6px 18px rgba(120,85,25,0.14)" : "inset 0 0 26px rgba(255,248,230,0.07), 0 8px 24px rgba(0,0,0,0.45)",
    borderRadius: 18, padding: "14px 15px", marginBottom: 12,
  };
  const openBrowser = () => { vibrate("light"); if (inTg && tg.openLink) tg.openLink(url); else window.open(url, "_blank"); };
  const copy = () => { try { navigator.clipboard.writeText(url).then(() => { setCopied(true); vibrate("success"); setTimeout(() => setCopied(false), 2000); }); } catch (e) {} };
  const status = standalone ? { t: "Приложение на экране «Домой»", d: "Лучший вариант: открывается без сети, обновляется само, когда связь есть." }
    : swOk ? { t: "Офлайн включён", d: "Приложение сохранено на телефоне. Открывал при связи — откроется и без неё." }
    : { t: "Здесь офлайн недоступен", d: ios && inTg ? "Telegram на iPhone не даёт сохранять приложение на телефон — это ограничение Apple. Путь ниже — Safari и экран «Домой»." : "Этот браузер не умеет сохранять приложение. Открой в Safari или Chrome." };
  return (
    <div style={T.screen} className="sa-screen">
      <div style={{ padding: "16px 16px 6px", display: "flex", alignItems: "center", gap: 10 }}>
        <button className="sa-btn" onClick={onBack} {...onActivate(onBack)} aria-label="Назад" style={{ border: "none", background: "transparent", color: gold, fontSize: 22, cursor: "pointer", padding: "4px 8px 4px 0" }}>‹</button>
        <div>
          <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10.5, letterSpacing: 1.5, color: gold }}>БЕЗ СЕТИ</div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 24, color: text, lineHeight: 1.15 }}>Подвал, кухня, лестница</div>
        </div>
      </div>
      <div style={{ padding: "4px 16px 100px" }}>
        <div style={{ ...frost, borderColor: swOk || standalone ? "#5DBB8A88" : undefined }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 17, color: swOk || standalone ? "#5DBB8A" : text }}>{status.t}</div>
          <div style={{ fontSize: 13.5, color: sub, lineHeight: 1.55, marginTop: 4 }}>{status.d}</div>
        </div>

        <div style={frost}>
          <div style={{ fontSize: 10.5, letterSpacing: 1.5, color: gold, fontFamily: "monospace", marginBottom: 8 }}>ЧТО РАБОТАЕТ БЕЗ СВЯЗИ</div>
          <div style={{ fontSize: 13.5, color: sub, lineHeight: 1.6 }}>
            Уроки и Справочник · Колода бармена · Меню и Колода меню (сохранённая версия) · Глоссарий · SOS · прогресс и ответы на тесты (уйдут на сервер, когда появится сеть).
            <br />Не работает: Наставник и голос, свежий график, фото из облака, публикация меню.
          </div>
        </div>

        {(ios && inTg) || (!swOk && !standalone) ? (
          <div style={frost}>
            <div style={{ fontSize: 10.5, letterSpacing: 1.5, color: gold, fontFamily: "monospace", marginBottom: 8 }}>{ios ? "IPHONE: ЭКРАН «ДОМОЙ»" : "БРАУЗЕР: ЭКРАН «ДОМОЙ»"}</div>
            <div style={{ fontSize: 13.5, color: sub, lineHeight: 1.6 }}>
              1. Нажми «Открыть в браузере» — откроется Safari.<br />
              2. В Safari: кнопка «Поделиться» (квадрат со стрелкой) → «На экран “Домой”» → Добавить.<br />
              3. Войди по своему коду. Иконка SA на экране — приложение открывается без сети, обновляется само.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="sa-btn" onClick={openBrowser} style={{ ...T.doneBtn, flex: 1.4, background: gold }}>Открыть в браузере</button>
              <button className="sa-btn" onClick={copy} style={{ ...T.doneBtn, flex: 1, background: "transparent", border: `1px solid ${gold}88`, color: gold }}>{copied ? "Скопировано ✓" : "Ссылка"}</button>
            </div>
          </div>
        ) : null}

        {!ios && inTg && swOk ? (
          <div style={frost}>
            <div style={{ fontSize: 10.5, letterSpacing: 1.5, color: gold, fontFamily: "monospace", marginBottom: 8 }}>ANDROID</div>
            <div style={{ fontSize: 13.5, color: sub, lineHeight: 1.6 }}>В Telegram на Android офлайн уже работает — ничего делать не нужно. Хочешь иконку на экране — «Открыть в браузере» и «Добавить на главный экран» в Chrome.</div>
            <button className="sa-btn" onClick={openBrowser} style={{ ...T.doneBtn, marginTop: 12, width: "100%", background: "transparent", border: `1px solid ${gold}88`, color: gold }}>Открыть в браузере</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
