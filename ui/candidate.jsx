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
import { GOLD, GREEN, RED, GOLD_SOFT, RADIUS } from "./tokens";
import { shuffleArray, vibrate, onActivate } from "../lib/utils";
import { rpc, saToken, SUPABASE_URL, SUPABASE_KEY } from "../api/supabase";
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
  const color = pct > 60 ? GREEN : pct > 30 ? GOLD_SOFT : RED;
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

export function CandidateScreen({ T, a11y, onBack, customLessons, profile }) {
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
  const restaurant = profile?.restaurant || null;

  // ── Облако: история собеседований хранится на сервере в рамках ресторана ──
  // (переживает смену телефона; видна всем админам ресторана). При отсутствии
  // сети всё работает локально, а несинхронизированные записи дозаливаются.
  const uploadResult = React.useCallback((rec) => {
    const t = saToken();
    if (!t || !restaurant) return;
    rpc("candidate_save", { p_token: t, p_restaurant: restaurant, p_result: JSON.stringify(rec) })
      .then(d => {
        if (!d || !d.ok) return;
        setResults(prev => {
          const next = prev.map(r => r.id === rec.id ? { ...r, srvId: d.id } : r);
          saveResults(next);
          return next;
        });
      })
      .catch(() => {});
  }, [restaurant]);

  React.useEffect(() => {
    const t = saToken();
    if (!t || !restaurant) return;
    rpc("candidate_list", { p_token: t, p_restaurant: restaurant })
      .then(d => {
        if (!d || !d.ok || !Array.isArray(d.items)) return;
        const cloud = d.items.map(row => ({
          ...(row.payload || {}),
          srvId: row.id,
          by: row.created_by || "",
          date: (row.payload && row.payload.date) || row.created_at,
        }));
        const cloudIds = new Set(cloud.map(r => r.id).filter(Boolean));
        setResults(prev => {
          // локальные, ещё не долетевшие до сервера — оставляем и дозаливаем
          const pending = prev.filter(r => !r.srvId && !cloudIds.has(r.id));
          const merged = [...cloud, ...pending]
            .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
            .slice(0, 100);
          saveResults(merged);
          pending.forEach(uploadResult);
          return merged;
        });
      })
      .catch(() => {});
  }, [restaurant, uploadResult]);
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
    borderRadius: RADIUS.lg, padding: "16px 16px",
  };
  // Кнопки, поле ввода и «выбранный вариант» — те же, что в разделе «Команда»
  const goldBtn = {
    padding:"14px", borderRadius: RADIUS.md, border:"none", width:"100%",
    fontSize:16, fontFamily:"Georgia, serif", fontWeight:"bold", cursor:"pointer",
    color:"#fff", background:"linear-gradient(135deg, #C8A96E 0%, #8B6A30 100%)",
    boxShadow:"0 4px 18px rgba(200,160,80,0.25)",
  };
  const ghostBtn = {
    padding:"13px", borderRadius: RADIUS.md, width:"100%", cursor:"pointer",
    border: a11y ? "1px solid rgba(139,106,48,0.55)" : "1px solid rgba(200,160,80,0.4)",
    background:"transparent",
    color: a11y ? "#8B6A30" : GOLD, fontSize:14, fontFamily:"Georgia, serif",
  };
  const inputStyle = {
    width:"100%", padding:"13px 14px", borderRadius: RADIUS.sm, fontSize:15,
    fontFamily:"Georgia, serif",
    background: a11y ? "rgba(255,255,255,0.7)" : "rgba(20,14,6,0.5)",
    color: a11y ? "#3A2E1C" : "#F0E8D8",
    border: a11y ? "1px solid rgba(160,120,60,0.45)" : "1px solid rgba(200,160,80,0.35)",
    outline:"none", boxSizing:"border-box",
  };
  const optSel = {
    border: a11y ? "1.5px solid #8B6A30" : "1px solid #C8A96E",
    background: a11y ? "rgba(139,106,48,0.14)" : "rgba(200,169,110,0.18)",
  };
  // Подпись секции — фирменный monospace-капс приложения
  const secLabel = { ...T.secTitle, padding: 0, margin: "0 2px 10px" };
  const optNote = { textTransform: "none", letterSpacing: 0, fontFamily: "Georgia, serif" };

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

  // ── AI-интервью (бета): свободные ответы, уточняющие вопросы, вердикт ──
  const [aiMsgs, setAiMsgs] = React.useState([]);
  const [aiInput, setAiInput] = React.useState("");
  const [aiBusy, setAiBusy] = React.useState(false);
  const [aiErr, setAiErr] = React.useState(null);
  const [aiVerdict, setAiVerdict] = React.useState(null);
  const aiListRef = React.useRef(null);
  const aiAnswered = aiMsgs.filter(m => m.role === "user").length;

  React.useEffect(() => {
    const el = aiListRef.current;
    if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, [aiMsgs, aiBusy]);

  const callHr = React.useCallback((mode, msgs) =>
    fetch(`${SUPABASE_URL}/functions/v1/ai-hr`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY },
      body: JSON.stringify({
        token: saToken(), mode, role: role?.id,
        candidate: { name: name.trim(), expLabel: exp?.label || "", place: place || "" },
        messages: msgs.map(m => ({ role: m.role, content: m.content })),
      }),
    }).then(r => r.json()), [role, name, exp, place]);

  const aiTurn = React.useCallback((msgs) => {
    setAiBusy(true); setAiErr(null);
    callHr("chat", msgs)
      .then(d => {
        if (d?.ok && d.reply) setAiMsgs([...msgs, { role: "assistant", content: d.reply }]);
        else setAiErr(d?.error === "not_configured"
          ? "AI-интервью не подключено на сервере (функция ai-hr). Пока можно пройти обычный тест."
          : d?.error === "rate_limit" ? "Дневной лимит ИИ исчерпан — попробуйте позже или пройдите обычный тест."
          : "ИИ временно недоступен. Попробуйте ещё раз или пройдите обычный тест.");
      })
      .catch(() => setAiErr("Нет связи с сервером. Проверьте интернет."))
      .finally(() => setAiBusy(false));
  }, [callHr]);

  const startAi = () => {
    vibrate("light");
    setAiMsgs([]); setAiInput(""); setAiErr(null); setAiVerdict(null);
    setAnswers([]); setTest([]);
    setPhase("ai");
    aiTurn([]);
  };

  const aiSend = () => {
    const text = aiInput.trim();
    if (!text || aiBusy) return;
    vibrate("light");
    setAiInput("");
    aiTurn([...aiMsgs, { role: "user", content: text }]);
  };

  const finishAi = () => {
    if (aiBusy) return;
    vibrate("light");
    setAiBusy(true); setAiErr(null);
    callHr("assess", aiMsgs)
      .then(d => {
        if (!d?.ok || !d.scores) {
          setAiErr("Не удалось получить оценку. Попробуйте «Завершить» ещё раз.");
          return;
        }
        const entries = Object.entries(d.scores);
        const synth = entries.map(([topic, s]) => ({ pts: Math.max(0, Math.min(1, s / 100)), topic }));
        const avg = Math.round(entries.reduce((a, [, s]) => a + s, 0) / Math.max(1, entries.length));
        const rec = {
          id: Date.now().toString(36),
          name: name.trim(), roleLabel: role.label + " · AI-интервью", date: new Date().toISOString(),
          expLabel: exp ? exp.label : "", place: place || "", age: age || "",
          score: Math.round(synth.reduce((a, x) => a + x.pts, 0) * 10) / 10, total: entries.length, pct: avg,
          level, selfBand: null,
          topics: entries.map(([topic, s]) => ({ topic, ok: s / 100, n: 1 })),
          aiVerdict: d.verdict || "", aiStrengths: d.strengths || [], aiRisks: d.risks || [],
        };
        const next = [rec, ...results];
        setResults(next); saveResults(next); setSaved(true);
        uploadResult(rec);
        setAnswers(synth);
        setAiVerdict({ verdict: d.verdict, strengths: d.strengths, risks: d.risks });
        setPhase("result");
      })
      .catch(() => setAiErr("Нет связи с сервером. Попробуйте ещё раз."))
      .finally(() => setAiBusy(false));
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
      uploadResult(rec); // в облако — с тихим повтором при следующем открытии, если нет сети
    }
    setPhase("result");
  };

  const removeResult = (id) => {
    const rec = results.find(r => r.id === id);
    if (rec?.srvId && restaurant) {
      rpc("candidate_delete", { p_token: saToken(), p_restaurant: restaurant, p_id: rec.srvId }).catch(() => {});
    }
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
              <div style={{ ...T.bold, marginTop: 0, marginBottom: 6 }}>Собеседование в приложении</div>
              <div style={{ ...T.modSub, color: sub, lineHeight: 1.6 }}>
                Короткая анкета опыта — и тест подстраивается под кандидата: новичка проверяем на здравый смысл
                и характер, опытного — на профессию. Внутри — рабочие ситуации, вопросы-приоритеты, которые
                не угадать, и самооценка в конце. Правильные ответы кандидату не показываются;
                результат открываешь ты, когда телефон вернётся.
              </div>
            </div>
            <button className="sa-btn" style={goldBtn} onClick={startSetup}>Начать собеседование</button>

            {results.length > 0 && (
              <>
                <div style={{ ...secLabel, margin: "22px 2px 10px" }}>История · {results.length}</div>
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
                          <div style={{ ...T.bold, marginTop: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                          <div style={{ color: sub, fontSize: 11.5 }}>{r.roleLabel} · {r.expLabel || "?"} · {dateFmt(r.date)}</div>
                        </div>
                        <div style={{ color: v.color, fontSize: 11.5, fontWeight: "bold", textAlign: "right", maxWidth: 110 }}>{v.label}</div>
                      </div>
                      {open && (
                        <div style={{ marginTop: 12, borderTop: "1px solid rgba(200,160,80,0.2)", paddingTop: 10 }}>
                          <div style={{ color: sub, fontSize: 12, marginBottom: 8 }}>
                            {r.score} из {r.total} · опыт: {r.expLabel || "не указан"}{r.place ? ` (${r.place})` : ""}{r.age ? ` · ${r.age}` : ""}{r.by ? ` · провёл(а): ${r.by}` : ""}{r.srvId ? " · ☁" : ""}
                            {cal ? <> · самооценка: <b style={{ color: cal.color }}>{cal.label}</b></> : null}
                          </div>
                      {r.aiVerdict && (
                        <div style={{ ...T.modSub, color: sub, fontSize: 12, lineHeight: 1.55, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${gold}22` }}>
                          <b style={{ color: gold }}>ИИ:</b> {r.aiVerdict}
                        </div>
                      )}
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
            <div style={secLabel}>Кого собеседуем</div>
            <input
              style={{ ...inputStyle, marginBottom: 16 }}
              placeholder="Имя кандидата" value={name} maxLength={40}
              onChange={e => setName(e.target.value)} />
            {TEST_ROLES.map(rl => (
              <div key={rl.id} className="sa-btn" onClick={() => { vibrate("light"); setRole(rl); }} {...onActivate(() => setRole(rl))}
                style={{ ...glass, padding: "13px 14px", marginBottom: 8, cursor: "pointer", display: "flex",
                  alignItems: "center", gap: 12, position: "relative", overflow: "hidden",
                  ...(role.id === rl.id ? { border: a11y ? "1.5px solid #8B6A30" : "1px solid #C8A96E" } : {}) }}>
                {role.id === rl.id && <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: gold }} />}
                <span style={{ display: "flex", flexShrink: 0 }}>{ROLE_ICO[rl.id](role.id === rl.id ? gold : sub)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ ...T.bold, marginTop: 0, marginBottom: 2 }}>{rl.label}</div>
                  <div style={{ color: sub, fontSize: 12 }}>{rl.desc}</div>
                </div>
                <span style={{ display: "flex", flexShrink: 0, width: 20, justifyContent: "center" }}>
                  {role.id === rl.id ? UI_SVG.checkCircle(gold, 20) : null}
                </span>
              </div>
            ))}
            {customQs.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <button className="sa-btn" onClick={() => { vibrate("light"); setUseCustom(v => !v); }}
                  style={{ padding: "9px 14px", borderRadius: RADIUS.lg, cursor: "pointer",
                    border: `1px solid ${gold}${useCustom ? "" : "55"}`,
                    background: useCustom ? gold : "transparent",
                    color: useCustom ? "#1A1008" : sub,
                    fontSize: 13, fontFamily: "Georgia, serif", fontWeight: "bold", transition: "all 0.15s" }}>
                  {useCustom ? "★" : "☆"} Вопросы твоего ресторана
                </button>
                <div style={{ color: sub, fontSize: 11.5, lineHeight: 1.45, margin: "6px 2px 0" }}>
                  Доступно {customQs.length}, в тест войдёт до {MAX_CUSTOM_Q}. Включай для кандидатов из твоей сети, которые должны знать регламент.
                </div>
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
            <div style={{ ...T.modSub, color: sub, lineHeight: 1.55, marginBottom: 14 }}>
              Пара вопросов о кандидате — от этого зависит, какой тест он получит. Можно заполнить вместе с ним.
            </div>
            <div style={secLabel}>Опыт в гостеприимстве и гастрономии</div>
            {EXPERIENCE.map(x => (
              <div key={x.id} className="sa-btn" onClick={() => { vibrate("light"); setExp(x); }} {...onActivate(() => setExp(x))}
                style={{ ...glass, padding: "12px 14px", marginBottom: 8, cursor: "pointer", display: "flex",
                  alignItems: "center", gap: 12, position: "relative", overflow: "hidden",
                  ...(exp?.id === x.id ? { border: a11y ? "1.5px solid #8B6A30" : "1px solid #C8A96E" } : {}) }}>
                {exp?.id === x.id && <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: gold }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ ...T.bold, marginTop: 0, marginBottom: 2 }}>{x.label}</div>
                  <div style={{ color: sub, fontSize: 11.5 }}>{x.note}</div>
                </div>
                <span style={{ display: "flex", flexShrink: 0, width: 20, justifyContent: "center" }}>
                  {exp?.id === x.id ? UI_SVG.checkCircle(gold, 20) : null}
                </span>
              </div>
            ))}
            {exp && exp.id !== "none" && (
              <>
                <div style={{ ...secLabel, margin: "16px 2px 10px" }}>Где был опыт <span style={optNote}>(необязательно)</span></div>
                <LiquidSegment a11y={a11y} equal={false} scroll accent={gold} muted={sub}
                  itemStyle={{ fontSize: 12.5, padding: "8px 13px" }}
                  items={[{ id: "__none", label: "Не указано" }, ...PLACES.map(p => ({ id: p, label: p }))]}
                  activeId={place || "__none"}
                  onSelect={(id) => { vibrate("light"); setPlace(id === "__none" ? null : id); }} />
              </>
            )}
            <div style={{ ...secLabel, margin: "16px 2px 10px" }}>Возраст <span style={optNote}>(необязательно)</span></div>
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
              <div style={{ ...T.bold, marginTop: 0, marginBottom: 8 }}>Передайте телефон кандидату</div>
              <div style={{ ...T.modSub, color: sub, lineHeight: 1.65 }}>
                <b style={{ color: gold }}>{name.trim()}</b>, вам {level === "none" ? 12 : 15} рабочих ситуаций — роль «{role.label}».
                В каждой всё описано полностью: читайте спокойно, специальных знаний не нужно.
                На вопрос даётся до {SECONDS_PER_Q} секунд. В паре вопросов нужно будет расставить
                действия по порядку — просто нажимайте их в той очерёдности, как поступили бы.
                Отвечайте честно, как в жизни: здесь проверяется мышление, а не зубрёжка.
              </div>
            </div>
            <button className="sa-btn" style={goldBtn} onClick={startTest}>Я готов(а) — начать</button>
            <button className="sa-btn" onClick={startAi}
              style={{ ...goldBtn, marginTop: 10, background: "transparent", color: gold,
                border: `1px solid ${gold}66`, boxShadow: "none" }}>
              AI-интервью · бета
            </button>
            <div style={{ ...T.modSub, color: sub, fontSize: 11.5, textAlign: "center", marginTop: 8, lineHeight: 1.5 }}>
              В AI-режиме кандидат отвечает своими словами, а ИИ задаёт уточняющие вопросы
              и оценивает по тем же компетенциям
            </div>
          </>
        )}

        {/* ── AI-ИНТЕРВЬЮ ── */}
        {phase === "ai" && (
          <>
            <div style={{ ...secLabel, display: "flex", justifyContent: "space-between", margin: "0 2px 10px" }}>
              <span>AI-ИНТЕРВЬЮ · {name.trim()}</span>
              <span>ОТВЕТОВ: {aiAnswered}</span>
            </div>
            <div ref={aiListRef} className="sa-dlgscroll"
              style={{ ...glass, padding: 12, marginBottom: 12, maxHeight: "46vh", overflowY: "auto",
                WebkitOverflowScrolling: "touch", overscrollBehavior: "contain",
                display: "flex", flexDirection: "column", gap: 8 }}>
              {aiMsgs.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "88%", padding: "9px 12px", fontSize: 13.5, lineHeight: 1.55, fontFamily: "Georgia, serif",
                    ...(m.role === "user"
                      ? (a11y
                        ? { background: "rgba(139,106,48,0.09)", border: "1px solid rgba(139,106,48,0.42)",
                            boxShadow: "inset 0 0 22px rgba(255,255,255,0.40), inset 0 1px 0 rgba(255,255,255,0.70)", color: "#3A2E1C" }
                        : { background: "rgba(200,169,110,0.10)", border: "1px solid rgba(214,178,102,0.35)",
                            boxShadow: "inset 0 0 22px rgba(255,230,170,0.10), inset 0 1px 0 rgba(255,255,255,0.15)", color: "#F5E9CE" })
                      : (a11y
                        ? { background: "rgba(255,252,244,0.22)", border: "1px solid rgba(139,106,48,0.30)",
                            boxShadow: "inset 0 0 22px rgba(255,255,255,0.55), inset 0 1px 0 rgba(255,255,255,0.85)", color: "#3A2E1C" }
                        : { background: "rgba(255,250,238,0.05)", border: "1px solid rgba(255,255,255,0.13)",
                            boxShadow: "inset 0 0 22px rgba(255,248,230,0.07), inset 0 1px 0 rgba(255,255,255,0.10)", color: "#EFE6D2" })),
                    borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px" }}>
                    {m.content}
                  </div>
                </div>
              ))}
              {aiBusy && (
                <div style={{ display: "flex", gap: 5, padding: "8px 4px" }}>
                  {[0, 1, 2].map(i => <span key={i} className="sa-pulse" style={{ width: 6, height: 6, borderRadius: 3, background: gold, animationDelay: (i * 0.18) + "s" }} />)}
                </div>
              )}
              {aiErr && (
                <div style={{ color: RED, fontSize: 12.5, lineHeight: 1.5, padding: "4px 2px" }}>
                  {aiErr}
                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                    <button className="sa-btn" onClick={() => aiTurn(aiMsgs)}
                      style={{ padding: "8px 14px", borderRadius: RADIUS.pill, cursor: "pointer", border: `1px solid ${gold}55`, background: "transparent", color: gold, fontFamily: "Georgia, serif", fontSize: 12, fontWeight: "bold" }}>↻ Повторить</button>
                    <button className="sa-btn" onClick={() => { setPhase("handoff"); }}
                      style={{ padding: "8px 14px", borderRadius: RADIUS.pill, cursor: "pointer", border: "none", background: "transparent", color: sub, fontFamily: "Georgia, serif", fontSize: 12 }}>Назад</button>
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <textarea
                className={a11y ? "sa-aiinput-light" : "sa-aiinput-dark"}
                value={aiInput}
                rows={1}
                onChange={e => {
                  setAiInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 110) + "px";
                }}
                placeholder="Ответ кандидата…"
                maxLength={800}
                style={{ ...inputStyle, flex: 1, minWidth: 0, marginBottom: 0,
                  lineHeight: 1.45, resize: "none", maxHeight: 110, overflowY: "auto" }}
              />
              <button className="sa-btn" onClick={aiSend} disabled={aiBusy || !aiInput.trim()}
                style={{ width: 46, height: 46, alignSelf: "flex-end", borderRadius: RADIUS.md, border: "none", cursor: "pointer", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: aiInput.trim() && !aiBusy ? "linear-gradient(135deg, #C8A96E 0%, #8B6A30 100%)" : "rgba(160,120,60,0.25)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
              </button>
            </div>
            {aiAnswered >= 4 && !aiBusy && (
              <button className="sa-btn" style={goldBtn} onClick={finishAi}>Завершить интервью → оценка</button>
            )}
            <div style={{ ...T.modSub, color: sub, fontSize: 10.5, textAlign: "center", marginTop: 8, opacity: 0.75, fontFamily: "monospace", letterSpacing: 1 }}>
              ИИ МОЖЕТ ОШИБАТЬСЯ · РЕШЕНИЕ ВСЕГДА ЗА МЕНЕДЖЕРОМ
            </div>
          </>
        )}

        {/* ── ТЕСТ ── */}
        {phase === "test" && q && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ ...T.quizProgress, marginBottom: 0 }}>ВОПРОС {qIdx + 1} / {test.length}</span>
              <span style={{ color: sub, fontSize: 12 }}>{name.trim()}</span>
            </div>
            <QTimer key={qIdx} seconds={SECONDS_PER_Q} onExpire={onExpire} />
            {q.scene && (
              <div style={T.simScen}>
                {q.scene}
              </div>
            )}
            <div style={{ ...T.quizQ, marginTop: 0 }}>{q.text}</div>

            {q.type === "order" ? (
              <>
                {q.options.map((opt, i) => {
                  const pos = ordSeq.indexOf(i);
                  return (
                    <button key={i} className="sa-btn sa-opt" onClick={() => tapOrder(i)}
                      style={{ ...T.quizOpt, display: "flex", alignItems: "center", gap: 12, width: "100%",
                        textAlign: "left", fontFamily: "Georgia, serif", ...(pos >= 0 ? optSel : {}) }}>
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
                <button key={i} className="sa-btn sa-opt" onClick={() => answer(i)}
                  style={{ ...T.quizOpt, display: "block", width: "100%", textAlign: "left",
                    fontFamily: "Georgia, serif", ...(chosen === i ? optSel : {}) }}>
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
              <div style={{ ...T.bold, marginTop: 0, marginBottom: 6 }}>Последний вопрос — о себе</div>
              <div style={{ ...T.modSub, color: sub, lineHeight: 1.6 }}>
                {name.trim()}, как вам кажется, на какую часть вопросов вы ответили верно? Здесь нет правильного ответа — отвечайте честно.
              </div>
            </div>
            {SELF_BANDS.map(b => (
              <button key={b.id} className="sa-btn" onClick={() => { vibrate("light"); setSelfBand(b.id); setTimeout(() => setPhase("gate"), 260); }}
                style={{ ...T.quizOpt, display: "block", width: "100%", textAlign: "left",
                  fontFamily: "Georgia, serif", ...(selfBand === b.id ? optSel : {}) }}>
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
              <div style={{ ...T.bold, marginTop: 0, marginBottom: 8 }}>Готово — спасибо!</div>
              <div style={{ ...T.modSub, color: sub, lineHeight: 1.6 }}>
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
              <div style={{ ...glass, marginBottom: 14, padding: "22px 16px 16px" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ ...T.resultCircle, borderColor: v.color }}>
                    <span style={{ ...T.resultScore, color: v.color }}>{pct}%</span>
                    <span style={{ color: "#a09080", fontSize: 12 }}>верно</span>
                  </div>
                  <div style={{ ...T.resultTxt, fontWeight: "bold", color: v.color }}>{v.label}</div>
                </div>
                <div style={{ ...secLabel, textAlign: "center", margin: "0 0 10px" }}>
                  {name.trim()} · {role.label} · {exp ? exp.label : "?"}{place ? ` · ${place}` : ""}{age ? ` · ${age}` : ""}
                </div>
                <div style={{ ...T.modSub, color: sub, lineHeight: 1.6, textAlign: "center" }}>{v.note}</div>
              </div>

              {cal && (
                <div style={{ ...glass, marginBottom: 14, display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ display: "flex", flexShrink: 0 }}>{UI_SVG.target(gold, 20)}</span>
                  <div>
                    <div style={{ ...T.bold, marginTop: 0, marginBottom: 3 }}>
                      Самооценка: <span style={{ color: cal.color }}>{cal.label}</span>
                    </div>
                    <div style={{ ...T.modSub, color: sub, lineHeight: 1.55 }}>{cal.note}</div>
                  </div>
                </div>
              )}

              {aiVerdict && (
                <div style={{ ...glass, marginBottom: 14 }}>
                  <div style={{ ...T.bold, marginTop: 0, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                    Вердикт ИИ
                    <span style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: 1.5, color: gold, border: `1px solid ${gold}66`, borderRadius: RADIUS.pill, padding: "2px 7px", fontWeight: "normal" }}>БЕТА</span>
                  </div>
                  <div style={{ ...T.modSub, color: sub, lineHeight: 1.6, marginBottom: aiVerdict.strengths?.length || aiVerdict.risks?.length ? 10 : 0 }}>{aiVerdict.verdict}</div>
                  {aiVerdict.strengths?.length > 0 && (
                    <div style={{ ...T.modSub, color: sub, lineHeight: 1.55, marginBottom: 6 }}>
                      <b style={{ color: GREEN }}>Сильное:</b> {aiVerdict.strengths.join("; ")}
                    </div>
                  )}
                  {aiVerdict.risks?.length > 0 && (
                    <div style={{ ...T.modSub, color: sub, lineHeight: 1.55 }}>
                      <b style={{ color: RED }}>Риски:</b> {aiVerdict.risks.join("; ")}
                    </div>
                  )}
                </div>
              )}

              {topics.length > 0 && (
                <div style={{ ...glass, marginBottom: 14 }}>
                  <div style={{ ...T.bold, marginTop: 0, marginBottom: 10 }}>По компетенциям — от слабых к сильным</div>
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

              <div style={{ ...T.modSub, color: sub, lineHeight: 1.55, marginBottom: 14 }}>
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
