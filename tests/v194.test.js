// v194 (Доп. 519): новый ролик сервис-менеджера и «Выбрал» = «Верно» у ошибки в «Аналитике → Люди». Владелец (25.11):
// «Заменишь видео сервис менеджера, пожалуйста) И у меня системная ошибка. За ошибку засчитал правильный ответ».
//   1. data/intro-videos.js sm0-1 — новый ролик (темп быстрее; текст новый — титры по нему в v197): rev, dur, cues;
//   2. lib/supabase.js rpcSyncSeq — «что выбрал» (log_quiz_pick) уходит только после записи ответа (log_quiz_answer):
//      раньше оба вызова шли разом, и текст верной попытки ложился в прошлую ошибку того же вопроса;
//   3. ui/analytics-kit.jsx MissPlate и lib/report-model.js — «Выбрал», совпавшее с «Верно», не показываем;
//   4. этап 60 (supabase-stage60-quiz-pick.sql): log_quiz_pick ищет запись той же верности, старые записи чинит.
// Разметки JSX в файле нет (Доп. 482). В браузере: tools/claude/e2e-v194.mjs; SQL: tools/claude/sql/test60.sh.
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

class Mem {
  constructor() { this.m = new Map(); }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
const realLs = globalThis.localStorage, realFetch = globalThis.fetch;
const ls = new Mem();
globalThis.localStorage = ls;
// сервер-заглушка: что пришло и в каком порядке; ответ можно задержать (hold) или сломать сеть / отклонить
const sent = [];
let mode = {}, hold = null;
globalThis.fetch = async (url, opts) => {
  const fn = String(url).split("/rpc/")[1];
  sent.push({ fn, body: JSON.parse(opts.body) });
  if (hold && hold.fn === fn) await hold.promise;
  const m = mode[fn] || "ok";
  if (m === "offline") throw new Error("offline");
  if (m === "drop") return { ok: false, status: 404, json: async () => ({ code: "PGRST202" }) };
  return { ok: true, status: 200, json: async () => ({ ok: true }) };
};
afterAll(() => { globalThis.localStorage = realLs; globalThis.fetch = realFetch; });

import { rpcSyncSeq, rpcSync, flushQueue } from "../lib/supabase.js";
import { INTRO_VIDEOS } from "../data/intro-videos.js";
import { MissPlate } from "../ui/analytics-kit.jsx";
import { personModel, stepIndex } from "../lib/report-model.js";
import { STAGES } from "../lib/server-check.js";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const queue = () => JSON.parse(ls.getItem("sa_sync_queue") || "[]");
const tick = () => new Promise((r) => setTimeout(r, 0));
const ANS = ["log_quiz_answer", { p_token: "t", p_role: "seasonal", p_lesson: "s2-q", p_question: "Гость-молчун", p_correct: true }];
const PICK = ["log_quiz_pick", { p_token: "t", p_lesson: "s2-q", p_question: "Гость-молчун", p_answer: "Работаю чётко", p_right: "Работаю чётко" }];
beforeEach(() => { ls.clear(); sent.length = 0; mode = {}; hold = null; });

// длительность mp4 по заголовку mvhd (секунды) — как в v174
function mp4Duration(buf) {
  const i = buf.indexOf(Buffer.from("mvhd"));
  if (i < 0) return -1;
  if (buf[i + 4] === 1) return Number(buf.readBigUInt64BE(i + 4 + 4 + 16 + 4)) / buf.readUInt32BE(i + 4 + 4 + 16);
  return buf.readUInt32BE(i + 4 + 4 + 8 + 4) / buf.readUInt32BE(i + 4 + 4 + 8);
}

describe("v194 · версия и журнал", () => {
  it("сборка v194, Дополнение 519, слова владельца, этап 60 в списке и в README, проверки в README инструментов", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(194);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 519 — .*\(v194\)/);
    const part = c.slice(c.indexOf("# Дополнение 519"));
    for (const w of ["Заменишь видео сервис менеджера", "За ошибку засчитал правильный ответ", "Гость-молчун"]) expect(part.replace(/\s+/g, " "), w).toContain(w);
    for (const l of part.split("\n")) expect(l.length, l).toBeLessThanOrEqual(120);
    const tr = rd("tools/claude/README.md");
    expect(tr).toContain("e2e-v194.mjs");
    expect(tr).toContain("test60.sh");
    expect(STAGES.find((s) => s.n === "60")).toEqual({ n: "60", file: "supabase-stage60-quiz-pick.sql",
      what: "Тесты: «что выбрал» в своей попытке, у ошибки не бывает верного ответа", fn: "_sa_quiz_pick_row" });
    expect(STAGES.map((s) => s.n)).toContain("60");   // v198: последний теперь этап 61 (заведения и должности)
    expect(rd("supabase/README.md")).toContain("supabase-stage60-quiz-pick.sql");
    expect(rd("supabase/AI-SETUP.md")).toContain("## v194:");
  });
});

describe("v194 · новый ролик сервис-менеджера", () => {
  const v = INTRO_VIDEOS["sm0-1"];
  const buf = readFileSync("public" + v.src);
  it("rev — от нового файла (телефоны возьмут новый ролик), длительность 52 с", () => {
    expect(v.rev).toBe(createHash("sha256").update(buf).digest("hex").slice(0, 8));
    expect(v.rev).not.toBe("1ca5d8a5");   // прежний ролик
    expect(v.dur).toBe(54);   // v196 (Доп. 521): ролик заменён ещё раз — 54 с
    expect(Math.abs(mp4Duration(buf) - v.dur)).toBeLessThan(0.6);
    expect(buf.length).toBeLessThan(3.6e6);   // сжат, как остальные (шаг 4 tools/video/README.md)
  });
  it("начала фраз — по новому звуку: «Привет!», 19 фраз, «Начнём!» за 1–2,5 с до конца", () => {
    // v196 (Доп. 521): ролик заменён ещё раз — начала фраз по его звуку; v197 (Доп. 522): привязка по верному тексту
    expect(v.cues).toEqual([1.06, 1.84, 5.0, 6.61, 8.6, 12.27, 18.89, 22.76, 26.89, 30.79, 33.18, 36.53, 39.01, 41.2, 43.8, 45.34, 47.75, 50.49, 52.89]);
    const end = mp4Duration(buf) - v.cues[v.cues.length - 1];
    expect(end).toBeGreaterThan(1); expect(end).toBeLessThan(2.5);
  });
  it("кадр и лицо на обложке — как прежде; как вставляли — в README видео", () => {
    expect(v.face).toEqual({ top: 0.06, eyes: 0.19, chin: 0.31 });
    expect(existsSync("public" + v.poster)).toBe(true);
    // v197 (Доп. 522): текст ролика с v194 новый — «система выстроена»
    expect(rd("tools/video/chunks/service_manager_chunks.txt")).toContain("Ты в отпуске,\nа всё работает как часы.\n!Значит, система выстроена.\n!Начнём!");
    const r = rd("tools/video/README.md");
    expect(r).toContain("## Новый ролик сервис-менеджера (v194, Доп. 519)");   // v197: был «с тем же текстом» — текст оказался новым
    expect(r).toContain("−47,8 против −47,5");
    expect(rd("data/intro-videos.js")).toContain("v194 (Доп. 519): ролик сервис-менеджера заменён новым от владельца (25.11)");
    expect(existsSync("tools/video/__pycache__")).toBe(false);
  });
});

describe("v194 · rpcSyncSeq: «что выбрал» — только после записи ответа", () => {
  it("второй вызов уходит, когда первый записан; оба ок — «ok»", async () => {
    let open; hold = { fn: "log_quiz_answer", promise: new Promise((r) => { open = r; }) };
    const p = rpcSyncSeq([ANS, PICK]);
    await tick(); await tick();
    expect(sent.map((x) => x.fn)).toEqual(["log_quiz_answer"]);   // ответ ещё не записан — «что выбрал» ждёт
    open();
    expect(await p).toBe("ok");
    expect(sent.map((x) => x.fn)).toEqual(["log_quiz_answer", "log_quiz_pick"]);
    expect(sent[1].body).toEqual(PICK[1]);
    expect(queue()).toEqual([]);
  });
  it("нет сети на первом — оба в очередь, в том же порядке; очередь шлёт по одному", async () => {
    mode = { log_quiz_answer: "offline" };
    expect(await rpcSyncSeq([ANS, PICK])).toBe("retry");
    expect(sent.map((x) => x.fn)).toEqual(["log_quiz_answer"]);
    expect(queue().map((x) => x.fn)).toEqual(["log_quiz_answer", "log_quiz_pick"]);
    expect(queue()[1].params).toEqual(PICK[1]);
    mode = {}; sent.length = 0;
    await flushQueue();
    expect(sent.map((x) => x.fn)).toEqual(["log_quiz_answer", "log_quiz_pick"]);
    expect(queue()).toEqual([]);
  });
  it("сеть пропала на втором — в очередь только он", async () => {
    mode = { log_quiz_pick: "offline" };
    expect(await rpcSyncSeq([ANS, PICK])).toBe("retry");
    expect(queue().map((x) => x.fn)).toEqual(["log_quiz_pick"]);
  });
  it("сервер отверг ответ — «что выбрал» не шлём: пристроиться не к чему", async () => {
    mode = { log_quiz_answer: "drop" };
    expect(await rpcSyncSeq([ANS, PICK])).toBe("drop");
    expect(sent.map((x) => x.fn)).toEqual(["log_quiz_answer"]);
    expect(queue()).toEqual([]);
  });
  it("после успеха досылает старую очередь, как rpcSync; пустой список — ничего не шлёт", async () => {
    ls.setItem("sa_sync_queue", JSON.stringify([{ fn: "save_progress", params: { p: 1 }, ts: Date.now() }]));
    expect(await rpcSyncSeq([ANS, PICK])).toBe("ok");
    await flushQueue();
    expect(sent.map((x) => x.fn)).toEqual(["log_quiz_answer", "log_quiz_pick", "save_progress"]);
    sent.length = 0;
    expect(await rpcSyncSeq([])).toBe("ok");
    expect(await rpcSyncSeq(null)).toBe("ok");
    expect(sent).toEqual([]);
    expect(await rpcSync("log_quiz_key", { p: 1 })).toBe("ok");   // rpcSync прежний
  });
  it("очередь уходит и после прогона с пустой очередью: раньше метка прогона залипала до перезапуска приложения", async () => {
    await flushQueue();   // пустая очередь — как при старте приложения
    mode = { save_score: "offline" };
    expect(await rpcSync("save_score", { s: 1 })).toBe("retry");
    mode = {}; sent.length = 0;
    await flushQueue();   // вернулась сеть («online») или прошла минута
    expect(sent.map((x) => x.fn)).toEqual(["save_score"]);
    expect(queue()).toEqual([]);
    mode = { save_score: "offline" }; await rpcSync("save_score", { s: 2 });
    mode = {}; sent.length = 0;
    expect(await rpcSync("save_progress", { p: 1 })).toBe("ok");   // удачная запись сама досылает очередь
    await flushQueue();
    expect(sent.map((x) => x.fn)).toEqual(["save_progress", "save_score"]);
    const api = rd("lib/supabase.js");
    expect(api).toContain("const p = _flushRun().finally(() => { if (_flushing === p) _flushing = null; });");
    expect(api).not.toContain("_flushing = (async () => {");
  });
  it("App: ответ и «что выбрал» одной цепочкой, ответ первым; по отдельности больше не шлются", () => {
    const app = rd("App.jsx");
    const i = app.indexOf("if (!selfCheck) try { rpcSyncSeq([");
    expect(i).toBeGreaterThan(0);
    const seg = app.slice(i, app.indexOf("]).catch(() => {}); } catch(e) {}", i));
    expect(seg.indexOf('["log_quiz_answer"')).toBeGreaterThan(0);
    expect(seg.indexOf('["log_quiz_pick"')).toBeGreaterThan(seg.indexOf('["log_quiz_answer"'));
    expect(seg).toContain("p_correct: isCorrect");
    expect(seg).toContain("p_answer: String((q.options || [])[idx] ?? \"\").slice(0, 300), p_right: String((q.options || [])[q.correct] ?? \"\").slice(0, 300)");
    expect(app).not.toContain('rpcSync("log_quiz_pick"');
    expect(app).not.toContain('rpcSync("log_quiz_answer"');
    expect(app).toContain("import { rpc, saToken, rpcSync, rpcSyncSeq, flushQueue, rpcMissing, startBoot } from \"./lib/supabase\";");
  });
});

describe("v194 · «Выбрал» = «Верно» не показываем", () => {
  const Q = "Гость-молчун ничего не просит и почти не реагирует. Тактика:", RIGHT = "Работаю чётко и быстро, без лишних вопросов";
  it("плашка ошибки: совпало с верным — только вопрос и «Верно»; другое — оба", () => {
    const same = R(h(MissPlate, { q: Q, picked: RIGHT, right: RIGHT }));
    expect(same).toContain(Q);
    expect(same).not.toContain("Выбрал");
    expect(same).toContain(">Верно<");
    expect(same).toContain(RIGHT);
    expect(R(h(MissPlate, { q: Q, picked: RIGHT + " ", right: RIGHT }))).not.toContain("Выбрал");
    const other = R(h(MissPlate, { q: Q, picked: "Завожу лёгкий разговор, чтобы он расслабился", right: RIGHT, times: 2 }));
    expect(other).toContain(">Выбрал<");
    expect(other).toContain("Завожу лёгкий разговор, чтобы он расслабился");
    expect(other).toContain(">Верно<");
    expect(other).toContain("×2");
    expect(R(h(MissPlate, { q: Q, picked: null, right: RIGHT }))).not.toContain("Выбрал");   // до этапа 15 «что выбрал» не писалось
  });
  it("отчёт по сотруднику: чужой верный ответ у ошибки не берём, прежний настоящий остаётся", () => {
    const iso = (d) => new Date(Date.UTC(2026, 10, d, 12)).toISOString();
    const raw = { person: { name: "Анна", surname: "Смирнова", position: "waiter" }, events: [
      { lesson_id: "s2-q", question: Q, correct: false, answer: "Подхожу реже: раз молчит, ему ничего не нужно", right_answer: RIGHT, ts: iso(10) },
      { lesson_id: "s2-q", question: Q, correct: false, answer: RIGHT, right_answer: RIGHT, ts: iso(20) },
      { lesson_id: "s2-q", question: "Только гонка", correct: false, answer: "Да", right_answer: "Да", ts: iso(21) },
    ] };
    const m = personModel(raw, { steps: stepIndex({}), now: new Date(Date.UTC(2026, 10, 25)) });
    const byQ = Object.fromEntries(m.wrong.map((w) => [w.q, w]));
    expect(byQ[Q].chosen).toBe("Подхожу реже: раз молчит, ему ничего не нужно");
    expect(byQ[Q].right).toBe(RIGHT);
    expect(byQ[Q].wrong).toBe(2);
    expect(byQ["Только гонка"].chosen).toBe("");
    expect(byQ["Только гонка"].wrong).toBe(1);
  });
});

describe("v194 · этап 60", () => {
  const s = rd("supabase/supabase-stage60-quiz-pick.sql");
  it("log_quiz_pick: та же подпись, запись той же верности, ищет _sa_quiz_pick_row; поиск закрыт снаружи", () => {
    expect(s).toContain("create or replace function log_quiz_pick(\n  p_token text, p_lesson text, p_question text, p_answer text, p_right text\n) returns json language plpgsql security definer");
    expect(s).toContain("v_id := _sa_quiz_pick_row(v_emp, p_lesson, left(coalesce(p_question, ''), 300), v_a = v_r);");
    expect(s).toContain("and answer is null and correct = p_ok");
    expect(s).toContain("revoke all on function _sa_quiz_pick_row(text, text, text, boolean) from public, anon, authenticated;");
    expect(s).toContain("grant execute on function log_quiz_pick(text, text, text, text, text) to anon, authenticated;");
    expect(s).toContain("create index if not exists quiz_events_wait_pick on quiz_events (employee, lesson_id, question, ts desc) where answer is null;");
    expect(s).toContain("За ошибку засчитал правильный ответ");
  });
  it("починка: у ошибки чужой верный — стереть, у верного чужой — верный; итог одной строкой", () => {
    expect(s).toContain("update quiz_events set answer = null\n   where correct = false and answer is not null and right_answer is not null and answer = right_answer");
    expect(s).toContain("update quiz_events set answer = right_answer\n   where correct = true and answer is not null and right_answer is not null and answer <> right_answer");
    expect(s).toContain("select 'что выбрал: своя попытка — ' ||");
    expect(s).toContain("' · починено записей: '");
    expect(existsSync("tools/claude/sql/test60.sh")).toBe(true);
    expect(rd("tools/claude/sql/test60.sh")).toContain("до этапа 60: «Люди» — «Выбрал» = «Верно» у ошибки (снимок владельца)");
  });
});
