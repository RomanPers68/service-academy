// lib/concept-ai.js — v191 (Доп. 516): помощник «О нас» — «Из документа» в два шага и «Оформить как в уроках».
//
// Владелец (21.11): «давай сделаем удобнее добавление концепции и стандарты»; «что бы он красиво составлял текст, по
// типу того, что у нас уже собранно в уроках». Раньше документ уходил помощнику одним обращением: блоки выходили
// короткими и без вида уроков, вопросов теста не было, а длинный документ упирался в предел ответа.
// Теперь: concept_plan — план (какие блоки и выдержка из документа для каждого), потом concept_block — каждый блок
// отдельным обращением, по два сразу, с вопросами теста; PDF уходит один раз, блоки пишутся по выдержкам.
// concept_style — оформить уже готовый текст блока, смысл и факты те же. Функция — /api/lesson-assist.
import { saToken } from "../api/supabase";
import { kindOf, CN_KIND_IDS } from "./concept";
import { lessonize } from "./lesson-look";

export async function askAI(mode, payload) {
  try {
    const r = await fetch("/api/lesson-assist", { method: "POST", headers: { "Content-Type": "application/json" },
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

/** План от помощника → задания: { kind, title, about, src } с понятным видом и заголовком. */
export function planJobs(blocks) {
  return (Array.isArray(blocks) ? blocks : []).filter((b) => b && CN_KIND_IDS.includes(b.kind))
    .map((b) => ({ kind: b.kind, title: String(b.title || "").trim() || kindOf(b.kind).title, about: String(b.about || "").trim(), src: String(b.src || "").trim() }));
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
export function docBlockPayload(item, target, scope, blank) {
  const body = lessonize(item.body || "");
  if (target) return { ...target, title: item.title || target.title, body, questions: item.questions && item.questions.length ? item.questions : target.questions };
  return { ...blank(item.kind, scope), title: item.title || kindOf(item.kind).title, body, questions: item.questions || [] };
}
