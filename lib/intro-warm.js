// lib/intro-warm.js — v177 (Доп. 502): видео-знакомство без ожидания. Владелец (18.11): «я так понимаю видео вшиты в
// само приложение? Из-за чего оно выросло по размеру. <…> Мы можем сделать загрузку видео бесшовной, что бы оно
// грузилось сразу?»
//
// В приложение ролики не вшиты: это отдельные файлы на сервере (public/video, 3–6 МБ каждый), как фото уроков. Человек
// качает только ролик своей роли и только когда открывает его; само приложение от них не тяжелее. Вырос архив кода —
// в нём лежат все шесть роликов.
//
// Чтобы ролик шёл сразу, без круга ожидания, приложение берёт его заранее — целиком, в память телефона, — пока человек
// на экране перед ним: на главной под «Начни здесь», в разделе с видео-знакомством, в уроке над обложкой (ui/intro-video.jsx,
// IntroWarm). Плеер играет ролик оттуда: без ожидания и без сети. Скачанный ролик лежит в телефоне и между запусками
// (Cache Storage, VIDEO_CACHE), пока это тот же файл: rev в data/intro-videos.js — по содержимому файла (проверяет тест).
//   • Берём только ещё не досмотренный ролик и не сразу: сначала пусть приедет сам экран (WARM_WAIT, как фото заранее —
//     ui/lesson-photo.jsx, AHEAD_WAIT). При экономии трафика (Android: Save-Data, 2G) — не берём (lib/lesson-photo.js, leanNet).
//   • Открыли раньше, чем скачалось, — плеер играет из сети, как раньше, а заготовку бросаем: дважды не качаем.
//   • Ушёл с экрана раньше (или в билете уже другой урок: прогресс приехал позже) — недокачанное бросаем.
//   • Скачанный ролик телефон не смог играть — плеер сам переходит на сеть (introWarmFailed), а копию в телефоне стираем.
import { INTRO_VIDEOS } from "../data/intro-videos";
import { leanNet } from "./lesson-photo";

export const VIDEO_CACHE = "sa-video-v1";   // то же имя держит public/sw.js (не стирает при обновлении)
export const WARM_WAIT = 1200;

// src ролика → { state, url, ctl, t, n }. state: "cache" — ищем в телефоне, "wait" — ждём своей очереди, "net" — качаем,
// "ready" — в памяти (url — blob:), "off" — не берём (экономия трафика, не вышло); n — сколько экранов ждут ролик
const S = new Map();

const has = (name) => { try { return typeof globalThis[name] !== "undefined"; } catch (e) { return false; } };
/** Под каким адресом ролик лежит в телефоне: свой для каждой версии файла */
export const warmKey = (video) => video.src + "?rev=" + (video.rev || "0");
const absKey = (video) => { try { return new URL(warmKey(video), globalThis.location ? globalThis.location.href : "http://localhost/").href; } catch (e) { return warmKey(video); } };

const blobOf = (b) => (b && /^video\//.test(b.type) ? b : new Blob([b], { type: "video/mp4" }));
function ready(e, blob) {
  const b = blobOf(blob);
  e.url = URL.createObjectURL(b);
  e.size = b.size;
  e.state = "ready";
}
// бросить то, что ещё не готово: ожидание и скачивание (запись забываем — экран вернётся, возьмём снова)
function drop(video, e) {
  clearTimeout(e.t);
  if (e.ctl) { try { e.ctl.abort(); } catch (x) { /* */ } }
  e.ctl = null;
  e.state = "gone";
  if (S.get(video.src) === e) S.delete(video.src);
}
const busy = (e) => e.state === "cache" || e.state === "wait" || e.state === "net";

// старые версии роликов из телефона — прочь (один раз за запуск)
let pruned = false;
function prune() {
  if (pruned || !has("caches")) return;
  pruned = true;
  const keep = new Set(Object.values(INTRO_VIDEOS).map(absKey));
  Promise.resolve().then(() => caches.open(VIDEO_CACHE))
    .then((c) => c.keys().then((ks) => Promise.all(ks.filter((r) => !keep.has(r.url)).map((r) => c.delete(r)))))
    .catch(() => {});
}

async function fromPhone(video, e) {
  if (!has("caches")) return false;
  try {
    const c = await caches.open(VIDEO_CACHE);
    const hit = await c.match(warmKey(video));
    if (!hit || e.state !== "cache") return false;
    const blob = await hit.blob();
    if (e.state !== "cache" || !blob.size) return false;
    ready(e, blob);
    return true;
  } catch (x) { return false; }
}

async function fromNet(video, e) {
  if (e.state !== "wait") return;
  e.ctl = typeof AbortController === "function" ? new AbortController() : null;
  e.state = "net";
  try {
    // no-cache: файл сверяем с сервером (иначе сутки мог бы прийти прежний ролик из кэша браузера)
    const res = await fetch(video.src, { cache: "no-cache", signal: e.ctl ? e.ctl.signal : undefined });
    if (res.status !== 200) throw new Error("http " + res.status);
    const blob = await res.blob();
    if (e.state !== "net" || !blob.size) return;
    e.ctl = null;
    ready(e, blob);
    if (has("caches")) {
      const b = blobOf(blob);
      caches.open(VIDEO_CACHE).then((c) => c.put(warmKey(video), new Response(b, { headers: { "Content-Type": b.type, "Content-Length": String(b.size) } }))).catch(() => {});
    }
  } catch (x) {
    if (e.state === "net") { e.ctl = null; e.state = "off"; }
  }
}

const noop = () => {};
/**
 * Взять ролик заранее, пока на экране то, что ведёт к нему. → отпустить(): экран ушёл (или урок в билете сменился) —
 * недокачанное бросаем; готовое остаётся в памяти. Несколько экранов сразу — ролик один, бросаем, когда отпустят все.
 * wait — сколько ждать перед скачиванием из сети (по умолчанию WARM_WAIT); копия в телефоне берётся сразу.
 */
export function warmIntro(video, { wait = WARM_WAIT } = {}) {
  if (!video || !video.src || !has("fetch") || !has("Blob") || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return noop;
  let e = S.get(video.src);
  if (!e) {
    e = { state: "cache", url: "", ctl: null, t: 0, size: 0, n: 0 };
    S.set(video.src, e);
    prune();
    const me = e;
    fromPhone(video, me).then((hit) => {
      if (hit || me.state !== "cache") return;
      if (leanNet()) { me.state = "off"; return; }
      me.state = "wait";
      me.t = setTimeout(() => { fromNet(video, me); }, Math.max(0, Number(wait) || 0));
    });
  }
  e.n++;
  const me = e;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    me.n--;
    if (me.n <= 0 && busy(me)) drop(video, me);
  };
}

/** Что с заготовкой ролика: "cache" | "wait" | "net" | "ready" | "off" ("" — не брали) */
export const introWarmState = (video) => { const e = video ? S.get(video.src) : null; return e ? e.state : ""; };

/**
 * Откуда играть ролик: заготовка готова — из неё (blob:), нет — из сети. Скачивание, которое не успело, бросаем:
 * плеер уже качает ролик сам. Копию из телефона (ещё читается) не трогаем — к следующему разу будет готова.
 */
export function introSrc(video) {
  if (!video) return "";
  const e = S.get(video.src);
  if (!e) return video.src;
  if (e.state === "ready" && e.url) return e.url;
  if (e.state === "wait" || e.state === "net") drop(video, e);
  return video.src;
}

/** Телефон не смог играть заготовку: дальше в этот запуск — из сети, копию в телефоне стираем */
export function introWarmFailed(video) {
  const e = video ? S.get(video.src) : null;
  if (!e) return;
  if (e.url) { try { URL.revokeObjectURL(e.url); } catch (x) { /* */ } }
  e.url = "";
  clearTimeout(e.t);
  if (e.ctl) { try { e.ctl.abort(); } catch (x) { /* */ } }
  e.ctl = null;
  e.state = "off";
  if (has("caches")) Promise.resolve().then(() => caches.open(VIDEO_CACHE)).then((c) => c.delete(warmKey(video))).catch(() => {});
}

/** Для проверок: забыть все заготовки */
export function resetIntroWarm() {
  for (const e of S.values()) { clearTimeout(e.t); if (e.ctl) { try { e.ctl.abort(); } catch (x) { /* */ } } if (e.url) { try { URL.revokeObjectURL(e.url); } catch (x) { /* */ } } }
  S.clear();
  pruned = false;
}
