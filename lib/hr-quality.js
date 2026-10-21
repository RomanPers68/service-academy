// ─────────────────────────────────────────────────────────────────────
// v66 (Доп. 379): насколько можно доверять AI HR — когда снимаем «бету».
// Владелец: «Как мы можем сделать умнее HR-а, чтобы снять с него подпись „beta“?»
// Договорились: «бета» снимается сама, когда выполнены ОБА условия —
//   1) эталонная проверка («Проверка AI HR» в собеседовании): на эталонных собеседованиях с заранее
//      известным итогом категория ИИ совпала в 90% и больше, и ни один красный флаг не пропущен;
//   2) живые собеседования: на последних 20 с вашим решением («Берём / Не берём») ИИ совпал в 80% и больше.
// Здесь только расчёты (без экрана) — их проверяют тесты tests/v66.test.js.
// ─────────────────────────────────────────────────────────────────────

export const AI_CATS = ["Рекомендован с оговорками", "Не рекомендован", "Рекомендован"];   // длинные — первыми
export const REF_SHARE = 0.9;    // эталоны: совпадение категории
export const REAL_N = 20;        // живые: сколько последних собеседований с решением
export const REAL_SHARE = 0.8;   // живые: совпадение с решением руководителя

// категория ИИ у записи собеседования: v66 хранит её отдельно, у прежних — начало вердикта
export const aiCatOf = (r) => {
  if (!r) return "";
  if (r.aiCategory) return r.aiCategory;
  const v = String(r.aiVerdict || "").trim().toLowerCase();
  return AI_CATS.find((c) => v.startsWith(c.toLowerCase())) || "";
};

export const DECISIONS = [{ id: "hire", label: "Берём" }, { id: "maybe", label: "Подумаю" }, { id: "reject", label: "Не берём" }];

// ИИ ↔ решение руководителя: «Рекомендован» и «с оговорками» — «брать», «Не рекомендован» — «не брать»;
// «Подумаю» и записи без категории ИИ (обычный тест) не считаем. last — сколько последних (по дате собеседования).
export function aiAgreement(list, last = 0) {
  const side = (r) => { const c = aiCatOf(r); return !c ? null : c === "Не рекомендован" ? "no" : "yes"; };
  const dec = (r) => (r.decision === "hire" ? "yes" : r.decision === "reject" ? "no" : null);
  let pairs = (list || []).filter((r) => r && side(r) && dec(r));
  if (last > 0) pairs = pairs.slice().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, last);
  return { n: pairs.length, agree: pairs.filter((r) => side(r) === dec(r)).length };
}

// ── эталонная проверка ──
// один эталон: ok — какие категории засчитываем, flag — красный флаг, который ИИ обязан найти
export function evalItem(c, got) {
  if (!got || got.error) return { id: c.id, ok: false, error: (got && got.error) || "nothing", got: "", risks: 0, missed: false, falseFlag: false };
  const risks = Array.isArray(got.risks) ? got.risks.length : 0;
  const cat = String(got.category || "");
  const missed = !!c.flag && risks === 0;
  const falseFlag = !c.flag && risks > 0;
  const ok = (c.ok || []).includes(cat) && !missed;
  const v = Object.values(got.scores || {}).map(Number).filter(Number.isFinite);
  return { id: c.id, ok, got: cat, risks, missed, falseFlag, avg: v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null };
}
// итог прогона: сколько совпало, сколько флагов пропущено, пройдено ли (все эталоны ответили)
export function evalSummary(items, total) {
  const n = items.length, done = items.filter((x) => !x.error).length;
  const match = items.filter((x) => x.ok).length, missed = items.filter((x) => x.missed).length;
  const share = n ? match / n : 0;
  const complete = n === total && done === total;
  return { n, done, match, missed, share, complete, pass: complete && share >= REF_SHARE && missed === 0 };
}

// ── «бета» или нет ──
// v67 (Доп. 380): проверка на эталонах засчитывается для той модели, на которой её прошли. Сменили модель
// (например, Haiku 4.5 → Haiku 5.5) — по последнему AI-интервью видно, что оценивает уже другая, и итог
// «устарел»: «бета» возвращается, пока проверку не пройдут заново.
export const modelKey = (m) => String(m || "").toLowerCase().split("/").pop().replace(/:.*$/, "").replace(/-\d{8}$/, "");
// последнее AI-интервью (v2), где известна модель: { model, date }
export function latestModel(results) {
  let best = null;
  for (const r of results || []) {
    if (!r || !r.aiModel || !(r.aiV >= 2)) continue;
    if (!best || new Date(r.date || 0) > new Date(best.date || 0)) best = r;
  }
  return best ? { model: best.aiModel, date: best.date } : null;
}
// ref — итог последней эталонной проверки (из hr_quality или с телефона), results — история собеседований
export function hrStatus(ref, results) {
  const ag = aiAgreement(results, REAL_N);
  const needAgree = Math.ceil(REAL_N * REAL_SHARE);
  const real = { n: ag.n, agree: ag.agree, need: Math.max(0, REAL_N - ag.n), needAgree, pass: ag.n >= REAL_N && ag.agree >= needAgree };
  // устарел — если ПОСЛЕ проверки интервью вела уже другая модель (проверили заново — снова свежий)
  const last = latestModel(results);
  const cur = last ? last.model : "";
  const stale = !!(ref && ref.model && last && new Date(last.date || 0) > new Date(ref.at || 0) && modelKey(ref.model) !== modelKey(cur));
  const refOk = !!(ref && ref.pass) && !stale;
  return { ref: ref || null, refOk, stale, cur, real, beta: !(refOk && real.pass) };
}
