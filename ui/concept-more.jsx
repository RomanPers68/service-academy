// ui/concept-more.jsx — v192 (Доп. 517): «О нас» — обложка, «Что изменилось», «Ознакомлен(а)», лист ознакомления,
// история блока и удалённые блоки.
//
// Владелец (23.11), про семь идей для «О нас»: «Ты правильно понял. Делаем все 7».
//   • Обложка (ConceptCover): название раздела, заведение, фото зала (атмосфера, концепция, кухня), где ты сейчас
//     («Ознакомлен(а) 21 ноября» или «Изменилось: 3»), оглавление: касание — к блоку.
//   • «Что изменилось» (ChangesCard, DiffView): что поменяли после твоей отметки — блок изменён (что именно: добавленные
//     слова подчёркнуты зелёным, убранные зачёркнуты), новый, убран (этап 58, concept_get → changes).
//   • «Ознакомлен(а)» (AckCard) — отметка внизу «О нас»; дата видна руководителю в листе ознакомления.
//   • Руководителю: лист ознакомления (AcksPanel: у каждого дата или «ещё нет», PDF для отдела кадров, раздел целиком в PDF),
//     история блока с «Вернуть» (HistoryPanel), удалённые блоки с «Вернуть» (GonePanel).
// Вид «Линза» (метки data-lens-*), как у остального «О нас».
import React from "react";
import { rpc, saToken, rpcMissing } from "../api/supabase";
import { vibrate } from "../lib/utils";
import { GOLD, GREEN, RED } from "./tokens";
import { UI_SVG } from "./icons";
import { conceptErr, kindOf, dayWords, dayDots } from "../lib/concept";
import { lessonize } from "../lib/lesson-look";
import { diffText, foldSame, diffCount } from "../lib/text-diff";
import { POSITION_LABEL } from "../data/positions";
import { conceptPhotoUrl, conceptPhotoCached } from "./concept-photo";
import { useSoftImg } from "./lesson-photo";
import { KindIcon } from "./concept-import";
import { conceptPrintModel, acksPrintModel, deliverPdf } from "./concept-print";

const SERIF = "Georgia, 'Times New Roman', serif";
const TITLE = "'Piazzolla', Georgia, serif";
const plural = (n, a, b, c) => (n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c);
/** «Ознакомлен», «Ознакомлена» или «Ознакомлен(а)», если не знаем. */
export const ackWord = (female) => (female === true ? "Ознакомлена" : female === false ? "Ознакомлен" : "Ознакомлен(а)");
const bare = (s) => String(s || "").replace(/\*\*/g, "");

// ── обложка ──────────────────────────────────────────────────────────────────────────────────────
function HeroImg({ id }) {
  const [src, setSrc] = React.useState(() => conceptPhotoCached(id, true) || conceptPhotoCached(id, false));
  React.useEffect(() => {
    let live = true;
    if (!conceptPhotoCached(id, true)) conceptPhotoUrl(id, true).then((u) => { if (live && u) setSrc(u); });
    return () => { live = false; };
  }, [id]);
  const soft = useSoftImg(src);
  return src ? <img src={src} alt="" decoding="async" {...soft.props({ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" })} /> : null;
}

/**
 * Обложка «О нас»: sec — { title, sub }, where — заведение, hero — фото, ack — conceptAck, chg — conceptChanges, toc —
 * conceptToc; onJump(id) — к блоку.
 */
export function ConceptCover({ T, a11y, c, sec, where, hero, ack, chg, toc, female, onJump }) {
  const n = chg ? chg.items.length : 0;
  const status = !ack.has ? "" : ack.need ? (n ? "Изменилось после твоей отметки: " + n + ". Посмотри и отметь внизу." : "Прочитай и отметь внизу «" + ackWord(female) + "».")
    : ackWord(female) + (ack.at ? " " + dayWords(ack.at) : "") + ".";
  const ink = "#F6EEDC";
  return (
    <div data-cn-cover={hero ? "photo" : "text"} data-lens-card="" style={{ ...T.modCard, display: "block", padding: 0, overflow: "hidden", marginBottom: 14, cursor: "default" }}>
      {hero ? (
        <div style={{ position: "relative", height: 220, background: "rgba(214,178,102,0.08)" }}>
          <HeroImg id={hero.id} />
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,7,3,0) 30%, rgba(10,7,3,0.78) 100%)" }} />
          <div style={{ position: "absolute", left: 16, right: 16, bottom: 14 }}>
            <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 13, color: "rgba(246,238,220,0.86)" }}>{where || sec.sub}</div>
            <div style={{ fontFamily: TITLE, fontWeight: 700, fontSize: 27, lineHeight: 1.15, color: ink, marginTop: 2, textShadow: "0 1px 12px rgba(0,0,0,0.45)" }}>{sec.title}</div>
            {where && sec.sub ? <div style={{ fontFamily: SERIF, fontSize: 13.5, color: "rgba(246,238,220,0.86)", marginTop: 3 }}>{sec.sub}</div> : null}
          </div>
        </div>
      ) : (
        <div style={{ padding: "22px 16px 8px", textAlign: "center" }}>
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 13, color: c.soft }}>{where || "О нас"}</div>
          <div style={{ fontFamily: TITLE, fontWeight: 700, fontSize: 27, lineHeight: 1.15, color: T.modTitle.color, marginTop: 4 }}>{sec.title}</div>
          {sec.sub ? <div style={{ fontFamily: SERIF, fontSize: 13.5, color: c.soft, marginTop: 4 }}>{sec.sub}</div> : null}
          <div aria-hidden="true" style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginTop: 12 }}>
            <i style={{ width: 54, height: 1, background: GOLD + "88" }} /><i style={{ width: 6, height: 6, transform: "rotate(45deg)", background: GOLD }} /><i style={{ width: 54, height: 1, background: GOLD + "88" }} />
          </div>
        </div>
      )}
      <div style={{ padding: "11px 14px 13px" }}>
        {status ? <div data-cn-status={!ack.has ? "" : ack.need ? (n ? "changed" : "new") : "ok"} style={{ display: "flex", gap: 7, alignItems: "flex-start", fontSize: 13, lineHeight: 1.45,
          color: ack.need ? T.modTitle.color : c.ok }}>
          <span style={{ flexShrink: 0, marginTop: 1, display: "inline-flex" }}>{ack.need ? UI_SVG.bell(GOLD, 15) : UI_SVG.checkCircle(c.ok, 15)}</span>
          <span>{status}</span>
        </div> : null}
        {toc.length > 1 ? <>
          <div style={{ fontSize: 12, color: c.soft, margin: status ? "10px 0 6px" : "0 0 6px" }}>В разделе {toc.length} {plural(toc.length, "блок", "блока", "блоков")}</div>
          <div data-cn-toc-list="" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {toc.map((t) => {
              const ch = chg && chg.items.find((x) => x.id === t.id && x.type !== "gone");
              return (
                <button key={t.id} type="button" data-lens-btn="soft" data-cn-toc={t.id} onClick={() => { vibrate("light"); onJump(t.id); }}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, border: "1px solid " + (ch ? GOLD : c.line),
                    background: c.chip, color: T.modTitle.color, fontFamily: SERIF, fontSize: 12.5, cursor: "pointer", maxWidth: "100%" }}>
                  <KindIcon kind={t.kind} s={13} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                  {ch ? <span aria-label={ch.type === "new" ? "новый" : "изменён"} style={{ width: 6, height: 6, borderRadius: 3, background: GOLD, flexShrink: 0 }} /> : null}
                </button>);
            })}
          </div>
        </> : null}
      </div>
    </div>);
}

// ── «Что изменилось» ──────────────────────────────────────────────────────────────────────────────
const TYPE_WORD = { edit: "изменён", new: "новый", gone: "убрали" };

export function ChangesCard({ T, c, chg, onJump }) {
  if (!chg || !chg.items.length) return null;
  return (
    <div data-cn-changes={chg.items.length} data-lens-card="" style={{ ...T.modCard, display: "block", padding: "12px 14px", marginBottom: 14, cursor: "default" }}>
      <div style={{ fontFamily: TITLE, fontSize: 17.5, color: T.modTitle.color }}>Что изменилось</div>
      <div style={{ fontSize: 12.5, color: c.soft, marginTop: 2, marginBottom: 6 }}>{chg.at ? "После твоей отметки " + dayWords(chg.at) + "." : "После твоей отметки."} Изменённое в блоках подсвечено.</div>
      {chg.items.map((it) => {
        const row = (
          <span style={{ display: "flex", alignItems: "center", gap: 9, width: "100%" }}>
            <KindIcon kind={it.kind} s={15} c={it.type === "gone" ? c.soft : GOLD} />
            <span style={{ flex: 1, minWidth: 0, fontFamily: SERIF, fontSize: 14.5, color: it.type === "gone" ? c.soft : T.modTitle.color, textDecoration: it.type === "gone" ? "line-through" : "none" }}>{it.title}</span>
            <span data-cn-chgword={it.type} style={{ flexShrink: 0, fontSize: 11.5, padding: "1px 8px", borderRadius: 999, border: "1px solid " + (it.type === "gone" ? c.line : GOLD + "88"),
              color: it.type === "gone" ? c.soft : GOLD }}>{TYPE_WORD[it.type]}</span>
          </span>);
        return it.type === "gone"
          ? <div key={it.type + it.id} data-cn-chg="gone" style={{ padding: "8px 0", borderTop: "1px solid " + c.line }}>{row}</div>
          : <button key={it.type + it.id} type="button" data-lens-row="" data-cn-chg={it.type} data-cn-chgid={it.id} onClick={() => { vibrate("light"); onJump(it.id, it.type === "edit"); }}
              style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: 0, borderTop: "1px solid " + c.line, padding: "8px 0", cursor: "pointer" }}>{row}</button>;
      })}
    </div>);
}

/** Чем текст блока сейчас отличается от того, что человек видел: строки и слова; без изменений — свёрнуто. */
export function DiffView({ T, c, was, now }) {
  const d = React.useMemo(() => diffText(lessonize(was.body || ""), lessonize(now.body || "")), [was.body, now.body]);
  const n = diffCount(d);
  const rows = foldSame(d, 1);
  const addBg = "rgba(93,187,138,0.16)", delBg = "rgba(224,120,120,0.14)";
  const line = { fontFamily: SERIF, fontSize: 14, lineHeight: 1.5, color: T.modTitle.color, padding: "3px 8px", borderRadius: 8, margin: "2px 0" };
  const wasPh = (was.photos || []).map((p) => p.id), nowPh = (now.photos || []).map((p) => p.id);
  const phAdd = nowPh.filter((x) => !wasPh.includes(x)).length, phDel = wasPh.filter((x) => !nowPh.includes(x)).length;
  return (
    <div data-cn-diff={n.add + "/" + n.del + "/" + n.mod}>
      {was.title !== now.title ? <div data-cn-diff-title="" style={{ ...line, padding: "3px 0" }}>Заголовок: <del style={{ color: c.soft }}>{was.title}</del> <span aria-hidden="true">›</span> <ins style={{ textDecoration: "none", background: addBg, borderRadius: 4, padding: "0 3px" }}>{now.title}</ins></div> : null}
      {rows.map((r, i) => {
        if (r.t === "fold") return <div key={i} data-cn-diff-fold={r.n} style={{ fontSize: 12, color: c.soft, fontStyle: "italic", padding: "2px 8px" }}>… ещё {r.n} {plural(r.n, "строка", "строки", "строк")} без изменений</div>;
        if (r.t === "same") return <div key={i} style={{ ...line, opacity: 0.72 }}>{bare(r.s)}</div>;
        if (r.t === "add") return <div key={i} data-cn-diff-add="" style={{ ...line, background: addBg, borderLeft: "3px solid " + GREEN }}>{bare(r.s)}</div>;
        if (r.t === "del") return <div key={i} data-cn-diff-del="" style={{ ...line, background: delBg, borderLeft: "3px solid " + RED, textDecoration: "line-through", color: c.soft }}>{bare(r.s)}</div>;
        return (
          <div key={i} data-cn-diff-mod="" style={{ ...line, borderLeft: "3px solid " + GOLD }}>
            {r.segs.map((s, k) => s.t === "same" ? <React.Fragment key={k}>{bare(s.s)}</React.Fragment>
              : s.t === "add" ? <ins key={k} style={{ textDecoration: "none", background: addBg, borderRadius: 4, padding: "0 2px", borderBottom: "1.5px solid " + GREEN }}>{bare(s.s)}</ins>
              : <del key={k} style={{ color: c.soft, background: delBg, borderRadius: 4, padding: "0 2px" }}>{bare(s.s)}</del>)}
          </div>);
      })}
      {!n.add && !n.del && !n.mod && was.title === now.title ? <div style={{ fontSize: 12.5, color: c.soft, padding: "2px 8px" }}>Текст тот же.</div> : null}
      {phAdd || phDel ? <div data-cn-diff-photos={phAdd + "/" + phDel} style={{ fontSize: 12.5, color: c.soft, padding: "4px 8px" }}>
        Фото: {[phAdd ? "добавили " + phAdd : "", phDel ? "убрали " + phDel : ""].filter(Boolean).join(", ")}.</div> : null}
    </div>);
}

// ── «Ознакомлен(а)» ──────────────────────────────────────────────────────────────────────────────
export function AckCard({ T, c, ack, busy, onAck, female, main, onPrint, printing }) {
  if (!ack.has) return null;
  const word = ackWord(female);
  return (
    <div data-cn-ack={ack.need ? "need" : "ok"} data-lens-card="" style={{ ...T.modCard, display: "block", padding: "13px 15px", marginTop: 6, cursor: "default" }}>
      {ack.need ? <>
        <div style={{ fontFamily: TITLE, fontSize: 17, color: T.modTitle.color }}>{female === true ? "Прочитала раздел?" : female === false ? "Прочитал раздел?" : "Прочитал(а) раздел?"}</div>
        <div style={{ fontSize: 12.5, color: c.soft, lineHeight: 1.5, marginTop: 3 }}>Отметь: руководитель увидит дату в листе ознакомления. Это подтверждение, что концепцию и стандарты ты знаешь.</div>
        <button type="button" data-lens-btn="main" data-cn-read="" style={{ ...main, marginTop: 10 }} disabled={busy} onClick={onAck}>{busy ? "Минуту…" : word}</button>
      </> : (
        <div data-cn-readok="" style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
          <span style={{ flexShrink: 0, marginTop: 1, display: "inline-flex" }}>{UI_SVG.checkCircle(c.ok, 18)}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: "bold", color: c.ok }}>{word + (ack.at ? " " + dayWords(ack.at) : "")}</div>
            <div style={{ fontSize: 12.5, color: c.soft, lineHeight: 1.45, marginTop: 2 }}>{ack.edition ? "Редакция от " + dayWords(ack.edition) + ". " : ""}Обновят, придёт сообщение.</div>
          </div>
        </div>)}
      {onPrint ? <button type="button" data-lens-btn="soft" data-cn-print="" onClick={onPrint} disabled={printing}
        style={{ marginTop: 12, padding: "7px 14px", borderRadius: 999, border: "1px solid " + c.line, background: c.chip, color: T.modTitle.color, fontFamily: SERIF, fontSize: 13, cursor: "pointer" }}>
        {printing ? "Собираю файл…" : "Раздел целиком в PDF, для печати"}</button> : null}
    </div>);
}

/** Сохранить раздел или лист в PDF → текст для строки под кнопкой. */
export async function savePdf(kind, data, opts) {
  try {
    const model = kind === "concept_acks_pdf" ? acksPrintModel(data, opts.reads) : await conceptPrintModel(data, opts);
    const r = await deliverPdf(kind, model);
    return r === "cancel" ? "" : r === "tg" ? "Файл открывается в Telegram." : "Файл сохранён.";
  } catch (e) { return (e && e.message) || "Файл не получился. Попробуй ещё раз."; }
}

// ── лист ознакомления (руководитель) ──────────────────────────────────────────────────────────────
export function AcksPanel({ T, c, ghost, data, venueName }) {
  const [reads, setReads] = React.useState(null);
  const [busy, setBusy] = React.useState("");
  const [msg, setMsg] = React.useState("");
  const load = () => {
    vibrate("light"); setMsg("");
    rpc("concept_reads", { p_token: saToken(), p_restaurant: venueName || null }).then((r) => setReads(r && r.ok ? r : { ok: false })).catch(() => setReads({ ok: false }));
  };
  const pdf = async (kind) => {
    if (busy) return;
    vibrate("light"); setBusy(kind); setMsg("");
    const t = await savePdf(kind, data, { reads, all: true });
    setBusy(""); setMsg(t);
  };
  const team = reads && reads.ok ? (reads.rows || []).filter((x) => !x.me) : [];
  const ok = team.filter((x) => x.net && x.venue);
  return (
    <div data-cn-acks="">
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button type="button" data-lens-btn="soft" data-cn-reads="" style={ghost} onClick={load}>{reads ? "Обновить список" : "Кто ознакомлен"}</button>
        <button type="button" data-lens-btn="soft" data-cn-printall="" style={ghost} disabled={!!busy} onClick={() => pdf("concept_pdf")}>{busy === "concept_pdf" ? "Собираю файл…" : "Раздел в PDF"}</button>
      </div>
      {reads && reads.ok ? (
        <div data-cn-readlist={ok.length + "/" + team.length} style={{ marginTop: 10 }}>
          <div style={{ fontFamily: SERIF, fontSize: 14, color: T.modTitle.color }}>Ознакомлены {ok.length} из {team.length}</div>
          {team.filter((x) => !(x.net && x.venue)).length ? <div style={{ fontSize: 12.5, color: c.soft, lineHeight: 1.5, marginTop: 4 }}>Ещё нет: {team.filter((x) => !(x.net && x.venue)).map((x) => x.name).join(", ")}</div> : null}
          <div style={{ marginTop: 8 }}>
            {(reads.rows || []).map((x) => {
              const done = x.net && x.venue;
              return (
                <div key={x.id} data-cn-ackrow={done ? "ok" : x.was ? "old" : "no"} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "6px 0", borderTop: "1px solid " + c.line }}>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: SERIF, fontSize: 14, color: T.modTitle.color }}>{x.name}{x.me ? " (ты)" : ""}
                    <span style={{ fontSize: 12, color: c.soft }}>{POSITION_LABEL[x.pos] ? ", " + POSITION_LABEL[x.pos].toLowerCase() : ""}</span></span>
                  <span style={{ flexShrink: 0, fontSize: 12.5, color: done ? c.ok : c.soft }}>{done ? dayDots(x.at) : x.was ? "прошлую: " + dayDots(x.was) : "ещё нет"}</span>
                </div>);
            })}
          </div>
          <button type="button" data-lens-btn="soft" data-cn-sheet="" style={{ ...ghost, marginTop: 10 }} disabled={!!busy} onClick={() => pdf("concept_acks_pdf")}>{busy === "concept_acks_pdf" ? "Собираю лист…" : "Лист ознакомления, PDF"}</button>
          <div style={{ fontSize: 12, color: c.soft, lineHeight: 1.45, marginTop: 5 }}>Для отдела кадров: фамилия, должность, дата отметки в приложении и место для подписи. Кто ещё не отметил, ставит дату рукой.</div>
        </div>) : reads ? <div style={{ fontSize: 12.5, color: c.warn, marginTop: 8 }}>Не получилось узнать. Попробуй ещё раз.</div> : null}
      {msg ? <div role="status" data-cn-pdfmsg="" style={{ fontSize: 12.5, color: T.modTitle.color, marginTop: 8 }}>{msg}</div> : null}
    </div>);
}

// ── история блока (руководитель) ─────────────────────────────────────────────────────────────────
export function HistoryPanel({ T, c, ghost, block, onReverted, onClose }) {
  const [st, setSt] = React.useState({ phase: "load", list: [] });
  const [open, setOpen] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  React.useEffect(() => {
    rpc("concept_history", { p_token: saToken(), p_scope: block.scope || "", p_id: block.id }).then((r) => {
      if (rpcMissing(r)) setSt({ phase: "missing", list: [] });
      else if (r && r.ok) setSt({ phase: "ready", list: r.versions || [] });
      else setSt({ phase: "error", list: [] });
    }).catch(() => setSt({ phase: "error", list: [] }));
  }, [block.id, block.scope]);
  const back = (h) => {
    if (busy) return;
    vibrate("light"); setBusy(true); setErr("");
    rpc("concept_revert", { p_token: saToken(), p_hid: h.hid }).then((r) => {
      setBusy(false);
      if (r && r.ok) onReverted(r.block, "Вернул версию от " + dayWords(h.made_at || h.gone_at) + ". Нынешняя осталась в истории.");
      else setErr(conceptErr(r && r.error));
    }).catch(() => { setBusy(false); setErr("Нет связи. Попробуй ещё раз."); });
  };
  return (
    <div data-cn-history={st.phase} data-lens-card="" style={{ ...T.modCard, display: "block", padding: "12px 14px", marginTop: 10, cursor: "default" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ flex: 1, fontFamily: TITLE, fontSize: 17, color: T.modTitle.color }}>История блока</div>
        <button type="button" data-lens-btn="soft" style={{ ...ghost, padding: "4px 11px", fontSize: 12 }} onClick={onClose}>Свернуть</button>
      </div>
      {st.phase === "load" ? <div style={{ fontSize: 13, color: c.soft, marginTop: 6 }}>Загружаю…</div> : null}
      {st.phase === "missing" ? <div style={{ fontSize: 13, color: c.soft, marginTop: 6 }}>История появится с этапом 58 на сервере (supabase-stage58-concept-acks.sql).</div> : null}
      {st.phase === "error" ? <div style={{ fontSize: 13, color: c.warn, marginTop: 6 }}>Не получилось загрузить. Попробуй ещё раз.</div> : null}
      {st.phase === "ready" && !st.list.length ? <div style={{ fontSize: 13, color: c.soft, marginTop: 6 }}>Прежних версий пока нет: блок не правили с тех пор, как появилась история.</div> : null}
      {st.list.map((h) => (
        <div key={h.hid} data-cn-ver={h.hid} style={{ borderTop: "1px solid " + c.line, padding: "8px 0", marginTop: 4 }}>
          <button type="button" data-lens-row="" aria-expanded={open === h.hid} onClick={() => setOpen((x) => (x === h.hid ? null : h.hid))}
            style={{ display: "flex", width: "100%", alignItems: "baseline", gap: 8, background: "transparent", border: 0, padding: 0, cursor: "pointer", textAlign: "left" }}>
            <span style={{ flex: 1, fontFamily: SERIF, fontSize: 14, color: T.modTitle.color }}>{"Версия от " + dayWords(h.made_at || h.gone_at)}{h.made_name ? ", " + h.made_name : ""}</span>
            <span style={{ fontSize: 12.5, color: GOLD }}>{open === h.hid ? "Свернуть" : "Что было"}</span>
          </button>
          <div style={{ fontSize: 12, color: c.soft, marginTop: 2 }}>{"Заменили " + dayDots(h.gone_at) + (h.gone_name ? ", " + h.gone_name : "")}</div>
          {open === h.hid ? <>
            <div style={{ fontSize: 12, color: c.soft, margin: "8px 0 4px", lineHeight: 1.45 }}>Сравнение с тем, что сейчас: зачёркнутое было в этой версии, зелёное добавили позже.</div>
            <DiffView T={T} c={c} was={h} now={block} />
            <button type="button" data-lens-btn="soft" data-cn-revert={h.hid} style={{ ...ghost, marginTop: 8 }} disabled={busy} onClick={() => back(h)}>{busy ? "Возвращаю…" : "Вернуть эту версию"}</button>
          </> : null}
        </div>))}
      {err ? <div role="status" style={{ fontSize: 12.5, color: c.warn, marginTop: 6 }}>{err}</div> : null}
    </div>);
}

// ── удалённые блоки части (руководитель) ─────────────────────────────────────────────────────────
export function GonePanel({ T, c, ghost, scope, onRestored }) {
  const [list, setList] = React.useState(null);
  const [busy, setBusy] = React.useState(0);
  const [err, setErr] = React.useState("");
  const load = React.useCallback(() => {
    rpc("concept_history", { p_token: saToken(), p_scope: scope || "" }).then((r) => setList(r && r.ok ? r.gone || [] : [])).catch(() => setList([]));
  }, [scope]);
  React.useEffect(() => { load(); }, [load]);
  if (!list || !list.length) return null;
  const back = (h) => {
    if (busy) return;
    vibrate("light"); setBusy(h.hid); setErr("");
    rpc("concept_revert", { p_token: saToken(), p_hid: h.hid }).then((r) => {
      setBusy(0);
      if (r && r.ok) { load(); onRestored("Блок «" + h.title + "» снова на месте."); } else setErr(conceptErr(r && r.error));
    }).catch(() => { setBusy(0); setErr("Нет связи. Попробуй ещё раз."); });
  };
  return (
    <div data-cn-gone={list.length} style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12.5, color: c.soft, margin: "0 2px 6px" }}>Удалённые блоки: можно вернуть полгода</div>
      {list.map((h) => (
        <div key={h.hid} data-cn-gonerow={h.id} data-lens-card="" style={{ ...T.modCard, display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", marginBottom: 8, cursor: "default", opacity: 0.88 }}>
          <KindIcon kind={h.kind} s={15} c={c.soft} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: SERIF, fontSize: 14, color: T.modTitle.color }}>{h.title || kindOf(h.kind).title}</div>
            <div style={{ fontSize: 12, color: c.soft }}>{"Удалён " + dayDots(h.gone_at) + (h.gone_name ? ", " + h.gone_name : "")}</div>
          </div>
          <button type="button" data-lens-btn="soft" data-cn-restore={h.hid} style={{ ...ghost, padding: "5px 12px", fontSize: 12.5 }} disabled={!!busy} onClick={() => back(h)}>{busy === h.hid ? "Возвращаю…" : "Вернуть"}</button>
        </div>))}
      {err ? <div role="status" style={{ fontSize: 12.5, color: c.warn }}>{err}</div> : null}
    </div>);
}
