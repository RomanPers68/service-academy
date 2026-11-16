// ui/ref-split.jsx — v169 (Доп. 494): «Главы из документа» в редакторе справочника.
//
// Владелец (16.11), на предложение научить ассистента раскладывать большой документ сразу на несколько глав:
// «Да, давай научим». Как это устроено:
//   1. В разделе редактора владелец вставляет документ целиком или прикрепляет PDF.
//   2. Ассистент читает его и предлагает главы: одна тема, одна глава (сервер: режим ref_plan). Список виден до того,
//      как начнётся работа: лишнее снимается галочкой, названия правятся. Глава, которая в разделе уже есть, приходит
//      без галочки.
//   3. Главы пишутся по одной (ref_part): так каждая умещается в один ответ модели, а неудача одной не губит остальные.
//      Готовая глава сразу ложится в раздел скрытой: команда её не видит, пока владелец не проверит и не покажет.
//      Поэтому ничего не теряется, если телефон уснул или приложение закрыли: написанное уже на сервере.
// Работа живёт на уровне экрана редактора (хук useRefSplit): можно открыть готовую главу, пока пишутся остальные.
// Две неудачи подряд — работа останавливается (ассистент не отвечает, незачем тратить обращения); «Дописать остальные»
// продолжает с того же места, пока редактор открыт.
import React from "react";
import { labelStyle } from "./tokens";
import { UI_SVG } from "./icons";
import { vibrate } from "../lib/utils";
import { REF_AI_LIMITS, refAiCheck, refPlanRows } from "../lib/ref-ai";
import { refAiCall, REF_AI_PDF_MAX, REF_PDF_BIG, fileIc } from "./ref-assist";
import { counted } from "../lib/ru-num";

const SERIF = "Georgia, 'Times New Roman', serif";
/** Столько неудач подряд — и работа останавливается сама */
export const SPLIT_STOP_AFTER = 2;

/** Сколько глав отмечено, сколько из них уже в разделе и сколько осталось написать */
export const splitCount = (rows) => {
  const on = (Array.isArray(rows) ? rows : []).filter((r) => r.on), done = on.filter((r) => r.state === "done").length;
  return { on: on.length, done, left: on.length - done };
};

/**
 * Работа «Главы из документа» — без React: состояние и шаги (так её проверяют тесты). save({ title, content, after,
 * before }, secId) → Promise<{ ok, id?, error? }> — записать главу в раздел (after и before — номера глав, после или
 * перед которой ей встать); emit(st) зовётся при каждой перемене.
 * st — null (закрыто) или { sec, secTitle, phase: form | planning | plan | writing | done, text, pdf, err, rows, stopped, halting }.
 * Строка плана: { title, about, on, dup, state: "" | wait | busy | done | fail, err, content (написана, но не записана), id }.
 */
export function makeSplitJob(save, emit = () => {}) {
  let cur = null, alive = true, stop = false, saver = save;
  const set = (f) => { cur = typeof f === "function" ? f(cur) : f; if (alive) emit(cur); };
  const row = (i, f) => set((s) => (s ? { ...s, rows: s.rows.map((r, k) => (k === i ? { ...r, ...(typeof f === "function" ? f(r) : f) } : r)) } : s));
  const patch = (f) => set((s) => (s ? { ...s, ...f } : s));

  const open = (sec) => { stop = false; set({ sec: sec.id, secTitle: sec.title, phase: "form", text: "", pdf: null, err: "", rows: [], stopped: false, halting: false }); };
  const close = () => { stop = true; set(null); };
  const pickPdf = (file) => {
    if (!file) return;
    if (file.size > REF_AI_PDF_MAX) { patch({ err: REF_PDF_BIG }); return; }
    const fr = new FileReader();
    fr.onload = () => patch({ pdf: { name: file.name, b64: String(fr.result).split(",")[1] || "" }, err: "" });
    fr.readAsDataURL(file);
  };
  /** Шаг 1: документ → список глав. existing — названия глав, которые в разделе уже есть */
  const plan = async (existing = []) => {
    const s = cur;
    if (!s || s.phase === "planning" || s.phase === "writing") return;
    const text = s.text.trim(), pdf = s.pdf ? s.pdf.b64 : "";
    const miss = refAiCheck("ref_plan", { text, hasPdf: !!pdf });
    if (miss) { vibrate("error"); patch({ err: miss }); return; }
    patch({ phase: "planning", err: "" });
    const r = await refAiCall("ref_plan", { text, pdfBase64: pdf });
    if (!alive || !cur || cur.phase !== "planning") return;   // закрыли, пока ассистент читал
    if (!r.ok) { vibrate("error"); patch({ phase: "form", err: r.error }); return; }
    vibrate("success");
    patch({ phase: "plan", err: "", rows: refPlanRows(r.chapters, existing).map((x) => ({ ...x, state: "", err: "", content: "", id: "" })) });
  };
  /** Шаг 2: главы по одной; готовая сразу записывается. Запускается и повторно — «Дописать остальные» */
  const run = async () => {
    const s0 = cur;
    if (!s0 || s0.phase === "writing" || s0.phase === "planning") return;
    const todo = s0.rows.filter((r) => r.on && r.state !== "done");
    if (!todo.length) { vibrate("error"); patch({ err: "Отметь хотя бы одну главу." }); return; }
    if (todo.some((r) => r.title.trim().length < 3)) { vibrate("error"); patch({ err: "У главы нет названия." }); return; }
    stop = false;
    set((s) => ({ ...s, phase: "writing", err: "", stopped: false, halting: false, rows: s.rows.map((r) => (r.on && r.state !== "done" ? { ...r, state: "wait", err: "" } : r)) }));
    let fails = 0;
    for (;;) {
      const s = cur;
      if (!s || !alive) return;
      const i = s.rows.findIndex((r) => r.on && r.state === "wait");
      if (i < 0 || stop || fails >= SPLIT_STOP_AFTER) break;
      const it = s.rows[i];
      row(i, { state: "busy" });
      let content = it.content, err = "";
      if (!content) {   // написана раньше, но не записалась — второй раз ассистента не зовём
        const a = await refAiCall("ref_part", { topic: it.title.trim(), text: s.text.trim(), pdfBase64: s.pdf ? s.pdf.b64 : "", about: it.about,
          others: s.rows.filter((r, k) => k !== i && r.on).map((r) => r.title.trim()) });
        if (!alive || !cur) return;
        if (a.ok) content = a.content; else err = a.error;
      }
      if (content) {
        // место главы — как в документе: после ближайшей готовой главы плана, а если такой нет — перед следующей готовой
        // (так глава, дописанная со второй попытки, встаёт на своё место, а не в конец)
        const now = cur.rows, prev = now.slice(0, i).reverse().find((r) => r.state === "done" && r.id), next = now.slice(i + 1).find((r) => r.state === "done" && r.id);
        const w = await saver({ title: it.title.trim(), content, after: prev ? prev.id : "", before: next ? next.id : "" }, s.sec);
        if (!alive || !cur) return;
        if (w && w.ok) { row(i, { state: "done", content: "", err: "", id: w.id || "" }); fails = 0; continue; }
        row(i, { state: "fail", content, err: (w && w.error) || "Не записалось. Попробуй ещё раз." });
      } else row(i, { state: "fail", err: err || "Ассистент не ответил. Попробуй ещё раз." });
      fails++;
    }
    const auto = fails >= SPLIT_STOP_AFTER;
    set((s) => (s ? { ...s, phase: "done", halting: false, stopped: auto ? "fail" : stop ? "user" : false, rows: s.rows.map((r) => (r.state === "wait" ? { ...r, state: "" } : r)) } : s));
    vibrate(cur && splitCount(cur.rows).left ? "error" : "success");
  };
  /** «Остановить»: текущая глава дописывается и записывается, следующие не начинаются */
  const halt = () => { stop = true; patch({ halting: true }); };
  return { get st() { return cur; }, open, close, patch, pickPdf, plan, setRow: row, run, halt,
    setSave: (f) => { saver = f; }, dispose: () => { alive = false; }, revive: () => { alive = true; } };
}

/**
 * Та же работа для экрана редактора: живёт, пока он открыт (владелец может открыть готовую главу, пока пишутся
 * остальные). → { st, open, close, patch, pickPdf, plan, setRow, run, halt }
 */
export function useRefSplit(save) {
  const [st, setSt] = React.useState(null);
  const job = React.useRef(null);
  if (!job.current) job.current = makeSplitJob(save, setSt);
  job.current.setSave(save);
  React.useEffect(() => { const j = job.current; j.revive(); return () => j.dispose(); }, []);
  const j = job.current;
  return { st, open: j.open, close: j.close, patch: j.patch, pickPdf: j.pickPdf, plan: j.plan, setRow: j.setRow, run: j.run, halt: j.halt };
}

/**
 * Блок «Главы из документа» в экране раздела. job — то, что вернул useRefSplit; sec — раздел на экране; ui — краски и
 * стили редактора.
 */
export function RefSplit({ a11y, job, sec, ui }) {
  const { input, primary, G, txt, muted, gold, brd, TN } = ui;
  const { st, open, close, patch, pickPdf, plan, setRow, run, halt } = job;
  const aiBtn = { display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36, padding: "0 12px", borderRadius: 12, cursor: "pointer", fontFamily: SERIF, fontSize: 13.5,
    background: "transparent", color: txt, border: `1px solid ${brd}` };
  const small = { ...primary, width: "auto", padding: "10px 16px", fontSize: 14 };
  const quiet = { background: "transparent", border: "none", cursor: "pointer", color: muted, fontFamily: SERIF, fontSize: 13.5, padding: "8px 6px" };
  const off = (v) => (v ? { opacity: 0.45, cursor: "default" } : null);
  const hint = { color: muted, fontSize: 12.5, lineHeight: 1.45 };

  // работа идёт в другом разделе: здесь её не начать, пока та не закончится
  if (st && st.sec !== sec.id && (st.phase === "writing" || st.phase === "planning")) {
    return <div data-rs-away="" style={{ ...hint, margin: "12px 2px 0" }}>Ассистент сейчас раскладывает документ в разделе «{st.secTitle}». Когда закончит, можно будет и здесь.</div>;
  }
  if (!st || st.sec !== sec.id) {
    return (
      <div style={{ marginTop: 10 }}>
        <button type="button" data-rs-open="" data-lens-btn="soft" onClick={() => open(sec)} style={{ ...aiBtn, width: "100%", justifyContent: "center", minHeight: 46, fontSize: 14.5 }}>{UI_SVG.ai(gold, 17)}Главы из документа</button>
        <div style={{ ...hint, margin: "6px 2px 0", textAlign: "center" }}>Большой регламент ассистент разложит на несколько глав.</div>
      </div>
    );
  }

  const n = splitCount(st.rows), busy = st.phase === "planning" || st.phase === "writing";
  const at = st.rows.filter((r) => r.on).findIndex((r) => r.state === "busy");   // какая по счёту из отмеченных пишется
  const long = st.text.length > REF_AI_LIMITS.doc;
  const chip = (text, c) => <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11.5, lineHeight: 1.5, color: c, border: `1px solid ${c}77`, whiteSpace: "nowrap" }}>{text}</span>;
  const stateChip = (r) => (r.state === "done" ? chip("в разделе, скрыта", TN.good) : r.state === "busy" ? chip("пишется", gold) : r.state === "wait" ? chip("в очереди", muted)
    : r.state === "fail" ? chip(r.content ? "не записалась" : "не написана", TN.bad) : null);

  return (
    <div data-rs={st.phase} data-lens-edge="" style={G({ padding: "12px 12px", marginTop: 12 })}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {UI_SVG.ai(gold, 17)}
        <span style={{ ...labelStyle(13.5), color: gold }}>Главы из документа</span>
      </div>

      {st.phase === "form" || st.phase === "planning" ? (
        <div data-rs-form="">
          <div style={{ ...hint, margin: "4px 0 10px" }}>Вставь документ целиком или прикрепи PDF. Ассистент предложит главы: одна тема, одна глава. Список можно поправить до того, как он начнёт писать.</div>
          <textarea data-rs-text="" data-lens-field="" disabled={busy} style={{ ...input, minHeight: 130, lineHeight: 1.5 }} value={st.text} onChange={(e) => patch({ text: e.target.value, err: "" })}
            placeholder="Регламент, стандарт или инструкция целиком" />
          <div data-rs-size="" style={{ ...hint, color: long ? TN.bad : muted, marginTop: 6 }}>{long ? "В тексте " + st.text.length.toLocaleString("ru-RU") + " знаков, а влезает 60 000. Дай документ частями." : "Текст до 60 000 знаков, PDF до 3 МБ."}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <label data-rs-pdf="" style={{ ...aiBtn, ...off(busy) }}>{fileIc(gold)}{st.pdf ? st.pdf.name.slice(0, 24) : "Прикрепить PDF"}
              <input type="file" accept="application/pdf" disabled={busy} style={{ display: "none" }} onChange={(e) => { pickPdf(e.target.files && e.target.files[0]); e.target.value = ""; }} /></label>
            <button type="button" data-rs-plan="" data-lens-btn="main" disabled={busy || long || (!st.text.trim() && !st.pdf)} onClick={() => plan(sec.lessons.map((l) => l.title))}
              style={{ ...small, ...off(busy || long || (!st.text.trim() && !st.pdf)) }}>{st.phase === "planning" ? "Читаю документ…" : "Предложить главы"}</button>
            <button type="button" data-rs-cancel="" onClick={close} style={quiet}>Отмена</button>
          </div>
        </div>) : null}

      {st.phase === "plan" ? (
        <div data-rs-plan-list={st.rows.length}>
          <div style={{ ...hint, margin: "4px 0 2px" }}>{st.rows.length === 1 ? "Документ про одну тему: выйдет одна глава. Название можно поправить." : "Ассистент предлагает такие главы. Сними галочку с лишних и поправь названия."}</div>
          {st.rows.map((r, i) => (
            <div key={i} data-rs-row={i} data-rs-on={r.on ? "1" : "0"} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 10px", marginTop: 8, borderRadius: 12, border: `1px solid ${brd}`, opacity: r.on ? 1 : 0.6 }}>
              <input type="checkbox" data-rs-tick="" aria-label={"Писать главу: " + r.title} checked={!!r.on} onChange={() => { setRow(i, (x) => ({ on: !x.on })); patch({ err: "" }); }} style={{ marginTop: 11, width: 18, height: 18, flexShrink: 0, accentColor: gold }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <input data-rs-title="" data-lens-field="" aria-label="Название главы" style={{ ...input, padding: "9px 12px" }} value={r.title} maxLength={REF_AI_LIMITS.topic} onChange={(e) => { setRow(i, { title: e.target.value }); patch({ err: "" }); }} />
                {r.about ? <div data-rs-about="" style={{ ...hint, marginTop: 5 }}>{r.about}</div> : null}
                {r.dup ? <div style={{ marginTop: 5 }}>{chip("такая глава уже есть в разделе", TN.mid)}</div> : null}
              </div>
            </div>))}
          <div style={{ ...hint, marginTop: 10 }}>Главы пишутся по одной и сразу ложатся в раздел скрытыми: команда их не увидит, пока ты не проверишь и не покажешь.</div>
          {st.pdf ? <div data-rs-pdf-note="" style={{ ...hint, marginTop: 6 }}>PDF уходит ассистенту заново с каждой главой. На мобильном интернете лучше подключиться к Wi-Fi.</div> : null}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button type="button" data-rs-run="" data-lens-btn="main" disabled={!n.on} onClick={run} style={{ ...small, ...off(!n.on) }}>{n.on === 1 ? "Написать главу" : "Написать главы (" + n.on + ")"}</button>
            <button type="button" data-rs-cancel="" onClick={close} style={quiet}>Отмена</button>
          </div>
        </div>) : null}

      {st.phase === "writing" || st.phase === "done" ? (
        <div data-rs-work="">
          {st.phase === "writing"
            ? <div data-rs-progress="" role="status" style={{ color: txt, fontSize: 14, lineHeight: 1.45, margin: "6px 0 2px" }}>{at >= 0 ? "Пишу главу " + (at + 1) + " из " + n.on + "…" : "Готовлюсь…"}{st.halting ? " Допишу её и остановлюсь." : ""}</div>
            : <div data-rs-done={n.left ? "part" : "all"} role="status" style={{ color: n.left ? txt : TN.good, fontSize: 14, lineHeight: 1.45, margin: "6px 0 2px" }}>
              {!n.done ? "Пока ни одна глава не написана." : n.left ? "В разделе " + counted(n.done, "новая глава", "новые главы", "новых глав") + " из " + n.on + "." : n.done === 1 ? "Готово: глава в разделе." : "Готово: в разделе " + counted(n.done, "новая глава", "новые главы", "новых глав") + "."}
              {st.stopped === "fail" ? " Ассистент не отвечает: остановился после двух неудач подряд." : st.stopped === "user" && n.left ? " Остановлено." : ""}</div>}
          {st.rows.filter((r) => r.on).map((r, i) => (
            <div key={i} data-rs-item={r.state || "none"} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 10px", marginTop: 8, borderRadius: 12, border: `1px solid ${brd}` }}>
              <span aria-hidden="true" style={{ width: 20, textAlign: "center", color: muted, fontFamily: SERIF, fontSize: 14, flexShrink: 0, lineHeight: 1.5 }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: txt, fontFamily: SERIF, fontSize: 14.5, lineHeight: 1.35 }}>{r.title}</div>
                <div style={{ marginTop: 4 }}>{stateChip(r) || chip("не начата", muted)}</div>
                {r.state === "fail" && r.err ? <div data-rs-item-err="" style={{ color: TN.bad, fontSize: 12.5, lineHeight: 1.45, marginTop: 4 }}>{r.err}</div> : null}
              </div>
            </div>))}
          {n.done ? <div style={{ ...hint, marginTop: 10 }}>Новые главы скрыты: команда их не видит. Открой каждую, проверь и нажми в ней «Показать главу».</div> : null}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {st.phase === "writing" ? <button type="button" data-rs-stop="" data-lens-btn="soft" disabled={st.halting} onClick={halt} style={{ ...aiBtn, minHeight: 40, ...off(st.halting) }}>Остановить</button> : null}
            {st.phase === "done" && n.left ? <button type="button" data-rs-more="" data-lens-btn="main" onClick={run} style={small}>{"Дописать остальные (" + n.left + ")"}</button> : null}
            {st.phase === "done" ? <button type="button" data-rs-close="" data-lens-btn={n.left ? "soft" : "main"} onClick={close} style={n.left ? { ...aiBtn, minHeight: 40 } : small}>Готово</button> : null}
          </div>
        </div>) : null}

      {st.err ? <div data-rs-err="" role="status" style={{ color: TN.bad, fontSize: 13.5, lineHeight: 1.45, marginTop: 10 }}>{st.err}</div> : null}
    </div>
  );
}
