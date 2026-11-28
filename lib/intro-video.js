// lib/intro-video.js — v175 (Доп. 500): правила видео-знакомства без интерфейса (ролики — data/intro-videos.js,
// обложка и плеер — ui/intro-video.jsx).
//   • Перемотка по фразам, как у радио: «назад на фразу» — к началу текущего предложения, а если оно только началось —
//     к предыдущему; «вперёд на фразу» — к следующему. Начала предложений — cues ролика.
//   • Видео первым экраном урока: урок открыли с начала, а этот ролик человек ещё не досмотрел и не выбрал «Читать
//     текстом». Что выбрал, помнится на телефоне (у каждого человека своё, как место в уроке).
//   • Обложка раздела: у раздела с видео-знакомством — кадр из видео, пока у раздела нет своего фото. Кадр стоит так,
//     чтобы лицо было видно (coverPos, sectionPos).
import { introVideoOf } from "../data/intro-videos";

export const INTRO_SEEN_KEY = "sa_intro_seen";
const LEAD = 0.15;   // перематываем чуть раньше начала слова: первый звук не срезается

const cleanCues = (cues) => (Array.isArray(cues) ? cues.filter((x) => typeof x === "number" && Number.isFinite(x) && x >= 0).sort((a, b) => a - b) : []);

/** Номер предложения, которое звучит в момент t (−1 — до первого) */
export function cueIndex(cues, t) {
  const c = cleanCues(cues);
  let i = -1;
  for (let k = 0; k < c.length; k++) if (c[k] <= t + 0.05) i = k;
  return i;
}

/** «Назад на фразу»: начало текущего предложения; если с его начала прошло меньше grace секунд — начало предыдущего */
export function cueBack(cues, t, grace = 1.2) {
  const c = cleanCues(cues), now = Number(t) || 0;
  const i = cueIndex(c, now);
  if (i < 0) return 0;
  const to = now - c[i] > grace ? c[i] : i > 0 ? c[i - 1] : 0;
  return Math.max(0, Math.round((to - LEAD) * 100) / 100);
}

/** «Вперёд на фразу»: начало следующего предложения или null, если это последнее */
export function cueNext(cues, t) {
  const c = cleanCues(cues), now = Number(t) || 0;
  const n = c.find((x) => x > now + 0.3);
  return n == null ? null : Math.max(0, Math.round((n - LEAD) * 100) / 100);
}

/** Включили звук посреди ролика: в первые секунды — с самого начала («Привет!»), дальше — с начала текущей фразы */
export const soundFrom = (cues, t) => ((Number(t) || 0) < 6 ? 0 : cueBack(cues, t, 0));

// ── что человек уже выбрал ────────────────────────────────────────────────────────────────────────────────────────
const readSeen = (uk) => {
  try { const v = JSON.parse(localStorage.getItem(INTRO_SEEN_KEY + (uk || "")) || "{}"); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch (e) { return {}; }
};
/** "end" — досмотрел до конца, "text" — выбрал текст, "" — ещё ничего */
export const introSeenOf = (lessonId, uk = "") => {
  const v = readSeen(uk)[lessonId];
  return v === "end" || v === "text" ? v : "";
};
/** Запомнить: досмотрел ("end") или выбрал текст ("text"). «Досмотрел» не перезаписывается «текстом» */
export function markIntroSeen(lessonId, how, uk = "") {
  if (!introVideoOf(lessonId) || (how !== "end" && how !== "text")) return false;
  const m = readSeen(uk);
  if (m[lessonId] === "end" && how === "text") return false;
  m[lessonId] = how;
  try { localStorage.setItem(INTRO_SEEN_KEY + (uk || ""), JSON.stringify(m)); return true; } catch (e) { return false; }
}
/** v177: чей телефон — ключ человека для выбора (как место в уроке: ui/screens-learning.jsx, posUk) */
export const introUk = (profile) => (profile ? "_" + profile.name + "_" + (profile.surname || "") : "");
/** v177: урок раздела с видео-знакомством (id) или "" */
export function introLessonOfModule(mod) {
  for (const l of mod && Array.isArray(mod.lessons) ? mod.lessons : []) if (l && introVideoOf(l.id)) return l.id;
  return "";
}
/** Открыть ли видео первым экраном урока: у урока есть ролик, урок начат с начала, ролик ещё не досмотрен и текст не выбран */
export const introFirst = (lessonId, fromStart, uk = "") => !!introVideoOf(lessonId) && !!fromStart && !introSeenOf(lessonId, uk);

/** Ролик раздела трека (первый его урок с видео-знакомством) или null */
export function introOfModule(mod) {
  for (const l of mod && Array.isArray(mod.lessons) ? mod.lessons : []) {
    const v = l ? introVideoOf(l.id) : null;
    if (v) return v;
  }
  return null;
}
/** Чей кадр — обложкой раздела: ролик раздела, если у раздела нет своего фото (cov — moduleCover: own — своё фото раздела;
 *  фото урока кадр видео заменяет — в этих уроках вместо фото стоит видео) */
export const sectionIntro = (mod, cov) => (cov && cov.own ? null : introOfModule(mod));

// ── где на обложке лицо ───────────────────────────────────────────────────────────────────────────────────────────
// Кадр ролика вертикальный (9:16), а окна обложек шире него: кадр встаёт по ширине окна (object-fit: cover) и сдвигается
// по высоте (object-position). Сдвиг считаем по лицу на кадре (face ролика: доли высоты кадра — макушка, глаза,
// подбородок) для телефона шириной 390 px; на 320 и 430 px лицо уходит на несколько пикселей — не больше.
const FRAME = 16 / 9;
/** Обложка в уроке на телефоне 390 px: ширина и высота окна (72vw) и сколько снизу занимает капсула с отступом */
export const COVER_BOX = { w: 360, h: 281, bar: 78 };
/** Обложка раздела с кадром ролика (.tbm-menu[data-mod-cover="video"] .tbm-cover, ui/table-css.js): высота 250 px, с 226 px —
 *  заголовок раздела; глаза — на 102 px. v225 (Доп. 551): было 178 px и глаза на 50 px — от лица оставались лоб и глаза */
export const SECTION_BOX = { w: 360, h: 250, eyes: 102 };

/** object-position по высоте, %: точку кадра frac (доля высоты) поставить на at px от верха окна w × h */
export function posterY(frac, w, h, at) {
  const hs = w * FRAME;
  if (!(hs > h) || !Number.isFinite(frac)) return 50;
  const off = Math.min(hs - h, Math.max(0, frac * hs - at));
  return Math.round((off / (hs - h)) * 100);
}
const faceOf = (video) => {
  const f = video && video.face;
  return f && [f.top, f.eyes, f.chin].every((x) => typeof x === "number" && x >= 0 && x <= 1) && f.top < f.eyes && f.eyes < f.chin ? f : null;
};
/** Обложка в уроке: голова целиком над капсулой, посередине; не помещается — подрезаем макушку, подбородок над капсулой */
export function coverPos(video) {
  const f = faceOf(video);
  if (!f) return "50% 6%";
  const { w, h, bar } = COVER_BOX, hs = w * FRAME, room = h - bar, head = (f.chin - f.top) * hs;
  return "50% " + (head <= room ? posterY(f.top, w, h, (room - head) / 2) : posterY(f.chin, w, h, room)) + "%";
}
/** Обложка раздела: глаза — над заголовком раздела */
export function sectionPos(video) {
  const f = faceOf(video);
  return "50% " + (f ? posterY(f.eyes, SECTION_BOX.w, SECTION_BOX.h, SECTION_BOX.eyes) : 20) + "%";
}

// ── v176 (Доп. 501): видео на весь экран ──────────────────────────────────────────────────────────────────────────
// Владелец (18.11): «что бы видео было на весь экран». Кадр растягивается, пока не закроет экран, но титры вшиты в кадр:
// самая широкая плашка занимает 88 % ширины ролика (tools/video/make_captions.py, MAX_W) — эти 90 % ширины и 92 % высоты
// (плашки внизу, лицо вверху) должны остаться на экране. На высоком экране (iPhone целиком, без шапки Telegram) от этого
// сверху и снизу остаются полоски по 30–40 px, в Telegram с шапкой — обычно ни одной; повёрнутый телефон — весь кадр.
export const FILL_SAFE = { w: 0.9, h: 0.92 };
/** Размер кадра на экране W × H: закрыть экран, но не обрезать титры. → { w, h } (центр кадра — в центре экрана) */
export function fillSize(W, H, vw = 720, vh = 1280) {
  if (!(W > 0 && H > 0 && vw > 0 && vh > 0)) return { w: 0, h: 0 };
  const s = Math.min(Math.max(W / vw, H / vh), W / (vw * FILL_SAFE.w), H / (vh * FILL_SAFE.h));
  return { w: Math.round(vw * s * 10) / 10, h: Math.round(vh * s * 10) / 10 };
}
