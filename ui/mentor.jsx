// ui/mentor.jsx
// Этап 2 — «Допуск наставника»: тест показывает ЗНАНИЕ, наставник подтверждает УМЕНИЕ.
// Сотрудник открывает список навыков роли, показывает выполнение в зале,
// наставник тут же в телефоне сотрудника подтверждает навык своей фамилией.
// Хранение: localStorage (sa_skills_<имя|фамилия>) + попытка синка в Supabase
// через rpcSync("confirm_skill") — очередь безопасно отбросит вызов, если RPC ещё не создан
// (SQL для сервера — в файле supabase/supabase-stage2.sql).

import React from "react";
import { createPortal } from "react-dom";
import { ROLE_SKILLS } from "../data/skills";
import { onActivate, vibrate } from "../lib/utils";
import { rpc, rpcSync, saToken } from "../api/supabase";
import { Confetti } from "./widgets";

const keyFor = (profile) => `sa_skills_${(profile?.name || "guest")}|${(profile?.surname || "")}`.toLowerCase();
const load = (profile) => { try { return JSON.parse(localStorage.getItem(keyFor(profile)) || "{}"); } catch (e) { return {}; } };
const save = (profile, obj) => { try { localStorage.setItem(keyFor(profile), JSON.stringify(obj)); } catch (e) {} };

// Фирменная «стеклянная» плашка — те же токены, что у карточек уроков (обе темы)
const glass = (T) => ({
  background: T.lessGlass?.bg || "linear-gradient(155deg, #382810 0%, #281C08 100%)",
  border: T.lessGlass?.border || "1px solid rgba(150,112,42,0.38)",
  borderTop: T.lessGlass?.borderTop || "1px solid rgba(215,170,68,0.46)",
  boxShadow: T.lessGlass?.shadow || "0 6px 22px rgba(0,0,0,0.50), 0 2px 0 rgba(200,160,60,0.18) inset, 0 -2px 4px rgba(0,0,0,0.38) inset",
  backdropFilter: T.lessGlass?.blur || "none",
  WebkitBackdropFilter: T.lessGlass?.blur || "none",
  borderRadius: 18,
});

export function MentorScreen({ T, a11y, profile, role, roleObj, onBack }) {
  const gold = a11y ? "#8B6A30" : "#C8A96E";
  const green = "#5DBB8A";
  const textColor = a11y ? "#2e211a" : "#F5EFE2";
  const skills = ROLE_SKILLS[role] || [];
  const [confirmed, setConfirmed] = React.useState(() => load(profile));
  const [modal, setModal] = React.useState(null); // skill объект
  const [mentorName, setMentorName] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [byName, setByName] = React.useState(false); // запасной режим «по фамилии»
  const [pinErr, setPinErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [agree, setAgree] = React.useState(false);
  const canRevoke = ["manager", "senior"].includes(profile?.position) || profile?.is_admin;

  const doneCount = skills.filter(s => confirmed[s.id]).length;
  const allDone = skills.length > 0 && doneCount === skills.length;
  const pct = skills.length ? Math.round((doneCount / skills.length) * 100) : 0;

  const closeModal = () => { setModal(null); setMentorName(""); setPin(""); setPinErr(""); setByName(false); setBusy(false); setAgree(false); };

  const finishLocal = (rec) => {
    const next = { ...confirmed, [modal.id]: rec };
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
        <button style={T.backBtn2} onClick={onBack}>‹</button>
        <div style={T.lessHeadTitle}>Допуск наставника</div>
      </div>

      <div style={{ padding: "8px 18px 0", color: T.para?.color, fontSize: 13.5, lineHeight: 1.55 }}>
        Тесты показывают <b style={{ color: gold }}>знание</b>. Здесь наставник подтверждает <b style={{ color: gold }}>умение</b> — то, что он видел своими глазами в зале.
      </div>

      <div style={{ ...glass(T), margin: "14px 16px 4px", padding: "16px", ...(allDone ? { border: `1px solid ${green}77`, borderTop: `1px solid ${green}99` } : {}) }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: T.para?.color }}>{roleObj?.label || ""} · допуск</span>
          <b style={{ color: allDone ? green : gold, fontSize: 15 }}>{doneCount} / {skills.length}</b>
        </div>
        <div style={{ height: 7, borderRadius: 4, background: "rgba(128,128,128,0.22)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: allDone ? green : gold, transition: "width .4s" }} />
        </div>
        {allDone && <div style={{ marginTop: 10, color: green, fontWeight: "bold", fontSize: 14.5 }}>🎓 Допущен(а) к самостоятельной работе</div>}
      </div>

      <div style={{ ...T.secTitle }}>Навыки</div>
      <div style={{ padding: "0 14px 24px" }}>
        {!skills.length && <div style={{ color: T.modSub.color, fontSize: 13, padding: "6px 4px" }}>Для этой роли навыки допуска пока не заданы (data/skills.js).</div>}
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
                {rec && <div style={{ fontSize: 11.5, color: T.modSub.color, marginTop: 4 }}>Подтвердил(а): <b style={{ color: gold }}>{rec.mentor}</b> · {rec.date}{rec.verified && <span style={{ marginLeft: 6, fontSize: 8.5, letterSpacing: 1, color: green, border: `1px solid ${green}66`, borderRadius: 7, padding: "1px 6px", fontFamily: "monospace", verticalAlign: "1px" }}>PIN ✓</span>}</div>}
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
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", boxSizing: "border-box", maxHeight: "85vh", overflowY: "auto", background: a11y ? "linear-gradient(165deg, #FAF3E3 0%, #EFE3CB 100%)" : "linear-gradient(165deg, #3A2A12 0%, #241806 100%)", borderTop: a11y ? "1px solid rgba(255,245,215,0.95)" : "1px solid rgba(215,170,68,0.5)", boxShadow: "0 -12px 44px rgba(0,0,0,0.45)", borderRadius: "22px 22px 0 0", padding: "22px 18px", paddingBottom: "max(30px, env(safe-area-inset-bottom))", color: textColor }}>
            <div style={{ fontSize: 11, letterSpacing: 2, color: gold, fontFamily: "monospace", marginBottom: 6 }}>ПОДТВЕРЖДЕНИЕ НАВЫКА</div>
            <div style={{ fontSize: 18, fontWeight: "bold", marginBottom: 6, color: T.bold?.color }}>{modal.label}</div>
            <div style={{ fontSize: 13.5, color: T.para?.color, lineHeight: 1.5, marginBottom: 16 }}>
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
                  style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 12, border: `1px solid ${pinErr ? "#E07878" : gold + "88"}`, borderTop: `1px solid ${pinErr ? "#E07878" : gold + "55"}`, background: a11y ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.25)", boxShadow: "0 2px 6px rgba(0,0,0,0.12) inset", color: textColor, fontSize: 17, letterSpacing: 6, textAlign: "center", fontFamily: "monospace", outline: "none", marginBottom: pinErr ? 6 : 12 }}
                />
                {pinErr && <div style={{ color: "#E07878", fontSize: 12, marginBottom: 10, textAlign: "center" }}>{pinErr}</div>}
                <div onClick={() => { setByName(true); setPinErr(""); }} {...onActivate(() => { setByName(true); setPinErr(""); })} style={{ fontSize: 12, color: T.modSub?.color || gold, textAlign: "center", marginBottom: 12, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>
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
                  style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 12, border: `1px solid ${gold}88`, borderTop: `1px solid ${gold}55`, background: a11y ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.25)", boxShadow: "0 2px 6px rgba(0,0,0,0.12) inset", color: textColor, fontSize: 15.5, outline: "none", marginBottom: 8 }}
                />
                <div onClick={() => setByName(false)} {...onActivate(() => setByName(false))} style={{ fontSize: 12, color: T.modSub?.color || gold, textAlign: "center", marginBottom: 12, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>
                  ‹ Вернуться к подтверждению по PIN
                </div>
              </>
            )}
            <div onClick={() => setAgree(a => !a)} {...onActivate(() => setAgree(a => !a))} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", marginBottom: 16 }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, border: `1.5px solid ${agree ? green : gold}`, background: agree ? green : "transparent", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{agree ? "✓" : ""}</div>
              <div style={{ fontSize: 13, lineHeight: 1.45, color: T.para?.color }}>Подтверждаю: наблюдал(а) выполнение этого навыка сотрудником в реальной работе.</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="sa-btn" style={{ ...T.doneBtn, flex: 1, background: "transparent", border: `1px solid ${gold}88`, color: textColor }} onClick={closeModal}>Отмена</button>
              <button className="sa-btn" style={{ ...T.doneBtn, flex: 1, background: (byName ? mentorName.trim() && agree : /^[0-9]{4,6}$/.test(pin) && agree && !busy) ? green : gold + "55", color: (byName ? mentorName.trim() && agree : /^[0-9]{4,6}$/.test(pin) && agree && !busy) ? "#fff" : (a11y ? "#7a6a4a" : "#e8dcc0"), transition: "background .25s" }} onClick={byName ? confirm : confirmByPin}>{busy ? "Проверяю…" : "Подтвердить ✓"}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
