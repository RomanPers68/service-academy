// ui/ref-assist.jsx — v168 (Доп. 493): ассистент в редакторе главы справочника.
//
// Владелец (15.11): «Редактор должен быть гибким и удобным. Включая все фишки и ai-ассистента». Устроен как ассистент
// редактора контента: блок под текстом, всё приходит черновиком, в главу текст берёт владелец.
//   • «Глава из материала» — регламент, заметки или PDF → глава в разметке справочника;
//   • «Глава по теме» — без материала, по общим правилам сервиса (с честной пометкой: проверь факты);
//   • «Улучшить текст» и «Сократить» — вся глава или выделенный кусок (выделил строки — правится только он).
// Ответ сначала виден так, как его увидит сотрудник; потом «Взять в главу», «Заменить текст» или «Добавить в конец».
// После замены — «Вернуть прежний текст». Строки картинок сверяются с исходным текстом и здесь, и на сервере
// (lib/ref-ai.js): потерянная строка фото при записи главы стоила бы самого фото. По той же причине при замене всего
// текста (новой главой или правкой) картинки того текста, что сейчас в главе, переносятся в конец нового.
// Сервер — тот же /api/lesson-assist (режимы ref_*), только владелец. Сохранение — как у всей главы, кнопкой «Записать».
import React from "react";
import { RefContent } from "./ReferenceSection";
import { labelStyle } from "./tokens";
import { UI_SVG } from "./icons";
import { vibrate } from "../lib/utils";
import { saToken } from "../api/supabase";
import { REF_AI_LIMITS, refAiCheck, keepRefMarks, refFragment, refTake } from "../lib/ref-ai";

const SERIF = "Georgia, 'Times New Roman', serif";
export const REF_AI_URL = "/api/lesson-assist";
export const REF_AI_PDF_MAX = 10 * 1024 * 1024;

/**
 * Обращение к ассистенту. src — исходный текст (для правки и сокращения): его картинки должны остаться.
 * → { ok: true, title?, content, lost } | { ok: false, error }
 */
export async function refAiCall(mode, { topic = "", text = "", pdfBase64 = "" } = {}, src = "") {
  let r, d;
  try {
    r = await fetch(REF_AI_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: saToken(), mode, title: topic, text, pdfBase64 }) });
    d = await r.json().catch(() => null);
  } catch (e) { return { ok: false, error: "Нет связи с ассистентом." }; }
  if (!d || !d.ok) return { ok: false, error: (d && d.error) || (r.status === 404 ? "Ассистент ещё не развёрнут на сервере." : "Ассистент не ответил. Попробуй ещё раз.") };
  const kept = keepRefMarks(mode === "ref_chapter" ? "" : src, d.content);
  if (!kept.text) return { ok: false, error: "Ассистент ответил пусто. Попробуй ещё раз." };
  const out = { ok: true, content: kept.text, lost: (Number(d.lost) || 0) + kept.lost };
  if (mode === "ref_chapter") out.title = String(d.title || "").trim();
  return out;
}

const signs = (n) => { const a = n % 10, b = n % 100; return n.toLocaleString("ru-RU") + " " + (a === 1 && b !== 11 ? "знак" : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? "знака" : "знаков"); };
const lostNote = (n) => (n === 1 ? "Ассистент пропустил одну картинку: она добавлена в конец текста. Поставь её на место."
  : "Ассистент пропустил картинки (" + n + "): они добавлены в конец текста. Поставь их на место.");
const fileIc = (c) => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>);
const BUSY = { doc: "Пишу главу…", topic: "Пишу главу…", improve: "Улучшаю текст…", shorten: "Сокращаю…" };

/**
 * Блок «Ассистент» под текстом главы. title, body — что сейчас в редакторе; getSel() → [начало, конец] выделения в поле
 * текста; onTake({ title?, body }) — владелец взял ответ; ui — краски и стили редактора (поле, главная кнопка, стекло).
 */
export function RefAssist({ T, a11y, title, body, getSel, onTake, ui }) {
  const { input, primary, G, txt, muted, gold, brd, TN } = ui;
  const dark = !a11y;
  const [ai, setAi] = React.useState({ mode: null, busy: false, err: "", topic: "", notes: "", material: "", pdf: null, result: null, frag: null });
  const [undo, setUndo] = React.useState(null);   // { title, body, pics } — что было до ответа ассистента; pics — сколько картинок перенесено в конец
  const alive = React.useRef(true);
  React.useEffect(() => () => { alive.current = false; }, []);
  const hasText = String(body || "").trim().length >= REF_AI_LIMITS.min;
  const close = () => setAi((a) => ({ ...a, mode: null, busy: false, err: "", result: null, frag: null }));
  const open = (mode) => setAi((a) => ({ ...a, mode, busy: false, err: "", result: null, frag: null, topic: mode === "topic" && !a.topic ? String(title || "").trim() : a.topic }));
  const fail = (mode, err) => { vibrate("error"); setAi((a) => ({ ...a, mode, busy: false, err, result: null })); };

  const write = async (mode) => {   // глава из материала или по теме
    const topic = (mode === "topic" ? ai.topic : String(title || "")).trim(), text = (mode === "topic" ? ai.notes : ai.material).trim(), pdf = mode === "doc" && ai.pdf ? ai.pdf.b64 : "";
    const miss = refAiCheck("ref_chapter", { topic: mode === "topic" ? topic : "", text, hasPdf: !!pdf });
    if (miss) { fail(mode, text.length > REF_AI_LIMITS.material ? miss : mode === "topic" ? "Напиши тему главы." : "Вставь текст или прикрепи PDF."); return; }
    setAi((a) => ({ ...a, mode, busy: true, err: "", result: null, frag: null }));
    const r = await refAiCall("ref_chapter", { topic, text, pdfBase64: pdf });
    if (!alive.current) return;
    if (!r.ok) { fail(mode, r.error); return; }
    vibrate("success");
    setAi((a) => ({ ...a, mode, busy: false, err: "", result: r, frag: null }));
  };
  const fix = async (mode, whole = false) => {   // улучшить или сократить: вся глава или выделенный кусок (whole — выделение не в счёт)
    const [s, e] = whole ? [0, 0] : getSel();
    const frag = refFragment(body, s, e);
    const miss = refAiCheck(mode === "shorten" ? "ref_shorten" : "ref_improve", { text: frag.text });
    if (miss) { fail(mode, miss); return; }
    setAi((a) => ({ ...a, mode, busy: true, err: "", result: null, frag }));
    const r = await refAiCall(mode === "shorten" ? "ref_shorten" : "ref_improve", { text: frag.text }, frag.text);
    if (!alive.current) return;
    if (!r.ok) { fail(mode, r.error); return; }
    vibrate("success");
    setAi((a) => ({ ...a, mode, busy: false, err: "", result: r, frag }));
  };
  const pickPdf = (file) => {
    if (!file) return;
    if (file.size > REF_AI_PDF_MAX) { setAi((a) => ({ ...a, err: "PDF больше 10 МБ. Сократи его или вставь текст." })); return; }
    const fr = new FileReader();
    fr.onload = () => setAi((a) => ({ ...a, pdf: { name: file.name, b64: String(fr.result).split(",")[1] || "" }, err: "" }));
    fr.readAsDataURL(file);
  };
  const take = (how) => {
    const r = ai.result;
    if (!r) return;
    const was = { title: String(title || ""), body: String(body || "") };
    const fixed = ai.mode === "improve" || ai.mode === "shorten";
    // меняется весь текст — картинки того, что сейчас в главе, остаются в конце нового (lib/ref-ai.js, refTake)
    const t = refTake(was.body, { fixed, frag: ai.frag, content: r.content, how });
    if (!t) { fail(ai.mode, "Текст главы изменился, фрагмент не найден. Попробуй ещё раз."); return; }
    onTake(!fixed && !was.title.trim() && r.title ? { title: r.title, body: t.body } : { body: t.body });
    setUndo(was.body.trim() || was.title.trim() ? { ...was, pics: t.pics } : null);
    vibrate("light");
    setAi((a) => ({ ...a, mode: null, busy: false, err: "", result: null, frag: null, material: "", pdf: null, notes: "" }));
  };

  const aiBtn = { display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36, padding: "0 12px", borderRadius: 12, cursor: "pointer", fontFamily: SERIF, fontSize: 13.5,
    background: "transparent", color: txt, border: `1px solid ${brd}` };
  const small = { ...primary, width: "auto", padding: "10px 16px", fontSize: 14 };
  const quiet = { background: "transparent", border: "none", cursor: "pointer", color: muted, fontFamily: SERIF, fontSize: 13.5, padding: "8px 6px" };
  const off = (v) => (v ? { opacity: 0.45, cursor: "default" } : null);
  const r = ai.result, isFix = ai.mode === "improve" || ai.mode === "shorten";
  const filled = String(body || "").trim().length > 0;

  return (
    <div data-ra="" data-lens-edge="" style={G({ padding: "12px 12px", marginTop: 12 })}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {UI_SVG.ai(gold, 17)}
        <span style={{ ...labelStyle(13.5), color: gold }}>Ассистент</span>
      </div>
      <div style={{ color: muted, fontSize: 12.5, lineHeight: 1.45, margin: "4px 0 10px" }}>Всё приходит черновиком. В главу текст берёшь ты, записываешь тоже ты.</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" data-ra-btn="doc" data-lens-btn="soft" disabled={ai.busy} onClick={() => open("doc")} style={{ ...aiBtn, ...off(ai.busy) }}>Глава из материала</button>
        <button type="button" data-ra-btn="topic" data-lens-btn="soft" disabled={ai.busy} onClick={() => open("topic")} style={{ ...aiBtn, ...off(ai.busy) }}>Глава по теме</button>
        <button type="button" data-ra-btn="improve" data-lens-btn="soft" disabled={ai.busy || !hasText} onClick={() => fix("improve")} style={{ ...aiBtn, ...off(ai.busy || !hasText) }}>Улучшить текст</button>
        <button type="button" data-ra-btn="shorten" data-lens-btn="soft" disabled={ai.busy || !hasText} onClick={() => fix("shorten")} style={{ ...aiBtn, ...off(ai.busy || !hasText) }}>Сократить</button>
      </div>
      {hasText && !ai.mode ? <div style={{ color: muted, fontSize: 12.5, lineHeight: 1.45, marginTop: 8 }}>Выдели несколько строк, и ассистент улучшит или сократит только их.</div> : null}

      {ai.mode === "doc" && !r ? (
        <div data-ra-form="doc" style={{ marginTop: 10 }}>
          <textarea data-ra-material="" data-lens-field="" style={{ ...input, minHeight: 110, lineHeight: 1.5 }} value={ai.material} onChange={(e) => setAi((a) => ({ ...a, material: e.target.value, err: "" }))}
            placeholder="Вставь регламент, заметки или список правил. Ассистент соберёт из них главу в стиле справочника." />
          <div style={{ color: muted, fontSize: 12.5, lineHeight: 1.45, marginTop: 6 }}>Длинный документ лучше давать частями: одна тема, одна глава.</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <label data-ra-pdf="" style={{ ...aiBtn, ...off(ai.busy) }}>{fileIc(gold)}{ai.pdf ? ai.pdf.name.slice(0, 24) : "Прикрепить PDF"}
              <input type="file" accept="application/pdf" disabled={ai.busy} style={{ display: "none" }} onChange={(e) => { pickPdf(e.target.files && e.target.files[0]); e.target.value = ""; }} /></label>
            <button type="button" data-ra-go="doc" data-lens-btn="main" disabled={ai.busy || (!ai.material.trim() && !ai.pdf)} onClick={() => write("doc")}
              style={{ ...small, ...off(ai.busy || (!ai.material.trim() && !ai.pdf)) }}>{ai.busy ? BUSY.doc : "Собрать главу"}</button>
            <button type="button" data-ra-cancel="" onClick={close} style={quiet}>Отмена</button>
          </div>
        </div>) : null}

      {ai.mode === "topic" && !r ? (
        <div data-ra-form="topic" style={{ marginTop: 10 }}>
          <input data-ra-topic="" data-lens-field="" style={input} value={ai.topic} maxLength={REF_AI_LIMITS.topic} onChange={(e) => setAi((a) => ({ ...a, topic: e.target.value, err: "" }))} placeholder="Тема главы. Напр. «Декантация вина»" />
          <textarea data-ra-notes="" data-lens-field="" style={{ ...input, minHeight: 70, lineHeight: 1.5, marginTop: 8 }} value={ai.notes} onChange={(e) => setAi((a) => ({ ...a, notes: e.target.value }))}
            placeholder="Что обязательно упомянуть, если есть: свои правила, цифры, порядок действий" />
          <div data-ra-warn="" style={{ color: muted, fontSize: 12.5, lineHeight: 1.45, marginTop: 6 }}>Без своего материала ассистент пишет по общим правилам ресторанного сервиса. Проверь факты и добавь то, как принято у вас.</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <button type="button" data-ra-go="topic" data-lens-btn="main" disabled={ai.busy || ai.topic.trim().length < 3} onClick={() => write("topic")}
              style={{ ...small, ...off(ai.busy || ai.topic.trim().length < 3) }}>{ai.busy ? BUSY.topic : "Написать главу"}</button>
            <button type="button" data-ra-cancel="" onClick={close} style={quiet}>Отмена</button>
          </div>
        </div>) : null}

      {ai.busy && isFix ? <div data-ra-busy="" role="status" style={{ color: muted, fontSize: 13.5, marginTop: 10 }}>{BUSY[ai.mode]}{ai.frag && ai.frag.part ? " Только выделенное." : ""}</div> : null}
      {ai.err ? <div data-ra-err="" role="status" style={{ color: TN.bad, fontSize: 13.5, marginTop: 10, lineHeight: 1.45 }}>{ai.err}</div> : null}

      {r ? (
        <div data-ra-result={ai.mode} style={{ marginTop: 10, borderTop: `1px solid ${brd}`, paddingTop: 10 }}>
          {!isFix && r.title ? <div data-ra-title="" style={{ color: txt, fontFamily: SERIF, fontWeight: "bold", fontSize: 16, marginBottom: 6 }}>{r.title}</div> : null}
          {isFix ? <div data-ra-stat="" style={{ color: muted, fontSize: 12.5, marginBottom: 6 }}>{ai.frag && ai.frag.part ? "Выделенный фрагмент. " : ""}Было {signs(ai.frag ? ai.frag.text.length : 0)}, стало {signs(r.content.length)}.</div> : null}
          <div data-ra-preview="" style={{ maxHeight: 300, boxSizing: "border-box", overflowY: "auto", padding: "10px 12px", borderRadius: 14, border: `1px solid ${brd}`, background: dark ? "rgba(20,14,6,0.4)" : "rgba(255,252,245,0.6)" }}>
            <RefContent text={r.content} T={T} gold={gold} dark={dark} notes />
          </div>
          {r.lost > 0 ? <div data-ra-lost="" style={{ color: TN.mid, fontSize: 12.5, lineHeight: 1.45, marginTop: 8 }}>{lostNote(r.lost)}</div> : null}
          {!isFix ? <div style={{ color: muted, fontSize: 12.5, lineHeight: 1.45, marginTop: 8 }}>Это черновик. Проверь факты перед записью.</div> : null}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {isFix
              ? <button type="button" data-ra-take="replace" data-lens-btn="main" onClick={() => take("replace")} style={small}>{ai.frag && ai.frag.part ? "Заменить фрагмент" : "Заменить текст"}</button>
              : <button type="button" data-ra-take="replace" data-lens-btn="main" onClick={() => take("replace")} style={small}>{filled ? "Заменить текст" : "Взять в главу"}</button>}
            {!isFix && filled ? <button type="button" data-ra-take="append" data-lens-btn="soft" onClick={() => take("append")} style={{ ...aiBtn, minHeight: 40 }}>Добавить в конец</button> : null}
            {/* выделение могло остаться от кнопок оформления: одной кнопкой — то же самое для всей главы */}
            {isFix && ai.frag && ai.frag.part && String(body || "").length <= REF_AI_LIMITS.text
              ? <button type="button" data-ra-whole="" data-lens-btn="soft" onClick={() => fix(ai.mode, true)} style={{ ...aiBtn, minHeight: 40 }}>Нужна вся глава</button> : null}
            <button type="button" data-ra-cancel="" onClick={close} style={quiet}>Отмена</button>
          </div>
        </div>) : null}

      {undo && !r && !ai.busy ? (
        <div data-ra-undo="" style={{ marginTop: 10, color: muted, fontSize: 12.5 }}>
          {undo.pics ? <div data-ra-kept="" style={{ color: TN.mid, lineHeight: 1.45, marginBottom: 4 }}>{undo.pics === 1 ? "Картинка прежнего текста перенесена в конец. Поставь её на место или убери."
            : "Картинки прежнего текста перенесены в конец. Поставь их на место или убери."}</div> : null}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ flex: 1 }}>Ассистент поменял текст главы.</span>
            <button type="button" data-ra-undo-btn="" onClick={() => { onTake({ title: undo.title, body: undo.body }); setUndo(null); vibrate("light"); }}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: gold, fontFamily: SERIF, fontSize: 13, padding: "6px 2px" }}>Вернуть прежний текст</button>
          </div>
        </div>) : null}
    </div>
  );
}
