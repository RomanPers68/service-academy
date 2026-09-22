// ui/loophole.jsx — секретная ачивка «Находчивая жопка» (название — решение владельца).
//
// Тест сдаётся один раз: запирается, когда результат 70%+ и нажато «Продолжить ✓».
// Провал (меньше 70% или три ошибки) — официальная пересдача, это НЕ лазейка.
// Лазейка — выйти раньше конца («‹» посреди теста, закрыть приложение) или уйти
// с проходного результата, не нажав «Продолжить»: ошибки не сохраняются, и тест
// можно пройти заново, уже зная ответы.
//
// Отличить одно от другого может только приложение, поэтому попытка живёт здесь,
// на телефоне сотрудника. Сдал тест после выхода — получает карточку: «Ах ты,
// хитрая жопка», и разбор ошибок первой попытки. Видит только он (и руководители —
// в «Аналитике → Лазейки», через сервер, этап 15). Коллегам не видно.
import React from "react";
import { GOLD } from "./tokens";

const K = (uk) => ({ tries: "sa_qtry" + uk, skips: "sa_qskip" + uk, recs: "sa_loopholes" + uk });
const rj = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } };
const wj = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const cut = (s, n) => String(s == null ? "" : s).slice(0, n);

// Ответ в текущей попытке. ended — тест дошёл до экрана результата:
// "pass" (70%+ без блокировки) или "fail" (официальный провал).
export function loopTrack(uk, lesson, q, idx, ended) {
  const k = K(uk); const tries = rj(k.tries, {});
  const total = (lesson.questions || []).length;
  const t = tries[lesson.id] || { answers: [], total };
  t.answers.push({ q: cut(q.q, 300), a: cut((q.options || [])[idx], 300), r: cut((q.options || [])[q.correct], 300),
    e: cut(q.explanation, 600), ok: idx === q.correct });
  t.total = total;
  if (ended) t.ended = ended;
  tries[lesson.id] = t; wj(k.tries, tries);
}

// Попытка закончилась НЕ через «Продолжить ✓». Вернёт выход-лазейку или null.
function finalize(uk, lessonId) {
  const k = K(uk); const tries = rj(k.tries, {}); const t = tries[lessonId];
  delete tries[lessonId]; wj(k.tries, tries);
  if (!t || !t.answers || !t.answers.length || t.ended === "fail") return null;   // официальный провал
  const wrong = t.answers.filter(a => !a.ok);
  if (!wrong.length) return null;   // вышел без ошибок — прервали, стирать нечего
  const skip = { answered: t.answers.length, total: t.total || 0,
    wrong: wrong.map(({ q, a, r, e }) => ({ q, a, r, e })), at: Date.now() };
  // Выходов из одного теста может быть несколько: копим ошибки ВСЕХ, без повторов.
  // «На каком вопросе вышел» — от первого выхода.
  const skips = rj(k.skips, {}); const prev = skips[lessonId];
  if (!prev) skips[lessonId] = { ...skip, exits: 1 };
  else {
    const seen = new Set((prev.wrong || []).map(w => w.q));
    skips[lessonId] = { ...prev, exits: (prev.exits || 1) + 1, wrong: [...(prev.wrong || []), ...skip.wrong.filter(w => !seen.has(w.q))] };
  }
  wj(k.skips, skips);
  return skip;   // на сервер уходит каждый выход отдельно — руководитель видит их число
}
export const loopExit = (uk, lessonId) => finalize(uk, lessonId);   // нажал «‹»
export const loopOpen = (uk, lessonId) => finalize(uk, lessonId);   // открыл тест, а прошлая попытка висит

// Тест сдан. Если до этого был выход — ачивка (запись, карточку покажет App).
export function loopPassed(uk, lesson) {
  const k = K(uk);
  const tries = rj(k.tries, {}); delete tries[lesson.id]; wj(k.tries, tries);
  const skips = rj(k.skips, {}); const s = skips[lesson.id];
  if (!s) return null;
  delete skips[lesson.id]; wj(k.skips, skips);
  const recs = rj(k.recs, []);
  // n — какой это раз: второй и дальше выглядят иначе («снова попался», номер ключа)
  const rec = { lessonId: lesson.id, title: lesson.title || "", ...s, at: Date.now(), seen: false,
    n: ((recs[recs.length - 1] && recs[recs.length - 1].n) || recs.length) + 1 };
  recs.push(rec); wj(k.recs, recs.slice(-50));
  return rec;
}
export const loopUnseen = (uk) => rj(K(uk).recs, []).find(r => !r.seen) || null;
export function loopSeen(uk, rec) {
  const k = K(uk);
  wj(k.recs, rj(k.recs, []).map(r => (r.lessonId === rec.lessonId && r.at === rec.at) ? { ...r, seen: true } : r));
}
// Для сервера: без объяснений — они и так есть в уроке
export const skipPayload = (skip) => ({ p_answered: skip.answered, p_total: skip.total,
  p_wrong: (skip.wrong || []).map(({ q, a, r }) => ({ q, a, r })) });


// ── Какой раз попался: первый — «Ах ты…», дальше — повторы узнаются
export const loopWords = (n = 1) => ({
  teaser: n <= 1 ? "Кажется, ты кое-что нашёл…" : n === 2 ? "Снова ты? Ещё один ключ в копилке…"
        : n === 3 ? "Третий ключ. Это уже привычка?" : `Ключ №${n}. Копилка тяжелеет…`,
  punch: n <= 1 ? "Ах ты, хитрая жопка ☺️" : n === 2 ? "Опять ты, хитрая жопка ☺️" : "И снова здравствуй, хитрая жопка ☺️",
  stampTop: n <= 1 ? null : n === 2 ? "СНОВА" : `${n}-Й РАЗ`,
});
// Золотой кружок с номером ключа на медальоне — со второго раза
const numBadge = (n, a11y) => n > 1 ? (
  <span style={{ position: "absolute", top: -3, right: -5, minWidth: 20, height: 20, padding: "0 5px", borderRadius: 10,
    display: "grid", placeItems: "center", fontFamily: "Georgia, serif", fontSize: 11.5, fontWeight: "bold", color: "#1F160A",
    background: "linear-gradient(135deg, #F1DFA8, #B8914A)", border: `2px solid ${a11y ? "#F6EEDB" : "#2A2012"}`,
    boxShadow: "0 2px 6px rgba(0,0,0,0.35)" }}>{n}</span>) : null;

// ── Карточка. Не закрывается сама: разбор надо успеть прочитать.
// Настроение — «тебя раскусили», а не «ты победил»: без конфетти и кубков (решение
// владельца). Золотой медальон с ключом и отблеском; через полсекунды наискосок падает
// штамп «ПОПАЛСЯ», и карточка вздрагивает от удара.
const CSS = `
@keyframes laStamp { 0% { transform: scale(2.6) rotate(-24deg); opacity: 0 } 55% { transform: scale(.93) rotate(-9deg); opacity: .96 } 100% { transform: scale(1) rotate(-11deg); opacity: .93 } }
@keyframes laThump { 0%,100% { transform: translateY(0) } 35% { transform: translateY(3px) } 65% { transform: translateY(-1px) } }
@keyframes laTurn { 0%,62%,100% { transform: rotate(0deg) } 70% { transform: rotate(-32deg) } 80% { transform: rotate(14deg) } 88% { transform: rotate(-6deg) } }
@keyframes laHalo { 0%,100% { box-shadow: 0 0 0 0 rgba(214,178,102,0.0), 0 0 14px rgba(214,178,102,0.25) } 50% { box-shadow: 0 0 0 5px rgba(214,178,102,0.10), 0 0 22px rgba(214,178,102,0.45) } }
@media (prefers-reduced-motion: reduce) {
  .la-a { animation: none !important }
  .la-stamp { animation: none !important; opacity: .93 !important }   /* без анимации штамп просто стоит */
}
`;
export function LoopholeCard({ rec, rank, a11y, onClose, onMistakes }) {
  const [shown, setShown] = React.useState(false);
  // Первые 0,8 с тап мимо карточки не закрывает её. Жалоба владельца: «тапнул на баннер —
  // следующая страница схлопнулась». Баннер гаснет, карточка ещё не встала — рука тапает
  // второй раз, и этот тап попадал в затемнение вокруг карточки, закрывая её (и ачивка
  // считалась просмотренной). Кнопки внутри работают сразу.
  const armed = React.useRef(false);
  React.useEffect(() => { const t = setTimeout(() => setShown(true), 20); const a = setTimeout(() => { armed.current = true; }, 800);
    return () => { clearTimeout(t); clearTimeout(a); }; }, []);
  const backdropTap = () => { if (armed.current) onClose && onClose(); };
  const narrow = typeof window !== "undefined" && window.innerWidth < 380;
  const C = a11y
    ? { text: "#2A2113", muted: "#5E4E30", gold: "#6B4E14", miss: "#A4452A", hit: "#2F6B45",
        ink: "#962F21", dim: "rgba(70,50,20,0.22)", foot: "rgba(250,244,230,0.78)",
        // «Морозный лёд» (просьба владельца): полупрозрачное стекло, изморозь, блики по углам.
        // Чернила штампа ярче прежних: на стекле мелкое «СНОВА» давало 4,3–4,5 при норме 4,5.
        // Изморозь (крапинки) и пробегающий проблеск убраны по просьбе владельца (правка 152):
        // остаётся стекло и анимация движения.
        bg: "radial-gradient(120% 70% at 0% 0%, rgba(255,255,255,0.65), transparent 55%), radial-gradient(120% 70% at 100% 100%, rgba(255,255,255,0.4), transparent 60%), rgba(255,250,240,0.66)",
        edge: "rgba(255,255,255,0.9)", edgeTop: "rgba(255,255,255,1)",
        plate: "rgba(255,255,255,0.55)", plateBd: "rgba(107,78,20,0.20)", title: "linear-gradient(90deg, #7A5716, #A67C3A 45%, #6B4E14)",
        glow: "inset 0 0 30px rgba(255,255,255,0.55), inset 0 1px 0 rgba(255,255,255,1), 0 14px 38px rgba(90,60,20,0.22)" }
    : { text: "#EFE4C8", muted: "#BFAE8A", gold: GOLD, miss: "#E08A62", hit: "#7FC49A",
        ink: "#E36A52", dim: "rgba(8,6,3,0.44)", foot: "rgba(26,20,10,0.72)",
        bg: "radial-gradient(120% 70% at 0% 0%, rgba(255,244,215,0.12), transparent 55%), radial-gradient(120% 70% at 100% 100%, rgba(255,244,215,0.07), transparent 60%), rgba(26,20,10,0.60)",
        edge: "rgba(255,240,205,0.30)", edgeTop: "rgba(255,244,215,0.60)",
        plate: "rgba(255,236,190,0.045)", plateBd: "rgba(214,178,102,0.18)", title: "linear-gradient(90deg, #F1DFA8, #C8A96E 45%, #F6E8BE)",
        glow: "inset 0 0 40px rgba(255,236,190,0.08), inset 0 1px 0 rgba(255,244,215,0.38), 0 16px 44px rgba(0,0,0,0.5), 0 0 60px rgba(214,178,102,0.10)" };
  const serif = "Georgia, 'Times New Roman', serif";
  const list = (rec.wrong || []).slice(0, 5);
  // «В тесте «Тест: философия сервиса»» — слово дважды. Внутри фразы — без «Тест:».
  const bare = String(rec.title || "").replace(/^тест[:.]?\s*/i, "");
  const title = bare ? bare[0].toUpperCase() + bare.slice(1) : "этом";
  // Тайный зачёт ключей (этап 16): внутри своего заведения, только числа, без имён
  const kl = (n) => { const d = n % 10, h = n % 100; return (d === 1 && h !== 11) ? "ключ" : (d >= 2 && d <= 4 && (h < 12 || h > 14)) ? "ключа" : "ключей"; };
  const keySvg = (on, s = 19) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={on ? C.gold : (a11y ? "rgba(107,78,20,0.38)" : "rgba(214,178,102,0.34)")}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={on ? undefined : "2.4 2.4"} aria-hidden="true"
      style={on ? { filter: a11y ? "none" : "drop-shadow(0 0 3px rgba(214,178,102,0.45))" } : undefined}>
      <circle cx="8" cy="15" r="4" /><path d="M10.8 12.2 19 4M16 7l2.5 2.5M14 9l2 2" />
    </svg>);
  const tag = (t, c) => <span style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: 1.4, color: c, fontWeight: "bold", marginRight: 6 }}>{t}</span>;
  const ring = narrow ? 60 : 68;
  const n = rec.n || 1; const W = loopWords(n);
  return (
    <div onClick={backdropTap} style={{ position: "fixed", inset: 0, zIndex: 1200, background: C.dim, display: "flex",
      alignItems: "flex-end", justifyContent: "center", padding: "0 12px calc(18px + env(safe-area-inset-bottom, 0px))",
      opacity: shown ? 1 : 0, transition: "opacity .3s ease",
      WebkitBackdropFilter: "blur(3px)", backdropFilter: "blur(3px)" }}>
      <style>{CSS}</style>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Секретная ачивка «Находчивая жопка»" className="la-a"
        style={{ width: "100%", maxWidth: 460, maxHeight: "86vh", overflowY: "auto", borderRadius: 24,
          padding: "22px 18px 16px", background: C.bg, border: `1px solid ${C.edge}`, borderTop: `1px solid ${C.edgeTop}`,
          WebkitBackdropFilter: "blur(22px) saturate(150%)", backdropFilter: "blur(22px) saturate(150%)",
          textShadow: a11y ? "0 1px 1px rgba(255,255,255,0.6)" : "0 1px 2px rgba(0,0,0,0.5)",
          boxShadow: C.glow, transform: shown ? "translateY(0)" : "translateY(40px)", transition: "transform .5s cubic-bezier(.16,1,.3,1)",
          animation: "laThump .35s ease-out .95s" }}>
        {/* Шапка: медальон, подпись, название — и штамп поверх */}
        {/* Двухстрочный штамп («СНОВА · ПОПАЛСЯ») выше обычного: шапка опускается, иначе
            карточка, которая прокручивается внутри, срезала бы его верхнюю строку */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative", marginTop: W.stampTop ? 12 : 0 }}>
          <span style={{ position: "relative", flexShrink: 0 }}>
          <span style={{ position: "relative", width: ring, height: ring, borderRadius: "50%", flexShrink: 0, overflow: "hidden", display: "grid", placeItems: "center",
            background: "conic-gradient(from 200deg, #F4E2AE, #A67C3A, #E9CF8E, #8B6A30, #F4E2AE)",
            boxShadow: `0 0 26px ${a11y ? "rgba(166,124,58,0.35)" : "rgba(214,178,102,0.28)"}` }}>
            <span style={{ width: ring - 10, height: ring - 10, borderRadius: "50%", display: "grid", placeItems: "center",
              background: a11y ? "radial-gradient(circle at 35% 30%, #FFF8E8, #EADBB8)" : "radial-gradient(circle at 35% 30%, #4A3A20, #1E160A)",
              boxShadow: a11y ? "inset 0 2px 6px rgba(107,78,20,0.25)" : "inset 0 2px 8px rgba(0,0,0,0.6)" }}>
              <svg width={narrow ? 25 : 28} height={narrow ? 25 : 28} viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="8" cy="15" r="4" /><path d="M10.8 12.2 19 4M16 7l2.5 2.5M14 9l2 2" />
              </svg>
            </span>
          </span>
          {numBadge(n, a11y)}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ height: 1, width: 16, background: `linear-gradient(90deg, transparent, ${C.gold})` }} />
              <span style={{ color: C.gold, fontFamily: "monospace", fontSize: 10, letterSpacing: 2, fontWeight: "bold" }}>СЕКРЕТНАЯ АЧИВКА</span>
            </div>
            <div style={{ fontFamily: serif, fontSize: narrow ? 20 : 22, fontWeight: "bold", lineHeight: 1.15, marginTop: 5,
              background: C.title, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", textShadow: "none" }}>«Находчивая жопка»</div>
          </div>
          <div className="la-stamp" style={{ position: "absolute", right: -2, top: W.stampTop ? -22 : -16, padding: W.stampTop ? "3px 12px 4px" : "5px 12px", border: `2.5px double ${C.ink}`, borderRadius: 7,
            display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.1,
            color: C.ink, fontFamily: serif, fontWeight: "bold", fontSize: 14, letterSpacing: 2.6, background: a11y ? "rgba(168,57,42,0.05)" : "rgba(210,85,63,0.06)",
            transform: "rotate(-11deg)", opacity: 0, animation: "laStamp .45s cubic-bezier(.2,1.4,.4,1) .55s forwards",
            textShadow: a11y ? "none" : "0 0 1px rgba(210,85,63,0.6)", pointerEvents: "none" }}>
            {W.stampTop ? <span style={{ fontSize: 9, letterSpacing: 2.4 }}>{W.stampTop}</span> : null}
            <span>ПОПАЛСЯ</span>
          </div>
        </div>
        <div style={{ color: C.text, fontFamily: serif, fontStyle: "italic", fontSize: 17, margin: "14px 0 6px" }}>{W.punch}</div>
        <div style={{ color: C.muted, fontFamily: serif, fontSize: 13.5, lineHeight: 1.55, marginBottom: 12 }}>
          {(rec.exits || 1) > 1
            ? <>В тесте «{title}» ты выходил {rec.exits} {((n) => { const d = n % 10, h = n % 100; return (d >= 2 && d <= 4 && (h < 12 || h > 14)) ? "раза" : "раз"; })(rec.exits)} — впервые на {rec.answered}-м вопросе — и прошёл его заново.</>
            : <>В тесте «{title}» ты вышел на {rec.answered}-м вопросе и прошёл его заново.</>}
          {" "}Находчивость засчитана — а ошибки, которые ты стёр, мы сохранили:
        </div>
        {rank && rank.ok && rank.mine > 0 ? (() => {
          // Фразы — владельца: «хитрый», «пока впереди»
          const need = Math.max(0, rank.leader - rank.mine + 1);
          const first = rank.place === 1 && !rank.tied;
          const phrase = first ? "Ты впереди всех хитрецов. Пока впереди 😉"
            : rank.place === 1 ? "Ты делишь первое место с другими хитрецами. Ещё ключ — и оторвёшься."
            : `Ты хитрый, но до первого места — ещё ${need} ${kl(need)}.`;
          const owned = Math.min(rank.mine, 8);
          const missing = first ? 0 : Math.max(0, Math.min(rank.place === 1 ? 1 : need, 8 - owned));
          return (
            <div style={{ background: C.plate, border: `1px solid ${C.gold}55`, borderRadius: 14, padding: "11px 12px", margin: "2px 0 12px",
              boxShadow: a11y ? "inset 0 1px 0 rgba(255,255,255,0.9)" : "inset 0 1px 0 rgba(255,236,190,0.10), 0 0 18px rgba(214,178,102,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <span style={{ color: C.gold, fontFamily: "monospace", fontSize: 9.5, letterSpacing: 1.8, fontWeight: "bold" }}>ТАЙНЫЙ ЗАЧЁТ КЛЮЧЕЙ</span>
                <span style={{ color: C.muted, fontSize: 11.5 }}>{rank.place}-е место из {Math.max(rank.players, rank.place)}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, margin: "9px 0 8px", flexWrap: "wrap" }}>
                {Array.from({ length: owned }).map((_, i) => <span key={"o" + i}>{keySvg(true)}</span>)}
                {Array.from({ length: missing }).map((_, i) => <span key={"m" + i}>{keySvg(false)}</span>)}
                <span style={{ color: C.text, fontFamily: serif, fontSize: 14, fontWeight: "bold", marginLeft: 6 }}>{rank.mine} {kl(rank.mine)}</span>
              </div>
              <div style={{ color: C.text, fontFamily: serif, fontStyle: "italic", fontSize: 13.5, lineHeight: 1.45 }}>{phrase}</div>
            </div>);
        })() : null}
        {list.map((w, i) => (
          <div key={i} style={{ background: C.plate, border: `1px solid ${C.plateBd}`, borderRadius: 14, padding: "11px 12px", marginBottom: 8,
            boxShadow: a11y ? "inset 0 1px 0 rgba(255,255,255,0.9)" : "inset 0 1px 0 rgba(255,236,190,0.08)" }}>
            <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
              <span style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", marginTop: 1,
                border: `1px solid ${C.miss}88`, color: C.miss, fontSize: 11 }}>✕</span>
              <div style={{ color: C.text, fontFamily: serif, fontSize: 14, fontWeight: "bold", lineHeight: 1.4 }}>{w.q}</div>
            </div>
            <div style={{ paddingLeft: 29, marginTop: 7 }}>
              {w.a ? <div style={{ color: C.muted, fontSize: 12.5, lineHeight: 1.45 }}>{tag("ТЫ ОТВЕТИЛ", C.muted)}{w.a}</div> : null}
              {w.r ? <div style={{ color: C.hit, fontSize: 12.5, lineHeight: 1.45, marginTop: 3 }}>{tag("ВЕРНО", C.hit)}{w.r}</div> : null}
              {w.e ? <div style={{ color: C.muted, fontFamily: serif, fontStyle: "italic", fontSize: 12.5, lineHeight: 1.5, marginTop: 7,
                paddingLeft: 10, borderLeft: `2px solid ${C.gold}77` }}>{w.e}</div> : null}
            </div>
          </div>
        ))}
        {(rec.wrong || []).length > list.length ? <div style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>и ещё {(rec.wrong || []).length - list.length}</div> : null}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", color: C.muted, fontSize: 12.5, lineHeight: 1.5, margin: "6px 0 14px" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true"><path d="M3 12a9 9 0 0 1 15.5-6.2M21 4v5h-5M21 12a9 9 0 0 1-15.5 6.2M3 20v-5h5" /></svg>
          <span>Эти вопросы уже ждут тебя в «Работе над ошибками» — вернутся через день, три и неделю.</span>
        </div>
        {/* Кнопки прилипают к низу: с двумя ошибками и зачётом карточка выше экрана и
            прокручивается внутри — без этого кнопки уезжали вниз, их было не видно */}
        <div style={{ display: "flex", gap: 10, position: "sticky", bottom: -16, margin: "0 -18px -16px", padding: "18px 18px 16px", zIndex: 1 }}>
          {/* матовый слой под кнопками: размытие плавно нарастает сверху вниз */}
          <span aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: -1, pointerEvents: "none",
            background: `linear-gradient(180deg, transparent, ${C.foot} 45%)`,
            WebkitBackdropFilter: "blur(10px)", backdropFilter: "blur(10px)",
            WebkitMaskImage: "linear-gradient(180deg, transparent, #000 45%)", maskImage: "linear-gradient(180deg, transparent, #000 45%)" }} />
          <button onClick={onMistakes} style={{ position: "relative", overflow: "hidden", flex: 1, padding: "13px 10px", borderRadius: 14, border: "none", cursor: "pointer",
            background: "linear-gradient(135deg, #E2C487, #A67C3A)", color: "#1F160A", fontFamily: serif, fontSize: 14.5, fontWeight: "bold",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45), 0 6px 18px rgba(166,124,58,0.35)" }}>
            <span style={{ position: "relative" }}>Разобрать ошибки</span>
          </button>
          <button onClick={onClose} style={{ padding: "13px 16px", borderRadius: 14, cursor: "pointer", background: "transparent",
            border: `1px solid ${C.gold}66`, color: C.text, fontFamily: serif, fontSize: 14 }}>Понятно</button>
        </div>
      </div>
    </div>
  );
}


// ── Баннер. Ачивка не выпрыгивает целиком: сверху плавно выезжает плашка-загадка,
// как уведомление. Тап — раскрывается карточка (решение владельца). Ключик в
// медальоне время от времени поворачивается, как в замке; по плашке пробегает блик.
// Не тапнули за 12 секунд — плашка тихо уезжает; ачивка не просмотрена и
// вернётся при следующем входе.
export function LoopholeBanner({ a11y, n = 1, onOpen, onHide }) {
  const [phase, setPhase] = React.useState("in");   // in → shown → out
  const hideRef = React.useRef(onHide); hideRef.current = onHide;
  React.useEffect(() => {
    const t1 = setTimeout(() => setPhase("shown"), 40);
    const t2 = setTimeout(() => { setPhase("out"); setTimeout(() => hideRef.current && hideRef.current(), 500); }, 12000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  const open = () => { setPhase("open"); setTimeout(() => onOpen && onOpen(), 220); };
  const gold = a11y ? "#6B4E14" : GOLD;
  const text = a11y ? "#2A2113" : "#EFE4C8";
  const muted = a11y ? "#5E4E30" : "#BFAE8A";
  const serif = "Georgia, 'Times New Roman', serif";
  const off = phase === "in" || phase === "out";
  return (
    <div onClick={open} role="button" aria-label="Секретная ачивка. Тапни, чтобы посмотреть" className="la-a"
      style={{ position: "fixed", zIndex: 1250, left: 12, right: 12, top: "calc(62px + env(safe-area-inset-top, 0px))",   // под верхней строкой «SA · Для чтения»
        maxWidth: 460, margin: "0 auto", cursor: "pointer", WebkitTapHighlightColor: "transparent",
        transform: off ? "translateY(-150%)" : phase === "open" ? "translateY(-8px) scale(.96)" : "translateY(0)",
        opacity: phase === "open" ? 0 : 1,
        transition: phase === "open" ? "transform .22s ease, opacity .22s ease" : "transform .7s cubic-bezier(.2,1.3,.35,1)" }}>
      <style>{CSS}</style>
      {/* «Морозный лёд» (просьба владельца): почти прозрачное стекло — под ним размыто
          видна страница; изморозь по краям, блик по верхней кромке, светлый контур. */}
      <div style={{ position: "relative", overflow: "hidden", display: "flex", alignItems: "center", gap: 12, padding: "11px 14px 11px 11px",
        borderRadius: 20,
        border: `1px solid ${a11y ? "rgba(255,255,255,0.85)" : "rgba(255,240,205,0.30)"}`,
        borderTop: `1px solid ${a11y ? "rgba(255,255,255,1)" : "rgba(255,244,215,0.55)"}`,
        background: a11y
          ? "radial-gradient(120% 140% at 0% 0%, rgba(255,255,255,0.55), transparent 55%), radial-gradient(120% 140% at 100% 100%, rgba(255,255,255,0.35), transparent 60%), rgba(255,250,240,0.38)"
          : "radial-gradient(120% 140% at 0% 0%, rgba(255,244,215,0.16), transparent 55%), radial-gradient(120% 140% at 100% 100%, rgba(255,244,215,0.10), transparent 60%), rgba(36,28,16,0.30)",
        boxShadow: a11y ? "inset 0 1px 0 rgba(255,255,255,1), inset 0 0 18px rgba(255,255,255,0.45), 0 10px 26px rgba(90,60,20,0.18)"
                        : "inset 0 1px 0 rgba(255,244,215,0.35), inset 0 0 22px rgba(255,236,190,0.10), 0 10px 28px rgba(0,0,0,0.35)",
        WebkitBackdropFilter: "blur(18px) saturate(150%)", backdropFilter: "blur(18px) saturate(150%)",
        textShadow: a11y ? "0 1px 1px rgba(255,255,255,0.7)" : "0 1px 2px rgba(0,0,0,0.55)" }}>
        <span className="la-a" style={{ position: "relative", width: 46, height: 46, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center",
          background: "conic-gradient(from 200deg, #F4E2AE, #A67C3A, #E9CF8E, #8B6A30, #F4E2AE)", animation: "laHalo 2.8s ease-in-out infinite" }}>
          <span style={{ width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center",
            background: a11y ? "radial-gradient(circle at 35% 30%, #FFF8E8, #EADBB8)" : "radial-gradient(circle at 35% 30%, #4A3A20, #1E160A)" }}>
            <svg className="la-a" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true" style={{ transformOrigin: "8px 15px", animation: "laTurn 2.8s ease-in-out .9s infinite" }}>
              <circle cx="8" cy="15" r="4" /><path d="M10.8 12.2 19 4M16 7l2.5 2.5M14 9l2 2" />
            </svg>
          </span>
          {numBadge(n, a11y)}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ color: gold, fontFamily: "monospace", fontSize: 9.5, letterSpacing: 1.8, fontWeight: "bold" }}>СЕКРЕТНАЯ АЧИВКА</div>
          <div style={{ color: text, fontFamily: serif, fontSize: 15.5, fontWeight: "bold", lineHeight: 1.25, marginTop: 2 }}>Тапни, чтобы посмотреть</div>
          <div style={{ color: muted, fontFamily: serif, fontStyle: "italic", fontSize: 12.5, marginTop: 1 }}>{loopWords(n).teaser}</div>
        </div>
        <span style={{ color: gold, fontSize: 22, lineHeight: 1, flexShrink: 0 }}>›</span>
      </div>
    </div>
  );
}
