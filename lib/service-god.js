// lib/service-god.js — v166 (Доп. 491): «Бог сервиса» — все тесты всех шести треков на 100%.
// Владелец (15.11): «Да, должно быть у всех 6 ролей, так как чтобы быть богом сервиса, нужно знать всё».
// До v166 условие оставалось со времён четырёх ступеней зала («Новичок», «Ядро», «Менеджер», «Сервис-менеджер»), и
// считалось оно в двух местах по-разному: поздравление — открыта четвёртая ступень и все имеющиеся результаты по 100%;
// венок в рейтинге — хотя бы по одному результату в каждой ступени и все по 100%. Ни то ни другое не проверяло, что
// сданы все тесты, а «Бар» и «Хостес» в счёт не шли вовсе. Теперь правило одно, здесь, и оно строгое.
import { MODULES_INDEX } from "../data/modules-index";
import { countable } from "./info-topics";

/** Шесть треков: «Хостес», «Новичок», «Ядро», «Менеджер», «Сервис-менеджер», «Бар» */
export const GOD_TRACKS = ["spg", "seasonal", "core", "manager", "service_manager", "bar"];

/**
 * Номера тестов штатной программы по трекам. Темы «для ознакомления» не в счёт: их тест — самопроверка, результат в
 * рейтинг не уходит (Доп. 465), так что сдать его «на 100% для венка» нечем.
 */
export function godQuizIds(index = MODULES_INDEX, tracks = GOD_TRACKS) {
  const out = [];
  (tracks || []).forEach((r) => countable(index && index[r]).forEach((m) => (m.lessons || []).forEach((l) => { if (l && l.type === "quiz" && l.id) out.push(l.id); })));
  return out;
}
export const GOD_QUIZ_IDS = godQuizIds();

/** Лучший процент по каждому тесту из результатов одного человека: { номер теста: процент } */
export function bestByQuiz(scores) {
  const best = {};
  (Array.isArray(scores) ? scores : []).forEach((s) => {
    if (!s || !s.quiz_id) return;
    const pct = Number(s.pct);
    if (!Number.isFinite(pct)) return;
    if (!(s.quiz_id in best) || pct > best[s.quiz_id]) best[s.quiz_id] = pct;
  });
  return best;
}

/**
 * Сколько сделано к «Богу сервиса» — по результатам одного человека.
 *   total   — тестов в программе шести треков;
 *   perfect — из них сдано на 100% (берётся лучшая попытка);
 *   left    — номера тестов программы, где 100% ещё нет (не сдан или сдан ниже);
 *   weak    — свои тесты заведения (cms-…), сданные ниже 100%: «знать всё» — значит и их. Требовать, чтобы свои тесты были
 *             сданы, нельзя: у каждого заведения они свои, а рейтинг видит людей и из других заведений.
 * Тесты, которых в программе больше нет, в счёт не идут: старый результат по снятому тесту пересдать нечем.
 */
export function godProgress(scores, ids = GOD_QUIZ_IDS) {
  const best = bestByQuiz(scores), need = Array.isArray(ids) ? ids : [];
  const left = need.filter((id) => best[id] !== 100);
  const want = new Set(need);
  const weak = Object.keys(best).filter((id) => !want.has(id) && /^cms-/.test(id) && best[id] < 100);
  return { total: need.length, perfect: need.length - left.length, left, weak };
}

/** Венок заслужен: все тесты программы шести треков на 100% и ни одного своего теста ниже 100% */
export function isServiceGod(scores, ids = GOD_QUIZ_IDS) {
  const p = godProgress(scores, ids);
  return p.total > 0 && p.left.length === 0 && p.weak.length === 0;
}
