// ui/mentor.jsx
// Этап 2 — «Допуск наставника»: тест показывает ЗНАНИЕ, наставник подтверждает УМЕНИЕ.
// Сотрудник открывает список навыков роли, показывает выполнение в зале,
// наставник тут же в телефоне сотрудника подтверждает навык своей фамилией.
// Хранение: localStorage (sa_skills_<имя|фамилия>) + попытка синка в Supabase
// через rpcSync("confirm_skill") — очередь безопасно отбросит вызов, если RPC ещё не создан
// (SQL для сервера — в файле supabase/supabase-stage2.sql).
//
// Доп. 303: «Подтверждение в зале» (этап 22). Старший не обязан брать телефон
// сотрудника: сотрудник отправляет запрос, старший видит его у себя в «Наставничестве»
// и подтверждает, когда своими глазами увидел навык в зале (или «ещё рано» с запиской).
// Подтверждённое в зале попадает в допуск так же, как по PIN. PIN и «по фамилии» — как раньше.

import React from "react";
import { createPortal } from "react-dom";
import { ROLE_SKILLS } from "../data/skills";
import { onActivate, vibrate } from "../lib/utils";
import { rpc, rpcSync, saToken, rpcMissing } from "../api/supabase";
import { Confetti } from "./widgets";
import { ROLES } from "../data/roles";

const keyFor = (profile) => `sa_skills_${(profile?.name || "guest")}|${(profile?.surname || "")}`.toLowerCase();
const load = (profile) => { try { return JSON.parse(localStorage.getItem(keyFor(profile)) || "{}"); } catch (e) { return {}; } };
const save = (profile, obj) => { try { localStorage.setItem(keyFor(profile), JSON.stringify(obj)); } catch (e) {} };

// Фирменная «стеклянная» плашка — те же токены, что у карточек уроков (обе темы)
const glass = (T) => ({
  background: T.lessGlass?.bg || "rgba(255,250,238,0.05)",
  border: T.lessGlass?.border || "1px solid rgba(150,112,42,0.38)",
  borderTop: T.lessGlass?.borderTop || "1px solid rgba(215,170,68,0.46)",
  boxShadow: T.lessGlass?.shadow || "0 6px 22px rgba(0,0,0,0.50), 0 2px 0 rgba(200,160,60,0.18) inset, 0 -2px 4px rgba(0,0,0,0.38) inset",
  backdropFilter: T.lessGlass?.blur || "none",
  WebkitBackdropFilter: T.lessGlass?.blur || "none",
  borderRadius: 18,
});

const ago = (iso) => {
  const t = Date.parse(iso || ""); if (!t) return "";
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return "только что";
  if (m < 60) return m + " мин назад";
  const h = Math.round(m / 60);
  if (h < 24) return h + " ч назад";
  const d = Math.round(h / 24);
  return d + " " + (d % 10 === 1 && d % 100 !== 11 ? "день" : d % 10 >= 2 && d % 10 <= 4 && (d % 100 < 10 || d % 100 >= 20) ? "дня" : "дней") + " назад";
};
const DECLINE_NOTES = ["Покажи ещё раз на смене", "Нужно потренироваться"];

export function MentorScreen({ T, a11y, profile, role, roleObj, onBack, onInbox, extraSkills = [] }) {
  const gold = a11y ? "#7A5D2A" : "#C8A96E";
  const green = "#5DBB8A";
  const textColor = a11y ? "#2e211a" : "#F5EFE2";
  // Доп. 310: навыки своих разделов ресторана (редактор контента) — рядом со штатными
  const skills = React.useMemo(() => [...(ROLE_SKILLS[role] || []), ...(extraSkills || [])], [role, extraSkills]);
  const [confirmed, setConfirmed] = React.useState(() => load(profile));
  const [modal, setModal] = React.useState(null); // skill объект
  const [mentorName, setMentorName] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [byName, setByName] = React.useState(false); // запасной режим «по фамилии»
  const [pinErr, setPinErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [agree, setAgree] = React.useState(false);
  const canRevoke = ["manager", "senior"].includes(profile?.position) || profile?.is_admin;
  // ── Доп. 303: подтверждение в зале ──
  const [reqs, setReqs] = React.useState({});          // skill_id → последний запрос по этой роли
  const [hall, setHall] = React.useState("unknown");   // ok | missing | offline | unknown
  const [hallErr, setHallErr] = React.useState("");
  const [inbox, setInbox] = React.useState(null);      // старшему: запросы, ждущие решения
  const [arm, setArm] = React.useState(null);          // запрос, который «взведён» на подтверждение
  const [declineFor, setDeclineFor] = React.useState(null);
  const [inboxBusy, setInboxBusy] = React.useState(null);
  const [toast, setToast] = React.useState("");
  const toastT = React.useRef(null);
  const flash = (t) => { setToast(t); if (toastT.current) clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(""), 2600); };
  React.useEffect(() => () => { if (toastT.current) clearTimeout(toastT.current); }, []);
  const syncMine = React.useCallback(async () => {
    try {
      const res = await rpc("skill_requests_mine", { p_token: saToken() });
      if (rpcMissing(res)) { setHall("missing"); return; }
      if (!res || !res.ok || !Array.isArray(res.rows)) return;
      setHall("ok");
      const latest = {};
      res.rows.forEach(r => { if (r && r.role_id === role && !latest[r.skill_id]) latest[r.skill_id] = r; });   // строки — от новых к старым
      setReqs(latest);
      // подтверждённое в зале — в допуск, как по PIN
      const cur = load(profile); let changed = false;
      Object.values(latest).forEach(r => {
        if (r.status === "approved" && !cur[r.skill_id]) { cur[r.skill_id] = { mentor: r.mentor_name || "наставник", date: String(r.decided_at || "").slice(0, 10), verified: true, hall: true, label: r.skill_label || "" }; changed = true; }
      });
      if (changed) { save(profile, cur); setConfirmed(cur); }
    } catch (e) { setHall("offline"); }
  }, [role, profile]);
  React.useEffect(() => { syncMine(); }, [syncMine]);
  const loadInbox = React.useCallback(async () => {
    if (!canRevoke) return;
    try {
      const res = await rpc("skill_requests_inbox", { p_token: saToken() });
      if (rpcMissing(res)) { setInbox(null); return; }
      if (res && res.ok && Array.isArray(res.rows)) { setInbox(res.rows); if (onInbox) onInbox(res.rows.length); }
    } catch (e) {}
  }, [canRevoke, onInbox]);
  React.useEffect(() => { loadInbox(); }, [loadInbox]);
  const askHall = async (s) => {
    if (busy || !s) return;
    setBusy(true); setHallErr("");
    try {
      const res = await rpc("skill_request", { p_token: saToken(), p_role: role, p_skill: s.id, p_skill_label: s.label });
      if (rpcMissing(res)) { setHall("missing"); setHallErr("Подтверждение в зале заработает после обновления сервера — пока по PIN."); }
      else if (res && res.ok) {
        setReqs(r => ({ ...r, [s.id]: { id: res.id, role_id: role, skill_id: s.id, skill_label: s.label, status: "pending", created_at: new Date().toISOString() } }));
        vibrate("light"); closeModal(); flash("Запрос у старшего — подтвердит у себя в телефоне");
        syncMine();
        return;
      } else setHallErr(res && res.error === "auth" ? "Сессия устарела — перезайди по коду" : res && res.error === "too_many" ? "Слишком много запросов за день — попробуй завтра" : "Не получилось отправить — попробуй ещё раз");
    } catch (e) { setHallErr("Нет связи — попробуй позже или подтверди по PIN"); }
    setBusy(false);
  };
  const cancelHall = async (r) => {
    if (!r || !r.id) return;
    try { await rpc("skill_request_cancel", { p_token: saToken(), p_id: r.id }); } catch (e) {}
    setReqs(x => { const n = { ...x }; delete n[r.skill_id]; return n; });
    flash("Запрос отозван");
  };
  const decide = async (row, approve, note) => {
    if (!row || inboxBusy) return;
    setInboxBusy(row.id);
    try {
      const res = await rpc("skill_request_decide", { p_token: saToken(), p_id: row.id, p_approve: !!approve, p_note: note || null });
      if (res && (res.ok || res.error === "already")) {
        setInbox(list => (list || []).filter(x => x.id !== row.id));
        if (onInbox) onInbox(Math.max(0, (inbox || []).filter(x => x.id !== row.id).length));
        vibrate(approve ? "success" : "light");
        flash(res.ok ? (approve ? "Подтверждено: " + (row.emp_name || "").split(" ")[0] + " · «" + (row.skill_label || row.skill_id) + "»" : "Отправлено: ещё рано") : "Уже решено" + (res.mentor_name ? " — " + res.mentor_name : ""));
      } else flash(res && res.error === "forbidden" ? "Это запрос другого ресторана" : "Не получилось — попробуй ещё раз");
    } catch (e) { flash("Нет связи — попробуй ещё раз"); }
    setInboxBusy(null); setArm(null); setDeclineFor(null);
  };
  React.useEffect(() => { if (arm == null) return undefined; const t = setTimeout(() => setArm(null), 4000); return () => clearTimeout(t); }, [arm]);

  const doneCount = skills.filter(s => confirmed[s.id]).length;
  const allDone = skills.length > 0 && doneCount === skills.length;
  const pct = skills.length ? Math.round((doneCount / skills.length) * 100) : 0;

  const closeModal = () => { setModal(null); setMentorName(""); setPin(""); setPinErr(""); setByName(false); setBusy(false); setAgree(false); setHallErr(""); };

  const finishLocal = (rec) => {
    const next = { ...confirmed, [modal.id]: { ...rec, label: modal.label || "" } };   // название — для карты обучения и отчёта
    setConfirmed(next); save(profile, next);
    vibrate("light");
    closeModal();
  };

  // Основной путь: PIN наставника, проверка на сервере (stage 6).
  const confirmByPin = async () => {
    if (!/^[0-9]{4,6}$/.test(pin) || !agree || busy) return;
    setBusy(true); setPinErr("");
    const today = new Date().toISOString().slice(0, 10);
    try {
      const resp = await rpc("confirm_skill_pin", { p_token: saToken(), p_role: role, p_skill: modal.id, p_skill_label: modal.label, p_pin: pin, p_date: today });
      if (resp && resp.ok) {
        finishLocal({ mentor: resp.mentor, date: today, verified: true });
        return;
      }
      setBusy(false);
      setPinErr(resp && resp.error === "auth" ? "Сессия устарела — перезайди по коду" : "Неверный PIN. Проверь и попробуй ещё раз.");
      vibrate("error");
    } catch (e) {
      // Функции ещё нет на сервере (stage 6 не применён) или нет сети —
      // мягко откатываемся на прежний режим «по фамилии».
      setBusy(false);
      setByName(true);
      setPinErr("");
    }
  };

  // Запасной путь: как раньше — фамилия + галочка (синк через очередь, как в stage 2)
  const confirm = () => {
    if (!mentorName.trim() || !agree) return;
    const rec = { mentor: mentorName.trim(), date: new Date().toISOString().slice(0, 10) };
    try { rpcSync("confirm_skill", { p_token: saToken(), p_role: role, p_skill: modal.id, p_skill_label: modal.label, p_mentor: rec.mentor, p_date: rec.date }); } catch (e) {}
    finishLocal(rec);
  };

  const revoke = (id) => {
    const next = { ...confirmed }; delete next[id];
    setConfirmed(next); save(profile, next);
  };

  return (
    <div style={T.screen} className="sa-screen">
      {allDone && createPortal(<Confetti />, document.body)}
      <div style={T.lessHead}>
        <button className="sa-hit" style={T.backBtn2} aria-label="Вернуться" onClick={onBack}>‹</button>
        <div style={T.lessHeadTitle}>Допуск наставника</div>
      </div>

      <div style={{ padding: "8px 18px 0", color: T.para?.color, fontSize: 14, lineHeight: 1.55 }}>
        Тесты показывают <b style={{ color: gold }}>знание</b>. Здесь наставник подтверждает <b style={{ color: gold }}>умение</b> — то, что он видел своими глазами в зале.
      </div>

      {canRevoke && Array.isArray(inbox) ? (
        <div style={{ ...glass(T), margin: "14px 16px 4px", padding: "14px 14px 6px" }} data-hall-inbox="">
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11, letterSpacing: 1.6, color: gold, fontFamily: "monospace" }}>ЖДУТ ПОДТВЕРЖДЕНИЯ В ЗАЛЕ</span>
            <b style={{ color: inbox.length ? gold : T.modSub.color, fontSize: 13 }}>{inbox.length}</b>
          </div>
          {!inbox.length ? <div style={{ fontSize: 12.5, color: T.modSub.color, lineHeight: 1.5, paddingBottom: 8 }}>Запросов нет. Когда сотрудник попросит подтвердить навык, он появится здесь — подтверди, когда увидишь своими глазами.</div> : null}
          {inbox.map(r => {
            const ro = ROLES.find(x => x.id === r.role_id);
            const armed = arm === r.id;
            return (
              <div key={r.id} style={{ padding: "10px 0", borderTop: `1px solid ${gold}22` }}>
                <div style={{ fontSize: 14.5, color: textColor, fontFamily: "Georgia, serif", lineHeight: 1.3 }}>{r.emp_name}{r.mine === false && r.restaurant ? <span style={{ fontSize: 11, color: T.modSub.color }}> · {r.restaurant}</span> : null}</div>
                <div style={{ fontSize: 13, color: T.para?.color, lineHeight: 1.45, marginTop: 2 }}>«{r.skill_label || r.skill_id}»<span style={{ color: T.modSub.color }}>{ro ? " · " + ro.label : ""} · {ago(r.created_at)}</span></div>
                {declineFor === r.id ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {DECLINE_NOTES.map(n => <button key={n} className="sa-btn" disabled={inboxBusy === r.id} onClick={() => decide(r, false, n)} style={{ padding: "7px 11px", borderRadius: 999, border: `1px solid ${gold}77`, background: "transparent", color: textColor, fontSize: 12.5, cursor: "pointer" }}>{n}</button>)}
                    <button className="sa-btn" disabled={inboxBusy === r.id} onClick={() => decide(r, false, "")} style={{ padding: "7px 11px", borderRadius: 999, border: `1px solid ${gold}44`, background: "transparent", color: T.modSub.color, fontSize: 12.5, cursor: "pointer" }}>Без записки</button>
                    <button className="sa-btn" onClick={() => setDeclineFor(null)} style={{ padding: "7px 8px", border: 0, background: "none", color: T.modSub.color, fontSize: 12.5, cursor: "pointer" }}>Отмена</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button className="sa-btn" disabled={inboxBusy === r.id} onClick={() => { if (armed) decide(r, true); else { setArm(r.id); vibrate("light"); } }}
                      style={{ flex: 1, padding: "9px 10px", borderRadius: 999, border: 0, cursor: "pointer", fontSize: 13, fontWeight: "bold", color: "#fff", background: armed ? "#3E9A6B" : green }}>{inboxBusy === r.id ? "…" : armed ? "Точно видел(а) — нажми ещё раз" : "Видел(а) — подтвердить ✓"}</button>
                    <button className="sa-btn" disabled={inboxBusy === r.id} onClick={() => { setArm(null); setDeclineFor(r.id); }}
                      style={{ flexShrink: 0, padding: "9px 12px", borderRadius: 999, border: `1px solid ${gold}77`, background: "transparent", color: textColor, fontSize: 13, cursor: "pointer" }}>Ещё рано</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      <div style={{ ...glass(T), margin: "14px 16px 4px", padding: "16px", ...(allDone ? { border: `1px solid ${green}77`, borderTop: `1px solid ${green}99` } : {}) }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 12.5, color: T.para?.color }}>{roleObj?.label || ""} · допуск</span>
          <b style={{ color: allDone ? green : gold, fontSize: 14 }}>{doneCount} / {skills.length}</b>
        </div>
        <div style={{ height: 7, borderRadius: 3, background: "rgba(128,128,128,0.22)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: allDone ? green : gold, transition: "width .4s" }} />
        </div>
        {allDone && <div style={{ marginTop: 10, color: green, fontWeight: "bold", fontSize: 14 }}>🎓 Допущен(а) к самостоятельной работе</div>}
      </div>

      <div style={{ ...T.secTitle }}>Навыки</div>
      <div style={{ padding: "0 14px 24px" }}>
        {!skills.length && <div style={{ color: T.modSub.color, fontSize: 12.5, padding: "6px 4px" }}>Для этой роли навыки допуска пока не заданы (data/skills.js).</div>}
        {skills.map((s, i) => {
          const rec = confirmed[s.id];
          return (
            <div key={s.id} className="sa-card" style={{ ...T.modCard, margin: "0 0 10px", alignItems: "flex-start", opacity: 1 }}
              onClick={() => !rec && setModal(s)} {...onActivate(() => !rec && setModal(s))}>
              <div style={{ ...T.modBar, background: rec ? green : gold }} />
              <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2, border: rec ? "none" : `1.5px solid ${gold}66`, background: rec ? green : "transparent", color: rec ? "#fff" : T.modSub.color, fontSize: rec ? 15 : 13 }}>{rec ? "✓" : i + 1}</div>
              <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
                <div style={{ ...T.modTitle, color: rec ? green : T.modTitle.color }}>{s.label}</div>
                <div style={{ ...T.modSub, whiteSpace: "normal", lineHeight: 1.45 }}>{s.hint}</div>
                {rec && <div style={{ fontSize: 11, color: T.modSub.color, marginTop: 4 }}>Подтвердил(а): <b style={{ color: gold }}>{rec.mentor}</b> · {rec.date}{rec.verified && <span style={{ marginLeft: 6, fontSize: 10.5, letterSpacing: 1, color: green, border: `1px solid ${green}66`, borderRadius: 6, padding: "1px 6px", fontFamily: "monospace", verticalAlign: "1px" }}>{rec.hall ? "В ЗАЛЕ ✓" : "PIN ✓"}</span>}</div>}
                {!rec && reqs[s.id] && reqs[s.id].status === "pending" ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 6, fontSize: 11.5, color: gold }}>
                    <span>⏳ Ждёт старшего — подтвердит в зале</span>
                    <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); cancelHall(reqs[s.id]); }} {...onActivate(() => cancelHall(reqs[s.id]))} style={{ color: T.modSub.color, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer" }}>отозвать</span>
                  </div>
                ) : null}
                {!rec && reqs[s.id] && reqs[s.id].status === "declined" ? (
                  <div style={{ marginTop: 6, fontSize: 11.5, color: "#E0A070", lineHeight: 1.4 }}>Старший: ещё рано{reqs[s.id].note ? " — «" + reqs[s.id].note + "»" : ""}. Можно попросить снова.</div>
                ) : null}
              </div>
              {rec && canRevoke
                ? <div style={{ padding: "4px 8px", color: "#E07878", cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); revoke(s.id); }} {...onActivate(() => revoke(s.id))}>✕</div>
                : !rec && <div style={T.modArrow}>›</div>}
            </div>
          );
        })}
      </div>

      {modal && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-end" }} onClick={closeModal}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", boxSizing: "border-box", maxHeight: "85vh", overflowY: "auto", background: a11y ? "rgba(250,246,236,0.96)" : "rgba(30,22,10,0.96)", borderTop: a11y ? "1px solid rgba(255,245,215,0.95)" : "1px solid rgba(215,170,68,0.5)", boxShadow: "0 -12px 44px rgba(0,0,0,0.45)", borderRadius: "22px 22px 0 0", padding: "22px 18px", paddingBottom: "max(30px, env(safe-area-inset-bottom))", color: textColor }}>
            <div style={{ fontSize: 11, letterSpacing: 2, color: gold, fontFamily: "monospace", marginBottom: 6 }}>ПОДТВЕРЖДЕНИЕ НАВЫКА</div>
            <div style={{ fontSize: 18, fontWeight: "bold", marginBottom: 6, color: T.bold?.color }}>{modal.label}</div>
            {/* Доп. 303: старший подтвердит у себя в телефоне */}
            <div style={{ margin: "0 0 14px", padding: "12px 12px", borderRadius: 14, border: `1px solid ${gold}55`, background: a11y ? "rgba(255,255,255,0.45)" : "rgba(255,250,238,0.04)" }}>
              <div style={{ fontSize: 14, fontWeight: "bold", color: textColor, marginBottom: 4 }}>Старшего нет рядом с твоим телефоном?</div>
              <div style={{ fontSize: 12.5, lineHeight: 1.45, color: T.para?.color, marginBottom: 10 }}>Отправь запрос — старший увидит его у себя в «Наставничестве» и подтвердит, когда посмотрит, как у тебя получается в зале.</div>
              {reqs[modal.id] && reqs[modal.id].status === "pending" ? (
                <div style={{ fontSize: 13, color: gold }}>⏳ Запрос уже у старшего — ждём</div>
              ) : hall === "missing" ? (
                <div style={{ fontSize: 12.5, color: T.modSub.color }}>Заработает, когда владелец обновит сервер — пока по PIN ниже.</div>
              ) : (
                <button className="sa-btn" disabled={busy} onClick={() => askHall(modal)}
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 999, border: `1px solid ${gold}`, background: "transparent", color: textColor, fontSize: 14, fontWeight: "bold", cursor: "pointer" }}>{busy ? "Отправляю…" : "Отправить старшему ›"}</button>
              )}
              {hallErr ? <div style={{ color: "#E07878", fontSize: 12.5, marginTop: 8 }}>{hallErr}</div> : null}
            </div>
            <div style={{ textAlign: "center", fontSize: 10.5, letterSpacing: 1.6, color: T.modSub.color, fontFamily: "monospace", margin: "0 0 10px" }}>ИЛИ ПО PIN ПРЯМО ЗДЕСЬ</div>
            <div style={{ fontSize: 14, color: T.para?.color, lineHeight: 1.5, marginBottom: 16 }}>
              📲 Передай телефон наставнику. Наставник, ты подтверждаешь навык только если <b style={{ color: gold }}>лично видел</b> его выполнение в зале.
            </div>
            {!byName ? (
              <>
                <input
                  value={pin}
                  onChange={e => { setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 6)); setPinErr(""); }}
                  onFocus={e => { const el = e.target; setTimeout(() => { try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (err) {} }, 300); }}
                  inputMode="numeric" pattern="[0-9]*" type="password" autoComplete="one-time-code"
                  placeholder="PIN наставника (4–6 цифр)"
                  style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 12, border: `1px solid ${pinErr ? "#E07878" : gold + "88"}`, borderTop: `1px solid ${pinErr ? "#E07878" : gold + "55"}`, background: a11y ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.25)", boxShadow: "0 2px 6px rgba(0,0,0,0.12) inset", color: textColor, fontSize: 16, letterSpacing: 6, textAlign: "center", fontFamily: "monospace", outline: "none", marginBottom: pinErr ? 6 : 12 }}
                />
                {pinErr && <div style={{ color: "#E07878", fontSize: 12.5, marginBottom: 10, textAlign: "center" }}>{pinErr}</div>}
                <div onClick={() => { setByName(true); setPinErr(""); }} {...onActivate(() => { setByName(true); setPinErr(""); })} style={{ fontSize: 12.5, color: T.modSub?.color || gold, textAlign: "center", marginBottom: 12, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>
                  У наставника нет PIN — подтвердить по фамилии
                </div>
              </>
            ) : (
              <>
                <input
                  value={mentorName}
                  onChange={e => setMentorName(e.target.value)}
                  onFocus={e => { const el = e.target; setTimeout(() => { try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (err) {} }, 300); }}
                  placeholder="Фамилия и имя наставника"
                  style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 12, border: `1px solid ${gold}88`, borderTop: `1px solid ${gold}55`, background: a11y ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.25)", boxShadow: "0 2px 6px rgba(0,0,0,0.12) inset", color: textColor, fontSize: 16, outline: "none", marginBottom: 8 }}
                />
                <div onClick={() => setByName(false)} {...onActivate(() => setByName(false))} style={{ fontSize: 12.5, color: T.modSub?.color || gold, textAlign: "center", marginBottom: 12, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>
                  ‹ Вернуться к подтверждению по PIN
                </div>
              </>
            )}
            <div onClick={() => setAgree(a => !a)} {...onActivate(() => setAgree(a => !a))} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", marginBottom: 16 }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, border: `1.5px solid ${agree ? green : gold}`, background: agree ? green : "transparent", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{agree ? "✓" : ""}</div>
              <div style={{ fontSize: 12.5, lineHeight: 1.45, color: T.para?.color }}>Подтверждаю: наблюдал(а) выполнение этого навыка сотрудником в реальной работе.</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="sa-btn" style={{ ...T.doneBtn, flex: 1, background: "transparent", border: `1px solid ${gold}88`, color: textColor }} onClick={closeModal}>Отмена</button>
              <button className="sa-btn" style={{ ...T.doneBtn, flex: 1, background: (byName ? mentorName.trim() && agree : /^[0-9]{4,6}$/.test(pin) && agree && !busy) ? green : gold + "55", color: (byName ? mentorName.trim() && agree : /^[0-9]{4,6}$/.test(pin) && agree && !busy) ? "#fff" : (a11y ? "#735F44" : "#e8dcc0"), transition: "background .25s" }} onClick={byName ? confirm : confirmByPin}>{busy ? "Проверяю…" : "Подтвердить ✓"}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {toast ? createPortal(
        <div role="status" style={{ position: "fixed", left: "50%", bottom: "calc(96px + env(safe-area-inset-bottom,0px))", transform: "translateX(-50%)", zIndex: 1200, maxWidth: "86vw", padding: "10px 16px", borderRadius: 999, background: a11y ? "rgba(42,31,14,0.92)" : "rgba(250,240,215,0.95)", color: a11y ? "#F6EEDC" : "#1A1008", fontSize: 13, fontWeight: "bold", boxShadow: "0 8px 22px rgba(0,0,0,0.35)", textAlign: "center" }}>{toast}</div>,
        document.body) : null}
    </div>
  );
}
