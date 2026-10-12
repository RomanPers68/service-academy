import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const G = "/home/claude/.npm-global/lib/node_modules";
const esbuild = (() => { for (const p of [G + "/tsx/node_modules/esbuild", "/opt/npm-tools/node_modules/esbuild", G + "/esbuild"]) { try { return require(p); } catch (e) {} } throw new Error("esbuild не найден"); })();
await esbuild.build({ entryPoints: ["/home/claude/work/service-academy/ui/loophole.jsx"], bundle: true, outfile: "/tmp/loophole-bundle.mjs",
  format: "esm", platform: "node", jsx: "automatic", nodePaths: [G], logLevel: "silent" });
const store = {}; globalThis.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const L = await import("/tmp/loophole-bundle.mjs");
const lesson = { id: "t1", title: "Тест", questions: Array.from({ length: 10 }, (_, i) => ({ q: "В" + (i + 1), options: ["а", "б", "в"], correct: 0, explanation: "потому что" })) };
const uk = "_Т_Т"; const q = (i) => lesson.questions[i];
const clear = () => { for (const k of Object.keys(store)) delete store[k]; };
const res = [];
const check = (name, cond) => res.push(`${cond ? "✓" : "✗"} ${name}`);
// 1. Ошибка посреди теста, «‹», потом сдал — ачивка
clear(); L.loopTrack(uk, lesson, q(0), 0); L.loopTrack(uk, lesson, q(1), 2);
let sk = L.loopExit(uk, "t1"); check("«‹» после ошибки — выход-лазейка", sk && sk.answered === 2 && sk.wrong.length === 1 && sk.wrong[0].a === "в" && sk.wrong[0].r === "а");
for (let i = 0; i < 10; i++) L.loopTrack(uk, lesson, q(i), 0, i === 9 ? "pass" : undefined);
let rec = L.loopPassed(uk, lesson); check("сдал после выхода — ачивка с первой попыткой", rec && rec.answered === 2 && rec.wrong.length === 1 && !rec.seen);
check("ачивка ждёт показа", L.loopUnseen(uk) && L.loopUnseen(uk).lessonId === "t1");
L.loopSeen(uk, rec); check("после показа не всплывает снова", L.loopUnseen(uk) === null);
// 2. Официальный провал (три ошибки) — не лазейка
clear(); for (let i = 0; i < 3; i++) L.loopTrack(uk, lesson, q(i), 1, i === 2 ? "fail" : undefined);
check("провал — честная пересдача, не лазейка", L.loopExit(uk, "t1") === null);
for (let i = 0; i < 10; i++) L.loopTrack(uk, lesson, q(i), 0, i === 9 ? "pass" : undefined);
check("сдал после провала — без ачивки", L.loopPassed(uk, lesson) === null);
// 3. Вышел без ошибок (позвонили) — не лазейка
clear(); L.loopTrack(uk, lesson, q(0), 0); L.loopTrack(uk, lesson, q(1), 0);
check("вышел без ошибок — не лазейка", L.loopExit(uk, "t1") === null);
// 4. Дошёл до проходного результата с ошибками и нажал «‹» вместо «Продолжить»
clear(); for (let i = 0; i < 10; i++) L.loopTrack(uk, lesson, q(i), i < 2 ? 1 : 0, i === 9 ? "pass" : undefined);
sk = L.loopExit(uk, "t1"); check("ушёл с 80% без «Продолжить» — лазейка", sk && sk.answered === 10 && sk.wrong.length === 2);
// 5. Закрыл приложение посреди теста — поймаем при следующем открытии
clear(); L.loopTrack(uk, lesson, q(0), 1);
sk = L.loopOpen(uk, "t1"); check("закрыл приложение с ошибкой — лазейка при следующем открытии", sk && sk.answered === 1);
L.loopTrack(uk, lesson, q(0), 2); L.loopExit(uk, "t1");
for (let i = 0; i < 10; i++) L.loopTrack(uk, lesson, q(i), 0, i === 9 ? "pass" : undefined);
rec = L.loopPassed(uk, lesson); check("два выхода — ошибки обоих, «вышел на» — от первого", rec && rec.exits === 2 && rec.answered === 1 && rec.wrong.length === 1 && rec.wrong[0].a === "б");
// 6. Два выхода с РАЗНЫМИ ошибками — обе в разборе, без повторов
clear(); L.loopTrack(uk, lesson, q(0), 0); L.loopTrack(uk, lesson, q(1), 1); L.loopExit(uk, "t1");
L.loopTrack(uk, lesson, q(0), 0); L.loopTrack(uk, lesson, q(1), 1); L.loopTrack(uk, lesson, q(2), 0); L.loopTrack(uk, lesson, q(3), 2); L.loopExit(uk, "t1");
for (let i = 0; i < 10; i++) L.loopTrack(uk, lesson, q(i), 0, i === 9 ? "pass" : undefined);
rec = L.loopPassed(uk, lesson); check("разные ошибки двух выходов — обе, без повтора", rec && rec.exits === 2 && rec.wrong.length === 2 && rec.wrong.map(w => w.q).join() === "В2,В4");
// 7. Номер ачивки: вторая по счёту — n = 2 (для «снова попался»)
clear(); const lesson2 = { ...lesson, id: "t2", title: "Тест 2" };
L.loopTrack(uk, lesson, q(0), 1); L.loopExit(uk, "t1"); for (let i = 0; i < 10; i++) L.loopTrack(uk, lesson, q(i), 0, i === 9 ? "pass" : undefined);
const r1 = L.loopPassed(uk, lesson);
L.loopTrack(uk, lesson2, q(0), 1); L.loopExit(uk, "t2"); for (let i = 0; i < 10; i++) L.loopTrack(uk, lesson2, q(i), 0, i === 9 ? "pass" : undefined);
const r2 = L.loopPassed(uk, lesson2);
check("первая ачивка — n = 1, вторая — n = 2", r1 && r1.n === 1 && r2 && r2.n === 2);
check("тексты повтора: «Опять ты», «СНОВА», загадка про копилку", L.loopWords(2).punch.startsWith("Опять ты") && L.loopWords(2).stampTop === "СНОВА" && /копилке/.test(L.loopWords(2).teaser) && L.loopWords(5).stampTop === "5-Й РАЗ");
console.log(res.join("\n"));
