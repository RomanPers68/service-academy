// ui/live-check-editor.jsx — v202 (Доп. 527): «Вопросы живой проверки» в редакторе контента.
// Владелец (27.11) на предложения, как ещё упростить живую проверку: «Давай все, кроме 10-го и 2-го». Шестое из них:
// вопросы правит руководство само. Формулировку и пункты «что должно прозвучать» можно поменять, свой вопрос добавить,
// лишний спрятать; ассистент предлагает черновики по текстам уроков модуля (api/lesson-assist.js, режим live). Сверху —
// вопросы, которые проверяющие отметили неудачными: «Поправить» или «Оставить как есть». Правки хранит сервер (этап 65)
// для всей сети; в проверке вопросы — с правками (lib/live-check.js, mergeBank). Править может руководство сети
// (владелец и руководящий состав), остальные смотрят.
import React from "react";
import { vibrate } from "../lib/utils";
import { labelStyle } from "./tokens";
import { MODULES_INDEX } from "../data/modules-index";
import { ROLES } from "../data/roles";
import { LIVE_CHECK } from "../data/live-check";
import { programAll } from "../data/modules";
import { useAllModules } from "../lib/use-content";
import { saToken } from "../lib/supabase";
import { mergeBank, lcErr65, LC_TRACKS } from "../lib/live-check";
import { useLcQuestions, loadQuestions, lcQuestionSave, lcFlagDone } from "../lib/live-check-api";

const trackLabel = (id) => (ROLES.find((r) => r.id === id) || {}).label || id;
const modsOf = (t) => (MODULES_INDEX[t] || []).filter((m) => m && m.id);
const trackOfMod = (id) => LC_TRACKS.find((t) => modsOf(t).some((m) => m.id === id)) || null;
const modTitle = (id) => { for (const t of LC_TRACKS) { const m = modsOf(t).find((x) => x.id === id); if (m) return m.title; } return id; };
const plural = (n, a, b, c) => { const d = n % 10, h = n % 100; return d === 1 && h !== 11 ? a : d >= 2 && d <= 4 && (h < 12 || h > 14) ? b : c; };
const baseOf = (m, n) => (LIVE_CHECK[m] || []).find((q) => String(q.n) === String(n)) || null;
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();

export function LiveCheckEditor({ T, a11y, profile, onBack }) {
  const P = a11y ? { gold: "#7A5D2A", line: "rgba(139,106,48,0.22)", chip: "rgba(139,106,48,0.10)", on: "rgba(139,106,48,0.18)", bad: "#A33A2A", ok: "#2C6B48" }
    : { gold: "#D9B87C", line: "rgba(214,178,102,0.18)", chip: "rgba(214,178,102,0.10)", on: "rgba(200,169,110,0.24)", bad: "#E07878", ok: "#8AD8AF" };
  const sub = T.modSub.color, text = T.modTitle.color;
  const card = { ...T.modCard, display: "block", padding: "12px 14px", marginBottom: 12, cursor: "default" };
  const ghost = { flex: "0 0 auto", padding: "7px 12px", borderRadius: 999, border: "1px solid " + P.line, background: P.chip, color: text, fontSize: 13, fontFamily: "Georgia, serif", cursor: "pointer", whiteSpace: "nowrap" };
  const field = { width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 12, border: "1px solid " + P.line, background: P.chip, color: text, fontFamily: "Georgia, serif", fontSize: 14, lineHeight: 1.45 };
  const h = (t, n = null, key = "") => (
    <div data-lce-h={key} style={{ ...labelStyle(13.5), color: P.gold, margin: "8px 2px 8px", display: "flex", gap: 8, alignItems: "baseline" }}>
      <span style={{ flex: 1 }}>{t}</span>{n != null ? <span style={{ color: sub }}>{n}</span> : null}
    </div>);
  const admin = !!(profile && profile.is_admin);
  const lq = useLcQuestions();
  useAllModules();   // тексты уроков — для ассистента
  const [track, setTrack] = React.useState("seasonal");
  const [mod, setMod] = React.useState(null);
  const [edit, setEdit] = React.useState(null);   // { n, q, a: [], l, hidden, base, own }
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [ai, setAi] = React.useState({ phase: "idle", list: [], err: "" });
  const bank = React.useMemo(() => mergeBank(LIVE_CHECK, lq.rows), [lq.rows]);
  const rowOf = (m, n) => (lq.rows || []).find((r) => r.m === m && String(r.n) === String(n)) || null;
  const can = !!lq.canEdit;
  const top = React.useRef(null);
  const toTop = () => { try { if (top.current && top.current.scrollIntoView) top.current.scrollIntoView({ block: "start" }); } catch (e) { /* */ } };

  // вопросы модуля для списка: из приложения (и спрятанные — бледно) и свои
  const listOf = (m) => {
    const base = (LIVE_CHECK[m] || []).map((q) => { const r = rowOf(m, q.n); const v = (bank[m] || []).find((x) => String(x.n) === String(q.n)); return { n: String(q.n), q: (v || q).q, a: (v || q).a, l: (v || q).l, hidden: !!(r && r.h), edited: !!(r && !r.h), own: false }; });
    const own = (lq.rows || []).filter((r) => r.m === m && /^c\d+$/.test(String(r.n))).map((r) => ({ n: String(r.n), q: r.q, a: Array.isArray(r.a) ? r.a : [], l: r.l || "", hidden: !!r.h, edited: false, own: true }));
    return [...base, ...own];
  };
  const openEdit = (m, it) => {
    vibrate("light"); setMsg(""); setAi({ phase: "idle", list: [], err: "" });
    setMod(m); setTrack(trackOfMod(m) || track);
    setEdit(it ? { n: it.n, q: it.q || "", a: (it.a || []).slice(0, 6), l: it.l || "", hidden: !!it.hidden, own: !!it.own, base: it.own ? null : baseOf(m, it.n) }
      : { n: null, q: "", a: ["", ""], l: "", hidden: false, own: true, base: null });
    toTop();
  };
  const save = async (hidden = false) => {
    if (busy || !edit || !mod) return;
    const q = clean(edit.q), a = (edit.a || []).map(clean).filter(Boolean);
    if (!hidden && (q.length < 8 || q.length > 300)) { setMsg("Вопрос — от 8 до 300 знаков."); return; }
    if (!hidden && !a.length) { setMsg("Нужен хотя бы один пункт «что должно прозвучать»."); return; }
    if (a.some((x) => x.length > 200)) { setMsg("Пункт — до 200 знаков."); return; }
    setBusy(true); setMsg("");
    const r = await lcQuestionSave({ track: trackOfMod(mod) || track, module: mod, n: edit.n, q: hidden && !q ? null : q, a: hidden && !a.length ? null : a, lesson: edit.l || null, hidden });
    setBusy(false);
    if (r && r.ok) { vibrate("success"); setEdit(null); setMsg(hidden ? "Вопрос спрятан: в проверку он больше не попадёт." : r.resolved ? "Сохранено. Отметки проверяющих с этого вопроса сняты." : "Сохранено: в проверке теперь так."); toTop(); }
    else { vibrate("error"); setMsg(lcErr65(r && r.error, admin)); }
  };
  const keep = async (k) => {
    const r = await lcFlagDone(k);
    if (r && r.ok) { vibrate("light"); loadQuestions(true); } else setMsg(lcErr65(r && r.error, admin));
  };
  const askAi = async () => {
    if (!mod || ai.phase === "load") return;
    setAi({ phase: "load", list: [], err: "" });
    const m = ((programAll()[trackOfMod(mod) || track] || []).find((x) => x.id === mod)) || null;
    const material = ((m && m.lessons) || []).filter((l) => l && l.type === "lesson").map((l) => "## " + l.title + "\n" + String(l.content || "")).join("\n\n").slice(0, 28000);
    try {
      const r = await fetch("/api/lesson-assist", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: saToken(), mode: "live", role: trackOfMod(mod) || track, title: modTitle(mod), text: material, others: listOf(mod).map((x) => x.q).slice(0, 16) }) });
      const d = await r.json().catch(() => null);
      if (d && d.ok && Array.isArray(d.questions)) setAi({ phase: "ready", list: d.questions, err: "" });
      else setAi({ phase: "error", list: [], err: (d && d.error) || (r.status === 404 ? "Ассистент ещё не развёрнут на Vercel (функция /api/lesson-assist)." : "Ассистент не ответил. Попробуй ещё раз.") });
    } catch (e) { setAi({ phase: "error", list: [], err: "Нет связи с ассистентом." }); }
  };
  const back = () => { vibrate("light"); setMsg(""); if (edit) { setEdit(null); return; } if (mod) { setMod(null); setAi({ phase: "idle", list: [], err: "" }); toTop(); return; } onBack(); };
  const view = edit ? "edit" : mod ? "module" : "list";
  const lessons = mod ? ((modsOf(trackOfMod(mod) || track).find((m) => m.id === mod) || {}).lessons || []).filter((l) => l.type === "lesson") : [];

  return (
    <div style={T.screen} className="sa-screen" data-lce={view} ref={top}>
      <div style={T.lessHead}>
        <button className="sa-hit" style={T.backBtn2} data-lens="back" aria-label="Вернуться" onClick={back}>‹</button>
        <div style={{ ...T.lessHeadTitle, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{mod ? modTitle(mod) : "Вопросы живой проверки"}</div>
      </div>
      <div style={{ flex: 1, padding: "14px 16px 28px" }}>
        {msg ? <div role="status" data-lce-msg="" style={{ ...card, fontSize: 14, lineHeight: 1.5, color: text }}>{msg}</div> : null}

        {view === "list" ? (<>
          <div style={{ fontSize: 13.5, color: sub, lineHeight: 1.55, margin: "0 2px 10px" }}>
            Вопросы, которые руководитель задаёт вслух на живой проверке. Поправь формулировку и пункты, добавь свои вопросы, спрячь лишние: правки сразу у всех проверяющих сети.
          </div>
          {lq.stage === false ? <div data-lce-stage="" style={{ ...card, fontSize: 14, lineHeight: 1.5, color: text }}>{lcErr65("stage65", admin)}</div> : null}
          {lq.loaded && lq.stage !== false && !can ? <div data-lce-ro="" style={{ fontSize: 12.5, color: sub, margin: "0 2px 10px", lineHeight: 1.45 }}>Править вопросы может руководство сети: владелец и руководящий состав. Здесь их можно посмотреть.</div> : null}
          {can && (lq.flags || []).length ? (<>
            {h("Отмечены проверяющими", lq.flags.length, "flags")}
            <div style={{ ...card, padding: "2px 14px" }} data-lce-flags={lq.flags.length} data-lens-card="">
              {lq.flags.map((f, i) => {
                const [m, n] = String(f.k).split("#");
                const q = (bank[m] || []).find((x) => String(x.n) === n) || baseOf(m, n);
                const notes = (Array.isArray(f.notes) ? f.notes : []).filter((x) => x && (x.note || x.by));
                return (
                  <div key={f.k} data-lce-flag={f.k} style={{ padding: "10px 0", borderTop: i ? "1px solid " + P.line : 0 }}>
                    <div style={{ fontSize: 12, color: sub }}>{modTitle(m) + " · отметок " + f.n}</div>
                    <div style={{ fontSize: 14, color: text, lineHeight: 1.45, marginTop: 2 }}>{q ? q.q : f.k}</div>
                    {notes.slice(0, 3).map((x, j) => <div key={j} style={{ fontSize: 12.5, color: sub, marginTop: 2 }}>{(x.by ? x.by + ": " : "") + (x.note || "без пояснения")}</div>)}
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button type="button" data-lce-fix={f.k} onClick={() => openEdit(m, listOf(m).find((x) => x.n === n) || null)} style={ghost}>Поправить</button>
                      <button type="button" data-lce-keep={f.k} onClick={() => keep(f.k)} style={{ ...ghost, color: sub }}>Оставить как есть</button>
                    </div>
                  </div>);
              })}
            </div>
          </>) : null}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "4px 0 12px" }} role="group" aria-label="Курс">
            {LC_TRACKS.map((t) => <button key={t} type="button" data-lce-track={t} aria-pressed={t === track} onClick={() => { vibrate("light"); setTrack(t); }}
              style={{ ...ghost, background: t === track ? P.on : P.chip, borderColor: t === track ? P.gold : P.line, fontWeight: t === track ? "bold" : "normal" }}>{trackLabel(t)}</button>)}
          </div>
          <div style={{ ...card, padding: "2px 14px" }} data-lens-card="">
            {modsOf(track).map((m, i) => {
              const all = listOf(m.id), live = all.filter((x) => !x.hidden);
              const ed = all.filter((x) => x.edited).length, own = all.filter((x) => x.own && !x.hidden).length, hid = all.filter((x) => x.hidden).length;
              const go = () => { vibrate("light"); setMsg(""); setMod(m.id); toTop(); };
              return (
                <div key={m.id} data-lce-mod={m.id} role="button" tabIndex={0} onClick={go} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderTop: i ? "1px solid " + P.line : 0, cursor: "pointer" }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontFamily: "Georgia, serif", fontSize: 14.5, color: text, lineHeight: 1.35 }}>{m.title}</span>
                    <span style={{ display: "block", fontSize: 12, color: sub, marginTop: 2 }}>
                      {[live.length + " " + plural(live.length, "вопрос", "вопроса", "вопросов"), ed ? "правок " + ed : "", own ? "своих " + own : "", hid ? "спрятано " + hid : ""].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span aria-hidden="true" style={{ color: sub, fontSize: 18 }}>›</span>
                </div>);
            })}
          </div>
        </>) : null}

        {view === "module" ? (<>
          <div style={{ fontSize: 13, color: sub, margin: "0 2px 10px" }}>{trackLabel(trackOfMod(mod) || track)} · в проверку попадают четыре вопроса из этих, не те, что спрашивали недавно.</div>
          {can ? (
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button type="button" data-lce-new="" onClick={() => openEdit(mod, null)} style={{ ...ghost, flex: 1 }}>Свой вопрос</button>
              <button type="button" data-lce-ai="" disabled={ai.phase === "load"} onClick={askAi} style={{ ...ghost, flex: 1, opacity: ai.phase === "load" ? 0.6 : 1 }}>{ai.phase === "load" ? "Ассистент думает…" : "Ассистент предложит"}</button>
            </div>) : null}
          {ai.phase === "error" ? <div role="status" style={{ fontSize: 13, color: P.bad, margin: "0 2px 10px" }}>{ai.err}</div> : null}
          {ai.phase === "ready" && ai.list.length ? (<>
            {h("Черновики ассистента", ai.list.length, "ai")}
            {ai.list.map((x, i) => (
              <div key={i} data-lce-ai-q={i} style={card} data-lens-card="">
                <div style={{ fontSize: 14, color: text, lineHeight: 1.45, fontWeight: "bold" }}>{x.q}</div>
                <ul style={{ margin: "6px 0 8px", paddingLeft: 18, color: text, fontSize: 13.5, lineHeight: 1.45 }}>{(x.a || []).map((p, j) => <li key={j}>{p}</li>)}</ul>
                <button type="button" data-lce-ai-take={i} onClick={() => { vibrate("light"); setMsg(""); setEdit({ n: null, q: x.q, a: (x.a || []).slice(0, 6), l: "", hidden: false, own: true, base: null }); toTop(); }} style={ghost}>Взять и поправить</button>
              </div>))}
          </>) : null}
          <div style={{ ...card, padding: "2px 14px" }} data-lens-card="">
            {listOf(mod).map((x, i) => {
              const go = can ? () => openEdit(mod, x) : null;
              return (
                <div key={x.n} data-lce-q={mod + "#" + x.n} data-hidden={x.hidden ? "1" : "0"} role={go ? "button" : undefined} tabIndex={go ? 0 : undefined} onClick={go || undefined}
                  onKeyDown={go ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } } : undefined}
                  style={{ padding: "10px 0", borderTop: i ? "1px solid " + P.line : 0, cursor: go ? "pointer" : "default", opacity: x.hidden ? 0.5 : 1 }}>
                  <div style={{ fontSize: 14, color: text, lineHeight: 1.45 }}>{x.q}</div>
                  <div style={{ fontSize: 12, color: sub, marginTop: 2 }}>
                    {[(x.a || []).length + " " + plural((x.a || []).length, "пункт", "пункта", "пунктов"), x.own ? "свой вопрос" : "", x.edited ? "поправлен" : "", x.hidden ? "спрятан" : ""].filter(Boolean).join(" · ")}</div>
                </div>);
            })}
          </div>
        </>) : null}

        {view === "edit" ? (<>
          <div style={{ fontSize: 13, color: sub, margin: "0 2px 8px" }}>{edit.n ? (edit.own ? "Свой вопрос" : "Вопрос из приложения") : "Новый свой вопрос"}{edit.hidden ? " · спрятан" : ""}</div>
          <label style={{ display: "block", fontSize: 12.5, color: P.gold, margin: "0 2px 4px" }}>Вопрос</label>
          <textarea data-lce-text="" data-lens-field="" rows={3} maxLength={300} value={edit.q} onChange={(e) => setEdit({ ...edit, q: e.target.value })} style={{ ...field, resize: "vertical" }} />
          <label style={{ display: "block", fontSize: 12.5, color: P.gold, margin: "10px 2px 4px" }}>Что должно прозвучать</label>
          {edit.a.map((x, j) => (
            <div key={j} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <input data-lce-pt={j} data-lens-field="" value={x} maxLength={200} onChange={(e) => setEdit({ ...edit, a: edit.a.map((y, k) => (k === j ? e.target.value : y)) })} style={{ ...field, flex: 1 }} />
              <button type="button" aria-label="Убрать пункт" data-lce-pt-del={j} onClick={() => setEdit({ ...edit, a: edit.a.filter((_, k) => k !== j) })} style={{ ...ghost, padding: "6px 10px", color: sub }}>×</button>
            </div>))}
          {edit.a.length < 6 ? <button type="button" data-lce-pt-add="" onClick={() => setEdit({ ...edit, a: [...edit.a, ""] })} style={{ ...ghost, marginBottom: 10 }}>Добавить пункт</button> : null}
          {lessons.length ? (<>
            <label style={{ display: "block", fontSize: 12.5, color: P.gold, margin: "6px 2px 4px" }}>Урок для повтора</label>
            <select data-lce-lesson="" value={edit.l || ""} onChange={(e) => setEdit({ ...edit, l: e.target.value })} style={field}>
              <option value="">без урока</option>
              {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          </>) : null}
          {edit.base ? (
            <div data-lce-base="" style={{ fontSize: 12.5, color: sub, lineHeight: 1.45, margin: "10px 2px 0" }}>
              {"В приложении: «" + edit.base.q + "»"}
              <button type="button" data-lce-reset="" onClick={() => setEdit({ ...edit, q: edit.base.q, a: edit.base.a.slice(0, 6), l: edit.base.l || "" })}
                style={{ border: 0, background: "none", padding: 0, marginLeft: 6, color: P.gold, fontSize: 12.5, textDecoration: "underline", cursor: "pointer", fontFamily: "Georgia, serif" }}>Вернуть как было</button>
            </div>) : null}
          <button type="button" data-lce-save="" data-lens-btn="main" disabled={busy} onClick={() => save(false)}
            style={{ display: "block", width: "100%", marginTop: 14, padding: 12, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 15, fontWeight: "bold", color: "#1A1008", background: "linear-gradient(180deg,#E4C88C,#C8A96E)", opacity: busy ? 0.6 : 1 }}>
            {busy ? "Сохраняю…" : edit.hidden ? "Вернуть в проверку и сохранить" : "Сохранить"}</button>
          {edit.n && !edit.hidden ? <button type="button" data-lce-hide="" disabled={busy} onClick={() => save(true)} style={{ ...ghost, display: "block", width: "100%", marginTop: 10, padding: "10px 12px", color: sub }}>Спрятать из проверки</button> : null}
        </>) : null}
      </div>
    </div>
  );
}
