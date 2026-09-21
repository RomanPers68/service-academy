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
  const skips = rj(k.skips, {});
  if (!skips[lessonId]) { skips[lessonId] = skip; wj(k.skips, skips); }   // храним ПЕРВЫЙ выход
  return skip;
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
  const rec = { lessonId: lesson.id, title: lesson.title || "", ...s, at: Date.now(), seen: false };
  const recs = rj(k.recs, []); recs.push(rec); wj(k.recs, recs.slice(-50));
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

// ── Карточка. Не закрывается сама, в отличие от обычной ачивки: разбор надо успеть прочитать.
export function LoopholeCard({ rec, a11y, onClose, onMistakes }) {
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => { const t = setTimeout(() => setShown(true), 20); return () => clearTimeout(t); }, []);
  const C = a11y
    ? { text: "#2A2113", muted: "#5E4E30", gold: "#6B4E14", miss: "#A4452A", hit: "#2F6B45", line: "rgba(107,78,20,0.28)",
        bg: "linear-gradient(180deg, rgba(251,246,234,0.98), rgba(240,229,205,0.98))", dim: "rgba(70,50,20,0.38)",
        glow: "inset 0 0 26px rgba(255,255,255,0.55), inset 0 1px 0 rgba(255,255,255,0.9), 0 10px 34px rgba(90,60,20,0.28)" }
    : { text: "#EFE4C8", muted: "#BFAE8A", gold: GOLD, miss: "#E08A62", hit: "#7FC49A", line: "rgba(214,178,102,0.22)",
        bg: "linear-gradient(180deg, rgba(50,39,21,0.97), rgba(29,22,11,0.97))", dim: "rgba(0,0,0,0.58)",
        glow: "inset 0 0 26px rgba(255,236,190,0.07), inset 0 1px 0 rgba(255,236,190,0.16), 0 12px 38px rgba(0,0,0,0.55)" };
  const serif = "Georgia, 'Times New Roman', serif";
  const list = (rec.wrong || []).slice(0, 5);
  // «В тесте «Тест: философия сервиса»» — слово дважды. Внутри фразы — без «Тест:».
  const bare = String(rec.title || "").replace(/^тест[:.]?\s*/i, "");
  const title = bare ? bare[0].toUpperCase() + bare.slice(1) : "этом";
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1200, background: C.dim, display: "flex",
      alignItems: "flex-end", justifyContent: "center", padding: "0 12px calc(18px + env(safe-area-inset-bottom, 0px))",
      opacity: shown ? 1 : 0, transition: "opacity .3s ease" }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Секретная ачивка «Находчивая жопка»"
        style={{ width: "100%", maxWidth: 460, maxHeight: "84vh", overflowY: "auto", borderRadius: 22,
          padding: "20px 18px 16px", background: C.bg, border: `1px solid ${C.gold}55`, borderTop: `1px solid ${C.gold}99`,
          boxShadow: C.glow, transform: shown ? "translateY(0)" : "translateY(40px)", transition: "transform .45s cubic-bezier(.16,1,.3,1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <span style={{ width: 46, height: 46, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center",
            border: `1px solid ${C.gold}66`, background: a11y ? "rgba(107,78,20,0.08)" : "rgba(214,178,102,0.10)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="8" cy="15" r="4" /><path d="M10.8 12.2 19 4M16 7l2.5 2.5M14 9l2 2" />
            </svg>
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: C.gold, fontFamily: "monospace", fontSize: 10, letterSpacing: 1.6, fontWeight: "bold" }}>СЕКРЕТНАЯ АЧИВКА</div>
            <div style={{ color: C.text, fontFamily: serif, fontSize: 20, fontWeight: "bold", lineHeight: 1.2 }}>«Находчивая жопка»</div>
          </div>
        </div>
        <div style={{ color: C.text, fontFamily: serif, fontSize: 14, lineHeight: 1.5, marginBottom: 12 }}>
          Ах ты, хитрая жопка ☺️ В тесте «{title}» ты вышел на {rec.answered}-м вопросе и прошёл его заново. Находчивость засчитана —
          а ошибки первой попытки мы сохранили:
        </div>
        {list.map((w, i) => (
          <div key={i} style={{ borderTop: `1px solid ${C.line}`, padding: "10px 0 9px" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ color: C.miss, fontSize: 13, lineHeight: 1.4, flexShrink: 0 }}>✕</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: C.text, fontFamily: serif, fontSize: 13.5, fontWeight: "bold", lineHeight: 1.4 }}>{w.q}</div>
                {w.a ? <div style={{ color: C.muted, fontSize: 12.5, lineHeight: 1.45, marginTop: 3 }}>ты ответил: «{w.a}»</div> : null}
                {w.r ? <div style={{ color: C.hit, fontSize: 12.5, lineHeight: 1.45 }}>верно: «{w.r}»</div> : null}
                {w.e ? <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.5, marginTop: 5, paddingLeft: 9, borderLeft: `2px solid ${C.gold}66` }}>{w.e}</div> : null}
              </div>
            </div>
          </div>
        ))}
        {(rec.wrong || []).length > list.length ? <div style={{ color: C.muted, fontSize: 12 }}>и ещё {(rec.wrong || []).length - list.length}</div> : null}
        <div style={{ color: C.muted, fontSize: 12.5, lineHeight: 1.5, margin: "8px 0 14px" }}>
          Эти вопросы уже ждут тебя в «Работе над ошибками» — там они вернутся через день, три и неделю.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onMistakes} style={{ flex: 1, padding: "12px 10px", borderRadius: 14, border: "none", cursor: "pointer",
            background: "linear-gradient(135deg, #D8B97A, #A67C3A)", color: "#1F160A", fontFamily: serif, fontSize: 14, fontWeight: "bold" }}>
            Разобрать ошибки
          </button>
          <button onClick={onClose} style={{ padding: "12px 16px", borderRadius: 14, cursor: "pointer", background: "transparent",
            border: `1px solid ${C.gold}66`, color: C.text, fontFamily: serif, fontSize: 14 }}>
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
}
