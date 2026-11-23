// ui/concept-import.jsx — v191 (Доп. 516): «О нас» → «Из документа» и «Оформить как в уроках».
//
// Владелец (21.11): «давай сделаем удобнее добавление концепции и стандарты»; «что бы он красиво составлял текст, по
// типу того, что у нас уже собранно в уроках. А то выглядит инородно. В общем и целом улучшение редактора концепции».
//   • «Из документа»: текст, PDF или Word (.docx — читается на телефоне, lib/docx-text.js), «Куда» — вся сеть или
//     заведение, «Вопросы для теста» (по 2 на блок). Помощник сначала составляет план, потом пишет каждый блок в виде
//     уроков (по два сразу, строки «готово» видно), в конце — каждый блок «как в уроке» перед сохранением: выбрать,
//     поправить заголовок, заменить такой же блок или добавить ещё один (lib/concept-ai.js).
//   • «Оформить как в уроках»: уже сохранённые блоки части — помощник переписывает в виде уроков, смысл и факты те же;
//     «Было / Стало» перед сохранением; помощник не ответил — только разметка (lib/lesson-look.js).
// Вид «Линза» (метки data-lens-*), как у остального редактора.
// v192 (Доп. 517): владелец про семь идей для «О нас»: «Делаем все 7». Картинки из Word: на их месте в тексте — «[фото N]»
// (lib/docx-text.js), помощник в плане говорит, к какому блоку какая (иначе — по меткам в выдержке блока); в просмотре у
// блока — его фото (убрать или отдать другому блоку), фото без блока — отдельной строкой; при сохранении фото сжимаются,
// как снятые телефоном, и встают в блок.
import React from "react";
import { rpc, saToken } from "../api/supabase";
import { vibrate } from "../lib/utils";
import { GOLD } from "./tokens";
import { Sign } from "./signs";
import { kindOf, blankBlock, blockPayload, conceptErr } from "../lib/concept";
import { askAI, runPool, planJobs, replaceTarget, docBlockPayload, assignPhotos, stripPhotoMarks } from "../lib/concept-ai";
import { lessonize } from "../lib/lesson-look";
import { docxDoc, docErr } from "../lib/docx-text";
import { compressPhoto } from "../lib/chat-photo";
import { conceptPhotoRemember } from "./concept-photo";
import { LessonLook } from "./lesson-look";

const SERIF = "Georgia, 'Times New Roman', serif";
const TITLE = "'Piazzolla', Georgia, serif";
const DOC_MAX = 30000;   // столько знаков текста читает помощник (api/lesson-assist.js)

// значок вида блока (ui/signs.jsx)
export const KIND_SIGN = { idea: "book", values: "heart", structure: "crown", guest: "door", kitchen: "dish", mood: "candle", pitch: "speech",
  dress: "starLine", setting: "cloche", check: "target", day: "stopwatch", numbers: "chart", own: "pencil" };
export const KindIcon = ({ kind, s = 18, c = GOLD }) => <span aria-hidden="true" data-cn-icon={kind} style={{ display: "inline-flex", color: c, flexShrink: 0 }}><Sign n={KIND_SIGN[kind] || "pencil"} s={s} c={c} /></span>;

const plural = (n, a, b, c) => (n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c);
const STATUS = { wait: "жду очереди", work: "пишу…", ok: "готово", fail: "не вышло" };

/** Сегменты-капсула «Вся сеть / заведение», «Было / Стало», «Текст / Как в уроке». */
export function Seg({ items, value, onPick, c, label, mark, wrap = false }) {   // wrap — подписи в две строки (узкий экран, три пункта)
  return (
    <div role="tablist" aria-label={label} data-lens-seg="" {...(mark ? { [mark]: value } : {})} style={{ display: "flex", gap: 2, padding: 3, borderRadius: 999, border: "1px solid " + c.line, background: c.chip }}>
      {items.map(([k, t]) => {
        const on = k === value;
        return <button key={k} type="button" role="tab" aria-selected={on} data-seg={k} data-lens-btn={on ? "tab" : undefined} onClick={() => { if (!on) { vibrate("light"); onPick(k); } }}
          style={{ flex: 1, minWidth: 0, padding: wrap ? "6px 6px" : "7px 10px", borderRadius: wrap ? 18 : 999, border: "none", cursor: "pointer", fontFamily: SERIF, fontSize: wrap ? 12.5 : 13,
            lineHeight: 1.25, whiteSpace: wrap ? "normal" : "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            background: on ? "linear-gradient(180deg,#E4C88C," + GOLD + ")" : "transparent", color: on ? "#1A1008" : c.soft, fontWeight: on ? "bold" : "normal" }}>{t}</button>;
      })}
    </div>);
}

// ── «Из документа» ────────────────────────────────────────────────────────────────────────────────
export function ConceptImport({ T, a11y, c, ghost, main, field, data, scope, venueName, onDone, onCancel }) {
  const can = data.can;
  const [target, setTarget] = React.useState(scope === "venue" && can.venue ? "venue" : can.net ? "net" : "venue");
  const [step, setStep] = React.useState("src");   // src | plan | write | review | save
  const [text, setText] = React.useState("");
  const [pdf, setPdf] = React.useState(null);      // { name, b64 }
  const [note, setNote] = React.useState("");
  const [wantQ, setWantQ] = React.useState(true);
  const [err, setErr] = React.useState("");
  const [jobs, setJobs] = React.useState([]);
  const [open, setOpen] = React.useState({});      // какие блоки раскрыты «как в уроке»
  const [pics, setPics] = React.useState([]);      // v192: картинки из Word: { n, name, mime, bytes, cap, url }
  const [spare, setSpare] = React.useState([]);    // v192: номера картинок без блока
  const [saveNote, setSaveNote] = React.useState("");
  const jobsRef = React.useRef([]);
  const stopRef = React.useRef(false);
  const picsRef = React.useRef([]);
  picsRef.current = pics;
  React.useEffect(() => () => { stopRef.current = true; picsRef.current.forEach((p) => { try { URL.revokeObjectURL(p.url); } catch (e) { /* */ } }); }, []);
  const setPictures = (list) => {
    picsRef.current.forEach((p) => { try { URL.revokeObjectURL(p.url); } catch (e) { /* */ } });
    setPics(list.map((p) => ({ ...p, url: URL.createObjectURL(new Blob([p.bytes], { type: p.mime })) })));
  };
  const where = target === "net" ? "Вся сеть" : venueName;
  const existing = target === "net" ? data.net.blocks : (data.venue ? data.venue.blocks : []);
  const upd = (i, p) => { jobsRef.current = jobsRef.current.map((j, k) => (k === i ? { ...j, ...p } : j)); setJobs(jobsRef.current); };

  const pickFile = async (file) => {
    if (!file) return;
    setErr(""); setNote("");
    const name = file.name || "";
    if (/\.pdf$/i.test(name) || file.type === "application/pdf") {
      // хостинг принимает запрос до 4,5 МБ, а PDF в запросе на треть тяжелее файла (как в v169)
      if (file.size > 3 * 1024 * 1024) { setErr("PDF больше 3 МБ: сервер такой не примет. Сожми файл, сохрани в Word или вставь текст."); return; }
      const fr = new FileReader();
      fr.onload = () => { setPdf({ name, b64: String(fr.result).split(",")[1] }); setPictures([]); setNote("PDF «" + name + "» прикреплён: помощник прочитает его сам."); };
      fr.readAsDataURL(file);
      return;
    }
    if (/\.docx$/i.test(name) || /wordprocessingml/.test(file.type || "")) {
      try {
        const d = await docxDoc(await file.arrayBuffer());   // v192: и картинки
        if (!d.text.trim()) { setErr("В документе не нашлось текста."); return; }
        setPdf(null); setText(d.text.slice(0, DOC_MAX + 2000)); setPictures(d.images);
        setNote("Текст из «" + name + "» в поле выше" + (d.images.length ? ", и фото: " + d.images.length
          + ". Строки «[фото 1]» показывают, где они стояли. Помощник подскажет, к какому блоку какое." : ": можно поправить, потом «Разобрать»."));
      } catch (e) { setErr(docErr(e)); }
      return;
    }
    if (/\.(txt|md)$/i.test(name) || /^text\//.test(file.type || "")) { setPdf(null); setPictures([]); setText(String(await file.text()).slice(0, DOC_MAX + 2000)); setNote("Текст из «" + name + "» в поле выше."); return; }
    if (/\.doc$/i.test(name)) { setErr("Старый формат Word (.doc) не открыть. Сохрани документ как .docx или PDF."); return; }
    setErr("Подойдёт PDF, Word (.docx) или текст (.txt).");
  };

  const writeOne = async (j, i) => {
    upd(i, { status: "work", err: "" });
    const others = jobsRef.current.filter((_, k) => k !== i).map((x) => x.title);
    // PDF уходит помощнику один раз, на план; блок пишется по выдержке из плана (её нет — снова с PDF).
    // Текст — целиком, а выдержка блока отдельно: на чём держаться
    const usePdf = !!pdf && !j.src;
    const r = await askAI("concept_block", { where, kind: j.kind, title: j.title, about: j.about, others, qn: wantQ ? 2 : 0,
      text: pdf ? j.src : text.slice(0, DOC_MAX), src: pdf ? "" : j.src, pdfBase64: usePdf ? pdf.b64 : "" });
    if (stopRef.current) return;
    if (!r.ok) { upd(i, { status: "fail", err: r.error }); return; }
    upd(i, { status: "ok", body: lessonize(stripPhotoMarks(r.body || "")), questions: Array.isArray(r.questions) ? r.questions : [], title: (r.title || "").trim() || j.title });
  };
  const run = async () => {
    if (step !== "src") return;
    vibrate("light"); setErr(""); setStep("plan");
    const r = await askAI("concept_plan", { title: where, text: text.slice(0, DOC_MAX), pdfBase64: pdf ? pdf.b64 : "" });
    if (stopRef.current) return;
    if (!r.ok) { setStep("src"); setErr(r.error); return; }
    const js0 = planJobs(r.blocks);
    if (!js0.length) { setStep("src"); setErr("В документе не нашлось ничего для блоков. Попробуй другой текст."); return; }
    // v192: картинки из Word — по блокам: что предложил помощник, иначе по меткам в выдержке
    const live = pics.map((p) => p.n).filter((n) => text.includes("[фото " + n + "]"));
    const ap = assignPhotos(js0, live);
    const js = ap.jobs;
    setSpare(ap.spare);
    jobsRef.current = js.map((j) => ({ ...j, status: "wait", body: "", questions: [], pick: true, mode: replaceTarget(existing, j.kind, j.title) ? "replace" : "add" }));
    setJobs(jobsRef.current); setStep("write");
    await runPool(jobsRef.current, 2, writeOne, () => stopRef.current);
    if (!stopRef.current) setStep("review");
  };
  const retry = async (i) => { vibrate("light"); await writeOne(jobsRef.current[i], i); };

  const save = async () => {
    const list = jobs.map((j, i) => ({ j, i })).filter(({ j }) => j.status === "ok" && j.pick);
    if (!list.length || step === "save") return;
    vibrate("light"); setStep("save"); setErr("");
    const sc = target === "net" ? "" : venueName;
    let added = 0, updated = 0, bad = "", phOk = 0, phBad = 0;
    const total = list.reduce((a, { j }) => a + (j.photos || []).length, 0);
    for (const { j } of list) {
      const t = j.mode === "replace" ? replaceTarget(existing, j.kind, j.title) : null;
      // v192: фото из Word — сжать, как снятые телефоном, и положить в базу этого заведения (или сети)
      const up = [];
      for (const n of (j.photos || []).slice(0, Math.max(0, 8 - (t ? (t.photos || []).length : 0)))) {
        const pic = pics.find((p) => p.n === n);
        if (!pic) continue;
        setSaveNote("Фото " + (phOk + phBad + 1) + " из " + total + "…");
        try {
          const ph = await compressPhoto(new Blob([pic.bytes], { type: pic.mime }));
          const pr = await rpc("concept_photo_put", { p_token: saToken(), p_scope: sc, p_full: ph.full, p_thumb: ph.thumb, p_w: ph.w, p_h: ph.h });
          if (pr && pr.ok && pr.id) { conceptPhotoRemember(pr.id, ph.thumbUrl, ph.fullUrl); up.push({ id: pr.id, cap: pic.cap || "" }); phOk++; } else phBad++;
        } catch (e) { phBad++; }
      }
      setSaveNote("");
      const r = await rpc("concept_save", { p_token: saToken(), p_block: blockPayload(docBlockPayload(j, t, sc, blankBlock, up)) }).catch(() => null);
      if (r && r.ok) { if (t) updated++; else added++; } else bad = conceptErr(r && r.error);
    }
    const done = [added ? "добавлено " + added : "", updated ? "обновлено " + updated : ""].filter(Boolean).join(", ");
    const phLine = phOk ? " Фото из документа: " + phOk + "." : "";
    const phMiss = phBad ? " Не получилось загрузить фото: " + phBad + "." : "";
    onDone(target, done ? "Готово: " + done + " " + plural(added + updated, "блок", "блока", "блоков") + (bad ? ". Остальные: " + bad : ".") + phLine + phMiss + " Раздел в треках уже обновился." : bad || "Ничего не сохранилось.");
  };
  // v192: фото — к другому блоку или без блока
  const movePic = (n, to) => {
    vibrate("light");
    jobsRef.current = jobsRef.current.map((j, k) => ({ ...j, photos: k === to ? [...(j.photos || []).filter((x) => x !== n), n].slice(0, 8) : (j.photos || []).filter((x) => x !== n) }));
    setJobs(jobsRef.current);
    setSpare((sp) => (to < 0 ? [...new Set([...sp, n])] : sp.filter((x) => x !== n)));
  };
  const picRow = (n, i) => {
    const pic = pics.find((p) => p.n === n);
    if (!pic) return null;
    const okJobs = jobs.map((j, k) => ({ j, k })).filter(({ j }) => j.status === "ok");
    return (
      <div key={n} data-cn-docpic={n} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
        <img src={pic.url} alt={pic.cap || ""} style={{ width: 64, height: 46, objectFit: "cover", borderRadius: 8, border: "1px solid " + c.line, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: c.soft, lineHeight: 1.35 }}>{"Фото " + n}{pic.cap ? ": " + pic.cap : ""}</div>
        <select data-lens-field="" data-cn-docpicto={n} aria-label={"Куда фото " + n} value={i < 0 ? "-1" : String(i)} onChange={(e) => movePic(n, Number(e.target.value))}
          style={{ ...field, width: "auto", maxWidth: 150, padding: "5px 8px", fontSize: 12.5 }}>
          <option value="-1">Не брать</option>
          {okJobs.map(({ j, k }) => <option key={k} value={String(k)}>{j.title.slice(0, 40)}</option>)}
        </select>
      </div>);
  };

  const ok = jobs.filter((j) => j.status === "ok"), picked = ok.filter((j) => j.pick).length;
  const over = text.length > DOC_MAX;
  const sub = { fontSize: 12.5, color: c.soft, lineHeight: 1.5 };
  return (
    <div data-lens-card="" data-cn-docbox={step} style={{ ...T.modCard, display: "block", padding: "12px 14px", marginTop: 4, cursor: "default" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ flex: 1, fontFamily: TITLE, fontSize: 17.5, color: T.modTitle.color }}>Из документа</div>
        {step !== "save" ? <button type="button" data-lens-btn="soft" data-cn-doccancel="" style={{ ...ghost, padding: "4px 11px", fontSize: 12 }} onClick={() => { stopRef.current = true; onCancel(); }}>{step === "src" ? "Отмена" : "Прервать"}</button> : null}
      </div>
      {step === "src" ? <>
        <div style={{ ...sub, margin: "4px 0 10px" }}>Вставь текст или прикрепи файл: PDF, Word или текст. Помощник разложит документ по блокам и оформит каждый как наши уроки: главная мысль, части, списки, вывод. Перед сохранением покажу, как это будет выглядеть.</div>
        {can.net && can.venue ? <div style={{ marginBottom: 10 }}>
          <div style={{ ...sub, marginBottom: 5 }}>Куда</div>
          <Seg c={c} label="Куда" mark="data-cn-docwhere" value={target} onPick={setTarget} items={[["net", "Вся сеть"], ["venue", venueName || "Заведение"]]} />
        </div> : <div style={{ ...sub, marginBottom: 8 }}>Куда: {where}</div>}
        <textarea data-lens-field="" data-cn-doctext="" rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder="Концепция, ценности, стандарты, памятка новичку…" style={{ ...field, resize: "vertical", lineHeight: 1.5 }} />
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
          <label data-lens-btn="soft" data-cn-docfile="" style={{ ...ghost, display: "inline-block", cursor: "pointer" }}>{pdf ? "PDF: " + pdf.name : "Прикрепить файл"}
            <input type="file" accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" style={{ display: "none" }}
              onChange={(e) => { pickFile(e.target.files && e.target.files[0]); e.target.value = ""; }} /></label>
          {pdf ? <button type="button" data-lens-btn="soft" style={{ ...ghost, padding: "5px 11px", fontSize: 12 }} onClick={() => { setPdf(null); setNote(""); }}>Убрать PDF</button> : null}
          <span style={{ fontSize: 11.5, color: over ? c.warn : c.soft, marginLeft: "auto" }}>{text.length ? text.length.toLocaleString("ru-RU") + " зн." : ""}</span>
        </div>
        {over ? <div role="status" style={{ ...sub, color: c.warn, marginTop: 6 }}>Помощник прочитает первые 30 000 знаков. Длинный документ лучше добавить частями.</div> : null}
        {note ? <div role="status" data-cn-docnote="" style={{ ...sub, marginTop: 6 }}>{note}</div> : null}
        <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, cursor: "pointer", ...sub, color: T.modTitle.color }}>
          <input type="checkbox" data-cn-docq="" checked={wantQ} onChange={() => setWantQ((x) => !x)} style={{ accentColor: GOLD, width: 18, height: 18 }} />
          Сразу вопросы для теста, по 2 на блок</label>
        <button type="button" data-lens-btn="main" data-cn-docrun="" style={{ ...main, marginTop: 12 }} disabled={!text.trim() && !pdf} onClick={run}>Разобрать</button>
      </> : null}

      {step === "plan" ? <div role="status" data-cn-docstep="plan" style={{ ...T.para, padding: "14px 0 6px" }}>Читаю документ и составляю план блоков…</div> : null}

      {step === "write" || step === "review" || step === "save" ? <>
        <div style={{ ...sub, margin: "4px 0 6px" }}>{step === "write" ? "Пишу блоки в виде уроков: по два сразу." : ok.length ? "Получилось " + ok.length + " " + plural(ok.length, "блок", "блока", "блоков") + " для «" + where + "». Посмотри, как они будут выглядеть в уроке, и сохрани нужные." : "Не получилось ни одного блока."}</div>
        {jobs.map((j, i) => {
          const tgt = replaceTarget(existing, j.kind, j.title);
          return (
            <div key={i} data-cn-docblock={j.kind} data-cn-docstatus={j.status} style={{ borderTop: "1px solid " + c.line, padding: "10px 0" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                {step !== "write" && j.status === "ok"
                  ? <input type="checkbox" aria-label={"Сохранить «" + j.title + "»"} checked={!!j.pick} onChange={() => upd(i, { pick: !j.pick })} style={{ marginTop: 4, accentColor: GOLD, width: 18, height: 18, flexShrink: 0 }} />
                  : <span style={{ marginTop: 2 }}><KindIcon kind={j.kind} /></span>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {step !== "write" && j.status === "ok"
                    ? <input data-lens-field="" data-cn-doctitle="" value={j.title} maxLength={80} onChange={(e) => upd(i, { title: e.target.value })} style={{ ...field, padding: "7px 10px", fontWeight: "bold" }} />
                    : <div style={{ fontFamily: SERIF, fontWeight: "bold", fontSize: 14.5, color: T.modTitle.color, lineHeight: 1.35 }}>{j.title}</div>}
                  <div style={{ fontSize: 12, color: j.status === "fail" ? c.warn : c.soft, marginTop: 3, lineHeight: 1.45 }}>
                    {kindOf(j.kind).title}{j.status === "ok" ? (j.questions.length ? " · " + j.questions.length + " " + plural(j.questions.length, "вопрос", "вопроса", "вопросов") + " для теста" : "") : " · " + STATUS[j.status]}
                    {j.status === "fail" && j.err ? ": " + j.err : ""}
                  </div>
                </div>
                {j.status === "fail" && step !== "save" ? <button type="button" data-lens-btn="soft" data-cn-docretry="" style={{ ...ghost, padding: "5px 11px", fontSize: 12 }} onClick={() => retry(i)}>Повторить</button> : null}
              </div>
              {j.status === "ok" && step !== "write" ? <>
                {tgt ? <div style={{ marginTop: 8 }}><Seg c={c} label="Как сохранить" mark="data-cn-docmode" value={j.mode} onPick={(m) => upd(i, { mode: m })}
                  items={[["replace", "Заменить"], ["add", "Добавить"]]} />
                  <div style={{ fontSize: 12, color: c.soft, marginTop: 4, lineHeight: 1.45 }}>{j.mode === "replace" ? "Заменит прежний «" + tgt.title + "»: текст станет новым, фото и «для кого» останутся." : "Встанет ещё одним блоком, прежний «" + tgt.title + "» тоже останется."}</div></div> : null}
                <button type="button" className="sa-hit" data-cn-docpeek={open[i] ? "1" : "0"} aria-expanded={!!open[i]} onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
                  style={{ background: "transparent", border: 0, color: GOLD, fontFamily: SERIF, fontSize: 13, padding: "8px 0 2px", cursor: "pointer" }}>{open[i] ? "Свернуть" : "Как в уроке ›"}</button>
                {open[i] ? <div style={{ marginTop: 6 }}><LessonLook text={j.body} T={T} title={j.title} cards compact /></div> : null}
                {(j.photos || []).length ? <div data-cn-docphotos={j.photos.join(",")} style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 12, color: c.soft }}>Фото из документа: {j.photos.length}</div>
                  {j.photos.map((n) => picRow(n, i))}</div> : null}
              </> : null}
            </div>);
        })}
        {step !== "write" && ok.length && spare.length ? <div data-cn-docspare={spare.join(",")} style={{ borderTop: "1px solid " + c.line, padding: "10px 0 2px" }}>
          <div style={{ fontSize: 12.5, color: T.modTitle.color }}>Фото без блока: выбери, куда поставить</div>
          {spare.map((n) => picRow(n, -1))}</div> : null}
        {step !== "write" && ok.length ? <button type="button" data-lens-btn="main" data-cn-docadd="" style={{ ...main, marginTop: 10 }} disabled={step === "save" || !picked} onClick={save}>
          {step === "save" ? (saveNote || "Сохраняю…") : "Сохранить " + picked + " " + plural(picked, "блок", "блока", "блоков")}</button> : null}
      </> : null}
      {err ? <div role="status" data-cn-docerr="" style={{ fontSize: 12.5, color: c.warn, marginTop: 8, lineHeight: 1.5 }}>{err}</div> : null}
    </div>);
}

// ── «Оформить как в уроках»: готовые блоки части — тем же видом ─────────────────────────────────────
export function ConceptRestyle({ T, a11y, c, ghost, main, blocks, onDone, onCancel }) {
  // was — как блок выглядит в уроке сейчас (экран урока и так приводит разметку, lib/concept.js)
  const [items, setItems] = React.useState(() => blocks.map((b) => ({ b, was: lessonize(b.body || ""), status: (b.body || "").trim().length < 40 ? "skip" : "wait", body: "", pick: true, view: "new", plain: false })));
  const [saving, setSaving] = React.useState(false);
  const ref = React.useRef(items);
  const stopRef = React.useRef(false);
  const upd = (i, p) => { ref.current = ref.current.map((x, k) => (k === i ? { ...x, ...p } : x)); setItems(ref.current); };
  React.useEffect(() => {
    const todo = ref.current.map((x, i) => ({ x, i })).filter(({ x }) => x.status === "wait");
    runPool(todo, 2, async ({ x, i }) => {
      upd(i, { status: "work" });
      const r = await askAI("concept_style", { kind: x.b.kind, title: x.b.title, text: x.b.body });
      if (stopRef.current) return;
      // помощник не ответил — хотя бы разметка уроков (без него)
      if (!r.ok || !(r.body || "").trim()) upd(i, { status: "ok", body: lessonize(x.b.body), plain: true });
      else upd(i, { status: "ok", body: lessonize(r.body) });
    }, () => stopRef.current);
    return () => { stopRef.current = true; };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const working = items.some((x) => x.status === "wait" || x.status === "work");
  const changed = (x) => x.status === "ok" && !!x.body && x.body !== x.was;
  const ready = items.filter(changed);
  const picked = ready.filter((x) => x.pick).length;
  const save = async () => {
    if (saving || !picked) return;
    vibrate("light"); setSaving(true);
    let n = 0, bad = "";
    for (const x of ready.filter((y) => y.pick)) {
      const r = await rpc("concept_save", { p_token: saToken(), p_block: blockPayload({ ...x.b, body: x.body }) }).catch(() => null);
      if (r && r.ok) n++; else bad = conceptErr(r && r.error);
    }
    onDone(n ? "Оформлено как в уроках: " + n + " " + plural(n, "блок", "блока", "блоков") + (bad ? ". Остальные: " + bad : ".") : bad || "Ничего не сохранилось.");
  };
  return (
    <div data-lens-card="" data-cn-restyle={working ? "work" : "review"} style={{ ...T.modCard, display: "block", padding: "12px 14px", marginTop: 4, cursor: "default" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ flex: 1, fontFamily: TITLE, fontSize: 17.5, color: T.modTitle.color }}>Оформить как в уроках</div>
        {!saving ? <button type="button" data-lens-btn="soft" style={{ ...ghost, padding: "4px 11px", fontSize: 12 }} onClick={() => { stopRef.current = true; onCancel(); }}>Отмена</button> : null}
      </div>
      <div style={{ fontSize: 12.5, color: c.soft, lineHeight: 1.5, margin: "4px 0 6px" }}>{working ? "Помощник переписывает блоки видом уроков: главная мысль, части, списки, вывод. Смысл и факты те же." : ready.length ? "Сравни «Было» и «Стало» и сохрани нужные. Фото, вопросы и «для кого» не меняются." : "Менять нечего: блоки уже в виде уроков."}</div>
      {items.map((x, i) => (
        <div key={x.b.id} data-cn-rsblock={x.b.kind} data-cn-rsstatus={x.status} style={{ borderTop: "1px solid " + c.line, padding: "10px 0" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {changed(x) && !working
              ? <input type="checkbox" aria-label={"Заменить текст «" + x.b.title + "»"} checked={!!x.pick} onChange={() => upd(i, { pick: !x.pick })} style={{ accentColor: GOLD, width: 18, height: 18, flexShrink: 0 }} />
              : <KindIcon kind={x.b.kind} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: SERIF, fontWeight: "bold", fontSize: 14.5, color: T.modTitle.color, lineHeight: 1.35 }}>{x.b.title}</div>
              <div style={{ fontSize: 12, color: c.soft, marginTop: 2 }}>{x.status === "skip" ? "короткий, оставлю как есть" : x.status === "ok" ? (!changed(x) ? (x.plain ? "помощник не ответил, оставлю как есть" : "уже в виде уроков") : x.plain ? "помощник не ответил, поправил только разметку" : "готово") : STATUS[x.status]}</div>
            </div>
          </div>
          {changed(x) && !working ? <div style={{ marginTop: 8 }}>
            <Seg c={c} label="Было или стало" mark="data-cn-rsview" value={x.view} onPick={(v) => upd(i, { view: v })} items={[["old", "Было"], ["new", "Стало"]]} />
            <div style={{ marginTop: 8 }}><LessonLook text={x.view === "old" ? x.was : x.body} T={T} cards compact /></div>
          </div> : null}
        </div>))}
      {!working && ready.length ? <button type="button" data-lens-btn="main" data-cn-rssave="" style={{ ...main, marginTop: 10 }} disabled={saving || !picked} onClick={save}>
        {saving ? "Сохраняю…" : "Сохранить " + picked + " " + plural(picked, "блок", "блока", "блоков")}</button> : null}
    </div>);
}
