// ui/lesson-photo.jsx — v146 (Доп. 467): фото урока сверху карточки и лист «Фото урока» для руководителя.
// Логика (список, память, сервер, первая мысль урока) — lib/lesson-photo.js, сервер — этап 51.
//
// Владелец (12.11): «Её можно будет менять? В твоём демо показан салат к истории «Два моря», а можно было вставить фото
// ресторана или персонала на фоне ресторана». Можно: у руководителя на фото урока кнопка с фотоаппаратом (нет фото —
// строка «Добавить фото к уроку»), в листе — «Выбрать фото» с телефона (сжимается на телефоне, как фото в чате), «Убрать
// фото» и, у владельца и руководящего состава, куда ставить: для всей сети или только для своего заведения. Сотрудник
// видит фото своего заведения, а если его нет — фото сети. Фото без подписи: заголовок урока и так над карточкой.
import React from "react";
import { createPortal } from "react-dom";
import { compressPhoto } from "../lib/chat-photo";
import { vibrate } from "../lib/utils";
import { isLeadPos } from "../lib/chat-mention";
import {
  loadLessonPhotos, lessonPhotoListNow, lessonPhotoSubscribe, lessonPhotoUrl, lessonPhotoCached, photoOf, canEditPhotos,
  defaultScope, scopeName, saveLessonPhoto, removeLessonPhoto, lessonPhotoErr,
} from "../lib/lesson-photo";

const SERIF = "Georgia, 'Times New Roman', serif";
export const CamIcon = ({ s = 18, c = "currentColor" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 8.5h3l1.6-2.3h6.8L17 8.5h3a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.3" r="3.6" />
  </svg>
);
export const isBoss = (p) => !!p && (!!p.is_admin || isLeadPos(String(p.position || "")));
const isOwner = (p) => !!p && (!!p.is_admin || String(p.position || "") === "senior");
const fullName = (p) => (p ? [p.name, p.surname].filter(Boolean).join(" ") : "");

/** Список фото уроков (живой): что известно сейчас + один запрос за заход */
export function useLessonPhotos() {
  const [list, setList] = React.useState(() => lessonPhotoListNow());
  React.useEffect(() => {
    const off = lessonPhotoSubscribe((v) => setList(v));
    loadLessonPhotos().then((v) => { if (v !== undefined) setList(v); });
    return off;
  }, []);
  return list;
}

/**
 * Обложка урока. Ставится первой строкой внутрь стеклянной карточки урока (отступы карточки — 20 и 18 px, фото к краям).
 * Нет фото: руководителю — строка «Добавить фото к уроку», остальным — ничего.
 */
export function LessonCover({ lessonId, lessonTitle = "", profile, a11y = false, color }) {
  const list = useLessonPhotos();
  const missing = list === "missing";
  const info = missing ? null : photoOf(list, lessonId);
  const canEdit = missing ? isBoss(profile) : canEditPhotos(list);
  const [src, setSrc] = React.useState(() => (info ? lessonPhotoCached(lessonId, info.ver, true) || lessonPhotoCached(lessonId, info.ver, false) : null));
  const [sheet, setSheet] = React.useState(false);
  const [gone, setGone] = React.useState(false);   // фото не пришло (нет связи) — не держим пустое место
  const ver = info ? info.ver : "";
  React.useEffect(() => {
    setGone(false);
    if (!ver) { setSrc(null); return undefined; }
    let live = true;
    const full = lessonPhotoCached(lessonId, ver, true);
    if (full) { setSrc(full); return undefined; }
    setSrc(lessonPhotoCached(lessonId, ver, false));
    const a = lessonPhotoUrl(lessonId, ver, false).then((u) => { if (live && u) setSrc((x) => x || u); return u; });
    const b = lessonPhotoUrl(lessonId, ver, true).then((u) => { if (live && u) setSrc(u); return u; });
    Promise.all([a, b]).then(([x, y]) => { if (live && !x && !y) setGone(true); });
    return () => { live = false; };
  }, [lessonId, ver]);
  const open = (e) => { if (e) e.stopPropagation(); vibrate("light"); setSheet(true); };
  const sub = a11y ? "#6B5A3E" : "#A99B7E";
  const sheetEl = sheet ? <LessonPhotoSheet lessonId={lessonId} lessonTitle={lessonTitle} profile={profile} a11y={a11y} list={list} onClose={() => setSheet(false)} /> : null;
  if (!info || (gone && !src)) {
    if (!canEdit) return null;
    return (<>
      <button type="button" data-lp-add="" onClick={open} onTouchStart={(e) => e.stopPropagation()}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", margin: "-4px 0 14px", padding: "9px 12px", borderRadius: 12,
          border: "1px dashed " + (color || "#C8A96E") + "77", background: "transparent", color: sub, fontFamily: SERIF, fontStyle: "italic", fontSize: a11y ? 14.5 : 13.5, cursor: "pointer" }}>
        <CamIcon s={17} />Добавить фото к уроку
      </button>
      {sheetEl}
    </>);
  }
  const ratio = info.w && info.h ? info.h / info.w : 0.62;
  return (<>
    <div data-lp-cover={info.scope ? "venue" : "net"} style={{ position: "relative", margin: "-20px -18px 16px", borderRadius: "21px 21px 0 0", overflow: "hidden",
      height: "clamp(150px, " + Math.round(Math.min(0.66, Math.max(0.5, ratio)) * 92) + "vw, 240px)", background: a11y ? "#E9DEC4" : "#2A2114" }}>
      {src ? <img src={src} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        : <div className="sa-skel" aria-hidden="true" style={{ position: "absolute", inset: 0 }} />}
      <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "45%", pointerEvents: "none",
        background: a11y ? "linear-gradient(180deg, rgba(250,244,230,0) 0%, rgba(250,244,230,0.55) 100%)" : "linear-gradient(180deg, rgba(20,16,9,0) 0%, rgba(28,22,13,0.75) 100%)" }} />
      {canEdit ? (
        <button type="button" data-lp-edit="" data-lens="disc" aria-label="Сменить фото урока" onClick={open} onTouchStart={(e) => e.stopPropagation()}
          style={{ position: "absolute", top: 10, right: 10, width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center", border: 0, cursor: "pointer",
            color: "#F4E9CF", background: "rgba(20,15,8,0.55)", boxShadow: "inset 0 0 0 1px rgba(232,201,131,0.55), 0 4px 12px rgba(0,0,0,0.35)",
            WebkitBackdropFilter: "blur(8px)", backdropFilter: "blur(8px)" }}><CamIcon s={18} /></button>
      ) : null}
    </div>
    {sheetEl}
  </>);
}

/** Лист «Фото урока»: выбрать с телефона, убрать, куда ставить (сеть или своё заведение) */
// v157 (Доп. 481): тот же лист — для обложек разделов («Справочник», раздел трека): kind="section", слова свои
const SHEET_WORDS = {
  lesson: { title: "Фото урока", of: "урока", at: "у урока", drop: "Да, убрать фото у урока",
    tip: "Подойдёт зал, команда на фоне ресторана, блюдо или деталь сервировки. Лучше горизонтальное — фото встанет над текстом урока" },
  section: { title: "Фото раздела", of: "раздела", at: "у раздела", drop: "Да, убрать фото у раздела",
    tip: "Подойдёт зал, команда на фоне ресторана, блюдо или деталь сервировки. Лучше горизонтальное: фото встанет обложкой раздела" },
};
export function LessonPhotoSheet({ lessonId, lessonTitle, profile, a11y, list, onClose, kind = "lesson", note = "" }) {
  const W = SHEET_WORDS[kind] || SHEET_WORDS.lesson;
  const missing = list === "missing" || !list;
  const e = !missing && list.map ? list.map[lessonId] || null : null;
  const [scope, setScope] = React.useState(() => (missing ? null : defaultScope(list, lessonId)));
  const [busy, setBusy] = React.useState("");
  const [msg, setMsg] = React.useState(() => (list === "missing" ? lessonPhotoErr("missing", isOwner(profile)) : ""));
  const [sure, setSure] = React.useState(false);
  const [thumb, setThumb] = React.useState(null);
  const here = !missing && scope !== null ? (scope === "" ? e && e.net : e && e.venue) : null;
  React.useEffect(() => {
    setSure(false);
    if (!here) { setThumb(null); return undefined; }
    let live = true;
    const c = lessonPhotoCached(lessonId, here.ver, false) || lessonPhotoCached(lessonId, here.ver, true);
    if (c) setThumb(c); else { setThumb(null); lessonPhotoUrl(lessonId, here.ver, false, scope).then((u) => { if (live) setThumb(u); }); }
    return () => { live = false; };
  }, [lessonId, here && here.ver, scope]);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    const k = (ev) => { if (ev.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const pick = async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!f || busy || scope === null) return;
    setMsg(""); setBusy("Сжимаю фото…");
    let ph;
    try { ph = await compressPhoto(f); } catch (er) { setBusy(""); setMsg(lessonPhotoErr(String(er && er.message || ""), isOwner(profile))); vibrate("error"); return; }
    setBusy("Загружаю…");
    const r = await saveLessonPhoto(lessonId, scope, ph, fullName(profile));
    setBusy("");
    if (!r.ok) { setMsg(lessonPhotoErr(r.error, isOwner(profile))); vibrate("error"); return; }
    vibrate("success");
    onClose();
  };
  const drop = async () => {
    if (!here || busy) return;
    if (!sure) { setSure(true); vibrate("light"); return; }
    setMsg(""); setBusy("Убираю…");
    const r = await removeLessonPhoto(lessonId, scope);
    setBusy("");
    if (!r.ok) { setMsg(lessonPhotoErr(r.error, isOwner(profile))); vibrate("error"); return; }
    vibrate("success");
    onClose();
  };
  const c = a11y
    ? { bg: "linear-gradient(180deg,#FFF9EC,#F4E8CD)", base: "#F7EEDB", edge: "rgba(139,106,48,0.42)", text: "#2A2113", sub: "#6B5A3E", gold: "#7A5A1E", veil: "rgba(70,52,24,0.42)", err: "#9A3B24" }
    : { bg: "linear-gradient(180deg,#2E2312,#1E170C)", base: "#241B0E", edge: "rgba(214,178,102,0.45)", text: "#EFE4C8", sub: "#B3A58A", gold: "#E8C983", veil: "rgba(8,6,3,0.66)", err: "#F0A08A" };
  // видно сейчас (своё заведение или сеть) — когда ставят туда, где фото ещё нет: «твоё заменит его для …»
  const seen = !missing && e ? e.best : null;
  const two = !missing && list.can.net && list.can.venue && list.restaurant;
  const seg = (val, label) => {
    const on = scope === val;
    return (
      <button type="button" data-lp-scope={val === "" ? "net" : "venue"} data-lens-btn={on ? "tab" : "soft"} aria-pressed={on} onClick={() => { vibrate("light"); setScope(val); setMsg(""); }}
        style={{ flex: 1, minHeight: 40, borderRadius: 999, border: "1px solid " + (on ? c.gold : c.edge), background: on ? (a11y ? "rgba(176,138,70,0.16)" : "rgba(214,178,102,0.14)") : "transparent",
          color: on ? c.gold : c.sub, fontFamily: SERIF, fontWeight: on ? "bold" : "normal", fontSize: 14, cursor: "pointer", padding: "0 10px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</button>
    );
  };
  const body = (
    <div data-lp-sheet="" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9600, background: c.veil, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div role="dialog" aria-modal="true" aria-label={W.title} data-lp-kind={kind} data-lens-card="" data-lens-float="" onClick={(ev) => ev.stopPropagation()}
        className="sa-panel-in"
        style={{ position: "relative", width: "100%", maxWidth: 520, borderRadius: "22px 22px 0 0", padding: "16px 16px calc(18px + env(safe-area-inset-bottom, 0px))", fontFamily: SERIF,
          backgroundColor: c.base, backgroundImage: c.bg, border: "1px solid " + c.edge, borderBottom: 0, boxShadow: "0 -12px 40px rgba(0,0,0,0.45)", color: c.text }}>
        <button type="button" aria-label="Закрыть" data-lens="disc" data-lens-x="" onClick={onClose}
          style={{ position: "absolute", top: 8, right: 8, width: 40, height: 40, borderRadius: "50%", border: 0, background: "none", color: c.sub, fontSize: 22, lineHeight: 1, cursor: "pointer" }}>×</button>
        <div style={{ fontSize: 19, fontWeight: "bold", paddingRight: 40 }}>{W.title}</div>
        {lessonTitle ? <div style={{ fontSize: 13.5, fontStyle: "italic", color: c.sub, marginTop: 2, paddingRight: 40 }}>{lessonTitle}</div> : null}
        {two ? <div style={{ display: "flex", gap: 8, marginTop: 14 }}>{seg("", "Вся сеть")}{seg(list.restaurant, "«" + list.restaurant + "»")}</div> : null}
        {!here && seen ? (
          <div data-lp-other="" style={{ fontSize: 13.5, lineHeight: 1.45, color: c.sub, marginTop: 14 }}>
            {scope && !seen.scope
              ? "Сейчас " + W.at + " фото всей сети" + (seen.by ? " (поставил(а) " + seen.by + ")" : "") + ". Новое заменит его для «" + scope + "»."
              : "У «" + seen.scope + "» своё фото " + W.of + " — его там и видят. Фото сети увидят остальные заведения."}
          </div>
        ) : null}
        {here ? (
          <div data-lp-now="" style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14 }}>
            <div style={{ width: 92, height: 62, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: a11y ? "#E9DEC4" : "#2A2114", boxShadow: "inset 0 0 0 1px " + c.edge }}>
              {thumb ? <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : null}
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.4, color: c.sub }}>Сейчас: {scopeName(scope)}{here.by ? <><br />поставил(а) {here.by}</> : null}</div>
          </div>
        ) : null}
        <div style={{ fontSize: 14, lineHeight: 1.5, color: c.sub, marginTop: 14 }}>
          {missing ? null : W.tip + (scope === "" ? " у всей сети." : scope ? " у «" + scope + "»." : ".")}
        </div>
        {/* v157: что на обложке сейчас, если это не своё фото раздела (фото урока или снимок из справочника) */}
        {note && !missing && !here ? <div data-lp-note="" style={{ fontSize: 13.5, lineHeight: 1.45, color: c.sub, marginTop: 8 }}>{note}</div> : null}
        {msg ? <div data-lp-msg="" role="status" style={{ fontSize: 14, lineHeight: 1.45, color: list === "missing" ? c.text : c.err, marginTop: 10 }}>{msg}</div> : null}
        {busy ? <div data-lp-busy="" role="status" style={{ fontSize: 14, fontStyle: "italic", color: c.gold, marginTop: 10 }}>{busy}</div> : null}
        {!missing && scope !== null ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
            <label data-lp-pick="" data-lens-btn="main" className="sa-btn" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 50, borderRadius: 999,
              background: "linear-gradient(172deg,#F1DBA4 0%,#DDBE7F 46%,#BC9A5E 100%)", color: "#24180A", fontWeight: "bold", fontSize: 16, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
              <CamIcon s={18} />{here ? "Сменить фото" : "Выбрать фото"}
              <input type="file" accept="image/*" onChange={pick} disabled={!!busy} style={{ display: "none" }} />
            </label>
            {here ? (
              <button type="button" data-lp-drop={sure ? "sure" : ""} data-lens-btn="soft" onClick={drop} disabled={!!busy}
                style={{ minHeight: 44, borderRadius: 999, border: "1px solid " + (sure ? c.err : c.edge), background: "transparent", color: sure ? c.err : c.sub, fontFamily: SERIF, fontSize: 15, cursor: "pointer" }}>
                {sure ? W.drop : "Убрать фото"}</button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
  if (typeof document === "undefined" || !document.body) return body;
  return createPortal(body, document.body);
}

// ── v157 (Доп. 481): обложки разделов — «Справочник» и раздел трека ─────────────────────────────────────────
/**
 * Фото по номеру и версии: сначала превью, потом целиком (память — lib/lesson-photo.js). → { src, gone }.
 * wantFull = false — только превью (соседняя страница трека: фото видно краем, целое не тянем).
 * gone — фото не пришло совсем (нет связи): место под обложку не держим. Нет версии — { src: null, gone: false }.
 */
export function useCover(id, ver, wantFull = true) {
  const first = () => (id && ver ? (wantFull ? lessonPhotoCached(id, ver, true) : null) || lessonPhotoCached(id, ver, false) || lessonPhotoCached(id, ver, true) : null);
  const [st, setSt] = React.useState(() => ({ src: first(), gone: false }));
  React.useEffect(() => {
    const put = (src, gone) => setSt((x) => (x.src === src && x.gone === gone ? x : { src, gone }));   // то же самое — без лишней перерисовки
    if (!id || !ver) { put(null, false); return undefined; }
    let live = true;
    const full = lessonPhotoCached(id, ver, true);
    if (full && wantFull) { put(full, false); return undefined; }
    const have = lessonPhotoCached(id, ver, false) || full;
    put(have, false);
    const a = lessonPhotoUrl(id, ver, false).then((u) => { if (live && u) setSt((x) => (x.src ? x : { src: u, gone: false })); return u; });
    const b = wantFull ? lessonPhotoUrl(id, ver, true).then((u) => { if (live && u) put(u, false); return u; }) : Promise.resolve(null);
    Promise.all([a, b]).then(([x, y]) => { if (live && !x && !y && !have) put(null, true); });
    return () => { live = false; };
  }, [id, ver, wantFull]);
  return st;
}
/** То же, только само фото (карточки «Справочника»: высота карточки от фото не зависит) */
export const useCoverSrc = (id, ver) => useCover(id, ver).src;
/** Может ли человек ставить обложки: по списку с сервера, а без этапа 51 — руководителю покажем, что обновить */
export const canEditCovers = (list, profile) => (list === "missing" ? isBoss(profile) : canEditPhotos(list));
/**
 * Кнопка с фотоаппаратом у обложки раздела (видит только тот, кто может ставить фото) и лист «Фото раздела».
 * Стоит внутри карточки-кнопки, поэтому нажатие дальше не идёт.
 */
export function CoverEditButton({ id, title = "", profile, a11y = false, list, note = "", onPhoto = false, passive = false, style }) {
  const [sheet, setSheet] = React.useState(false);
  if (!id || !canEditCovers(list, profile)) return null;
  const open = (e) => { if (e) { e.stopPropagation(); if (e.preventDefault) e.preventDefault(); } vibrate("light"); setSheet(true); };
  const stop = (e) => e.stopPropagation();
  return (<>
    <button type="button" data-cover-edit={id} data-lens={onPhoto ? undefined : "disc"} aria-label={"Фото раздела «" + title + "»"} onClick={passive ? undefined : open} onKeyDown={stop} onTouchStart={stop}
      tabIndex={passive ? -1 : undefined} aria-hidden={passive ? "true" : undefined}
      style={{ position: "absolute", top: 9, right: 9, zIndex: 2, width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center", border: 0, cursor: "pointer", padding: 0,
        color: onPhoto ? "#F4E9CF" : (a11y ? "#7A5D2A" : "#E8C983"), background: onPhoto ? "rgba(20,15,8,0.55)" : (a11y ? "rgba(139,106,48,0.10)" : "rgba(200,169,110,0.13)"),
        boxShadow: onPhoto ? "inset 0 0 0 1px rgba(232,201,131,0.55), 0 4px 12px rgba(0,0,0,0.35)" : "inset 0 0 0 1px " + (a11y ? "rgba(139,106,48,0.42)" : "rgba(214,178,102,0.4)"),
        pointerEvents: passive ? "none" : undefined, ...style }}>
      <CamIcon s={16} /></button>
    {sheet ? <span onClick={stop} onKeyDown={stop}><LessonPhotoSheet kind="section" lessonId={id} lessonTitle={title} profile={profile} a11y={a11y} list={list} note={note} onClose={() => setSheet(false)} /></span> : null}
  </>);
}
