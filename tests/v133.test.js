// v133 (Доп. 446): урок в виде «Линза». Владелец (03.11, снимок урока «Сервис начинается с мышления»): «Нашел где ещё мы с
// тобой эффект линзы пропустили». ui/screens-learning.jsx — подложка урока, кнопки конца урока, «2 из 6», практика, игра,
// результат теста; e2e — tools/claude/e2e-v133.mjs (стили в тёмном и светлом виде, контраст).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const rd = (f) => readFileSync(f, "utf8");
const L = rd("ui/screens-learning.jsx");
const lesson = L.slice(L.indexOf("export function LessonScreen("), L.indexOf("export function GlossaryScreen("));

describe("v133: урок в виде «Линза»", () => {
  it("подложка урока — карточка линзы", () => {
    expect(lesson).toContain('{/* Стеклянная подложка для текста урока */}\n          <div data-lens-card="" data-lesson-glass="" style={{');
  });
  it("главные кнопки — стекло с кольцом: «Закрепить у стола», «Урок пройден ✓» (одна), «Далее», «Дальше», «Продолжить ✓», игра", () => {
    for (const x of ['data-tb-check="" data-lens-btn="main"', '<button className="sa-btn sa-btn-pulse" data-lens-btn="main" style={{ ...T.doneBtn, background: color, width: "100%", marginTop: mt }} onClick={onComplete}>Урок пройден ✓</button>',
      '<button className="sa-btn sa-btn-pulse" data-lens-btn="main" style={{ ...T.doneBtn, background: color, width: "100%", display: "flex"', '<button className="sa-btn" data-lens-btn="main" style={{ ...T.doneBtn, background: color, width: "100%" }} onClick={onNext}>',
      'data-lens-btn="main" style={{ ...T.doneBtn, background:color, marginTop:2 }} onClick={onPracticeNext}>', 'data-lens-btn="main" style={{ ...T.doneBtn, background:color, width:"100%", marginTop:8 }} onClick={onComplete}>Продолжить ✓</button>']) expect(lesson, x).toContain(x);
    expect((lesson.match(/data-lens-btn="main"/g) || []).length).toBe(7);
  });
  it("вторые кнопки — стекло с ободком и золотой надписью: «Урок пройден ✓» под «Закрепить», «2 из 6», «у стола», «Вернуться к урокам»", () => {
    expect(lesson).toContain('<button className="sa-btn" data-lens-btn="soft" data-lens-ink="" style={{ ...T.doneBtn, width: "100%", marginTop: 10, background: "transparent"');
    expect(lesson).toContain('<button onClick={onContents} data-lens-btn="soft" data-lens-ink="" aria-label=');
    expect(lesson).toContain('data-lens-btn="soft" data-lens-ink="" onClick={() => switchView(true)} aria-label="Вид «у стола»"');
    expect((lesson.match(/data-lens-btn="soft"/g) || []).length).toBe(5);
    expect(lesson).not.toMatch(/className="sa-btn(?: sa-btn-pulse)?"(?! data-)/);   // у каждой кнопки урока — вид линзы
  });
  it("варианты практики — стекло до ответа (как варианты теста), после — свои цвета", () => {
    expect((lesson.match(/className="sa-opt" data-lens-opt=\{bc === neutralBC \? "" : "m"\}/g) || []).length).toBe(4);
    expect(lesson).toContain('data-lens-opt={mark || ""}');
  });
  it("e2e и метка", () => {
    expect(rd("tools/claude/e2e-v133.mjs")).toContain('ok(`${tag}: «Закрепить у стола» — главная кнопка линзы`');
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(13[3-9]|1[4-9]\d|[2-9]\d\d)<\/span>/);
    expect(rd("CHANGES.md")).toContain("# Дополнение 446 — Урок в виде «Линза» (v133)");
  });
});
