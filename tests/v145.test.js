// v145: метка «сборка vNNN» в «Меню» снова показывает номер вышедшей версии (Доп. 466).
// Владелец (09.11), снимок экрана меню: «Пишет, что сборка 137. Хотя последняя 144 загружена». Метку меняли руками при
// каждом выпуске, с v138 по v144 её не меняли. Сторож ниже: номер в метке равен номеру последнего tests/vNNN.test.js, у
// каждого выпуска свой файл тестов, поэтому версия с отставшей меткой не пройдёт юнит-тесты перед выпуском.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

const rd = (p) => readFileSync(p, "utf8");
const lastVersion = () => Math.max(...readdirSync("tests").map((f) => (f.match(/^v(\d+)\.test\.js$/) || [])[1]).filter(Boolean).map(Number));
const labels = () => [...rd("ui/menu-trainer.jsx").matchAll(/· сборка v(\d+)<\/span>/g)].map((m) => Number(m[1]));

describe("v145: метка сборки в «Меню»", () => {
  it("метка одна и равна номеру последней версии (tests/vNNN.test.js)", () => {
    expect(labels()).toHaveLength(1);
    expect(lastVersion()).toBeGreaterThanOrEqual(145);
    expect(labels()[0]).toBe(lastVersion());
  });

  it("README: где смотреть номер сборки", () => {
    expect(rd("README.md")).toMatch(/Меню → под названием ресторана\s+строка вида «сборка v\d+»/);
  });

  it("CHANGES: Дополнение 466", () => {
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 466 — метка сборки/);
    expect(c).toMatch(/Пишет, что сборка 137/);
  });
});
