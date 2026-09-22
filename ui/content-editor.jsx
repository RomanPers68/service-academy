// ui/content-editor.jsx — редактор контента (правка 156, просьба владельца «сделать
// удобным и красивым + ассистент, как в меню»).
//
// Формат урока и серверные функции — прежние (cms_list_lessons / cms_save_lesson /
// cms_delete_lesson): уже созданные уроки открываются и сохраняются как раньше.
// Что нового:
//   • список — по трекам и разделам, у раздела иконка и цвет трека, как у сотрудника;
//   • «Для кого» — треки в цветах палитры, добавлена хостес (раньше её не было);
//   • раздел — метками из уже созданных (без дублей из опечаток) или новый;
//   • кнопки «Ж», «• Список», «Заголовок» — без звёздочек руками;
//   • ассистент: «Урок из текста» (текст или PDF), «Улучшить текст», «Придумать
//     вопросы» — всё черновиком, сохраняет человек (серверная часть — api/lesson-assist.js);
//   • вопросы карточками: верный — тапом, пояснение, фото, порядок ↑↓;
//   • черновик сам сохраняется на телефоне и восстанавливается;
//   • «Как увидит сотрудник» — карточка раздела и текст урока, как в программе.
import React from "react";
import { rpc, saToken } from "../api/supabase";
import { TRACKS, trackOf, customIcon } from "../lib/tracks";
import { MOD_SVG, UI_SVG } from "./icons";
import { glass as glassOf, SectionLabel, tones } from "./analytics-kit";
import { GOLD } from "./tokens";

const DRAFT_KEY = "sa_cms_draft";
const SERIF = "Georgia, 'Times New Roman', serif";
const uid = () => Math.random().toString(36).slice(2, 9);
const blankQ = () => ({ id: uid(), q: "", options: ["", ""], correct: 0, explanation: "", img: "" });
const blankS = (genre = "action") => ({ id: uid(), genre, emoji: "", scene: "", question: genre === "find" ? "В чём ошибка?" : "Что делаешь?", options: ["", ""], correct: 0, win: "", fail: "" });
const blankLesson = () => ({ id: "", role: "seasonal", module: "", title: "", content: "", questions: [], situations: [], sort: 0 });
const hasWork = (d) => !!(d && ((d.title || "").trim() || (d.content || "").trim() || (d.questions || []).length || (d.situations || []).length));
// Сервер хранит у урока текст и вопросы; отдельного места для ситуаций нет. Чтобы не
// трогать серверные функции, ситуации лежат в том же списке questions с пометкой
// kind: "situation" (правка 158); приложение и редактор разделяют их при чтении.
const isSit = (q) => !!(q && q.kind === "situation");
const fromServer = (l) => {
  const all = Array.isArray(l.questions) ? l.questions : [];
  return JSON.parse(JSON.stringify({ ...blankLesson(), ...l,
    questions: all.filter(q => !isSit(q)).map(q => ({ id: uid(), ...q })),
    situations: all.filter(isSit).map(({ kind, ...x }) => ({ id: uid(), ...x })) }));
};
const SIT_EMOJI = ["🔥", "💬", "🍷", "🙋", "⚠️", "🤝", "🍽", "⏱"];
const readDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (e) { return null; } };
const writeDraft = (v) => { try { v ? localStorage.setItem(DRAFT_KEY, JSON.stringify(v)) : localStorage.removeItem(DRAFT_KEY); } catch (e) {} };
const hhmm = (t) => { const d = new Date(t); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };

const ico = {
  pencil: (c) => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20l1-4L16.5 4.5a2.12 2.12 0 0 1 3 3L8 19l-4 1z" /><path d="M14.5 6.5l3 3" /></svg>),
  trash: (c, s) => (<svg width={s || 17} height={s || 17} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>),
  plus: (c, s) => (<svg width={s || 18} height={s || 18} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>),
  up: (c) => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 15l6-6 6 6" /></svg>),
  down: (c) => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>),
  photo: (c) => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>),
  file: (c) => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>),
  check: (c) => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>),
};

// Текст урока — по тем же правилам, что рисует экран урока (ui/screens-learning.jsx):
// строка **целиком** — заголовок, «•» — пункт, «…» — цитата, ✅/❌ — хорошо/плохо,
// **жирное** внутри строки.
function Rich({ text, T, color, a11y }) {
  const TN = tones(a11y);
  const inline = (s) => !s.includes("**") ? s : s.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((p, k) =>
    p.startsWith("**") && p.endsWith("**") ? <b key={k} style={{ color: T.bold && T.bold.color, fontWeight: "bold" }}>{p.slice(2, -2)}</b> : <React.Fragment key={k}>{p}</React.Fragment>);
  const row = (style, icon, line, i) => (
    <div key={i} style={{ ...style, display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ flexShrink: 0, marginTop: 2, display: "inline-flex" }}>{icon}</span><span style={{ flex: 1 }}>{inline(line.replace(/^(✅|❌)\s*/, ""))}</span>
    </div>);
  return (String(text || "")).split("\n").map((line, i) => {
    if (!line.trim()) return <div key={i} style={{ height: 10 }} />;
    if (line.startsWith("**") && line.endsWith("**") && line.length > 4) return <div key={i} style={T.bold}>{line.replace(/\*\*/g, "")}</div>;
    if (line.startsWith("•")) return <div key={i} style={T.bullet}>{inline(line)}</div>;
    if (line.startsWith("✅")) return row(T.good || T.para, UI_SVG.checkCircle(TN.good, 14), line, i);
    if (line.startsWith("❌")) return row(T.bad || T.para, UI_SVG.xCircle(TN.bad, 14), line, i);
    if (line.startsWith("«") && line.includes("»")) return <div key={i} style={{ ...(T.quote || T.para), borderLeftColor: color }}>{line}</div>;
    return <div key={i} style={T.para}>{inline(line)}</div>;
  });
}

export function ContentEditorScreen({ T, a11y, onBack }) {
  const dark = !a11y;
  const TN = tones(a11y);
  const gold = dark ? GOLD : "#6B4E14";
  const txt = dark ? "#EFE4C8" : "#2A2113";
  const muted = dark ? "#BFAE8A" : "#5E4E30";
  const brd = dark ? "rgba(214,178,102,0.30)" : "rgba(107,78,20,0.28)";
  const G = (extra) => glassOf(null, a11y, extra);
  const token = saToken();
  const trackInk = (t) => dark ? t.color : t.ink;

  const [lessons, setLessons] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [loadErr, setLoadErr] = React.useState(false);
  const [view, setView] = React.useState("list");
  const [draft, setDraft] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [confirmDel, setConfirmDel] = React.useState(null);
  const [draftNote, setDraftNote] = React.useState(null);   // «восстановлен черновик от …»
  const [savedAt, setSavedAt] = React.useState(null);
  const [newSection, setNewSection] = React.useState(false);
  const [ai, setAi] = React.useState({ mode: null, busy: false, err: null, material: "", pdf: null, result: null, picked: {} });
  const taRef = React.useRef(null);

  const load = React.useCallback(async () => {
    setLoading(true); setLoadErr(false);
    try { const res = await rpc("cms_list_lessons", { p_token: token }); if (Array.isArray(res)) setLessons(res); else { setLessons([]); setLoadErr(true); } }
    catch (e) { setLessons([]); setLoadErr(true); }
    setLoading(false);
  }, [token]);
  React.useEffect(() => { load(); }, [load]);

  // ── Черновик: сам сохраняется на телефоне через полсекунды после правки ──
  React.useEffect(() => {
    if (view !== "edit" || !draft) return;
    const t = setTimeout(() => { if (hasWork(draft)) { const at = Date.now(); writeDraft({ forId: draft.id || "new", at, draft }); setSavedAt(at); } }, 600);
    return () => clearTimeout(t);
  }, [draft, view]);
  // поле текста растёт вместе с текстом
  React.useEffect(() => { const el = taRef.current; if (el) { el.style.height = "auto"; el.style.height = Math.max(140, el.scrollHeight) + "px"; } }, [draft && draft.content, view]);

  const open = (base) => {
    const stored = readDraft();
    const forId = base.id || "new";
    if (stored && stored.forId === forId && hasWork(stored.draft)) {
      setDraft({ ...base, ...stored.draft, questions: (stored.draft.questions || []).map(q => ({ id: uid(), ...q })),
        situations: (stored.draft.situations || []).map(x => ({ id: uid(), ...x })) });
      setDraftNote(`Восстановлен черновик от ${hhmm(stored.at)}`);
    } else { setDraft(base); setDraftNote(null); }
    setErr(null); setSavedAt(null); setNewSection(false); setAi({ mode: null, busy: false, err: null, material: "", pdf: null, result: null, picked: {} });
    setView("edit");
  };
  const startNew = () => open(blankLesson());
  const startEdit = (l) => open(fromServer(l));
  // «Начать заново»: черновик стирается, урок — как на сервере (или пустой)
  const discardDraft = () => {
    writeDraft(null); setDraftNote(null);
    setDraft(d => { const orig = d && d.id ? lessons.find(l => l.id === d.id) : null;
      return orig ? fromServer(orig) : blankLesson(); });
  };
  const leave = () => { setView("list"); setDraft(null); };                 // ‹ — черновик остаётся
  const cancel = () => { writeDraft(null); setView("list"); setDraft(null); }; // «Отменить» — черновик стирается

  const patch = (f) => setDraft(d => ({ ...d, ...f }));
  const setQ = (qid, f) => setDraft(d => ({ ...d, questions: d.questions.map(q => q.id === qid ? { ...q, ...f } : q) }));
  const addQ = () => setDraft(d => ({ ...d, questions: [...d.questions, blankQ()] }));
  const delQ = (qid) => setDraft(d => ({ ...d, questions: d.questions.filter(q => q.id !== qid) }));
  const setS = (sid, f) => setDraft(d => ({ ...d, situations: d.situations.map(x => x.id === sid ? { ...x, ...f } : x) }));
  const addS = () => setDraft(d => ({ ...d, situations: [...(d.situations || []), blankS()] }));
  const delS = (sid) => setDraft(d => ({ ...d, situations: d.situations.filter(x => x.id !== sid) }));
  const moveS = (i, dir) => setDraft(d => { const j = i + dir; if (j < 0 || j >= d.situations.length) return d; const xs = [...d.situations]; [xs[i], xs[j]] = [xs[j], xs[i]]; return { ...d, situations: xs }; });
  const moveQ = (i, dir) => setDraft(d => { const j = i + dir; if (j < 0 || j >= d.questions.length) return d; const qs = [...d.questions]; [qs[i], qs[j]] = [qs[j], qs[i]]; return { ...d, questions: qs }; });

  // ── Кнопки форматирования: работают с выделением в поле текста ──
  const fmt = (kind) => {
    const ta = taRef.current; const v = (draft && draft.content) || "";
    const s = ta ? ta.selectionStart : v.length, e = ta ? ta.selectionEnd : v.length;
    let nv, ns, ne;
    if (kind === "bold") {
      const sel = v.slice(s, e) || "текст"; nv = v.slice(0, s) + "**" + sel + "**" + v.slice(e); ns = s + 2; ne = ns + sel.length;
    } else {
      const lineStart = s === 0 ? 0 : v.lastIndexOf("\n", s - 1) + 1;
      let le = v.indexOf("\n", e); if (le < 0) le = v.length;
      const block = v.slice(lineStart, le).split("\n");
      const nb = kind === "list"
        ? (block.every(x => x.startsWith("• ")) ? block.map(x => x.slice(2)) : block.map(x => x.startsWith("• ") ? x : "• " + x.replace(/^•\s*/, "")))
        : block.map(x => /^\*\*.+\*\*$/.test(x) ? x.slice(2, -2) : "**" + (x.replace(/^\*\*|\*\*$/g, "").replace(/^•\s*/, "") || "Заголовок") + "**");
      const out = nb.join("\n"); nv = v.slice(0, lineStart) + out + v.slice(le); ns = lineStart; ne = lineStart + out.length;
    }
    patch({ content: nv });
    requestAnimationFrame(() => { const t = taRef.current; if (t) { t.focus(); try { t.setSelectionRange(ns, ne); } catch (x) {} } });
  };

  // ── Ассистент ──
  const callAI = async (mode, payload) => {
    setAi(a => ({ ...a, mode, busy: true, err: null, result: null }));
    try {
      const r = await fetch("/api/lesson-assist", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, mode, role: draft.role, title: draft.title, ...payload }) });
      const d = await r.json().catch(() => null);
      // всё предложенное — сразу отмечено (и вопросы, и ситуации)
      const list = d && (d.questions || d.situations);
      if (d && d.ok) setAi(a => ({ ...a, busy: false, result: d, picked: list ? Object.fromEntries(list.map((_, i) => [i, true])) : {} }));
      else setAi(a => ({ ...a, busy: false, err: (d && d.error) || (r.status === 404 ? "Ассистент ещё не развёрнут: залей архив на Vercel (функция /api/lesson-assist)." : "Ассистент не ответил — попробуй ещё раз.") }));
    } catch (e) { setAi(a => ({ ...a, busy: false, err: "Нет связи с ассистентом." })); }
  };
  const aiClose = () => setAi(a => ({ ...a, mode: null, busy: false, err: null, result: null }));
  const pickPdf = (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setAi(a => ({ ...a, err: "PDF больше 10 МБ — сократи или вставь текст" })); return; }
    const fr = new FileReader();
    fr.onload = () => setAi(a => ({ ...a, pdf: { name: file.name, b64: String(fr.result).split(",")[1] }, err: null }));
    fr.readAsDataURL(file);
  };

  // ── Сохранение: проверки понятными словами ──
  const problems = () => {
    if (!draft.title.trim()) return "Нужно название урока.";
    for (let i = 0; i < (draft.situations || []).length; i++) {
      const x = draft.situations[i]; const opts = x.options.filter(o => (o || "").trim());
      if (!(x.scene || "").trim()) return `Ситуация ${i + 1}: нужна сцена.`;
      if (opts.length < 2) return `Ситуация ${i + 1}: нужно хотя бы два варианта.`;
      if (!(x.options[x.correct] || "").trim()) return `Ситуация ${i + 1}: отметь верный вариант.`;
    }
    for (let i = 0; i < draft.questions.length; i++) {
      const q = draft.questions[i]; const opts = q.options.filter(o => (o || "").trim());
      if (!(q.q || "").trim()) return `Вопрос ${i + 1}: нужен текст вопроса.`;
      if (opts.length < 2) return `Вопрос ${i + 1}: нужно хотя бы два варианта ответа.`;
      if (!(q.options[q.correct] || "").trim()) return `Вопрос ${i + 1}: отметь верный ответ.`;
    }
    return null;
  };
  const save = async () => {
    const p = problems(); if (p) { setErr(p); return; }
    if (busy) return; setBusy(true); setErr(null);
    const tidy = ({ id, ...q }) => {   // пустые варианты убираются, верный сдвигается вместе с ними
      const keep = q.options.map((o, i) => ({ o: (o || "").trim(), i })).filter(x => x.o);
      return { ...q, options: keep.map(x => x.o), correct: Math.max(0, keep.findIndex(x => x.i === q.correct)) };
    };
    const questions = [...draft.questions.map(tidy), ...(draft.situations || []).map(x => ({ kind: "situation", ...tidy(x) }))];
    try {
      const res = await rpc("cms_save_lesson", { p_token: token, p_lesson: (({ situations, ...rest }) => ({ ...rest, module: draft.module.trim(), title: draft.title.trim(), questions }))(draft) });
      if (res && res.ok) { writeDraft(null); await load(); setView("list"); setDraft(null); }
      else setErr(res && res.error === "forbidden" ? "Недостаточно прав." : `Не удалось сохранить${res && (res.error || res.message) ? ": " + (res.error || res.message) : "."}`);
    } catch (e) { setErr("Нет связи. Черновик сохранён на телефоне — попробуй ещё раз."); }
    setBusy(false);
  };
  const remove = async (id) => {
    if (busy) return; setBusy(true); setErr(null);
    try { const res = await rpc("cms_delete_lesson", { p_token: token, p_id: id }); if (res && res.ok) setLessons(ls => ls.filter(l => l.id !== id)); else setErr("Не удалось удалить."); }
    catch (e) { setErr("Нет связи."); }
    setBusy(false); setConfirmDel(null);
  };

  const input = { width: "100%", boxSizing: "border-box", borderRadius: 12, padding: "12px 14px", fontFamily: SERIF, fontSize: 14, outline: "none",
    background: dark ? "rgba(20,14,6,0.55)" : "rgba(255,255,255,0.65)", border: `1px solid ${brd}`, color: txt };
  const iconBtn = { background: "transparent", border: "none", cursor: "pointer", padding: 6, display: "flex", alignItems: "center", flexShrink: 0 };
  const pill = (on, c) => ({ padding: "8px 13px", borderRadius: 12, fontFamily: SERIF, fontSize: 14, cursor: "pointer",
    background: on ? c : "transparent", color: on ? "#1A1008" : c, border: `1px solid ${on ? c : c + "66"}`, fontWeight: on ? "bold" : "normal" });
  const primary = { width: "100%", padding: "14px", borderRadius: 14, border: "none", cursor: "pointer", fontFamily: SERIF, fontSize: 15, fontWeight: "bold",
    color: "#1F160A", background: "linear-gradient(135deg, #E2C487, #A67C3A)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45), 0 6px 18px rgba(166,124,58,0.3)" };
  const ghost = { width: "100%", padding: "13px", borderRadius: 14, cursor: "pointer", fontFamily: SERIF, fontSize: 14, background: "transparent", color: muted, border: `1px solid ${brd}` };
  const aiBtn = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 12, cursor: "pointer", fontFamily: SERIF, fontSize: 13,
    background: dark ? "rgba(214,178,102,0.10)" : "rgba(107,78,20,0.07)", color: gold, border: `1px solid ${gold}55` };
  const header = (title, back) => (
    <div style={T.lessHead}><button style={T.backBtn2} onClick={back} aria-label="Назад">‹</button><div style={T.lessHeadTitle}>{title}</div></div>);

  // ═════ СПИСОК ═════
  if (view === "list") {
    const groups = TRACKS.map(t => {
      const mine = lessons.filter(l => (l.role || "seasonal") === t.id);
      const secs = {}; mine.forEach(l => { const k = (l.module || "").trim() || "Свой раздел"; (secs[k] = secs[k] || []).push(l); });
      return { t, mine, secs: Object.entries(secs) };
    }).filter(g => g.mine.length);
    return (
      <div style={T.screen}>
        {header("Редактор контента", onBack)}
        <div style={{ ...T.lessBody, flex: 1, overflowY: "auto", padding: "12px 16px 44px" }}>
          <div style={{ color: muted, fontSize: 13, lineHeight: 1.5, marginBottom: 6 }}>Свои уроки под твой ресторан — сотрудники увидят их в своём треке рядом со штатными.</div>
          {loading ? <div style={{ textAlign: "center", padding: "40px 0", color: muted }}>Загрузка…</div>
          : loadErr ? <div style={{ textAlign: "center", padding: "40px 0", color: muted }}>Не удалось загрузить. <span onClick={load} style={{ color: gold, cursor: "pointer" }}>Повторить</span></div>
          : groups.length === 0 ? (
            <div style={{ ...G({ padding: "34px 22px", marginTop: 12 }), textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>{MOD_SVG["📘"](gold, 34)}</div>
              <div style={{ color: txt, fontFamily: SERIF, fontWeight: "bold", fontSize: 16, marginBottom: 6 }}>Пока ни одного своего урока</div>
              <div style={{ color: muted, fontSize: 13, lineHeight: 1.5 }}>Добавь первый — можно вставить регламент, и ассистент соберёт из него урок.</div>
            </div>
          ) : groups.map(({ t, mine, secs }) => (
            <div key={t.id}>
              <SectionLabel a11y={a11y} right={`${mine.length} ${mine.length === 1 ? "урок" : mine.length < 5 ? "урока" : "уроков"}`}>{t.label.toUpperCase()}</SectionLabel>
              {secs.map(([name, ls]) => {
                const ic = customIcon(name);
                return (
                  <div key={name} style={G({ padding: "12px 12px 6px", marginBottom: 10, borderLeft: `3px solid ${t.color}` })}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", flexShrink: 0, border: `1px solid ${t.color}55`, background: `${t.color}14` }}>{MOD_SVG[ic] ? MOD_SVG[ic](trackInk(t), 22) : null}</span>
                      <span style={{ flex: 1, minWidth: 0, color: txt, fontFamily: SERIF, fontSize: 15, fontWeight: "bold" }}>{name}</span>
                    </div>
                    {ls.map(l => {
                      const allQ = Array.isArray(l.questions) ? l.questions : [];
                      const nq = allQ.filter(q => !isSit(q)).length, ns = allQ.filter(isSit).length;
                      const asking = confirmDel === l.id;
                      return (
                        <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 0 8px 44px", borderTop: `1px solid ${brd}` }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: txt, fontSize: 14, fontFamily: SERIF }}>{l.title || "Без названия"}</div>
                            <div style={{ color: muted, fontSize: 11.5 }}>{[ns ? `практика · ${ns}` : "", nq ? `тест · ${nq} вопр.` : ""].filter(Boolean).join(" · ") || "только текст"}</div>
                          </div>
                          {asking ? (<>
                            <button onClick={() => remove(l.id)} disabled={busy} style={{ ...iconBtn, color: TN.bad, fontFamily: SERIF, fontSize: 13 }}>Удалить</button>
                            <button onClick={() => setConfirmDel(null)} style={{ ...iconBtn, color: muted, fontFamily: SERIF, fontSize: 13 }}>Нет</button>
                          </>) : (<>
                            <button onClick={() => startEdit(l)} style={iconBtn} aria-label="Изменить">{ico.pencil(muted)}</button>
                            <button onClick={() => setConfirmDel(l.id)} style={iconBtn} aria-label="Удалить">{ico.trash(TN.bad)}</button>
                          </>)}
                        </div>);
                    })}
                  </div>);
              })}
            </div>
          ))}
          {err && <div style={{ color: TN.bad, fontSize: 12.5, margin: "6px 0 10px", textAlign: "center" }}>{err}</div>}
          {!loading && !loadErr && <button onClick={startNew} style={{ ...primary, marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{ico.plus("#1F160A")} Новый урок</button>}
        </div>
      </div>
    );
  }

  // ═════ УРОК ═════
  const track = trackOf(draft.role);
  const sections = [...new Set(lessons.filter(l => (l.role || "seasonal") === draft.role).map(l => (l.module || "").trim()).filter(Boolean))];
  const typingNew = newSection || (draft.module && !sections.includes(draft.module.trim()));
  const secIcon = customIcon(draft.module);
  const nPicked = Object.values(ai.picked || {}).filter(Boolean).length;
  const editing = !!draft.id;
  return (
    <div style={T.screen}>
      {header(editing ? "Изменить урок" : "Новый урок", leave)}
      <div style={{ ...T.lessBody, flex: 1, overflowY: "auto", padding: "10px 16px 44px" }}>
        {draftNote ? (
          <div style={{ ...G({ padding: "9px 12px", marginBottom: 6 }), display: "flex", alignItems: "center", gap: 8, color: muted, fontSize: 12.5 }}>
            <span style={{ flex: 1 }}>{draftNote}</span>
            <button onClick={discardDraft} style={{ ...iconBtn, color: gold, fontFamily: SERIF, fontSize: 12.5, padding: 2 }}>Начать заново</button>
          </div>) : null}

        <SectionLabel a11y={a11y}>ДЛЯ КОГО</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {TRACKS.map(t => <button key={t.id} onClick={() => { patch({ role: t.id }); setNewSection(false); }} style={pill(draft.role === t.id, trackInk(t))}>{t.label}</button>)}
        </div>

        <SectionLabel a11y={a11y}>РАЗДЕЛ</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: typingNew ? 8 : 0 }}>
          {sections.map(s => <button key={s} onClick={() => { patch({ module: s }); setNewSection(false); }} style={pill(!typingNew && draft.module.trim() === s, trackInk(track))}>{s}</button>)}
          <button onClick={() => { setNewSection(true); patch({ module: sections.includes(draft.module.trim()) ? "" : draft.module }); }} style={{ ...pill(typingNew, gold), display: "inline-flex", alignItems: "center", gap: 4 }}>{ico.plus(typingNew ? "#1A1008" : gold, 14)} Новый</button>
        </div>
        {typingNew ? <input style={input} value={draft.module} onChange={e => patch({ module: e.target.value })} placeholder="Напр. «Наше вино»" autoFocus={newSection} /> : null}
        {draft.module.trim() ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, color: muted, fontSize: 12 }}>
            {MOD_SVG[secIcon] ? MOD_SVG[secIcon](trackInk(track), 18) : null}<span>так раздел будет выглядеть у сотрудников — иконка по смыслу названия, цвет трека</span>
          </div>) : null}

        <SectionLabel a11y={a11y}>НАЗВАНИЕ УРОКА</SectionLabel>
        <input style={input} value={draft.title} onChange={e => patch({ title: e.target.value })} placeholder="Напр. «Базовые сорта белого»" />

        <SectionLabel a11y={a11y}>ТЕКСТ УРОКА</SectionLabel>
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          <button onClick={() => fmt("bold")} style={{ ...aiBtn, color: txt, borderColor: brd, background: "transparent", fontWeight: "bold" }} aria-label="Жирный">Ж</button>
          <button onClick={() => fmt("list")} style={{ ...aiBtn, color: txt, borderColor: brd, background: "transparent" }}>• Список</button>
          <button onClick={() => fmt("head")} style={{ ...aiBtn, color: txt, borderColor: brd, background: "transparent" }}>Заголовок</button>
        </div>
        <textarea ref={taRef} style={{ ...input, minHeight: 140, resize: "none", lineHeight: 1.6, overflow: "hidden" }} value={draft.content}
          onChange={e => patch({ content: e.target.value })} placeholder={"Напиши текст урока — или собери его ассистентом из регламента ниже.\n\n**Заголовок**\n• пункт списка"} />

        {/* Ассистент */}
        <div style={G({ padding: "12px 12px", marginTop: 10 })}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            {UI_SVG.sparkle ? UI_SVG.sparkle(gold, 17) : null}
            <span style={{ color: gold, fontFamily: "monospace", fontSize: 10, letterSpacing: 1.8, fontWeight: "bold" }}>АССИСТЕНТ</span>
            <span style={{ color: muted, fontSize: 11.5 }}>· всё черновиком, сохраняешь ты</span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => setAi(a => ({ ...a, mode: "lesson", err: null, result: null }))} style={aiBtn}>Урок из текста</button>
            <button onClick={() => callAI("improve", { text: draft.content })} style={{ ...aiBtn, opacity: draft.content.trim().length >= 40 ? 1 : 0.45 }} disabled={draft.content.trim().length < 40}>Улучшить текст</button>
            <button onClick={() => callAI("situations", { text: draft.content })} style={{ ...aiBtn, opacity: draft.content.trim().length >= 40 ? 1 : 0.45 }} disabled={draft.content.trim().length < 40}>Придумать ситуации</button>
            <button onClick={() => callAI("questions", { text: draft.content })} style={{ ...aiBtn, opacity: draft.content.trim().length >= 40 ? 1 : 0.45 }} disabled={draft.content.trim().length < 40}>Придумать вопросы</button>
          </div>
          {ai.mode === "lesson" && !ai.result ? (
            <div style={{ marginTop: 10 }}>
              <textarea style={{ ...input, minHeight: 110, lineHeight: 1.5, fontSize: 13 }} value={ai.material} onChange={e => setAi(a => ({ ...a, material: e.target.value }))}
                placeholder="Вставь регламент, заметки или список правил — ассистент сделает из этого урок в стиле приложения" />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <label style={{ ...aiBtn, background: "transparent" }}>{ico.file(gold)} {ai.pdf ? ai.pdf.name.slice(0, 24) : "Прикрепить PDF"}
                  <input type="file" accept="application/pdf" style={{ display: "none" }} onChange={e => pickPdf(e.target.files && e.target.files[0])} /></label>
                <button onClick={() => callAI("lesson", { text: ai.material, pdfBase64: ai.pdf ? ai.pdf.b64 : "" })} disabled={ai.busy || (!ai.material.trim() && !ai.pdf)}
                  style={{ ...primary, width: "auto", padding: "9px 14px", fontSize: 13.5, opacity: ai.busy || (!ai.material.trim() && !ai.pdf) ? 0.5 : 1 }}>{ai.busy ? "Пишу урок…" : "Собрать урок"}</button>
                <button onClick={aiClose} style={{ ...iconBtn, color: muted, fontFamily: SERIF, fontSize: 13 }}>Отмена</button>
              </div>
            </div>) : null}
          {ai.busy && ai.mode !== "lesson" ? <div style={{ color: muted, fontSize: 13, marginTop: 10 }}>{ai.mode === "improve" ? "Улучшаю текст…" : ai.mode === "situations" ? "Придумываю ситуации…" : "Придумываю вопросы…"}</div> : null}
          {ai.err ? <div style={{ color: TN.bad, fontSize: 12.5, marginTop: 10, lineHeight: 1.45 }}>{ai.err}</div> : null}
          {ai.result && ai.mode === "lesson" ? (
            <div style={{ marginTop: 10, borderTop: `1px solid ${brd}`, paddingTop: 10 }}>
              <div style={{ color: txt, fontFamily: SERIF, fontWeight: "bold", fontSize: 15, marginBottom: 6 }}>{ai.result.title || "Урок"}</div>
              <div style={{ maxHeight: 260, overflowY: "auto" }}><Rich text={ai.result.content} T={T} color={track.color} a11y={a11y} /></div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button onClick={() => { patch({ content: ai.result.content, title: draft.title.trim() ? draft.title : (ai.result.title || "") }); aiClose(); }} style={{ ...primary, width: "auto", padding: "9px 14px", fontSize: 13.5 }}>{draft.content.trim() ? "Заменить текст" : "Взять в урок"}</button>
                {draft.content.trim() ? <button onClick={() => { patch({ content: draft.content.replace(/\s+$/, "") + "\n\n" + ai.result.content }); aiClose(); }} style={{ ...aiBtn }}>Добавить в конец</button> : null}
                <button onClick={aiClose} style={{ ...iconBtn, color: muted, fontFamily: SERIF, fontSize: 13 }}>Отмена</button>
              </div>
            </div>) : null}
          {ai.result && ai.mode === "improve" ? (
            <div style={{ marginTop: 10, borderTop: `1px solid ${brd}`, paddingTop: 10 }}>
              <div style={{ color: gold, fontFamily: "monospace", fontSize: 9.5, letterSpacing: 1.6, fontWeight: "bold", marginBottom: 6 }}>СТАЛО</div>
              <div style={{ maxHeight: 260, overflowY: "auto" }}><Rich text={ai.result.content} T={T} color={track.color} a11y={a11y} /></div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={() => { patch({ content: ai.result.content }); aiClose(); }} style={{ ...primary, width: "auto", padding: "9px 14px", fontSize: 13.5 }}>Принять</button>
                <button onClick={aiClose} style={{ ...aiBtn }}>Оставить как было</button>
              </div>
            </div>) : null}
          {ai.result && ai.mode === "situations" ? (
            <div style={{ marginTop: 10, borderTop: `1px solid ${brd}`, paddingTop: 6 }}>
              {ai.result.situations.map((x, i) => (
                <div key={i} onClick={() => setAi(a => ({ ...a, picked: { ...a.picked, [i]: !a.picked[i] } }))} style={{ display: "flex", gap: 9, padding: "8px 0", cursor: "pointer", borderBottom: `1px solid ${brd}` }}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1, display: "grid", placeItems: "center",
                    border: `1.5px solid ${ai.picked[i] ? TN.good : brd}`, background: ai.picked[i] ? TN.good : "transparent" }}>{ai.picked[i] ? ico.check(dark ? "#1A1008" : "#fff") : null}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: gold, fontFamily: "monospace", fontSize: 9, letterSpacing: 1.4, fontWeight: "bold" }}>{x.genre === "find" ? "НАЙДИ ОШИБКУ" : "ЧТО ДЕЛАЕШЬ?"}</div>
                    <div style={{ color: txt, fontFamily: SERIF, fontSize: 13.5, lineHeight: 1.35 }}>{x.emoji ? x.emoji + " " : ""}{x.scene}</div>
                    <div style={{ color: TN.good, fontSize: 12, marginTop: 2 }}>верно: {x.options[x.correct]}</div>
                  </div>
                </div>))}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button disabled={!nPicked} onClick={() => { const add = ai.result.situations.filter((_, i) => ai.picked[i]).map(x => ({ id: uid(), ...x })); setDraft(d => ({ ...d, situations: [...(d.situations || []), ...add] })); aiClose(); }}
                  style={{ ...primary, width: "auto", padding: "9px 14px", fontSize: 13.5, opacity: nPicked ? 1 : 0.5 }}>Добавить выбранные ({nPicked})</button>
                <button onClick={aiClose} style={{ ...iconBtn, color: muted, fontFamily: SERIF, fontSize: 13 }}>Отмена</button>
              </div>
            </div>) : null}
          {ai.result && ai.mode === "questions" ? (
            <div style={{ marginTop: 10, borderTop: `1px solid ${brd}`, paddingTop: 6 }}>
              {ai.result.questions.map((q, i) => (
                <div key={i} onClick={() => setAi(a => ({ ...a, picked: { ...a.picked, [i]: !a.picked[i] } }))} style={{ display: "flex", gap: 9, padding: "8px 0", cursor: "pointer", borderBottom: `1px solid ${brd}` }}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1, display: "grid", placeItems: "center",
                    border: `1.5px solid ${ai.picked[i] ? TN.good : brd}`, background: ai.picked[i] ? TN.good : "transparent" }}>{ai.picked[i] ? ico.check(dark ? "#1A1008" : "#fff") : null}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: txt, fontFamily: SERIF, fontSize: 13.5, fontWeight: "bold", lineHeight: 1.35 }}>{q.q}</div>
                    <div style={{ color: TN.good, fontSize: 12, marginTop: 2 }}>верно: {q.options[q.correct]}</div>
                  </div>
                </div>))}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button disabled={!nPicked} onClick={() => { const add = ai.result.questions.filter((_, i) => ai.picked[i]).map(q => ({ id: uid(), img: "", ...q })); setDraft(d => ({ ...d, questions: [...d.questions, ...add] })); aiClose(); }}
                  style={{ ...primary, width: "auto", padding: "9px 14px", fontSize: 13.5, opacity: nPicked ? 1 : 0.5 }}>Добавить выбранные ({nPicked})</button>
                <button onClick={aiClose} style={{ ...iconBtn, color: muted, fontFamily: SERIF, fontSize: 13 }}>Отмена</button>
              </div>
            </div>) : null}
        </div>

        {/* Практика ситуаций — между текстом и тестом, как шаги в программе (правка 158) */}
        <SectionLabel a11y={a11y} right={(draft.situations || []).length ? `${draft.situations.length}` : "необязательно"}>ПРАКТИКА СИТУАЦИЙ</SectionLabel>
        {!(draft.situations || []).length ? <div style={{ color: muted, fontSize: 12.5, lineHeight: 1.45, margin: "-2px 2px 8px" }}>Короткие сцены из смены: выбрать верное действие или найти ошибку. В игре — до 6 случайных, со звёздами, как в штатных уроках.</div> : null}
        {(draft.situations || []).map((x, si) => (
          <div key={x.id} style={G({ padding: "12px 12px", marginBottom: 10 })}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
              <span style={{ color: gold, fontFamily: "monospace", fontSize: 10, letterSpacing: 1.6, fontWeight: "bold", flex: 1 }}>СИТУАЦИЯ {si + 1}</span>
              <button onClick={() => moveS(si, -1)} disabled={si === 0} style={{ ...iconBtn, opacity: si === 0 ? 0.3 : 1 }} aria-label="Ситуацию выше">{ico.up(muted)}</button>
              <button onClick={() => moveS(si, 1)} disabled={si === draft.situations.length - 1} style={{ ...iconBtn, opacity: si === draft.situations.length - 1 ? 0.3 : 1 }} aria-label="Ситуацию ниже">{ico.down(muted)}</button>
              <button onClick={() => delS(x.id)} style={iconBtn} aria-label="Удалить ситуацию">{ico.trash(TN.bad, 16)}</button>
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              {[["action", "Что делаешь?"], ["find", "Найди ошибку"]].map(([g, lab]) => (
                <button key={g} onClick={() => setS(x.id, { genre: g, question: ["", "Что делаешь?", "В чём ошибка?"].includes(x.question) ? (g === "find" ? "В чём ошибка?" : "Что делаешь?") : x.question })}
                  style={{ ...pill(x.genre === g, gold), padding: "6px 11px", fontSize: 12.5 }}>{lab}</button>))}
            </div>
            <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }} aria-label="Эмодзи сцены">
              {SIT_EMOJI.map(e => <button key={e} onClick={() => setS(x.id, { emoji: x.emoji === e ? "" : e })}
                style={{ width: 34, height: 34, borderRadius: 10, cursor: "pointer", fontSize: 17, background: x.emoji === e ? `${gold}22` : "transparent", border: `1px solid ${x.emoji === e ? gold : brd}` }}>{e}</button>)}
            </div>
            <textarea style={{ ...input, minHeight: 64, lineHeight: 1.5, marginBottom: 8, resize: "vertical" }} value={x.scene} onChange={e => setS(x.id, { scene: e.target.value })}
              placeholder={x.genre === "find" ? "Сцена с ошибкой: «Официант ставит бокал слева от тарелки…»" : "Сцена: «Гость пятый раз зовёт тебя, а у тебя в руках горячее…»"} />
            <input style={{ ...input, marginBottom: 8 }} value={x.question} onChange={e => setS(x.id, { question: e.target.value })} placeholder="Вопрос" />
            {x.options.map((opt, oi) => { const right = x.correct === oi; return (
              <div key={oi} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                <button onClick={() => setS(x.id, { correct: oi })} aria-label="Верный вариант" style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", border: `2px solid ${right ? TN.good : brd}`, background: right ? TN.good : "transparent", cursor: "pointer", display: "grid", placeItems: "center", padding: 0 }}>{right ? ico.check(dark ? "#1A1008" : "#fff") : null}</button>
                <input style={{ ...input, padding: "10px 12px", border: `1px solid ${right ? TN.good + "88" : brd}` }} value={opt} onChange={e => setS(x.id, { options: x.options.map((o, k) => k === oi ? e.target.value : o) })} placeholder={`Действие ${oi + 1}`} />
                {x.options.length > 2 ? <button onClick={() => setS(x.id, { options: x.options.filter((_, k) => k !== oi), correct: x.correct === oi ? 0 : x.correct > oi ? x.correct - 1 : x.correct })} style={iconBtn} aria-label="Убрать вариант">{ico.trash(muted, 15)}</button> : null}
              </div>); })}
            {x.options.length < 4 ? <button onClick={() => setS(x.id, { options: [...x.options, ""] })} style={{ ...iconBtn, color: gold, fontFamily: SERIF, fontSize: 12.5, gap: 4, padding: 2, marginBottom: 6 }}>{ico.plus(gold, 14)} вариант</button> : null}
            <input style={{ ...input, fontSize: 13.5, marginBottom: 8 }} value={x.win || ""} onChange={e => setS(x.id, { win: e.target.value })} placeholder="Если верно — реакция: «🎯 Точно! …»" />
            <input style={{ ...input, fontSize: 13.5 }} value={x.fail || ""} onChange={e => setS(x.id, { fail: e.target.value })} placeholder="Если мимо — подсказка: «💡 …»" />
          </div>
        ))}
        <button onClick={addS} style={{ ...ghost, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{ico.plus(gold)} Добавить ситуацию</button>

        <SectionLabel a11y={a11y} right={draft.questions.length ? `${draft.questions.length}` : "необязательно"}>ВОПРОСЫ ТЕСТА</SectionLabel>
        {draft.questions.map((q, qi) => (
          <div key={q.id} style={G({ padding: "12px 12px", marginBottom: 10 })}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
              <span style={{ color: gold, fontFamily: "monospace", fontSize: 10, letterSpacing: 1.6, fontWeight: "bold", flex: 1 }}>ВОПРОС {qi + 1}</span>
              <button onClick={() => moveQ(qi, -1)} disabled={qi === 0} style={{ ...iconBtn, opacity: qi === 0 ? 0.3 : 1 }} aria-label="Выше">{ico.up(muted)}</button>
              <button onClick={() => moveQ(qi, 1)} disabled={qi === draft.questions.length - 1} style={{ ...iconBtn, opacity: qi === draft.questions.length - 1 ? 0.3 : 1 }} aria-label="Ниже">{ico.down(muted)}</button>
              <button onClick={() => delQ(q.id)} style={iconBtn} aria-label="Удалить вопрос">{ico.trash(TN.bad, 16)}</button>
            </div>
            <input style={{ ...input, marginBottom: 8 }} value={q.q} onChange={e => setQ(q.id, { q: e.target.value })} placeholder="Текст вопроса" />
            {q.options.map((opt, oi) => { const right = q.correct === oi; return (
              <div key={oi} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                <button onClick={() => setQ(q.id, { correct: oi })} aria-label="Верный ответ" style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", border: `2px solid ${right ? TN.good : brd}`, background: right ? TN.good : "transparent", cursor: "pointer", display: "grid", placeItems: "center", padding: 0 }}>{right ? ico.check(dark ? "#1A1008" : "#fff") : null}</button>
                <input style={{ ...input, padding: "10px 12px", border: `1px solid ${right ? TN.good + "88" : brd}` }} value={opt} onChange={e => setQ(q.id, { options: q.options.map((o, k) => k === oi ? e.target.value : o) })} placeholder={`Вариант ${oi + 1}`} />
                {q.options.length > 2 ? <button onClick={() => setQ(q.id, { options: q.options.filter((_, k) => k !== oi), correct: q.correct === oi ? 0 : q.correct > oi ? q.correct - 1 : q.correct })} style={iconBtn} aria-label="Убрать вариант">{ico.trash(muted, 15)}</button> : null}
              </div>); })}
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0 8px" }}>
              {q.options.length < 4 ? <button onClick={() => setQ(q.id, { options: [...q.options, ""] })} style={{ ...iconBtn, color: gold, fontFamily: SERIF, fontSize: 12.5, gap: 4, padding: 2 }}>{ico.plus(gold, 14)} вариант</button> : null}
              <span style={{ color: muted, fontSize: 11 }}>зелёный кружок — верный ответ</span>
            </div>
            <input style={{ ...input, fontSize: 13.5 }} value={q.explanation || ""} onChange={e => setQ(q.id, { explanation: e.target.value })} placeholder="Пояснение: почему верно именно так" />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <span style={{ flexShrink: 0 }}>{ico.photo(muted)}</span>
              <input style={{ ...input, padding: "9px 12px", fontSize: 12.5 }} value={q.img || ""} onChange={e => setQ(q.id, { img: e.target.value })} placeholder="Ссылка на фото (необязательно)" />
            </div>
            {q.img ? <img src={q.img} alt="" loading="lazy" decoding="async" style={{ width: "100%", maxHeight: 150, objectFit: "cover", borderRadius: 9, marginTop: 8, display: "block" }} /> : null}
          </div>
        ))}
        <button onClick={addQ} style={{ ...ghost, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{ico.plus(gold)} Добавить вопрос</button>

        {/* Как увидит сотрудник */}
        <SectionLabel a11y={a11y}>КАК УВИДИТ СОТРУДНИК</SectionLabel>
        <div style={{ ...T.modCard, margin: "0 0 10px" }}>
          <div style={{ ...T.modBar, background: track.color }} />
          <div style={{ ...T.modIcon, display: "flex", alignItems: "center", justifyContent: "center" }}>{MOD_SVG[secIcon] ? MOD_SVG[secIcon](track.color, 28) : null}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...T.modTag, color: track.color }}>СВОЁ · {track.label.toUpperCase()}</div>
            <div style={T.modTitle}>{draft.module.trim() || "Свой раздел"}</div>
            <div style={T.modSub}>Раздел вашего ресторана</div>
          </div>
        </div>
        <div style={G({ padding: "14px 14px", marginBottom: 16 })}>
          <div style={{ color: txt, fontFamily: SERIF, fontWeight: "bold", fontSize: 17, marginBottom: 8 }}>{draft.title.trim() || "Название урока"}</div>
          {draft.content.trim() ? <Rich text={draft.content} T={T} color={track.color} a11y={a11y} /> : <div style={{ color: muted, fontSize: 13 }}>Здесь появится текст урока.</div>}
          {draft.questions.length ? <div style={{ color: muted, fontSize: 12, marginTop: 10 }}>В конце — тест: {draft.questions.length} вопр.</div> : null}
        </div>

        {(draft.situations || []).length ? (() => { const x = draft.situations[0]; return (
          <div style={G({ padding: "14px 14px", marginBottom: 16 })}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <span style={{ color: track.color, fontFamily: "monospace", fontSize: 10, letterSpacing: 1.6, fontWeight: "bold" }}>{x.genre === "find" ? "НАЙДИ ОШИБКУ" : "ЧТО ДЕЛАЕШЬ?"}</span>
              <span style={{ color: muted, fontSize: 11.5 }}>практика · {draft.situations.length}</span>
            </div>
            <div style={{ color: txt, fontFamily: SERIF, fontSize: 14.5, lineHeight: 1.5, marginBottom: 8 }}>{x.emoji ? <span style={{ marginRight: 6 }}>{x.emoji}</span> : null}{x.scene || "Сцена ситуации"}</div>
            <div style={{ color: txt, fontFamily: SERIF, fontWeight: "bold", fontSize: 14, marginBottom: 8 }}>{x.question}</div>
            {x.options.filter(o => (o || "").trim()).map((o, k) => <div key={k} style={{ padding: "9px 12px", borderRadius: 12, marginBottom: 6, border: `1px solid ${brd}`, color: txt, fontSize: 13.5, fontFamily: SERIF }}>{o}</div>)}
            <div style={{ color: muted, fontSize: 11.5, marginTop: 6 }}>В игре — до 6 случайных ситуаций, варианты перемешаны, 3 жизни и звёзды.</div>
          </div>); })() : null}
        {err && <div style={{ color: TN.bad, fontSize: 13, marginBottom: 10, textAlign: "center", lineHeight: 1.45 }}>{err}</div>}
        <button onClick={save} disabled={busy} style={{ ...primary, marginBottom: 10, opacity: busy ? 0.6 : 1 }}>{busy ? "Сохраняю…" : "Сохранить урок"}</button>
        <button onClick={cancel} style={ghost}>Отменить</button>
        <div style={{ color: muted, fontSize: 11.5, textAlign: "center", marginTop: 10 }}>{savedAt ? `Черновик сохранён на телефоне · ${hhmm(savedAt)}` : "Черновик сохраняется на телефоне сам"}</div>
      </div>
    </div>
  );
}
