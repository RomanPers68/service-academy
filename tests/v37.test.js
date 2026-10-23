// v37 (Доп. 348–350): «Живой диалог» — переписка с гостем как в мессенджере (один экран для уроков хостес,
// поппапов терминов у официанта и менеджера и «Гостя недели»), плавное движение ленты, ответы «с подвохом»
// во всех 53 штатных диалогах (верный больше не угадывается по длине), подсказка в редакторе и правила для ИИ.
// В браузере: tools/claude/e2e-v37.mjs (все места, где открывается диалог) и tools/claude/dlg-sweep.mjs
// (все 53 сценария до конца — верно, неверно, через один; покадровая плавность).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToString } from "react-dom/server";
import { DIALOGUES_DATA } from "../data/dialogues";
import { HINTS } from "../data/hints";
import { answerTell } from "../lib/answer-tell";
import { DLG_MOOD_WORDS, dlgTypingMs, dlgReaction, dlgGram, dlgWalkText, dlgWalkLine, dlgTip, dlgStars, dlgNextMood, dlgPathChoices, dlgQuote, LiveDialogue } from "../ui/screens-dialogue";
import { S } from "../ui/styles";

const read = (p) => readFileSync(p, "utf8");   // от корня проекта (vitest запускается из него)

describe("переписка: слова, ритм, реакции (Доп. 348)", () => {
  it("настроение словами — пять ступеней, без рода и числа", () => {
    expect(DLG_MOOD_WORDS).toEqual(["на взводе", "не в духе", "в порядке", "в хорошем настроении", "в восторге"]);
  });
  it("«печатает…» — тем дольше, чем длиннее реплика: 0,75–1,8 с", () => {
    expect(dlgTypingMs("")).toBe(750);
    expect(dlgTypingMs("Да.")).toBe(750);
    expect(dlgTypingMs("а".repeat(50))).toBe(1200);
    expect(dlgTypingMs("а".repeat(500))).toBe(1800);
  });
  it("реакция гостя — по сдвигу настроения (v75: лицо 1…5 вместо эмодзи)", () => {
    expect(dlgReaction({ moodDelta: 2, correct: true })).toBe(5);
    expect(dlgReaction({ moodDelta: 1, correct: true })).toBe(4);
    expect(dlgReaction({ moodDelta: 1, correct: false })).toBe(4);
    expect(dlgReaction({ moodDelta: 0, correct: true })).toBe(3);
    expect(dlgReaction({ correct: false })).toBe(3);
    expect(dlgReaction({ moodDelta: -1 })).toBe(2);
    expect(dlgReaction({ moodDelta: -2 })).toBe(1);
  });
  it("род и число гостя: ушёл / ушла / ушли", () => {
    expect(dlgGram("Михаил")).toBe("m");
    expect(dlgGram("Ольга")).toBe("f");
    expect(dlgGram("Семья Петровых")).toBe("f");
    expect(dlgGram("Гости")).toBe("pl");
    expect(dlgGram("Туристы из Китая")).toBe("pl");
    // своё имя на -и — не множественное (ревью v37)
    expect(dlgGram("Наоми")).not.toBe("pl");
    expect(dlgGram("Тони")).not.toBe("pl");
    expect(dlgWalkText("Гость")).toBe("Гость не выдержал и уходит, не дождавшись хорошего приёма.");
    expect(dlgWalkText("Пара")).toBe("Пара не выдержала и уходит, не дождавшись хорошего приёма.");
    expect(dlgWalkText("Гости")).toBe("Гости не выдержали и уходят, не дождавшись хорошего приёма.");
  });
  it("уход: своя фраза сценария важнее общей (стажёр, смена, эвакуация)", () => {
    expect(dlgWalkLine({ name: "Зал", walk: "Зал в панике: люди толпятся у дверей, эвакуация идёт без тебя." })).toBe("Зал в панике: люди толпятся у дверей, эвакуация идёт без тебя.");
    expect(dlgWalkLine({ name: "Ольга", walk: "  " })).toBe(dlgWalkText("Ольга"));
    expect(dlgWalkLine(null)).toBe(dlgWalkText("Гость"));
    for (const id of ["spg-b8-1", "spg-b8-2", "spg-b8-3", "spg-b9-1"]) {
      const g = DIALOGUES_DATA.find((d) => d.id === id).guest;
      expect(g.walk && g.walkTitle, id).toBeTruthy();
      expect(g.walk).not.toMatch(/хорошего приёма/);
    }
  });
  it("итог наставника — один «✦» (было «✦✦»)", () => {
    expect(dlgTip("✦ Старшая хостес — спокойный центр.")).toBe("Старшая хостес — спокойный центр.");
    expect(dlgTip("  ✦Коротко")).toBe("Коротко");
    expect(dlgTip(undefined)).toBe("");
  });
  it("настроение после ответа: +moodDelta в пределах 1…5, ноль — это 1 (было 3: гость не уходил)", () => {
    expect(dlgNextMood(2, -2)).toBe(1);
    expect(dlgNextMood(1, -1)).toBe(1);
    expect(dlgNextMood(3, -1)).toBe(2);
    expect(dlgNextMood(4, 2)).toBe(5);
    expect(dlgNextMood(3, undefined)).toBe(3);
    expect(dlgNextMood(undefined, 1)).toBe(4);
  });
  it("«N из M»: M — по пути верных ответов, ветки «спасения» не обещаются заранее", () => {
    const steps = [
      { type: "choice", id: "a", options: [{ correct: true, goto: "b" }, { correct: false, goto: "x" }] },
      { type: "guest", id: "b", text: "…" },
      { type: "choice", options: [{ correct: true }, { correct: false }] },
      { type: "result" },
      { type: "guest", id: "x", text: "…" },
      { type: "choice", options: [{ correct: true, goto: "b" }, { correct: false, goto: "result" }] },
    ];
    expect(dlgPathChoices(steps, 0)).toBe(2);   // a → b → выбор → итог
    expect(dlgPathChoices(steps, 5)).toBe(2);   // ветка: этот выбор → b → выбор
    expect(dlgPathChoices([{ type: "choice", options: [] }, { type: "result" }], 0)).toBe(0);
    expect(dlgPathChoices(undefined, 0)).toBe(0);
    // по штатным: «громкая претензия» — 4 вопроса по верному пути (всего выборов 5)
    const b6 = DIALOGUES_DATA.find((d) => d.id === "spg-b6-1");
    expect(dlgPathChoices(b6.steps, 0)).toBe(4);
  });
  it("«Лучше так» — без двойных ёлочек", () => {
    expect(dlgQuote("Проходите, пожалуйста")).toBe("«Проходите, пожалуйста»");
    expect(dlgQuote("«Добрый вечер!» — и улыбаюсь")).toBe("«Добрый вечер!» — и улыбаюсь");
  });
  it("звёзды урока — прежняя формула", () => {
    expect(dlgStars({ walkedOut: true, score: 3, den: 3, mood: 5 })).toBe(0);
    expect(dlgStars({ walkedOut: false, score: 3, den: 3, mood: 4 })).toBe(3);
    expect(dlgStars({ walkedOut: false, score: 3, den: 3, mood: 3 })).toBe(2);
    expect(dlgStars({ walkedOut: false, score: 2, den: 3, mood: 3 })).toBe(2);
    expect(dlgStars({ walkedOut: false, score: 1, den: 3, mood: 2 })).toBe(1);
    expect(dlgStars({ walkedOut: false, score: 0, den: 3, mood: 3 })).toBe(0);
  });
});

describe("ответы с подвохом: верный не угадывается по длине (Доп. 349)", () => {
  const choices = DIALOGUES_DATA.flatMap((d) => d.steps.filter((s) => s.type === "choice").map((s) => ({ d, s })));
  it("53 сценария, 204 выбора, в каждом — ровно один верный, у каждого варианта есть разбор", () => {
    expect(DIALOGUES_DATA.length).toBe(53);
    expect(choices.length).toBe(204);
    for (const { d, s } of choices) {
      expect(s.options.length, d.id).toBeGreaterThanOrEqual(2);
      expect(s.options.filter((o) => o.correct).length, d.id + ": " + s.prompt).toBe(1);
      for (const o of s.options) {
        expect(String(o.text || "").trim().length, d.id).toBeGreaterThan(0);
        expect(String(o.feedback || "").trim().length, d.id + ": разбор").toBeGreaterThan(0);
        expect(o.text, d.id + ": прямые кавычки").not.toMatch(/"/);
      }
    }
  });
  it("длины вариантов одного выбора — почти равны (разброс ≤ 1,3), подсказка «по длине» ни разу не срабатывает", () => {
    for (const { d, s } of choices) {
      const L = s.options.map((o) => o.text.length);
      expect(Math.max(...L) / Math.min(...L), d.id + ": " + s.prompt).toBeLessThanOrEqual(1.3);
      expect(answerTell(s.options), d.id + ": " + s.prompt).toBe(false);
    }
  });
  it("верный — самый длинный не чаще 40% выборов и самый короткий тоже (было почти 90%)", () => {
    let longest = 0, shortest = 0;
    for (const { s } of choices) {
      const L = s.options.map((o) => o.text.length), c = s.options.findIndex((o) => o.correct);
      const mx = Math.max(...L), mn = Math.min(...L);
      if (L[c] === mx && L.filter((v) => v === mx).length === 1) longest++;
      if (L[c] === mn && L.filter((v) => v === mn).length === 1) shortest++;
    }
    expect(longest / choices.length).toBeLessThanOrEqual(0.4);
    expect(shortest / choices.length).toBeLessThanOrEqual(0.4);
  });
  it("переходы сценариев целы: next и goto ведут на существующие шаги, у каждого есть итог", () => {
    for (const d of DIALOGUES_DATA) {
      const ids = new Set(d.steps.map((s) => s.id).filter(Boolean));
      expect(d.steps.some((s) => s.type === "result"), d.id).toBe(true);
      for (const s of d.steps) {
        if (s.next && s.next !== "result") expect(ids.has(s.next), d.id + " next " + s.next).toBe(true);
        for (const o of s.options || []) if (o.goto && o.goto !== "result") expect(ids.has(o.goto), d.id + " goto " + o.goto).toBe(true);
      }
    }
  });
  it("answerTell: строки и объекты; короткие и ровные — не подсказка", () => {
    expect(answerTell(["Да, конечно", "Нет"], 0)).toBe(false);   // верный короче 30 знаков — по длине не выдаёт
    expect(answerTell(["Коротко", "Подробно и длинно объясняю гостю всё, что знаю о блюде"], 1)).toBe(true);
    expect(answerTell([{ text: "Предложу проводить к столу и уточню, удобно ли место", correct: true }, { text: "Скажу подождать", correct: false }])).toBe(true);
    expect(answerTell([{ text: "Предложу проводить к столу и уточню, удобно ли", correct: true }, { text: "Попрошу подождать у стойки, пока освободится стол", correct: false }])).toBe(false);
    expect(answerTell([], 0)).toBe(false);
    expect(answerTell(["один"], 0)).toBe(false);
  });
});

describe("подсказки и защита своих уроков (Доп. 348–349)", () => {
  it("«Гость недели»: подсказка про разбор наставника и кольцо настроения в шапке", () => {
    expect(HINTS.weeklyGuest[1]).toMatch(/наставник шепнёт разбор/);
    expect(HINTS.weeklyGuest[1]).toMatch(/кольцо вокруг гостя в шапке/);
  });
  it("редактор контента предупреждает «угадают по длине» — и в диалоге, и в тесте", () => {
    const src = read("ui/content-editor.jsx");
    expect(src).toMatch(/import \{ answerTell \} from "\.\.\/lib\/answer-tell"/);
    expect((src.match(/data-len-tell=""/g) || []).length).toBe(2);
  });
  it("ИИ-помощник урока: варианты одной длины, верный не выделяется (вопросы, диалог, ситуации)", () => {
    const src = read("api/lesson-assist.js");
    expect((src.match(/выделя(ться|ется)/g) || []).length).toBeGreaterThanOrEqual(3);
    expect(src).toMatch(/ловушка/);
  });
});

describe("экран переписки: устройство (Доп. 348, 350)", () => {
  const src = read("ui/screens-dialogue.jsx");
  it("назад — стрелка в шапке, её жмёт и кнопка «Назад» Telegram (data-sa-back); onClose знает, дошёл ли разговор до конца", () => {
    expect(src).toMatch(/className="dc-back" data-sa-back="" aria-label="Назад" onClick=\{\(\) => onClose\(done && !walkedOut, \{ done, walkedOut \}\)\}/);
    expect(src).toMatch(/onClose\(!walkedOut, \{ done: true, walkedOut \}\)/);
  });
  it("урок-диалог засчитывается, когда разговор дошёл до конца; вышел посреди — назад без отметки", () => {
    const app = read("App.jsx");
    expect(app).toMatch(/if \(finished === true \|\| \(st && st\.done\)\) completeLesson\(\); else goBack\("module"\);/);
  });
  it("стили экрана — только под .sa-dlg.dc: голый «.dc» есть у клеток недели в «Свече на двоих»", () => {
    const css = src.slice(src.indexOf("const DLG_CSS = `"), src.indexOf("`;", src.indexOf("const DLG_CSS = `")));
    expect(css.length).toBeGreaterThan(1000);
    expect(css).not.toMatch(/(^|[\s,{}(])\.dc[\s,{.:*)]/m);
    expect(css).toMatch(/\.sa-dlg\.dc\{/);
    expect(read("ui/together.jsx")).toMatch(/className="dc"/);   // поэтому и нужно
  });
  it("плавность: панель ответов поверх переписки (transform), запасное поле, одно скольжение ленты", () => {
    expect(src).toMatch(/\.dc-pane\{[^}]*position:absolute/);
    expect(src).toMatch(/translateY\(100%\)/);
    expect(src).toMatch(/className="dc-spacer"/);
    expect(src).toMatch(/feed\.animate\(/);
    expect(src).not.toMatch(/backdrop-filter/);   // размытие под шапкой дёргало прокрутку на iPhone
  });
  it("«печатает…» превращается в саму реплику (тот же ключ пузыря)", () => {
    expect(src).toMatch(/typing: true, id: idRef\.current \+ 1/);
  });
  it("звуки отправки и ответа", () => {
    const sfx = read("lib/sfx.js");
    expect(sfx).toMatch(/name === "send"/);
    expect(sfx).toMatch(/name === "recv"/);
  });
  it("рисуется: шапка с гостем, «Назад», выключатель звука, номер сценария", async () => {
    const { loadDialogues } = await import("../data/dialogues-lazy");
    await loadDialogues();
    const html = renderToString(React.createElement(LiveDialogue, { dialogueId: "anticipation", T: S, onClose() {}, color: "#C8A96E" }));
    const d = DIALOGUES_DATA.find((x) => x.id === "anticipation");
    expect(html).toMatch(/data-dlg="anticipation"/);
    expect(html).toContain(d.guest.name);
    expect(html).toMatch(/data-sa-back=""/);
    expect(html).toMatch(/data-dlg-sound=/);
    // свой диалог из редактора (inline) — тот же экран
    const own = { id: "cms-d-1", guest: { name: "Ольга", avatar: "👩", context: "Ждёт менеджера", mood: 2 }, steps: [{ type: "guest", text: "Позовите менеджера!" }, { type: "result" }] };
    const html2 = renderToString(React.createElement(LiveDialogue, { inline: own, T: S, onClose() {}, pro: true }));
    expect(html2).toMatch(/data-dlg="cms-d-1"/);
    expect(html2).toContain("Ольга");
  });
});
