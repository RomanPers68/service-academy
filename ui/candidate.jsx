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
import { hintsFor } from "../data/hints";
import React from "react";
import { CANDIDATE_QUESTIONS } from "../data/candidate-questions";
import { GOLD, GREEN, RED, GOLD_SOFT, RADIUS, labelStyle } from "./tokens";
import { shuffleArray, vibrate, onActivate } from "../lib/utils";
import { MicButton } from "./mic";
import { TalkButton, TalkBar, TalkDots, TalkSpeaking, canTalk } from "./talk";   // v65 (Доп. 378): ответ голосом
import { rpc, saToken, SUPABASE_URL, SUPABASE_KEY } from "../api/supabase";
import { MOD_SVG, UI_SVG, ROLE_SVG } from "./icons";
import { Sign } from "./signs";   // v75 (Доп. 388): значки вместо ⭐ и ☁
import { LiquidSegment, useHintOnce, HintBubble } from "./widgets";
import { aiCatOf, DECISIONS, hrStatus, REAL_N } from "../lib/hr-quality";   // v66 (Доп. 379): когда снимаем «бету»
// v66: «Проверка AI HR» — отдельный кусок (эталоны ≈25 КБ), грузится, только когда её открыли
const retryImport = (loader, tries = 3, delay = 600) => loader().catch(err => { if (tries <= 1) throw err; return new Promise(r => setTimeout(r, delay)).then(() => retryImport(loader, tries - 1, delay * 2)); });
const HrEval = React.lazy(() => retryImport(() => import("./hr-eval")).then(m => ({ default: m.HrEval })));

const STORE_KEY = "sa_candidate_results";
const SECONDS_PER_Q = 60; // ситуации читаются дольше — минута на вопрос
const MAX_CUSTOM_Q = 5;

const TEST_ROLES = [
  { id: "waiter",  customRoles: ["seasonal","core"],            label: "Официант",     desc: "Зал, гости, сервис" },
  { id: "hostess", customRoles: ["spg"],                        label: "Хостес / СПГ", desc: "Вход, встреча, рассадка" },
  { id: "bartender", customRoles: ["bar"],                    label: "Бармен",       desc: "Стойка, техника, продукт" },
  { id: "manager", customRoles: ["manager","service_manager"], label: "Менеджер",     desc: "Команда, конфликты, смена" },
];
// Перерисованные иконки ролей из фирменного набора
const ROLE_ICO = {
  waiter: (c) => UI_SVG.cloche(c, 20),
  hostess: (c) => ROLE_SVG.spg(c, 20),   // v75: значок хостес, как у роли (было — значок-искра)
  bartender: (c) => UI_SVG.shaker(c, 20),
  manager: (c) => UI_SVG.target(c, 20),
};

const EXPERIENCE = [
  { id: "none",   label: "Опыта нет",      level: "none",   note: "проверим потенциал и характер" },
  { id: "junior", label: "До года",        level: "junior", note: "база + рабочие ситуации" },
  { id: "mid",    label: "1–3 года",       level: "pro",    note: "профессиональные ситуации" },
  { id: "senior", label: "Больше 3 лет",   level: "senior", note: "только сложные кейсы, экспертная планка" },
];
const PLACES = ["Ресторан", "Кафе", "Бар", "Фастфуд", "Другое"];
// Инструкция интервьюеру по уровню кандидата — уходит в AI-интервью
const HR_BRIEF = {
  none: "Кандидат без опыта. Не спрашивай о профессиональных техниках — проверяй здравый смысл, характер, отношение к гостю и обучаемость. Вопросы простые, тёплые, ситуационные из жизни.",
  junior: "Кандидат с опытом до года. Половина вопросов — база стандартов, половина — простые рабочие ситуации. Планка средняя.",
  pro: "Кандидат с опытом 1–3 года. Не задавай базовых вопросов — только профессиональные ситуации: конфликтный гость, запара, ошибка в заказе, работа в паре. Проверяй глубину, а не факты.",
  senior: "Кандидат с опытом БОЛЬШЕ 3 ЛЕТ. Категорически не задавай базовых и очевидных вопросов — это оскорбит опытного специалиста. Только экспертные кейсы своей роли: для бара — классика и спеки наизусть, скорость под нагрузкой, себестоимость и списания, инвентаризация, работа с сомелье/шефом, обучение новичков; для зала — управление сложным столом, апсейл без давления, VIP и конфликт на грани скандала, наставничество. Если ответ сильный — следующий вопрос ещё сложнее (уточняй детали, проси конкретные цифры и примеры). Планка экспертная: «нормальный» ответ для новичка здесь — слабый.",
};
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
// v66: итог последней «Проверки AI HR» на этом телефоне
const HR_REF_KEY = "sa_hr_eval";
function loadHrRef() {
  try { const v = JSON.parse(localStorage.getItem(HR_REF_KEY)); return v && typeof v === "object" && v.n ? v : null; }
  catch (e) { return null; }
}

// Вопросы из «своих» уроков ресторана для выбранной роли теста
function customPool(customLessons, testRole) {
  const out = [];
  (customLessons || []).forEach(c => {
    if (!testRole.customRoles.includes(c.role)) return;
    (Array.isArray(c.questions) ? c.questions : []).forEach(q => {
      if (q && q.q && Array.isArray(q.options) && typeof q.correct === "number")
        out.push({ scene: null, text: q.q, options: q.options, correct: q.correct,
          topic: "Свой раздел: " + ((c.module || c.title || "Регламент ресторана").trim() || "Регламент ресторана") });
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
  } else if (level === "senior") {
    // Опытному — только профессиональные кейсы; база лишь если pro не хватает
    const np = Math.min(total, pro.length);
    picked = [...pro.slice(0, np), ...base.slice(0, total - np)];
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
      note: "Часть инстинктов верная, часть придётся ставить. Смотри на мотивацию: если хочет учиться, вариант рабочий." };
    return { label: "Пока не про сервис", color: RED,
      note: "Ответы расходятся с самой сутью гостеприимства. Если брать, то только с плотным наставничеством и испытательным сроком." };
  }
  if (level === "senior") {
    if (pct >= 85) return { label: "Эксперт", color: GREEN,
      note: "Уровень соответствует заявленным 3+ годам: сложные ситуации решает уверенно. На встрече обсуди лидерство, наставничество и условия." };
    if (pct >= 65) return { label: "Профессионал с пробелами", color: GOLD_SOFT,
      note: "Опыт чувствуется, но часть экспертных кейсов провалена. Уточни, где именно работал и в каком формате: планка «3+ лет» пока не подтверждена полностью." };
    return { label: "Ниже заявленного опыта", color: RED,
      note: "Ответы не соответствуют уровню «больше 3 лет». Возможно, опыт в другом формате или завышен. Проверь рекомендациями и стажировочной сменой." };
  }
  if (pct >= 80) return { label: "Уверенный профессионал", color: GREEN,
    note: "Кандидат мыслит как человек из индустрии. На собеседовании можно говорить о личности, мотивации и условиях." };
  if (pct >= 55) return { label: "Крепкая база", color: GOLD_SOFT,
    note: "Опыт виден, но есть провисания (темы ниже). Уточни их в разговоре: возможно, просто другие стандарты на прошлом месте." };
  return { label: "Опыт не подтверждается", color: RED,
    note: "Заявленный стаж не бьётся с ответами. Стоит аккуратно расспросить, чем человек реально занимался на прошлых местах." };
}

// ── Калибровка самооценки ──
function calibrationOf(selfBand, pct) {
  if (selfBand == null) return null;
  const band = SELF_BANDS.find(b => pct >= b.min && pct <= b.max) || SELF_BANDS[0];
  if (selfBand === band.id) return { label: "реалистичная", color: GREEN,
    note: "Кандидат трезво оценивает свои знания. Это хороший признак." };
  if (selfBand > band.id) return { label: "завышенная", color: selfBand - band.id > 1 ? RED : GOLD_SOFT,
    note: "Кандидат считает, что знает больше, чем показал. Проверь в разговоре, как он воспринимает обратную связь." };
  return { label: "заниженная", color: GOLD_SOFT,
    note: "Кандидат недооценивает себя: возможно, волнуется или скромничает. Часто это лечится поддержкой." };
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
      <div style={{ height: 4, borderRadius: 3, background: "rgba(160,120,60,0.18)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: pct + "%", background: color, borderRadius: 3, transition: "width 1s linear, background 0.3s ease" }} />
      </div>
    </div>
  );
}

// ── v66 (Доп. 379): отчёт AI-интервью — для экрана результата и для истории ──
// Категория по правилу из баллов и флагов (сервер), вердикт, по каждой компетенции — балл, «почему» и цитата кандидата,
// «ИИ не уверен» (прогоны оценки разошлись), что спросить на живой встрече, все ответы кандидата, модель,
// и «Ваше решение» — Берём / Подумаю / Не берём (по нему считается, совпадает ли ИИ с менеджером).
// категория, решения и совпадение ИИ с руководителем — lib/hr-quality.js (там же условия снятия «беты»)
const catColorOf = (c) => (c === "Рекомендован" ? GREEN : c === "Не рекомендован" ? RED : GOLD_SOFT);
const isAiRec = (r) => !!(r && (r.aiScores || r.aiVerdict));   // запись AI-интервью (новая или прежняя)
const scoreColor = (v) => (v >= 70 ? GREEN : v >= 55 ? GOLD_SOFT : RED);
const shortModel = (m) => String(m || "").split("/").pop();
// ответы кандидата по порядку: вопрос → ответ (голосом — пометка)
export function transcriptOf(msgs) {
  const out = [];
  for (const m of msgs || []) {
    if (m.role === "assistant") out.push({ q: String(m.content || "").slice(0, 400), a: "", t: Number.isFinite(m.topic) ? m.topic : null, f: !!m.followup });
    else if (out.length) { const last = out[out.length - 1]; last.a = (last.a ? last.a + " " : "") + String(m.content || "").slice(0, 700); if (m.voice) last.v = 1; }
  }
  return out.filter(x => x.a);
}

function AiReport({ rec, T, a11y, gold, sub, glass, onDecide, compact = false, beta = true }) {
  const [showAll, setShowAll] = React.useState(false);
  const cat = aiCatOf(rec);
  const catColor = cat === "Рекомендован" ? GREEN : cat === "Не рекомендован" ? RED : GOLD_SOFT;
  const names = (rec.aiTopics && rec.aiTopics.length ? rec.aiTopics : Object.keys(rec.aiScores || {}));
  const unsure = new Set(rec.aiUncertain || []);
  const text = T.modTitle?.color || (a11y ? "#3A2E1C" : "#EFE4C8");
  const small = { ...T.modSub, color: sub, fontSize: 12.5, lineHeight: 1.55 };
  const box = compact ? { marginTop: 10 } : { ...glass, marginBottom: 12 };
  const lensBox = compact ? {} : { "data-lens-card": "" };   // v113: отдельный отчёт — карточки линзы; в строке истории — нет
  return (
    <div data-ai-report={rec.id}>
      <div style={box} {...lensBox}>
        {!compact ? (
          <div style={{ ...T.bold, marginTop: 2, marginBottom: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            Вердикт ИИ
            {beta ? <span data-ai-beta="" style={{ ...labelStyle(13), color: gold, border: `1px solid ${gold}66`, borderRadius: RADIUS.pill, padding: "1px 7px" }}>бета</span> : null}
          </div>
        ) : null}
        {cat && compact ? <div data-ai-cat={cat} style={{ fontFamily: "Georgia, serif", fontWeight: "bold", fontSize: 13.5, color: catColor, marginBottom: 4 }}>{cat}</div> : null}
        {rec.aiVerdict ? <div style={{ ...small, marginBottom: 8 }}>{String(rec.aiVerdict).replace(/^(Рекомендован с оговорками|Не рекомендован|Рекомендован)\.?\s*/i, "")}</div> : null}
        {rec.aiStrengths?.length > 0 && <div style={{ ...small, marginBottom: 6 }}><b style={{ color: GREEN }}>Сильное:</b> {rec.aiStrengths.join("; ")}</div>}
        {rec.aiGrowth?.length > 0 && <div style={{ ...small, marginBottom: 6 }}><b style={{ color: gold }}>Над чем работать:</b> {rec.aiGrowth.join("; ")}</div>}
        {rec.aiRisks?.length > 0 && <div style={{ ...small, marginBottom: 6 }}><b style={{ color: RED }}>Риски:</b> {rec.aiRisks.join("; ")}</div>}
        {rec.aiModel ? (
          <div data-ai-model="" style={{ fontFamily: "monospace", fontSize: 10.5, letterSpacing: 0.6, color: sub, opacity: 0.8, marginTop: 6 }}>
            оценивал: {shortModel(rec.aiModel)}{rec.aiRuns > 1 ? ` · ${rec.aiRuns} прогона оценки` : ""}
          </div>
        ) : null}
      </div>

      {rec.aiScores ? (
        <div style={box} {...lensBox} data-ai-comps="">
          <div style={{ ...T.bold, marginTop: compact ? 0 : 2, marginBottom: 8, fontSize: compact ? 13 : undefined }}>По компетенциям</div>
          {names.map((c) => {
            const v = Number(rec.aiScores[c] ?? 0), ev = (rec.aiEvidence && rec.aiEvidence[c]) || null;
            return (
              <div key={c} data-ai-comp={c} style={{ padding: "6px 0", borderTop: `1px solid ${gold}18` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ flex: 1, minWidth: 0, color: text, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c}</span>
                  {unsure.has(c) ? <span data-ai-unsure="" style={{ ...labelStyle(12.5), color: GOLD_SOFT, border: `1px solid ${GOLD_SOFT}55`, borderRadius: RADIUS.pill, padding: "0 6px", flexShrink: 0 }}>ИИ не уверен</span> : null}
                  <div style={{ width: 60, height: 5, borderRadius: 3, background: "rgba(160,120,60,0.18)", overflow: "hidden", flexShrink: 0 }}>
                    <div style={{ height: "100%", width: Math.max(0, Math.min(100, v)) + "%", background: scoreColor(v) }} />
                  </div>
                  <span style={{ color: scoreColor(v), fontFamily: "monospace", fontSize: 12.5, width: 26, textAlign: "right", flexShrink: 0 }}>{v}</span>
                </div>
                {ev && ev.why ? <div style={{ ...small, fontSize: 12, marginTop: 3 }}>{ev.why}</div> : null}
                {ev && ev.quote ? <div style={{ ...small, fontSize: 12, fontStyle: "italic", opacity: 0.9, marginTop: 2 }}>«{String(ev.quote).replace(/^[«"]+|[»"]+$/g, "")}»</div> : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {rec.aiAsk?.length > 0 && (
        <div style={box} {...lensBox} data-ai-ask="">
          <div style={{ ...T.bold, marginTop: compact ? 0 : 2, marginBottom: 6, fontSize: compact ? 13 : undefined }}>Спросите на встрече</div>
          {rec.aiAsk.map((q, i) => <div key={i} style={{ ...small, marginBottom: 4 }}>— {q}</div>)}
        </div>
      )}

      {rec.aiTranscript?.length > 0 && (
        <div style={box} {...lensBox}>
          <button type="button" className="sa-btn" data-ai-answers="" onClick={(e) => { e.stopPropagation(); vibrate("light"); setShowAll(v => !v); }}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: gold, fontFamily: "Georgia, serif", fontWeight: "bold", fontSize: 13 }}>
            {showAll ? "Скрыть ответы кандидата" : `Ответы кандидата · ${rec.aiTranscript.length}`} {showAll ? "▴" : "▾"}
          </button>
          {showAll ? rec.aiTranscript.map((x, i) => (
            <div key={i} data-ai-qa="" style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${gold}18` }}>
              <div style={{ ...small, fontSize: 12 }}>{x.f ? "Уточнение: " : ""}{x.q}</div>
              <div style={{ color: text, fontSize: 13, lineHeight: 1.5, marginTop: 3, fontFamily: "Georgia, serif" }}>
                {x.a}{x.v ? <span style={{ ...labelStyle(13), color: sub, marginLeft: 6 }}>· голосом</span> : null}
              </div>
            </div>
          )) : null}
        </div>
      )}

      {onDecide ? <Decision rec={rec} onDecide={onDecide} sub={sub} T={T} style={box} lens={!compact} /> : null}
    </div>
  );
}
export const decisionColor = (id) => (id === "hire" ? GREEN : id === "reject" ? RED : GOLD_SOFT);
// «Ваше решение»: подпись сверху, три равные кнопки в ряд (на 320 тоже в одну строку); повторный тап — снять
function Decision({ rec, onDecide, sub, T, style, lens }) {
  return (
    <div style={style} data-ai-decision={rec.decision || ""} data-lens-card={lens ? "" : undefined}>
      <div style={{ ...T.modSub, color: sub, fontSize: 12.5, marginBottom: 8 }}>
        Ваше решение{rec.decision && rec.decidedBy ? <span style={{ opacity: 0.75 }}> · отметил(а): {rec.decidedBy}</span> : null}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {DECISIONS.map((d) => {
          const on = rec.decision === d.id, c = decisionColor(d.id);
          return (
            <button key={d.id} type="button" className="sa-btn" data-decide={d.id} aria-pressed={on}
              onClick={(e) => { e.stopPropagation(); onDecide(rec.id, d.id); }}
              style={{ flex: 1, minWidth: 0, padding: "9px 4px", borderRadius: RADIUS.pill, cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 13, fontWeight: "bold", whiteSpace: "nowrap",
                border: `1px solid ${c}${on ? "" : "55"}`, background: on ? `${c}26` : "transparent", color: on ? c : sub }}>{d.label}</button>
          );
        })}
      </div>
    </div>
  );
}

export function CandidateScreen({ T, a11y, onBack, customLessons, profile }) {
  // Подсказка экрана — один раз при первом входе (правка 171)
  const [cdHint, cdHintDone] = useHintOnce("candidate");
  const [cdStep, setCDStep] = React.useState(0);
  const cdSteps = hintsFor("candidate");
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
    const { decSync, srvId, ...clean } = rec;   // v66: служебные пометки телефона на сервер не шлём
    rpc("candidate_save", { p_token: t, p_restaurant: restaurant, p_result: JSON.stringify(clean) })
      .then(d => {
        if (!d || !d.ok) return;
        setResults(prev => {
          const next = prev.map(r => r.id === rec.id ? { ...r, srvId: d.id } : r);
          saveResults(next);
          const r = next.find(x => x.id === rec.id);
          if (r && r.decSync === false) setTimeout(() => pushDecision(r), 0);   // v66: решение успели принять раньше
          return next;
        });
      })
      .catch(() => {});
  }, [restaurant]);

  // v66 (Доп. 379): решение менеджера по кандидату («Берём / Подумаю / Не берём») — на сервер (этап 28,
  // candidate_decide). Нет этапа или сети — решение живёт на телефоне (decSync: false) и уйдёт при следующем заходе.
  const pushDecision = React.useCallback((rec) => {
    const t = saToken();
    if (!t || !restaurant || !rec?.srvId) return;
    rpc("candidate_decide", { p_token: t, p_restaurant: restaurant, p_id: rec.srvId, p_decision: rec.decision || null })
      .then(d => {
        if (!d || !d.ok) return;
        setResults(prev => { const next = prev.map(r => r.id === rec.id ? { ...r, decSync: true } : r); saveResults(next); return next; });
      })
      .catch(() => {});
  }, [restaurant]);
  const decide = (id, dec) => {
    vibrate("light");
    const rec = results.find(r => r.id === id);
    if (!rec) return;
    const upd = { ...rec, decision: rec.decision === dec ? null : dec, decidedAt: new Date().toISOString(), decSync: false };
    const next = results.map(r => (r.id === id ? upd : r));
    setResults(next); saveResults(next);
    setLastRec(l => (l && l.id === id ? upd : l));
    pushDecision(upd);
  };
  // v66: итог «Проверки AI HR» — общий для руководителей ресторана (этап 28: hr_quality_*); нет этапа или сети —
  // живёт на телефоне и уходит на сервер при следующем заходе
  const [hrEvalRes, setHrEvalRes] = React.useState(loadHrRef);
  const saveHrRef = React.useCallback((res) => {
    setHrEvalRes(res);
    try { localStorage.setItem(HR_REF_KEY, JSON.stringify(res)); } catch (e) {}
    const t = saToken();
    if (t && restaurant) rpc("hr_quality_save", { p_token: t, p_restaurant: restaurant, p_payload: JSON.stringify(res) }).catch(() => {});
  }, [restaurant]);
  React.useEffect(() => {
    const t = saToken();
    if (!t || !restaurant) return;
    rpc("hr_quality_get", { p_token: t, p_restaurant: restaurant })
      .then(d => {
        if (!d || !d.ok) return;
        const srv = d.item && d.item.payload ? { ...d.item.payload, by: d.item.updated_by || "" } : null;
        const loc = loadHrRef();
        if (srv && (!loc || new Date(srv.at || 0) >= new Date(loc.at || 0))) {
          setHrEvalRes(srv);
          try { localStorage.setItem(HR_REF_KEY, JSON.stringify(srv)); } catch (e) {}
        } else if (loc) {
          rpc("hr_quality_save", { p_token: t, p_restaurant: restaurant, p_payload: JSON.stringify(loc) }).catch(() => {});   // проверяли без сервера — дозаливаем
        }
      })
      .catch(() => {});
  }, [restaurant]);
  const hrSt = hrStatus(hrEvalRes, results);   // { refOk, real: { n, agree, need, pass }, beta }

  React.useEffect(() => {
    const t = saToken();
    if (!t || !restaurant) return;
    rpc("candidate_list", { p_token: t, p_restaurant: restaurant })
      .then(d => {
        if (!d || !d.ok || !Array.isArray(d.items)) return;
        const cloud = d.items.map(row => ({
          ...(({ decSync, ...p }) => p)(row.payload || {}),   // v66: пометка телефона «решение не дошло» с сервера не берём
          srvId: row.id,
          by: row.created_by || "",
          date: (row.payload && row.payload.date) || row.created_at,
        }));
        const cloudIds = new Set(cloud.map(r => r.id).filter(Boolean));
        setResults(prev => {
          // локальные, ещё не долетевшие до сервера — оставляем и дозаливаем
          const pending = prev.filter(r => !r.srvId && !cloudIds.has(r.id));
          // v66: решение менеджера, ещё не дошедшее до сервера (не было этапа 28 или сети), главнее облачного
          const localDec = new Map(prev.filter(r => r.decSync === false).map(r => [r.id, r]));
          const cloud2 = cloud.map(r => localDec.has(r.id)
            ? { ...r, decision: localDec.get(r.id).decision, decidedAt: localDec.get(r.id).decidedAt, decSync: false } : r);
          const merged = [...cloud2, ...pending]
            .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
            .slice(0, 100);
          saveResults(merged);
          pending.forEach(uploadResult);
          cloud2.filter(r => r.decSync === false && r.srvId).forEach(r => pushDecision(r));
          return merged;
        });
      })
      .catch(() => {});
  }, [restaurant, uploadResult]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [confirmLeave, setConfirmLeave] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const lock = React.useRef(false);

  const gold = a11y ? "#6B4E1A" : GOLD;
  const sub = T.modSub.color;

  // Фирменная «стеклянная» плашка — те же токены, что у карточек уроков (обе темы)
  const glass = {
    background: T.lessGlass?.bg || "rgba(255,250,238,0.05)",
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
    color:"#fff", background:"linear-gradient(135deg, #C8A96E 0%, #7A5D2A 100%)",
    boxShadow:"0 4px 18px rgba(200,160,80,0.25)",
  };
  const ghostBtn = {
    padding:"13px", borderRadius: RADIUS.md, width:"100%", cursor:"pointer",
    border: a11y ? "1px solid rgba(139,106,48,0.55)" : "1px solid rgba(200,160,80,0.4)",
    background:"transparent",
    color: a11y ? "#7A5D2A" : GOLD, fontSize:14, fontFamily:"Georgia, serif",
  };
  const inputStyle = {
    width:"100%", padding:"13px 14px", borderRadius: RADIUS.sm, fontSize:14,
    fontFamily:"Georgia, serif",
    background: a11y ? "rgba(255,255,255,0.7)" : "rgba(20,14,6,0.5)",
    color: a11y ? "#3A2E1C" : "#F0E8D8",
    border: a11y ? "1px solid rgba(160,120,60,0.45)" : "1px solid rgba(200,160,80,0.35)",
    outline:"none", boxSizing:"border-box",
  };
  const optSel = {
    border: a11y ? "1.5px solid #7A5D2A" : "1px solid #C8A96E",
    background: a11y ? "rgba(139,106,48,0.14)" : "rgba(200,169,110,0.18)",
  };
  // Подпись секции — курсив с засечками в обычном регистре, как подписи в меню.
  // v73 (Доп. 386): раньше — моноширинный капс из общего T.secTitle; шрифт перекрываем здесь (тёмная тема 13 px, светлая 15)
  const secLabel = { ...T.secTitle, ...labelStyle(a11y ? 15 : 13), padding: 0, margin: "0 2px 10px" };
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
    setUseCustom(false); setSelfBand(null); setSaved(false); setLastRec(null);
    setPhase("setup");
  };
  const startTest = () => {
    vibrate("light");
    setTest(buildTest(role.id, level, useCustom ? customQs : []));
    setQIdx(0); setChosen(null); setOrdSeq([]); setAnswers([]); setLastRec(null);
    lock.current = false;
    setPhase("test");
  };

  // ── AI-интервью (бета): свободные ответы, уточняющие вопросы, вердикт ──
  const [aiMsgs, setAiMsgs] = React.useState([]);
  const [aiInput, setAiInput] = React.useState("");
  const aiInputRef = React.useRef(null);
  // Дополнение 126: поле ответа растёт и при вставке голосом.
  // v121 (Доп. 434): высота — с рамкой (у поля box-sizing: border-box, а scrollHeight рамку не считает): раньше с первой
  // буквой поле становилось на 2 px ниже, чем пустое, и волна с микрофоном расходились с его серединой
  const fitAiInput = (el) => {
    if (!el) return;
    el.style.height = "auto";
    let bw = 0; try { const cs = getComputedStyle(el); bw = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0); } catch (e) {}
    el.style.height = Math.min(el.scrollHeight + bw, 110) + "px";
  };
  React.useEffect(() => { fitAiInput(aiInputRef.current); }, [aiInput]);
  const [aiBusy, setAiBusy] = React.useState(false);
  const [aiErr, setAiErr] = React.useState(null);
  const [aiVerdict, setAiVerdict] = React.useState(null);
  const aiListRef = React.useRef(null);
  const aiAnswered = aiMsgs.filter(m => m.role === "user").length;
  // v65 (Доп. 378), владелец: «добавим в собеседование ответ голосом». Как у Наставника и «Живого гостя»
  // (ui/talk.jsx): поле пустое — на месте «Отправить» кнопка-волна; коснулся — вместо поля полоса разговора:
  // интервьюер читает вопрос вслух (живым голосом, нет его — голосом телефона), кандидат отвечает голосом,
  // конец фразы — по паузе, ответ ложится в переписку и уходит интервьюеру; следующий вопрос — снова вслух.
  // Диктовка (микрофон) остаётся — для тех, кто хочет поправить ответ перед отправкой.
  const [talk, setTalk] = React.useState(false);
  const [talkState, setTalkState] = React.useState("idle");
  // v66 (Доп. 379): план интервью ведёт сервер (ai-hr v2): тема сейчас, было ли уточнение, конец; v2 === false —
  // функция на сервере ещё прежняя (без плана) — всё как раньше
  const HR0 = { v2: null, topics: [], total: 0, topic: 0, followup: false, done: false, model: "" };
  const [hrInfo, setHrInfo] = React.useState(HR0);
  const hrRef = React.useRef(hrInfo);
  hrRef.current = hrInfo;
  const [lastRec, setLastRec] = React.useState(null);   // запись последнего AI-интервью — для экрана результата
  const [micBusy, setMicBusy] = React.useState(false);
  const talkOk = React.useMemo(() => canTalk(), []);
  const aiMsgsRef = React.useRef(aiMsgs);
  aiMsgsRef.current = aiMsgs;

  React.useEffect(() => {
    const el = aiListRef.current;
    if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, [aiMsgs, aiBusy]);

  // plan — у каждого вопроса интервьюера: тема и уточнение (сервер по нему знает, что спрашивать дальше)
  const planOf = (msgs) => {
    if (hrRef.current.v2 === false) return undefined;
    const ai = msgs.filter(m => m.role === "assistant");
    if (ai.some(m => !Number.isFinite(m.topic))) return undefined;
    return ai.map(m => ({ topic: m.topic, followup: !!m.followup }));
  };
  const callHr = React.useCallback((mode, msgs, extra = {}) =>
    fetch(`${SUPABASE_URL}/functions/v1/ai-hr`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY },
      body: JSON.stringify({
        token: saToken(), mode, role: role?.id, plan: planOf(msgs), voice: !!extra.voice,
        candidate: {
          name: name.trim(), expLabel: exp?.label || "", place: place || "", age: age || "",
          level: exp?.level || "pro",
          // Калибровка интервьюера по опыту (прод-замечание владельца:
          // опытному бармену задавались вопросы для новичка)
          brief: HR_BRIEF[exp?.level] || HR_BRIEF.pro,
        },
        messages: msgs.map(m => ({ role: m.role, content: m.content })),
      }),
    }).then(r => r.json()), [role, name, exp, place]);

  // ответ интервьюера → его тема и уточнение (v2) или прежний режим
  const applyHr = (d) => {
    if (Number.isFinite(d?.topic)) {
      const topics = Array.isArray(d.topics) ? d.topics : [];
      setHrInfo({ v2: true, topics, total: d.total || topics.length, topic: d.topic, followup: !!d.followup, done: !!d.done, model: d.model || "" });
      return { topic: d.topic, followup: !!d.followup };
    }
    setHrInfo(h => ({ ...h, v2: false, model: d?.model || h.model }));
    return {};
  };
  // v66: интервьюер не ответил — набранный ответ возвращается в поле (раньше пропадал), «Повторить» шлёт его снова
  const giveBack = (msgs) => {
    const last = msgs[msgs.length - 1];
    if (last && last.role === "user") setAiInput(v => (v && v.trim() ? v : last.content));
  };
  const aiTurn = React.useCallback((msgs) => {
    setAiBusy(true); setAiErr(null);
    callHr("chat", msgs)
      .then(d => {
        if (d?.ok && d.reply) { const meta = applyHr(d); setAiMsgs([...msgs, { role: "assistant", content: d.reply, ...meta }]); }
        else {
          giveBack(msgs);
          setAiErr(d?.error === "not_configured"
            ? "AI-интервью не подключено на сервере (функция ai-hr). Пока можно пройти обычный тест."
            : d?.error === "rate_limit" ? "Дневной лимит ИИ исчерпан. Попробуйте позже или пройдите обычный тест."
            : "ИИ временно недоступен. Попробуйте ещё раз или пройдите обычный тест.");
        }
      })
      .catch(() => { giveBack(msgs); setAiErr("Нет связи с сервером. Проверьте интернет."); })
      .finally(() => setAiBusy(false));
  }, [callHr]);   // eslint-disable-line react-hooks/exhaustive-deps

  const startAi = () => {
    vibrate("light");
    setTalk(false);
    setHrInfo(HR0); hrRef.current = HR0;
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

  // v65: ответ голосом — тот же путь, что набранный: в переписку и к интервьюеру; вопрос читает полоса разговора.
  // Не получилось — ответ убираем из переписки (вопрос — ответ остаются парами), полоса встаёт на паузу с причиной:
  // кандидат касается волны и отвечает ещё раз.
  const talkTurn = async (text) => {
    const said = String(text || "").trim();
    if (!said) return { text: "" };
    const before = aiMsgsRef.current;
    const list = [...before, { role: "user", content: said, voice: true }];
    aiMsgsRef.current = list; setAiMsgs(list);
    setAiBusy(true); setAiErr(null);
    let d = null;
    try { d = await callHr("chat", list, { voice: true }); } catch (e) { d = { error: "network" }; }
    setAiBusy(false);
    if (d?.ok && d.reply) {
      const meta = applyHr(d);
      const next = [...list, { role: "assistant", content: d.reply, ...meta }];
      aiMsgsRef.current = next; setAiMsgs(next);
      // v66: интервьюер попрощался (все темы пройдены) — договорит, и полоса закроется сама
      return { text: d.reply, end: !!d.done };
    }
    aiMsgsRef.current = before; setAiMsgs(before);
    const msg = d?.error === "not_configured" ? "AI-интервью не подключено на сервере (функция ai-hr). Пока можно пройти обычный тест."
      : d?.error === "rate_limit" ? "Дневной лимит ИИ исчерпан. Попробуйте позже или пройдите обычный тест."
      : d?.error === "network" ? "Нет связи с сервером. Коснитесь волны и ответьте ещё раз."
      : "ИИ не ответил. Коснитесь волны и ответьте ещё раз.";
    if (d?.error === "not_configured" || d?.error === "rate_limit") setAiErr(msg);
    throw new Error(msg);
  };
  const openTalk = () => {
    vibrate("light");
    try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}   // клавиатура — вниз
    setTalk(true);
  };
  // вопрос, на который ещё не ответили, — полоса прочитает его первым
  const lastAi = aiMsgs.length && aiMsgs[aiMsgs.length - 1].role === "assistant" ? aiMsgs[aiMsgs.length - 1].content : null;

  const voiceN = aiMsgs.filter(m => m.role === "user" && m.voice).length;   // v65: ответов голосом
  const finishAi = () => {
    if (aiBusy) return;
    setTalk(false);
    vibrate("light");
    setAiBusy(true); setAiErr(null);
    callHr("assess", aiMsgs, { voice: voiceN > 0 })
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
          // v65: отвечал голосом (половина ответов и больше) — видно в истории: «AI-интервью голосом»
          name: name.trim(), roleLabel: role.label + " · AI-интервью" + (voiceN * 2 >= Math.max(1, aiAnswered) && voiceN ? " голосом" : ""), date: new Date().toISOString(),
          aiVoice: voiceN,
          expLabel: exp ? exp.label : "", place: place || "", age: age || "",
          score: Math.round(synth.reduce((a, x) => a + x.pts, 0) * 10) / 10, total: entries.length, pct: avg,
          level, selfBand: null,
          topics: entries.map(([topic, s]) => ({ topic, ok: s / 100, n: 1 })),
          aiVerdict: d.verdict || "", aiStrengths: d.strengths || [], aiRisks: d.risks || [],
          // v66 (Доп. 379): категория по правилу, баллы и доказательства по темам, что спросить на встрече, все ответы,
          // кто оценивал; у прежней функции на сервере этих полей нет — запись как раньше
          aiCategory: d.category || aiCatOf({ aiVerdict: d.verdict }), aiScores: d.scores, aiEvidence: d.evidence || null,
          aiAsk: Array.isArray(d.ask) ? d.ask : [], aiUncertain: Array.isArray(d.uncertain) ? d.uncertain : [],
          aiGrowth: Array.isArray(d.growth) ? d.growth : [], aiModel: d.model || hrInfo.model || "", aiRuns: d.runs || 1, aiV: d.v || 1,
          aiTopics: hrInfo.topics && hrInfo.topics.length ? hrInfo.topics : Object.keys(d.scores), aiTranscript: transcriptOf(aiMsgs),
        };
        const next = [rec, ...results];
        setResults(next); saveResults(next); setSaved(true);
        uploadResult(rec);
        setAnswers(synth);
        setAiVerdict({ verdict: d.verdict, strengths: d.strengths, growth: d.growth, risks: d.risks });
        setLastRec(rec);
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
    // v65: в AI-интервью с ответами — тоже спросить (разговор голосом при этом закрываем: микрофон не слушает вопрос)
    if (phase === "ai" && aiAnswered > 0) { setTalk(false); setConfirmLeave(true); return; }
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
      {cdHint && cdSteps.length ? (
        <HintBubble a11y={a11y} text={cdSteps[cdStep]} arrow="up"
          step={cdStep + 1} total={cdSteps.length}
          onNext={cdStep >= cdSteps.length - 1 ? null : () => setCDStep(v => v + 1)}
          onClose={cdHintDone} />
      ) : null}
      <div style={T.lessHead}>
        <button className="sa-hit" style={T.backBtn2} data-lens="back" aria-label="Вернуться" onClick={backFromHeader}>‹</button>
        <div style={T.lessHeadTitle}>{phase === "eval" ? "Проверка AI HR" : "Собеседование"}</div>
      </div>
      <div style={{ ...T.lessBody, flex: 1, overflowY: "auto", padding: "14px 16px 44px" }}>

        {confirmLeave && (
          <div style={{ ...glass, marginBottom: 12, borderColor: RED }}>
            <div style={{ ...T.bold, marginBottom: 6 }}>Прервать собеседование?</div>
            <div style={{ color: sub, fontSize: 12.5, lineHeight: 1.5, marginBottom: 12 }}>Ответы кандидата не сохранятся.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="sa-btn" data-lens-btn="soft" style={{ ...ghostBtn, flex: 1 }} onClick={() => setConfirmLeave(false)}>Продолжить</button>
              <button className="sa-btn" data-lens-btn="danger" style={{ ...ghostBtn, flex: 1, color: RED, borderColor: RED }}
                onClick={() => { setConfirmLeave(false); setPhase("intro"); }}>Прервать</button>
            </div>
          </div>
        )}

        {/* ── ГЛАВНАЯ ── */}
        {phase === "intro" && (
          <>
            <div data-lens-card="" style={{ ...glass, marginBottom: 16 }}>
              <div style={{ marginBottom: 8, display: "flex" }}>{MOD_SVG["🤝"](gold, 26)}</div>
              <div style={{ ...T.bold, marginTop: 2, marginBottom: 6 }}>Собеседование в приложении</div>
              <div style={{ ...T.modSub, color: sub, lineHeight: 1.6 }}>
                После короткой анкеты опыта тест подстраивается под кандидата: новичка проверяем на здравый смысл
                и характер, а опытного на знание профессии. В тесте рабочие ситуации, вопросы-приоритеты, которые
                не угадать, и самооценка в конце. Правильные ответы кандидату не показываются;
                результат открываешь ты, когда телефон вернётся.
              </div>
            </div>
            <button className="sa-btn" data-lens-btn="main" style={goldBtn} onClick={startSetup}>Начать собеседование</button>

            {/* v66 (Доп. 379): AI HR — бета или проверен; два условия коротко, тап — «Проверка AI HR» */}
            <div className="sa-btn" data-lens-card="" data-hr-row={hrSt.beta ? "beta" : "ok"} role="button" tabIndex={0}
              onClick={() => { vibrate("light"); setPhase("eval"); }} {...onActivate(() => setPhase("eval"))}
              style={{ ...glass, padding: "12px 14px", marginTop: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ display: "flex", flexShrink: 0 }}>{hrSt.beta ? UI_SVG.target(gold, 20) : UI_SVG.checkCircle(GREEN, 20)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...T.bold, marginTop: 2, marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}>
                  AI HR
                  <span style={{ ...labelStyle(13), color: hrSt.beta ? gold : GREEN, border: `1px solid ${hrSt.beta ? gold : GREEN}66`, borderRadius: RADIUS.pill, padding: "0 7px" }}>{hrSt.beta ? "бета" : "проверен"}</span>
                </div>
                <div style={{ color: sub, fontSize: 12, lineHeight: 1.45 }}>
                  эталоны: {hrSt.ref ? (hrSt.stale ? "проверить на новой модели" : `${hrSt.ref.match} из ${hrSt.ref.n}`) : "не проверяли"} · ваши решения: {hrSt.real.n ? `совпало ${hrSt.real.agree} из ${hrSt.real.n}` : `0 из ${REAL_N}`}
                </div>
              </div>
              <span style={{ color: gold, fontSize: 18, flexShrink: 0 }}>›</span>
            </div>

            {results.length > 0 && (
              <>
                <div style={{ ...secLabel, margin: "22px 2px 10px" }}>История · {results.length}</div>
                {/* v66: насколько ИИ совпадает с решениями руководителя — второе условие снятия «беты» */}
                {hrSt.real.n > 0 ? (
                  <div data-ai-agree={`${hrSt.real.agree}/${hrSt.real.n}`} style={{ ...T.modSub, color: sub, fontSize: 12.5, lineHeight: 1.5, margin: "-4px 2px 10px" }}>
                    ИИ и ваши решения: совпало <b style={{ color: gold }}>{hrSt.real.agree} из {hrSt.real.n}</b>
                    {hrSt.real.n >= 5 ? ` (${Math.round((hrSt.real.agree / hrSt.real.n) * 100)}%)` : ""}
                    {hrSt.real.n >= REAL_N ? ` на последних ${REAL_N}` : ""}.
                  </div>
                ) : null}
                {results.map(r => {
                  const v = verdictOf(r.pct, r.level || "pro");
                  const open = openedResult === r.id;
                  const cal = calibrationOf(r.selfBand, r.pct);
                  return (
                    <div key={r.id} data-cand-row={r.id} data-lens-card="" style={{ ...glass, padding: "13px 14px", marginBottom: 8, cursor: "pointer" }}
                      onClick={() => { vibrate("light"); setOpenedResult(open ? null : r.id); }}
                      {...onActivate(() => setOpenedResult(open ? null : r.id))}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {/* v66: у AI-интервью — балл из 100 (не «процент верных»), цвет — по категории ИИ */}
                        <div style={{ width: 40, textAlign: "center", color: isAiRec(r) && aiCatOf(r) ? catColorOf(aiCatOf(r)) : v.color, fontFamily: "Georgia, serif", fontWeight: "bold", fontSize: 16 }}>{r.pct}{isAiRec(r) ? "" : "%"}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ ...T.bold, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                          <div style={{ color: sub, fontSize: 11 }}>{r.roleLabel} · {r.expLabel || "?"} · {dateFmt(r.date)}</div>
                        </div>
                        <div style={{ textAlign: "right", maxWidth: 120 }}>
                          {/* v66: у AI-интервью — категория ИИ (у прежних — из начала вердикта); ниже — решение руководителя */}
                          {(() => { const ac = aiCatOf(r); return (
                            <div style={{ color: ac ? catColorOf(ac) : v.color, fontSize: 11, fontWeight: "bold" }}>{ac || v.label}</div>
                          ); })()}
                          {r.decision ? <div data-row-decision={r.decision} style={{ color: decisionColor(r.decision), fontSize: 11, marginTop: 2 }}>{(DECISIONS.find(d => d.id === r.decision) || {}).label}</div> : null}
                        </div>
                      </div>
                      {open && (
                        <div style={{ marginTop: 12, borderTop: "1px solid rgba(200,160,80,0.2)", paddingTop: 10 }}>
                          <div style={{ color: sub, fontSize: 12.5, marginBottom: 8 }}>
                            {isAiRec(r) ? `балл ${r.pct} из 100` : `${r.score} из ${r.total}`} · опыт: {r.expLabel || "не указан"}{r.place ? ` (${r.place})` : ""}{r.age ? ` · ${r.age}` : ""}{r.by ? ` · провёл(а): ${r.by}` : ""}{r.srvId ? <> · <Sign n="cloud" s={13} title="сохранено на сервере" style={{ verticalAlign: "-2px" }} /></> : null}
                            {cal ? <> · самооценка: <b style={{ color: cal.color }}>{cal.label}</b></> : null}
                          </div>
                      {r.aiScores ? (
                        // v66: отчёт AI-интервью — баллы и цитаты по темам, что спросить, ответы кандидата, решение
                        <AiReport rec={r} T={T} a11y={a11y} gold={gold} sub={sub} glass={glass} onDecide={decide} compact />
                      ) : (<>
                      {r.aiVerdict && (
                        <div style={{ ...T.modSub, color: sub, fontSize: 12.5, lineHeight: 1.55, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${gold}22` }}>
                          <b style={{ color: gold }}>ИИ:</b> {r.aiVerdict}
                        </div>
                      )}
                          {(r.topics || []).map((t, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, padding: "3px 0" }}>
                              <span style={{ color: T.modTitle.color, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.topic}</span>
                              {/* v66: у прежних AI-интервью балл хранился долей (0,8 из 1) — показываем как балл из 100 */}
                              <span style={{ color: topicColor(t), fontFamily: "monospace", flexShrink: 0 }}>{r.aiVerdict && t.n === 1 && t.ok <= 1 ? Math.round(t.ok * 100) : `${t.ok}/${t.n}`}</span>
                            </div>
                          ))}
                          <Decision rec={r} onDecide={decide} sub={sub} T={T} style={{ marginTop: 10 }} />
                      </>)}
                          <button className="sa-btn" data-lens-btn="danger" style={{ ...ghostBtn, marginTop: 10, color: RED, borderColor: "rgba(224,120,120,0.4)" }}
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

        {/* ── ПРОВЕРКА AI HR (v66) ── */}
        {phase === "eval" && (
          <React.Suspense fallback={<div style={{ ...T.modSub, color: sub, textAlign: "center", padding: 24 }}>Загружаю эталоны…</div>}>
            <HrEval T={T} a11y={a11y} gold={gold} sub={sub} glass={glass} goldBtn={goldBtn} ghostBtn={ghostBtn} secLabel={secLabel}
              status={hrSt} briefs={HR_BRIEF} onSaved={saveHrRef} />
          </React.Suspense>
        )}

        {/* ── ИМЯ И РОЛЬ ── */}
        {phase === "setup" && (
          <>
            <div style={secLabel}>Кого собеседуем</div>
            <input data-lens-field=""
              style={{ ...inputStyle, marginBottom: 16 }}
              placeholder="Имя кандидата" value={name} maxLength={40}
              onChange={e => setName(e.target.value)} />
            {TEST_ROLES.map(rl => (
              <div key={rl.id} className="sa-btn" data-lens-card={role.id === rl.id ? "hi" : ""} onClick={() => { vibrate("light"); setRole(rl); }} {...onActivate(() => setRole(rl))}
                style={{ ...glass, padding: "13px 14px", marginBottom: 8, cursor: "pointer", display: "flex",
                  alignItems: "center", gap: 12, position: "relative", overflow: "hidden",
                  // v65: рамку выбранного меняем целиком (border и borderTop вместе) — иначе React ругается на смесь
                  ...(role.id === rl.id ? { border: a11y ? "1.5px solid #7A5D2A" : "1px solid #C8A96E", borderTop: a11y ? "1.5px solid #7A5D2A" : "1px solid #C8A96E" } : {}) }}>
                <span style={{ display: "flex", flexShrink: 0 }}>{ROLE_ICO[rl.id](role.id === rl.id ? gold : sub)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ ...T.bold, marginTop: 2, marginBottom: 2 }}>{rl.label}</div>
                  <div style={{ color: sub, fontSize: 12.5 }}>{rl.desc}</div>
                </div>
                <span style={{ display: "flex", flexShrink: 0, width: 20, justifyContent: "center" }}>
                  {role.id === rl.id ? UI_SVG.checkCircle(gold, 20) : null}
                </span>
              </div>
            ))}
            {customQs.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <button className="sa-btn" data-lens-btn={useCustom ? "tab" : "soft"} onClick={() => { vibrate("light"); setUseCustom(v => !v); }}
                  style={{ padding: "9px 14px", borderRadius: RADIUS.lg, cursor: "pointer",
                    border: `1px solid ${gold}${useCustom ? "" : "55"}`,
                    background: useCustom ? gold : "transparent",
                    color: useCustom ? "#1A1008" : sub,
                    fontSize: 12.5, fontFamily: "Georgia, serif", fontWeight: "bold", transition: "all 0.15s" }}>
                  {useCustom ? "★" : "☆"} Вопросы твоего ресторана
                </button>
                <div style={{ color: sub, fontSize: 11, lineHeight: 1.45, margin: "6px 2px 0" }}>
                  Доступно {customQs.length}, в тест войдёт до {MAX_CUSTOM_Q}. Включай для кандидатов из твоей сети, которые должны знать регламент.
                </div>
              </div>
            )}
            <button className="sa-btn" data-lens-btn="main" style={{ ...goldBtn, marginTop: 12, opacity: name.trim().length < 2 ? 0.5 : 1 }}
              onClick={() => { if (name.trim().length >= 2) { vibrate("light"); setPhase("profile"); } }}>
              Дальше: анкета опыта
            </button>
          </>
        )}

        {/* ── АНКЕТА ОПЫТА ── */}
        {phase === "profile" && (
          <>
            <div style={{ ...T.modSub, color: sub, lineHeight: 1.55, marginBottom: 12 }}>
              Пара вопросов о кандидате. От ответов зависит, какой тест он получит. Можно заполнить вместе с ним.
            </div>
            <div style={secLabel}>Опыт в гостеприимстве и гастрономии</div>
            {EXPERIENCE.map(x => (
              <div key={x.id} className="sa-btn" data-lens-card={exp?.id === x.id ? "hi" : ""} onClick={() => { vibrate("light"); setExp(x); }} {...onActivate(() => setExp(x))}
                style={{ ...glass, padding: "12px 14px", marginBottom: 8, cursor: "pointer", display: "flex",
                  alignItems: "center", gap: 12, position: "relative", overflow: "hidden",
                  ...(exp?.id === x.id ? { border: a11y ? "1.5px solid #7A5D2A" : "1px solid #C8A96E", borderTop: a11y ? "1.5px solid #7A5D2A" : "1px solid #C8A96E" } : {}) }}>
                <div style={{ flex: 1 }}>
                  <div style={{ ...T.bold, marginTop: 2, marginBottom: 2 }}>{x.label}</div>
                  <div style={{ color: sub, fontSize: 11 }}>{x.note}</div>
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
            <button className="sa-btn" data-lens-btn="main" style={{ ...goldBtn, marginTop: 16, opacity: exp ? 1 : 0.5 }}
              onClick={() => { if (exp) { vibrate("light"); setPhase("handoff"); } }}>
              Дальше
            </button>
          </>
        )}

        {/* ── ПЕРЕДАЧА ТЕЛЕФОНА ── */}
        {phase === "handoff" && (
          <>
            <div data-lens-card="" style={{ ...glass, textAlign: "center", padding: "30px 20px", marginBottom: 16 }}>
              <div style={{ marginBottom: 10, display: "flex", justifyContent: "center" }}>{MOD_SVG["🤲"](gold, 30)}</div>
              <div style={{ ...T.bold, marginTop: 2, marginBottom: 8 }}>Передайте телефон кандидату</div>
              <div style={{ ...T.modSub, color: sub, lineHeight: 1.65 }}>
                <b style={{ color: gold }}>{name.trim()}</b>, вам {level === "none" ? 12 : 15} рабочих ситуаций для роли «{role.label}».
                В каждой всё описано полностью: читайте спокойно, специальных знаний не нужно.
                На вопрос даётся до {SECONDS_PER_Q} секунд. В паре вопросов нужно будет расставить
                действия по порядку: нажимайте их в той очерёдности, как поступили бы.
                Отвечайте честно, как в жизни: здесь важно, как вы рассуждаете.
              </div>
            </div>
            <button className="sa-btn" data-lens-btn="main" style={goldBtn} onClick={startTest}>Начать тест</button>
            <button className="sa-btn" data-lens-btn="soft" onClick={startAi}
              style={{ ...goldBtn, marginTop: 10, background: "transparent", color: gold,
                border: `1px solid ${gold}66`, boxShadow: "none" }}>
              {hrSt.beta ? "AI-интервью · бета" : "AI-интервью"}
            </button>
            <div style={{ ...T.modSub, color: sub, fontSize: 11, textAlign: "center", marginTop: 8, lineHeight: 1.5 }}>
              В AI-режиме кандидат отвечает своими словами, текстом или голосом (волна справа от поля:
              вопросы звучат вслух, ответ записывается сам), а ИИ задаёт уточняющие вопросы
              и оценивает по тем же компетенциям.
              <br /><span style={{ opacity: 0.75 }}>ИИ помогает, окончательное решение принимает менеджер.</span>
            </div>
          </>
        )}

        {/* ── AI-ИНТЕРВЬЮ ── */}
        {phase === "ai" && (
          <>
            <div style={{ ...secLabel, display: "flex", justifyContent: "space-between", gap: 10, margin: hrInfo.v2 ? "0 2px 8px" : "0 2px 10px" }}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>AI-интервью · {name.trim()}</span>
              {/* v66: план ведёт сервер — «тема 2 из 5»; прежняя функция — «ответов: N» */}
              <span data-hr-step="" style={{ flexShrink: 0, whiteSpace: "nowrap" }}>{hrInfo.v2 ? (hrInfo.done ? "Темы пройдены" : `Тема ${Math.min(hrInfo.topic + 1, hrInfo.total)} из ${hrInfo.total}`) : `Ответов: ${aiAnswered}`}</span>
            </div>
            {hrInfo.v2 && hrInfo.total > 0 ? (
              // названия тем кандидату не показываем (подсказывали бы, что проверяют) — только сколько пройдено
              <div data-hr-progress="" aria-hidden style={{ display: "flex", gap: 4, margin: "0 2px 10px" }}>
                {Array.from({ length: hrInfo.total }, (_, k) => {
                  const passed = hrInfo.done || k < hrInfo.topic, cur = !hrInfo.done && k === hrInfo.topic;
                  return <span key={k} data-hr-seg={passed ? "done" : cur ? "cur" : "next"} style={{ flex: 1, height: 3, borderRadius: 2,
                    background: passed ? gold : cur ? `${gold}88` : (a11y ? "rgba(139,106,48,0.18)" : "rgba(255,255,255,0.10)") }} />;
                })}
              </div>
            ) : null}
            <div ref={aiListRef} className="sa-dlgscroll" data-lens-edge=""
              style={{ ...glass, padding: 12, marginBottom: 12, maxHeight: "46vh", overflowY: "auto",
                WebkitOverflowScrolling: "touch", overscrollBehavior: "contain",
                display: "flex", flexDirection: "column", gap: 8 }}>
              {aiMsgs.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "88%", padding: "9px 12px", fontSize: 14, lineHeight: 1.55, fontFamily: "Georgia, serif",
                    ...(m.role === "user"
                      ? (a11y
                        ? { background: "rgba(139,106,48,0.09)", border: "1px solid rgba(139,106,48,0.42)",
                            boxShadow: "inset 0 0 22px rgba(255,255,255,0.40), inset 0 1px 0 rgba(255,255,255,0.70)", color: "#3A2E1C" }
                        : { background: "rgba(200,169,110,0.10)", border: "1px solid rgba(214,178,102,0.35)",
                            boxShadow: "inset 0 0 22px rgba(255,230,170,0.10), inset 0 1px 0 rgba(255,255,255,0.15)", color: "#EFE4C8" })
                      : (a11y
                        ? { background: "rgba(250,242,222,0.55)", border: "1px solid rgba(139,106,48,0.30)",
                            boxShadow: "inset 0 0 22px rgba(255,250,235,0.5), inset 0 1px 0 rgba(255,252,240,0.9)", color: "#3A2E1C" }
                        : { background: "rgba(255,250,238,0.05)", border: "1px solid rgba(255,255,255,0.13)",
                            boxShadow: "inset 0 0 22px rgba(255,248,230,0.07), inset 0 1px 0 rgba(255,255,255,0.10)", color: "#F0E8D8" })),
                    borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px" }}>
                    {m.content}
                    {/* v65: вопрос звучит вслух — значок у него */}
                    {talk && talkState === "speaking" && m.role === "assistant" && i === aiMsgs.length - 1
                      ? <TalkSpeaking style={{ marginLeft: 8, color: gold }} /> : null}
                  </div>
                </div>
              ))}
              {/* v65: кандидат говорит — его пузырь с точками, пока фраза записывается и распознаётся */}
              {talk && (talkState === "hearing" || talkState === "recognizing") ? (
                <div data-talk-pending="" style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ padding: "10px 14px", borderRadius: "14px 14px 4px 14px", color: gold,
                    background: a11y ? "rgba(139,106,48,0.09)" : "rgba(200,169,110,0.10)",
                    border: a11y ? "1px solid rgba(139,106,48,0.42)" : "1px solid rgba(214,178,102,0.35)" }}><TalkDots /></div>
                </div>
              ) : null}
              {aiBusy && (
                <div style={{ display: "flex", gap: 4, padding: "8px 4px" }}>
                  {[0, 1, 2].map(i => <span key={i} className="sa-pulse" style={{ width: 6, height: 6, borderRadius: 3, background: gold, animationDelay: (i * 0.18) + "s" }} />)}
                </div>
              )}
              {aiErr && (
                <div style={{ color: RED, fontSize: 12.5, lineHeight: 1.5, padding: "4px 2px" }}>
                  {aiErr}
                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                    <button className="sa-btn" data-lens-btn="soft" data-hr-retry="" onClick={() => (aiInput.trim() ? aiSend() : aiTurn(aiMsgs))}
                      style={{ padding: "8px 14px", borderRadius: RADIUS.pill, cursor: "pointer", border: `1px solid ${gold}55`, background: "transparent", color: gold, fontFamily: "Georgia, serif", fontSize: 12.5, fontWeight: "bold" }}>↻ Повторить</button>
                    <button className="sa-btn" onClick={() => { setPhase("handoff"); }}
                      style={{ padding: "8px 14px", borderRadius: RADIUS.pill, cursor: "pointer", border: "none", background: "transparent", color: sub, fontFamily: "Georgia, serif", fontSize: 12.5 }}>Назад</button>
                  </div>
                </div>
              )}
            </div>
            {talk ? (
              // v65: разговор голосом — полоса на месте поля; «Стоп» — снова поле (переписка остаётся)
              <div style={{ marginBottom: 10 }} data-hr-talk="">
                <TalkBar who="hr" name="Интервьюер" voice="mentor" phone={{ pitch: 1, rate: 1 }} first={lastAi}
                  ask={talkTurn} onState={setTalkState} onClose={() => setTalk(false)} />
              </div>
            ) : (
            // v121 (Доп. 434), владелец (31.10, снимок): «В AI HR увидел неровность. Ответ голосом съехал вниз». Было: микрофон
            // 44 px прижат к верху ряда, волна 46 px к низу, поле 48 px с отступом 2 снизу, и центры расходились на 5 px. Теперь
            // ряд прижимает всё к низу (поле растёт вверх, кнопки остаются у последней строки), микрофон тоже 46 px, у кнопок
            // отступ 3 снизу: их центры на одной линии с центром поля в одну строку. В «Линзе» (data-hr-inrow) промежуток шире и
            // справа поле 4 px: кольца микрофона и волны не сходятся и не вылезают за край ленты (ui/home-look.jsx, раздел v121)
            <div data-hr-inrow="" style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 10 }}>
              <textarea
                ref={aiInputRef}
                data-lens-field=""
                className={a11y ? "sa-aiinput-light" : "sa-aiinput-dark"}
                value={aiInput}
                rows={1}
                onChange={e => {
                  setAiInput(e.target.value);
                  fitAiInput(e.target);
                }}
                placeholder="Ответ кандидата…"
                maxLength={800}
                style={{ ...inputStyle, flex: 1, minWidth: 0, marginBottom: 2,
                  lineHeight: 1.45, resize: "none", maxHeight: 110, overflowY: "auto" }}
              />
              <div style={{ display: "flex", flexShrink: 0, marginBottom: 3 }}>
              <MicButton a11y={a11y} size={46} sttUrl={`${SUPABASE_URL}/functions/v1/stt`}
                headers={{ apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }}
                onText={t => setAiInput(v => (v ? v.trimEnd() + " " : "") + t)} onBusy={setMicBusy}
                onError={m => { try { window.Telegram?.WebApp?.showAlert?.(m); } catch (e) { alert(m); } }} />
              </div>
              {/* v65: поле пустое — на месте «Отправить» кнопка-волна «Отвечать голосом» */}
              {!aiInput.trim() && talkOk ? (
                <div style={{ alignSelf: "flex-end", display: "flex", marginBottom: 3 }}>
                  <TalkButton size={46} disabled={aiBusy || micBusy} onClick={openTalk} label="Отвечать голосом" />
                </div>
              ) : (
              <button className="sa-btn" onClick={aiSend} disabled={aiBusy || !aiInput.trim()}
                style={{ width: 46, height: 46, alignSelf: "flex-end", marginBottom: 3, borderRadius: RADIUS.md, border: "none", cursor: "pointer", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: aiInput.trim() && !aiBusy ? "linear-gradient(135deg, #C8A96E 0%, #7A5D2A 100%)" : "rgba(160,120,60,0.25)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
              </button>
              )}
            </div>
            )}
            {/* v66: с планом — «Завершить», когда пройдены все темы (раньше — после 4 ответов); можно и раньше */}
            {(hrInfo.v2 ? hrInfo.done : aiAnswered >= 4) && !aiBusy && (
              <button className="sa-btn" data-lens-btn="main" style={goldBtn} onClick={finishAi}>Завершить интервью → оценка</button>
            )}
            {hrInfo.v2 && !hrInfo.done && aiAnswered >= 4 && !aiBusy && (
              <button className="sa-btn" data-lens-btn="soft" data-hr-early="" onClick={finishAi}
                style={{ ...ghostBtn, marginTop: 4, padding: "9px", fontSize: 12.5 }}>Завершить раньше: оценка по пройденным темам</button>
            )}
            <div style={{ ...T.modSub, ...labelStyle(13.5), color: sub, textAlign: "center", marginTop: 8, opacity: 0.75 }}>
              ИИ может ошибаться, решение всегда за менеджером
            </div>
          </>
        )}

        {/* ── ТЕСТ ── */}
        {phase === "test" && q && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ ...T.quizProgress, ...labelStyle(a11y ? 16 : 13), marginBottom: 2 }}>Вопрос {qIdx + 1} / {test.length}</span>
              <span style={{ color: sub, fontSize: 12.5 }}>{name.trim()}</span>
            </div>
            <QTimer key={qIdx} seconds={SECONDS_PER_Q} onExpire={onExpire} />
            {q.scene && (
              <div style={T.simScen}>
                {q.scene}
              </div>
            )}
            <div style={{ ...T.quizQ, marginTop: 2 }}>{q.text}</div>

            {q.type === "order" ? (
              <>
                {q.options.map((opt, i) => {
                  const pos = ordSeq.indexOf(i);
                  return (
                    <button key={i} className="sa-btn sa-opt" onClick={() => tapOrder(i)}
                      style={{ ...T.quizOpt, display: "flex", alignItems: "center", gap: 12, width: "100%",
                        textAlign: "left", fontFamily: "Georgia, serif", ...(pos >= 0 ? optSel : {}) }}>
                      <span style={{ width: 26, height: 26, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "Georgia, serif", fontWeight: "bold", fontSize: 12.5,
                        border: `1.5px solid ${pos >= 0 ? gold : "rgba(200,160,80,0.4)"}`,
                        background: pos >= 0 ? gold : "transparent", color: pos >= 0 ? "#fff" : sub }}>
                        {pos >= 0 ? pos + 1 : ""}
                      </span>
                      <span style={{ flex: 1 }}>{opt}</span>
                    </button>
                  );
                })}
                {ordSeq.length > 0 && ordSeq.length < q.options.length && (
                  <button className="sa-btn" data-lens-btn="soft" style={{ ...ghostBtn, marginTop: 4 }} onClick={() => { vibrate("light"); setOrdSeq([]); }}>
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
            <div data-lens-card="" style={{ ...glass, marginBottom: 12 }}>
              <div style={{ marginBottom: 8, display: "flex" }}>{UI_SVG.target(gold, 24)}</div>
              <div style={{ ...T.bold, marginTop: 2, marginBottom: 6 }}>Последний вопрос: о себе</div>
              <div style={{ ...T.modSub, color: sub, lineHeight: 1.6 }}>
                {name.trim()}, как вам кажется, на какую часть вопросов вы ответили верно? Здесь нет правильного ответа, отвечайте честно.
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
            <div data-lens-card="" style={{ ...glass, textAlign: "center", padding: "36px 20px", marginBottom: 16 }}>
              <div style={{ marginBottom: 10, display: "flex", justifyContent: "center" }}>{MOD_SVG["🤝"](gold, 30)}</div>
              <div style={{ ...T.bold, marginTop: 2, marginBottom: 8 }}>Готово, спасибо!</div>
              <div style={{ ...T.modSub, color: sub, lineHeight: 1.6 }}>
                {name.trim()}, верните телефон менеджеру, пожалуйста.
              </div>
            </div>
            <button className="sa-btn" data-lens-btn="soft" style={ghostBtn} onClick={openResult}>Результат для менеджера</button>
          </>
        )}

        {/* ── РЕЗУЛЬТАТ ── */}
        {/* ── РЕЗУЛЬТАТ AI-ИНТЕРВЬЮ (v66): категория, баллы и доказательства, вопросы на встречу, ответы, решение ── */}
        {phase === "result" && lastRec && (() => {
          const cat = aiCatOf(lastRec);
          const cc = cat === "Рекомендован" ? GREEN : cat === "Не рекомендован" ? RED : GOLD_SOFT;
          return (
            <div data-ai-result="">
              <div data-lens-card="" style={{ ...glass, marginBottom: 12, padding: "22px 16px 16px" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ ...T.resultCircle, borderColor: cc }}>
                    <span style={{ ...T.resultScore, color: cc }}>{lastRec.pct}</span>
                    <span style={{ color: "#a09080", fontSize: 12.5 }}>из 100</span>
                  </div>
                  <div data-ai-cat={cat || ""} style={{ ...T.resultTxt, fontWeight: "bold", color: cc }}>{cat || "Оценка ИИ"}</div>
                </div>
                <div style={{ ...secLabel, textAlign: "center", margin: 0 }}>
                  {name.trim()} · {role.label} · {exp ? exp.label : "?"}{place ? ` · ${place}` : ""}{age ? ` · ${age}` : ""}
                </div>
              </div>
              <AiReport rec={lastRec} T={T} a11y={a11y} gold={gold} sub={sub} glass={glass} onDecide={decide} beta={hrSt.beta} />
              <div style={{ ...T.modSub, color: sub, lineHeight: 1.55, marginBottom: 12 }}>
                ИИ может ошибаться, решение всегда за вами. Отметьте его выше: по таким отметкам видно, насколько ИИ совпадает с вами.
              </div>
              <button className="sa-btn" data-lens-btn="main" style={{ ...goldBtn, marginBottom: 8 }} onClick={() => { vibrate("light"); setPhase("intro"); }}>К списку кандидатов</button>
              <button className="sa-btn" data-lens-btn="soft" style={ghostBtn} onClick={startSetup}>Собеседовать ещё одного</button>
            </div>
          );
        })()}
        {phase === "result" && !lastRec && (() => {
          const v = verdictOf(pct, level);
          const cal = calibrationOf(selfBand, pct);
          return (
            <>
              <div data-lens-card="" style={{ ...glass, marginBottom: 12, padding: "22px 16px 16px" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ ...T.resultCircle, borderColor: v.color }}>
                    <span style={{ ...T.resultScore, color: v.color }}>{pct}%</span>
                    <span style={{ color: "#a09080", fontSize: 12.5 }}>верно</span>
                  </div>
                  <div style={{ ...T.resultTxt, fontWeight: "bold", color: v.color }}>{v.label}</div>
                </div>
                <div style={{ ...secLabel, textAlign: "center", margin: "0 0 10px" }}>
                  {name.trim()} · {role.label} · {exp ? exp.label : "?"}{place ? ` · ${place}` : ""}{age ? ` · ${age}` : ""}
                </div>
                <div style={{ ...T.modSub, color: sub, lineHeight: 1.6, textAlign: "center" }}>{v.note}</div>
              </div>

              {cal && (
                <div data-lens-card="" style={{ ...glass, marginBottom: 12, display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ display: "flex", flexShrink: 0 }}>{UI_SVG.target(gold, 20)}</span>
                  <div>
                    <div style={{ ...T.bold, marginTop: 2, marginBottom: 2 }}>
                      Самооценка: <span style={{ color: cal.color }}>{cal.label}</span>
                    </div>
                    <div style={{ ...T.modSub, color: sub, lineHeight: 1.55 }}>{cal.note}</div>
                  </div>
                </div>
              )}

              {aiVerdict && (
                <div data-lens-card="" style={{ ...glass, marginBottom: 12 }}>
                  <div style={{ ...T.bold, marginTop: 2, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                    Вердикт ИИ
                    <span style={{ ...labelStyle(13), color: gold, border: `1px solid ${gold}66`, borderRadius: RADIUS.pill, padding: "1px 7px" }}>бета</span>
                  </div>
                  <div style={{ ...T.modSub, color: sub, lineHeight: 1.6, marginBottom: aiVerdict.strengths?.length || aiVerdict.growth?.length || aiVerdict.risks?.length ? 10 : 0 }}>{aiVerdict.verdict}</div>
                  {aiVerdict.strengths?.length > 0 && (
                    <div style={{ ...T.modSub, color: sub, lineHeight: 1.55, marginBottom: 6 }}>
                      <b style={{ color: GREEN }}>Сильное:</b> {aiVerdict.strengths.join("; ")}
                    </div>
                  )}
                  {aiVerdict.growth?.length > 0 && (
                    <div style={{ ...T.modSub, color: sub, lineHeight: 1.55, marginBottom: aiVerdict.risks?.length ? 10 : 0 }}>
                      <b style={{ color: gold }}>Над чем работать:</b> {aiVerdict.growth.join("; ")}
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
                <div data-lens-card="" style={{ ...glass, marginBottom: 12 }}>
                  <div style={{ ...T.bold, marginTop: 2, marginBottom: 10 }}>Компетенции от слабых к сильным</div>
                  {topics.map((t, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
                      <span style={{ flex: 1, minWidth: 0, color: T.modTitle.color, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.topic}</span>
                      <div style={{ width: 70, height: 5, borderRadius: 3, background: "rgba(160,120,60,0.18)", overflow: "hidden", flexShrink: 0 }}>
                        <div style={{ height: "100%", width: Math.min(100, (t.ok / t.n) * 100) + "%", background: topicColor(t) }} />
                      </div>
                      <span style={{ color: sub, fontFamily: "monospace", fontSize: 12.5, width: 34, textAlign: "right", flexShrink: 0 }}>{t.ok}/{t.n}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ ...T.modSub, color: sub, lineHeight: 1.55, marginBottom: 12 }}>
                Результат сохранён на этом устройстве. Решение принимай после личного разговора с кандидатом.
              </div>
              <button className="sa-btn" data-lens-btn="main" style={{ ...goldBtn, marginBottom: 8 }} onClick={() => { vibrate("light"); setPhase("intro"); }}>К списку кандидатов</button>
              <button className="sa-btn" data-lens-btn="soft" style={ghostBtn} onClick={startSetup}>Собеседовать ещё одного</button>
            </>
          );
        })()}
      </div>
    </div>
  );
}
