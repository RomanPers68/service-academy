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

const STORE = "sa_ai_chats_v2"; // сессии чатов: { uid: { sessions: [...], activeId } }
const OLD_STORE = "sa_ai_chat_v1";
const MAX_STORED = 60;   // реплик на чат храним на устройстве
const MAX_SENT = 12;     // последних реплик уходит в контекст
const MAX_CHATS = 20;    // чатов в списке

const freshSession = () => ({
  id: "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
  title: "Новый чат", msgs: [], updatedAt: Date.now(),
});
const titleOf = (msgs) => {
  const u = msgs.find(m => m.role === "user");
  if (!u) return "Новый чат";
  return u.content.length > 34 ? u.content.slice(0, 34) + "…" : u.content;
};
const loadStore = (uid) => {
  try {
    const all = JSON.parse(localStorage.getItem(STORE) || "{}");
    if (all[uid]?.sessions?.length) return all[uid];
  } catch (e) {}
  // миграция старой одиночной истории в первый чат
  let msgs = [];
  try {
    const old = JSON.parse(localStorage.getItem(OLD_STORE) || "{}");
    if (Array.isArray(old[uid])) msgs = old[uid];
  } catch (e) {}
  const s = { ...freshSession(), title: titleOf(msgs), msgs };
  return { sessions: [s], activeId: s.id };
};
const saveStore = (uid, st) => {
  try {
    const all = JSON.parse(localStorage.getItem(STORE) || "{}");
    all[uid] = {
      activeId: st.activeId,
      sessions: st.sessions.slice(0, MAX_CHATS).map(s => ({ ...s, msgs: s.msgs.slice(-MAX_STORED) })),
    };
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
  const [store, setStore] = React.useState(() => loadStore(uid));
  const active = store.sessions.find(s => s.id === store.activeId) || store.sessions[0];
  const msgs = active.msgs;
  const [showChats, setShowChats] = React.useState(false);
  const [delArm, setDelArm] = React.useState(null); // чат, «взведённый» на удаление
  // обновить реплики активного чата (+ заголовок и время) и сохранить
  const updMsgs = React.useCallback((nextMsgs) => {
    setStore(st => {
      const sessions = st.sessions.map(s =>
        s.id === st.activeId ? { ...s, msgs: nextMsgs, title: titleOf(nextMsgs), updatedAt: Date.now() } : s);
      const next = { ...st, sessions };
      saveStore(uid, next);
      return next;
    });
  }, [uid]);
  const newChat = () => {
    vibrate("light");
    setShowChats(false); setError(null);
    if (msgs.length === 0) return; // текущий и так пустой
    setStore(st => {
      const s = freshSession();
      const next = { activeId: s.id, sessions: [s, ...st.sessions].slice(0, MAX_CHATS) };
      saveStore(uid, next);
      return next;
    });
  };
  const switchChat = (id) => {
    vibrate("light");
    setError(null);
    setStore(st => { const next = { ...st, activeId: id }; saveStore(uid, next); return next; });
    setShowChats(false);
  };
  const deleteChat = (id) => {
    vibrate("light");
    setStore(st => {
      let sessions = st.sessions.filter(s => s.id !== id);
      if (!sessions.length) sessions = [freshSession()];
      const activeId = st.activeId === id ? sessions[0].id : st.activeId;
      const next = { sessions, activeId };
      saveStore(uid, next);
      return next;
    });
  };
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [confirmClear, setConfirmClear] = React.useState(false);
  const listRef = React.useRef(null);
  const inputRef = React.useRef(null);
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
    // Жесты Telegram настраиваются глобально при старте (index.html):
    // expand + disableVerticalSwipes. Локально не переключаем, чтобы уход
    // с экрана не возвращал жест сворачивания.
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
    if (inputRef.current) inputRef.current.style.height = "auto";
    const next = [...msgs, { role: "user", content: text, t: Date.now() }];
    updMsgs(next);
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
          updMsgs(done);
          vibrate("light");
        } else {
          setError(ERRORS[d?.error] || ERRORS.server);
        }
      })
      .catch(() => setError(ERRORS.network))
      .finally(() => setSending(false));
  }, [input, msgs, sending, uid, updMsgs]);

  const clearChat = () => {
    vibrate("light");
    updMsgs([]);
    setConfirmClear(false); setError(null);
  };

  const lastUser = [...msgs].reverse().find(m => m.role === "user");

  // Модальные панели (список чатов, подтверждение): плотное стекло,
  // накрывающее контент — в отличие от карточного lessGlass, которое
  // в светлой теме слишком прозрачно и «тонет» в переписке
  const panel = {
    borderRadius: RADIUS.lg,
    background: a11y ? "rgba(250,246,236,0.94)" : "rgba(30,22,10,0.94)",
    backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
    border: a11y ? "1px solid rgba(139,106,48,0.45)" : "1px solid rgba(200,160,80,0.42)",
    boxShadow: a11y
      ? "inset 0 1px 0 rgba(255,255,255,0.9), 0 14px 40px rgba(70,50,15,0.28)"
      : "inset 0 1px 0 rgba(255,255,255,0.10), 0 14px 40px rgba(0,0,0,0.55)",
  };

  const miniBtn = {
    width: 34, height: 34, borderRadius: 17, flexShrink: 0, cursor: "pointer", padding: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: a11y ? "rgba(139,106,48,0.10)" : "rgba(250,240,215,0.08)",
    border: `1px solid ${a11y ? "rgba(139,106,48,0.4)" : "rgba(200,160,80,0.35)"}`,
  };
  const fmtWhen = (ts) => {
    const d = new Date(ts);
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) + " · " +
           d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  };

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
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          <button className="sa-btn" style={miniBtn} aria-label="Список чатов"
            onClick={() => { vibrate("light"); setConfirmClear(false); setDelArm(null); setShowChats(v => !v); }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/>
            </svg>
          </button>
          <button className="sa-btn" style={miniBtn} aria-label="Новый чат" onClick={newChat}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14"/><path d="M5 12h14"/>
            </svg>
          </button>
          {msgs.length > 0 && (
            <button className="sa-btn" style={miniBtn} aria-label="Очистить переписку"
              onClick={() => { setShowChats(false); setConfirmClear(true); }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Оверлеи под шапкой: подтверждение очистки и список чатов ──
          Абсолютные, поверх ленты — видны при любой длине переписки.
          Подложка-ловушка: тап мимо панели закрывает её */}
      {(showChats || confirmClear) && (
        <div onClick={() => { setShowChats(false); setConfirmClear(false); setDelArm(null); }}
          style={{ position: "absolute", inset: 0, zIndex: 5 }} />
      )}
      {confirmClear && (
        <div className="sa-pagein" style={{ position: "absolute", top: 62, left: 12, right: 12, zIndex: 6,
            ...panel, padding: 14, borderColor: RED }}>
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
      {showChats && (
        <div className="sa-pagein" style={{ position: "absolute", top: 62, left: 12, right: 12, zIndex: 6,
            ...panel, padding: "6px 6px", maxHeight: "55vh", overflowY: "auto", WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain" }} >
          {store.sessions.map(s => (
            <div key={s.id}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 10px", borderRadius: RADIUS.md, cursor: "pointer",
                border: s.id === store.activeId ? `1px solid ${gold}66` : "1px solid transparent",
                background: s.id === store.activeId ? (a11y ? "rgba(139,106,48,0.08)" : "rgba(200,169,110,0.07)") : "transparent" }}>
              <div onClick={() => switchChat(s.id)} {...onActivate(() => switchChat(s.id))} style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: T.modTitle.color, fontSize: 13, fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                <div style={{ color: sub, fontSize: 10.5, marginTop: 2, fontFamily: "monospace" }}>{fmtWhen(s.updatedAt)}{s.msgs.length ? ` · ${s.msgs.length}` : " · пусто"}</div>
              </div>
              {delArm === s.id ? (
                <button className="sa-btn" onClick={() => deleteChat(s.id)}
                  style={{ flexShrink: 0, padding: "7px 10px", borderRadius: RADIUS.pill, cursor: "pointer", border: `1px solid ${RED}66`,
                    background: "transparent", color: RED, fontFamily: "Georgia, serif", fontSize: 11.5, fontWeight: "bold" }}>Удалить?</button>
              ) : (
                <button className="sa-btn" onClick={() => { vibrate("light"); setDelArm(s.id); }} aria-label="Удалить чат"
                  style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 14, cursor: "pointer", border: "none",
                    background: "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={sub} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Лента ── */}
      <div ref={listRef} className="sa-dlgscroll"
        style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", padding: "14px 16px 10px", display: "flex", flexDirection: "column", gap: 10 }}>

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
              <button className="sa-btn" onClick={() => send(lastUser.content)}
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

      {/* ── Ввод: стеклянная плита-капсула в языке навбара ── */}
      <div style={{ padding: "6px 10px calc(10px + env(safe-area-inset-bottom, 0px))" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, padding: "6px 6px 6px 16px", borderRadius: 29,
            background: a11y ? "rgba(255,252,244,0.55)" : "rgba(28,21,9,0.55)",
            backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
            border: a11y ? "1px solid rgba(139,106,48,0.38)" : "1px solid rgba(200,160,80,0.30)",
            boxShadow: `inset 0 1px 0 ${a11y ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.10)"}, 0 6px 22px rgba(0,0,0,${a11y ? 0.10 : 0.38})` }}>
          <textarea
            ref={inputRef}
            className={a11y ? "sa-aiinput-light" : "sa-aiinput-dark"}
            value={input}
            rows={1}
            onChange={e => {
              setInput(e.target.value);
              // авто-рост: до ~5 строк, дальше — внутренний скролл
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 122) + "px";
            }}
            placeholder="Спроси наставника…"
            maxLength={600}
            style={{ flex: 1, minWidth: 0, padding: "11px 0", fontSize: 15, fontFamily: "Georgia, serif",
              lineHeight: 1.45, resize: "none", maxHeight: 122, overflowY: "auto",
              caretColor: a11y ? "#8B6A30" : "#C8A96E",
              background: "transparent", border: "none", outline: "none",
              color: a11y ? "#3A2E1C" : "#F0E8D8" }}
          />
          <button className="sa-btn" onClick={() => send()} disabled={sending || !input.trim()}
            style={{ width: 44, height: 44, borderRadius: 22, border: "none", cursor: "pointer", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: input.trim() && !sending ? "linear-gradient(135deg, #C8A96E 0%, #8B6A30 100%)" : "rgba(160,120,60,0.22)",
              boxShadow: input.trim() && !sending ? "0 4px 14px rgba(200,160,80,0.3)" : "none", transition: "all 0.2s ease" }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </button>
        </div>
      </div>
    </div>
  , document.body);
}
