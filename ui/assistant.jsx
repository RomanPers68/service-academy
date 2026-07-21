// ui/assistant.jsx
// ─────────────────────────────────────────────────────────────────────
// AI-ассистент «Наставник»: чат с ИИ, знающим стандарты Service Academy.
// Работает через Supabase Edge Function ai-chat (ключ провайдера — на
// сервере). История хранится локально на устройстве, на сервер уходят
// только последние реплики для контекста. Пока функция не развёрнута,
// экран честно объясняет, что настроить (supabase/AI-SETUP.md).
// ─────────────────────────────────────────────────────────────────────
import React from "react";
import { createPortal } from "react-dom";
import { GOLD, RED, RADIUS } from "./tokens";
import { vibrate, onActivate } from "../lib/utils";
import { SUPABASE_URL, SUPABASE_KEY, saToken } from "../api/supabase";
import { UI_SVG } from "./icons";
import { ACCENT_SERIF } from "./styles";

const STORE = "sa_ai_chat_v1";
const MAX_STORED = 60;   // сколько реплик держим на устройстве
const MAX_SENT = 12;     // сколько последних реплик уходит в контекст

const load = (uid) => {
  try {
    const all = JSON.parse(localStorage.getItem(STORE) || "{}");
    return Array.isArray(all[uid]) ? all[uid] : [];
  } catch (e) { return []; }
};
const save = (uid, msgs) => {
  try {
    const all = JSON.parse(localStorage.getItem(STORE) || "{}");
    all[uid] = msgs.slice(-MAX_STORED);
    localStorage.setItem(STORE, JSON.stringify(all));
  } catch (e) {}
};

// Мини-разметка ответа: **жирное** и переносы строк, без полного markdown
function Rich({ text, color }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return (
    <span style={{ whiteSpace: "pre-wrap" }}>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**")
          ? <b key={i} style={{ color }}>{p.slice(2, -2)}</b>
          : <span key={i}>{p}</span>
      )}
    </span>
  );
}

const QUICK = [
  "Гость недоволен блюдом — что говорить?",
  "Как красиво предложить десерт?",
  "Запара, всё горит — с чего начать?",
  "Гость спросил про аллергены",
];

const ERRORS = {
  not_configured: "Ассистент ещё не подключён на сервере. Менеджеру: инструкция — supabase/AI-SETUP.md в проекте.",
  rate_limit: "Бесплатный лимит ИИ на сегодня исчерпан — попробуй позже или попроси менеджера переключить модель.",
  auth: "Не удалось подтвердить твой доступ. Перезайди в приложение по своему коду.",
  network: "Нет связи с сервером. Проверь интернет и попробуй ещё раз.",
  provider: "ИИ-провайдер сейчас недоступен. Попробуй через минуту.",
  empty: "Ассистент промолчал — попробуй переформулировать вопрос.",
  server: "Что-то пошло не так на сервере. Попробуй ещё раз.",
};

export function AssistantScreen({ T, a11y, onBack, profile }) {
  const uid = String(profile?.id || "anon");
  const [msgs, setMsgs] = React.useState(() => load(uid));
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [confirmClear, setConfirmClear] = React.useState(false);
  const listRef = React.useRef(null);
  const gold = a11y ? "#8B6A30" : GOLD;
  const sub = T.modSub.color;

  const glass = {
    background: T.lessGlass?.bg || "linear-gradient(155deg, #382810 0%, #281C08 100%)",
    border: T.lessGlass?.border || "1px solid rgba(150,112,42,0.38)",
    boxShadow: T.lessGlass?.shadow || "0 6px 22px rgba(0,0,0,0.50), 0 2px 0 rgba(200,160,60,0.18) inset",
    borderRadius: RADIUS.lg,
  };

  // Пока чат открыт — глушим жест «потяни вниз, чтобы свернуть» у Telegram
  React.useEffect(() => {
    const tg = window.Telegram?.WebApp;
    try { tg?.disableVerticalSwipes?.(); } catch (e) {}
    return () => { try { tg?.enableVerticalSwipes?.(); } catch (e) {} };
  }, []);

  // Клавиатура iOS выезжает ПОВЕРХ fixed-элементов — следим за видимой
  // областью (visualViewport) и приподнимаем низ экрана на её высоту,
  // чтобы строка ввода всегда оставалась над клавиатурой.
  const [kb, setKb] = React.useState(0);
  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const measure = () => setKb(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    vv.addEventListener("resize", measure);
    vv.addEventListener("scroll", measure);
    measure();
    return () => { vv.removeEventListener("resize", measure); vv.removeEventListener("scroll", measure); };
  }, []);

  // автопрокрутка к последним репликам
  React.useEffect(() => {
    const el = listRef.current;
    if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, [msgs, sending, kb]);

  const send = React.useCallback((textArg) => {
    const text = (textArg ?? input).trim();
    if (!text || sending) return;
    vibrate("light");
    setError(null);
    setInput("");
    const next = [...msgs, { role: "user", content: text, t: Date.now() }];
    setMsgs(next); save(uid, next);
    setSending(true);
    fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY,
      },
      body: JSON.stringify({
        token: saToken(),
        messages: next.slice(-MAX_SENT).map(m => ({ role: m.role, content: m.content })),
      }),
    })
      .then(r => r.json())
      .then(d => {
        if (d?.ok && d.reply) {
          const done = [...next, { role: "assistant", content: d.reply, t: Date.now() }];
          setMsgs(done); save(uid, done);
          vibrate("light");
        } else {
          setError(ERRORS[d?.error] || ERRORS.server);
        }
      })
      .catch(() => setError(ERRORS.network))
      .finally(() => setSending(false));
  }, [input, msgs, sending, uid]);

  const clearChat = () => {
    vibrate("light");
    setMsgs([]); save(uid, []);
    setConfirmClear(false); setError(null);
  };

  const lastUser = [...msgs].reverse().find(m => m.role === "user");

  return createPortal(
    <div className="sa-screen sa-dlg"
      style={{ ...T.screen, position: "fixed", inset: 0, zIndex: 300, display: "flex", flexDirection: "column", boxSizing: "border-box", paddingBottom: kb,
        transition: "padding-bottom 0.25s cubic-bezier(0.25,0.1,0.25,1)",
        background: a11y
          ? "radial-gradient(130% 80% at 50% -5%, rgba(255,251,240,0.9) 0%, rgba(255,251,240,0) 55%), #E8DEC8"
          : "radial-gradient(130% 80% at 50% -5%, rgba(214,170,80,0.10) 0%, rgba(214,170,80,0) 55%), linear-gradient(160deg, #171208 0%, #1C1509 50%, #14110A 100%)" }}>
      {/* ── Шапка ── */}
      <div style={T.lessHead}>
        <button style={T.backBtn2} onClick={onBack}>‹</button>
        <div style={{ ...T.lessHeadTitle, display: "flex", alignItems: "center", gap: 8 }}>
          Наставник
          <span style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: 2, color: gold, border: `1px solid ${gold}66`, borderRadius: RADIUS.pill, padding: "2px 8px", fontWeight: "normal" }}>AI · БЕТА</span>
        </div>
        {msgs.length > 0 && (
          <button onClick={() => setConfirmClear(true)} {...onActivate(() => setConfirmClear(true))}
            style={{ border: "none", background: "transparent", color: sub, fontSize: 16, cursor: "pointer", padding: "4px 6px" }}>⌫</button>
        )}
      </div>

      {/* ── Лента ── */}
      <div ref={listRef} className="sa-dlgscroll"
        style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", padding: "14px 16px 10px", display: "flex", flexDirection: "column", gap: 10 }}>

        {confirmClear && (
          <div className="sa-pagein" style={{ ...glass, padding: 14, borderColor: RED }}>
            <div style={{ ...T.bold, marginTop: 0, marginBottom: 6 }}>Очистить переписку?</div>
            <div style={{ color: sub, fontSize: 12.5, marginBottom: 12 }}>История хранится только на этом устройстве и восстановлению не подлежит.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="sa-btn" onClick={() => setConfirmClear(false)}
                style={{ flex: 1, padding: "11px", borderRadius: RADIUS.md, cursor: "pointer", border: `1px solid ${gold}55`, background: "transparent", color: gold, fontFamily: "Georgia, serif", fontSize: 13, fontWeight: "bold" }}>Оставить</button>
              <button className="sa-btn" onClick={clearChat}
                style={{ flex: 1, padding: "11px", borderRadius: RADIUS.md, cursor: "pointer", border: `1px solid ${RED}66`, background: "transparent", color: RED, fontFamily: "Georgia, serif", fontSize: 13, fontWeight: "bold" }}>Очистить</button>
            </div>
          </div>
        )}

        {msgs.length === 0 && !confirmClear && (
          <div className="sa-pagein" style={{ ...glass, padding: "20px 18px" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
              <div className="sa-pop" style={{ width: 54, height: 54, borderRadius: 27, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(200,169,110,0.12)", border: `1px solid ${gold}55` }}>
                {UI_SVG.sparkle(gold, 26)}
              </div>
            </div>
            <div style={{ color: T.lessHeadTitle?.color, fontFamily: ACCENT_SERIF, fontSize: a11y ? 20 : 18, fontWeight: "bold", textAlign: "center", marginBottom: 8 }}>
              Привет, {profile?.name || "коллега"}!
            </div>
            <div style={{ color: sub, fontSize: a11y ? 14.5 : 13, lineHeight: 1.65, textAlign: "center", marginBottom: 4 }}>
              Я знаю стандарты Service Academy и помогу с любой рабочей ситуацией:
              гости, конфликты, подача, запара. Спрашивай как коллегу — или начни с готового вопроса:
            </div>
          </div>
        )}

        {msgs.length === 0 && !confirmClear && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {QUICK.map((q, i) => (
              <button key={i} className="sa-btn sa-pagein" onClick={() => send(q)}
                style={{ ...glass, animationDelay: (i * 0.06) + "s", padding: "12px 14px", textAlign: "left", cursor: "pointer", color: T.modTitle.color, fontFamily: "Georgia, serif", fontSize: a11y ? 14.5 : 13.5, lineHeight: 1.45 }}>
                {q}
              </button>
            ))}
          </div>
        )}

        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div className="dlg-in" style={{
              maxWidth: "86%", padding: "11px 14px", fontSize: a11y ? 15 : 13.5, lineHeight: 1.6,
              fontFamily: "Georgia, serif",
              ...(m.role === "user"
                ? { background: "linear-gradient(135deg, #C8A96E 0%, #8B6A30 100%)", color: "#fff",
                    borderRadius: RADIUS.lg, boxShadow: "0 3px 12px rgba(200,160,80,0.25)" }
                : { ...glass, color: T.modTitle.color,
                    borderRadius: RADIUS.lg }),
            }}>
              <Rich text={m.content} color={m.role === "user" ? "#fff" : gold} />
            </div>
          </div>
        ))}

        {sending && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ ...glass, padding: "12px 16px", borderRadius: RADIUS.lg, display: "flex", gap: 5 }}>
              {[0, 1, 2].map(i => (
                <span key={i} className="sa-pulse" style={{ width: 6, height: 6, borderRadius: 3, background: gold, animationDelay: (i * 0.18) + "s" }} />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="sa-pagein" style={{ ...glass, padding: "12px 14px", borderColor: `${RED}66` }}>
            <div style={{ color: sub, fontSize: 12.5, lineHeight: 1.55, marginBottom: lastUser ? 10 : 0 }}>{error}</div>
            {lastUser && (
              <button className="sa-btn" onClick={() => { setMsgs(m => m.filter((_, i) => i !== m.length - 1 || m[i].role !== "user")); send(lastUser.content); }}
                style={{ padding: "9px 14px", borderRadius: RADIUS.pill, cursor: "pointer", border: `1px solid ${gold}55`, background: "transparent", color: gold, fontFamily: "Georgia, serif", fontSize: 12.5, fontWeight: "bold" }}>
                ↻ Повторить
              </button>
            )}
          </div>
        )}

        {msgs.length > 0 && !sending && (
          <div style={{ color: sub, fontSize: 10, textAlign: "center", opacity: 0.7, fontFamily: "monospace", letterSpacing: 1, padding: "4px 0" }}>
            ИИ МОЖЕТ ОШИБАТЬСЯ · СТАНДАРТЫ РЕСТОРАНА ГЛАВНЕЕ
          </div>
        )}
      </div>

      {/* ── Ввод ── */}
      <div style={{ display: "flex", gap: 8, padding: "10px 16px calc(14px + env(safe-area-inset-bottom, 0px))", borderTop: `1px solid ${a11y ? "rgba(139,106,48,0.25)" : "rgba(200,160,80,0.18)"}` }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") send(); }}
          placeholder="Спроси наставника…"
          maxLength={600}
          style={{ flex: 1, minWidth: 0, padding: "12px 14px", borderRadius: RADIUS.pill, fontSize: 15, fontFamily: "Georgia, serif",
            background: a11y ? "rgba(255,255,255,0.7)" : "rgba(20,14,6,0.5)",
            color: a11y ? "#3A2E1C" : "#F0E8D8",
            border: a11y ? "1px solid rgba(160,120,60,0.45)" : "1px solid rgba(200,160,80,0.35)",
            outline: "none" }}
        />
        <button className="sa-btn" onClick={() => send()} disabled={sending || !input.trim()}
          style={{ width: 46, height: 46, borderRadius: 23, border: "none", cursor: "pointer", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: input.trim() && !sending ? "linear-gradient(135deg, #C8A96E 0%, #8B6A30 100%)" : "rgba(160,120,60,0.25)",
            boxShadow: input.trim() && !sending ? "0 4px 14px rgba(200,160,80,0.3)" : "none", transition: "all 0.2s ease" }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        </button>
      </div>
    </div>
  , document.body);
}
