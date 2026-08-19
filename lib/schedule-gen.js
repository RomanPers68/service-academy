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

export function generateSchedule({ cfg, DAYS, dow, lvlOf, plan, locks, POS, mkey, restarts = 24, repairSweeps = 2 }) {
  const R = cfg.rules || {};
  const staff = cfg.staff || [];
  const shiftOf = k => (cfg.shifts || []).find(s => s.k === k);
  const len = s => s.to - s.from;
  const needOf = d => (cfg.need || {})[lvlOf(d)] || {};
  const auto = (cfg.shifts || []).filter(x => !x.extra);
  if (!auto.length || !staff.length) return { plan: null, shortage: 0 };

  const onVac = (s, d) => s.vac && s.vac[2] === mkey && d >= s.vac[0] && d <= s.vac[1];
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
    if ((R.normMode || "floor") === "cap" && hoursOf(pm, s) + len(sh) > s.norm) return false;
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
        Object.entries(sp).forEach(([k, cnt]) => {
          if (!shiftOf(k)) return;
          for (let i = 0; i < (cnt || 0) - busyIn(k); i++) slots.push({ pos, k });
        });
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
    // Устаревшее вечернее усиление: поля в настройках уже нет, но старые
    // сохранённые конфиги могли его нести — уважаем, как старый генератор.
    const ev = cfg.evening;
    if (ev && ev.count && shiftOf(ev.shift) && (ev.dows || []).includes(dow(d))
        && !((cfg.split || {})[ev.pos] && Object.keys(cfg.split[ev.pos]).length)) {
      const busy = staff.filter(s => s.pos === ev.pos && shiftOf(pm[s.id][d])?.k === ev.shift).length;
      for (let i = 0; i < ev.count - busy; i++) slots.push({ pos: ev.pos, k: ev.shift });
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
    const hrs = {}, cnt = {}, peak = {}, jit = {};
    staff.forEach(s => { hrs[s.id] = 0; cnt[s.id] = 0; peak[s.id] = 0; jit[s.id] = rng(); });

    for (let d = 1; d <= DAYS; d++) staff.forEach(s => {
      const keep = isLocked(s.id, d) ? (plan[s.id]?.[d] || "") : "";
      pm[s.id][d] = keep;
      const sh = keep && shiftOf(keep);
      if (sh) { hrs[s.id] += len(sh); cnt[s.id]++; if (lvlOf(d) === 3) peak[s.id]++; }
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
            if (isPeak && peak[a.id] !== peak[b.id]) return peak[a.id] - peak[b.id];
            if ((R.normMode || "floor") === "floor") {
              if (cnt[a.id] !== cnt[b.id]) return cnt[a.id] - cnt[b.id];
              if (hrs[a.id] !== hrs[b.id]) return hrs[a.id] - hrs[b.id];
            }
            const dh = (b.norm - hrs[b.id]) - (a.norm - hrs[a.id]);
            if (dh) return dh;
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
              .sort((a, b) => (b.norm - hrs[b.id]) - (a.norm - hrs[a.id]) || jit[a.id] - jit[b.id]);
            if (c2.length) { kUse = alt.k; chosen = c2[0]; break; }
          }
        }
        if (chosen) {
          const s = chosen, q = shiftOf(kUse);
          pm[s.id][d] = kUse; hrs[s.id] += len(q); cnt[s.id]++;
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
          let s = staff.find(x => x.pos === sl.pos && canPlace(pm, x, d, sl.k));
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
      staff.forEach(s => { sc += Math.max(0, (s.norm || 0) - hoursOf(pm, s)); });   // недоработки
    }
    const peaks = staff.map(s => {
      let p = 0;
      for (let d = 1; d <= DAYS; d++) if (pm[s.id][d] && lvlOf(d) === 3) p++;
      return p;
    });
    sc += (Math.max(...peaks, 0) - Math.min(...peaks, 0)) * 0.5;   // справедливость пиков
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
