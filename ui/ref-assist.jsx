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
//
// v169 (Доп. 494). Владелец (16.11): «И давай тоже ему дадим выход в сеть, что бы он если что мог найти или проверить
// информацию😉». У ассистента теперь есть поиск в интернете — тот же, что у Наставника (api/_web.js):
//   • «Глава по теме» сначала пишется с поиском: факты ищутся и сверяются, под ответом — «Источники». Поиск не ответил —
//     глава пишется без него, и под ответом сказано почему (как у описаний блюд в редакторе меню);
//   • «Проверить факты» — вся глава или выделенные строки: замечания со словами из текста и ссылки. Отметил нужные,
//     «Поправить отмеченное» — и правка приходит так же, как «Улучшить текст»: просмотр, замена, возврат.
// Правила самого ресторана ассистент не оценивает: сверяет только то, что можно найти в источниках.
import React from "react";
import { RefContent } from "./ReferenceSection";
import { labelStyle } from "./tokens";
import { UI_SVG } from "./icons";
import { vibrate } from "../lib/utils";
import { saToken } from "../lib/supabase";
import { REF_AI_LIMITS, REF_NEW_MODES, refAiCheck, keepRefMarks, refFragment, refTake, refPlanClean, refCheckClean, refFixesText, refSources } from "../lib/ref-ai";
import { siteOf, oneSite, openOut } from "../lib/ai-web";

const SERIF = "Georgia, 'Times New Roman', serif";
export const REF_AI_URL = "/api/lesson-assist";
// v169: хостинг принимает запрос до 4,5 МБ, а PDF в запросе на треть тяжелее файла: файл больше 3 МБ до ассистента не дойдёт
export const REF_AI_PDF_MAX = 3 * 1024 * 1024;
export const REF_PDF_BIG = "PDF больше 3 МБ: сервер такой не примет. Сожми файл или вставь текст.";
/** Ответил не ассистент, а хостинг (не JSON): что сказать владельцу. Код в тексте — чтобы причину было видно на снимке. */
export const refHttpErr = (st) => (st === 404 ? "Ассистент ещё не развёрнут на сервере."
  : st === 413 ? "Файл слишком большой для сервера. Сожми PDF или вставь текст."
  : st === 504 ? "Ассистент не успел ответить. Попробуй ещё раз."
  : st && st !== 200 ? "Ассистент не ответил: сервер вернул код " + st + ". Попробуй ещё раз." : "Ассистент не ответил. Попробуй ещё раз.");

/**
 * Обращение к ассистенту. p — { topic, text, pdfBase64 } и (v169) web, about, others, fixes; src — исходный текст (для
 * правки и сокращения): его картинки должны остаться.
 * → { ok: true, title?, content, lost, sources?, searched? } — глава или правка;
 *   { ok: true, chapters } — ref_plan; { ok: true, summary, notes, sources, searched } — ref_check;
 *   { ok: false, error, web? } — web: отказал путь с поиском (главу можно написать без него).
 */
export async function refAiCall(mode, p = {}, src = "") {
  const q = p || {};
  const body = { token: saToken(), mode, title: q.topic || "", text: q.text || "", pdfBase64: q.pdfBase64 || "" };
  if (q.web) body.web = true;
  if (q.about) body.about = q.about;
  if (Array.isArray(q.others) && q.others.length) body.others = q.others;
  if (q.fixes) body.fixes = q.fixes;
  let r, d;
  try {
    r = await fetch(REF_AI_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    d = await r.json().catch(() => null);
  } catch (e) { return { ok: false, error: "Нет связи с ассистентом." }; }
  if (!d || !d.ok) {
    const error = (d && d.error) || refHttpErr(r.status);
    return (d && d.web) || (!d && q.web && r.status >= 500) ? { ok: false, error, web: true } : { ok: false, error };
  }
  if (mode === "ref_plan") { const pl = refPlanClean(d); return pl ? { ok: true, chapters: pl.chapters } : { ok: false, error: "Ассистент не нашёл в документе глав. Попробуй ещё раз." }; }
  if (mode === "ref_check") { const c = refCheckClean(d); return c ? { ok: true, ...c, sources: refSources(d.sources), searched: Number(d.searched) || 0 } : { ok: false, error: "Ассистент ответил пусто. Попробуй ещё раз." }; }
  const fresh = REF_NEW_MODES.includes(mode);
  const kept = keepRefMarks(fresh ? "" : src, d.content);
  if (!kept.text) return { ok: false, error: "Ассистент ответил пусто. Попробуй ещё раз." };
  const out = { ok: true, content: kept.text, lost: (Number(d.lost) || 0) + kept.lost };
  if (fresh) out.title = String(d.title || "").trim();
  if (Array.isArray(d.sources)) { out.sources = refSources(d.sources); out.searched = Number(d.searched) || 0; }
  return out;
}

const signs = (n) => { const a = n % 10, b = n % 100; return n.toLocaleString("ru-RU") + " " + (a === 1 && b !== 11 ? "знак" : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? "знака" : "знаков"); };
const lostNote = (n) => (n === 1 ? "Ассистент пропустил одну картинку: она добавлена в конец текста. Поставь её на место."
  : "Ассистент пропустил картинки (" + n + "): они добавлены в конец текста. Поставь их на место.");
export const fileIc = (c) => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>);
const BUSY = { doc: "Пишу главу…", topic: "Пишу главу…", improve: "Улучшаю текст…", shorten: "Сокращаю…", check: "Проверяю в интернете. Это может занять до минуты.", amend: "Правлю по замечаниям…" };
const FIX = ["improve", "shorten", "amend"];
const FIX_MODE = { improve: "ref_improve", shorten: "ref_shorten" };
const dot = (s) => String(s || "").replace(/\s+/g, " ").trim().replace(/[.\s]+$/, "");

/** Строка ссылок: «Источники: сайт, сайт» — по одной на сайт, открываются браузером (как у Наставника и в меню) */
export function RefSources({ label, list, muted, gold }) {
  const one = oneSite(list);
  if (!one.length) return null;
  return (
    <div data-ra-sources={one.length} style={{ color: muted, fontSize: 12.5, lineHeight: 1.5, marginTop: 8 }}>{label}: {one.map((x, k) => (
      <React.Fragment key={k}>{k ? ", " : ""}<button type="button" data-ra-src={x.url} title={x.title || x.url} onClick={() => openOut(x.url)}
        style={{ background: "none", border: "none", padding: 0, color: gold, font: "inherit", textDecoration: "underline", textUnderlineOffset: 2, cursor: "pointer" }}>{siteOf(x.url)}</button></React.Fragment>))}</div>
  );
}

/**
 * Блок «Ассистент» под текстом главы. title, body — что сейчас в редакторе; getSel() → [начало, конец] выделения в поле
 * текста; onTake({ title?, body }) — владелец взял ответ; ui — краски и стили редактора (поле, главная кнопка, стекло).
 */
export function RefAssist({ T, a11y, title, body, getSel, onTake, ui }) {
  const { input, primary, G, txt, muted, gold, brd, TN } = ui;
  const dark = !a11y;
  // stage — «Глава по теме»: "web" (с поиском) или "plain" (поиск не ответил, пишем без него); check — ответ проверки фактов, on — отмеченные замечания
  const [ai, setAi] = React.useState({ mode: null, busy: false, stage: "", err: "", topic: "", notes: "", material: "", pdf: null, result: null, frag: null, check: null, on: [] });
  const [undo, setUndo] = React.useState(null);   // { title, body, pics } — что было до ответа ассистента; pics — сколько картинок перенесено в конец
  const alive = React.useRef(true);
  // в режиме разработки React снимает и ставит блок дважды (StrictMode): после второй постановки он снова жив
  React.useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const hasText = String(body || "").trim().length >= REF_AI_LIMITS.min;
  const close = () => setAi((a) => ({ ...a, mode: null, busy: false, stage: "", err: "", result: null, frag: null, check: null, on: [] }));
  const open = (mode) => setAi((a) => ({ ...a, mode, busy: false, stage: "", err: "", result: null, frag: null, check: null, on: [], topic: mode === "topic" && !a.topic ? String(title || "").trim() : a.topic }));
  const fail = (mode, err) => { vibrate("error"); setAi((a) => ({ ...a, mode, busy: false, stage: "", err, result: null })); };

  const write = async (mode) => {   // глава из материала или по теме
    const topic = (mode === "topic" ? ai.topic : String(title || "")).trim(), text = (mode === "topic" ? ai.notes : ai.material).trim(), pdf = mode === "doc" && ai.pdf ? ai.pdf.b64 : "";
    const miss = refAiCheck("ref_chapter", { topic: mode === "topic" ? topic : "", text, hasPdf: !!pdf });
    if (miss) { fail(mode, text.length > REF_AI_LIMITS.material ? miss : mode === "topic" ? "Напиши тему главы." : "Вставь текст или прикрепи PDF."); return; }
    const web = mode === "topic";   // v169: по теме — с поиском в интернете
    setAi((a) => ({ ...a, mode, busy: true, stage: web ? "web" : "", err: "", result: null, frag: null, check: null }));
    let r = await refAiCall("ref_chapter", { topic, text, pdfBase64: pdf, web });
    if (!alive.current) return;
    if (!r.ok && r.web && web) {   // поиск не ответил: та же глава без него, причина — под ответом
      const why = r.error;
      setAi((a) => ({ ...a, stage: "plain" }));
      r = await refAiCall("ref_chapter", { topic, text });
      if (!alive.current) return;
      if (r.ok) r = { ...r, noWeb: dot(why).slice(0, 140) };
    }
    if (!r.ok) { fail(mode, r.error); return; }
    vibrate("success");
    setAi((a) => ({ ...a, mode, busy: false, stage: "", err: "", result: r, frag: null }));
  };
  const fix = async (mode, whole = false) => {   // улучшить или сократить: вся глава или выделенный кусок (whole — выделение не в счёт)
    const [s, e] = whole ? [0, 0] : getSel();
    const frag = refFragment(body, s, e);
    const miss = refAiCheck(FIX_MODE[mode], { text: frag.text });
    if (miss) { fail(mode, miss); return; }
    setAi((a) => ({ ...a, mode, busy: true, err: "", result: null, frag, check: null }));
    const r = await refAiCall(FIX_MODE[mode], { text: frag.text }, frag.text);
    if (!alive.current) return;
    if (!r.ok) { fail(mode, r.error); return; }
    vibrate("success");
    setAi((a) => ({ ...a, mode, busy: false, err: "", result: r, frag }));
  };
  // v169: проверить факты в интернете — вся глава или выделенный кусок
  const check = async () => {
    const [s, e] = getSel();
    const frag = refFragment(body, s, e);
    const miss = refAiCheck("ref_check", { text: frag.text });
    if (miss) { fail("check", miss); return; }
    setAi((a) => ({ ...a, mode: "check", busy: true, err: "", result: null, frag, check: null, on: [] }));
    const r = await refAiCall("ref_check", { text: frag.text });
    if (!alive.current) return;
    if (!r.ok) { fail("check", r.web ? "Не получилось проверить в интернете: " + dot(r.error).slice(0, 240) + ". Попробуй ещё раз." : r.error); return; }
    vibrate("success");
    setAi((a) => ({ ...a, mode: "check", busy: false, err: "", check: r, on: r.notes.map(() => true), frag }));
  };
  const picked = ai.check ? ai.check.notes.filter((_, i) => ai.on[i]) : [];
  // v169: поправить текст по отмеченным замечаниям; не вышло — замечания остаются на экране
  const amend = async () => {
    const frag = ai.frag;
    if (!ai.check || !frag) return;
    const fixes = refFixesText(picked);
    const miss = refAiCheck("ref_amend", { text: frag.text, fixes });
    if (miss) { vibrate("error"); setAi((a) => ({ ...a, err: miss })); return; }
    setAi((a) => ({ ...a, mode: "amend", busy: true, err: "", result: null }));
    const r = await refAiCall("ref_amend", { text: frag.text, fixes }, frag.text);
    if (!alive.current) return;
    if (!r.ok) { vibrate("error"); setAi((a) => ({ ...a, mode: "check", busy: false, err: r.error, result: null })); return; }
    vibrate("success");
    setAi((a) => ({ ...a, mode: "amend", busy: false, err: "", result: r }));
  };
  const pickPdf = (file) => {
    if (!file) return;
    if (file.size > REF_AI_PDF_MAX) { setAi((a) => ({ ...a, err: REF_PDF_BIG })); return; }
    const fr = new FileReader();
    fr.onload = () => setAi((a) => ({ ...a, pdf: { name: file.name, b64: String(fr.result).split(",")[1] || "" }, err: "" }));
    fr.readAsDataURL(file);
  };
  const take = (how) => {
    const r = ai.result;
    if (!r) return;
    const was = { title: String(title || ""), body: String(body || "") };
    const fixed = FIX.includes(ai.mode);
    // меняется весь текст — картинки того, что сейчас в главе, остаются в конце нового (lib/ref-ai.js, refTake)
    const t = refTake(was.body, { fixed, frag: ai.frag, content: r.content, how });
    if (!t) { fail(ai.mode === "amend" ? "check" : ai.mode, "Текст главы изменился, фрагмент не найден. Попробуй ещё раз."); return; }
    onTake(!fixed && !was.title.trim() && r.title ? { title: r.title, body: t.body } : { body: t.body });
    setUndo(was.body.trim() || was.title.trim() ? { ...was, pics: t.pics } : null);
    vibrate("light");
    setAi((a) => ({ ...a, mode: null, busy: false, stage: "", err: "", result: null, frag: null, check: null, on: [], material: "", pdf: null, notes: "" }));
  };
  // «Отмена» у правки по замечаниям возвращает к замечаниям: проверка стоила минуты, терять её незачем
  const back = () => { if (ai.mode === "amend" && ai.check) setAi((a) => ({ ...a, mode: "check", busy: false, err: "", result: null })); else close(); };

  const aiBtn = { display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36, padding: "0 12px", borderRadius: 12, cursor: "pointer", fontFamily: SERIF, fontSize: 13.5,
    background: "transparent", color: txt, border: `1px solid ${brd}` };
  const small = { ...primary, width: "auto", padding: "10px 16px", fontSize: 14 };
  const quiet = { background: "transparent", border: "none", cursor: "pointer", color: muted, fontFamily: SERIF, fontSize: 13.5, padding: "8px 6px" };
  const off = (v) => (v ? { opacity: 0.45, cursor: "default" } : null);
  const r = ai.result, isFix = FIX.includes(ai.mode), c = ai.mode === "check" && !ai.busy ? ai.check : null;
  const filled = String(body || "").trim().length > 0;
  const part = !!(ai.frag && ai.frag.part);

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
        <button type="button" data-ra-btn="check" data-lens-btn="soft" disabled={ai.busy || !hasText} onClick={check} style={{ ...aiBtn, ...off(ai.busy || !hasText) }}>Проверить факты</button>
      </div>
      {hasText && !ai.mode ? <div style={{ color: muted, fontSize: 12.5, lineHeight: 1.45, marginTop: 8 }}>Выдели несколько строк, и ассистент улучшит, сократит или проверит только их.</div> : null}

      {ai.mode === "doc" && !r ? (
        <div data-ra-form="doc" style={{ marginTop: 10 }}>
          <textarea data-ra-material="" data-lens-field="" style={{ ...input, minHeight: 110, lineHeight: 1.5 }} value={ai.material} onChange={(e) => setAi((a) => ({ ...a, material: e.target.value, err: "" }))}
            placeholder="Вставь регламент, заметки или список правил. Ассистент соберёт из них главу в стиле справочника." />
          <div style={{ color: muted, fontSize: 12.5, lineHeight: 1.45, marginTop: 6 }}>Здесь одна тема и одна глава. Большой документ на несколько глав раскладывается в разделе: «Главы из документа».</div>
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
          <div data-ra-warn="" style={{ color: muted, fontSize: 12.5, lineHeight: 1.45, marginTop: 6 }}>Ассистент поищет факты в интернете и покажет источники. Твои заметки для него важнее найденного. Проверь главу и добавь то, как принято у вас.</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <button type="button" data-ra-go="topic" data-lens-btn="main" disabled={ai.busy || ai.topic.trim().length < 3} onClick={() => write("topic")}
              style={{ ...small, ...off(ai.busy || ai.topic.trim().length < 3) }}>{ai.busy ? (ai.stage === "plain" ? "Пишу без поиска…" : "Ищу и пишу…") : "Написать главу"}</button>
            <button type="button" data-ra-cancel="" onClick={close} style={quiet}>Отмена</button>
          </div>
        </div>) : null}

      {ai.busy && (isFix || ai.mode === "check") ? <div data-ra-busy="" role="status" style={{ color: muted, fontSize: 13.5, marginTop: 10, lineHeight: 1.45 }}>{BUSY[ai.mode]}{part && ai.mode !== "amend" ? " Только выделенное." : ""}</div> : null}
      {ai.err ? <div data-ra-err="" role="status" style={{ color: TN.bad, fontSize: 13.5, marginTop: 10, lineHeight: 1.45 }}>{ai.err}</div> : null}

      {c ? (
        <div data-ra-check={c.notes.length} style={{ marginTop: 10, borderTop: `1px solid ${brd}`, paddingTop: 10 }}>
          <div style={{ color: txt, fontFamily: SERIF, fontWeight: "bold", fontSize: 15 }}>{part ? "Проверка выделенных строк" : "Проверка фактов"}</div>
          {c.summary ? <div data-ra-check-sum="" style={{ color: txt, fontSize: 13.5, lineHeight: 1.5, marginTop: 4 }}>{c.summary}</div> : null}
          {c.notes.length ? c.notes.map((n, i) => (
            <label key={i} data-ra-note={ai.on[i] ? "on" : "off"} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 10px", marginTop: 8, borderRadius: 12, border: `1px solid ${brd}`, cursor: "pointer" }}>
              <input type="checkbox" checked={!!ai.on[i]} onChange={() => setAi((a) => ({ ...a, err: "", on: a.on.map((v, k) => (k === i ? !v : v)) }))} style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0, accentColor: gold }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                {n.quote ? <span style={{ display: "block", color: muted, fontSize: 12.5, lineHeight: 1.45, fontStyle: "italic" }}>«{n.quote}»</span> : null}
                <span style={{ display: "block", color: txt, fontSize: 13.5, lineHeight: 1.5 }}>{n.note}</span>
              </span>
            </label>)) : <div data-ra-check-none="" style={{ color: TN.good, fontSize: 13.5, lineHeight: 1.5, marginTop: 6 }}>Расхождений с источниками ассистент не нашёл.</div>}
          <RefSources label="Источники" list={c.sources} muted={muted} gold={gold} />
          {!c.sources.length ? <div data-ra-nosrc="" style={{ color: TN.mid, fontSize: 12.5, lineHeight: 1.45, marginTop: 8 }}>Ссылок ассистент не дал: считай это подсказкой, а не проверкой.</div> : null}
          <div style={{ color: muted, fontSize: 12.5, lineHeight: 1.45, marginTop: 8 }}>Правила вашего ресторана ассистент не оценивает. Замечания сверь по ссылкам: решение за тобой.</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {c.notes.length ? <button type="button" data-ra-amend="" data-lens-btn="main" disabled={!picked.length} onClick={amend} style={{ ...small, ...off(!picked.length) }}>Поправить отмеченное</button> : null}
            <button type="button" data-ra-cancel="" onClick={close} style={quiet}>Закрыть</button>
          </div>
        </div>) : null}

      {r ? (
        <div data-ra-result={ai.mode} style={{ marginTop: 10, borderTop: `1px solid ${brd}`, paddingTop: 10 }}>
          {!isFix && r.title ? <div data-ra-title="" style={{ color: txt, fontFamily: SERIF, fontWeight: "bold", fontSize: 16, marginBottom: 6 }}>{r.title}</div> : null}
          {isFix ? <div data-ra-stat="" style={{ color: muted, fontSize: 12.5, marginBottom: 6 }}>{part ? "Выделенный фрагмент. " : ""}Было {signs(ai.frag ? ai.frag.text.length : 0)}, стало {signs(r.content.length)}.</div> : null}
          <div data-ra-preview="" style={{ maxHeight: 300, boxSizing: "border-box", overflowY: "auto", padding: "10px 12px", borderRadius: 14, border: `1px solid ${brd}`, background: dark ? "rgba(20,14,6,0.4)" : "rgba(255,252,245,0.6)" }}>
            <RefContent text={r.content} T={T} gold={gold} dark={dark} notes />
          </div>
          {r.lost > 0 ? <div data-ra-lost="" style={{ color: TN.mid, fontSize: 12.5, lineHeight: 1.45, marginTop: 8 }}>{lostNote(r.lost)}</div> : null}
          {!isFix && r.sources ? <RefSources label="Источники" list={r.sources} muted={muted} gold={gold} /> : null}
          {!isFix && r.noWeb ? <div data-ra-noweb="" style={{ color: TN.mid, fontSize: 12.5, lineHeight: 1.45, marginTop: 8 }}>Без интернета: поиск сейчас не ответил ({r.noWeb}).</div> : null}
          {!isFix ? <div style={{ color: muted, fontSize: 12.5, lineHeight: 1.45, marginTop: 8 }}>Это черновик. Проверь факты перед записью.</div> : null}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {isFix
              ? <button type="button" data-ra-take="replace" data-lens-btn="main" onClick={() => take("replace")} style={small}>{part ? "Заменить фрагмент" : "Заменить текст"}</button>
              : <button type="button" data-ra-take="replace" data-lens-btn="main" onClick={() => take("replace")} style={small}>{filled ? "Заменить текст" : "Взять в главу"}</button>}
            {!isFix && filled ? <button type="button" data-ra-take="append" data-lens-btn="soft" onClick={() => take("append")} style={{ ...aiBtn, minHeight: 40 }}>Добавить в конец</button> : null}
            {/* выделение могло остаться от кнопок оформления: одной кнопкой — то же самое для всей главы */}
            {isFix && ai.mode !== "amend" && part && String(body || "").length <= REF_AI_LIMITS.text
              ? <button type="button" data-ra-whole="" data-lens-btn="soft" onClick={() => fix(ai.mode, true)} style={{ ...aiBtn, minHeight: 40 }}>Нужна вся глава</button> : null}
            <button type="button" data-ra-cancel="" onClick={back} style={quiet}>{ai.mode === "amend" ? "К замечаниям" : "Отмена"}</button>
          </div>
        </div>) : null}

      {undo && !r && !c && !ai.busy ? (
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
