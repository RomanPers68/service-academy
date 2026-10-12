// ui/module-menu.jsx — раздел как меню ресторана (Доп. 292).
// Было: список карточек-уроков под цветной шапкой. Стало: меню раздела —
// строки с отточием, описания курсивом, «пройден» от руки, тест — под сургучной
// печатью, текущий шаг — карточка с кнопкой. Вся прежняя информация на месте:
// значок, метка, название и подзаголовок раздела, номер шага, тип урока, что
// пройдено, сданный тест. Плюс время каждого шага и сколько осталось.
import React from "react";
import { ensureTableCss } from "./table-css";
import { Ic, Wax } from "./table-bits";
import { MOD_SVG } from "./icons";
import { inkOf } from "../lib/tracks";
import { onActivate } from "../lib/utils";

const KIND = { lesson: "урок", quiz: "тест", practice: "практика", dialogue: "живой диалог", build: "сборка" };
const DONE_WORD = { lesson: "пройден", quiz: "сдан", practice: "сыграно", dialogue: "пройден", build: "собрано" };
const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; if (m10 === 1 && m100 !== 11) return a; if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return b; return c; };

// что уже было «пройдено» при прошлом показе меню — чтобы новое «пройден» вписывалось от руки
const seenDone = new Map();
const SEAL_KEY = "sa_seal_seen";   // разделы, на которых печать уже «опускалась»

function detail(l, est) {
  const q = (l.questions || []).length, s = (l.situations || []).length;
  if (l.type === "quiz") return q ? q + " " + plural(q, "вопрос", "вопроса", "вопросов") : "тест раздела";
  if (l.type === "practice") return s ? s + " " + plural(s, "ситуация", "ситуации", "ситуаций") : "игра";
  if (l.type === "dialogue") return "разговор с гостем";
  if (l.type === "build") return "собери у стойки";
  return "≈ " + est + " мин";
}

// v30 (Доп. 313, 315, 316): под шапкой темы — её свежесть и действия: «Освежить» (тема пройдена),
// «Зачёт на опыт» (не пройдена), «Раунд мастера» (пройдена, ещё не золотая). topic — что знает App:
// { f: свежесть, credit, gold, canCredit, canGold, canRefresh, tried: зачёт сегодня уже сдавали }
// canRefresh === false — в теме нечем освежать (одни уроки): ни свежести, ни кнопки
function TopicActs({ topic, acts, passive }) {
  if (!topic || !acts) return null;
  const { f, credit, gold, canCredit, canGold, canRefresh, tried, done } = topic;
  const off = passive ? -1 : undefined;
  const items = [];
  if (done) {
    const hot = f && f.level !== "fresh";
    if (acts.onRefresh && canRefresh !== false) items.push(<button key="r" type="button" tabIndex={off} className={"tbm-act" + (hot ? " hot" : "")} onClick={acts.onRefresh}>Освежить · 1 мин</button>);
    if (acts.onGold && canGold) items.push(<button key="g" type="button" tabIndex={off} className={"tbm-act gold" + (gold ? " got" : "")} onClick={acts.onGold}>{gold ? "Золото ✦ · ещё раз" : "Раунд мастера ✦"}</button>);
  } else if (acts.onCredit && canCredit) {
    items.push(<button key="c" type="button" tabIndex={off} className="tbm-act" disabled={!!tried} onClick={tried ? undefined : acts.onCredit}>{tried ? "Зачёт на опыт — завтра" : "Я это умею — зачёт на опыт"}</button>);
  }
  const line = done ? freshLine(f) : null;
  const marks = [credit ? "зачтено по опыту" : "", gold ? "золотая тема" : ""].filter(Boolean).join(" · ");
  if (!items.length && !line && !marks) return null;
  return (
    <div className="tbm-acts">
      {line || marks ? <div className={"tbm-fresh" + (f && f.level !== "fresh" ? " " + f.level : "") + (f && f.updated ? " upd" : "")}>{[line, marks].filter(Boolean).join(" · ")}
        {acts.onCellar && done ? <button type="button" className="tbm-cellar" tabIndex={off} onClick={acts.onCellar}>погреб тем ›</button> : null}</div> : null}
      {items.length ? <div className="tbm-actrow">{items}</div> : null}
    </div>
  );
}
function freshLine(f) {
  if (!f) return "";
  if (f.updated) return "урок обновили — освежи";
  if (f.level === "faded") return "тема выдохлась";
  if (f.level === "fading") return "тема выдыхается";
  return "тема свежая" + (f.dueIn ? " · ещё " + f.dueIn + " " + plural(f.dueIn, "день", "дня", "дней") : "");
}

export function ModuleMenu({ mod, completed = {}, quizDone = {}, onLesson, onBack, a11y = false, estMins, fmtMins, embedded = false, passive = false, tint = null, topic = null, acts = null }) {
  // passive — соседняя страница в листаемом треке (видна краем): ничего не отмечает
  // «увиденным» — ни печать, ни «пройден» от руки; анимации сыграют, когда страница станет текущей
  // tint (Доп. 308) — оттенок темы в треке: ленточка, значок и отметка текущего шага; текст — цвета трека
  const deco = tint || mod.color;
  ensureTableCss();
  const est = (l) => { try { return estMins ? estMins(l) : 1; } catch (e) { return 1; } };
  const fmt = (m) => (fmtMins ? fmtMins(m) : m + " мин");
  const lessons = mod.lessons || [];
  const isDone = (l) => (l.type === "quiz" ? !!quizDone[l.id] : !!completed[l.id]);
  const real = lessons.filter((l) => l.type !== "result");
  const doneN = real.filter(isDone).length;
  const total = real.reduce((a, l) => a + est(l), 0);
  const left = real.reduce((a, l) => a + (isDone(l) ? 0 : est(l)), 0);
  const curIdx = lessons.findIndex((l) => l.type !== "result" && !isDone(l));
  const ink = inkOf(mod.color, a11y);
  const prev = seenDone.get(mod.id);
  const fresh = new Set(prev && !passive ? real.filter((l) => isDone(l) && !prev.has(l.id)).map((l) => l.id) : []);
  React.useEffect(() => { if (!passive) seenDone.set(mod.id, new Set(real.filter(isDone).map((l) => l.id))); });
  const vars = { "--role-ink": ink, "--role-fill": deco, "--role-edge": deco + "88", "--role-wash": deco + "40" };
  const lastIdx = lessons.length - 1;
  // Доп. 297: раздел пройден целиком — сургучная печать; «опускается» один раз
  const sealed = real.length > 0 && doneN >= real.length;
  const sealSeen = () => { try { const m = JSON.parse(localStorage.getItem(SEAL_KEY) || "{}") || {}; return !!m[mod.id]; } catch (e) { return true; } };
  // решается один раз — в момент, когда страница стала текущей (не во время показа краем)
  const stampRef = React.useRef(null);
  if (!passive && stampRef.current === null) stampRef.current = sealed && !sealSeen();
  const stampNow = !!stampRef.current;
  const showSeal = sealed && (!passive || sealSeen());
  React.useEffect(() => {
    if (!sealed || passive) return;
    try { const m = JSON.parse(localStorage.getItem(SEAL_KEY) || "{}") || {}; if (!m[mod.id]) { m[mod.id] = 1; localStorage.setItem(SEAL_KEY, JSON.stringify(m)); } } catch (e) {}
  }, [sealed, mod.id, passive]);

  return (
    <div className="tbm" style={vars}>
      {/* Доп. 307: в листаемом треке меню — страница, кнопки «Назад» у него нет */}
      {embedded ? null : (
        <div style={{ padding: "44px 18px 8px" }}>
          <button onClick={onBack} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: a11y ? "#6B5B40" : "#A29679", fontSize: 15, fontFamily: "Georgia, serif" }}>‹ Назад</button>
        </div>
      )}
      <div className="tbm-menu">
        <span className="tbm-lasse" aria-hidden="true" style={{ background: "linear-gradient(180deg,transparent 40%,rgba(0,0,0,.28))," + (deco || "#8B3020") }} />
        {showSeal ? <span className={"tbm-seal" + (stampNow ? " stamp" : "")} aria-hidden="true"><Wax s={58} /></span> : null}
        <div className="tbm-head">
          {/* v32 (Доп. 334): значок темы — в одной строке с меткой (меню компактнее, без лишней прокрутки) */}
          <div className="tbm-top">
            {MOD_SVG[mod.icon] ? <div className="tbm-icon">{MOD_SVG[mod.icon](deco, 20)}</div> : (mod.icon ? <div className="tbm-icon" style={{ fontSize: 18 }}>{mod.icon}</div> : null)}
            <div className="tbm-eyebrow" style={{ color: ink }}>{[mod.tag, real.length + " " + plural(real.length, "шаг", "шага", "шагов"), "≈ " + fmt(total)].filter(Boolean).join(" · ")}</div>
          </div>
          <h2 className="tbm-title">{mod.title}</h2>
          {mod.subtitle ? <p className="tbm-sub">{mod.subtitle}</p> : null}
          {sealed ? <div className="tbm-sealnote" role="note">раздел пройден · печать</div> : null}
          <div className="tbm-orn" aria-hidden="true"><i /><span>✦</span><i /></div>
          <TopicActs topic={topic ? { ...topic, done: sealed } : null} acts={acts} passive={passive} />
        </div>
        <ol className="tbm-list" aria-label={"Шаги раздела «" + mod.title + "»"}>
          {lessons.map((l, i) => {
            const done = isDone(l);
            const cur = i === curIdx;
            const kind = KIND[l.type] || "урок";
            const isQuiz = l.type === "quiz";
            const final = isQuiz && i === lastIdx && lessons.length > 1;
            const cls = [cur ? "cur" : "", i > 0 && isDone(lessons[i - 1]) ? "pd" : "", done ? "sd" : "", final ? "final" : ""].filter(Boolean).join(" ");
            const go = () => onLesson(l);
            const sub = "шаг " + (i + 1) + " · " + kind + (l.type === "lesson" ? "" : " · " + detail(l, est(l)));
            // v32 (Доп. 334): номер шага — в кружке на линии (раньше — отдельной строкой «шаг N · урок»)
            const marker = isQuiz
              ? <span className="tbm-mk seal" aria-hidden="true">{done ? <Wax s={26} /> : null}</span>
              : <span className="tbm-mk" aria-hidden="true">{done ? <svg width="10" height="10" viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></svg> : cur ? null : <span className="nm">{i + 1}</span>}</span>;
            if (cur) {
              const started = doneN > 0;
              return (
                <li key={l.id} className={cls}>
                  <div className="tbm-node tbm-cur" role="button" tabIndex={0} onClick={go} {...onActivate(go)} aria-label={(started ? "Дальше: " : "Начать: ") + l.title}>
                    {marker}
                    <div className="tbm-card">
                      <div className="tbm-cc">
                        <div className="tbm-ck"><span className="tbm-kchip">{kind.toUpperCase()}</span><span>{"≈ " + est(l) + " мин" + (l.type !== "lesson" ? " · " + detail(l, est(l)) : "")}</span></div>
                        <span className="tbm-ct">{l.title}</span>
                        <span className="tbm-cs">{"шаг " + (i + 1) + " из " + real.length + (doneN ? " · пройдено " + doneN : " · начало раздела")}</span>
                      </div>
                      <span className="tbm-cta">{started ? "Дальше" : "Начать"}</span>
                    </div>
                  </div>
                </li>
              );
            }
            return (
              <li key={l.id} className={cls}>
                <button type="button" className={"tbm-node" + (done ? " done" : "")} onClick={go}
                  aria-label={l.title + " · " + sub + " · " + (done ? DONE_WORD[l.type] || "пройден" : est(l) + " мин")}>
                  {marker}
                  <span className="tbm-row">
                    <span className="tbm-t">{l.title}</span>
                    <span className="tbm-lead" />
                    {done
                      ? <span className={"tbm-m tbm-hand" + (fresh.has(l.id) ? " just" : "")}>{DONE_WORD[l.type] || "пройден"}</span>
                      : <span className="tbm-m">{est(l)} мин</span>}
                  </span>
                  {/* у урока подпись «шаг N · урок» стала номером в кружке; у практики, теста, диалога
                      и сборки строка осталась — в ней то, чего не видно иначе (сколько ситуаций, вопросов) */}
                  {l.type !== "lesson" ? <span className="tbm-s">{sub}</span> : null}
                </button>
              </li>
            );
          })}
        </ol>
        <div className="tbm-foot">
          <Ic n={doneN >= real.length && real.length ? "checkC" : "book"} s={16} />
          <span>{doneN >= real.length && real.length ? "раздел пройден целиком" : "пройдено " + doneN + " из " + real.length + " · осталось ≈ " + fmt(left)}</span>
        </div>
      </div>
    </div>
  );
}
