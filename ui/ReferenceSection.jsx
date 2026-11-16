// ui/ReferenceSection.jsx
// Раздел «Справочник»: хаб → курс → глава → фото-тест.
// Использует реальные токены темы приложения (T = S | A), чтобы выглядеть родным.
import { RefArt } from "./reference-art";
import React from "react";
import { hintsFor } from "../data/hints";
import { useHintOnce, HintBubble } from "./widgets";
import { Ico, renderIll, splitLeadingFlag, hasIllMini, renderIllMini } from "./reference-illustrations";
import { REFERENCE_COURSE, REFERENCE_WINE_COURSE, REFERENCE_COFFEE_COURSE, REFERENCE_BAR_COURSE, REFERENCE_APP_COURSE } from "../data/reference";
import { SearchScreen } from "./search";
import { onActivate } from "../lib/utils";
import { GOLD, GREEN, RED, labelStyle } from "./tokens";
import { useWide, useColumn } from "./viewport";   // v52 (Доп. 365): курсы и главы — в две колонки на широком экране
import { refShareItem } from "../lib/share-items";   // v97 (Доп. 410): глава — в чат команды
import { CHAT_SHARE_IC } from "./share-chat";
import { wineRecords } from "../lib/wine";
import { useLessonPhotos, useCover, canEditCovers, CoverEditButton, LessonCover, CoverPhoto, PhotoWait } from "./lesson-photo";   // v157 (Доп. 481): обложки разделов; v158: фото главы; v163: фото проявляется
import { refCoverPick, photoOf, REF_COVER_DEFAULT, lessonPhotoId } from "../lib/lesson-photo";
import { chapterThumb } from "../lib/reference-thumb";   // v158 (Доп. 483): плитка главы в списке глав
import { mergeRefBook, RB_FIXED, REF_PHOTO_RE, refPhotoIds, refreshRefBook } from "../lib/ref-book";   // v167 (Доп. 492): справочник с правками владельца
import { useRefBook } from "./use-ref-book";

const R = React;
const SERIF = "Georgia, 'Times New Roman', serif";
// Маркеры-иконки в стиле уроков (📌 заметка, ☑ чек, 🚫 запрет, ✅ верно, ❌ неверно)
const MARK_RE = /^(📌|☑️?|🚫|✅|❌)\s*/u;

// ── Контент главы (bold/буллеты/нумерация в стиле уроков) ──
function inlineBold(s, T) {
  return s.split("**").map((p, i) => i % 2
    ? <b key={i} style={{ color: T.bold.color, fontWeight: "bold" }}>{p}</b>
    : <R.Fragment key={i}>{p}</R.Fragment>);
}
// v167 (Доп. 492): своё фото в тексте главы — строка [photo:номер] или [photo:номер|подпись]. Фото ставит владелец в
// редакторе справочника; хранится как фото урока на всю сеть (этап 51), поэтому едет и проявляется так же, как обложки.
// Фото убрали или этапа 51 нет — в тексте ничего (в редакторе — пометка, чтобы строку было видно).
function RefPhoto({ id, cap, gold, dark, note = false }) {
  const photos = useLessonPhotos();
  const own = photos && photos !== "missing" ? photoOf(photos, id) : null;
  const { src, gone } = useCover(own ? id : null, own ? own.ver : "", true);
  if (!own || gone) return note ? <div data-ref-photo-gone={id} style={{ margin: "8px 0 16px", padding: "10px 12px", borderRadius: 12, border: `1px dashed ${gold}66`, color: gold, fontSize: 12.5 }}>Фото не найдено: его убрали или оно ещё не загрузилось</div> : null;
  const ratio = own.w > 0 && own.h > 0 ? Math.min(1.6, Math.max(0.42, own.h / own.w)) : 0.66;
  return (<figure data-ref-own-photo={id} style={{ margin: "8px 0 16px" }}>
    <div style={{ position: "relative", width: "100%", paddingTop: (ratio * 100).toFixed(2) + "%", borderRadius: 14, overflow: "hidden", background: dark ? "rgba(200,169,110,0.07)" : "rgba(139,106,48,0.07)" }}>
      <CoverPhoto src={src} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} wait={<PhotoWait />} />
    </div>
    {cap ? <figcaption style={{ marginTop: 6, textAlign: "center", fontSize: 12.5, fontStyle: "italic", color: dark ? "#C9BB9C" : "#5E4E34" }}>{cap}</figcaption> : null}
  </figure>);
}
function Content({ text, T, gold, dark, notes = false }) {
  return (<div>{String(text || "").split("\n").map((ln, i) => {
    const t = ln.trim();
    if (!t) return <div key={i} style={{ height: 10 }} />;
    const ph = t.match(REF_PHOTO_RE);
    if (ph) return <RefPhoto key={i} id={ph[1]} cap={(ph[2] || "").trim()} gold={gold} dark={dark} note={notes} />;
    const im = t.match(/^\[img:(.+)\]$/);
    if (im) {
      const keys = im[1].split(",").map(x => x.trim());
      return (<div key={i} style={{ display: "flex", flexDirection: "column", gap: 8, margin: "8px 0 16px" }}>
        {keys.map((k, j) => <div key={j} style={{ display: "flex", justifyContent: "center", overflow: "hidden", borderRadius: 14 }}>{renderIll(k, gold, dark)}</div>)}
      </div>);
    }
    if (t.startsWith("**") && t.endsWith("**")) {
      const { flag, rest } = splitLeadingFlag(t.replace(/\*\*/g, ""));
      return flag
        ? <div key={i} style={{ ...T.bold, display: "flex", alignItems: "center", gap: 8 }}>{flag}<span>{rest}</span></div>
        : <div key={i} style={T.bold}>{rest}</div>;
    }
    const mk = t.match(MARK_RE);
    if (mk) {
      const m = mk[1].replace("\uFE0F", "");
      const icon = m === "✅" ? Ico.check(GREEN, 15)
        : m === "❌" ? Ico.x(RED, 15)
        : Ico.pin(gold, 15);
      const st = m === "✅" ? T.good : m === "❌" ? T.bad : T.note;
      return (<div key={i} style={{ ...(st || T.para), display: "flex", gap: 8, alignItems: "flex-start" }}>
        <span style={{ flexShrink: 0, marginTop: 2, display: "inline-flex" }}>{icon}</span>
        <span style={{ flex: 1 }}>{inlineBold(t.replace(MARK_RE, ""), T)}</span>
      </div>);
    }
    if (t.startsWith("• ")) return (<div key={i} style={{ ...T.para, display: "flex", gap: 8, marginBottom: 4 }}><span style={{ color: gold }}>•</span><span style={{ flex: 1 }}>{inlineBold(t.slice(2), T)}</span></div>);
    const num = t.match(/^(\d+)\.\s+(.*)/);
    if (num) return (<div key={i} style={{ ...T.para, display: "flex", gap: 8, marginBottom: 4 }}><b style={{ color: gold }}>{num[1]}.</b><span style={{ flex: 1 }}>{inlineBold(num[2], T)}</span></div>);
    return <div key={i} style={T.para}>{inlineBold(t, T)}</div>;
  })}</div>);
}

export { Content as RefContent };   // v167: предпросмотр главы в редакторе — тем же кодом, что у сотрудника

function Head({ T, title, onBack }) {
  return (<div style={T.lessHead}><button className="sa-hit" style={T.backBtn2} data-lens="back" aria-label="Вернуться" onClick={onBack}>‹</button><div style={T.lessHeadTitle}>{title}</div></div>);
}
function Figure({ T, children }) {
  return (<div style={{ background: T.lessGlass.bg, border: T.lessGlass.border, borderTop: T.lessGlass.borderTop, borderRadius: 18, boxShadow: T.lessGlass.shadow, padding: "14px 10px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: T.lessGlass.blur, WebkitBackdropFilter: T.lessGlass.blur, overflow: "hidden" }}>{children}</div>);
}

// ── Хаб ──
// ── v157 (Доп. 481): раздел Справочника — карточка-обложка ───────────────────────────────────────────────────
// Владелец (14.11) на набросок «Справочник с фотографиями»: «Да, все прекрасно, мне нравится»; «Фото… их можно будет самому
// загрузить, верно?» — да: у руководителя на карточке фотоаппарат, лист «Фото раздела» (тот же, что у фото урока: вся сеть
// или своё заведение, этап 51). Своего фото нет — снимок из приложения («Сервировка», «Вина»), а где и его нет («Кофе»,
// «Барная карта») — прежний рисунок-витраж, крупнее и справа. Фото — фоном во всю карточку, слева гаснет под текст.
const REF_PHOTO = { "data-ref-photo": "" }, REF_UNDER = { "data-ref-under": "" };   // фото на виду и снимок из приложения под своим фото
function RefCard({ c, T, gold, dark, a11y, onGo, photos, profile }) {
  const id = refCoverPick(photos, c.id);   // v172: у «Бар: Основы» — обложка прежней «Барной карты», пока своей нет
  const own = id && photos && photos !== "missing" ? photoOf(photos, id) : null;
  // v163 (Доп. 488): своё фото проявляется поверх того, что на карточке было (снимок из приложения или пустое стекло), а
  // не встаёт вместо него разом. Не приехало совсем (нет связи) — карточка как без своего фото.
  const { src: ownSrc, gone } = useCover(own ? id : null, own ? own.ver : "");
  const ownOn = !!own && !gone;
  const def = REF_COVER_DEFAULT[c.id] || null;
  const photo = ownOn || !!def;   // карточка с фото: вуаль под текст и светлые буквы
  const imgSt = (pos) => ({ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: pos, display: "block", filter: dark ? "brightness(.92) saturate(1.06)" : "none" });
  // снимок из приложения: телефон его уже держит — стоит сразу, иначе проявится, когда загрузится (CoverPhoto)
  const defImg = def ? <CoverPhoto key={def.src} src={def.src} style={imgSt(def.pos)} attrs={ownOn ? REF_UNDER : REF_PHOTO} /> : null;
  const art = c.art || c.id, hasArt = ["serving", "wine", "coffee", "cocktails", "winelist", "book"].includes(art);
  const ink = dark ? "#F4ECD8" : "#2A1F0E", sub = dark ? "#C9BB9C" : "#5E4E34";
  const veil = dark
    ? "linear-gradient(90deg, rgba(24,18,10,.95) 0%, rgba(24,18,10,.84) 30%, rgba(24,18,10,.28) 62%, rgba(24,18,10,.04) 82%), linear-gradient(0deg, rgba(24,18,10,.6) 0%, rgba(24,18,10,0) 55%)"
    : "linear-gradient(90deg, rgba(246,238,220,.96) 0%, rgba(246,238,220,.86) 30%, rgba(246,238,220,.25) 62%, rgba(246,238,220,0) 80%), linear-gradient(0deg, rgba(246,238,220,.55) 0%, rgba(246,238,220,0) 55%)";
  const note = own ? "" : def ? "Сейчас на обложке снимок из справочника. Своё фото встанет вместо него." : "";
  return (
    <div onClick={c.on ? onGo : undefined} {...onActivate(c.on ? onGo : undefined)} aria-label={c.t} data-lens-card="" data-ref-card={c.id} data-ref-cover={ownOn && ownSrc ? "own" : def ? "app" : ownOn ? "wait" : "art"}
      style={{ ...T.modCard, gap: 0, alignItems: "stretch", minHeight: 112, padding: "0 16px", cursor: c.on ? "pointer" : "default", opacity: c.on ? 1 : 0.5 }}>
      {photo ? (<>
        {ownOn ? <CoverPhoto src={ownSrc} style={imgSt("50% 50%")} attrs={REF_PHOTO} wait={defImg || <PhotoWait />} /> : defImg}
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: veil, pointerEvents: "none" }} />
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none", boxShadow: "inset 0 1px 0 rgba(255,255,255,.16), inset 0 0 22px rgba(255,248,230,.07)" }} />
      </>) : hasArt ? (
        <div aria-hidden="true" style={{ position: "absolute", right: 44, top: 8, pointerEvents: "none" }}><RefArt kind={art} light={!!a11y} size={76} /></div> /* Доп. 147: витражи для курсов; подпись проходит под рисунком */
      ) : (
        <div data-lens="disc" style={{ ...T.modIcon, position: "absolute", right: 50, top: 14 }}>{c.icon(gold, 24)}</div>
      )}
      <div style={{ position: "relative", zIndex: 1, flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "0 0 14px" }}>
        {/* v78 (Доп. 391): метки «Курс» и «Колода» над названием убраны — и так понятно; «Скоро» — у закрытого */}
        {c.tag || !c.on ? <div style={{ ...T.modTag, ...labelStyle(a11y ? 15 : 13), color: gold }}>{c.tag || "Скоро"}</div> : null}
        <div style={{ ...T.modTitle, fontSize: a11y ? 20 : 19, marginBottom: 3, color: photo ? ink : T.modTitle.color }}>{c.t}</div>
        <div style={{ ...T.modSub, fontSize: a11y ? 14.5 : 12.5, color: photo ? sub : T.modSub.color, display: "flex", alignItems: "center", gap: 4 }}>{!c.on && Ico.lock(T.modSub.color, 12)}{c.s}</div>
      </div>
      <div style={{ ...T.modArrow, position: "relative", zIndex: 1, alignSelf: "flex-end", paddingBottom: 16, fontSize: 18, color: photo ? (dark ? "rgba(244,236,216,0.75)" : "#5E4E34") : T.modArrow.color }}>{c.on ? "›" : ""}</div>
      <CoverEditButton id={id} title={c.t} profile={profile} a11y={!!a11y} list={photos} note={note} onPhoto={!!photo} />
    </div>
  );
}

// v167 (Доп. 492): карточки хаба — из разделов справочника, как их видит команда: штатные («Сервировка», «Вина», «Кофе»)
// с прежними подписями и рисунками, за ними свои разделы владельца. Название и число глав — уже с правками.
// «Гид по приложению» карточкой не был и не стал (открывается из подсказок и поиска, сам гид — во вкладке «Я»).
// v172 (Доп. 497), владелец (16.11): «Может бар из справочника рядом с меню вставим?», «В справочнике можем оставить
// основу», «С колоды основы можем убрать, оставить их только в справочнике. А карточка в справочнике пусть будет «Бар:
// Основы»». «Барная карта» ушла в ленту главной (значок «Бар»), а её место в Справочнике занял раздел с главами об
// историях классики и технике: раньше он карточкой не был и открывался из колоды бармена по «Основы ›».
export const REF_OFF_HUB = ["app"];
const HUB_PRESET = { serving: { icon: Ico.serving, tail: " с фото" }, wine: { icon: Ico.wine, tail: "" }, coffee: { icon: Ico.coffee, tail: " со схемами" },
  bar: { icon: Ico.cocktail, tail: "", art: "cocktails" } };   // v172: витраж с бокалом, как был у карточки «Бар: коктейли»
const chaptersWord = (n) => n % 10 === 1 && n % 100 !== 11 ? "глава" : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? "главы" : "глав";
export function hubCards(sections) {
  return (Array.isArray(sections) ? sections : []).filter(c => c && !REF_OFF_HUB.includes(c.id)).map(c => {
    const n = (c.lessons || []).filter(l => l.type === "lesson").length, p = HUB_PRESET[c.id] || null;
    return { id: c.id, t: c.title, s: `${n} ${chaptersWord(n)}${p ? p.tail : ""}`, icon: p ? p.icon : Ico.compass, on: true, ...(p ? (p.art ? { art: p.art } : null) : { art: "book" }) };
  });
}
const PEN_IC = (c, s = 15) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z" /><path d="M14.5 6.5l3 3" /></svg>);

function Hub({ T, gold, dark, a11y, openCourse, onSearch, onExit, isLeader, onBarLab, hintNode, profile = null, sections = [], onEdit = null }) {
  const photos = useLessonPhotos();   // v157: свои фото разделов — из того же списка, что фото уроков
  // Доп. 144: карточка «Гид по приложению» снята — гид живёт во вкладке «Я»; главы остались для Наставника и поиска.
  // v127 (Доп. 440) здесь же стояла карточка «Барная карта»; v172 (Доп. 497): она ушла в ленту главной (значок «Бар»),
  // а в Справочнике остался раздел «Бар: Основы» — обычной карточкой, среди остальных (hubCards).
  const cards = hubCards(sections);
  return (<div style={T.screen}>
      {hintNode}
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "14px 14px 0" }}>
      <button className="sa-hit" style={T.backBtn2} data-lens="back" aria-label="Вернуться" onClick={onExit}>‹</button>
      <span style={{ ...T.modTag, ...labelStyle(a11y ? 15 : 13), color: gold }}>Раздел</span>
      {/* v167 (Доп. 492): владельцу — вход в редактор справочника: разделы, главы, текст, фото */}
      {onEdit ? <button type="button" data-ref-edit="" data-lens-btn="soft" onClick={() => onEdit(null)}
        style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36, padding: "0 14px", borderRadius: 999, border: `1px solid ${gold}66`,
          background: dark ? "rgba(255,248,230,0.06)" : "rgba(255,255,255,0.55)", color: T.bold.color, fontFamily: SERIF, fontSize: 13.5, cursor: "pointer" }}>{PEN_IC(gold)}Редактор</button> : null}
    </div>
    <div style={{ padding: "6px 18px 8px" }}>
      <div style={{ fontFamily: SERIF, fontSize: 25, fontWeight: "bold", color: T.modTitle.color }}>Справочник</div>
      <div style={{ color: T.modSub.color, fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>Познавательные курсы для всей команды. Пополняется со временем.</div>
    </div>
    {/* Строка поиска: справочник растёт, листать 26+ глав дольше, чем спросить */}
    <div style={{ padding: "4px 18px 2px" }}>
      <div onClick={onSearch} {...onActivate(onSearch)} role="search" aria-label="Поиск по справочнику" data-lens-field=""
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 15px", borderRadius: 14, cursor: "pointer",
          border: `1px solid ${gold}55`, borderTop: `1px solid ${gold}88`,
          background: dark ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.5)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.10) inset" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/></svg>
        <span style={{ color: T.modSub.color, fontSize: 14 }}>Найти главу: гренадин, капучино, декантация…</span>
      </div>
    </div>
    <div className="sa-g2" style={{ ...T.modList, paddingTop: 8 }}>
      {cards.map(c => (
        <RefCard key={c.id} c={c} T={T} gold={gold} dark={dark} a11y={a11y} photos={photos} profile={profile}
          onGo={() => openCourse(c.id)} />
      ))}
    </div>
  </div>);
}

// ── v158 (Доп. 483): плитка главы в списке глав ───────────────────────────────────────────────────────────
// Владелец (14.11): «Давай все пять». Строка главы была номером и словом «Глава». Теперь слева плитка 52 px: своё фото
// главы (ставит руководитель в самой главе — тот же лист и этап 51, что у фото уроков), а нет — первое фото из главы,
// а нет — маленький рисунок из её иллюстраций, а нет — номер, как раньше. С картинкой номер уходит в подпись «Глава 3».
// v167 (Доп. 492): у главы без своего фото плиткой встаёт первое фото из её текста (его ставит владелец в редакторе).
const tilePhoto = (lesson, photos) => {
  if (!photos || photos === "missing") return null;
  const id = lessonPhotoId(lesson.id), own = id ? photoOf(photos, id) : null;
  if (own) return { id, info: own };
  for (const pid of refPhotoIds(lesson.content)) { const p = photoOf(photos, pid); if (p) return { id: pid, info: p }; }
  return null;
};
function ChapterTile({ lesson, n, isQuiz, photos, T, gold, dark }) {
  const tp = isQuiz ? null : tilePhoto(lesson, photos);
  const id = tp ? tp.id : null, own = tp ? tp.info : null;
  const { src: ownSrc, gone } = useCover(own ? id : null, own ? own.ver : "", false);
  const th = isQuiz ? null : chapterThumb(lesson, hasIllMini);
  const kind = isQuiz ? "quiz" : own && !gone ? "own" : th ? th.kind : "num";
  const edge = isQuiz ? "rgba(200,169,110,0.5)" : dark ? "rgba(214,178,102,0.36)" : "rgba(139,106,48,0.42)";
  const photo = kind === "own" ? ownSrc : kind === "photo" ? th.src : null;
  return (
    <div data-ref-tile={kind} aria-hidden="true" style={{ position: "relative", width: 52, height: 52, borderRadius: 14, flexShrink: 0, overflow: "hidden", display: "grid", placeItems: "center",
      background: dark ? "rgba(200,169,110,0.07)" : "rgba(139,106,48,0.07)", color: isQuiz ? gold : (T.lessNumColor || "#C8B898") }}>
      {kind === "own"
        ? <CoverPhoto src={photo} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} wait={<PhotoWait />} /> /* v163: своё фото проявляется */
        : kind === "photo"
        ? <img src={photo} alt="" loading="lazy" decoding="async" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        : kind === "art" ? <div className="ref-mini" style={{ display: "grid", placeItems: "center", lineHeight: 0 }}>{renderIllMini(th.key, gold, dark)}</div>
        : kind === "quiz" ? Ico.cam(gold, 20)
        : <span style={{ fontFamily: SERIF, fontSize: T.lessNumColor ? 21 : 19, fontWeight: T.lessNumColor ? "bold" : "normal", lineHeight: 1 }}>{n}</span>}
      <div style={{ position: "absolute", inset: 0, borderRadius: 14, boxShadow: "inset 0 0 0 1px " + edge, pointerEvents: "none" }} />
    </div>
  );
}
/** Есть ли у главы картинка для плитки (тогда номер главы — в подписи) */
const chapterHasPic = (lesson, photos) => !!tilePhoto(lesson, photos) || !!chapterThumb(lesson, hasIllMini);

// ── Курс ──
function Course({ T, gold, dark, course, openLesson, onBack }) {
  const photos = useLessonPhotos();   // v158: свои фото глав — из того же списка, что фото уроков
  return (<div style={T.screen}>
    <Head T={T} title="Справочник" onBack={onBack} />
    <div style={{ padding: "14px 18px 4px" }}>
      <div style={{ fontFamily: SERIF, fontSize: 25, fontWeight: "bold", color: T.modTitle.color }}>{course.title}</div>
      <div style={{ color: T.modSub.color, fontSize: 12.5, marginTop: 4, lineHeight: 1.5 }}>{course.subtitle}</div>
    </div>
    <div style={{ ...T.secTitle, ...labelStyle(T.a11y ? 15 : 13) }}>Программа</div>
    <div className="sa-g2" style={T.lessList}>
      {course.lessons.map((l, i) => {
        const isQuiz = l.type === "quiz";
        const pic = !isQuiz && chapterHasPic(l, photos);
        return (<div key={l.id} data-ref-chapter={l.id} style={T.lessCard} onClick={() => openLesson(l)} {...onActivate(() => openLesson(l))} aria-label={l.title}>
          <ChapterTile lesson={l} n={i + 1} isQuiz={isQuiz} photos={photos} T={T} gold={gold} dark={dark} />
          <div style={{ ...T.lessInfo, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ ...T.lessTitle, marginBottom: 2, color: isQuiz ? gold : T.lessTitle.color }}>{l.title}</div>
            <div style={{ ...labelStyle(13), color: isQuiz ? gold : "#7C9E87", marginTop: 2 }}>{isQuiz ? "Фото-тест" : pic ? "Глава " + (i + 1) : "Глава"}</div>
          </div>
          <div style={T.lessArrow}>›</div>
        </div>);
      })}
    </div>
  </div>);
}

// ── Глава ──
function Lesson({ T, gold, dark, lesson, onBack, onNext, nextLabel, onShare = null, profile = null, a11y = false, onEdit = null }) {
  const bodyRef = R.useRef(null);
  R.useEffect(() => {
    if (typeof document !== "undefined") { try { (document.getElementById("root") || window).scrollTo(0, 0); } catch (e) {} }
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [lesson.id]);
  return (<div style={T.screen}>
    <Head T={T} title={lesson.title} onBack={onBack} />
    <div ref={bodyRef} style={{ ...T.lessBody, padding: "14px 14px 40px" }}>
      {lesson.images && lesson.images.map((k, i) => <Figure key={i} T={T}>{renderIll(k, gold, dark)}</Figure>)}
      <div style={{ background: T.lessGlass.bg, border: T.lessGlass.border, borderTop: T.lessGlass.borderTop, borderRadius: 22, boxShadow: T.lessGlass.shadow, padding: "20px 18px", backdropFilter: T.lessGlass.blur, WebkitBackdropFilter: T.lessGlass.blur }}>
        {/* v158 (Доп. 483): своё фото главы — сверху, как у урока; руководителю — «Добавить фото к главе». Оно же — плитка в списке глав */}
        <LessonCover kind="chapter" lessonId={lessonPhotoId(lesson.id) || ""} lessonTitle={lesson.title} profile={profile} a11y={a11y} color={gold} />
        <Content text={lesson.content} T={T} gold={gold} dark={dark} />
      </div>
      {/* v97 (Доп. 410): глава — в чат команды карточкой, коллега откроет её в своём Справочнике */}
      {onShare || onEdit ? <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
        {onShare ? <button type="button" data-share-chat={"ref:" + lesson.id} onClick={onShare} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 999,
          border: `1px solid ${gold}66`, background: dark ? "rgba(255,248,230,0.06)" : "rgba(255,255,255,0.55)", color: T.bold.color, fontFamily: SERIF, fontSize: 13, cursor: "pointer" }}>
          {CHAT_SHARE_IC(gold)}Поделиться в чат</button> : null}
        {/* v167 (Доп. 492): владельцу — сразу в редактор, на эту главу */}
        {onEdit ? <button type="button" data-ref-edit-ch={lesson.id} onClick={onEdit} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 999,
          border: `1px solid ${gold}66`, background: dark ? "rgba(255,248,230,0.06)" : "rgba(255,255,255,0.55)", color: T.bold.color, fontFamily: SERIF, fontSize: 13, cursor: "pointer" }}>
          {PEN_IC(gold, 14)}Править главу</button> : null}
      </div> : null}
      {onNext
        ? <button style={{ ...T.doneBtn, background: gold }} onClick={onNext}>{nextLabel} →</button>
        : <button style={{ ...T.doneBtn, background: gold }} onClick={onBack}>К программе курса</button>}
    </div>
  </div>);
}

// ── Фото-тест ──
function Quiz({ T, gold, dark, lesson, onBack, onNext, nextLabel }) {
  const [step, setStep] = R.useState(0);
  const [pick, setPick] = R.useState(null);
  const [score, setScore] = R.useState(0);
  const [done, setDone] = R.useState(false);
  const qs = lesson.questions; const q = qs[step]; const last = step === qs.length - 1;
  if (done) return (<div style={T.screen}>
    <Head T={T} title={lesson.title} onBack={onBack} />
    <div style={T.resultWrap}>
      <div style={{ ...T.resultCircle, borderColor: GREEN }}>
        <div style={{ ...T.resultScore, color: GREEN }}>{score}/{qs.length}</div>
      </div>
      <div style={T.resultTxt}>{score === qs.length ? "Всё верно" : "Неплохо, но повтори главу"}</div>
      <button style={{ ...T.doneBtn, background: gold, marginTop: 4 }} onClick={onNext || onBack}>{onNext ? nextLabel + " →" : "К программе курса"}</button>
    </div>
  </div>);
  return (<div style={T.screen}>
    <Head T={T} title={lesson.title} onBack={onBack} />
    <div style={T.quizWrap}>
      <div style={{ ...T.quizProgress, ...labelStyle(dark ? 13 : 16) }}>Вопрос {step + 1} / {qs.length}</div>
      {q.img && <div style={{ marginBottom: 16 }}><Figure T={T}>{renderIll(q.img, gold, dark)}</Figure></div>}
      <div style={T.quizQ}>{q.q}</div>
      {q.options.map((opt, i) => {
        let st = { ...T.quizOpt }; let ic = null;
        if (pick !== null) {
          if (i === q.correct) { st = { ...st, background: "rgba(93,187,138,0.15)", border: "1px solid #5DBB8A", color: T.bold.color }; ic = Ico.check(GREEN, 17); }
          else if (i === pick) { st = { ...st, background: "rgba(224,120,120,0.15)", border: "1px solid #E07878", color: T.bold.color }; ic = Ico.x(RED, 17); }
          else st = { ...st, opacity: 0.5 };
        }
        const choose = () => { if (pick === null) { setPick(i); if (i === q.correct) setScore(s => s + 1); } };
        return (<div key={i} onClick={choose} {...onActivate(pick === null ? choose : undefined)} aria-label={opt} style={{ ...st, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: pick === null ? "pointer" : "default" }}><span>{opt}</span>{ic && <span style={{ flexShrink: 0 }}>{ic}</span>}</div>);
      })}
      {pick !== null && <div style={{ ...T.explain, borderLeftColor: gold }}>{q.explanation}</div>}
      {pick !== null && <button style={{ ...T.doneBtn, background: gold, marginTop: 12 }} onClick={() => { if (last) setDone(true); else { setStep(s => s + 1); setPick(null); } }}>{last ? "Завершить" : "Дальше →"}</button>}
    </div>
  </div>);
}

// ── Корень раздела ──
// v128: onBarItem(kind, id) — коктейль, вино или крепкое из поиска справочника: карточка в «Барной карте»
// v167 (Доп. 492): onEdit(номер главы или null) — владельцу: редактор справочника (App.jsx даёт его только владельцу)
// startInside — главу startLessonId открыли как изнутри (вернулись из редактора): «назад» ведёт к программе раздела
export function ReferenceSection({ T, a11y, onExit, startLessonId, profile, onBarLab, accent, onShareChat = null, onBarItem = null, onEdit = null, startInside = false }) {
  // Цвет входа продолжается внутри — как у SOS. Без параметра прежний золотой.
  const gold = accent || (a11y ? "#7A5D2A" : GOLD);
  const [rHint, rHintDone] = useHintOnce("reference");
  const [rStep, setRStep] = React.useState(0);
  const rSteps = hintsFor("reference");
  const dark = !a11y;
  // Глава «Инструменты руководителя» видна только менеджерам — фильтруем
  // прямо в карте курсов: вся навигация ниже работает с уже отсеянным списком.
  // isLeader живёт ЗДЕСЬ (profile — проп этого компонента) и уходит в Hub
  // пропом: объявление в чужом скоупе уронило Справочник на проде.
  const isLeader = !!(profile && (profile.is_admin || ["manager", "senior"].includes(profile.position)));
  const filterCourse = (c) => ({ ...c, lessons: c.lessons.filter(l => !l.leaderOnly || isLeader) });
  // v167 (Доп. 492): справочник — штатные разделы и правки владельца (lib/ref-book.js): свои разделы и главы, свои
  // названия и текст, порядок, скрытое убрано. Правок нет или сервер без этапа 53 — те же штатные разделы, как раньше.
  const book = useRefBook();
  R.useEffect(() => { refreshRefBook(); }, []);   // справочник открыли — правки владельца не старше минуты
  const base = R.useMemo(() => [REFERENCE_COURSE, REFERENCE_WINE_COURSE, REFERENCE_COFFEE_COURSE, REFERENCE_BAR_COURSE, filterCourse(REFERENCE_APP_COURSE)], [isLeader]);   // eslint-disable-line react-hooks/exhaustive-deps
  const sections = R.useMemo(() => mergeRefBook(base, book.items), [base, book.items]);
  const COURSES = R.useMemo(() => Object.fromEntries(sections.map(c => [c.id, c])), [sections]);
  const whereIs = (lid) => { for (const c of sections) { if (c.lessons.some(l => l.id === lid)) return c.id; } return null; };
  // Глава на экране помнится по номеру, а не по месту в списке: владелец переставил главы или скрыл соседнюю, пока человек
  // читает, — он остаётся на своей главе. Главу убрали совсем — показываем программу раздела, раздел убрали — хаб.
  const startCourseId = startLessonId ? whereIs(startLessonId) : null;
  const [courseId, setCourseId] = R.useState(startCourseId || "serving");
  const [lid, setLid] = R.useState(startCourseId ? startLessonId : null);
  const [entry, setEntry] = R.useState(startCourseId && !startInside ? startLessonId : null);   // глава, с которой вошли снаружи: «назад» с неё — туда, откуда пришли
  const [view, setView] = R.useState(startCourseId ? "read" : "hub");
  // Позвали на главу, которой на телефоне ещё нет (своя глава владельца из чата, а правки только едут) — откроем, когда приедут
  const [wantStart, setWantStart] = R.useState(startLessonId && !startCourseId ? startLessonId : null);
  R.useEffect(() => {
    if (!wantStart) return;
    const cid = whereIs(wantStart);
    if (cid) { setCourseId(cid); setLid(wantStart); setEntry(startInside ? null : wantStart); setView("read"); setWantStart(null); }
    else if (book.loaded || book.missing) setWantStart(null);
  }, [wantStart, sections, book.loaded, book.missing]);   // eslint-disable-line react-hooks/exhaustive-deps
  const course = COURSES[courseId] || null;
  const lessons = course ? course.lessons : [];
  const idx = lid ? lessons.findIndex(l => l.id === lid) : -1;
  const lesson = idx >= 0 ? lessons[idx] : null;
  const shown = view === "read" && !lesson ? (course ? "course" : "hub") : view === "course" && !course ? "hub" : view;
  // v52: список курсов и программа курса — шире, карточками в две колонки; глава и фото-тест — прежней колонкой
  const wide = useWide();
  useColumn(wide && (shown === "hub" || shown === "course") ? 900 : 0);
  const openCourse = (cid) => { setCourseId(cid); setLid(null); setView("course"); };
  const openLesson = (l) => { setLid(l.id); setView("read"); };
  const next = idx >= 0 && idx < lessons.length - 1 ? lessons[idx + 1] : null;
  const goNext = next ? () => { setLid(next.id); setView("read"); } : null;
  const nextLabel = next ? (next.type === "quiz" ? "К фото-вопросам" : "Следующая глава") : null;

  const openById = (id) => { const cid = whereIs(id); if (cid) { setCourseId(cid); setLid(id); setView("read"); } };
  if (shown === "search") return <SearchScreen T={T} a11y={a11y} modules={[]} profile={profile}
    scopeText={onBarItem ? "Введи минимум 2 буквы. Ищу по главам справочника, глоссарию, меню ресторана и барной карте." : "Введи минимум 2 буквы. Ищу по главам справочника, глоссарию и меню ресторана."}
    onCocktail={onBarItem ? (id) => onBarItem("cocktail", id) : undefined} onDrink={onBarItem || undefined}
    onReferenceLesson={openById} onBack={() => setView("hub")} />;
  if (shown === "hub") return <Hub T={T} gold={gold} dark={dark} a11y={a11y} onBarLab={onBarLab} profile={profile} sections={sections} onEdit={onEdit}
    hintNode={rHint && rSteps.length ? (
      <HintBubble a11y={a11y} text={rSteps[rStep]} arrow="up"
        step={rStep + 1} total={rSteps.length}
        onNext={rStep >= rSteps.length - 1 ? null : () => setRStep(v => v + 1)}
        onClose={rHintDone} />
    ) : null} openCourse={openCourse} isLeader={isLeader} onSearch={() => setView("search")} onExit={onExit} />;
  if (shown === "course") return <Course T={T} gold={gold} dark={dark} course={course} openLesson={openLesson} onBack={() => setView("hub")} />;
  const back = (entry && lid === entry) ? onExit : () => setView("course");
  if (lesson.type === "quiz") return <Quiz T={T} gold={gold} dark={dark} lesson={lesson} onBack={back} onNext={goNext} nextLabel={nextLabel} />;
  return <Lesson T={T} gold={gold} dark={dark} lesson={lesson} onBack={back} onNext={goNext} nextLabel={nextLabel} profile={profile} a11y={a11y}
    onShare={onShareChat ? () => onShareChat(refShareItem(lesson, course.title)) : null}
    onEdit={onEdit && !RB_FIXED.includes(course.id) ? () => onEdit(lesson.id) : null} />;
}

// Задание дня из Справочника: одна глава/тест, меняется по дате (seed).
import { referenceDailyTask } from "./reference-daily";
ReferenceSection.dailyTask = referenceDailyTask;
