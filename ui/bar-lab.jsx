import React from "react";
import { onActivate, vibrate } from "../lib/utils";
import { GOLD } from "./tokens";
import { COCKTAILS } from "../data/cocktails";
import { buildScenario, checkAction, loadMastery, saveMastery, recordRun, tierOf, TIER_LABEL, MASTERY_LABEL, dailyPick, rushOrders, GLASS_RU, GARNISH_RU, TOOLS, AMOUNTS } from "../lib/bar-lab";
import { frostOf } from "./home-hubs";

// ── Дополнение 208: «Сборка руками» — тренажёр, от которого не оторваться ─────
// Станция внизу: стекло · лёд · ингредиенты · инструмент · гарниш. Тап — действие,
// бокал наполняется слоями. «С подсказкой» — следующий шаг подсвечен и объяснён;
// «По памяти» — тишина, ошибка = «вылил», заново. Мастерство → золотая печать на карточке.

const ICE_RU = { cube: "Кубики", crushed: "Краш", none: "Без льда" };
const TOOL_ICON = { shake: "⇅", stir: "↻", strain: "◒", muddle: "⌇", blend: "✱", layer: "≡", swizzle: "∿" };

// ── Бокал: простые контуры в языке витражей; жидкость — по объёму, цвет — смесь добавленного
const GLASS_PATH = {
  rocks: "M22 30 H98 L94 108 H26 Z", highball: "M34 14 H86 L84 112 H36 Z", martini: "M14 22 L60 74 L106 22 Z M60 74 V102 M40 106 H80",
  sour: "M30 26 Q28 74 60 78 Q92 74 90 26 Z M60 78 V102 M40 106 H80", flute: "M42 14 Q40 70 60 76 Q80 70 78 14 Z M60 76 V104 M42 108 H78",
  hurricane: "M36 14 Q30 50 52 64 Q30 84 36 108 H84 Q90 84 68 64 Q90 50 84 14 Z", shot: "M40 40 H80 L76 108 H44 Z",
  irish: "M32 26 H88 Q92 70 74 82 V100 H46 V82 Q28 70 32 26 Z", margarita: "M20 30 H100 L80 60 Q72 68 60 68 Q48 68 40 60 Z M60 68 V102 M40 106 H80", red: "M28 24 Q24 72 60 78 Q96 72 92 24 Z M60 78 V104 M40 108 H80",
};
const LIQ_BOX = { rocks: [26, 34, 68, 72], highball: [37, 18, 46, 92], martini: [22, 26, 76, 44], sour: [32, 30, 56, 44], flute: [44, 20, 32, 52], hurricane: [38, 20, 44, 84], shot: [42, 44, 36, 60], irish: [34, 30, 52, 50], margarita: [24, 34, 72, 30], red: [30, 28, 60, 46] };
const ING_COLOR = (name) => {
  const n = name.toLowerCase();
  if (/кампари|апероль|гренадин|клюкв|вишн|клубн|малин/.test(n)) return "#C4483A";
  if (/апельсин|манго|персик|ананас/.test(n)) return "#E2A63A";
  if (/лайм|мят|мидори|базилик|дын/.test(n)) return "#9BC77A";
  if (/кюрасао|блю/.test(n)) return "#5AA7D8";
  if (/кофе|кола|калуа|тёмн|темн|бурбон|виски|коньяк|бренди|вермут красн|ангостур/.test(n)) return "#6E3E1C";
  if (/слив|молок|бейлис|кокос|белок/.test(n)) return "#EFE4C8";
  if (/содов|тоник|вода|лимонад|игрист|просекко|шампан|энергет/.test(n)) return "#DDE7EA";
  if (/лимон|сироп|мёд|мед|сахар/.test(n)) return "#E8D27A";
  return "#D6B266";
};
const mix = (cols) => { if (!cols.length) return "#D6B266"; const rgb = cols.map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))); const avg = [0, 1, 2].map(k => Math.round(rgb.reduce((a, c) => a + c[k], 0) / rgb.length)); return "#" + avg.map(v => v.toString(16).padStart(2, "0")).join(""); };

function GlassView({ glass, fill, colors, ice, garnish, shake, a11y, spilled }) {
  const path = GLASS_PATH[glass] || GLASS_PATH.rocks; const box = LIQ_BOX[glass] || LIQ_BOX.rocks;
  const line = a11y ? "#8B6A30" : GOLD; const liq = mix(colors);
  const [x, y, w, h] = box; const lh = Math.min(1, fill) * h;
  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" style={{ filter: shake ? "blur(0.6px)" : "none", transform: spilled ? "rotate(-28deg) translateY(10px)" : shake ? "rotate(-3deg)" : "none", transition: "transform .35s cubic-bezier(.3,1.4,.4,1)" }}>
      <defs><clipPath id={"gl-" + glass}><path d={path.split(" M")[0]} /></clipPath></defs>
      <g clipPath={`url(#gl-${glass})`}>
        {!spilled && lh > 0 && <rect x={x} y={y + h - lh} width={w} height={lh} fill={liq} opacity="0.85" style={{ transition: "y .4s ease, height .4s ease" }} />}
        {!spilled && ice === "cube" && [0, 1, 2].map(i => <rect key={i} x={x + 6 + i * (w / 3.2)} y={y + h - lh - 2 + i * 6} width={w / 4} height={w / 4} rx="3" fill="rgba(255,255,255,0.35)" stroke="rgba(255,255,255,0.6)" strokeWidth="1" />)}
        {!spilled && ice === "crushed" && Array.from({ length: 14 }).map((_, i) => <circle key={i} cx={x + 6 + (i * 37) % w} cy={y + 8 + (i * 23) % (h - 12)} r="3.5" fill="rgba(255,255,255,0.45)" />)}
      </g>
      <path d={path} fill="none" stroke={line} strokeWidth="2" strokeLinejoin="round" />
      {garnish && garnish !== "none" && <g transform="translate(88 18)"><circle r="8" fill={garnish === "cherry" ? "#C4483A" : garnish === "olive" || garnish === "mint" ? "#7FA05A" : garnish === "cream" ? "#EFE4C8" : "#E2A63A"} stroke={line} strokeWidth="1.2" /></g>}
    </svg>
  );
}

const ukOf = (profile) => profile ? `_${profile.name}_${profile.surname || ""}` : "";

export function BarLabScreen({ T, a11y, profile, onBack, startId, onOpenDeck }) {
  const gold = a11y ? "#8B6A30" : GOLD; const text = T.modTitle.color, sub = T.modSub.color, frost = frostOf(a11y);
  const uk = ukOf(profile);
  const [mastery, setMastery] = React.useState(() => loadMastery(uk));
  const [view, setView] = React.useState(startId ? "pick" : "hub"); // hub | pick | play | rush | station
  const [current, setCurrent] = React.useState(() => startId ? COCKTAILS.find(c => c.id === startId) || null : null);
  const [mode, setMode] = React.useState("hint");
  const [rush, setRush] = React.useState(null); // { orders, i, started, penalties }
  const [rushBest, setRushBest] = React.useState(() => { try { return Number(localStorage.getItem("sa_bar_rush_best" + uk) || 0); } catch (e) { return 0; } });
  const daily = React.useMemo(() => dailyPick(COCKTAILS), []);
  const save = (m) => { setMastery(m); saveMastery(uk, m); };
  const masteredCount = (t) => COCKTAILS.filter(c => (t ? tierOf(c) === t : true) && (mastery[c.id]?.level || 0) >= 2).length;
  const pill = (on) => ({ padding: "6px 12px", borderRadius: 999, fontSize: 12.5, cursor: "pointer", border: `1px solid ${on ? gold : gold + "55"}`, background: on ? "rgba(214,178,102,0.16)" : "transparent", color: on ? text : sub });

  const startPlay = (c, m) => { setCurrent(c); setMode(m); setView("play"); vibrate("light"); };
  const finishPlay = (clean) => {
    save(recordRun(mastery, current.id, mode, clean));
    if (rush) {
      const next = rush.i + 1;
      if (next >= rush.orders.length) {
        const total = Math.round((Date.now() - rush.started) / 1000) + rush.penalties;
        const best = rushBest && rushBest < total ? rushBest : total;
        setRushBest(best); try { localStorage.setItem("sa_bar_rush_best" + uk, String(best)); } catch (e) {}
        setRush({ ...rush, done: true, total }); setView("rush");
      } else { setRush({ ...rush, i: next }); setCurrent(rush.orders[next]); setView("play"); }
    }
  };

  const Head = (title, backTo) => (
    <div style={{ padding: "16px 16px 6px", display: "flex", alignItems: "center", gap: 10 }}>
      <button className="sa-btn" onClick={backTo || onBack} {...onActivate(backTo || onBack)} aria-label="Назад" style={{ border: "none", background: "transparent", color: gold, fontSize: 22, cursor: "pointer", padding: "4px 8px 4px 0" }}>‹</button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10.5, letterSpacing: 1.5, color: gold }}>СБОРКА · БАР</div>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: text, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────── HUB
  if (view === "hub") {
    const stamps = masteredCount();
    const card = (props, children) => <div className="sa-card" {...props} style={{ ...frost, borderRadius: 18, padding: "14px 15px", marginBottom: 10, cursor: props.onClick ? "pointer" : "default", ...(props.style || {}) }}>{children}</div>;
    return (
      <div style={T.screen} className="sa-screen">
        {Head("Сборка руками")}
        <div style={{ padding: "4px 16px 100px" }}>
          {card({ onClick: () => { setCurrent(daily); setView("pick"); vibrate("light"); } }, <>
            <div style={{ fontSize: 10.5, letterSpacing: 1.6, color: gold, fontFamily: "monospace", marginBottom: 6 }}>КОКТЕЙЛЬ ДНЯ</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 56, height: 56, flexShrink: 0 }}><GlassView glass={daily.glass} fill={0.7} colors={daily.ing.map(i => ING_COLOR(i[0]))} ice={daily.ice === "crushed" ? "crushed" : daily.ice ? "cube" : null} garnish={daily.garnish} a11y={a11y} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 19, color: text }}>{daily.name}</div>
                <div style={{ fontSize: 12.5, color: sub }}>{daily.method} · {GLASS_RU[daily.glass]} · {MASTERY_LABEL[mastery[daily.id]?.level || 0]}</div>
              </div>
              <span style={{ color: gold, fontSize: 18 }}>›</span>
            </div>
          </>)}
          {card({}, <>
            <div style={{ fontSize: 10.5, letterSpacing: 1.6, color: gold, fontFamily: "monospace", marginBottom: 6 }}>МАСТЕРСТВО · {stamps} ИЗ {COCKTAILS.length} ПЕЧАТЕЙ</div>
            {[1, 2, 3].map(t => { const total = COCKTAILS.filter(c => tierOf(c) === t).length; const n = masteredCount(t); return (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                <div style={{ width: 84, fontSize: 12.5, color: text }}>{TIER_LABEL[t]}</div>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: a11y ? "rgba(139,106,48,0.18)" : "rgba(214,178,102,0.16)" }}><div style={{ width: `${total ? (n / total) * 100 : 0}%`, height: "100%", borderRadius: 3, background: gold, transition: "width .6s" }} /></div>
                <div style={{ width: 44, textAlign: "right", fontSize: 12, color: sub, fontFamily: "monospace" }}>{n}/{total}</div>
              </div>); })}
            <div style={{ fontSize: 12, color: sub, marginTop: 8, lineHeight: 1.5 }}>Печать — коктейль собран по памяти. Три раза подряд без ошибок — «мастер».</div>
          </>)}
          <div style={{ display: "flex", gap: 10 }}>
            {card({ onClick: () => { const orders = rushOrders(COCKTAILS, mastery, 3); setRush({ orders, i: 0, started: Date.now(), penalties: 0 }); setCurrent(orders[0]); setMode("memory"); setView("play"); vibrate("heavy"); }, style: { flex: 1 } }, <>
              <div style={{ fontSize: 10.5, letterSpacing: 1.6, color: gold, fontFamily: "monospace", marginBottom: 6 }}>ЧАС ПИК</div>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 16, color: text }}>3 заказа на время</div>
              <div style={{ fontSize: 12, color: sub, marginTop: 3 }}>{rushBest ? `Рекорд ${rushBest} с` : "По памяти, ошибка +10 с"}</div>
            </>)}
            {card({ onClick: () => { setView("station"); vibrate("light"); }, style: { flex: 1 } }, <>
              <div style={{ fontSize: 10.5, letterSpacing: 1.6, color: gold, fontFamily: "monospace", marginBottom: 6 }}>СТАНЦИЯ</div>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 16, color: text }}>Подготовка к смене</div>
              <div style={{ fontSize: 12, color: sub, marginTop: 3 }}>Расставь всё по порядку</div>
            </>)}
          </div>
          {[1, 2, 3].map(t => (
            <div key={t} style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10.5, letterSpacing: 1.6, color: gold, fontFamily: "monospace", margin: "0 2px 8px" }}>{TIER_LABEL[t].toUpperCase()} · {COCKTAILS.filter(c => tierOf(c) === t).length}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {COCKTAILS.filter(c => tierOf(c) === t).map(c => { const lv = mastery[c.id]?.level || 0; return (
                  <div key={c.id} className="sa-card" onClick={() => { setCurrent(c); setView("pick"); vibrate("light"); }} {...onActivate(() => { setCurrent(c); setView("pick"); })}
                    style={{ ...frost, borderRadius: 14, padding: "10px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderColor: lv >= 2 ? gold + "AA" : undefined }}>
                    <div style={{ width: 34, height: 34, flexShrink: 0 }}><GlassView glass={c.glass} fill={0.65} colors={c.ing.map(i => ING_COLOR(i[0]))} a11y={a11y} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, color: text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                      <div style={{ fontSize: 10.5, color: lv >= 2 ? gold : sub }}>{lv >= 3 ? "✦ мастер" : lv === 2 ? "✦ печать" : lv === 1 ? "с подсказками" : "—"}</div>
                    </div>
                  </div>); })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────── PICK MODE
  if (view === "pick" && current) {
    const lv = mastery[current.id]?.level || 0;
    return (
      <div style={T.screen} className="sa-screen">
        {Head(current.name, () => setView("hub"))}
        <div style={{ padding: "4px 16px 100px" }}>
          <div style={{ ...frost, borderRadius: 18, padding: 16, display: "flex", gap: 14, alignItems: "center", marginBottom: 12 }}>
            <div style={{ width: 96, height: 96, flexShrink: 0 }}><GlassView glass={current.glass} fill={0.75} colors={current.ing.map(i => ING_COLOR(i[0]))} ice={current.ice === "crushed" ? "crushed" : current.ice ? "cube" : null} garnish={current.garnish} a11y={a11y} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: sub }}>{current.method} · {GLASS_RU[current.glass]} · {current.ing.length} ингр.</div>
              <div style={{ fontSize: 12.5, color: lv >= 2 ? gold : sub, marginTop: 4 }}>{lv >= 2 ? "✦ " : ""}{MASTERY_LABEL[lv]}{mastery[current.id]?.streak ? ` · серия ${mastery[current.id].streak}` : ""}</div>
              {onOpenDeck && <div onClick={() => onOpenDeck(current.id)} style={{ fontSize: 12.5, color: gold, marginTop: 8, cursor: "pointer" }}>Карточка в Колоде ›</div>}
            </div>
          </div>
          <div className="sa-card" onClick={() => startPlay(current, "hint")} {...onActivate(() => startPlay(current, "hint"))} style={{ ...frost, borderRadius: 18, padding: "14px 16px", marginBottom: 10, cursor: "pointer" }}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 17, color: text }}>С подсказкой</div>
            <div style={{ fontSize: 12.5, color: sub, marginTop: 3, lineHeight: 1.5 }}>Следующий шаг подсвечен, ошибка объясняется словами урока. Учишься телом, не текстом.</div>
          </div>
          <div className="sa-card" onClick={() => startPlay(current, "memory")} {...onActivate(() => startPlay(current, "memory"))} style={{ ...frost, borderRadius: 18, padding: "14px 16px", cursor: "pointer", borderColor: gold + "88" }}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 17, color: text }}>По памяти ✦</div>
            <div style={{ fontSize: 12.5, color: sub, marginTop: 3, lineHeight: 1.5 }}>Как за стойкой: подсказок нет, ошибка — «вылил», заново. Собрал чисто — печать на карточке.</div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────── PLAY
  if (view === "play" && current) return <Play key={current.id + mode + (rush ? rush.i : "")} c={current} mode={mode} T={T} a11y={a11y} gold={gold} frost={frost} Head={Head} rush={rush} onPenalty={() => rush && setRush(r => ({ ...r, penalties: r.penalties + 10 }))}
    onExit={() => { setRush(null); setView(rush ? "hub" : "pick"); }} onFinish={finishPlay} />;

  // ─────────────────────────────────────────────── RUSH RESULT
  if (view === "rush" && rush?.done) return (
    <div style={T.screen} className="sa-screen">
      {Head("Час пик", () => { setRush(null); setView("hub"); })}
      <div style={{ padding: "20px 16px 100px", textAlign: "center" }}>
        <div style={{ fontSize: 10.5, letterSpacing: 1.6, color: gold, fontFamily: "monospace" }}>{rush.total <= rushBest ? "НОВЫЙ РЕКОРД ✦" : "СМЕНА ОТРАБОТАНА"}</div>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 46, color: text, margin: "6px 0" }}>{rush.total} с</div>
        <div style={{ fontSize: 13, color: sub }}>{rush.orders.map(o => o.name).join(" · ")}{rush.penalties ? ` · штрафы +${rush.penalties} с` : " · без ошибок"}</div>
        <button className="sa-btn" onClick={() => { const orders = rushOrders(COCKTAILS, mastery, 3); setRush({ orders, i: 0, started: Date.now(), penalties: 0 }); setCurrent(orders[0]); setMode("memory"); setView("play"); }} style={{ ...T.doneBtn, background: gold, marginTop: 22, width: "100%" }}>Ещё смену ›</button>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────── STATION PREP
  if (view === "station") return <StationPrep T={T} a11y={a11y} gold={gold} frost={frost} Head={Head} onExit={() => setView("hub")} uk={uk} />;
  return null;
}

// ── Игровой экран одного коктейля ──────────────────────────────────────────────
function Play({ c, mode, T, a11y, gold, frost, Head, rush, onPenalty, onExit, onFinish }) {
  const text = T.modTitle.color, sub = T.modSub.color;
  const sc = React.useMemo(() => buildScenario(c, COCKTAILS), [c]);
  const [done, setDone] = React.useState([]);
  const [msg, setMsg] = React.useState(null); // { ok, text }
  const [mistakes, setMistakes] = React.useState(0);
  const [spilled, setSpilled] = React.useState(false);
  const [pending, setPending] = React.useState(null); // ингредиент, ждём объём
  const [finished, setFinished] = React.useState(null);
  const [shake, setShake] = React.useState(false);
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => { if (!rush) return; const t = setInterval(() => setTick(x => x + 1), 1000); return () => clearInterval(t); }, [rush]);

  const glassStep = sc.steps.find(s => s.kind === "glass"); const glassDone = done.includes(sc.steps.indexOf(glassStep));
  const addedIngs = sc.steps.filter((s, i) => s.kind === "ing" && done.includes(i));
  const totalMl = sc.spec.ing.reduce((a, i) => a + (String(i[2] || "мл").startsWith("мл") ? Number(i[1]) || 0 : 0), 0) || 1;
  const fillMl = addedIngs.reduce((a, s) => a + (s.unit === "мл" ? Number(s.amount) || 0 : 0), 0);
  const iceInGlass = sc.steps.find((s, i) => s.kind === "ice" && s.where === "glass" && done.includes(i));
  const garnishDone = sc.steps.find((s, i) => s.kind === "garnish" && done.includes(i));
  const expected = sc.steps.map((s, i) => ({ s, i })).find(x => !done.includes(x.i));

  const act = (action) => {
    if (finished || spilled) return;
    const r = checkAction(sc, done, action);
    if (r.ok) {
      setDone(r.doneIdx); setMsg(null); vibrate("light");
      if (action.kind === "tool" && (action.id === "shake" || action.id === "blend")) { setShake(true); setTimeout(() => setShake(false), 700); }
      if (r.done) { const clean = mistakes === 0; setFinished({ clean }); vibrate("success"); setTimeout(() => onFinish(clean), rush ? 600 : 0); }
    } else {
      setMistakes(m => m + 1); vibrate("error");
      if (mode === "memory") { setSpilled(true); setMsg({ ok: false, text: r.why + " Вылил — собираем заново." }); if (rush) onPenalty(); setTimeout(() => { setDone([]); setSpilled(false); setMsg(null); setPending(null); }, 1400); }
      else setMsg({ ok: false, text: r.why });
    }
  };
  const tapIng = (name) => {
    const step = sc.steps.find(s => s.kind === "ing" && s.name === name);
    if (step && step.unit === "мл") setPending(name); else act({ kind: "ing", name });
  };
  const chip = (on, extra) => ({ padding: "8px 11px", borderRadius: 12, fontSize: 12.5, cursor: "pointer", border: `1px solid ${on ? gold : gold + "44"}`, background: on ? "rgba(214,178,102,0.18)" : (a11y ? "rgba(255,255,255,0.45)" : "rgba(255,248,230,0.05)"), color: on ? text : sub, whiteSpace: "nowrap", ...extra });
  const hint = (step) => mode === "hint" && expected && expected.s === step;
  const elapsed = rush ? Math.round((Date.now() - rush.started) / 1000) + rush.penalties : 0;

  return (
    <div style={T.screen} className="sa-screen">
      {Head(c.name, onExit)}
      <div style={{ padding: "0 16px 110px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, letterSpacing: 1.4, fontFamily: "monospace", color: sub, marginBottom: 8 }}>
          <span>{mode === "hint" ? "С ПОДСКАЗКОЙ" : "ПО ПАМЯТИ ✦"}{rush ? ` · ЗАКАЗ ${rush.i + 1}/${rush.orders.length}` : ""}</span>
          <span>{rush ? `${elapsed} с` : `${done.length}/${sc.steps.length}`}{mistakes ? ` · ошибок ${mistakes}` : ""}</span>
        </div>
        <div style={{ ...frost, borderRadius: 18, padding: 14, display: "flex", gap: 14, alignItems: "center", minHeight: 150 }}>
          <div style={{ width: 120, height: 120, flexShrink: 0 }}>
            <GlassView glass={glassDone ? c.glass : "rocks"} fill={glassDone ? fillMl / totalMl : 0} colors={addedIngs.map(s => ING_COLOR(s.name))} ice={iceInGlass ? iceInGlass.id : null} garnish={garnishDone ? c.garnish : null} shake={shake} a11y={a11y} spilled={spilled} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {finished ? (
              <div className="sa-fadein">
                <div style={{ fontSize: 10.5, letterSpacing: 1.6, color: "#5DBB8A", fontFamily: "monospace" }}>{finished.clean ? "СОБРАНО ЧИСТО ✦" : "СОБРАНО"}</div>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 18, color: text, marginTop: 4 }}>{c.name}</div>
                <div style={{ fontSize: 12.5, color: sub, marginTop: 4, lineHeight: 1.5 }}>{mode === "memory" && finished.clean ? "Печать на карточке твоя." : mistakes ? `Ошибок: ${mistakes}. По памяти и без ошибок — будет печать.` : "Теперь — по памяти."}</div>
                {!rush && <button className="sa-btn" onClick={onExit} style={{ ...T.doneBtn, background: gold, marginTop: 10, padding: "10px 14px", fontSize: 13.5 }}>Готово ›</button>}
              </div>
            ) : msg ? (
              <div className="sa-fadein" style={{ fontSize: 13.5, color: "#E07878", lineHeight: 1.5 }}>{msg.text}</div>
            ) : mode === "hint" && expected ? (
              <div>
                <div style={{ fontSize: 10.5, letterSpacing: 1.6, color: gold, fontFamily: "monospace" }}>ТЕПЕРЬ</div>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 17, color: text, marginTop: 4, lineHeight: 1.3 }}>{expected.s.label}</div>
                {c.steps && c.steps[Math.min(c.steps.length - 1, Math.floor(done.length / Math.max(1, sc.steps.length / c.steps.length)))] && <div style={{ fontSize: 12, color: sub, marginTop: 6, fontStyle: "italic" }}>{c.tip}</div>}
              </div>
            ) : (
              <div style={{ fontSize: 13.5, color: sub, lineHeight: 1.5 }}>{pending ? `Сколько ${pending.toLowerCase()}?` : "Тапай по станции: стекло → лёд или ингредиенты → инструмент → гарниш."}</div>
            )}
          </div>
        </div>

        {pending && (
          <div className="sa-fadein" style={{ ...frost, borderRadius: 16, padding: 12, marginTop: 10 }}>
            <div style={{ fontSize: 10.5, letterSpacing: 1.5, color: gold, fontFamily: "monospace", marginBottom: 8 }}>ДЖИГГЕР · {pending.toUpperCase()}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {AMOUNTS.map(a => <span key={a} style={chip(hint(sc.steps.find(s => s.kind === "ing" && s.name === pending)) && Number(sc.steps.find(s => s.kind === "ing" && s.name === pending).amount) === a)} onClick={() => { const n = pending; setPending(null); act({ kind: "ing", name: n, amount: a }); }}>{a} мл</span>)}
              <span style={chip(false, { color: sub })} onClick={() => setPending(null)}>отмена</span>
            </div>
          </div>
        )}

        {/* СТАНЦИЯ */}
        <div style={{ marginTop: 12 }}>
          {[
            ["СТЕКЛО", sc.station.glasses.map(g => ({ key: g, label: GLASS_RU[g], on: hint(glassStep) && g === c.glass, go: () => act({ kind: "glass", id: g }) }))],
            ["ЛЁД", sc.station.ices.map(i => ({ key: i, label: ICE_RU[i], on: expected && expected.s.kind === "ice" && hint(expected.s) && expected.s.id === i, go: () => act({ kind: "ice", id: i }) }))],
            ["ИНГРЕДИЕНТЫ", sc.station.ings.map(n => { const st = sc.steps.find(s => s.kind === "ing" && s.name === n); const added = st && done.includes(sc.steps.indexOf(st)); return { key: n, label: n, on: st && hint(st), dim: added, go: () => tapIng(n) }; })],
            ["ИНСТРУМЕНТ", sc.station.tools.map(t => ({ key: t, label: `${TOOL_ICON[t] || ""} ${TOOLS[t]}`, on: expected && expected.s.kind === "tool" && hint(expected.s) && expected.s.id === t, go: () => act({ kind: "tool", id: t }) }))],
            ["ГАРНИШ", sc.station.garnishes.map(g => ({ key: g, label: GARNISH_RU[g], on: expected && expected.s.kind === "garnish" && hint(expected.s) && expected.s.id === g, go: () => act({ kind: "garnish", id: g }) }))],
          ].map(([title, items]) => items.length ? (
            <div key={title} style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: gold, fontFamily: "monospace", margin: "0 2px 6px" }}>{title}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {items.map(it => <span key={it.key} onClick={it.go} {...onActivate(it.go)} style={chip(!!it.on, { opacity: it.dim ? 0.45 : 1, boxShadow: it.on ? `0 0 0 3px ${gold}33` : "none" })}>{it.label}{it.dim ? " ✓" : ""}</span>)}
              </div>
            </div>
          ) : null)}
        </div>
      </div>
    </div>
  );
}

// ── Подготовка станции к смене: расставь по порядку ────────────────────────────
const PREP = [
  { phase: "Чистота", items: [{ id: "wipe", t: "Протереть станцию", why: "Порядок начинается с поверхности — иначе всё ляжет в чужие следы." }, { id: "cloths", t: "Разложить тряпки: станция · стекло · руки", why: "Три тряпки — три задачи. Одна на всё разносит запахи и жир." }] },
  { phase: "Лёд", items: [{ id: "ice-check", t: "Проверить лёд: прозрачность, запах", why: "Лёд — ингредиент. Мутный или пахнущий — в работу не идёт." }, { id: "ice-fill", t: "Заполнить колодец, совок отдельно", why: "Совок в колодце — это руки в каждом напитке." }] },
  { phase: "Гарниш", items: [{ id: "cut", t: "Нарезать цитрус и травы", why: "Резать в час пик — значит бегать за вишенкой на глазах у гостя." }, { id: "cover", t: "Накрыть и убрать в холод", why: "Открытый гарниш заветривается за час." }] },
  { phase: "Инструмент", items: [{ id: "tools", t: "Шейкер, джиггер, ложка, стрейнеры — под руку", why: "То, что в руках каждую минуту, лежит в рабочей зоне." }, { id: "check", t: "Проверить чистоту инструмента", why: "Грязный шейкер = вкус прошлого коктейля в новом." }] },
  { phase: "Расходники", items: [{ id: "straws", t: "Трубочки, салфетки, костеры", why: "Расходники — последними: они не портятся и не нужны для сборки." }, { id: "backup", t: "Запас ходовых бутылок", why: "Кончилось в час пик — беготня в подсобку." }] },
];
function StationPrep({ T, a11y, gold, frost, Head, onExit, uk }) {
  const text = T.modTitle.color, sub = T.modSub.color;
  const all = React.useMemo(() => PREP.flatMap((p, pi) => p.items.map(it => ({ ...it, phase: p.phase, pi }))), []);
  const [order] = React.useState(() => { const r = all.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; });
  const [placed, setPlaced] = React.useState([]);
  const [msg, setMsg] = React.useState(null);
  const [mistakes, setMistakes] = React.useState(0);
  const [start] = React.useState(Date.now());
  const [best, setBest] = React.useState(() => { try { return Number(localStorage.getItem("sa_bar_station_best" + uk) || 0); } catch (e) { return 0; } });
  const donePhases = new Set(placed.map(id => all.find(x => x.id === id).pi));
  const curPhase = Math.min(...PREP.map((_, i) => i).filter(i => PREP[i].items.some(it => !placed.includes(it.id))), 99);
  const finished = placed.length === all.length;
  const took = Math.round((Date.now() - start) / 1000);
  React.useEffect(() => { if (finished) { const t = took; if (!best || t < best) { setBest(t); try { localStorage.setItem("sa_bar_station_best" + uk, String(t)); } catch (e) {} } vibrate("success"); } }, [finished]);
  const tap = (it) => {
    if (finished) return;
    if (it.pi === curPhase) { setPlaced(p => [...p, it.id]); setMsg({ ok: true, text: it.why }); vibrate("light"); }
    else if (it.pi < curPhase) return;
    else { setMistakes(m => m + 1); setMsg({ ok: false, text: `Рано: сначала ${PREP[curPhase].phase.toLowerCase()}. ${it.why}` }); vibrate("error"); }
  };
  return (
    <div style={T.screen} className="sa-screen">
      {Head("Подготовка к смене", onExit)}
      <div style={{ padding: "0 16px 100px" }}>
        <div style={{ ...frost, borderRadius: 18, padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {PREP.map((p, i) => <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 9.5, letterSpacing: 1, fontFamily: "monospace", color: donePhases.has(i) && PREP[i].items.every(it => placed.includes(it.id)) ? "#5DBB8A" : i === curPhase ? gold : sub, borderBottom: `2px solid ${i === curPhase ? gold : "transparent"}`, paddingBottom: 4 }}>{p.phase.toUpperCase()}</div>)}
          </div>
          {finished ? (
            <div className="sa-fadein">
              <div style={{ fontSize: 10.5, letterSpacing: 1.6, color: "#5DBB8A", fontFamily: "monospace" }}>{took <= best ? "СТАНЦИЯ СОБРАНА · РЕКОРД ✦" : "СТАНЦИЯ СОБРАНА"}</div>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 24, color: text, marginTop: 4 }}>{took} с{mistakes ? ` · ошибок ${mistakes}` : " · без ошибок"}</div>
              <div style={{ fontSize: 12.5, color: sub, marginTop: 4 }}>Дальше смена идёт на автомате — ты не ищешь, ты берёшь.</div>
              <button className="sa-btn" onClick={onExit} style={{ ...T.doneBtn, background: gold, marginTop: 12, padding: "10px 14px", fontSize: 13.5 }}>Готово ›</button>
            </div>
          ) : msg ? (
            <div className="sa-fadein" style={{ fontSize: 13.5, lineHeight: 1.5, color: msg.ok ? text : "#E07878" }}>{msg.text}</div>
          ) : (
            <div style={{ fontSize: 13.5, color: sub, lineHeight: 1.5 }}>Смена через полчаса. Тапай действия в правильном порядке: что раньше — то и первым.</div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {order.map(it => { const on = placed.includes(it.id); return (
            <div key={it.id} className="sa-card" onClick={() => tap(it)} {...onActivate(() => tap(it))} style={{ ...frost, borderRadius: 14, padding: "11px 14px", cursor: on ? "default" : "pointer", opacity: on ? 0.45 : 1, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 22, color: on ? "#5DBB8A" : gold, fontSize: 15 }}>{on ? "✓" : "○"}</span>
              <span style={{ flex: 1, fontSize: 14, color: text }}>{it.t}</span>
              {on && <span style={{ fontSize: 10.5, color: sub, fontFamily: "monospace" }}>{it.phase.toUpperCase()}</span>}
            </div>); })}
        </div>
      </div>
    </div>
  );
}
