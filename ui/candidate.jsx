// ─────────────────────────────────────────────────────────────────────
// СОБЕСЕДОВАНИЕ В ПРИЛОЖЕНИИ — проверка кандидата перед разговором.
// Поток: имя и роль → анкета опыта → передача телефона → адаптивный
// тест (подбирается под уровень кандидата) → самооценка → результат
// для менеджера. Особенности:
//  • без опыта — вопросы на здравый смысл и характер, вердикт про
//    потенциал; с опытом — профессиональные ситуации и строже планка;
//  • вопросы-приоритеты (расставь действия по порядку) — их не угадать;
//  • после теста кандидат оценивает сам себя — менеджер видит,
//    реалистична ли самооценка;
//  • правильные ответы кандидату не показываются.
// ─────────────────────────────────────────────────────────────────────
import React from "react";
import { CANDIDATE_QUESTIONS } from "../data/candidate-questions";
import { GOLD, GREEN, RED, GOLD_SOFT } from "./tokens";
import { shuffleArray, vibrate, onActivate } from "../lib/utils";
import { MOD_SVG, UI_SVG } from "./icons";
import { LiquidSegment } from "./widgets";

const STORE_KEY = "sa_candidate_results";
const SECONDS_PER_Q = 60; // ситуации читаются дольше — минута на вопрос
const MAX_CUSTOM_Q = 5;

const TEST_ROLES = [
  { id: "waiter",  customRoles: ["seasonal","core"],            label: "Официант",     desc: "Зал, гости, сервис" },
  { id: "hostess", customRoles: ["spg"],                        label: "Хостес / СПГ", desc: "Вход, встреча, рассадка" },
  { id: "manager", customRoles: ["manager","service_manager"], label: "Менеджер",     desc: "Команда, конфликты, смена" },
];
// Перерисованные иконки ролей из фирменного набора
const ROLE_ICO = {
  waiter: (c) => UI_SVG.cloche(c, 20),
  hostess: (c) => UI_SVG.sparkle(c, 20),
  manager: (c) => UI_SVG.target(c, 20),
};

const EXPERIENCE = [
  { id: "none",   label: "Опыта нет",      level: "none",   note: "проверим потенциал и характер" },
  { id: "junior", label: "До года",        level: "junior", note: "база + рабочие ситуации" },
  { id: "mid",    label: "1–3 года",       level: "pro",    note: "профессиональные ситуации" },
  { id: "senior", label: "Больше 3 лет",   level: "pro",    note: "профессиональные ситуации, планка выше" },
];
const PLACES = ["Ресторан", "Кафе", "Бар", "Фастфуд", "Другое"];
const AGES = ["До 18", "18–25", "26–35", "36+"];
const SELF_BANDS = [
  { id: 0, label: "Меньше половины", min: 0,  max: 49 },
  { id: 1, label: "Половина–70%",    min: 50, max: 70 },
  { id: 2, label: "70–85%",          min: 71, max: 85 },
  { id: 3, label: "Почти всё",       min: 86, max: 100 },
];

function loadResults() {
  try { const v = JSON.parse(localStorage.getItem(STORE_KEY)); return Array.isArray(v) ? v : []; }
  catch (e) { return []; }
}
function saveResults(list) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(0, 50))); } catch (e) {}
}

// Вопросы из «своих» уроков ресторана для выбранной роли теста
function customPool(customLessons, testRole) {
  const out = [];
  (customLessons || []).forEach(c => {
    if (!testRole.customRoles.includes(c.role)) return;
    (Array.isArray(c.questions) ? c.questions : []).forEach(q => {
      if (q && q.q && Array.isArray(q.options) && typeof q.correct === "number")
        out.push({ scene: null, text: q.q, options: q.options, correct: q.correct,
          topic: "⭐ " + ((c.module || c.title || "Регламент ресторана").trim() || "Регламент ресторана") });
    });
  });
  return out;
}

// ── Сборка адаптивного теста ──
// none:   12 вопросов, только base — мерим здравый смысл и характер;
// junior: 15 вопросов, примерно пополам base и pro;
// pro:    15 вопросов, в основном pro.
function buildTest(roleId, level, customQs = []) {
  const bank = (CANDIDATE_QUESTIONS[roleId] || []).filter(q => q && Array.isArray(q.options));
  const base = shuffleArray(bank.filter(q => q.level === "base"));
  const pro = shuffleArray(bank.filter(q => q.level === "pro"));
  const total = level === "none" ? 12 : 15;
  let picked;
  if (level === "none") picked = base.slice(0, total);
  else if (level === "junior") {
    const nb = Math.min(7, base.length);
    picked = [...base.slice(0, nb), ...pro.slice(0, total - nb)];
  } else {
    const np = Math.min(12, pro.length);
    picked = [...pro.slice(0, np), ...base.slice(0, total - np)];
  }
  // регламент ресторана (если менеджер включил) занимает до MAX_CUSTOM_Q слотов
  const nCust = Math.min(MAX_CUSTOM_Q, customQs.length);
  if (nCust > 0) picked = [...shuffleArray(customQs).slice(0, nCust), ...picked.slice(0, Math.max(0, total - nCust))];
  // перемешиваем вопросы и варианты внутри каждого (для order — с пересчётом эталона)
  return shuffleArray(picked).slice(0, total).map(q => {
    const order = shuffleArray(q.options.map((_, i) => i));
    const opts = order.map(i => q.options[i]);
    if (q.type === "order") {
      return { type: "order", scene: q.scene || null, text: q.text, topic: q.comp,
        options: opts, order: q.order.map(oi => order.indexOf(oi)) };
    }
    return { scene: q.scene || null, text: q.text, topic: q.comp || q.topic || "Общие стандарты",
      options: opts, correct: order.indexOf(q.correct) };
  });
}

// ── Вердикты: у новичка меряем потенциал, у опытного — профессионализм ──
function verdictOf(pct, level) {
  if (level === "none") {
    if (pct >= 75) return { label: "Сильный потенциал", color: GREEN,
      note: "Опыта нет, но голова сервисная: здравый смысл, честность и отношение на месте. Стандартам такой человек обучится быстро." };
    if (pct >= 50) return { label: "Есть задатки", color: GOLD_SOFT,
      note: "Часть инстинктов верная, часть придётся ставить. Смотри на мотивацию: при желании учиться — рабочий вариант." };
    return { label: "Пока не про сервис", color: RED,
      note: "Ответы расходятся с самой сутью гостеприимства. Если брать — только с плотным наставничеством и испытательным сроком." };
  }
  if (pct >= 80) return { label: "Уверенный профессионал", color: GREEN,
    note: "Кандидат мыслит как человек из индустрии. На собеседовании можно говорить о личности, мотивации и условиях." };
  if (pct >= 55) return { label: "Крепкая база", color: GOLD_SOFT,
    note: "Опыт виден, но есть провисания — темы ниже. Уточни их в разговоре: возможно, просто другие стандарты на прошлом месте." };
  return { label: "Опыт не подтверждается", color: RED,
    note: "Заявленный стаж не бьётся с ответами. Стоит аккуратно расспросить, чем человек реально занимался на прошлых местах." };
}

// ── Калибровка самооценки ──
function calibrationOf(selfBand, pct) {
  if (selfBand == null) return null;
  const band = SELF_BANDS.find(b => pct >= b.min && pct <= b.max) || SELF_BANDS[0];
  if (selfBand === band.id) return { label: "реалистичная", color: GREEN,
    note: "Кандидат трезво оценивает свои знания — хороший признак." };
  if (selfBand > band.id) return { label: "завышенная", color: selfBand - band.id > 1 ? RED : GOLD_SOFT,
    note: "Кандидат считает, что знает больше, чем показал. Проверь в разговоре, как он воспринимает обратную связь." };
  return { label: "заниженная", color: GOLD_SOFT,
    note: "Кандидат недооценивает себя — возможно, волнуется или скромничает. Часто это лечится поддержкой." };
}

// ── Таймер-полоска на вопрос ──
function QTimer({ seconds, onExpire }) {
  const [left, setLeft] = React.useState(seconds);
  const expired = React.useRef(false);
  React.useEffect(() => {
    if (left <= 0) { if (!expired.current) { expired.current = true; onExpire(); } return; }
    const t = setTimeout(() => setLeft(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [left, onExpire]);
  const pct = Math.max(0, (left / seconds) * 100);
  const color = pct > 50 ? GREEN : pct > 22 ? GOLD_SOFT : RED;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
        <span style={{ color, fontSize: 11, fontFamily: "monospace", fontWeight: "bold" }}>{left} сек</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: "rgba(160,120,60,0.18)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: pct + "%", background: color, borderRadius: 2, transition: "width 1s linear, background 0.3s ease" }} />
      </div>
    </div>
  );
}

export function CandidateScreen({ T, a11y, onBack, customLessons }) {
  // intro | setup | profile | handoff | test | selfcheck | gate | result
  const [phase, setPhase] = React.useState("intro");
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState(TEST_ROLES[0]);
  const [exp, setExp] = React.useState(null);       // элемент EXPERIENCE
  const [place, setPlace] = React.useState(null);   // где был опыт
  const [age, setAge] = React.useState(null);       // возрастной диапазон
  const [useCustom, setUseCustom] = React.useState(false);
  const [test, setTest] = React.useState([]);
  const [qIdx, setQIdx] = React.useState(0);
  const [chosen, setChosen] = React.useState(null);
  const [ordSeq, setOrdSeq] = React.useState([]);   // выбор для вопроса-приоритета
  const [answers, setAnswers] = React.useState([]);
  const [selfBand, setSelfBand] = React.useState(null);
  const [results, setResults] = React.useState(loadResults);
  const [openedResult, setOpenedResult] = React.useState(null);
  const [confirmLeave, setConfirmLeave] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const lock = React.useRef(false);

  const gold = a11y ? "#6B4E1A" : GOLD;
  const sub = T.modSub.color;

  // Фирменная «стеклянная» плашка — те же токены, что у карточек уроков (обе темы)
  const glass = {
    background: T.lessGlass?.bg || "linear-gradient(155deg, #382810 0%, #281C08 100%)",
    border: T.lessGlass?.border || "1px solid rgba(150,112,42,0.38)",
    borderTop: T.lessGlass?.borderTop || "1px solid rgba(215,170,68,0.46)",
    boxShadow: T.lessGlass?.shadow || "0 6px 22px rgba(0,0,0,0.50), 0 2px 0 rgba(200,160,60,0.18) inset, 0 -2px 4px rgba(0,0,0,0.38) inset",
    backdropFilter: T.lessGlass?.blur || "none",
    WebkitBackdropFilter: T.lessGlass?.blur || "none",
    borderRadius: 18, padding: "16px 16px",
  };
  const goldBtn = {
    width: "100%", padding: "14px 16px", borderRadius: 14, border: "none", cursor: "pointer",
    fontFamily: "Georgia, serif", fontSize: 15, fontWeight: "bold", color: "#fff",
    background: "linear-gradient(135deg, #C8A96E 0%, #8B6A30 100%)", boxShadow: "0 3px 12px rgba(200,160,80,0.3)",
  };
  const ghostBtn = {
    width: "100%", padding: "13px 16px", borderRadius: 14, cursor: "pointer",
    border: "1px solid rgba(200,160,80,0.35)", background: "transparent",
    fontFamily: "Georgia, serif", fontSize: 14, fontWeight: "bold", color: gold,
  };

  const level = exp ? exp.level : "pro";
  const score = answers.reduce((s, a) => s + a.pts, 0);
  const maxScore = answers.length;
  const pct = maxScore ? Math.round((score / maxScore) * 100) : 0;
  const topics = React.useMemo(() => {
    const map = {};
    answers.forEach(a => {
      if (!map[a.topic]) map[a.topic] = { topic: a.topic, ok: 0, n: 0 };
      map[a.topic].n += 1;
      map[a.topic].ok += a.pts;
    });
    return Object.values(map).map(t => ({ ...t, ok: Math.round(t.ok * 10) / 10 }))
      .sort((x, y) => (x.ok / x.n) - (y.ok / y.n));
  }, [answers]);

  const customQs = React.useMemo(() => customPool(customLessons, role), [customLessons, role]);

  const startSetup = () => {
    vibrate("light");
    setName(""); setRole(TEST_ROLES[0]); setExp(null); setPlace(null); setAge(null);
    setUseCustom(false); setSelfBand(null); setSaved(false);
    setPhase("setup");
  };
  const startTest = () => {
    vibrate("light");
    setTest(buildTest(role.id, level, useCustom ? customQs : []));
    setQIdx(0); setChosen(null); setOrdSeq([]); setAnswers([]);
    lock.current = false;
    setPhase("test");
  };

  const advance = React.useCallback((rec) => {
    setAnswers(a => [...a, rec]);
    setChosen(null); setOrdSeq([]);
    lock.current = false;
    setQIdx(i => {
      if (i + 1 >= test.length) { setPhase("selfcheck"); return i; }
      return i + 1;
    });
  }, [test.length]);

  // обычный вопрос: pts 1/0
  const answer = React.useCallback((idx) => {
    if (lock.current) return;
    lock.current = true;
    vibrate("light");
    setChosen(idx);
    const q = test[qIdx];
    const rec = { pts: idx !== null && idx === q.correct ? 1 : 0, topic: q.topic };
    setTimeout(() => advance(rec), 260);
  }, [test, qIdx, advance]);

  // вопрос-приоритет: тапы по порядку; очки — за точность последовательности
  const tapOrder = (idx) => {
    if (lock.current) return;
    if (ordSeq.includes(idx)) return;
    vibrate("light");
    const next = [...ordSeq, idx];
    setOrdSeq(next);
    if (next.length === test[qIdx].options.length) {
      lock.current = true;
      const q = test[qIdx];
      const matches = next.filter((v, i) => v === q.order[i]).length;
      // точный порядок — 1; верное первое действие и половина позиций — 0.5; иначе 0
      const pts = matches === q.order.length ? 1 : (next[0] === q.order[0] && matches >= 2 ? 0.5 : 0);
      setTimeout(() => advance({ pts, topic: q.topic }), 420);
    }
  };

  const onExpire = React.useCallback(() => {
    const q = test[qIdx];
    if (!q) return;
    if (q.type === "order") {
      if (!lock.current) { lock.current = true; advance({ pts: 0, topic: q.topic }); }
    } else answer(null);
  }, [test, qIdx, answer, advance]);

  const openResult = () => {
    vibrate("light");
    if (!saved) {
      const rec = {
        id: Date.now().toString(36),
        name: name.trim(), roleLabel: role.label, date: new Date().toISOString(),
        expLabel: exp ? exp.label : "", place: place || "", age: age || "",
        score: Math.round(score * 10) / 10, total: test.length, pct,
        level, selfBand,
        topics: topics.map(t => ({ topic: t.topic, ok: t.ok, n: t.n })),
      };
      const next = [rec, ...results];
      setResults(next); saveResults(next); setSaved(true);
    }
    setPhase("result");
  };

  const removeResult = (id) => {
    const next = results.filter(r => r.id !== id);
    setResults(next); saveResults(next);
    if (openedResult === id) setOpenedResult(null);
  };

  const backFromHeader = () => {
    if (phase === "test" || phase === "selfcheck" || phase === "gate") { setConfirmLeave(true); return; }
    if (phase !== "intro") { setPhase("intro"); return; }
    onBack();
  };

  const dateFmt = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) + ", " +
             d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    } catch (e) { return ""; }
  };
  const topicColor = (t) => t.ok >= t.n ? GREEN : t.ok === 0 ? RED : GOLD_SOFT;

  const q = test[qIdx];

  return (
    <div style={T.screen} className="sa-screen">
      <div style={T.lessHead}>
        <button style={T.backBtn2} onClick={backFromHeader}>‹</button>
        <div style={T.lessHeadTitle}>Собеседование</div>
      </div>
      <div style={{ ...T.lessBody, flex: 1, overflowY: "auto", padding: "14px 16px 44px" }}>

        {confirmLeave && (
          <div style={{ ...glass, marginBottom: 14, borderColor: RED }}>
            <div style={{ ...T.bold, marginBottom: 6 }}>Прервать собеседование?</div>
            <div style={{ color: sub, fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>Ответы кандидата не сохранятся.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="sa-btn" style={{ ...ghostBtn, flex: 1 }} onClick={() => setConfirmLeave(false)}>Продолжить</button>
              <button className="sa-btn" style={{ ...ghostBtn, flex: 1, color: RED, borderColor: RED }}
                onClick={() => { setConfirmLeave(false); setPhase("intro"); }}>Прервать</button>
            </div>
          </div>
        )}

        {/* ── ГЛАВНАЯ ── */}
        {phase === "intro" && (
          <>
            <div style={{ ...glass, marginBottom: 16 }}>
              <div style={{ marginBottom: 8, display: "flex" }}>{MOD_SVG["🤝"](gold, 26)}</div>
              <div style={{ ...T.bold, fontSize: 16, marginBottom: 6 }}>Собеседование в приложении</div>
              <div style={{ color: sub, fontSize: 13.5, lineHeight: 1.6 }}>
                Короткая анкета опыта — и тест подстраивается под кандидата: новичка проверяем на здравый смысл
                и характер, опытного — на профессию. Внутри — рабочие ситуации, вопросы-приоритеты, которые
                не угадать, и самооценка в конце. Правильные ответы кандидату не показываются;
                результат открываешь ты, когда телефон вернётся.
              </div>
            </div>
            <button className="sa-btn" style={goldBtn} onClick={startSetup}>Начать собеседование</button>

            {results.length > 0 && (
              <>
                <div style={{ color: "#9A8C74", fontSize: 10.5, letterSpacing: 2, fontFamily: "monospace", margin: "22px 2px 10px" }}>
                  ИСТОРИЯ · {results.length}
                </div>
                {results.map(r => {
                  const v = verdictOf(r.pct, r.level || "pro");
                  const open = openedResult === r.id;
                  const cal = calibrationOf(r.selfBand, r.pct);
                  return (
                    <div key={r.id} style={{ ...glass, padding: "13px 14px", marginBottom: 8, cursor: "pointer" }}
                      onClick={() => { vibrate("light"); setOpenedResult(open ? null : r.id); }}
                      {...onActivate(() => setOpenedResult(open ? null : r.id))}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 40, textAlign: "center", color: v.color, fontFamily: "Georgia, serif", fontWeight: "bold", fontSize: 16 }}>{r.pct}%</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ ...T.bold, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                          <div style={{ color: sub, fontSize: 11.5 }}>{r.roleLabel} · {r.expLabel || "?"} · {dateFmt(r.date)}</div>
                        </div>
                        <div style={{ color: v.color, fontSize: 11.5, fontWeight: "bold", textAlign: "right", maxWidth: 110 }}>{v.label}</div>
                      </div>
                      {open && (
                        <div style={{ marginTop: 12, borderTop: "1px solid rgba(200,160,80,0.2)", paddingTop: 10 }}>
                          <div style={{ color: sub, fontSize: 12, marginBottom: 8 }}>
                            {r.score} из {r.total} · опыт: {r.expLabel || "не указан"}{r.place ? ` (${r.place})` : ""}{r.age ? ` · ${r.age}` : ""}
                            {cal ? <> · самооценка: <b style={{ color: cal.color }}>{cal.label}</b></> : null}
                          </div>
                          {(r.topics || []).map((t, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, padding: "3px 0" }}>
                              <span style={{ color: T.modTitle.color, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.topic}</span>
                              <span style={{ color: topicColor(t), fontFamily: "monospace", flexShrink: 0 }}>{t.ok}/{t.n}</span>
                            </div>
                          ))}
                          <button className="sa-btn" style={{ ...ghostBtn, marginTop: 10, color: RED, borderColor: "rgba(224,120,120,0.4)" }}
                            onClick={(e) => { e.stopPropagation(); removeResult(r.id); }}>Удалить запись</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}

        {/* ── ИМЯ И РОЛЬ ── */}
        {phase === "setup" && (
          <>
            <div style={{ color: sub, fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>Кого собеседуем?</div>
            <input
              style={{ width: "100%", boxSizing: "border-box", padding: "13px 14px", borderRadius: 12, marginBottom: 16,
                border: "1px solid rgba(200,160,80,0.35)", background: a11y ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.2)",
                color: T.modTitle.color, fontFamily: "Georgia, serif", fontSize: 15, outline: "none" }}
              placeholder="Имя кандидата" value={name} maxLength={40}
              onChange={e => setName(e.target.value)} />
            {TEST_ROLES.map(rl => (
              <div key={rl.id} className="sa-btn" onClick={() => { vibrate("light"); setRole(rl); }} {...onActivate(() => setRole(rl))}
                style={{ ...glass, padding: "13px 14px", marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                  borderColor: role.id === rl.id ? gold : "rgba(200,160,80,0.25)",
                  boxShadow: role.id === rl.id ? `0 0 0 1px ${gold}` : "none" }}>
                <span style={{ display: "flex", flexShrink: 0 }}>{ROLE_ICO[rl.id](role.id === rl.id ? gold : sub)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ ...T.bold, fontSize: 14.5 }}>{rl.label}</div>
                  <div style={{ color: sub, fontSize: 12 }}>{rl.desc}</div>
                </div>
                <span style={{ width: 18, height: 18, borderRadius: 10, flexShrink: 0,
                  border: `2px solid ${role.id === rl.id ? gold : "rgba(200,160,80,0.4)"}`,
                  background: role.id === rl.id ? gold : "transparent" }} />
              </div>
            ))}
            {customQs.length > 0 && (
              <div className="sa-btn" onClick={() => { vibrate("light"); setUseCustom(v => !v); }} {...onActivate(() => setUseCustom(v => !v))}
                style={{ ...glass, padding: "13px 14px", marginTop: 4, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ display: "flex", flexShrink: 0 }}>{UI_SVG.star(gold, 18)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ ...T.bold, fontSize: 13.5 }}>Вопросы твоего ресторана</div>
                  <div style={{ color: sub, fontSize: 11.5, lineHeight: 1.45 }}>
                    Доступно {customQs.length} — в тест войдёт до {MAX_CUSTOM_Q}. Включай, если кандидат из твоей сети и должен знать регламент.
                  </div>
                </div>
                <span style={{ width: 40, height: 23, borderRadius: 12, flexShrink: 0, position: "relative",
                  background: useCustom ? gold : "rgba(160,120,60,0.3)", transition: "background 0.25s ease" }}>
                  <span style={{ position: "absolute", top: 2.5, left: useCustom ? 19.5 : 2.5, width: 18, height: 18,
                    borderRadius: 10, background: "#fff", transition: "left 0.25s ease" }} />
                </span>
              </div>
            )}
            <button className="sa-btn" style={{ ...goldBtn, marginTop: 12, opacity: name.trim().length < 2 ? 0.5 : 1 }}
              onClick={() => { if (name.trim().length >= 2) { vibrate("light"); setPhase("profile"); } }}>
              Дальше — анкета опыта
            </button>
          </>
        )}

        {/* ── АНКЕТА ОПЫТА ── */}
        {phase === "profile" && (
          <>
            <div style={{ color: sub, fontSize: 13, lineHeight: 1.55, marginBottom: 14 }}>
              Пара вопросов о кандидате — от этого зависит, какой тест он получит. Можно заполнить вместе с ним.
            </div>
            <div style={{ ...T.bold, fontSize: 13.5, marginBottom: 8 }}>Опыт в сфере гостеприимства и гастрономии</div>
            {EXPERIENCE.map(x => (
              <div key={x.id} className="sa-btn" onClick={() => { vibrate("light"); setExp(x); }} {...onActivate(() => setExp(x))}
                style={{ ...glass, padding: "12px 14px", marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                  borderColor: exp?.id === x.id ? gold : "rgba(200,160,80,0.25)",
                  boxShadow: exp?.id === x.id ? `0 0 0 1px ${gold}` : "none" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ ...T.bold, fontSize: 14 }}>{x.label}</div>
                  <div style={{ color: sub, fontSize: 11.5 }}>{x.note}</div>
                </div>
                <span style={{ width: 18, height: 18, borderRadius: 10, flexShrink: 0,
                  border: `2px solid ${exp?.id === x.id ? gold : "rgba(200,160,80,0.4)"}`,
                  background: exp?.id === x.id ? gold : "transparent" }} />
              </div>
            ))}
            {exp && exp.id !== "none" && (
              <>
                <div style={{ ...T.bold, fontSize: 13.5, margin: "14px 0 8px" }}>Где был опыт <span style={{ color: sub, fontWeight: "normal" }}>(необязательно)</span></div>
                <LiquidSegment a11y={a11y} equal={false} scroll accent={gold} muted={sub}
                  itemStyle={{ fontSize: 12.5, padding: "8px 13px" }}
                  items={[{ id: "__none", label: "Не указано" }, ...PLACES.map(p => ({ id: p, label: p }))]}
                  activeId={place || "__none"}
                  onSelect={(id) => { vibrate("light"); setPlace(id === "__none" ? null : id); }} />
              </>
            )}
            <div style={{ ...T.bold, fontSize: 13.5, margin: "14px 0 8px" }}>Возраст <span style={{ color: sub, fontWeight: "normal" }}>(необязательно)</span></div>
            <LiquidSegment a11y={a11y} equal accent={gold} muted={sub}
              itemStyle={{ fontSize: 12.5, padding: "8px 4px" }}
              items={[{ id: "__none", label: "—" }, ...AGES.map(a => ({ id: a, label: a }))]}
              activeId={age || "__none"}
              onSelect={(id) => { vibrate("light"); setAge(id === "__none" ? null : id); }} />
            <button className="sa-btn" style={{ ...goldBtn, marginTop: 18, opacity: exp ? 1 : 0.5 }}
              onClick={() => { if (exp) { vibrate("light"); setPhase("handoff"); } }}>
              Дальше
            </button>
          </>
        )}

        {/* ── ПЕРЕДАЧА ТЕЛЕФОНА ── */}
        {phase === "handoff" && (
          <>
            <div style={{ ...glass, textAlign: "center", padding: "30px 20px", marginBottom: 16 }}>
              <div style={{ marginBottom: 10, display: "flex", justifyContent: "center" }}>{MOD_SVG["🤲"](gold, 30)}</div>
              <div style={{ ...T.bold, fontSize: 16, marginBottom: 8 }}>Передайте телефон кандидату</div>
              <div style={{ color: sub, fontSize: 13.5, lineHeight: 1.65 }}>
                <b style={{ color: gold }}>{name.trim()}</b>, вам {level === "none" ? 12 : 15} рабочих ситуаций — роль «{role.label}».
                В каждой всё описано полностью: читайте спокойно, специальных знаний не нужно.
                На вопрос даётся до {SECONDS_PER_Q} секунд. В паре вопросов нужно будет расставить
                действия по порядку — просто нажимайте их в той очерёдности, как поступили бы.
                Отвечайте честно, как в жизни: здесь проверяется мышление, а не зубрёжка.
              </div>
            </div>
            <button className="sa-btn" style={goldBtn} onClick={startTest}>Я готов(а) — начать</button>
          </>
        )}

        {/* ── ТЕСТ ── */}
        {phase === "test" && q && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: sub, fontSize: 12, fontFamily: "monospace" }}>ВОПРОС {qIdx + 1} / {test.length}</span>
              <span style={{ color: sub, fontSize: 12 }}>{name.trim()}</span>
            </div>
            <div style={{ height: 3, borderRadius: 2, background: "rgba(160,120,60,0.18)", marginBottom: 14, overflow: "hidden" }}>
              <div style={{ height: "100%", width: ((qIdx) / test.length) * 100 + "%", background: gold, transition: "width 0.3s ease" }} />
            </div>
            <QTimer key={qIdx} seconds={SECONDS_PER_Q} onExpire={onExpire} />
            {q.scene && (
              <div style={{ ...glass, marginBottom: 12, fontSize: 13.5, lineHeight: 1.6, color: T.modTitle.color }}>
                {q.scene}
              </div>
            )}
            <div style={{ ...T.bold, fontSize: 15.5, lineHeight: 1.45, marginBottom: 14 }}>{q.text}</div>

            {q.type === "order" ? (
              <>
                {q.options.map((opt, i) => {
                  const pos = ordSeq.indexOf(i);
                  return (
                    <button key={i} className="sa-btn" onClick={() => tapOrder(i)}
                      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", marginBottom: 8, padding: "13px 14px",
                        borderRadius: 12, cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 14, lineHeight: 1.45,
                        color: T.modTitle.color,
                        border: `1px solid ${pos >= 0 ? gold : "rgba(200,160,80,0.3)"}`,
                        background: pos >= 0 ? "rgba(200,169,110,0.18)" : (a11y ? "rgba(255,255,255,0.45)" : "rgba(200,169,110,0.05)"),
                        transition: "background 0.15s ease, border-color 0.15s ease" }}>
                      <span style={{ width: 26, height: 26, borderRadius: 13, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "Georgia, serif", fontWeight: "bold", fontSize: 13,
                        border: `1.5px solid ${pos >= 0 ? gold : "rgba(200,160,80,0.4)"}`,
                        background: pos >= 0 ? gold : "transparent", color: pos >= 0 ? "#fff" : sub }}>
                        {pos >= 0 ? pos + 1 : ""}
                      </span>
                      <span style={{ flex: 1 }}>{opt}</span>
                    </button>
                  );
                })}
                {ordSeq.length > 0 && ordSeq.length < q.options.length && (
                  <button className="sa-btn" style={{ ...ghostBtn, marginTop: 4 }} onClick={() => { vibrate("light"); setOrdSeq([]); }}>
                    Сбросить порядок
                  </button>
                )}
              </>
            ) : (
              q.options.map((opt, i) => (
                <button key={i} className="sa-btn" onClick={() => answer(i)}
                  style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 8, padding: "13px 14px",
                    borderRadius: 12, cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 14, lineHeight: 1.45,
                    color: T.modTitle.color,
                    border: `1px solid ${chosen === i ? gold : "rgba(200,160,80,0.3)"}`,
                    background: chosen === i ? "rgba(200,169,110,0.18)" : (a11y ? "rgba(255,255,255,0.45)" : "rgba(200,169,110,0.05)"),
                    transition: "background 0.15s ease, border-color 0.15s ease" }}>
                  {opt}
                </button>
              ))
            )}
          </>
        )}

        {/* ── САМООЦЕНКА ── */}
        {phase === "selfcheck" && (
          <>
            <div style={{ ...glass, marginBottom: 14 }}>
              <div style={{ marginBottom: 8, display: "flex" }}>{UI_SVG.target(gold, 24)}</div>
              <div style={{ ...T.bold, fontSize: 15.5, marginBottom: 6 }}>Последний вопрос — о себе</div>
              <div style={{ color: sub, fontSize: 13.5, lineHeight: 1.6 }}>
                {name.trim()}, как вам кажется, на какую часть вопросов вы ответили верно? Здесь нет правильного ответа — отвечайте честно.
              </div>
            </div>
            {SELF_BANDS.map(b => (
              <button key={b.id} className="sa-btn" onClick={() => { vibrate("light"); setSelfBand(b.id); setTimeout(() => setPhase("gate"), 260); }}
                style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 8, padding: "13px 14px",
                  borderRadius: 12, cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 14,
                  color: T.modTitle.color,
                  border: `1px solid ${selfBand === b.id ? gold : "rgba(200,160,80,0.3)"}`,
                  background: selfBand === b.id ? "rgba(200,169,110,0.18)" : (a11y ? "rgba(255,255,255,0.45)" : "rgba(200,169,110,0.05)") }}>
                {b.label}
              </button>
            ))}
          </>
        )}

        {/* ── ШЛЮЗ ── */}
        {phase === "gate" && (
          <>
            <div style={{ ...glass, textAlign: "center", padding: "36px 20px", marginBottom: 16 }}>
              <div style={{ marginBottom: 10, display: "flex", justifyContent: "center" }}>{MOD_SVG["🤝"](gold, 30)}</div>
              <div style={{ ...T.bold, fontSize: 16, marginBottom: 8 }}>Готово — спасибо!</div>
              <div style={{ color: sub, fontSize: 13.5, lineHeight: 1.6 }}>
                {name.trim()}, верните телефон менеджеру, пожалуйста.
              </div>
            </div>
            <button className="sa-btn" style={ghostBtn} onClick={openResult}>Я менеджер — показать результат</button>
          </>
        )}

        {/* ── РЕЗУЛЬТАТ ── */}
        {phase === "result" && (() => {
          const v = verdictOf(pct, level);
          const cal = calibrationOf(selfBand, pct);
          return (
            <>
              <div style={{ ...glass, textAlign: "center", padding: "26px 20px", marginBottom: 14 }}>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 40, fontWeight: "bold", color: v.color }}>{pct}%</div>
                <div style={{ color: sub, fontSize: 13, marginBottom: 8 }}>
                  {name.trim()} · {role.label} · опыт: {exp ? exp.label.toLowerCase() : "?"}{place ? ` (${place.toLowerCase()})` : ""}{age ? ` · ${age}` : ""}
                </div>
                <div style={{ color: v.color, fontFamily: "Georgia, serif", fontWeight: "bold", fontSize: 16, marginBottom: 8 }}>{v.label}</div>
                <div style={{ color: sub, fontSize: 13, lineHeight: 1.6 }}>{v.note}</div>
              </div>

              {cal && (
                <div style={{ ...glass, marginBottom: 14, display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ display: "flex", flexShrink: 0 }}>{UI_SVG.target(gold, 20)}</span>
                  <div>
                    <div style={{ ...T.bold, fontSize: 13.5, marginBottom: 3 }}>
                      Самооценка: <span style={{ color: cal.color }}>{cal.label}</span>
                    </div>
                    <div style={{ color: sub, fontSize: 12.5, lineHeight: 1.55 }}>{cal.note}</div>
                  </div>
                </div>
              )}

              {topics.length > 0 && (
                <div style={{ ...glass, marginBottom: 14 }}>
                  <div style={{ ...T.bold, fontSize: 13.5, marginBottom: 10 }}>По компетенциям — от слабых к сильным</div>
                  {topics.map((t, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
                      <span style={{ flex: 1, minWidth: 0, color: T.modTitle.color, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.topic}</span>
                      <div style={{ width: 70, height: 5, borderRadius: 3, background: "rgba(160,120,60,0.18)", overflow: "hidden", flexShrink: 0 }}>
                        <div style={{ height: "100%", width: Math.min(100, (t.ok / t.n) * 100) + "%", background: topicColor(t) }} />
                      </div>
                      <span style={{ color: sub, fontFamily: "monospace", fontSize: 12, width: 34, textAlign: "right", flexShrink: 0 }}>{t.ok}/{t.n}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ color: sub, fontSize: 12, lineHeight: 1.55, marginBottom: 14 }}>
                Результат сохранён на этом устройстве. Помни: тест меряет мышление, а человека — только разговор.
              </div>
              <button className="sa-btn" style={{ ...goldBtn, marginBottom: 8 }} onClick={() => { vibrate("light"); setPhase("intro"); }}>К списку кандидатов</button>
              <button className="sa-btn" style={ghostBtn} onClick={startSetup}>Собеседовать ещё одного</button>
            </>
          );
        })()}
      </div>
    </div>
  );
}
