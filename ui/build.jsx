// ui/build.jsx
// «Сборка» — фирменный формат практики роли «Бар».
// Пошаговый конструктор процесса: каждый шаг — одно решение, состояние объекта
// меняется на глазах, ошибка необратима внутри прохождения и доезжает до гостя.
// Реиграбельность даёт пул: повтор выдаёт другой сценарий и перемешивает варианты.
//
// Три визуальных носителя:
//   vessel  — сосуд (напитки): послойная заливка, лёд, газ, гарниш
//   station — схема станции сверху: зоны, ванна льда, флаг готовности
//   flow    — цепочка стадий: для процессов без предмета (путь льда, закрытие смены)

import React from "react";
import { BUILDS } from "../data/builds";
import { shuffleArray, vibrate } from "../lib/utils";
import { GOLD, GOLD_SOFT, CREAM, SAND, GREEN, RED, MUTED, MUTED_2, CLAY, INK_DEEP, RADIUS } from "./tokens";
import { UI_SVG, BUILD_SVG } from "./icons";

const serif = "Georgia, serif";
const mono = "ui-monospace, Menlo, monospace";

// Перемешиваем варианты внутри каждого шага — как shuffleSituationOptions в практике
const shuffleSteps = (sc) => ({ ...sc, steps: sc.steps.map(st => ({ ...st, options: shuffleArray(st.options) })) });

// Состояния варианта поверх базового стекла приложения (T.simOpt).
// Меняем только цвет обводки и подсветку — фактура остаётся общей с практикой.
const optState = (state) => {
  if (state === "win")  return { borderColor: GREEN, boxShadow: `0 0 0 1px ${GREEN}44, inset 0 0 18px ${GREEN}1F` };
  if (state === "lose") return { borderColor: RED,   boxShadow: `0 0 0 1px ${RED}44, inset 0 0 18px ${RED}1A` };
  if (state === "off")  return { opacity: 0.42 };
  return {};
};
const optKey = (state) => ({
  background: state === "win" ? GREEN : state === "lose" ? RED : "transparent",
  color: state === "win" ? "#0d2318" : state === "lose" ? "#2a0d0d" : undefined,
  borderColor: state === "win" ? GREEN : state === "lose" ? RED : undefined,
});

export function BuildRunner({ buildId, mod, role = "bar", T = {}, color, onClose }) {
  const accent = color || GOLD;
  const a11y = !!T.a11y;
  // Инлайновые цвета текста под тему (классы красит CSS через html.sa-light)
  const P = a11y
    ? { text: "#2A1F0E", sub: "#6B5B40", faint: "#8A7A5C", costText: "#8B3020", stepDone: "#2A1F0E" }
    : { text: CREAM, sub: MUTED_2, faint: MUTED, costText: "#EAC9C9", stepDone: SAND };

  // Пул: если сценарий задан явно — берём его, иначе случайный из пула роли
  // Пул ограничен модулем урока (mod), иначе в модуле 1 может выпасть
  // сценарий из модуля 5. Если модуль не задан — берём всю роль.
  const pool = React.useMemo(() => {
    const byRole = BUILDS.filter(b => !b.role || b.role === role);
    const byMod = mod ? byRole.filter(b => b.mod === mod) : [];
    return byMod.length ? byMod : byRole;
  }, [role, mod]);
  const firstPick = React.useMemo(() => {
    const src = (buildId && pool.find(b => b.id === buildId)) || shuffleArray(pool)[0];
    return shuffleSteps(src);
  }, [buildId, pool]);

  const [sc, setSc] = React.useState(firstPick);
  const [step, setStep] = React.useState(0);
  const [answered, setAnswered] = React.useState(null);
  const [results, setResults] = React.useState([]);
  const [done, setDone] = React.useState(false);

  if (!sc) return null;

  const total = sc.steps.length;
  const right = results.filter(Boolean).length;
  const cur = sc.steps[step];
  const shown = answered != null ? step + 1 : step;   // сколько шагов уже отражено в визуале
  const just = answered != null ? step : -1;          // шаг, который только что закрыли
  const spoiled = results.slice(0, shown).some(r => r === false);

  const restart = (sameId) => {
    const others = sameId ? pool.filter(b => b.id === sc.id) : pool.filter(b => b.id !== sc.id);
    const src = shuffleArray(others.length ? others : pool)[0];
    setSc(shuffleSteps(src));
    setStep(0); setAnswered(null); setResults([]); setDone(false);
  };

  const choose = (i, ok) => {
    if (answered != null) return;
    vibrate(ok ? "light" : "error");
    setAnswered(i);
    setResults(prev => { const n = [...prev]; n[step] = !!ok; return n; });
  };

  const next = () => {
    if (step < total - 1) { setStep(step + 1); setAnswered(null); }
    else { vibrate(right === total ? "success" : "light"); setDone(true); }
  };

  // ── НОСИТЕЛЬ: сосуд ────────────────────────────────────────────────
  const Vessel = () => {
    const poured = sc.steps.slice(0, shown).map((s, i) => ({ s, i })).filter(x => x.s.layer);
    const stack = poured.reduce((a, x) => a + x.s.layer.h, 0);
    const iceStep = sc.steps.slice(0, shown).map((s, i) => ({ s, i })).find(x => x.s.ice);
    const garn = sc.steps.slice(0, shown).find(s => s.garnish);
    const rocks = sc.glass === "rocks";
    const big = rocks;

    return (
      <div style={{ flex: "0 0 96px", height: 172, position: "relative", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        <div className={"sa-bld-vessel " + (rocks ? "rocks" : "high") + (spoiled ? " spoiled" : "")}>
          <div className="sa-bld-rim" />
          <div className="sa-bld-layers">
            {poured.map(({ s, i }) => (
              <div key={i} className={"sa-bld-layer" + (i === just ? " fresh" : "")}
                style={{ background: s.layer.c, height: s.layer.h + "%" }} />
            ))}
          </div>

          {just >= 0 && sc.steps[just].layer && <div className="sa-bld-pour" />}
          {stack > 0 && <div className={"sa-bld-surface" + (just >= 0 && sc.steps[just].layer ? " fresh" : "")}
            style={{ bottom: `calc(${stack}% - 2px)` }} />}

          {poured.some(x => x.s.pulp) && (<>
            {[0, 1, 2, 3, 4].map(i => (
              <div key={"p" + i} className="sa-bld-pulp" style={{
                width: 4 + (i % 3) * 2, height: 3 + (i % 3) * 2,
                left: 9 + ((i * 17) % 38), bottom: 6 + ((i * 13) % 22),
                transform: `rotate(${i * 47 % 90 - 45}deg)`,
              }} />
            ))}
            <div className="sa-bld-wedge" style={{ left: 8, bottom: 4, transform: "rotate(-14deg)" }} />
          </>)}

          {iceStep && [...Array(big ? 1 : 8)].map((_, i) => {
            const sz = big ? 36 : 11, rot = big ? 12 : (i * 41 % 70 - 35);
            return (
              <div key={"c" + i} className={"sa-bld-cube" + (iceStep.i === just ? " fresh" : "")}
                style={{
                  width: sz, height: sz,
                  left: big ? "calc(50% - 18px)" : 5 + ((i * 19) % 42),
                  bottom: big ? 18 : 12 + ((i * 27) % 92),
                  transform: `rotate(${rot}deg)`, "--rot": rot + "deg",
                  animationDelay: (i * 0.045) + "s",
                  borderRadius: big ? 8 : 3,
                  background: big ? "rgba(240,250,255,0.32)" : undefined,
                }} />
            );
          })}

          {poured.some(x => x.s.fizz) && [...Array(14)].map((_, i) => {
            const sz = 2 + (i % 3);
            return <div key={"b" + i} className="sa-bld-bubble" style={{
              width: sz, height: sz, left: 7 + ((i * 13) % 46), bottom: 10 + ((i * 19) % 30),
              "--rise": -(46 + ((i * 11) % 42)) + "px",
              animationDuration: (1.9 + (i % 5) * 0.45) + "s", animationDelay: (i * 0.23) + "s",
            }} />;
          })}

          {[0, 1, 2, 3, 4, 5].map(i => {
            const sz = 2 + (i % 3);
            return <div key={"d" + i} className="sa-bld-drop" style={{
              width: sz, height: sz, left: 6 + ((i * 23) % 48), bottom: 30 + ((i * 37) % 84),
              "--slide": (14 + (i % 4) * 7) + "px",
              animationDuration: (4.5 + (i % 4) * 1.6) + "s", animationDelay: (i * 0.8) + "s",
            }} />;
          })}
        </div>
        {garn && (
          <div className="sa-bld-garnish">
            {(BUILD_SVG[garn.garnish] || BUILD_SVG.mint)(garn.garnish === "twist" ? (a11y ? "#A85A18" : "#E09A50") : (a11y ? "#4E7A32" : "#8FC471"), 26)}
          </div>
        )}
        <div style={{ textAlign: "center", fontFamily: mono, fontSize: 8, letterSpacing: 1.6, color: P.sub, marginTop: 7, textTransform: "uppercase" }}>
          {rocks ? "олд фэшн" : "хайбол"}
        </div>
      </div>
    );
  };

  // ── НОСИТЕЛЬ: станция сверху ───────────────────────────────────────
  const Station = () => {
    const marks = new Set(), zones = { 0: null, 1: null, 2: null };
    sc.steps.slice(0, shown).forEach(st => {
      if (st.mark) marks.add(st.mark);
      if (st.zone != null) zones[st.zone] = st.chips;
    });
    const ready = marks.has("ready") && !spoiled;
    return (
      <div className={"sa-bld-station" + (marks.has("clean") ? " clean" : "") + (spoiled ? " spoiled" : "")}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 6, fontFamily: mono, fontSize: 7, letterSpacing: 1.3, color: P.sub, marginBottom: 6 }}>
          <span>СТАНЦИЯ</span>
          <span style={{ color: ready ? GREEN : RED }}>{ready ? "ГОТОВА ✓" : "НЕ ГОТОВА"}</span>
        </div>
        <div className={"sa-bld-icebin" + (marks.has("ice") ? " on" : "")}>
          {marks.has("ice") && [...Array(9)].map((_, i) => (
            <i key={i} style={{ left: 6 + i * 15, top: 5 + ((i * 11) % 12), transform: `rotate(${i * 33 % 60 - 30}deg)` }} />
          ))}
          <span>{marks.has("ice") ? "лёд свежий" : "ванна пустая"}</span>
        </div>
        {["Рабочая", "Ближняя", "Дальняя"].map((nm, z) => (
          <div key={z} className={"sa-bld-zone" + (zones[z] ? " on" : "")}>
            <div className="sa-bld-zname">{nm}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
              {zones[z]
                ? zones[z].map((c, i) => <span key={i} className="sa-bld-zchip">{c}</span>)
                : <span style={{ fontSize: 8.5, color: "#5C5244", fontStyle: "italic" }}>пусто</span>}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── НОСИТЕЛЬ: цепочка стадий ───────────────────────────────────────
  const Flow = () => (
    <div style={{ display: "flex", alignItems: "flex-start", margin: "14px 0 4px" }}>
      {sc.stages.map((st, i) => {
        const r = results[i];
        const cls = r === true ? " on" : r === false ? " bad" : (i === step && !done) ? " now" : "";
        return (
          <div key={i} className={"sa-bld-fstage" + cls}>
            {i > 0 && <div className="sa-bld-fbar" />}
            <div className="sa-bld-fring">
              {(BUILD_SVG[st.ic] || BUILD_SVG.ice)(
                r === true ? (a11y ? "#8B6A30" : GOLD)
                : r === false ? (a11y ? "#8B3020" : RED)
                : (a11y ? "#8A7A5C" : MUTED_2), 20)}
            </div>
            <div className="sa-bld-fnm">{st.n}</div>
          </div>
        );
      })}
    </div>
  );

  const StepList = () => (
    <div style={{ flex: 1, minWidth: 0 }}>
      {sc.steps.map((st, i) => {
        const r = results[i];
        const c = r === true ? P.stepDone : r === false ? RED : (i === step && !done) ? (a11y ? "#8B6A30" : GOLD) : P.sub;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 0", fontSize: 13, color: c }}>
            <span style={{
              flex: "0 0 18px", height: 18, borderRadius: 6, display: "grid", placeItems: "center",
              fontSize: 10, fontFamily: mono,
              background: r === true ? GREEN : r === false ? RED : "transparent",
              color: r == null ? CLAY : r ? "#0d2318" : "#2a0d0d",
              border: `1px solid ${r == null ? "rgba(200,169,110,0.3)" : "transparent"}`,
            }}>{r === true ? "✓" : r === false ? "✕" : i + 1}</span>
            <span>{st.label}</span>
            {r != null && (
              <span style={{ marginLeft: "auto", fontSize: 11, color: MUTED, maxWidth: 96, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: P.faint }}>
                {st.options.find(o => o.ok).t.split(",")[0]}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );

  const Carrier = () => sc.vis === "flow" ? <Flow /> : (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-end", margin: "12px 0 2px" }}>
      {sc.vis === "vessel" ? <Vessel /> : <Station />}
      <StepList />
    </div>
  );

  // Стекло карточки — общее с уроками приложения: внутреннее свечение,
  // светлая кромка сверху, без backdrop-blur. Обе темы приходят из токенов.
  const cardStyle = {
    margin: 16, padding: 18, borderRadius: RADIUS.lg,
    background: T.lessGlass?.bg || "rgba(226,186,116,0.11)",
    border: T.lessGlass?.border || "1px solid rgba(145,108,40,0.36)",
    borderTop: T.lessGlass?.borderTop || "1px solid rgba(210,168,65,0.44)",
    boxShadow: T.lessGlass?.shadow
      || "inset 0 0 22px rgba(255,248,230,0.07), inset 0 1px 0 rgba(255,255,255,0.10), 0 6px 20px rgba(0,0,0,0.38)",
  };
  const btn = {
    width: "100%", marginTop: 10, padding: 14, border: "none", borderRadius: RADIUS.md,
    background: accent, color: INK_DEEP, fontFamily: serif, fontWeight: "bold", fontSize: 15, cursor: "pointer",
  };
  const ghost = { ...btn, background: "transparent", border: `1px solid ${accent}66`, color: accent, fontWeight: "normal" };

  // ── ЭКРАН ИТОГА ────────────────────────────────────────────────────
  if (done) {
    const missed = sc.steps.filter((_, i) => results[i] === false);
    return (
      <Shell title={sc.title} onClose={() => onClose && onClose()} accent={accent} T={T}>
        <div style={cardStyle}>
          <Eyebrow left={"Сборка · " + sc.title} right="итог" a11y={a11y} />
          <Carrier />
          <div style={{ textAlign: "center", padding: "10px 4px 2px" }}>
            <div style={{ fontSize: 42, color: accent, lineHeight: 1 }}>{right} / {total}</div>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: P.sub, marginTop: 8 }}>шагов без ошибки</div>
          </div>
          {!missed.length ? (
            <div className="sa-bld-fb" style={{ ...(T.simFb || {}), borderLeftColor: GREEN }}>🎯 {sc.win}</div>
          ) : (
            <div className="sa-bld-fb" style={{ ...(T.simFb || {}), borderLeftColor: RED }}>
              <div>💡 {sc.lose}</div>
              <div style={{ margin: "12px 0 6px", fontFamily: mono, fontSize: 9, letterSpacing: 2.4, textTransform: "uppercase", color: P.sub }}>
                Что из этого получит гость
              </div>
              {missed.map((st, i) => (
                <div key={i} style={{ display: "flex", gap: 9, padding: "6px 0", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 13 }}>
                  <span style={{ flex: "0 0 86px", color: GOLD_SOFT, fontSize: 11.5, paddingTop: 1 }}>{st.label}</span>
                  <span style={{ color: P.costText, lineHeight: 1.45 }}>{st.cost}</span>
                </div>
              ))}
            </div>
          )}
          <button style={btn} className="sa-btn" onClick={() => restart(false)}>Собрать заново</button>
          <button style={ghost} className="sa-btn" onClick={() => restart(true)}>Пересобрать этот же сценарий</button>
          <button style={{ ...ghost, borderColor: a11y ? "rgba(107,78,26,0.3)" : "rgba(255,255,255,0.14)", color: P.faint }} className="sa-btn" onClick={() => onClose && onClose()}>
            Готово
          </button>
        </div>
      </Shell>
    );
  }

  // ── ЭКРАН ШАГА ─────────────────────────────────────────────────────
  const picked = answered != null ? cur.options[answered] : null;
  return (
    <Shell title={sc.title} onClose={() => onClose && onClose(true)} accent={accent} T={T}>
      <div style={cardStyle}>
        <Eyebrow left={"Сборка · " + sc.title} right={`${step + 1} / ${total}`} a11y={a11y} />
        <div style={{ fontSize: 11, color: P.sub, marginTop: 6, fontStyle: "italic" }}>{sc.from}</div>
        <Carrier />
        <div style={{ fontSize: 16, lineHeight: 1.45, margin: "14px 0 12px", color: P.text }}>{cur.q}</div>

        {cur.options.map((o, i) => {
          const state = answered == null ? null : o.ok ? "win" : i === answered ? "lose" : "off";
          return (
            <button key={i} className={"sa-bld-opt" + (state ? " " + state : "")} disabled={answered != null}
              onClick={answered == null ? () => choose(i, o.ok) : undefined}
              style={{ ...(T.simOpt || {}), ...optState(state) }}>
              <span className="sa-bld-optk" style={optKey(state)}>{"ABCD"[i]}</span>
              <span style={{ flex: 1 }}>{o.t}</span>
            </button>
          );
        })}

        {picked && (
          <div className="sa-bld-fb" style={{ ...(T.simFb || {}), borderLeftColor: picked.ok ? GREEN : RED }}>
            {(picked.ok ? "🎯 " : "💡 ") + picked.fb}
            {!picked.ok && cur.cost && (
              <div style={{ marginTop: 9, paddingTop: 9, borderTop: "1px dashed rgba(224,120,120,0.3)", fontSize: 12.5, color: a11y ? "#8B3020" : "#E8B5B5" }}>
                Дойдёт до гостя так: {cur.cost}
              </div>
            )}
            {cur.term && <div className="sa-bld-term">📖 {cur.term}</div>}
          </div>
        )}

        {answered != null && (
          <button style={btn} className="sa-btn" onClick={next}>
            {step < total - 1 ? "Дальше" : "Показать итог"}
          </button>
        )}
      </div>
    </Shell>
  );
}

// ── Оболочка на весь экран, как у живого диалога ──────────────────────
function Shell({ title, onClose, accent, T, children }) {
  const a11y = !!T.a11y;
  return (
    <div className="sa-bld-buildwrap" style={{
      position: "fixed", inset: 0, zIndex: 1000, display: "flex", flexDirection: "column",
      background: T.a11y ? "#E8DEC8" : "linear-gradient(160deg,#14110A 0%,#1C1509 50%,#14110A 100%)",
      overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "44px 18px 4px" }}>
        <button className="sa-btn" style={{
          background: "transparent", border: "none", color: accent, fontSize: 26,
          cursor: "pointer", lineHeight: 1, padding: "0 6px 4px 0", fontFamily: serif,
        }} onClick={onClose} aria-label="Закрыть">‹</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: 3, textTransform: "uppercase", color: a11y ? "#6B5B40" : MUTED_2 }}>Сборка</div>
          <div style={{ color: a11y ? "#2A1F0E" : CREAM, fontSize: 16, fontFamily: serif }}>{title}</div>
        </div>
        {UI_SVG.shaker ? UI_SVG.shaker(a11y ? "#8B6A30" : accent, 22) : null}
      </div>
      {children}
      <div style={{ height: 24 }} />
    </div>
  );
}

function Eyebrow({ left, right, a11y }) {
  return (
    <div style={{
      fontFamily: mono, fontSize: 9.5, letterSpacing: 3.5, textTransform: "uppercase",
      color: a11y ? "#6B5B40" : MUTED_2, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
    }}>
      <span>{left}</span>
      <span style={{ color: a11y ? "#8B6A30" : GOLD_SOFT, whiteSpace: "nowrap" }}>{right}</span>
    </div>
  );
}
