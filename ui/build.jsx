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
import { GLOSSARY } from "../data/glossary";
import { shuffleArray, vibrate } from "../lib/utils";
import { Confetti } from "./widgets";
import { GOLD, GOLD_SOFT, CREAM, SAND, GREEN, RED, MUTED, MUTED_2, CLAY, INK_DEEP, RADIUS } from "./tokens";
import { UI_SVG, BUILD_SVG } from "./icons";

const serif = "Georgia, serif";
const mono = "ui-monospace, Menlo, monospace";

// Перемешиваем варианты внутри каждого шага — как shuffleSituationOptions в практике
// Статья в глоссарии есть не у каждого термина: «джиггер» есть, «приоритет» нет.
// Без статьи чип остаётся подписью и не притворяется ссылкой.
const findArticle = (term) => {
  if (!term) return null;
  const t = term.toLowerCase();
  return GLOSSARY.find(g => (g.term || "").toLowerCase() === t)
      || GLOSSARY.find(g => {
           const x = (g.term || "").toLowerCase();
           return x.includes(t) || t.includes(x);
         })
      || null;
};

// Системная настройка «уменьшить движение»: декоративные частицы вообще не
// создаём — на слабом железе это заметно дешевле, чем рисовать и глушить.
const calmMotion = () => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  catch (e) { return false; }
};

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

export function BuildRunner({ buildId, mod, role = "bar", T = {}, color, onClose, onResult }) {
  const accent = color || GOLD;
  const a11y = !!T.a11y;
  // Инлайновые цвета текста под тему (классы красит CSS через html.sa-light)
  const P = a11y
    ? { text: "#2A1F0E", sub: "#6B5B40", faint: "#8A7A5C", costText: "#8B3020", stepDone: "#2A1F0E" }
    : { text: CREAM, sub: MUTED_2, faint: MUTED, costText: "#EAC9C9", stepDone: SAND };
  const calm = React.useMemo(calmMotion, []);

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
  const [openTerm, setOpenTerm] = React.useState(false); // раскрыта ли статья глоссария

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
    setStep(0); setAnswered(null); setResults([]); setDone(false); setOpenTerm(false);
  };

  const choose = (i, ok) => {
    if (answered != null) return;
    vibrate(ok ? "light" : "error");
    setAnswered(i);
    setResults(prev => { const n = [...prev]; n[step] = !!ok; return n; });
  };

  const next = () => {
    if (step < total - 1) { setStep(step + 1); setAnswered(null); setOpenTerm(false); }
    else {
      vibrate(right === total ? "success" : "light");
      // Результат наружу: App копит лучший в звёздах практики.
      // Каждый прогон (в т.ч. «Собрать заново») отчитывается — хуже не станет,
      // потому что App сохраняет только улучшение.
      try { onResult && onResult(right, total); } catch (e) {}
      setDone(true);
    }
  };

  // ── НОСИТЕЛЬ: сосуд ────────────────────────────────────────────────
  const Vessel = () => {
    const poured = sc.steps.slice(0, shown).map((s, i) => ({ s, i })).filter(x => x.s.layer);
    const stack = poured.reduce((a, x) => a + x.s.layer.h, 0);
    const iceStep = sc.steps.slice(0, shown).map((s, i) => ({ s, i })).find(x => x.s.ice);
    // strain: с шага процеживания лёд исчезает из бокала — он остался в шейкере.
    // Визуал повторяет то, чему учит шаг «Подача» (двойное процеживание).
    const strained = sc.steps.slice(0, shown).some(s => s.strain);
    const garn = sc.steps.slice(0, shown).find(s => s.garnish);
    const shape = sc.glass || "high";
    const rocks = shape === "rocks";
    const stemmed = shape === "wine" || shape === "coupe";
    const big = rocks;
    // Пена берётся у последнего пройденного шага — так она сначала нарастает,
    // а на следующем шаге оседает до нужной высоты.
    const foamStep = sc.steps.slice(0, shown).map((x, i) => ({ s: x, i })).filter(x => x.s.foam).pop();
    const shineStep = sc.steps.slice(0, shown).map((x, i) => ({ s: x, i })).find(x => x.s.shine);
    const CAP = { high: "хайбол", rocks: "олд фэшн", wine: "винный", pint: "пивной", coupe: "купе" };

    return (
      <div style={{ flex: "0 0 96px", height: 172, position: "relative", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        <div className={"sa-bld-vessel " + shape + (spoiled ? " spoiled" : "")}>
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

          {!strained && iceStep && [...Array(big ? 1 : 8)].map((_, i) => {
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

          {!calm && poured.some(x => x.s.fizz) && [...Array(8)].map((_, i) => {
            const sz = 2 + (i % 3);
            return <div key={"b" + i} className="sa-bld-bubble" style={{
              width: sz, height: sz, left: 7 + ((i * 13) % 46), bottom: 10 + ((i * 19) % 30),
              "--rise": -(46 + ((i * 11) % 42)) + "px",
              animationDuration: (1.9 + (i % 5) * 0.45) + "s", animationDelay: (i * 0.23) + "s",
            }} />;
          })}

          {!calm && [0, 1, 2, 3].map(i => {
            const sz = 2 + (i % 3);
            return <div key={"d" + i} className="sa-bld-drop" style={{
              width: sz, height: sz, left: 6 + ((i * 23) % 48), bottom: 30 + ((i * 37) % 84),
              "--slide": (14 + (i % 4) * 7) + "px",
              animationDuration: (4.5 + (i % 4) * 1.6) + "s", animationDelay: (i * 0.8) + "s",
            }} />;
          })}

          {foamStep && (
            <div className={"sa-bld-foam" + (foamStep.i === just ? " fresh" : "")}
              style={{ bottom: stack + "%", height: "26%", transform: `scaleY(${foamStep.s.foam.h / 26})` }} />
          )}
          {(shineStep && shineStep.i === just) || (done && !spoiled) ? <div className="sa-bld-shine" /> : null}
        </div>
        <div className="sa-bld-shadow" />
        {stemmed && (<>
          <div className="sa-bld-stem" />
          <div className="sa-bld-foot" />
        </>)}
        {garn && (
          <div className="sa-bld-garnish">
            {(BUILD_SVG[garn.garnish] || BUILD_SVG.mint)(garn.garnish === "twist" ? (a11y ? "#A85A18" : "#E09A50") : (a11y ? "#4E7A32" : "#8FC471"), 26)}
          </div>
        )}
        <div style={{ textAlign: "center", fontFamily: mono, fontSize: 8, letterSpacing: 1.6, color: P.sub, marginTop: 7, textTransform: "uppercase" }}>
          {/* До первого решения имя бокала скрыто: первый вопрос коктейлей —
              «в чём подаёшь?», и подпись выдавала бы ответ. После ответа
              имя появляется как подтверждение выбора. */}
          {shown === 0 ? "собери меня" : (CAP[shape] || "хайбол")}
        </div>
      </div>
    );
  };


  // ── НОСИТЕЛЬ: путь льда ────────────────────────────────────────────
  // Вертикальный маршрут: генератор сверху, ванна посередине, бокал снизу.
  // Лёд физически спускается вниз, а ошибка делает его мутным и подтаявшим.
  const IcePath = () => {
    const passed = new Set(sc.steps.slice(0, shown).map(s => s.stage));
    const murky = spoiled;                       // ошиблись — лёд собрал лишнее
    const cube = (i, n, cls) => {
      const sz = 9 + (i % 2) * 2;
      return <i key={cls + i} className={"sa-bld-icecube" + (murky ? " murky" : "")}
        style={{ width: sz, height: sz, left: 6 + ((i * 17) % (n > 4 ? 46 : 30)),
          bottom: 4 + ((i * 13) % 18), transform: `rotate(${i * 37 % 70 - 35}deg)`,
          animationDelay: (i * 0.05) + "s" }} />;
    };
    return (
      <div className={"sa-bld-icecol" + (murky ? " murky" : "")}>
        <div className={"sa-bld-icegen" + (passed.has("gen") ? " on" : "")}>
          <span>ГЕНЕРАТОР</span>
          {passed.has("gen") && [...Array(6)].map((_, i) => cube(i, 6, "g"))}
        </div>
        <div className={"sa-bld-icearrow" + (passed.has("scoop") ? " on" : "")}>
          {passed.has("scoop") ? BUILD_SVG.scoop(murky ? RED : (a11y ? "#8B6A30" : GOLD), 15) : <b>↓</b>}
        </div>
        <div className={"sa-bld-icetub" + (passed.has("bin") ? " on" : "")}>
          <span>ВАННА</span>
          {passed.has("bin") && [...Array(8)].map((_, i) => cube(i, 8, "b"))}
        </div>
        <div className={"sa-bld-iceglass" + (passed.has("glass") ? " on" : "")}>
          {passed.has("glass") && [...Array(5)].map((_, i) => cube(i, 5, "s"))}
          <span>{passed.has("check") ? (murky ? "ВОДЯНИСТО" : "ХОЛОДНО") : "БОКАЛ"}</span>
        </div>
      </div>
    );
  };

  // ── НОСИТЕЛЬ: уборка смены ─────────────────────────────────────────
  // Обратная сборка: станция начинается захламлённой, каждый верный шаг
  // что-то убирает, поверхность светлеет.
  const Cleanup = () => {
    const cleared = new Set();
    sc.steps.slice(0, shown).forEach((st, i) => { if (st.clears && results[i] !== false) cleared.add(st.clears); });
    const items = [
      { key: "perish", ic: "citrus",    label: "гарниш и соки" },
      { key: "tools",  ic: "sponge",    label: "инструмент" },
      { key: "bin",    ic: "bin",       label: "вода в ванне" },
      { key: "surface",ic: "wipe",      label: "станция и тряпки" },
      { key: "handover", ic: "clipboard", label: "стоп-лист" },
    ];
    const done = items.filter(x => cleared.has(x.key)).length;
    return (
      <div className="sa-bld-clean" style={{ "--clean": done / items.length }}>
        <div className="sa-bld-cleanhead">
          <span>СМЕНА</span>
          <span style={{ color: done === items.length ? GREEN : (a11y ? "#8B6A30" : GOLD) }}>
            {done === items.length ? "СДАНА ✓" : done + " / " + items.length}
          </span>
        </div>
        {items.map(it => {
          const off = cleared.has(it.key);
          return (
            <div key={it.key} className={"sa-bld-cslot" + (off ? " cleared" : "")}>
              <span className="sa-bld-cico">
                {(BUILD_SVG[it.ic] || BUILD_SVG.wipe)(off ? (a11y ? "#4E7A32" : GREEN) : (a11y ? "#9A7A40" : "#B09060"), 13)}
              </span>
              <span className="sa-bld-clabel">{it.label}</span>
              {off && <span className="sa-bld-cmark">✓</span>}
            </div>
          );
        })}
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


  // ── НОСИТЕЛЬ: гость за стойкой ─────────────────────────────────────
  // Предмет здесь — сам гость: его настроение меняется от твоих решений,
  // а на стойке появляется то, что ты ему поставил.
  const Guest = () => {
    const done = results.slice(0, shown);
    const good = done.filter(r => r === true).length;
    const bad = done.filter(r => r === false).length;
    const mood = Math.max(0, Math.min(4, 2 + good - bad * 2));
    const MOODS = ["Закрылся", "Насторожен", "Нейтрален", "Расположен", "Доволен"];
    const tone = mood <= 1 ? RED : mood === 2 ? (a11y ? "#8A7A5C" : MUTED) : (a11y ? "#4E7A32" : GREEN);
    const served = sc.steps.slice(0, shown).flatMap(s => s.serve || []);
    return (
      <div className="sa-bld-guest">
        <div className="sa-bld-gfig" style={{ borderColor: tone + "55" }}>
          {BUILD_SVG.guest(tone, 34)}
        </div>
        <div className="sa-bld-gmood">
          {[0, 1, 2, 3, 4].map(i => (
            <span key={i} className="sa-bld-gdot"
              style={{ background: i <= mood ? tone : "transparent", borderColor: tone + (i <= mood ? "" : "44") }} />
          ))}
        </div>
        <div className="sa-bld-glabel" style={{ color: tone }}>{MOODS[mood]}</div>
        <div className="sa-bld-gbar">
          {served.length
            ? served.map((k, i) => (
                <span key={i} className="sa-bld-gitem">
                  {(BUILD_SVG[k] || BUILD_SVG.glass)(a11y ? "#8B6A30" : GOLD, 15)}
                </span>
              ))
            : <span className="sa-bld-gempty">стойка пуста</span>}
        </div>
      </div>
    );
  };

  // ── НОСИТЕЛЬ: выдача в час пик ─────────────────────────────────────
  // Полка выдачи: напитки встают по мере верных решений, счётчик ждущих тает.
  const Pass = () => {
    const served = sc.steps.slice(0, shown).flatMap(s => s.serve || []);
    const total = sc.steps.flatMap(s => s.serve || []).length;
    const waiting = Math.max(0, total - served.length);
    return (
      <div className="sa-bld-pass">
        <div className="sa-bld-passhead">
          <span>ВЫДАЧА</span>
          <span style={{ color: waiting ? (a11y ? "#8B6A30" : GOLD) : GREEN }}>
            {waiting ? "ждут " + waiting : "готово ✓"}
          </span>
        </div>
        <div className="sa-bld-rail">
          {[...Array(total)].map((_, i) => (
            <span key={i} className={"sa-bld-slot" + (i < served.length ? " on" : "")}>
              {i < served.length
                ? (BUILD_SVG[served[i]] || BUILD_SVG.glass)(spoiled ? RED : (a11y ? "#8B6A30" : GOLD), 17)
                : <b>·</b>}
            </span>
          ))}
        </div>
        <div className="sa-bld-railline" />
        <div className="sa-bld-passfoot">{spoiled ? "заказ уйдёт вразнобой" : "заказ уходит целиком"}</div>
      </div>
    );
  };

  // ── НОСИТЕЛЬ: полка склада ─────────────────────────────────────────
  // Бутылки с разными уровнями: пока не посчитал — знак вопроса вместо цифры.
  const Shelf = () => {
    const marks = new Set(sc.steps.slice(0, shown).map(s => s.shelf).filter(Boolean));
    const lv = [72, 34, 90, 18, 55, 46];
    return (
      <div className="sa-bld-shelf">
        <div className="sa-bld-shelfhead">
          <span>СКЛАД</span>
          <span style={{ color: marks.has("handover") ? GREEN : (a11y ? "#8B6A30" : GOLD) }}>
            {marks.has("handover") ? "сдан ✓" : marks.has("measure") ? "посчитан" : "не считан"}
          </span>
        </div>
        <div className="sa-bld-bottles">
          {lv.map((h, i) => (
            <span key={i} className={"sa-bld-bottle" + (marks.has("measure") ? " on" : "")}>
              <i style={{ transform: `scaleY(${marks.has("measure") ? h / 100 : 0})` }} />
              <b>{marks.has("measure") ? h : "?"}</b>
            </span>
          ))}
        </div>
        <div className={"sa-bld-crate" + (marks.has("perish") ? " on" : "")}>
          {BUILD_SVG.citrus(marks.has("perish") ? (a11y ? "#7A9A32" : "#A8C46E") : "#5C5244", 12)}
          <span>{marks.has("perish") ? "скоропорт под оборот" : "скоропорт не учтён"}</span>
        </div>
        <div className={"sa-bld-crate" + (marks.has("order") ? " on" : "")}>
          {BUILD_SVG.box(marks.has("order") ? (a11y ? "#8B6A30" : GOLD) : "#5C5244", 12)}
          <span>{marks.has("order") ? "заказ отправлен" : "заказ не собран"}</span>
        </div>
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
              <span style={{ marginLeft: "auto", fontSize: 11, maxWidth: 96, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: P.faint }}>
                {st.options.find(o => o.ok).t.split(",")[0]}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );

  const SIDE = { vessel: Vessel, station: Station, ice: IcePath, cleanup: Cleanup, guest: Guest, pass: Pass, shelf: Shelf };
  // Носители вызываем как функции ({Carrier()}), а не как <Carrier />:
  // компоненты объявлены внутри BuildRunner и на каждый рендер получают новую
  // идентичность — React пересоздавал бы их DOM целиком, перезапуская анимации
  // заливки и пузырьков даже при простом открытии чипа глоссария.
  // Финальный кадр: то, что человек собрал, показываем крупно и по центру.
  // Список шагов на итоге не нужен — его заменяет разбор ниже.
  const HeroCarrier = () => {
    const side = SIDE[sc.vis] || Station;
    return (
      <div className="sa-bld-hero" style={{ display: "flex", justifyContent: "center", margin: "14px 0 4px" }}>
        {side()}
      </div>
    );
  };
  const Carrier = () => {
    if (sc.vis === "flow") return Flow();
    const side = SIDE[sc.vis] || Station;
    // Реакция предмета на ответ: ошибка — вздрагивание, верный — лёгкий кивок.
    // До первого решения — «дыхание»-приглашение (await). Класс появляется
    // на персистентном DOM в момент ответа и играет один раз.
    const react = answered != null ? (cur.options[answered].ok ? " nudge" : " jolt")
      : shown === 0 ? " await" : "";
    return (
      <div className={"sa-bld-counter" + react}>
        {side()}
        {StepList()}
      </div>
    );
  };

  // Стекло карточки — общее с уроками приложения: внутреннее свечение,
  // светлая кромка сверху, без backdrop-blur. Обе темы приходят из токенов.
  const cardStyle = {
    margin: 16, padding: 18, borderRadius: RADIUS.lg,
    background: T.lessGlass?.bg || "rgba(226,186,116,0.11)",
    border: T.lessGlass?.border || "1px solid rgba(145,108,40,0.36)",
    borderTop: T.lessGlass?.borderTop || "1px solid rgba(210,168,65,0.44)",
    boxShadow: T.lessGlass?.shadow
      || "inset 0 0 22px rgba(255,248,230,0.07), inset 0 1px 0 rgba(255,255,255,0.10), 0 6px 20px rgba(0,0,0,0.38)",
    // Оттенок под тему сценария: у льда холодный, у вина винный, у пива янтарный.
    // Едва заметный, чтобы не спорить с общей золотой палитрой приложения.
    backgroundImage: sc.tint ? `linear-gradient(158deg, ${sc.tint}${a11y ? "1A" : "16"} 0%, transparent 58%)` : undefined,
  };
  const btn = {
    width: "100%", marginTop: 10, padding: 14, border: "none", borderRadius: RADIUS.md,
    background: accent, color: INK_DEEP, fontFamily: serif, fontWeight: "bold", fontSize: 15, cursor: "pointer",
  };
  const ghost = { ...btn, background: "transparent", border: `1px solid ${accent}66`, color: accent, fontWeight: "normal" };

  // ── ЭКРАН ИТОГА ────────────────────────────────────────────────────
  if (done) {
    const missed = sc.steps.filter((_, i) => results[i] === false);
    // Печать вместо голой цифры — метафора книги отзывов, уже принятая в приложении.
    const verdict = missed.length === 0 ? { cls: "ok", label: "Безупречно" }
      : missed.length === 1 ? { cls: "warn", label: "С замечанием" }
      : { cls: "bad", label: "Пересобрать" };
    // Та же шкала, что у звёзд практики: 0 ошибок → 3, одна → 2, больше → 1
    const stars = missed.length === 0 ? 3 : missed.length === 1 ? 2 : 1;
    return (
      <Shell title={sc.title} onClose={() => onClose && onClose()} accent={accent} T={T}>
        {right === total && <Confetti />}
        <div style={cardStyle}>
          <Eyebrow left={"Сборка · " + sc.title} right="итог" a11y={a11y} />
          {HeroCarrier()}
          <div style={{ textAlign: "center", padding: "12px 4px 2px" }}>
            <div className={"sa-bld-seal " + verdict.cls}>
              <span className="sa-bld-sealtop">{right} / {total}</span>
              <span className="sa-bld-sealtext">{verdict.label}</span>
            </div>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: P.sub, marginTop: 12 }}>шагов без ошибки</div>
            <div style={{ fontSize: 17, letterSpacing: 4, marginTop: 10 }}>
              {[1, 2, 3].map(s => (
                <span key={s} style={{ opacity: s <= stars ? 1 : 0.22, filter: s <= stars ? "none" : "grayscale(1)" }}>⭐</span>
              ))}
            </div>
            <div style={{ fontFamily: mono, fontSize: 8.5, letterSpacing: 2, textTransform: "uppercase", color: P.faint, marginTop: 5 }}>
              лучший результат идёт в общий зачёт
            </div>
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
        <div className="sa-bld-thread">
          <i style={{ transform: `scaleX(${(step + (answered != null ? 1 : 0)) / total})` }} />
        </div>
        {Carrier()}
        <div key={"st" + step} className="sa-bld-stepin">
        <div style={{ fontSize: 16, lineHeight: 1.45, margin: "14px 0 12px", color: P.text }}>{cur.q}</div>

        {cur.options.map((o, i) => {
          const state = answered == null ? null : o.ok ? "win" : i === answered ? "lose" : "off";
          return (
            <button key={i} className={"sa-bld-opt" + (state ? " " + state : "") + (state === "win" ? " pop" : "")} disabled={answered != null}
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
            {cur.term && (() => {
              // Статью показываем прямо здесь: уход на экран глоссария
              // размонтировал бы «Сборку» вместе с прохождением.
              const art = findArticle(cur.term);
              if (!art) return <span className="sa-bld-term flat">{cur.term}</span>;
              return (<>
                <button className={"sa-bld-term" + (openTerm ? " open" : "")}
                  onClick={() => setOpenTerm(v => !v)}>
                  📖 {cur.term} {openTerm ? "▴" : "▾"}
                </button>
                {openTerm && (
                  <div className="sa-bld-article">
                    <b>{art.term}</b>
                    <span>{art.def}</span>
                  </div>
                )}
              </>);
            })()}
          </div>
        )}

        </div>

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
