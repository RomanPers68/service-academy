// ui/ref-editor.jsx — v167 (Доп. 492): редактор справочника.
//
// Владелец (15.11): «Мы можем сделать редактор справочника по типу как в меню, карте бара, контента и т.д.? Уверен, что
// инфа будет добавляться и хочется это делать с приложения. Редактор должен быть гибким и удобным». Решения владельца:
// справочник общий для всех заведений; править можно всё, включая штатные главы; редактор только у владельца.
//   • Три шага вглубь: разделы → раздел (название, подзаголовок, обложка, главы) → глава (название, текст, фото, схемы).
//   • Штатные разделы и главы живут в приложении; на сервере (этап 53, lib/ref-book.js) — только правки. Штатное можно
//     переписать, скрыть, переставить, перенести в другой раздел и вернуть как было. Своё — ещё и удалить.
//   • Текст главы — той же разметкой, что у штатных глав: кнопки ставят её сами, «Как увидит сотрудник» рисует главу
//     тем же кодом, что справочник (RefContent из ui/ReferenceSection.jsx).
//   • Фото в тексте и обложки — фото уроков на всю сеть (этап 51): в тексте остаётся строка [photo:номер|подпись].
//   • Черновик главы сам сохраняется на телефоне: закрыл не дописав, открыл и продолжил.
// «Гид по приложению» здесь не правится: он обновляется вместе со сборками. Ассистент под текстом главы — ui/ref-assist.jsx (v168).
// «Главы из документа» в экране раздела — ui/ref-split.jsx (v169): большой документ раскладывается на несколько глав.
import React from "react";
import { createPortal } from "react-dom";
import { REFERENCE_COURSE, REFERENCE_WINE_COURSE, REFERENCE_COFFEE_COURSE, REFERENCE_BAR_COURSE } from "../data/reference";
import { REFERENCE_PHOTOS } from "../data/reference-photos";
import { ILL, renderIll } from "./reference-illustrations";
import { RefContent, REF_OFF_HUB } from "./ReferenceSection";
import { glass as glassOf, SectionLabel, tones } from "./analytics-kit";
import { GOLD, labelStyle } from "./tokens";
import { vibrate } from "../lib/utils";
import { compressPhoto } from "../lib/chat-photo";
import { useLessonPhotos, LessonPhotoSheet, CamIcon } from "./lesson-photo";
import { saveLessonPhoto, removeLessonPhoto, lessonPhotoErr, photoOf, lessonPhotoId, refCoverId } from "../lib/lesson-photo";
import { useRefBook } from "./use-ref-book";
import { loadRefBook, refItemsNow, refPhotoIds, RB_LIMITS } from "../lib/ref-book";
import {
  refEditTree, reorderPut, chapterRow, refRow, refRowEmpty, saveRefBook, refBookErr, newRefId, newRefPhotoId, applyRefEdit,
  refFmt, refInsertLine, refPhotoLine, sameText,
} from "../lib/ref-edit";
import { counted } from "../lib/ru-num";
import { RefAssist } from "./ref-assist";   // v168 (Доп. 493): ассистент под текстом главы
import { RefSplit, RefSplitNew, useRefSplit, splitPrune, splitForget } from "./ref-split";   // v169 (Доп. 494): «Главы из документа» в экране раздела; v170: «Показать все»

const SERIF = "Georgia, 'Times New Roman', serif";
export const RE_DRAFT = "sa_ref_draft_v1";   // черновик главы на телефоне: { forId, at, title, body, parent }
/** Штатные разделы, которые правятся (без «Гида по приложению») */
export const RE_BASE = [REFERENCE_COURSE, REFERENCE_WINE_COURSE, REFERENCE_COFFEE_COURSE, REFERENCE_BAR_COURSE];

const readDraft = () => { try { const v = JSON.parse(localStorage.getItem(RE_DRAFT) || "null"); return v && typeof v.forId === "string" ? v : null; } catch (e) { return null; } };
const writeDraft = (v) => { try { if (v) localStorage.setItem(RE_DRAFT, JSON.stringify(v)); else localStorage.removeItem(RE_DRAFT); } catch (e) { /* */ } };
const hhmm = (t) => { const d = new Date(t); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
const fullName = (p) => (p ? [p.name, p.surname].filter(Boolean).join(" ") : "");
const findCh = (tree, id) => { for (const s of tree) for (const l of s.lessons) if (l.id === id) return l; return null; };
const move = (ids, i, dir) => { const j = i + dir; if (j < 0 || j >= ids.length) return null; const out = ids.slice(); [out[i], out[j]] = [out[j], out[i]]; return out; };

/**
 * v169 (Доп. 494): «Главы из документа» — готовая глава сразу ложится в раздел toSec скрытой. Место: после главы after,
 * иначе перед главой before, иначе последней (так главы стоят в порядке документа, даже если одна дописана позже).
 * Пишется мимо run() экрана: работа идёт в фоне и не должна ни запирать кнопки, ни подменять сообщения. Место считается
 * по живому справочнику: пока ассистент писал, глав в разделе могло прибавиться. → { ok: true, id } или { ok: false, error } (словами)
 */
export async function addHiddenChapter({ title, content, after = "", before = "" }, toSec) {
  const secNow = refEditTree(RE_BASE, refItemsNow()).find((s) => s.id === toSec);
  if (!secNow) return { ok: false, error: "Раздела больше нет: его убрали, пока ассистент писал." };
  const id = newRefId("ch");
  const row = { ...chapterRow({ id, own: true, sec: toSec, home: toSec, it: null, content: "" }, { title, body: content, parent: toSec }), hidden: true };
  const ids = secNow.lessons.map((l) => l.id);
  ids.splice(after && ids.includes(after) ? ids.indexOf(after) + 1 : before && ids.includes(before) ? ids.indexOf(before) : ids.length, 0, id);
  const more = reorderPut([...secNow.lessons, { id, own: true, sec: toSec, it: { ...row, sort: null }, nat: null }], ids, "ch");
  const by = new Map([[id, row]]); more.forEach((r) => by.set(r.id, r));
  const r = await saveRefBook([...by.values()], []);
  return r.ok ? { ok: true, id } : { ok: false, error: refBookErr(r.error) };
}

/** v170 (Доп. 495): строки, которыми главы list (из дерева редактора) становятся видны команде: «Показать все» пишет их одной записью */
export const showChapterRows = (list) => (Array.isArray(list) ? list : []).map((l) => ({ ...refRow(l, "ch"), hidden: false }));

/** Черновик главы: то, что набрано и не записано (с телефона), иначе сама глава. → { draft, restored (время или null) } */
export function chapterDraft(node, stored = readDraft()) {
  const base = { id: node.id, isNew: false, title: node.title, body: node.content, parent: node.sec };
  if (stored && stored.forId === node.id && (stored.title !== base.title || !sameText(stored.body, base.body) || (stored.parent && stored.parent !== base.parent))) {
    return { draft: { ...base, title: String(stored.title || ""), body: String(stored.body || ""), parent: stored.parent || base.parent }, restored: stored.at || null };
  }
  return { draft: base, restored: null };
}

// ── значки ──
const sv = (s, w = 1.8) => ({ width: s, height: s, viewBox: "0 0 24 24", fill: "none", strokeWidth: w, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true });
const ico = {
  plus: (c, s = 17) => (<svg {...sv(s, 2)} stroke={c}><path d="M12 5v14M5 12h14" /></svg>),
  up: (c, s = 16) => (<svg {...sv(s, 2)} stroke={c}><path d="M6 15l6-6 6 6" /></svg>),
  down: (c, s = 16) => (<svg {...sv(s, 2)} stroke={c}><path d="M6 9l6 6 6-6" /></svg>),
  trash: (c, s = 16) => (<svg {...sv(s)} stroke={c}><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>),
  eye: (c, s = 16) => (<svg {...sv(s)} stroke={c}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>),
  eyeOff: (c, s = 16) => (<svg {...sv(s)} stroke={c}><path d="M3 3l18 18" /><path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.5 6.6A17.3 17.3 0 0 0 2 12s3.6 7 10 7a10.2 10.2 0 0 0 4.3-.9" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>),
  undo: (c, s = 16) => (<svg {...sv(s)} stroke={c}><path d="M4 9h10a5 5 0 0 1 0 10H8" /><path d="M8 5L4 9l4 4" /></svg>),
  photo: (c, s = 16) => (<svg {...sv(s)} stroke={c}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="M21 16l-5-5L6 20" /></svg>),
  scheme: (c, s = 16) => (<svg {...sv(s)} stroke={c}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.2" /><path d="M2.5 12H1M23 12h-1.5" /></svg>),
};

// ── схемы и фото из приложения: что можно вставить в текст строкой [img:ключ] ──
export const ILL_NAMES = {
  preset_table: "Базовая сервировка", fine_dining_full: "Полная сервировка", cutlery_layout_diagram: "Раскладка приборов", oyster_service: "Подача устриц",
  banquet: "Банкет", buffet: "Фуршет", bread_plate_butter: "Пирожковая тарелка и масло", plates_sizes: "Размеры тарелок", charger_plate: "Подстановочная тарелка",
  basic_flatware: "Основные приборы", fish_steak_cutlery: "Приборы для рыбы и стейка", wine_glasses_chart: "Бокалы для воды и вина", snifter_rocks: "Снифтер и рокс",
  glass_red: "Бокал для красного", glass_flute: "Флют", espresso_cup: "Чашка эспрессо", milk_pitcher: "Питчер и чашка", coffee_ratio: "Эспрессо, капучино, латте",
  cocktail_aperitif: "Аперитивы", cocktail_sour: "Сауэры", cocktail_strong: "Крепкая классика", cocktail_zero: "Безалкогольные",
  school_russian_1: "Русская школа", school_russian_2: "Русская школа, второе фото", school_french_1: "Французская школа", school_french_2: "Французская школа, второе фото",
  school_english_2: "Английская школа", school_italian_1: "Итальянская школа", school_italian_2: "Итальянская школа, второе фото",
  school_american_1: "Американская школа", school_american_2: "Американская школа, второе фото", school_japanese_1: "Японская школа", school_japanese_2: "Японская школа, второе фото",
  school_chinese_1: "Китайская школа", school_chinese_2: "Китайская школа, второе фото", school_middle_east_1: "Ближний Восток", school_middle_east_2: "Ближний Восток, второе фото",
  wine_hold: "Как держать бутылку", wine_present: "Презентация бутылки", wine_foil: "Срез капсулы", wine_cork: "Пробка", wine_pour: "Розлив вина", wine_sparkling: "Игристое",
};
const illName = (k) => ILL_NAMES[k] || k;
/** Ключи схем (рисунки) и фото из приложения, по порядку показа */
export const illKeys = () => { const all = Object.keys(ILL); return { art: all.filter((k) => !REFERENCE_PHOTOS[k]), photo: all.filter((k) => !!REFERENCE_PHOTOS[k]) }; };

// ── лист снизу: общий каркас ──
function Sheet({ a11y, label, onClose, children, attrs = null }) {
  const c = a11y
    ? { bg: "linear-gradient(180deg,#FFF9EC,#F4E8CD)", base: "#F7EEDB", edge: "rgba(139,106,48,0.42)", text: "#2A2113", sub: "#6B5A3E", veil: "rgba(70,52,24,0.42)" }
    : { bg: "linear-gradient(180deg,#2E2312,#1E170C)", base: "#241B0E", edge: "rgba(214,178,102,0.45)", text: "#EFE4C8", sub: "#B3A58A", veil: "rgba(8,6,3,0.66)" };
  React.useEffect(() => {
    const k = (ev) => { if (ev.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const body = (
    <div {...(attrs || {})} onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9600, background: c.veil, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div role="dialog" aria-modal="true" aria-label={label} data-lens-card="" data-lens-float="" onClick={(ev) => ev.stopPropagation()} className="sa-panel-in"
        style={{ position: "relative", width: "100%", maxWidth: 520, maxHeight: "86vh", overflowY: "auto", borderRadius: "22px 22px 0 0", padding: "16px 16px calc(18px + env(safe-area-inset-bottom, 0px))",
          fontFamily: SERIF, backgroundColor: c.base, backgroundImage: c.bg, border: "1px solid " + c.edge, borderBottom: 0, boxShadow: "0 -12px 40px rgba(0,0,0,0.45)", color: c.text }}>
        {/* data-sa-back: «Назад» Telegram и телефона закрывает лист, а не уводит из главы (lib/utils.js, clickScreenBack) */}
        <button type="button" aria-label="Закрыть" data-lens="disc" data-lens-x="" data-sa-back="" onClick={onClose}
          style={{ position: "absolute", top: 8, right: 8, width: 40, height: 40, borderRadius: "50%", border: 0, background: "none", color: c.sub, fontSize: 22, lineHeight: 1, cursor: "pointer" }}>×</button>
        <div style={{ fontSize: 19, fontWeight: "bold", paddingRight: 40 }}>{label}</div>
        {children(c)}
      </div>
    </div>
  );
  if (typeof document === "undefined" || !document.body) return body;
  return createPortal(body, document.body);
}

/** Лист «Фото в текст»: выбрать фото, подписать, вставить строкой туда, где курсор. Фото — на всю сеть (этап 51). */
function InsertPhotoSheet({ a11y, profile, missing, onClose, onInsert }) {
  const [busy, setBusy] = React.useState("");
  const [msg, setMsg] = React.useState(() => (missing ? lessonPhotoErr("missing", true) : ""));
  const [got, setGot] = React.useState(null);   // { id, url }
  const [cap, setCap] = React.useState("");
  const done = React.useRef(false);
  const close = () => { if (got && !done.current) removeLessonPhoto(got.id, ""); onClose(); };   // загрузил и передумал — фото не копим
  const pick = async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!f || busy) return;
    setMsg(""); setBusy("Сжимаю фото…");
    let ph;
    try { ph = await compressPhoto(f); } catch (er) { setBusy(""); setMsg(lessonPhotoErr(String((er && er.message) || ""), true)); vibrate("error"); return; }
    setBusy("Загружаю…");
    if (got) removeLessonPhoto(got.id, "");   // выбрал другое — прежнее не нужно
    const id = newRefPhotoId();
    const r = await saveLessonPhoto(id, "", ph, fullName(profile));
    setBusy("");
    if (!r.ok) { setGot(null); setMsg(lessonPhotoErr(r.error, true)); vibrate("error"); return; }
    vibrate("success");
    setGot({ id, url: ph.thumbUrl || ph.fullUrl || "" });
  };
  return (
    <Sheet a11y={a11y} label="Фото в текст" onClose={close} attrs={{ "data-re-photo-sheet": "" }}>{(c) => (<>
      <div style={{ fontSize: 14, lineHeight: 1.5, color: c.sub, marginTop: 10 }}>Фото встанет в текст главы там, где стоит курсор. Его увидят все заведения.</div>
      {got ? (
        <div data-re-photo-got="" style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14 }}>
          <div style={{ width: 92, height: 62, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: a11y ? "#E9DEC4" : "#2A2114", boxShadow: "inset 0 0 0 1px " + c.edge }}>
            {got.url ? <img src={got.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : null}
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.4, color: c.sub }}>Фото загружено. Подпиши его, если нужно, и вставь в текст.</div>
        </div>
      ) : null}
      {got ? <input data-re-photo-cap="" data-lens-field="" value={cap} onChange={(e) => setCap(e.target.value.slice(0, 140))} placeholder="Подпись под фото, можно пусто"
        style={{ width: "100%", boxSizing: "border-box", marginTop: 12, borderRadius: 12, padding: "12px 14px", fontFamily: SERIF, fontSize: 14, outline: "none",
          background: a11y ? "rgba(255,252,245,0.85)" : "rgba(20,14,6,0.55)", border: "1px solid " + c.edge, color: c.text }} /> : null}
      {msg ? <div data-re-photo-msg="" role="status" style={{ fontSize: 14, lineHeight: 1.45, color: missing ? c.text : a11y ? "#9A3B24" : "#F0A08A", marginTop: 10 }}>{msg}</div> : null}
      {busy ? <div data-re-photo-busy="" role="status" style={{ fontSize: 14, fontStyle: "italic", color: a11y ? "#7A5A1E" : "#E8C983", marginTop: 10 }}>{busy}</div> : null}
      {!missing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
          {got ? <button type="button" data-re-photo-insert="" data-lens-btn="main" className="sa-btn" onClick={() => { done.current = true; onInsert(got.id, cap); }}
            style={{ minHeight: 50, borderRadius: 999, border: 0, background: "linear-gradient(172deg,#F1DBA4 0%,#DDBE7F 46%,#BC9A5E 100%)", color: "#24180A", fontFamily: SERIF, fontWeight: "bold", fontSize: 16, cursor: "pointer" }}>Вставить в текст</button> : null}
          <label data-re-photo-pick="" data-lens-btn={got ? "soft" : "main"} className="sa-btn" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: got ? 44 : 50, borderRadius: 999,
            background: got ? "transparent" : "linear-gradient(172deg,#F1DBA4 0%,#DDBE7F 46%,#BC9A5E 100%)", border: got ? "1px solid " + c.edge : 0, color: got ? c.sub : "#24180A",
            fontWeight: got ? "normal" : "bold", fontSize: got ? 15 : 16, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
            <CamIcon s={18} />{got ? "Выбрать другое" : "Выбрать фото"}
            <input type="file" accept="image/*" onChange={pick} disabled={!!busy} style={{ display: "none" }} />
          </label>
        </div>
      ) : null}
    </>)}</Sheet>
  );
}

// Рисунок в плитке: раскладывается на ширине текста главы (сцены сервировки держат расстояния от неё) и уменьшается под плитку
function FitBox({ h = 96, children }) {
  const box = React.useRef(null), inner = React.useRef(null);
  const [k, setK] = React.useState(0.5);
  React.useEffect(() => {
    const b = box.current, i = inner.current;
    if (!b || !i) return;
    const w = i.offsetWidth, hh = i.offsetHeight;
    if (w > 0 && hh > 0) setK(Math.min(1, (b.clientWidth - 10) / w, (h - 8) / hh));
  }, [h]);
  return (
    <span ref={box} style={{ position: "relative", display: "block", height: h, overflow: "hidden", borderRadius: 10 }}>
      <span ref={inner} style={{ position: "absolute", left: "50%", top: "50%", width: 320, display: "flex", justifyContent: "center", lineHeight: 0, transform: `translate(-50%, -50%) scale(${k})`, transformOrigin: "center" }}>{children}</span>
    </span>
  );
}

/** Лист «Схема из приложения»: рисунки и фото, которые уже есть в справочнике */
function SchemeSheet({ a11y, onClose, onPick }) {
  const dark = !a11y, gold = dark ? GOLD : "#7A5D2A";
  const { art, photo } = illKeys();
  const tile = (k, kind) => (
    <button key={k} type="button" data-re-scheme={k} onClick={() => onPick(k)} style={{ display: "flex", flexDirection: "column", gap: 6, padding: 8, borderRadius: 14, cursor: "pointer", textAlign: "center",
      border: "1px solid " + (dark ? "rgba(214,178,102,0.28)" : "rgba(139,106,48,0.3)"), background: dark ? "rgba(255,248,230,0.04)" : "rgba(255,255,255,0.55)", color: "inherit", fontFamily: SERIF }}>
      {kind === "photo"
        ? <span style={{ display: "block", height: 96, borderRadius: 10, overflow: "hidden" }}><img src={REFERENCE_PHOTOS[k]} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /></span>
        : <FitBox>{renderIll(k, gold, dark)}</FitBox>}
      <span style={{ fontSize: 12.5, lineHeight: 1.3 }}>{illName(k)}</span>
    </button>
  );
  const grid = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 10 };
  return (
    <Sheet a11y={a11y} label="Схема из приложения" onClose={onClose} attrs={{ "data-re-scheme-sheet": "" }}>{(c) => (<>
      <div style={{ fontSize: 14, lineHeight: 1.5, color: c.sub, marginTop: 10 }}>Рисунки и фото, которые уже есть в справочнике. Выбранное встанет в текст там, где стоит курсор.</div>
      <div style={{ ...labelStyle(13), color: c.sub, marginTop: 14 }}>Рисунки</div>
      <div style={grid}>{art.map((k) => tile(k, "art"))}</div>
      {photo.length ? <><div style={{ ...labelStyle(13), color: c.sub, marginTop: 16 }}>Фото</div><div style={grid}>{photo.map((k) => tile(k, "photo"))}</div></> : null}
    </>)}</Sheet>
  );
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════
export function RefEditorScreen({ T, a11y, profile, onBack, startId = null }) {
  const dark = !a11y;
  const TN = tones(a11y);
  const gold = dark ? GOLD : "#6B4E14";
  const txt = dark ? "#EFE4C8" : "#2A2113";
  const muted = dark ? "#BFAE8A" : "#5E4E30";
  const brd = dark ? "rgba(214,178,102,0.30)" : "rgba(107,78,20,0.28)";
  const G = (extra) => glassOf(null, a11y, extra);

  const book = useRefBook();
  const photos = useLessonPhotos();
  const [opt, setOpt] = React.useState(null);   // правка, пока сервер отвечает: список сразу такой, каким станет
  const items = opt || book.items;
  const tree = React.useMemo(() => refEditTree(RE_BASE, items), [items]);

  // с какой главы вошли (кнопка «Править главу» в справочнике) — сразу она
  const boot = React.useRef(undefined);
  if (boot.current === undefined) { const node = startId ? findCh(refEditTree(RE_BASE, refItemsNow()), startId) : null; boot.current = node ? { node, ...chapterDraft(node) } : null; }
  const b0 = boot.current;
  const [view, setView] = React.useState(b0 ? "ch" : "list");
  const [secId, setSecId] = React.useState(b0 ? b0.node.sec : null);
  const [draft, setDraft] = React.useState(b0 ? b0.draft : null);
  const [direct, setDirect] = React.useState(!!b0);   // вошли сразу в главу: «назад» и «записать» возвращают туда, откуда пришли
  const [draftNote, setDraftNote] = React.useState(b0 && b0.restored ? "Восстановлен черновик от " + hhmm(b0.restored) : "");
  const [aiGen, setAiGen] = React.useState(0);   // v168: «Начать заново» — ассистент тоже с чистого листа (возвращать ему уже нечего)
  const [savedAt, setSavedAt] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [note, setNote] = React.useState("");
  const [sure, setSure] = React.useState("");          // что подтверждают: "del-sec", "del-ch", "reset-sec", "reset-ch"
  const [newSec, setNewSec] = React.useState(null);     // название нового раздела, пока его набирают
  const [meta, setMeta] = React.useState(null);         // { id, title, sub } — поля раздела, пока их правят
  const [preview, setPreview] = React.useState(false);
  const [sheet, setSheet] = React.useState("");         // "photo" | "scheme" | "cover-sec" | "cover-ch"
  const [typing, setTyping] = React.useState(false);
  const taRef = React.useRef(null);
  const caret = React.useRef(null);                     // где стоял курсор, когда открыли лист
  const uploaded = React.useRef([]);                    // фото, загруженные в этой правке главы
  const [stored, setStored] = React.useState(() => readDraft());
  const split = useRefSplit(addHiddenChapter);   // v169: «Главы из документа» — работа живёт, пока открыт редактор
  // редактор открыли — берём с сервера свежие правки (владелец мог править с другого телефона или с компьютера)
  React.useEffect(() => { loadRefBook(true); }, []);
  const baseOf = (n) => (n ? { title: n.title, body: n.content, parent: n.sec } : null);
  const base0 = React.useRef(b0 ? baseOf(b0.node) : null);   // глава, какой она была, когда её открыли

  const sec = secId ? tree.find((s) => s.id === secId) || null : null;
  const chNode = draft && !draft.isNew ? findCh(tree, draft.id) : null;
  const shown = view === "ch" && (!draft || (!draft.isNew && !chNode)) ? (sec ? "sec" : "list") : view === "sec" && !sec ? "list" : view;
  const hubSecs = tree.filter((s) => !REF_OFF_HUB.includes(s.id)), offSecs = tree.filter((s) => REF_OFF_HUB.includes(s.id));

  const metaOf = (s) => ({ id: s.id, title: s.title, sub: s.subtitle });
  const m = sec ? (meta && meta.id === sec.id ? meta : metaOf(sec)) : null;
  React.useEffect(() => { setSure(""); setSheet(""); }, [shown, secId, draft && draft.id]);
  // главу записали с другого устройства, пока она открыта здесь: если тут ничего не набрано — показываем свежую
  React.useEffect(() => {
    if (!draft || draft.isNew || !chNode) return;
    const was = base0.current, now = baseOf(chNode);
    if (was && (was.title !== now.title || !sameText(was.body, now.body) || was.parent !== now.parent)
      && draft.title === was.title && sameText(draft.body, was.body) && draft.parent === was.parent) setDraft({ id: chNode.id, isNew: false, ...now });
    base0.current = now;
  }, [chNode && chNode.title, chNode && chNode.content, chNode && chNode.sec]);   // eslint-disable-line react-hooks/exhaustive-deps

  // черновик главы сам ложится на телефон через полсекунды после правки
  const dirty = !!draft && (draft.isNew ? !!(draft.title.trim() || draft.body.trim()) : !!chNode && (draft.title !== chNode.title || !sameText(draft.body, chNode.content) || draft.parent !== chNode.sec));
  React.useEffect(() => {
    if (shown !== "ch" || !draft) return undefined;
    // вернул текст к записанному — черновик больше не нужен
    if (!dirty) { if (stored && stored.forId === draft.id) { writeDraft(null); setStored(null); setSavedAt(null); } return undefined; }
    const t = setTimeout(() => { const at = Date.now(); const v = { forId: draft.id, at, title: draft.title, body: draft.body, parent: draft.parent, isNew: !!draft.isNew }; writeDraft(v); setStored(v); setSavedAt(at); }, 600);
    return () => clearTimeout(t);
  }, [draft, shown, dirty]);   // eslint-disable-line react-hooks/exhaustive-deps
  // поле текста растёт вместе с текстом
  React.useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(220, el.scrollHeight + 2) + "px";
  }, [draft && draft.body, shown, preview]);
  // «Записать» уезжает, пока печатаешь: не закрывает поле (как в редакторе контента)
  React.useEffect(() => {
    if (shown !== "ch" || typeof document === "undefined") return undefined;
    const isField = (el) => !!(el && /^(TEXTAREA|INPUT)$/.test(el.tagName) && el.type !== "file");
    const on = (e) => { if (isField(e.target)) setTyping(true); };
    const off = () => setTimeout(() => setTyping(isField(document.activeElement)), 80);
    document.addEventListener("focusin", on); document.addEventListener("focusout", off);
    return () => { document.removeEventListener("focusin", on); document.removeEventListener("focusout", off); setTyping(false); };
  }, [shown]);

  /** Записать правку: список сразу такой, каким станет; не вышло — как был, и причина словами */
  const run = async (put, del, okNote = "") => {
    if (busy) return false;
    setErr(""); setNote("");
    setOpt(applyRefEdit(book.items, put, del)); setBusy(true);
    const r = await saveRefBook(put, del);
    setBusy(false); setOpt(null);
    if (!r.ok) { setErr(refBookErr(r.error)); vibrate("error"); return false; }
    vibrate("success");
    if (okNote) setNote(okNote);
    return true;
  };
  // фото, которые больше нигде не стоят, с сервера убираем: иначе они копятся (их не больше 600 на сеть)
  const dropPhotos = (ids, after) => {
    const used = new Set();
    refEditTree(RE_BASE, after).forEach((s) => s.lessons.forEach((l) => refPhotoIds(l.content).forEach((id) => used.add(id))));
    ids.filter((id) => /^rp:/.test(id) && !used.has(id)).forEach((id) => { removeLessonPhoto(id, ""); });
  };

  // ── разделы ──
  const openSec = (id) => { setSecId(id); setView("sec"); setErr(""); setNote(""); setNewSec(null); };
  const moveSec = (i, dir) => { const ids = move(hubSecs.map((s) => s.id), i, dir); if (ids) run(reorderPut(hubSecs, ids, "sec"), []); };
  const addSec = async () => {
    const title = String(newSec || "").trim();
    if (!title) { setErr("Назови раздел."); return; }
    const id = newRefId("sec");
    if (await run([{ id, kind: "sec", parent: "", title: title.slice(0, RB_LIMITS.title), sub: null, body: null, hidden: false, sort: null }], [])) { setNewSec(null); openSec(id); setNote("Раздел создан. Добавь первую главу, и команда его увидит."); }
  };
  const metaDirty = !!(sec && m && (m.title.trim() !== sec.title || m.sub.trim() !== sec.subtitle));
  const saveMeta = async () => {
    if (!sec || !m) return;
    const t = m.title.trim().slice(0, RB_LIMITS.title), s = m.sub.trim().slice(0, RB_LIMITS.sub);
    if (sec.own && !t) { setErr("Назови раздел."); return; }
    const row = { ...refRow(sec, "sec"), title: sec.own ? t : t && t !== sec.baseTitle ? t : null, sub: sec.own ? s || null : s && s !== sec.baseSub ? s : null };
    if (refRowEmpty(row) && !sec.it) { setMeta(null); return; }   // штатное и так штатное: писать нечего
    const ok = refRowEmpty(row) ? await run([], [sec.id], "Записано.") : await run([row], [], "Записано.");
    if (ok) setMeta(null);
  };
  const hideSec = () => { if (!sec) return; const row = { ...refRow(sec, "sec"), hidden: !sec.hidden }, say = sec.hidden ? "Раздел снова виден команде." : "Раздел скрыт от команды."; if (refRowEmpty(row)) run([], [sec.id], say); else run([row], [], say); };
  const resetSec = async () => { if (!sec) return; if (sure !== "reset-sec") { setSure("reset-sec"); vibrate("light"); return; } if (await run([], [sec.id], "Название, место и видимость раздела снова как в приложении.")) { setSure(""); setMeta(null); } };
  const delSec = async () => {
    if (!sec || !sec.own) return;
    if (sure !== "del-sec") { setSure("del-sec"); vibrate("light"); return; }
    // штатные главы, перенесённые сюда, возвращаются в свои разделы вместе со своими правками
    const back = sec.lessons.filter((l) => !l.own).map((l) => ({ ...refRow(l, "ch"), parent: "", sort: null })).filter((r) => !refRowEmpty(r));
    const gone = sec.lessons.filter((l) => l.own);
    const photoIds = gone.flatMap((l) => refPhotoIds(l.content));
    const after = applyRefEdit(book.items, back, [sec.id]);
    if (await run(back, [sec.id], "Раздел удалён.")) {
      dropPhotos(photoIds, after);
      gone.forEach((l) => { const id = lessonPhotoId(l.id); if (id && photos && photos !== "missing" && photoOf(photos, id)) removeLessonPhoto(id, ""); });
      const cover = refCoverId(sec.id); if (cover && photos && photos !== "missing" && photoOf(photos, cover)) removeLessonPhoto(cover, "");
      setSure(""); setSecId(null); setView("list");
    }
  };

  // ── главы ──
  const moveCh = (i, dir) => { if (!sec) return; const ids = move(sec.lessons.map((l) => l.id), i, dir); if (ids) run(reorderPut(sec.lessons, ids, "ch"), []); };
  const resetUi = () => { setErr(""); setNote(""); setPreview(false); setSavedAt(null); uploaded.current = []; };
  const openCh = (node) => { const d = chapterDraft(node); base0.current = baseOf(node); setDraft(d.draft); setDraftNote(d.restored ? "Восстановлен черновик от " + hhmm(d.restored) : ""); resetUi(); setView("ch"); };
  const openNew = () => {
    if (!sec) return;
    const st = readDraft();
    const d = st && st.isNew && st.parent === sec.id ? { id: st.forId, isNew: true, title: String(st.title || ""), body: String(st.body || ""), parent: sec.id } : { id: newRefId("ch"), isNew: true, title: "", body: "", parent: sec.id };
    setDraft(d); setDraftNote(st && st.isNew && st.parent === sec.id ? "Восстановлен черновик от " + hhmm(st.at) : ""); resetUi(); setView("ch");
  };
  const patch = (f) => setDraft((d) => ({ ...d, ...f }));
  const leaveCh = () => { if (direct) { onBack(); return; } setDraft(null); setView(sec ? "sec" : "list"); setErr(""); };                // ‹ — черновик остаётся
  const dropDraft = () => { writeDraft(null); setStored(null); setSavedAt(null); setDraftNote(""); };
  // фото из черновика, которые в записанных главах не стоят, вместе с черновиком и уходят
  const dropDraftPhotos = () => { if (draft) dropPhotos([...refPhotoIds(draft.body), ...uploaded.current], book.items); uploaded.current = []; };
  const cancelCh = () => { dropDraftPhotos(); dropDraft(); leaveCh(); };   // «Отменить» — черновик стирается
  const restart = () => { dropDraftPhotos(); dropDraft(); setAiGen((n) => n + 1); if (chNode) setDraft({ id: chNode.id, isNew: false, title: chNode.title, body: chNode.content, parent: chNode.sec }); else if (draft) setDraft({ ...draft, title: "", body: "" }); };
  const saveCh = async () => {
    if (!draft || busy) return;
    const title = draft.title.trim();
    if (!title) { setErr("Назови главу."); vibrate("error"); return; }
    if (!draft.body.trim()) { setErr("Напиши текст главы."); vibrate("error"); return; }
    if (draft.body.length > RB_LIMITS.body) { setErr("Текст слишком длинный. Раздели главу на две."); vibrate("error"); return; }
    const node = draft.isNew ? { id: draft.id, own: true, sec: draft.parent, home: draft.parent, it: null, content: "" } : chNode;
    if (!node) return;
    const goBack = () => { if (direct) { onBack(); return; } setSecId(draft.parent); setDraft(null); setView("sec"); };
    if (!draft.isNew && !dirty) { dropDraft(); goBack(); return; }   // ничего не меняли — сервер не трогаем
    const row = chapterRow(node, { title, body: draft.body, parent: draft.parent });
    let put = [row], del = [];
    if (!draft.isNew && draft.parent !== node.sec) {   // перенос: глава встаёт последней в новом разделе
      const to = tree.find((s) => s.id === draft.parent);
      if (to) {
        const moved = { id: node.id, own: node.own, sec: to.id, it: { ...row, sort: null }, nat: null };
        const more = reorderPut([...to.lessons, moved], [...to.lessons.map((l) => l.id), node.id], "ch");
        const by = new Map([[row.id, row]]); more.forEach((r) => by.set(r.id, r));
        put = [...by.values()];
      }
    } else if (refRowEmpty(row)) { put = []; del = node.it ? [node.id] : []; }
    if (!put.length && !del.length) { dropDraft(); goBack(); return; }
    const before = refPhotoIds(node.content || ""), now = refPhotoIds(draft.body);
    const after = applyRefEdit(book.items, put, del);
    if (!(await run(put, del, "Глава записана. Команда увидит её, когда откроет справочник."))) return;
    dropPhotos([...before, ...uploaded.current].filter((id) => !now.includes(id)), after);
    dropDraft();
    goBack();
  };
  // v170 (Доп. 495): «Показать все» — главы из документа, которые ещё скрыты, одной записью
  const showNew = async (list) => {
    const put = showChapterRows(list);
    if (!put.length || !sec) return;
    const n = put.length;
    if (!(await run(put, [], "Показано: " + counted(n, "глава", "главы", "глав") + ". Команда увидит " + (n === 1 ? "её" : "их") + ", когда откроет справочник."))) return;
    // память телефона: показанные сейчас и раньше, удалённые — больше не помним; по живому справочнику, чтобы не забыть
    // главу, которую ассистент дописал в эту же секунду
    const now = refEditTree(RE_BASE, refItemsNow()).find((s) => s.id === sec.id);
    splitPrune(sec.id, now ? now.lessons : []);
  };
  // v170: показал или скрыл главу сам — дальше это решение владельца, «Показать все» её больше не считает
  const hideCh = async () => {
    if (!chNode) return;
    const row = { ...refRow(chNode, "ch"), hidden: !chNode.hidden }, say = chNode.hidden ? "Глава снова видна команде." : "Глава скрыта от команды.", at = chNode.sec, id = chNode.id;
    if (await (refRowEmpty(row) ? run([], [id], say) : run([row], [], say))) splitForget(at, [id]);
  };
  const resetCh = async () => {
    if (!chNode || chNode.own) return;
    if (sure !== "reset-ch") { setSure("reset-ch"); vibrate("light"); return; }
    const before = refPhotoIds(chNode.content), after = applyRefEdit(book.items, [], [chNode.id]);
    if (await run([], [chNode.id], "Глава снова как в приложении.")) { dropPhotos([...before, ...uploaded.current], after); dropDraft(); setSure(""); setDirect(false); setSecId(chNode.home); setDraft(null); setView("sec"); }
  };
  const delCh = async () => {
    if (!chNode || !chNode.own) return;
    if (sure !== "del-ch") { setSure("del-ch"); vibrate("light"); return; }
    const before = refPhotoIds(chNode.content), after = applyRefEdit(book.items, [], [chNode.id]), cover = lessonPhotoId(chNode.id);
    if (await run([], [chNode.id], "Глава удалена.")) {
      dropPhotos([...before, ...uploaded.current], after);
      if (cover && photos && photos !== "missing" && photoOf(photos, cover)) removeLessonPhoto(cover, "");
      dropDraft(); setSure(""); setDirect(false); setDraft(null); setView("sec");
    }
  };

  // ── кнопки оформления: работают со строками, где стоит выделение ──
  const sel = () => { const ta = taRef.current, v = (draft && draft.body) || ""; return ta ? [ta.selectionStart, ta.selectionEnd] : [v.length, v.length]; };
  const putSel = (a, b) => { const go = () => { const t = taRef.current; if (t) { try { t.focus(); t.setSelectionRange(a, b); } catch (x) { /* */ } } }; if (typeof requestAnimationFrame === "function") requestAnimationFrame(go); else go(); };
  const fmt = (kind) => { if (!draft) return; const [s, e] = sel(); const r = refFmt(draft.body, s, e, kind); patch({ body: r.text }); putSel(r.s, r.e); };
  const openSheet = (k) => { caret.current = sel()[1]; setSheet(k); };
  const insertLine = (line) => { if (!draft) return; const r = refInsertLine(draft.body, caret.current, line); patch({ body: r.text }); setSheet(""); putSel(r.pos, r.pos); };

  // ── общие стили (как в редакторе контента) ──
  const input = { width: "100%", boxSizing: "border-box", borderRadius: 12, padding: "12px 14px", fontFamily: SERIF, fontSize: 14, outline: "none",
    background: dark ? "rgba(20,14,6,0.55)" : "linear-gradient(180deg, rgba(255,252,245,0.82), rgba(250,243,228,0.78))",
    border: `1px solid ${dark ? brd : "rgba(139,106,48,0.26)"}`, color: txt, boxShadow: dark ? "none" : "inset 0 1px 0 rgba(255,255,255,0.95), inset 0 2px 6px rgba(120,90,30,0.05)" };
  const primary = { width: "100%", padding: "14px", borderRadius: 14, border: "none", cursor: "pointer", fontFamily: SERIF, fontSize: 15, fontWeight: "bold",
    color: "#1F160A", background: "linear-gradient(135deg, #E2C487, #A67C3A)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45), 0 6px 18px rgba(166,124,58,0.3)" };
  const ghost = dark
    ? { width: "100%", padding: "13px", borderRadius: 14, cursor: "pointer", fontFamily: SERIF, fontSize: 14, background: "transparent", color: muted, border: `1px solid ${brd}` }
    : { width: "100%", padding: "13px", borderRadius: 14, cursor: "pointer", fontFamily: SERIF, fontSize: 14, color: gold, background: "linear-gradient(180deg, rgba(255,252,245,0.7), rgba(248,240,222,0.6))",
        border: "1px solid rgba(139,106,48,0.32)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.95), 0 2px 8px rgba(120,90,30,0.08)" };
  const tool = { display: "inline-flex", alignItems: "center", gap: 6, minHeight: 38, padding: "0 12px", borderRadius: 12, cursor: "pointer", fontFamily: SERIF, fontSize: 13.5,
    background: "transparent", color: txt, border: `1px solid ${brd}` };
  const act = (c = muted) => ({ display: "inline-flex", alignItems: "center", gap: 7, minHeight: 40, padding: "0 14px", borderRadius: 999, cursor: "pointer", fontFamily: SERIF, fontSize: 13.5,
    background: "transparent", color: c, border: `1px solid ${c === muted ? brd : c + "88"}` });
  const arrow = (on) => ({ width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center", flexShrink: 0, cursor: on ? "pointer" : "default", background: "transparent",
    border: `1px solid ${brd}`, opacity: on ? 1 : 0.3, padding: 0 });
  const chip = (c) => ({ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11.5, lineHeight: 1.5, color: c, border: `1px solid ${c}77`, whiteSpace: "nowrap" });
  const fieldLab = { ...labelStyle(dark ? 13 : 13.5), color: muted, margin: "10px 2px 5px" };
  const header = (title, back, right = null) => (
    <div style={T.lessHead}><button className="sa-hit" style={T.backBtn2} data-lens="back" aria-label="Вернуться" onClick={back}>‹</button><div style={T.lessHeadTitle}>{title}</div>{right}</div>);
  const status = (<>
    {err ? <div data-re-err="" role="status" style={{ color: TN.bad, fontSize: 13.5, lineHeight: 1.45, margin: "8px 2px" }}>{err}</div> : null}
    {note && !err ? <div data-re-note="" role="status" style={{ color: TN.good, fontSize: 13.5, lineHeight: 1.45, margin: "8px 2px" }}>{note}</div> : null}
  </>);
  const arrows = (i, n, go, what) => (n > 1 ? <>
    <button type="button" data-re-up="" aria-label={"Выше: " + what} disabled={busy || i === 0} onClick={(e) => { e.stopPropagation(); go(i, -1); }} style={arrow(!busy && i > 0)}>{ico.up(muted)}</button>
    <button type="button" data-re-down="" aria-label={"Ниже: " + what} disabled={busy || i === n - 1} onClick={(e) => { e.stopPropagation(); go(i, 1); }} style={arrow(!busy && i < n - 1)}>{ico.down(muted)}</button>
  </> : null);
  const chipsOf = (arr) => (arr.length ? <span style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5 }}>{arr.map(([t, c]) => <span key={t} style={chip(c)}>{t}</span>)}</span> : null);

  // ═════ РАЗДЕЛЫ ═════
  if (shown === "list") {
    const secRow = (s, i, n, movable) => {
      const live = s.lessons.filter((l) => !l.hidden).length, hid = s.lessons.length - live;
      const chips = [s.own && ["свой раздел", gold], s.hidden && ["скрыт", TN.bad], s.edited && ["изменён", TN.mid], !s.lessons.length && ["пусто, команде не виден", TN.mid], hid > 0 && [counted(hid, "глава скрыта", "главы скрыты", "глав скрыто"), muted]].filter(Boolean);
      return (
        <div key={s.id} data-re-sec={s.id} data-lens-edge="" role="button" tabIndex={0} onClick={() => openSec(s.id)} onKeyDown={(e) => { if (e.key === "Enter") openSec(s.id); }}
          style={{ ...G({ padding: "12px 12px 12px 14px", marginBottom: 10 }), display: "flex", alignItems: "center", gap: 8, cursor: "pointer", opacity: s.hidden ? 0.72 : 1 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: txt, fontFamily: SERIF, fontSize: 16, fontWeight: "bold", lineHeight: 1.3 }}>{s.title}</div>
            <div style={{ color: muted, fontSize: 12.5, marginTop: 2 }}>{counted(s.lessons.length, "глава", "главы", "глав")}</div>
            {chipsOf(chips)}
          </div>
          {movable ? arrows(i, n, moveSec, s.title) : null}
          <span aria-hidden="true" style={{ color: muted, fontSize: 20, paddingLeft: 2 }}>›</span>
        </div>
      );
    };
    return (
      <div style={T.screen} data-re-screen="list">
        {header("Редактор справочника", onBack)}
        <div style={{ ...T.lessBody, flex: 1, overflowY: "auto", padding: "12px 16px 44px" }}>
          <div style={{ color: muted, fontSize: 13.5, lineHeight: 1.5, marginBottom: 4 }}>Разделы и главы справочника, одни на все заведения. Штатное можно переписать, скрыть и вернуть как было. Команда видит правки, когда открывает справочник.</div>
          {book.missing ? (
            <div data-re-missing="" data-lens-edge="" style={{ ...G({ padding: "16px 16px", marginTop: 12 }) }}>
              <div style={{ color: txt, fontFamily: SERIF, fontWeight: "bold", fontSize: 16, marginBottom: 6 }}>Нужно обновить сервер</div>
              <div style={{ color: muted, fontSize: 13.5, lineHeight: 1.5 }}>{refBookErr("missing")}</div>
              <button type="button" data-re-retry="" data-lens-btn="soft" data-lens-ink="" disabled={busy} onClick={async () => { setBusy(true); await loadRefBook(true); setBusy(false); }}
                style={{ ...ghost, marginTop: 12 }}>{busy ? "Проверяю…" : "Проверить ещё раз"}</button>
            </div>
          ) : (<>
            {status}
            <SectionLabel a11y={a11y} right={counted(hubSecs.length, "раздел", "раздела", "разделов")}>Разделы</SectionLabel>
            {hubSecs.map((s, i) => secRow(s, i, hubSecs.length, true))}
            {newSec === null ? (
              <button type="button" data-re-new-sec="" data-lens-btn="main" onClick={() => { setNewSec(""); setErr(""); setNote(""); }} style={{ ...primary, marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{ico.plus("currentColor")}Новый раздел</button>
            ) : (
              <div data-re-new-sec-form="" data-lens-edge="" style={G({ padding: "12px 12px", marginTop: 4 })}>
                <div style={{ ...fieldLab, marginTop: 0 }}>Название раздела</div>
                <input data-re-new-sec-title="" data-lens-field="" style={input} value={newSec} maxLength={RB_LIMITS.title} autoFocus onChange={(e) => setNewSec(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addSec(); }} placeholder="Напр. «Стандарты заведения»" />
                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button type="button" data-lens-btn="soft" data-lens-ink="" onClick={() => { setNewSec(null); setErr(""); }} style={{ ...ghost, flex: 1, padding: "12px" }}>Отменить</button>
                  <button type="button" data-re-new-sec-ok="" data-lens-btn="main" disabled={busy} onClick={addSec} style={{ ...primary, flex: 1.6, padding: "12px", opacity: busy ? 0.6 : 1 }}>{busy ? "Создаю…" : "Создать раздел"}</button>
                </div>
              </div>
            )}
            {offSecs.length ? <>
              <SectionLabel a11y={a11y}>Отдельно</SectionLabel>
              <div style={{ color: muted, fontSize: 12.5, lineHeight: 1.5, margin: "-2px 2px 8px" }}>Карточки в справочнике у этих глав нет: они открываются из колоды бармена, подсказок и поиска.</div>
              {offSecs.map((s, i) => secRow(s, i, offSecs.length, false))}
            </> : null}
            <div style={{ color: muted, fontSize: 12.5, lineHeight: 1.5, margin: "14px 2px 0" }}>«Гид по приложению» обновляется вместе с приложением, здесь его нет.</div>
          </>)}
        </div>
      </div>
    );
  }

  // ═════ РАЗДЕЛ ═════
  if (shown === "sec") {
    const onHub = !REF_OFF_HUB.includes(sec.id);
    const coverId = onHub ? refCoverId(sec.id) : null;
    const hasCover = !!(coverId && photos && photos !== "missing" && photoOf(photos, coverId));
    return (
      <div style={T.screen} data-re-screen="sec">
        {header(sec.title, () => { setView("list"); setSecId(null); setErr(""); setNote(""); })}
        <div style={{ ...T.lessBody, flex: 1, overflowY: "auto", padding: "8px 16px 44px" }}>
          {status}
          <SectionLabel a11y={a11y}>Раздел</SectionLabel>
          <div data-lens-edge="" style={G({ padding: "4px 12px 12px" })}>
            <div style={fieldLab}>Название</div>
            <input data-re-sec-title="" data-lens-field="" style={input} value={m.title} maxLength={RB_LIMITS.title} onChange={(e) => setMeta({ ...m, title: e.target.value })} placeholder={sec.own ? "Напр. «Стандарты заведения»" : sec.baseTitle} />
            <div style={fieldLab}>Подзаголовок</div>
            <input data-re-sec-sub="" data-lens-field="" style={input} value={m.sub} maxLength={RB_LIMITS.sub} onChange={(e) => setMeta({ ...m, sub: e.target.value })} placeholder={sec.own ? "Коротко, о чём раздел" : sec.baseSub || "Коротко, о чём раздел"} />
            {!sec.own ? <div style={{ color: muted, fontSize: 12.5, lineHeight: 1.45, marginTop: 8 }}>Сотрёшь поле и запишешь, вернётся штатный текст.</div> : null}
            {metaDirty ? <button type="button" data-re-sec-save="" data-lens-btn="main" disabled={busy} onClick={saveMeta} style={{ ...primary, marginTop: 12, padding: "12px", opacity: busy ? 0.6 : 1 }}>{busy ? "Записываю…" : "Записать"}</button> : null}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {onHub ? <button type="button" data-re-sec-cover="" data-lens-btn="soft" onClick={() => setSheet("cover-sec")} style={act()}><CamIcon s={16} c={muted} />{hasCover ? "Сменить обложку" : "Обложка раздела"}</button> : null}
            <button type="button" data-re-sec-hide="" data-lens-btn="soft" disabled={busy} onClick={hideSec} style={act()}>{sec.hidden ? ico.eye(muted) : ico.eyeOff(muted)}{sec.hidden ? "Показать раздел" : "Скрыть раздел"}</button>
            {!sec.own && sec.it ? <button type="button" data-re-sec-reset={sure === "reset-sec" ? "sure" : ""} data-lens-btn="soft" disabled={busy} onClick={resetSec} style={act(sure === "reset-sec" ? TN.bad : muted)}>{ico.undo(sure === "reset-sec" ? TN.bad : muted)}{sure === "reset-sec" ? "Да, вернуть раздел как было" : "Вернуть как было"}</button> : null}
            {sec.own ? <button type="button" data-re-sec-del={sure === "del-sec" ? "sure" : ""} data-lens-btn="soft" disabled={busy} onClick={delSec} style={act(TN.bad)}>{ico.trash(TN.bad)}{sure === "del-sec" ? (sec.lessons.some((l) => l.own) ? "Да, удалить раздел и его главы" : "Да, удалить раздел") : "Удалить раздел"}</button> : null}
          </div>
          {sec.hidden ? <div style={{ color: TN.bad, fontSize: 12.5, lineHeight: 1.45, margin: "8px 2px 0" }}>Раздел скрыт: команда не видит ни его, ни его глав.</div> : null}

          <SectionLabel a11y={a11y} right={counted(sec.lessons.length, "глава", "главы", "глав")}>Главы</SectionLabel>
          {!sec.lessons.length ? <div data-re-empty="" style={{ color: muted, fontSize: 13.5, lineHeight: 1.5, margin: "0 2px 10px" }}>Глав пока нет. Раздел появится у команды с первой главой.</div> : null}
          {/* v170 (Доп. 495): главы из документа ещё скрыты — показать их можно все разом; скрытое вручную не трогается */}
          <RefSplitNew sec={sec} busy={busy} onShow={showNew} ui={{ G, txt, muted, gold: a11y ? "#7A5D2A" : GOLD, brd, primary }} />
          {sec.lessons.map((l, i) => {
            const text = l.type === "lesson";   // фото-тест (если появится среди штатных) здесь не правится: только место и видимость
            const chips = [l.own && ["своя", gold], l.hidden && ["скрыта", TN.bad], l.edited && ["изменена", TN.mid], l.moved && ["перенесена", muted], stored && stored.forId === l.id && ["черновик", TN.mid], !text && ["тест, текст не правится", muted]].filter(Boolean);
            return (
              <div key={l.id} data-re-ch={l.id} data-lens-edge="" role="button" tabIndex={0} onClick={() => { if (text) openCh(l); }} onKeyDown={(e) => { if (e.key === "Enter" && text) openCh(l); }}
                style={{ ...G({ padding: "10px 10px 10px 12px", marginBottom: 8 }), display: "flex", alignItems: "center", gap: 8, cursor: text ? "pointer" : "default", opacity: l.hidden ? 0.72 : 1 }}>
                <span aria-hidden="true" style={{ width: 26, textAlign: "center", color: muted, fontFamily: SERIF, fontSize: 15, flexShrink: 0 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: txt, fontFamily: SERIF, fontSize: 15, lineHeight: 1.3 }}>{l.title}</div>
                  {chipsOf(chips)}
                </div>
                {arrows(i, sec.lessons.length, moveCh, l.title)}
                <span aria-hidden="true" style={{ color: muted, fontSize: 20, paddingLeft: 2 }}>›</span>
              </div>
            );
          })}
          <button type="button" data-re-new-ch="" data-lens-btn="main" onClick={openNew} style={{ ...primary, marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{ico.plus("currentColor")}{stored && stored.isNew && stored.parent === sec.id ? "Продолжить новую главу" : "Новая глава"}</button>
          {/* v169 (Доп. 494): большой документ ассистент раскладывает на несколько глав; они ложатся в раздел скрытыми */}
          <RefSplit a11y={a11y} job={split} sec={sec} ui={{ input, primary, G, txt, muted, gold: a11y ? "#7A5D2A" : GOLD, brd, TN }} />
        </div>
        {sheet === "cover-sec" && coverId ? <LessonPhotoSheet lessonId={coverId} lessonTitle={sec.title} profile={profile} a11y={!!a11y} list={photos} kind="section" onClose={() => setSheet("")} /> : null}
      </div>
    );
  }

  // ═════ ГЛАВА ═════
  const isNew = !!draft.isNew;
  const coverCh = !isNew ? lessonPhotoId(draft.id) : null;
  const hasCoverCh = !!(coverCh && photos && photos !== "missing" && photoOf(photos, coverCh));
  const long = draft.body.length > RB_LIMITS.body * 0.9;
  return (
    <div style={T.screen} data-re-screen="ch" className="sa-edscreen">
      {header(isNew ? "Новая глава" : "Глава", leaveCh)}
      <div style={{ ...T.lessBody, flex: 1, overflowY: "visible", padding: "8px 16px 170px" }}>
        {draftNote ? (
          <div data-re-draft="" data-lens-edge="" style={{ ...G({ padding: "9px 12px", marginTop: 6 }), display: "flex", alignItems: "center", gap: 8, color: muted, fontSize: 12.5 }}>
            <span style={{ flex: 1 }}>{draftNote}</span>
            <button type="button" data-re-draft-drop="" onClick={restart} style={{ background: "transparent", border: "none", cursor: "pointer", color: gold, fontFamily: SERIF, fontSize: 12.5, padding: 2 }}>Начать заново</button>
          </div>) : null}
        {/* v169: главы из документа приходят скрытыми — показать главу можно сразу здесь, не листая до «Ещё» */}
        {chNode && chNode.hidden ? (
          <div data-re-ch-hidden="" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", color: TN.bad, fontSize: 12.5, lineHeight: 1.45, margin: "8px 2px 0" }}>
            <span style={{ flex: 1, minWidth: 170 }}>Глава скрыта: команда её не видит.</span>
            <button type="button" data-re-ch-show="" data-lens-btn="soft" disabled={busy} onClick={hideCh} style={{ ...act(), minHeight: 34, padding: "0 12px", fontSize: 13 }}>{ico.eye(muted, 15)}Показать главу</button>
          </div>) : null}

        <SectionLabel a11y={a11y}>Название главы</SectionLabel>
        <input data-re-ch-title="" data-lens-field="" style={input} value={draft.title} maxLength={RB_LIMITS.title} onChange={(e) => patch({ title: e.target.value })} placeholder="Напр. «Как мы встречаем гостя»" />

        <SectionLabel a11y={a11y}>Текст главы</SectionLabel>
        <div data-re-tools="" style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          <button type="button" data-re-tool="bold" data-lens-btn="soft" onClick={() => fmt("bold")} style={{ ...tool, fontWeight: "bold" }} aria-label="Жирный">Ж</button>
          <button type="button" data-re-tool="head" data-lens-btn="soft" onClick={() => fmt("head")} style={tool}>Заголовок</button>
          <button type="button" data-re-tool="list" data-lens-btn="soft" onClick={() => fmt("list")} style={tool}>• Список</button>
          <button type="button" data-re-tool="num" data-lens-btn="soft" onClick={() => fmt("num")} style={tool}>1. Список</button>
          <button type="button" data-re-tool="note" data-lens-btn="soft" onClick={() => fmt("note")} style={tool}>Важно</button>
          <button type="button" data-re-tool="good" data-lens-btn="soft" onClick={() => fmt("good")} style={tool}>Верно</button>
          <button type="button" data-re-tool="bad" data-lens-btn="soft" onClick={() => fmt("bad")} style={tool}>Неверно</button>
          <button type="button" data-re-tool="photo" data-lens-btn="soft" onClick={() => openSheet("photo")} style={tool}>{ico.photo(gold)}Фото</button>
          <button type="button" data-re-tool="scheme" data-lens-btn="soft" onClick={() => openSheet("scheme")} style={tool}>{ico.scheme(gold)}Схема</button>
        </div>
        <textarea ref={taRef} data-re-ch-body="" data-lens-field="" style={{ ...input, minHeight: 220, resize: "none", lineHeight: 1.6, overflow: "hidden" }} value={draft.body}
          onChange={(e) => patch({ body: e.target.value })} placeholder={"Напиши текст главы.\n\nЗаголовок, список и пометки ставятся кнопками сверху: выдели строки и нажми. Повторное нажатие снимает оформление."} />
        <div style={{ color: long ? TN.bad : muted, fontSize: 12.5, lineHeight: 1.45, margin: "6px 2px 0" }}>
          {long ? "Глава почти у предела длины. Лучше разделить её на две." : "Кнопки работают со строками, где стоит курсор или выделение. Фото и схема встают отдельной строкой."}</div>

        {/* v168 (Доп. 493): ассистент — глава из материала или по теме, улучшить, сократить; в главу текст берёт владелец */}
        <RefAssist key={draft.id + ":" + aiGen} T={T} a11y={a11y} title={draft.title} body={draft.body} getSel={sel} onTake={(f) => patch(f)}
          ui={{ input, primary, G, txt, muted, gold: a11y ? "#7A5D2A" : GOLD, brd, TN }} />

        <button type="button" data-re-preview-btn="" data-lens-btn="soft" data-lens-ink="" onClick={() => setPreview((v) => !v)} style={{ ...ghost, marginTop: 12 }}>{preview ? "Скрыть просмотр" : "Как увидит сотрудник"}</button>
        {preview ? (
          <div data-re-preview="" style={{ marginTop: 10 }}>
            <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: "bold", color: T.lessHeadTitle.color, margin: "0 4px 8px" }}>{draft.title.trim() || "Без названия"}</div>
            <div style={{ background: T.lessGlass.bg, border: T.lessGlass.border, borderTop: T.lessGlass.borderTop, borderRadius: 22, boxShadow: T.lessGlass.shadow, padding: "20px 18px", backdropFilter: T.lessGlass.blur, WebkitBackdropFilter: T.lessGlass.blur }}>
              {draft.body.trim() ? <RefContent text={draft.body} T={T} gold={a11y ? "#7A5D2A" : GOLD} dark={dark} notes /> : <div style={{ color: muted, fontSize: 14 }}>Текста пока нет.</div>}
            </div>
          </div>) : null}

        <SectionLabel a11y={a11y}>Раздел главы</SectionLabel>
        <div data-re-parents="" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {tree.map((s) => { const on = draft.parent === s.id; return (
            <button key={s.id} type="button" data-re-parent={s.id} aria-pressed={on} onClick={() => patch({ parent: s.id })}
              style={{ padding: "8px 13px", borderRadius: 12, fontFamily: SERIF, fontSize: 14, cursor: "pointer", background: on ? (dark ? "rgba(214,178,102,0.16)" : "rgba(176,138,70,0.16)") : "transparent",
                color: on ? gold : muted, border: `${on ? 1.5 : 1}px solid ${on ? gold : brd}`, fontWeight: on ? "bold" : "normal" }}>{s.title}</button>); })}
        </div>

        {!isNew && chNode ? (<>
          <SectionLabel a11y={a11y}>Ещё</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button type="button" data-re-ch-cover="" data-lens-btn="soft" onClick={() => setSheet("cover-ch")} style={act()}><CamIcon s={16} c={muted} />{hasCoverCh ? "Сменить фото главы" : "Фото главы"}</button>
            <button type="button" data-re-ch-hide="" data-lens-btn="soft" disabled={busy} onClick={hideCh} style={act()}>{chNode.hidden ? ico.eye(muted) : ico.eyeOff(muted)}{chNode.hidden ? "Показать главу" : "Скрыть главу"}</button>
            {!chNode.own && chNode.it ? <button type="button" data-re-ch-reset={sure === "reset-ch" ? "sure" : ""} data-lens-btn="soft" disabled={busy} onClick={resetCh} style={act(sure === "reset-ch" ? TN.bad : muted)}>{ico.undo(sure === "reset-ch" ? TN.bad : muted)}{sure === "reset-ch" ? "Да, вернуть штатную главу" : "Вернуть как было"}</button> : null}
            {chNode.own ? <button type="button" data-re-ch-del={sure === "del-ch" ? "sure" : ""} data-lens-btn="soft" disabled={busy} onClick={delCh} style={act(TN.bad)}>{ico.trash(TN.bad)}{sure === "del-ch" ? "Да, удалить главу" : "Удалить главу"}</button> : null}
          </div>
          <div style={{ color: muted, fontSize: 12.5, lineHeight: 1.45, margin: "8px 2px 0" }}>Фото главы встаёт над текстом и плиткой в списке глав.</div>
        </>) : null}
      </div>

      {/* «Записать» закреплена внизу; пока печатаешь, уезжает, чтобы не закрывать поле */}
      <div data-re-bar="" className="sa-colbar" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30, padding: "8px 16px calc(10px + env(safe-area-inset-bottom, 0px))",
        transform: typing ? "translateY(120%)" : "none", transition: "transform .25s ease", background: dark ? "rgba(21,17,11,0.94)" : "rgba(245,238,222,0.94)", borderTop: `1px solid ${gold}33`,
        WebkitBackdropFilter: "blur(8px)", backdropFilter: "blur(8px)" }}>
        {status}
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" data-re-cancel="" data-lens-btn="soft" data-lens-ink="" onClick={cancelCh} style={{ ...ghost, width: "auto", flex: 1, padding: "12px" }}>Отменить</button>
          <button type="button" data-re-save="" data-lens-btn="main" disabled={busy} onClick={saveCh} style={{ ...primary, flex: 1.6, padding: "12px", opacity: busy ? 0.6 : 1 }}>{busy ? "Записываю…" : "Записать главу"}</button>
        </div>
        <div style={{ color: muted, fontSize: 11.5, textAlign: "center", marginTop: 6 }}>{savedAt ? "Черновик сохранён на телефоне в " + hhmm(savedAt) : "Черновик сохраняется на телефоне сам"}</div>
      </div>
      {sheet === "photo" ? <InsertPhotoSheet a11y={!!a11y} profile={profile} missing={photos === "missing"} onClose={() => setSheet("")}
        onInsert={(id, cap) => { uploaded.current.push(id); insertLine(refPhotoLine(id, cap)); }} /> : null}
      {sheet === "scheme" ? <SchemeSheet a11y={!!a11y} onClose={() => setSheet("")} onPick={(k) => insertLine("[img:" + k + "]")} /> : null}
      {sheet === "cover-ch" && coverCh ? <LessonPhotoSheet lessonId={coverCh} lessonTitle={draft.title} profile={profile} a11y={!!a11y} list={photos} kind="chapter" onClose={() => setSheet("")} /> : null}
    </div>
  );
}
