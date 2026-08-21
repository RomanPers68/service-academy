// lib/schedule-gen.js — генератор расстановки смен.
//
// Вынесен из ui/schedule.jsx в чистый модуль по двум причинам:
// 1) его можно гонять тестами в Node без браузера;
// 2) алгоритм вырос с одного жадного прохода до трёх уровней.
//
// Как думает генератор:
//   Уровень 1 — жадный проход по дням (как раньше), но все ограничения
//     проверяет единый валидатор canPlace: одна точка истины вместо
//     рассыпанных условий. Бонус: отдых теперь проверяется с ОБОИМИ
//     соседними днями, а серия «подряд» считается через день целиком.
//   Уровень 2 — мультистарт: 24 прогона с разными случайными
//     тай-брейками; побеждает расстановка с лучшим счётом
//     (недоборы → недоработки → справедливость пиков).
//   Уровень 3 — ремонт: оставшиеся дыры пробуем закрыть перестановкой —
//     снять у человека смену в соседнем дне (отдав её свободному
//     коллеге) и вывести его в день недобора. Жадный проход так не
//     умеет: он не оглядывается назад.
//
// Жёсткие правила (отпуск, выходные, цикл 2/2, отдых, «подряд»,
// выходные недели, потолок нормы) не нарушаются НИКОГДА: и жадный шаг,
// и ремонт ходят только через canPlace.

// Небольшой детерминируемый ГПСЧ: прогоны воспроизводимы внутри клика.
const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export function generateSchedule({ cfg, DAYS, dow, lvlOf, plan, locks, POS, mkey, wishes = {}, restarts = 24, repairSweeps = 2 }) {
  // wishes: { [staffId]: [дни, когда человек просил выходной] } — мягкое
  // правило: покрытие зала важнее, но при прочих равных пожелание уважается.
  const wished = (id, d) => Array.isArray(wishes[id]) && wishes[id].includes(d);
  const R = cfg.rules || {};
  const staff = cfg.staff || [];
  const shiftOf = k => (cfg.shifts || []).find(s => s.k === k);
  const len = s => s.to - s.from;
  const needOf = d => (cfg.need || {})[lvlOf(d)] || {};
  const auto = (cfg.shifts || []).filter(x => !x.extra);
  if (!auto.length || !staff.length) return { plan: null, shortage: 0 };

  const onVac = (s, d) => s.vac && s.vac[2] === mkey && d >= s.vac[0] && d <= s.vac[1];
  // Норма с учётом отпуска: иначе floor-режим трамбует отпускника в
  // оставшиеся дни до полной нормы (в рамках правил, но плотнее некуда).
  const effNorm = (s) => {
    if (!(s.vac && s.vac[2] === mkey && s.vac[0])) return s.norm || 0;
    const vd = Math.max(0, Math.min(DAYS, s.vac[1]) - Math.max(1, s.vac[0]) + 1);
    return Math.round((s.norm || 0) * (DAYS - vd) / DAYS);
  };
  const offDays = s => (s.offDays && s.offDays[mkey]) || [];
  const isDayOff = (s, d) => (s.off || []).includes(dow(d)) || offDays(s).includes(d);
  const isLocked = (id, d) => !!(locks[id] && locks[id][d]);

  // Смещение цикла 2/2 у каждого своё, иначе вся позиция уйдёт отдыхать разом
  const cycleOffset = (s) => {
    const list = staff.filter(x => x.pos === s.pos);
    const i = list.findIndex(x => x.id === s.id);
    return list.length ? Math.round(i * 4 / list.length) % 4 : 0;
  };
  const inCycle = (s, d) => {
    const rule = (cfg.posRules || {})[s.pos];
    if (!rule || rule.pattern !== "2x2") return true;
    return ((d - 1 + cycleOffset(s)) % 4) < 2;
  };

  // Сколько дней ТЕКУЩЕЙ календарной недели человек уже отработал: жадный
  // без этого тратил недельную квоту выходных в начале окна и оставлял
  // воскресенье пустым (сентябрь-2026, 6-е: официанты 1/5 — все упёрлись
  // в minOff к концу обрезанной первой недели).
  const weekWorked = (pm, s, d) => {
    const start = Math.max(1, d - dow(d));
    let w = 0;
    for (let i = start; i < d; i++) if (pm[s.id][i]) w++;
    return w;
  };
  const hoursOf = (pm, s) => {
    let h = 0;
    for (let d = 1; d <= DAYS; d++) { const q = shiftOf(pm[s.id][d]); if (q) h += len(q); }
    return h;
  };

  // ── Единая точка истины: можно ли поставить s в день d на смену k ──
  const canPlace = (pm, s, d, k) => {
    const sh = shiftOf(k);
    if (!sh || sh.extra) return false;
    if (pm[s.id][d]) return false;
    if (onVac(s, d) || isDayOff(s, d) || !inCycle(s, d)) return false;
    if (s.notBefore && sh.from < s.notBefore) return false;
    // Потолок нормы
    // Потолок (cap) — предел переработки, его отпуск НЕ уменьшает: отпуск
    // и так съедает часы днями, а срезанный потолок создавал бы искусственный
    // дефицит и дыры в зале. Эффективная норма — только для floor-режима.
    if ((R.normMode || "floor") === "cap" && hoursOf(pm, s) + len(sh) > (s.norm || 0)) return false;
    // Отдых с обоими соседями (жадный проход раньше смотрел только назад)
    const pv = d > 1 && shiftOf(pm[s.id][d - 1]);
    if (pv && (24 - pv.to + sh.from) < R.minRest) return false;
    const nx = d < DAYS && shiftOf(pm[s.id][d + 1]);
    if (nx && (24 - sh.to + nx.from) < R.minRest) return false;
    // «Подряд» через день целиком, а не только слева
    let run = 1;
    for (let x = d - 1; x >= 1 && pm[s.id][x]; x--) run++;
    for (let x = d + 1; x <= DAYS && pm[s.id][x]; x++) run++;
    if (run > R.maxRow) return false;
    // Выходные недели: после постановки должно остаться место под норму отдыха
    const start = d - dow(d), end = Math.min(DAYS, start + 6);
    let n = 0, work = 1;
    for (let i = Math.max(1, start); i <= end; i++) { n++; if (i !== d && pm[s.id][i]) work++; }
    const needOffW = n >= 7 ? R.minOff : Math.round(R.minOff * n / 7);
    if ((n - work) < needOffW) return false;
    return true;
  };

  // Слоты дня: потребность минус занятые вручную. Кейтеринг и прочие
  // «вручную»-смены потребность НЕ закрывают — как и в проверке-аудите.
  const daySlots = (pm, d) => {
    const need = needOf(d), slots = [];
    const dayK = (cfg.dayShift && shiftOf(cfg.dayShift)) ? cfg.dayShift : auto[0].k;
    POS.forEach(({ id: pos }) => {
      const total = need[pos] || 0;
      if (!total) return;
      const sp = (cfg.split || {})[pos];
      const busyIn = k => staff.filter(s => s.pos === pos && shiftOf(pm[s.id][d])?.k === k).length;
      if (sp && Object.keys(sp).length) {
        // Разбивка — СТРУКТУРА в пределах потребности дня, а не жёсткие
        // числа поверх неё. Прод-кейс «Два моря»: split «Д:5+В:1» строил
        // 6 слотов КАЖДЫЙ день при буднях need=5 — будни переедали (6/5),
        // квоты выходных сгорали, воскресенья вставали 1/5.
        // Правило: минорные буквы (В:1) получают свои места первыми,
        // остальное — основной букве; всего слотов ровно need. Если need
        // больше суммы разбивки — добор основной буквой (flex).
        const entries = Object.entries(sp).filter(([k]) => shiftOf(k));
        if (entries.length) {
          const mainK = entries.slice().sort((a, b) => (b[1] || 0) - (a[1] || 0))[0][0];
          const busyAll = staff.filter(x => {
            const q = x.pos === pos && shiftOf(pm[x.id][d]); return q && !q.extra;
          }).length;
          let freeTotal = Math.max(0, total - busyAll);
          // минорные буквы (В:1 и т.п.): их места первыми, с учётом занятых
          entries.filter(([k]) => k !== mainK).forEach(([k, cnt]) => {
            const seats = Math.max(0, Math.min(cnt || 0, total) - busyIn(k));
            const take = Math.min(seats, freeTotal);
            for (let i = 0; i < take; i++) slots.push({ pos, k });
            freeTotal -= take;
          });
          // основная буква добирает остаток потребности; flex — при
          // нехватке людей сработает подбор другой авто-смены
          for (let i = 0; i < freeTotal; i++) slots.push({ pos, k: mainK, flex: true });
        }
      } else {
        const already = staff.filter(s => {
          const q = s.pos === pos && shiftOf(pm[s.id][d]);
          return q && !q.extra;      // фикс: кейтеринг больше не «закрывает» зал
        }).length;
        // flex: без разбивки нужен «человек в день» — если на основную смену
        // никто не проходит, подойдёт любая другая авто-смена (так же
        // считает и проверка-аудит на экране).
        for (let i = 0; i < total - already; i++) slots.push({ pos, k: dayK, flex: true });
      }
    });
    // Устаревшее вечернее усиление (поля в настройках уже нет): работает
    // В ПРЕДЕЛАХ потребности, а не сверх неё. Прод-кейс «Два моря»: evening
    // добавлял +1 слот КАЖДЫЙ день поверх need — будни раздувались до 6/5,
    // недельные квоты выходных сгорали к субботе, воскресенья вставали 1/5.
    // Теперь усиление ПЕРЕКРАШИВАЕТ часть дневных слотов в вечерние:
    // потребность 5 → 4 дневных + 1 вечерний, людей ровно сколько нужно.
    const ev = cfg.evening;
    if (ev && ev.count && shiftOf(ev.shift) && (ev.dows || []).includes(dow(d))
        && !((cfg.split || {})[ev.pos] && Object.keys(cfg.split[ev.pos]).length)) {
      const busy = staff.filter(s => s.pos === ev.pos && shiftOf(pm[s.id][d])?.k === ev.shift).length;
      let left = Math.max(0, ev.count - busy);
      for (const sl of slots) {
        if (!left) break;
        if (sl.pos === ev.pos && sl.flex) { sl.k = ev.shift; sl.flex = false; left--; }
      }
    }
    return slots;
  };

  const countShort = (pm) => {
    let short = 0;
    for (let d = 1; d <= DAYS; d++) short += daySlots(pm, d).length;
    return short;
  };

  // ── Один жадный прогон с джиттером тай-брейков ──
  const runOnce = (rng) => {
    const pm = {}; staff.forEach(s => { pm[s.id] = {}; });
    const hrs = {}, cnt = {}, peak = {}, jit = {}, kCnt = {};
    staff.forEach(s => { hrs[s.id] = 0; cnt[s.id] = 0; peak[s.id] = 0; jit[s.id] = rng(); kCnt[s.id] = {}; });

    for (let d = 1; d <= DAYS; d++) staff.forEach(s => {
      const keep = isLocked(s.id, d) ? (plan[s.id]?.[d] || "") : "";
      pm[s.id][d] = keep;
      const sh = keep && shiftOf(keep);
      if (sh) { hrs[s.id] += len(sh); cnt[s.id]++; kCnt[s.id][keep] = (kCnt[s.id][keep] || 0) + 1; if (lvlOf(d) === 3) peak[s.id]++; }
    });

    for (let d = 1; d <= DAYS; d++) {
      const isPeak = lvlOf(d) === 3;
      const slots = daySlots(pm, d)
        .map(sl => ({ ...sl, r: rng() }))    // стабильный ключ вместо рандома в компараторе
        .sort((a, b) => (len(shiftOf(b.k)) || 0) - (len(shiftOf(a.k)) || 0) || a.r - b.r);
      slots.forEach(sl => {
        const sh = shiftOf(sl.k); if (!sh) return;
        const cand = staff.filter(s => s.pos === sl.pos && canPlace(pm, s, d, sl.k))
          .sort((a, b) => {
            const wshA = wished(a.id, d) ? 1 : 0, wshB = wished(b.id, d) ? 1 : 0;
            if (wshA !== wshB) return wshA - wshB;      // пожелание — первый ключ
            if (isPeak && peak[a.id] !== peak[b.id]) return peak[a.id] - peak[b.id];
            // Минорная буква разбивки (В:1 — слот без flex): справедливость
            // ЭТОЙ буквы решает раньше общих ключей, иначе вечера раздаются
            // «кому достанется» — на проде у одних 2 «В» в месяц, у других 6.
            if (!sl.flex) {
              const ea = kCnt[a.id][sl.k] || 0, eb = kCnt[b.id][sl.k] || 0;
              if (ea !== eb) return ea - eb;
            }
            if ((R.normMode || "floor") === "floor") {
              if (cnt[a.id] !== cnt[b.id]) return cnt[a.id] - cnt[b.id];
              if (hrs[a.id] !== hrs[b.id]) return hrs[a.id] - hrs[b.id];
            }
            // Справедливость типа смены ПРИ РАЗДАЧЕ: вечерний слот уходит
            // тому, у кого вечеров меньше — прод-жалоба: у одних 2 «В» за
            // месяц, у других 6. Score-штраф спреда один не справлялся.
            const ka = kCnt[a.id][sl.k] || 0, kb = kCnt[b.id][sl.k] || 0;
            if (ka !== kb) return ka - kb;
            const dh = (effNorm(b) - hrs[b.id]) - (effNorm(a) - hrs[a.id]);
            if (dh) return dh;
            // Резерв недели: кто меньше отработал в текущем окне — тот первым,
            // чтобы квота выходных не кончалась у всех разом к воскресенью
            const wwA = weekWorked(pm, a, d), wwB = weekWorked(pm, b, d);
            if (wwA !== wwB) return wwA - wwB;
            const wa = d > 1 && pm[a.id][d - 1] ? 1 : 0, wb = d > 1 && pm[b.id][d - 1] ? 1 : 0;
            if (wb - wa) return wb - wa;           // клеим выходные по два
            return jit[a.id] - jit[b.id];           // джиттер: у прогонов разные ничьи
          });
        let kUse = sl.k, chosen = cand[0] || null;
        if (!chosen && sl.flex) {
          // Основная не зашла — пробуем остальные авто-смены по убыванию длины:
          // «не раньше 14:00» спокойно выходит в Вечер и закрывает потребность.
          for (const alt of auto.filter(x => x.k !== sl.k).sort((a, b) => len(b) - len(a))) {
            const c2 = staff.filter(s => s.pos === sl.pos && canPlace(pm, s, d, alt.k))
              .sort((a, b) => (wished(a.id, d) ? 1 : 0) - (wished(b.id, d) ? 1 : 0)
                || (effNorm(b) - hrs[b.id]) - (effNorm(a) - hrs[a.id]) || jit[a.id] - jit[b.id]);
            if (c2.length) { kUse = alt.k; chosen = c2[0]; break; }
          }
        }
        if (chosen) {
          const s = chosen, q = shiftOf(kUse);
          pm[s.id][d] = kUse; hrs[s.id] += len(q); cnt[s.id]++;
          kCnt[s.id][kUse] = (kCnt[s.id][kUse] || 0) + 1;
          if (isPeak) peak[s.id]++;
        }
      });
    }
    return pm;
  };

  // ── Ремонт: закрываем дыру перестановкой смежной смены ──
  const repair = (pm) => {
    let moved = 0;
    for (let sweep = 0; sweep < repairSweeps; sweep++) {
      for (let d = 1; d <= DAYS; d++) {
        for (const sl of daySlots(pm, d)) {
          // Прямой кандидат мог освободиться после прошлых перестановок
          let s = staff.find(x => x.pos === sl.pos && !wished(x.id, d) && canPlace(pm, x, d, sl.k))
               || staff.find(x => x.pos === sl.pos && canPlace(pm, x, d, sl.k));
          let kFill = sl.k;
          if (!s && sl.flex) {
            for (const alt of auto.filter(x => x.k !== sl.k)) {
              s = staff.find(x => x.pos === sl.pos && canPlace(pm, x, d, alt.k));
              if (s) { kFill = alt.k; break; }
            }
          }
          if (s) { pm[s.id][d] = kFill; moved++; continue; }
          // Шаг Б — ротация внутри дня: y уже работает в d, но на другой
          // смене; переключаем его на недостающую, а его смену отдаём
          // свободному коллеге, которому она подходит (классика: универсалу
          // досталась вечерняя, а «только с 15:00» остался без утренней).
          let rotated = false;
          for (const y of staff) {
            if (y.pos !== sl.pos) continue;
            const k2 = pm[y.id][d];
            const q2 = k2 && shiftOf(k2);
            if (!q2 || q2.extra || k2 === sl.k || isLocked(y.id, d)) continue;
            pm[y.id][d] = "";
            if (canPlace(pm, y, d, sl.k)) {
              const z = staff.find(w => w.id !== y.id && w.pos === sl.pos && canPlace(pm, w, d, k2));
              if (z) { pm[y.id][d] = sl.k; pm[z.id][d] = k2; moved++; rotated = true; break; }
            }
            pm[y.id][d] = k2;
          }
          if (rotated) continue;
          // Перестановка: у кого-то из позиции снимаем смену в соседнем дне
          // (отдав её свободному коллеге) — и он проходит в день недобора.
          outer:
          for (const x of staff) {
            if (x.pos !== sl.pos || pm[x.id][d] || onVac(x, d) || isDayOff(x, d) || !inCycle(x, d)) continue;
            for (let d2 = Math.max(1, d - 3); d2 <= Math.min(DAYS, d + 3); d2++) {
              const k2 = pm[x.id][d2];
              const q2 = k2 && shiftOf(k2);
              if (!q2 || q2.extra || isLocked(x.id, d2)) continue;
              pm[x.id][d2] = "";                            // пробуем снять
              if (canPlace(pm, x, d, sl.k)) {
                const sub = staff.find(y => y.id !== x.id && y.pos === sl.pos && canPlace(pm, y, d2, k2));
                if (sub) {
                  pm[sub.id][d2] = k2;                      // коллега подхватил d2
                  pm[x.id][d] = sl.k;                       // x закрыл дыру
                  moved++;
                  break outer;
                }
              }
              pm[x.id][d2] = k2;                            // не вышло — вернули
            }
          }
        }
      }
    }
    return moved;
  };

  // ── Счёт расстановки: чем меньше, тем лучше ──
  const score = (pm) => {
    let sc = countShort(pm) * 1000;                          // недоборы — главный грех
    if ((R.normMode || "floor") === "floor") {
      staff.forEach(s => { sc += Math.max(0, effNorm(s) - hoursOf(pm, s)); });   // недоработки (норма с учётом отпуска)
    }
    const peaks = staff.map(s => {
      let p = 0;
      for (let d = 1; d <= DAYS; d++) if (pm[s.id][d] && lvlOf(d) === 3) p++;
      return p;
    });
    sc += (Math.max(...peaks, 0) - Math.min(...peaks, 0)) * 0.5;   // справедливость пиков
    // Справедливость типов смен: никто не живёт в вечерах, пока коллеги
    // той же позиции ходят по утрам. Спред поздних смен внутри позиции —
    // мягкий штраф: мультистарт предпочтёт расстановку почестнее.
    const lateK = auto.slice().sort((a, b) => b.from - a.from)[0]?.k;
    if (lateK && auto.length > 1) {
      const byPos = {};
      staff.forEach(s => {
        let n = 0, w = 0;
        for (let d = 1; d <= DAYS; d++) { const k = pm[s.id][d]; if (k && shiftOf(k) && !shiftOf(k).extra) { w++; if (k === lateK) n++; } }
        if (w >= 4) (byPos[s.pos] = byPos[s.pos] || []).push(n / w);
      });
      for (const arr of Object.values(byPos)) {
        if (arr.length > 1) sc += (Math.max(...arr) - Math.min(...arr)) * 3;
      }
    }
    // Нарушенные пожелания: заметный, но не решающий штраф — мультистарт
    // предпочтёт расстановку, где просьбы о выходных уважены.
    staff.forEach(s => {
      (wishes[s.id] || []).forEach(d => {
        const q = shiftOf(pm[s.id]?.[d]);
        if (q && !q.extra) sc += 40;
      });
    });
    return sc;
  };

  let best = null, bestScore = Infinity;
  const seed = (Date.now() & 0xffff) || 1;
  for (let r = 0; r < restarts; r++) {
    const pm = runOnce(mulberry32(seed + r * 7919));
    repair(pm);
    const sc = score(pm);
    if (sc < bestScore) { bestScore = sc; best = pm; }
    if (bestScore < 1) break;                                // идеал найден — дальше незачем
  }
  return { plan: best, shortage: countShort(best), canPlace };
}
