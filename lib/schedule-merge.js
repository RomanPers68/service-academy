// lib/schedule-merge.js — v93 (Доп. 406): смены из чата смены и «Сохранить» в графике. Передача и обмен смен в чате
// пишут в график сразу (этап 38, chat_shift_take / chat_shift_swap), а экран «График» у руководителя сохраняет месяц
// целиком — то, что загрузил когда-то. Без сведения обмен из чата пропадал бы молча. Перед сохранением экран берёт
// месяц с сервера и сводит по клеткам: что руководитель поменял сам — его; что не трогал — как на сервере.

const same = (a, b) => JSON.stringify(a == null ? "" : a) === JSON.stringify(b == null ? "" : b);
const empty = (v) => v == null || v === "" || v === false;

/**
 * Три версии клеток { id: { день: значение } }: base — какими загружены, mine — сейчас на экране, theirs — сейчас на
 * сервере. → { cells, fromServer: [[id, день], …] — клетки, взятые с сервера }. Строки, которые есть на экране, остаются
 * и пустыми (экран рассчитывает на них).
 */
export function mergeCells(base = {}, mine = {}, theirs = {}) {
  const b0 = base || {}, m0 = mine || {}, t0 = theirs || {};
  const out = {}, fromServer = [];
  for (const id of new Set([...Object.keys(b0), ...Object.keys(m0), ...Object.keys(t0)])) {
    const b = b0[id] || {}, m = m0[id] || {}, t = t0[id] || {}, row = {};
    for (const d of new Set([...Object.keys(b), ...Object.keys(m), ...Object.keys(t)])) {
      let v;
      if (same(m[d], b[d])) { v = t[d]; if (!same(t[d], b[d])) fromServer.push([id, d]); }
      else v = m[d];
      if (!empty(v)) row[d] = v;
    }
    if (Object.keys(row).length || m0[id]) out[id] = row;
  }
  return { cells: out, fromServer };
}

/** Дни, взятые с сервера, — для строки «Сохранено вместе с обменами из чата (14-е, 21-е)». */
export const mergedDays = (fromServer) => [...new Set((fromServer || []).map(([, d]) => Number(d)).filter((d) => d > 0))].sort((a, b) => a - b);
