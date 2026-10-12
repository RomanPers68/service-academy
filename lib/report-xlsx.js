// lib/report-xlsx.js — Доп. 309: Excel по команде (или по одному сотруднику).
// Листы: «Сводка» (строка — сотрудник), «Где ошибается», «С чем работать»,
// «Что не пройдено», «Ждут повтора», «Навыки». Фильтры и закреплённая шапка — на каждом.

import { buildXlsx } from "./xlsx.js";
import { shortDate } from "./report-model.js";

const SKILL_STATUS = { hall: "Подтверждён в зале", pin: "Подтверждён по PIN", pending: "Ждёт старшего", declined: "Ещё рано" };

export function teamSheets(team) {
  const people = (team && team.people) || [];
  const who = (p) => p.full + (team && team.scope && team.scope !== "restaurant" && p.restaurant ? " · " + p.restaurant : "");
  const summary = {
    name: "Сводка", tab: "C8A96E",
    columns: [
      { header: "Сотрудник", width: 24, style: "bold" }, { header: "Ресторан", width: 18 }, { header: "Должность", width: 16 },
      { header: "Трек", width: 14 }, { header: "Пройдено шагов", width: 10, style: "int" }, { header: "Всего в треке", width: 10, style: "int" },
      { header: "Трек, %", width: 9, style: "pct" }, { header: "Тестов сдано", width: 9, style: "int" }, { header: "Средний балл", width: 9, style: "pct" },
      { header: "Ошибок в тестах за 30 дней", width: 12, style: "int" }, { header: "Вопросов с ошибкой (не исправлено)", width: 14, style: "int" },
      { header: "Ждут повтора", width: 10, style: "int" }, { header: "Дней занятий из 14", width: 10, style: "int" }, { header: "Разминок за 30 дней", width: 10, style: "int" },
      { header: "Навыков в зале", width: 10, style: "int" }, { header: "Экзамен", width: 16 }, { header: "Последнее занятие", width: 16 },
      { header: "Обратить внимание", width: 46, style: "wrap" },
      // v30: живая практика
      { header: "Живой гость за 30 дней", width: 10, style: "int" }, { header: "Средний чек разбора", width: 10, style: "num1" },
      { header: "Тем выдыхается", width: 10, style: "int" }, { header: "Золотых тем", width: 9, style: "int" }, { header: "Зачтено по опыту", width: 26, style: "wrap" },
    ],
    rows: people.map((p) => {
      const warn = p.flags.filter((f) => f.level === "warn").map((f) => f.text);
      const good = p.flags.filter((f) => f.level === "good").map((f) => f.text);
      const ex = p.exams.length ? p.exams.map((e) => e.label + ": " + (e.passed ? "сдан" : "не сдан") + (e.score ? " (" + e.score + "%)" : "")).join("; ") : "";
      return [
        p.full, p.restaurant, p.positionLabel, p.main ? p.main.label : "", p.main ? p.main.done : 0, p.main ? p.main.total : 0,
        { v: p.main && p.main.total ? p.main.done / p.main.total : 0, s: "pct" }, p.tests.passed, p.tests.avg == null ? "" : { v: p.tests.avg / 100, s: "pct" },
        p.wrong30, p.unfixed, p.repeat.due, p.activity.active14, p.activity.warm30, p.skills.confirmed, ex, p.seenLabel,
        warn.length ? { v: warn.join("; "), s: "warn" } : good.length ? { v: good.join("; "), s: "good" } : "",
        ...(p.live ? [p.live.guests.n30, p.live.guests.avg == null ? "" : { v: p.live.guests.avg, s: "num1" }, p.live.fresh.fading, p.live.gold.length,
          p.live.credits.map((c) => c.title).join(", ")] : ["", "", "", "", ""]),
      ];
    }),
  };
  const wrong = {
    name: "Где ошибается", tab: "C0624B",
    columns: [{ header: "Сотрудник", width: 22, style: "bold" }, { header: "Тема", width: 22, style: "wrap" }, { header: "Вопрос", width: 48, style: "wrap" },
      { header: "Ответил", width: 30, style: "wrap" }, { header: "Верно", width: 30, style: "wrap" }, { header: "Ошибок", width: 8, style: "int" },
      { header: "Ответов", width: 8, style: "int" }, { header: "Потом ответил верно", width: 11 }, { header: "Последний раз", width: 13 }],
    rows: people.flatMap((p) => p.wrong.map((w) => [who(p), w.topic, w.q, w.chosen, w.right, w.wrong, w.total, w.fixed ? "да" : { v: "нет", s: "warn" }, shortDate(w.last)])),
  };
  const weak = {
    name: "С чем работать", tab: "D9B87C",
    columns: [{ header: "Сотрудник", width: 22, style: "bold" }, { header: "Тема", width: 30, style: "wrap" }, { header: "Почему", width: 46, style: "wrap" },
      { header: "Ошибок", width: 8, style: "int" }, { header: "Ответов", width: 8, style: "int" }, { header: "Доля ошибок", width: 9, style: "pct" }, { header: "На повторе", width: 9, style: "int" }],
    rows: people.flatMap((p) => p.weak.map((w) => [who(p), w.topic, w.why, w.wrong, w.total, w.total ? { v: w.wrong / w.total, s: "pct" } : "", w.mist])),
  };
  const notDone = {
    name: "Что не пройдено", tab: "7C9E87",
    columns: [{ header: "Сотрудник", width: 22, style: "bold" }, { header: "Трек", width: 14 }, { header: "Тема", width: 34, style: "wrap" },
      { header: "Шаг", width: 46, style: "wrap" }, { header: "Тип", width: 11 }],
    rows: people.flatMap((p) => (p.notDone.modules || []).flatMap((m) => m.steps.map((s) => [who(p), p.main ? p.main.label : "", m.title, s.title, s.kind]))),
  };
  const repeat = {
    name: "Ждут повтора", tab: "8B7BAB",
    columns: [{ header: "Сотрудник", width: 22, style: "bold" }, { header: "Вопрос", width: 50, style: "wrap" }, { header: "Верный ответ", width: 34, style: "wrap" },
      { header: "Тема", width: 24, style: "wrap" }, { header: "Повтор (этап)", width: 9, style: "int" }, { header: "Ждёт сейчас", width: 9 }],
    rows: people.flatMap((p) => p.repeat.list.map((m) => [who(p), m.q, m.a, m.topic, m.stage + 1, m.isDue ? { v: "да", s: "warn" } : "позже"])),
  };
  const skills = {
    name: "Навыки", tab: "5DBB8A",
    columns: [{ header: "Сотрудник", width: 22, style: "bold" }, { header: "Навык", width: 34, style: "wrap" }, { header: "Статус", width: 20 },
      { header: "Кто подтвердил", width: 20 }, { header: "Когда", width: 12 }, { header: "Записка", width: 34, style: "wrap" }],
    rows: people.flatMap((p) => p.skills.list.map((s) => [who(p), s.label, s.status === "hall" ? { v: SKILL_STATUS.hall, s: "good" } : SKILL_STATUS[s.status] || s.status, s.by, shortDate(s.date) || s.date, s.note])),
  };
  return [summary, wrong, weak, notDone, repeat, skills];
}

export function teamXlsx(team) {
  return buildXlsx(teamSheets(team), { title: "Отчёт по команде" + (team && team.scopeLabel ? " · " + team.scopeLabel : ""), author: "Service Academy" });
}

export function personXlsx(person) {
  return buildXlsx(teamSheets({ scope: "restaurant", people: [person] }), { title: "Отчёт · " + person.full, author: "Service Academy" });
}

const safe = (s) => String(s || "").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, "_").slice(0, 60);
export const teamFileName = (team, ext = "xlsx") => "Отчёт_команда_" + safe(team && team.scopeLabel) + "_" + new Date().toISOString().slice(0, 10) + "." + ext;
export const personFileName = (p, ext = "pdf") => "Отчёт_" + safe(p && p.full) + "_" + new Date().toISOString().slice(0, 10) + "." + ext;
