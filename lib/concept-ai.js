// lib/concept-ai.js — v191 (Доп. 516): помощник «О нас» — «Из документа» в два шага и «Оформить как в уроках».
//
// Владелец (21.11): «давай сделаем удобнее добавление концепции и стандарты»; «что бы он красиво составлял текст, по
// типу того, что у нас уже собранно в уроках». Раньше документ уходил помощнику одним обращением: блоки выходили
// короткими и без вида уроков, вопросов теста не было, а длинный документ упирался в предел ответа.
// Теперь: concept_plan — план (какие блоки и выдержка из документа для каждого), потом concept_block — каждый блок
// отдельным обращением, по два сразу, с вопросами теста; PDF уходит один раз, блоки пишутся по выдержкам.
// concept_style — оформить уже готовый текст блока, смысл и факты те же. Функция — /api/lesson-assist.
import { saToken } from "./supabase";
import { apiFetch } from "./api-fetch";   // v207 (Доп. 533): через Supabase, Vercel — запасной
import { kindOf, CN_KIND_IDS } from "./concept";
import { lessonize } from "./lesson-look";

export async function askAI(mode, payload) {
  try {
    const r = await apiFetch("/api/lesson-assist", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: saToken(), mode, ...payload }) });
    const d = await r.json().catch(() => null);
    if (d && d.ok) return d;
    return { ok: false, error: (d && d.error) || (r.status === 404 ? "Помощник ещё не развёрнут на Vercel (функция /api/lesson-assist)." : "Помощник не ответил. Попробуй ещё раз.") };
  } catch (e) { return { ok: false, error: "Нет связи с помощником." }; }
}

/** Выполнить fn для каждого элемента, не больше n сразу; stop() → true — новые не начинать. */
export async function runPool(items, n, fn, stop = () => false) {
  let next = 0;
  const worker = async () => { while (next < items.length && !stop()) { const i = next++; await fn(items[i], i); } };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, items.length)) }, worker));
}

/** План от помощника → задания: { kind, title, about, src, photos } с понятным видом и заголовком. v192: photos — номера
 *  картинок из Word («[фото N]»), которые помощник отнёс к блоку. */
export function planJobs(blocks) {
  return (Array.isArray(blocks) ? blocks : []).filter((b) => b && CN_KIND_IDS.includes(b.kind))
    .map((b) => ({ kind: b.kind, title: String(b.title || "").trim() || kindOf(b.kind).title, about: String(b.about || "").trim(), src: String(b.src || "").trim(),
      photos: (Array.isArray(b.photos) ? b.photos : []).map(Number).filter((n) => Number.isInteger(n) && n > 0) }));
}

// ── v192 (Доп. 517): картинки из Word сразу в блоки ──────────────────────────────────────────────────
// Владелец (23.11): «Делаем все 7» — «Картинки из Word сразу в блоки: помощник подскажет, к какому блоку их отнести».
const MARK = /\[фото (\d+)\]/g;
/** Метки «[фото N]» из текста. */
export const photoMarks = (s) => [...String(s || "").matchAll(MARK)].map((m) => Number(m[1]));
/** Убрать метки картинок из текста блока. */
export const stripPhotoMarks = (s) => String(s || "").replace(/^[ \t]*\[фото \d+\][ \t]*$/gm, "").replace(MARK, "").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();

/**
 * Какие картинки к какому блоку: что предложил помощник, иначе — метки в выдержке блока; одна картинка — одному блоку,
 * не больше 8 на блок (как в «О нас»). nums — номера картинок, которые есть. → { jobs (с photos), spare — без блока }.
 */
export function assignPhotos(jobs, nums, max = 8) {
  const have = new Set(nums), used = new Set();
  const out = jobs.map((j) => {
    let ps = (j.photos || []).filter((n) => have.has(n) && !used.has(n));
    if (!ps.length) ps = photoMarks(j.src).filter((n) => have.has(n) && !used.has(n));
    ps = [...new Set(ps)].slice(0, max);
    ps.forEach((n) => used.add(n));
    return { ...j, photos: ps };
  });
  return { jobs: out, spare: nums.filter((n) => !used.has(n)) };
}

const norm = (s) => String(s || "").toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/g, " ").trim();

/**
 * Что станет с новым блоком в этой части (сеть или заведение): заменит блок того же вида (у «своего блока» — с тем же
 * заголовком) или встанет новым. → блок, который заменит, или null.
 */
export function replaceTarget(existing, kind, title) {
  const list = (Array.isArray(existing) ? existing : []).filter((b) => b && b.kind === kind);
  if (!list.length) return null;
  if (kind !== "own") return list[0];
  return list.find((b) => norm(b.title) === norm(title)) || null;
}

/**
 * Что уходит на сервер для блока из документа: заменить — тот же номер, фото и «для кого» остаются, вопросы — новые
 * (если помощник их дал, иначе прежние); новый — «для кого» по виду блока.
 */
export function docBlockPayload(item, target, scope, blank, photos = []) {
  const body = lessonize(stripPhotoMarks(item.body || ""));   // v192: метки картинок в текст не идут
  // v192: фото из Word — к прежним фото блока (их «для кого» и подписи остаются), не больше 8
  if (target) return { ...target, title: item.title || target.title, body, questions: item.questions && item.questions.length ? item.questions : target.questions,
    photos: [...(target.photos || []), ...photos].slice(0, 8) };
  return { ...blank(item.kind, scope), title: item.title || kindOf(item.kind).title, body, questions: item.questions || [], photos: photos.slice(0, 8) };
}
