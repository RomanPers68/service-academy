// ui/staff-photo.jsx — v158 (Доп. 483): фото сотрудников в кружках и лист «Моё фото».
// Логика (список, чьё фото у строки графика, память и телефон, кадр, сжатие, сервер) — lib/staff-photo.js, сервер — этап 52.
//
// Владелец (14.11) на «что ещё заметил»: «Давай все пять». Четвёртое из пяти: «Фото сотрудников в кружках вместо букв».
//   • FaceImg — фото поверх букв: ставится внутрь любого готового кружка (кружок остаётся как был — размер, ободок,
//     буквы; фото есть — оно закрывает буквы, нет — ничего не меняется). Так фото встали в «Смену», «График» и «Команду»
//     без переделки этих экранов.
//   • MyFaceLayer — свой кружок во вкладке «Я»: нажатие открывает лист «Моё фото»; фото ещё нет — на кружке маленький
//     фотоаппарат (не навязываем, но подсказываем).
//   • StaffPhotoSheet — лист: выбрать фото с телефона, подвинуть и приблизить в круге, сохранить; убрать своё фото.
//     Руководителю — строка «Фото команды»: фото своих сотрудников и кнопка «Убрать» (неудачное фото).
import React from "react";
import { createPortal } from "react-dom";
import { decodePhoto } from "../lib/chat-photo";
import { vibrate } from "../lib/utils";
import {
  loadStaffPhotos, staffPhotoListNow, staffPhotoSubscribe, staffPhotoOf, staffThumbCached, staffThumbUrl, staffFullUrl,
  saveStaffPhoto, removeStaffPhoto, staffPhotosToModerate, staffPhotoErr, initialsOfPerson,
  showFace, hideFace, faceNow, faceSubscribe, faceName, faceSubline,
  cropInit, cropMove, cropZoom, cropRect, cropSide, squarePhoto, CROP_MAX_ZOOM,
} from "../lib/staff-photo";
import { CamIcon } from "./lesson-photo";

const SERIF = "Georgia, 'Times New Roman', serif";
const isOwner = (p) => !!p && (!!p.is_admin || String(p.position || "") === "senior");

/** Список фото сотрудников (живой): что известно сейчас + один запрос за заход */
export function useStaffPhotos() {
  const [list, setList] = React.useState(() => staffPhotoListNow());
  React.useEffect(() => {
    const off = staffPhotoSubscribe((v) => setList(v));
    loadStaffPhotos().then((v) => { if (v !== undefined) setList(v); });
    return off;
  }, []);
  return list;
}

/** Превью по записи списка: из памяти сразу, иначе с телефона или сервера. → data: URL или null */
export function useStaffThumb(entry) {
  const id = entry ? entry.id : "", ver = entry ? entry.ver : "";
  const k = id && ver ? id + "|" + ver : "";
  const [st, setSt] = React.useState(() => ({ k, src: k ? staffThumbCached(id, ver) : null }));
  React.useEffect(() => {
    if (!k) { setSt((x) => (x.k === "" ? x : { k: "", src: null })); return undefined; }
    const have = staffThumbCached(id, ver);
    if (have) { setSt((x) => (x.k === k && x.src === have ? x : { k, src: have })); return undefined; }
    let live = true;
    staffThumbUrl(id, ver).then((u) => { if (live) setSt({ k, src: u || null }); });
    return () => { live = false; };
  }, [k]);   // eslint-disable-line react-hooks/exhaustive-deps
  // Состояние отстаёт от списка на одну отрисовку: фото сняли или в кружке уже другой человек — прежнее фото не
  // показываем ни на кадр (и не читаем поля у записи, которой уже нет).
  if (!k) return null;
  return st.k === k ? st.src : staffThumbCached(id, ver);
}

/**
 * Фото поверх букв. Ставится последним ребёнком внутрь кружка с position: relative (скругление берёт у кружка).
 * who — { id } (номер сотрудника: чат, свой профиль) или { full | name, surname, restaurant } (строка графика, рейтинг).
 * Фото нет, нет этапа 52, тёзки — ничего не рисует: в кружке остаются буквы.
 * v160 (Доп. 485): zoom — по нажатию на лицо открыть фото крупно (FaceViewer); sub — подпись под именем (должность).
 * Нажатие дальше не идёт: строка или карточка под кружком своё действие не выполняет. Без zoom фото касаний не ловит,
 * как раньше, — так оно стоит в кнопках, у которых своё дело (строка чата, выбор человека, «Пульс недели»).
 */
export function FaceImg({ who, style, zoom = false, quiet = false, sub = "" }) {
  const list = useStaffPhotos();
  const e = staffPhotoOf(list, who);
  const src = useStaffThumb(e);
  if (!e || !src) return null;
  if (zoom) {
    const open = (ev) => { ev.stopPropagation(); ev.preventDefault(); vibrate("light"); showFace(e, sub); };
    // долгое нажатие на телефоне не предлагает «сохранить картинку»: это лицо коллеги, а не файл
    const st = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit", display: "block", pointerEvents: "auto", cursor: "zoom-in", WebkitTapHighlightColor: "transparent",
      WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none", ...style };
    // quiet — кружок стоит там, где он скрыт от чтения с экрана (aria-hidden) или внутри карточки-кнопки: там фото
    // открывается касанием, но кнопкой не объявляется и в обход по клавишам не встаёт (имя человека читается рядом)
    if (quiet) return <img data-face={e.id} data-face-zoom="quiet" src={src} alt="" draggable={false} onClick={open} style={st} />;
    return <img data-face={e.id} data-face-zoom="" src={src} alt="" draggable={false} role="button" tabIndex={0} aria-label={"Фото крупно: " + faceName(e)}
      onClick={open} onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") open(ev); }} style={st} />;
  }
  return <img data-face={e.id} src={src} alt="" draggable={false}
    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit", display: "block", pointerEvents: "none", ...style }} />;
}

/** v160: запись списка фото для человека, когда превью уже готово (иначе null), — для своих кнопок «открыть крупно» */
export function useFace(who) {
  const list = useStaffPhotos();
  const e = staffPhotoOf(list, who);
  const src = useStaffThumb(e);
  return e && src ? e : null;
}

/**
 * v160: значок «увеличить» в углу кружка — только когда фото есть. Подсказка, что лицо открывается крупно: стоит там,
 * где кружок — главное фото человека (карточка коллеги в чате, строка выбранного коллеги в графике). Касаний не ловит.
 */
export function FaceZoomHint({ who, size = 18 }) {
  const e = useFace(who);
  if (!e) return null;
  return (
    <span data-face-hint="" aria-hidden="true" style={{ position: "absolute", right: -4, bottom: -4, width: size, height: size, borderRadius: "50%", display: "grid", placeItems: "center", pointerEvents: "none",
      color: "#E8C983", background: "#261D10", boxShadow: "0 0 0 1px rgba(214,178,102,0.6)" }}>
      <svg width={Math.round(size * 0.58)} height={Math.round(size * 0.58)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h6v6" /><path d="M10 20H4v-6" /><path d="M20 4l-7 7" /><path d="M4 20l7-7" /></svg>
    </span>
  );
}

/**
 * v160: лицо отдельным кружком — только когда фото есть (нет фото — ничего не рисует): для строк, где буквы человека
 * уже стоят рядом (строка «позвонить» под кружками в графике). Нажатие открывает фото крупно.
 */
export function FaceChip({ who, size = 36, sub = "", hint = true }) {
  const e = useFace(who);
  if (!e) return null;
  return (
    <span data-face-chip={e.id} style={{ position: "relative", width: size, height: size, borderRadius: "50%", flexShrink: 0, display: "inline-block", boxShadow: "0 0 0 1.5px rgba(214,178,102,0.6)" }}>
      <FaceImg who={{ id: e.id }} zoom sub={sub} />
      {hint ? <FaceZoomHint who={{ id: e.id }} size={16} /> : null}
    </span>
  );
}

/**
 * v160: фото в кружке-медали с короной («Сотрудник недели»): рисует фото поверх значка (по нажатию — крупно) и ту же
 * маленькую корону над ним, что у лидера в «Пульсе недели» на главной. Нет фото — ничего: в медали остаётся её значок.
 */
export function CrownFace({ who, sub = "", crown = 16 }) {
  const e = useFace(who);
  if (!e) return null;
  return (<>
    <FaceImg who={{ id: e.id }} zoom sub={sub} />
    <span data-face-crown="" aria-hidden="true" style={{ position: "absolute", top: -Math.round(crown * 0.56), left: "50%", marginLeft: -crown / 2, lineHeight: 0, transform: "rotate(-9deg)", pointerEvents: "none",
      filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,0.6))" }}>
      <svg width={crown} height={crown} viewBox="0 0 24 24"><path d="M5 16.4L3.3 7.7l4.9 3.5L12 5.3l3.8 5.9 4.9-3.5L19 16.4z" fill="#F2D89A" stroke="#3A2A0E" strokeWidth="1.5" strokeLinejoin="round" /><path d="M5.4 19.7h13.2" stroke="#F2D89A" strokeWidth="2.3" strokeLinecap="round" /></svg>
    </span>
  </>);
}

/**
 * v160: фото поверх готового кружка, в который нельзя добавить ребёнка (кружок рисует другой компонент): обёртка того
 * же размера, фото ложится поверх. Кружок внутри остаётся как был — буквы, ободок, размер.
 */
export function FaceOver({ who, zoom = false, quiet = false, sub = "", children }) {
  return <span data-face-over="" style={{ position: "relative", display: "inline-grid", flexShrink: 0, borderRadius: "50%" }}>{children}<FaceImg who={who} zoom={zoom} quiet={quiet} sub={sub} /></span>;
}

// тёмная или светлая цифра на медали: по яркости её цвета (#RRGGBB); не цвет — как на тёмной
const inkOn = (hex) => { const m = /^#([0-9a-f]{6})$/i.exec(String(hex || "")); if (!m) return "#F3E7CC";
  const n = parseInt(m[1], 16); const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; return l > 0.5 ? "#2A1F0A" : "#FFF8E8"; };

/**
 * v160: место в рейтинге на фото. Есть фото — кружок с лицом, ободок цвета медали и номер места в углу; фото нет —
 * прежний кружок с номером (children): у кого фото нет, тот видит рейтинг как раньше. В «Рейтинге» нажатие на строку
 * открывает разбор, фото крупно — уже там; в «Лиге недели» строка сама ничего не открывает — фото крупно прямо из неё (zoom).
 */
export function RankFace({ who, n, medal = "", a11y = false, size = 38, zoom = false, sub = "", children = null }) {
  const e = useFace(who);
  if (!e) return children;
  const rim = medal || (a11y ? "rgba(122,93,42,0.6)" : "rgba(214,178,102,0.55)");
  return (
    <span data-rank-face={e.id} style={{ position: "relative", width: size, height: size, flexShrink: 0, display: "inline-block", borderRadius: "50%", boxShadow: `0 0 0 1.5px ${rim}` }}>
      <FaceImg who={{ id: e.id }} zoom={zoom} sub={sub} />
      <b data-rank-n="" style={{ position: "absolute", right: -5, bottom: -4, minWidth: 18, height: 18, padding: "0 4px", boxSizing: "border-box", borderRadius: 999, display: "grid", placeItems: "center",
        pointerEvents: "none", fontFamily: SERIF, fontSize: 10.5, lineHeight: 1, fontWeight: "bold", fontVariantNumeric: "tabular-nums",
        color: medal ? inkOn(medal) : (a11y ? "#3A2A0E" : "#F3E7CC"), background: medal || (a11y ? "#F4E9CF" : "#2B2114"),
        boxShadow: `0 0 0 1.5px ${a11y ? "#FBF5E6" : "#1B150B"}` }}>{n}</b>
    </span>
  );
}

/**
 * v160 (Доп. 485): фото крупно — один слой на всё приложение (стоит в App, рисуется в document.body поверх чата и
 * листов). Круг, как человек сам выбрал кадр в «Моём фото»; под ним имя и строка «должность · заведение». Сначала
 * превью, которое уже есть в кружке, потом фото целиком (с телефона или с сервера, этап 52: staff_photo, p_full).
 * Закрывается касанием мимо фото, крестиком, Esc и кнопкой «назад» Telegram (data-sa-back). Фото сняли, пока смотрели, —
 * слой закрывается сам. Тема тёмная в обоих видах приложения: так смотрят фото.
 */
export function FaceViewer() {
  const [view, setView] = React.useState(() => faceNow());
  React.useEffect(() => { setView(faceNow()); return faceSubscribe(setView); }, []);
  if (!view || typeof document === "undefined") return null;
  return createPortal(<FaceView key={view.id} view={view} />, document.body);
}
export function FaceView({ view }) {
  const list = useStaffPhotos();
  const known = !!list && list !== "missing" && !!list.byId;
  const live = known ? list.byId[view.id] || null : null;
  const ver = live ? live.ver : view.ver;
  const thumb = useStaffThumb({ id: view.id, ver });
  const [full, setFull] = React.useState(null);
  const [shown, setShown] = React.useState(false);
  const xRef = React.useRef(null);
  React.useEffect(() => {
    let on = true;
    setFull(null);
    staffFullUrl(view.id, ver).then((u) => { if (on && u) setFull(u); }).catch(() => { /* останется превью */ });
    return () => { on = false; };
  }, [view.id, ver]);
  React.useEffect(() => { if (known && !live) hideFace(); }, [known, live]);   // фото сняли, пока смотрели
  React.useEffect(() => {
    const t = setTimeout(() => setShown(true), 20);
    // Escape закрывает только фото: слушаем первыми (capture) и дальше не пускаем, чтобы лист под фото остался открытым
    const key = (ev) => { if (ev.key === "Escape") { ev.stopPropagation(); ev.stopImmediatePropagation(); hideFace(); } };
    window.addEventListener("keydown", key, true);
    // фокус — на крестик; закрыли — возвращаем туда, откуда открывали (с клавиатуры не теряется место в списке)
    const prev = typeof document !== "undefined" ? document.activeElement : null;
    try { if (xRef.current) xRef.current.focus({ preventScroll: true }); } catch (e) { /* */ }
    return () => { clearTimeout(t); window.removeEventListener("keydown", key, true);
      try { if (prev && prev !== document.body && typeof prev.focus === "function" && document.contains(prev)) prev.focus({ preventScroll: true }); } catch (e) { /* */ } };
  }, []);
  const close = (ev) => { if (ev) ev.stopPropagation(); vibrate("light"); hideFace(); };
  const line = faceSubline(view);
  return (
    <div data-face-view={view.id} role="dialog" aria-modal="true" aria-label={"Фото: " + view.name} onClick={close}
      style={{ position: "fixed", inset: 0, zIndex: 9700, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0, padding: "24px 20px",
        boxSizing: "border-box", background: "rgba(8,6,3,0.9)", WebkitBackdropFilter: "blur(8px)", backdropFilter: "blur(8px)", opacity: shown ? 1 : 0, transition: "opacity .18s ease",
        touchAction: "none", overscrollBehavior: "contain", WebkitTapHighlightColor: "transparent" }}>
      <button ref={xRef} type="button" data-sa-back="" data-face-x="" aria-label="Закрыть" onClick={close}
        style={{ position: "absolute", top: "calc(10px + var(--sa-st, env(safe-area-inset-top, 0px)))", right: 12, width: 44, height: 44, borderRadius: "50%", border: "1px solid rgba(232,201,131,0.4)",
          background: "rgba(30,23,12,0.7)", color: "#E8C983", fontSize: 24, lineHeight: 1, cursor: "pointer", display: "grid", placeItems: "center", padding: 0 }}>×</button>
      <div data-face-photo={full ? "full" : thumb ? "thumb" : "none"} onClick={(ev) => ev.stopPropagation()}
        style={{ position: "relative", width: "min(82vw, 54vh, 380px)", aspectRatio: "1 / 1", flexShrink: 0, borderRadius: "50%", overflow: "hidden", background: "#2A2114",
          boxShadow: "0 0 0 2px rgba(232,201,131,0.75), 0 0 0 7px rgba(232,201,131,0.12), 0 24px 70px rgba(0,0,0,0.65)", transform: shown ? "scale(1)" : "scale(0.94)", transition: "transform .22s cubic-bezier(.2,.9,.3,1)" }}>
        {thumb ? <img src={thumb} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block", filter: full ? "none" : "blur(1.5px)", WebkitTouchCallout: "none", userSelect: "none" }} /> : null}
        {full ? <img data-face-full="" src={full} alt={view.name} draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block", WebkitTouchCallout: "none", userSelect: "none" }} /> : null}
      </div>
      <div data-face-name="" onClick={(ev) => ev.stopPropagation()} style={{ marginTop: 20, maxWidth: "100%", textAlign: "center", fontFamily: SERIF, fontSize: 22, lineHeight: 1.25, fontWeight: "bold", color: "#EFE4C8" }}>{view.name}</div>
      {line ? <div data-face-sub="" onClick={(ev) => ev.stopPropagation()} style={{ marginTop: 5, maxWidth: "100%", textAlign: "center", fontFamily: SERIF, fontSize: 14, lineHeight: 1.4, color: "#B3A58A" }}>{line}</div> : null}
    </div>
  );
}

/**
 * Свой кружок во вкладке «Я» (стоит внутри кружка с буквами, position: relative): фото поверх букв, кнопка на весь
 * кружок и лист «Моё фото». Нет этапа 52: сотруднику — как раньше (не нажимается), владельцу — лист с подсказкой.
 */
export function MyFaceLayer({ profile, a11y = false }) {
  const list = useStaffPhotos();
  const [sheet, setSheet] = React.useState(false);
  const missing = list === "missing";
  const me = !missing && list && profile ? staffPhotoOf(list, { id: profile.id || list.me }) : null;
  const src = useStaffThumb(me);
  // Пока не известно, есть ли на сервере этап 52 (список ещё не пришёл и копии на телефоне нет), кружок прежний: иначе у
  // сотрудника при каждом запуске на миг появлялся бы и пропадал фотоаппарат.
  if (!profile || !list || (missing && !isOwner(profile))) return null;
  const gold = a11y ? "#7A5D2A" : "#E8C983";
  const has = !!me && !!src;
  const open = (e) => { if (e) e.stopPropagation(); vibrate("light"); setSheet(true); };
  return (<>
    {has ? <img data-face={me.id} src={src} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%", display: "block", pointerEvents: "none" }} /> : null}
    <button type="button" data-my-face={has ? "photo" : "add"} aria-label={has ? "Моё фото: сменить" : "Добавить своё фото"} onClick={open}
      style={{ position: "absolute", inset: -4, borderRadius: "50%", border: 0, padding: 0, background: "transparent", cursor: "pointer", WebkitTapHighlightColor: "transparent" }} />
    {!has ? (
      <span data-my-face-badge="" aria-hidden="true" style={{ position: "absolute", right: -4, bottom: -4, width: 20, height: 20, borderRadius: "50%", display: "grid", placeItems: "center", pointerEvents: "none",
        color: gold, background: a11y ? "#F6ECD6" : "#261D10", boxShadow: "0 0 0 1px " + (a11y ? "rgba(139,106,48,0.5)" : "rgba(214,178,102,0.55)") }}><CamIcon s={12} /></span>
    ) : null}
    {sheet ? <StaffPhotoSheet profile={profile} a11y={a11y} list={list} onClose={() => setSheet(false)} /> : null}
  </>);
}

const palette = (a11y) => (a11y
  ? { bg: "linear-gradient(180deg,#FFF9EC,#F4E8CD)", base: "#F7EEDB", edge: "rgba(139,106,48,0.42)", text: "#2A2113", sub: "#6B5A3E", gold: "#7A5A1E", veil: "rgba(70,52,24,0.42)", err: "#9A3B24", pit: "#E9DEC4" }
  : { bg: "linear-gradient(180deg,#2E2312,#1E170C)", base: "#241B0E", edge: "rgba(214,178,102,0.45)", text: "#EFE4C8", sub: "#B3A58A", gold: "#E8C983", veil: "rgba(8,6,3,0.66)", err: "#F0A08A", pit: "#2A2114" });

// открыть фото с телефона и уменьшить до рабочего размера (кадр двигаем по нему, из него же режем итог)
const WORK_SIDE = 1600;
async function openWork(file) {
  if (!file || (file.type && !/^image\//.test(file.type))) throw new Error("type");
  const src = await decodePhoto(file);
  const sw = src.width || src.naturalWidth || 0, sh = src.height || src.naturalHeight || 0;
  if (!sw || !sh) throw new Error("decode");
  const k = Math.min(1, WORK_SIDE / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * k)), h = Math.max(1, Math.round(sh * k));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("decode");
  g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
  g.drawImage(src, 0, 0, w, h);
  try { if (typeof src.close === "function") src.close(); } catch (e) { /* */ }
  const blob = await new Promise((res) => { try { canvas.toBlob((b) => res(b), "image/jpeg", 0.9); } catch (e) { res(null); } });
  if (!blob) throw new Error("decode");
  return { canvas, w, h, url: URL.createObjectURL(blob) };
}

/** Лист «Моё фото»: выбрать и кадрировать, убрать; руководителю — «Фото команды» */
export function StaffPhotoSheet({ profile, a11y = false, list, onClose }) {
  const missing = list === "missing";
  const ready = !!list && !missing;
  const myId = profile && profile.id ? String(profile.id) : ready ? list.me : "";
  const me = ready ? staffPhotoOf(list, { id: myId }) : null;
  const team = ready ? staffPhotosToModerate(list) : [];
  const [mode, setMode] = React.useState("me");          // me — моё фото, crop — кадр, team — фото команды
  const [busy, setBusy] = React.useState("");
  const [msg, setMsg] = React.useState(() => (missing ? staffPhotoErr("missing", isOwner(profile)) : ""));
  const [sure, setSure] = React.useState("");            // "me" или номер сотрудника: «точно убрать?»
  const [big, setBig] = React.useState(null);
  const [work, setWork] = React.useState(null);          // { canvas, w, h, url } — выбранное фото
  const [crop, setCrop] = React.useState(null);
  const c = palette(a11y);
  const thumb = useStaffThumb(me);
  React.useEffect(() => {
    if (!me) { setBig(null); return undefined; }
    let live = true;
    staffFullUrl(me.id, me.ver).then((u) => { if (live) setBig(u); });
    return () => { live = false; };
  }, [me && me.id, me && me.ver]);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    const k = (ev) => { if (ev.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  React.useEffect(() => () => { if (work && work.url) { try { URL.revokeObjectURL(work.url); } catch (e) { /* */ } } }, [work]);
  React.useEffect(() => { if (mode === "team" && !team.length) setMode("me"); }, [mode, team.length]);

  const pick = async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!f || busy) return;
    setMsg(""); setSure(""); setBusy("Открываю фото…");
    try {
      const w = await openWork(f);
      setWork(w); setCrop(cropInit(w.w, w.h)); setMode("crop");
    } catch (er) { setMsg(staffPhotoErr(String((er && er.message) || ""), isOwner(profile))); vibrate("error"); }
    setBusy("");
  };
  const save = async () => {
    if (!work || !crop || busy) return;
    setMsg(""); setBusy("Сохраняю…");
    let ph;
    try { ph = await squarePhoto(work.canvas, cropRect(crop, work.w, work.h)); } catch (er) { setBusy(""); setMsg(staffPhotoErr("big")); vibrate("error"); return; }
    const r = await saveStaffPhoto(ph, { id: "", name: profile.name, surname: profile.surname, restaurant: profile.restaurant });
    setBusy("");
    if (!r.ok) { setMsg(staffPhotoErr(r.error, isOwner(profile))); vibrate("error"); return; }
    vibrate("success");
    onClose();
  };
  const drop = async (id) => {
    if (busy) return;
    const key = id || "me";
    if (sure !== key) { setSure(key); vibrate("light"); return; }
    setMsg(""); setBusy("Убираю…");
    const r = await removeStaffPhoto(id || null);
    setBusy(""); setSure("");
    if (!r.ok) { setMsg(staffPhotoErr(r.error, isOwner(profile))); vibrate("error"); return; }
    vibrate("success");
    if (!id) onClose();
  };

  // ── кадр: фото двигают пальцем, приближают двумя пальцами или ползунком ──
  const size = typeof window !== "undefined" ? Math.max(180, Math.min(264, (window.innerWidth || 390) - 96)) : 240;
  const ptrs = React.useRef(new Map());
  const pinch = React.useRef(0);
  const onDown = (e) => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch (er) { /* */ } ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); pinch.current = 0; };
  const onMove = (e) => {
    const p = ptrs.current.get(e.pointerId);
    if (!p || !work) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 1) { setCrop((k) => cropMove(k, dx, dy, work.w, work.h, size)); return; }
    const [a, b] = [...ptrs.current.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinch.current > 0 && dist > 0) setCrop((k) => cropZoom(k, k.z * (dist / pinch.current), work.w, work.h));
    pinch.current = dist;
  };
  const onUp = (e) => { ptrs.current.delete(e.pointerId); pinch.current = 0; };
  const onWheel = (e) => { if (!work) return; setCrop((k) => cropZoom(k, k.z * (e.deltaY < 0 ? 1.08 : 1 / 1.08), work.w, work.h)); };
  const scale = work && crop ? size / cropSide(work.w, work.h, crop.z) : 1;

  const btnMain = { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 50, borderRadius: 999, border: 0, width: "100%",
    background: "linear-gradient(172deg,#F1DBA4 0%,#DDBE7F 46%,#BC9A5E 100%)", color: "#24180A", fontFamily: SERIF, fontWeight: "bold", fontSize: 16, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 };
  const btnSoft = (hot) => ({ minHeight: 44, borderRadius: 999, border: "1px solid " + (hot ? c.err : c.edge), background: "transparent", color: hot ? c.err : c.sub, fontFamily: SERIF, fontSize: 15, cursor: "pointer", width: "100%" });
  const ini = initialsOfPerson(profile && profile.name, profile && profile.surname);
  const fullName = profile ? [profile.name, profile.surname].filter(Boolean).join(" ") : "";

  const body = (
    <div data-sp-sheet={mode} onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9600, background: c.veil, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div role="dialog" aria-modal="true" aria-label={mode === "team" ? "Фото команды" : "Моё фото"} data-lens-card="" data-lens-float="" onClick={(ev) => ev.stopPropagation()}
        className="sa-panel-in"
        style={{ position: "relative", width: "100%", maxWidth: 520, maxHeight: "92vh", overflowY: "auto", borderRadius: "22px 22px 0 0", padding: "16px 16px calc(18px + env(safe-area-inset-bottom, 0px))", fontFamily: SERIF,
          backgroundColor: c.base, backgroundImage: c.bg, border: "1px solid " + c.edge, borderBottom: 0, boxShadow: "0 -12px 40px rgba(0,0,0,0.45)", color: c.text }}>
        <button type="button" aria-label="Закрыть" data-lens="disc" data-lens-x="" onClick={onClose}
          style={{ position: "absolute", top: 8, right: 8, width: 40, height: 40, borderRadius: "50%", border: 0, background: "none", color: c.sub, fontSize: 22, lineHeight: 1, cursor: "pointer" }}>×</button>

        {mode === "team" ? (<>
          <button type="button" data-sp-back="" onClick={() => { setMode("me"); setSure(""); setMsg(""); }} style={{ border: 0, background: "none", color: c.gold, fontFamily: SERIF, fontSize: 14, padding: "2px 0", cursor: "pointer" }}>‹ Моё фото</button>
          <div style={{ fontSize: 19, fontWeight: "bold", paddingRight: 40, marginTop: 4 }}>Фото команды</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.45, color: c.sub, marginTop: 4 }}>Фото каждый ставит себе сам. Здесь можно убрать неудачное.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
            {team.map((x) => (
              <div key={x.id} data-sp-row={x.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: 14, border: "1px solid " + c.edge }}>
                <span style={{ position: "relative", width: 44, height: 44, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", background: c.pit, color: c.gold, fontSize: 15, fontWeight: "bold" }}>
                  {initialsOfPerson(x.name, x.surname)}<FaceImg who={{ id: x.id }} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{[x.name, x.surname].filter(Boolean).join(" ")}</span>
                  {list.can.network && x.restaurant ? <span style={{ display: "block", fontSize: 12.5, color: c.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.restaurant}</span> : null}
                </span>
                <button type="button" data-sp-drop={sure === x.id ? "sure" : ""} onClick={() => drop(x.id)} disabled={!!busy}
                  style={{ ...btnSoft(sure === x.id), width: "auto", minHeight: 36, padding: "0 14px", fontSize: 14, flexShrink: 0 }}>{sure === x.id ? "Точно убрать" : "Убрать"}</button>
              </div>
            ))}
          </div>
        </>) : mode === "crop" && work && crop ? (<>
          <div style={{ fontSize: 19, fontWeight: "bold", paddingRight: 40 }}>Моё фото</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.45, color: c.sub, marginTop: 4 }}>Подвинь фото, чтобы лицо было в круге. Так его увидят коллеги.</div>
          <div data-sp-stage="" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}
            style={{ position: "relative", width: size, height: size, margin: "16px auto 0", borderRadius: "50%", overflow: "hidden", touchAction: "none", cursor: "grab", background: c.pit,
              boxShadow: "0 0 0 2px " + c.gold + ", 0 10px 26px rgba(0,0,0,0.35)" }}>
            <img src={work.url} alt="" draggable={false} style={{ position: "absolute", maxWidth: "none", userSelect: "none", pointerEvents: "none",
              width: work.w * scale, height: work.h * scale, left: size / 2 - crop.cx * scale, top: size / 2 - crop.cy * scale }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px auto 0", maxWidth: 300 }}>
            <span aria-hidden="true" style={{ color: c.sub, fontSize: 18, lineHeight: 1 }}>−</span>
            <input type="range" data-sp-zoom="" aria-label="Приблизить" min="1" max={CROP_MAX_ZOOM} step="0.01" value={crop.z}
              onChange={(ev) => setCrop((k) => cropZoom(k, Number(ev.target.value), work.w, work.h))} style={{ flex: 1, accentColor: c.gold }} />
            <span aria-hidden="true" style={{ color: c.sub, fontSize: 18, lineHeight: 1 }}>+</span>
          </div>
          {msg ? <div data-sp-msg="" role="status" style={{ fontSize: 14, lineHeight: 1.45, color: c.err, marginTop: 10 }}>{msg}</div> : null}
          {busy ? <div data-sp-busy="" role="status" style={{ fontSize: 14, fontStyle: "italic", color: c.gold, marginTop: 10 }}>{busy}</div> : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
            <button type="button" data-sp-save="" data-lens-btn="main" className="sa-btn" onClick={save} disabled={!!busy} style={btnMain}>Сохранить</button>
            <label data-sp-other="" data-lens-btn="soft" style={{ ...btnSoft(false), display: "flex", alignItems: "center", justifyContent: "center" }}>Другое фото
              <input type="file" accept="image/*" onChange={pick} disabled={!!busy} style={{ display: "none" }} /></label>
          </div>
        </>) : (<>
          <div style={{ fontSize: 19, fontWeight: "bold", paddingRight: 40 }}>Моё фото</div>
          {fullName ? <div style={{ fontSize: 13.5, fontStyle: "italic", color: c.sub, marginTop: 2, paddingRight: 40 }}>{fullName}</div> : null}
          <div data-sp-now={me ? "photo" : "none"} style={{ position: "relative", width: 132, height: 132, margin: "16px auto 0", borderRadius: "50%", overflow: "hidden", display: "grid", placeItems: "center",
            background: c.pit, color: c.gold, fontSize: 40, fontWeight: "bold", boxShadow: "0 0 0 2px " + (me ? c.gold : c.edge) }}>
            {ini}
            {me && (big || thumb) ? <img src={big || thumb} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : null}
          </div>
          {!missing ? <div style={{ fontSize: 14, lineHeight: 1.5, color: c.sub, marginTop: 14, textAlign: "center" }}>
            Фото увидят коллеги по сети: в смене, графике и команде. Лучше портрет, где хорошо видно лицо.</div> : null}
          {msg ? <div data-sp-msg="" role="status" style={{ fontSize: 14, lineHeight: 1.45, color: missing ? c.text : c.err, marginTop: 10 }}>{msg}</div> : null}
          {busy ? <div data-sp-busy="" role="status" style={{ fontSize: 14, fontStyle: "italic", color: c.gold, marginTop: 10 }}>{busy}</div> : null}
          {!missing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
              <label data-sp-pick="" data-lens-btn="main" className="sa-btn" style={btnMain}>
                <CamIcon s={18} />{me ? "Сменить фото" : "Выбрать фото"}
                <input type="file" accept="image/*" onChange={pick} disabled={!!busy} style={{ display: "none" }} />
              </label>
              {me ? <button type="button" data-sp-drop={sure === "me" ? "sure" : ""} data-lens-btn="soft" onClick={() => drop("")} disabled={!!busy} style={btnSoft(sure === "me")}>{sure === "me" ? "Да, убрать моё фото" : "Убрать фото"}</button> : null}
              {team.length ? (
                <button type="button" data-sp-team={team.length} onClick={() => { vibrate("light"); setMode("team"); setSure(""); setMsg(""); }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 44, marginTop: 6, padding: "0 14px", borderRadius: 14, border: "1px solid " + c.edge, background: "transparent", color: c.text, fontFamily: SERIF, fontSize: 15, cursor: "pointer" }}>
                  <span>Фото команды</span><span style={{ color: c.sub }}>{team.length} ›</span></button>
              ) : null}
            </div>
          ) : null}
        </>)}
      </div>
    </div>
  );
  if (typeof document === "undefined" || !document.body) return body;
  return createPortal(body, document.body);
}
