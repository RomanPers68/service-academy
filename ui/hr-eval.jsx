// ─────────────────────────────────────────────────────────────────────
// v66 (Доп. 379): «Проверка AI HR» — когда снимаем «бету».
// Владелец: «Как мы можем сделать умнее HR-а, чтобы снять с него подпись „beta“?» «Бета» снимается сама,
// когда выполнены оба условия (lib/hr-quality.js):
//   1) эталоны — 22 собеседования с заранее известным итогом (data/hr-eval.js) прогоняются через ту же оценку,
//      что и живые (ai-hr, assess: 2–3 прогона); категория ИИ совпала в 90%+, ни один красный флаг не пропущен;
//   2) живые — на последних 20 собеседованиях с вашим решением ИИ совпал с вами в 80%+.
// Итог эталонной проверки — общий для руководителей ресторана (этап 28: hr_quality_save / hr_quality_get).
// Экран грузится лениво — эталоны (≈25 КБ) не входят в экран собеседования.
// ─────────────────────────────────────────────────────────────────────
import React from "react";
import { HR_EVAL, HR_EVAL_V, EXP_LABEL, evalMessages } from "../data/hr-eval";
import { evalItem, evalSummary, REF_SHARE, REAL_N, REAL_SHARE } from "../lib/hr-quality";
import { saToken, SUPABASE_URL, SUPABASE_KEY } from "../api/supabase";
import { GREEN, RED, GOLD_SOFT, RADIUS, labelStyle } from "./tokens";
import { UI_SVG } from "./icons";
import { vibrate } from "../lib/utils";

const CONC = 2;   // эталонов одновременно (у каждого на сервере 2–3 прогона модели)
const ROLE_RU = { waiter: "официант", hostess: "хостес", bartender: "бармен", manager: "менеджер" };
const FATAL = { not_configured: "AI-интервью не подключено на сервере (функция ai-hr).", rate_limit: "Лимит ИИ исчерпан — попробуйте позже.",
  auth: "Сессия устарела — войдите в приложение заново.", old_server: "На сервере прежняя функция ai-hr — сначала обновите её (Supabase → Edge Functions → ai-hr, код из комплекта v66)." };
export const pctOf = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }); } catch (e) { return ""; } };
const shortModel = (m) => String(m || "").split("/").pop();

async function assessOne(c, briefs, signal) {
  const { messages, plan } = evalMessages(c);
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/ai-hr`, {
      method: "POST", signal,
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY },
      body: JSON.stringify({
        token: saToken(), mode: "assess", role: c.role, plan, voice: !!c.voice, evalId: c.id, messages,
        candidate: { name: c.name, expLabel: EXP_LABEL[c.level] || "", level: c.level, brief: (briefs && briefs[c.level]) || "" },
      }),
    });
    const d = await r.json().catch(() => null);
    if (d && d.ok && !d.v) return { error: "old_server" };
    return d && d.ok ? d : { error: (d && d.error) || "provider" };
  } catch (e) {
    return { error: signal && signal.aborted ? "stopped" : "network" };
  }
}

export function HrEval({ T, a11y, gold, sub, glass, goldBtn, ghostBtn, secLabel, status, briefs, onSaved }) {
  const [run, setRun] = React.useState(null);      // { items, raw, at, model, total }
  const [busy, setBusy] = React.useState(false);
  const [fatal, setFatal] = React.useState(null);
  const [open, setOpen] = React.useState(null);
  const ctlRef = React.useRef(null);
  React.useEffect(() => () => { try { ctlRef.current && ctlRef.current.abort(); } catch (e) {} }, []);   // ушли с экрана — стоп

  const text = T.modTitle?.color || (a11y ? "#3A2E1C" : "#EFE4C8");
  const small = { ...T.modSub, color: sub, fontSize: 12.5, lineHeight: 1.55 };
  const ref = status.ref, real = status.real;

  const start = async () => {
    if (busy) return;
    vibrate("light");
    const ctl = new AbortController(); ctlRef.current = ctl;
    const at = new Date().toISOString(), items = {}, raw = {};
    let model = "", stopWhy = null;
    setBusy(true); setFatal(null); setOpen(null);
    setRun({ items: {}, raw: {}, at, model: "", total: HR_EVAL.length });
    const queue = HR_EVAL.slice();
    const worker = async () => {
      while (queue.length && !ctl.signal.aborted) {
        const c = queue.shift();
        let got = await assessOne(c, briefs, ctl.signal);
        if (got.error && !FATAL[got.error] && !ctl.signal.aborted) got = await assessOne(c, briefs, ctl.signal);   // разовый сбой — ещё раз
        if (ctl.signal.aborted && got.error === "stopped") return;
        if (FATAL[got.error]) { stopWhy = got.error; ctl.abort(); return; }
        items[c.id] = evalItem(c, got); raw[c.id] = got;
        if (!model && got.model) model = got.model;
        setRun((r) => (r && r.at === at ? { ...r, items: { ...items }, raw: { ...raw }, model: model || r.model } : r));
      }
    };
    await Promise.all(Array.from({ length: CONC }, worker));
    if (ctlRef.current !== ctl) return;
    setBusy(false);
    if (stopWhy) { setFatal(FATAL[stopWhy]); return; }
    const list = HR_EVAL.map((c) => items[c.id]).filter(Boolean);
    const sum = evalSummary(list, HR_EVAL.length);
    if (!sum.complete) return;   // остановили или не все ответили — итог не сохраняем
    vibrate(sum.pass ? "success" : "light");
    onSaved({ v: HR_EVAL_V, at, model, n: sum.n, match: sum.match, missed: sum.missed, flags: HR_EVAL.filter((c) => c.flag).length, pass: sum.pass,
      items: list.map((x) => ({ id: x.id, ok: x.ok, got: x.got, risks: x.risks, missed: x.missed, avg: x.avg })) });
  };
  const stop = () => { vibrate("light"); try { ctlRef.current && ctlRef.current.abort(); } catch (e) {} setBusy(false); };

  const items = run ? run.items : {};
  const doneN = Object.keys(items).length;
  const list = HR_EVAL.map((c) => ({ c, it: items[c.id] || (!run && ref && Array.isArray(ref.items) ? ref.items.find((x) => x.id === c.id) : null) }));
  const shown = list.filter((x) => x.it);
  const sum = run ? evalSummary(HR_EVAL.map((c) => items[c.id]).filter(Boolean), HR_EVAL.length) : null;
  const mark = (ok) => (ok ? UI_OK(GREEN) : UI_NO(a11y ? "#8A7A64" : "#7A6A54"));

  return (
    <div data-hr-eval="">
      {/* ── два условия ── */}
      <div style={{ ...glass, marginBottom: 12 }} data-hr-status={status.beta ? "beta" : "ok"}>
        <div style={{ ...T.bold, marginTop: 2, marginBottom: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          AI HR
          <span style={{ ...labelStyle(13), color: status.beta ? gold : GREEN, border: `1px solid ${status.beta ? gold : GREEN}66`, borderRadius: RADIUS.pill, padding: "1px 7px" }}>
            {status.beta ? "бета" : "проверен"}
          </span>
        </div>
        <div style={{ ...small, marginBottom: 10 }}>
          {status.beta ? "«Бета» снимется сама, когда выполнены оба условия:" : "Оба условия выполнены — подпись «бета» снята. Если поменяете модель ИИ — запустите проверку ещё раз."}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderTop: `1px solid ${gold}18` }} data-hr-ref={status.refOk ? "ok" : "no"}>
          <span style={{ display: "flex", flexShrink: 0, marginTop: 1 }}>{mark(status.refOk)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: text, fontSize: 13.5, fontFamily: "Georgia, serif", fontWeight: "bold" }}>Эталонная проверка</div>
            <div style={small}>
              {ref ? <>совпало <b style={{ color: ref.pass ? GREEN : gold }}>{ref.match} из {ref.n}</b> ({pctOf(ref.match, ref.n)}%) · флагов пропущено: <b style={{ color: ref.missed ? RED : GREEN }}>{ref.missed}</b>{ref.at ? ` · ${fmtDate(ref.at)}` : ""}{ref.model ? ` · ${shortModel(ref.model)}` : ""}{ref.by ? ` · ${ref.by}` : ""}</> : "ещё не запускали"}
              {/* v67: модель сменили — итог прежней модели не считается */}
              {ref && status.stale ? <><br /><span data-hr-stale="" style={{ color: gold }}>проверяли на {shortModel(ref.model)}, а интервью теперь ведёт {shortModel(status.cur)} — запустите проверку ещё раз</span></> : null}
              <br /><span style={{ opacity: 0.8 }}>нужно: {Math.round(REF_SHARE * 100)}% и больше, ни одного пропущенного красного флага</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0 0", borderTop: `1px solid ${gold}18` }} data-hr-real={real.pass ? "ok" : "no"}>
          <span style={{ display: "flex", flexShrink: 0, marginTop: 1 }}>{mark(real.pass)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: text, fontSize: 13.5, fontFamily: "Georgia, serif", fontWeight: "bold" }}>Ваши решения</div>
            <div style={small}>
              {real.n ? <>ИИ совпал с вами <b style={{ color: real.pass ? GREEN : gold }}>{real.agree} из {real.n}</b> ({pctOf(real.agree, real.n)}%)</> : "решений пока нет"}
              {real.need > 0 ? ` · нужно ещё ${real.need} ${plural(real.need)} с решением` : ""}
              <br /><span style={{ opacity: 0.8 }}>нужно: на последних {REAL_N} — {Math.round(REAL_SHARE * 100)}% и больше («Берём / Не берём» в отчёте AI-интервью)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── что проверяем и запуск ── */}
      <div style={{ ...glass, marginBottom: 12 }}>
        <div style={{ ...T.bold, marginTop: 2, marginBottom: 6 }}>Проверка на эталонах</div>
        <div style={{ ...small, marginBottom: 12 }}>
          {HR_EVAL.length} собеседований с заранее известным итогом — официанты, хостес, бармены, менеджеры: сильные и слабые,
          краткие верные ответы, ответы голосом с ошибками распознавания, новичок без опыта и «опыт 3+, а ответы новичка»,
          «красиво, но пусто», грубость, обман, попытка повлиять на оценку. ИИ оценивает каждое так же, как живое собеседование.
          Займёт 3–5 минут и около 50 обращений к модели — не закрывайте экран.
        </div>
        {busy ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", ...small, marginBottom: 6 }}>
              <span data-hr-eval-progress={`${doneN}/${HR_EVAL.length}`}>Проверено {doneN} из {HR_EVAL.length}</span>
              <span>{sum ? `совпало ${sum.match}` : ""}</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: "rgba(160,120,60,0.18)", overflow: "hidden", marginBottom: 12 }}>
              <div style={{ height: "100%", width: pctOf(doneN, HR_EVAL.length) + "%", background: gold, transition: "width .4s ease" }} />
            </div>
            <button className="sa-btn" style={ghostBtn} onClick={stop} data-hr-eval-stop="">Остановить</button>
          </>
        ) : (
          <button className="sa-btn" style={goldBtn} onClick={start} data-hr-eval-start="">{ref || run ? "Проверить ещё раз" : "Запустить проверку"}</button>
        )}
        {fatal ? <div style={{ ...small, color: RED, marginTop: 10 }} data-hr-eval-error="">{fatal}</div> : null}
        {run && !busy && !fatal && sum && !sum.complete ? (
          <div style={{ ...small, marginTop: 10 }} data-hr-eval-stopped="">Проверка не завершена ({doneN} из {HR_EVAL.length}) — итог не сохранён.</div>
        ) : null}
        {run && !busy && sum && sum.complete ? (
          <div data-hr-eval-result={sum.pass ? "pass" : "fail"} style={{ ...small, marginTop: 10, color: sum.pass ? GREEN : text }}>
            <b>Совпало {sum.match} из {sum.n} ({pctOf(sum.match, sum.n)}%)</b>, флагов пропущено: {sum.missed}.{" "}
            {sum.pass ? "Условие выполнено ✓" : `Условие пока не выполнено: нужно ${Math.round(REF_SHARE * 100)}% и ни одного пропущенного флага.`}
          </div>
        ) : null}
      </div>

      {/* ── эталоны по одному ── */}
      {shown.length ? <div style={{ ...secLabel, margin: "18px 2px 10px" }}>{run ? "Эталоны" : "Последняя проверка"} · {shown.length}</div> : null}
      {shown.map(({ c, it }) => {
        const isOpen = open === c.id, d = run && run.raw ? run.raw[c.id] : null;
        const flagTxt = c.flag ? (it.missed ? "флаг пропущен" : "флаг найден") : it.risks ? "лишний флаг" : "";
        const catColor = it.got === "Рекомендован" ? GREEN : it.got === "Не рекомендован" ? RED : GOLD_SOFT;
        return (
          <div key={c.id} data-hr-case={c.id} data-hr-case-ok={it.ok ? "1" : "0"} className="sa-btn"
            onClick={() => { vibrate("light"); setOpen(isOpen ? null : c.id); }}
            style={{ ...glass, padding: "11px 13px", marginBottom: 8, cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* совпало — галочка; не совпало или нет ответа — красный крестик */}
              <span style={{ display: "flex", flexShrink: 0 }}>{it.ok ? UI_OK(GREEN) : UI_SVG.xCircle(RED, 18)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: text, fontSize: 13.5, lineHeight: 1.3, fontFamily: "Georgia, serif", fontWeight: "bold" }}>{c.title}</div>
                <div style={{ color: sub, fontSize: 11.5 }}>{ROLE_RU[c.role]} · {EXP_LABEL[c.level]}{c.voice ? " · голосом" : ""}</div>
              </div>
              <div style={{ textAlign: "right", maxWidth: 128, flexShrink: 0 }}>
                <div style={{ color: it.error ? RED : catColor, fontSize: 11.5, fontWeight: "bold" }}>{it.error ? "нет ответа" : it.got || "—"}</div>
                {flagTxt ? <div style={{ color: it.missed ? RED : c.flag ? GREEN : GOLD_SOFT, fontSize: 11 }}>{flagTxt}</div> : null}
              </div>
            </div>
            {isOpen ? (
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${gold}22` }}>
                <div style={small}>Что проверяем: {c.why}.</div>
                <div style={small}>Ждём: <b style={{ color: text }}>{c.ok.join(" или ")}</b>{c.flag ? " и красный флаг" : ""}{it.avg != null ? ` · средний балл ИИ: ${it.avg}` : ""}</div>
                {d && d.verdict ? <div style={{ ...small, marginTop: 4 }}><b style={{ color: gold }}>ИИ:</b> {d.verdict}</div> : null}
                {d && d.risks && d.risks.length ? <div style={{ ...small, marginTop: 4 }}><b style={{ color: RED }}>Риски:</b> {d.risks.join("; ")}</div> : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function plural(n) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "собеседование";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "собеседования";
  return "собеседований";
}
// значки: выполнено — галочка в круге, нет — пустой круг (без «крестика»: это не ошибка, а «ещё не»)
function UI_OK(c) {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="12" cy="12" r="9.5" stroke={c} strokeWidth="1.8" /><path d="M7.5 12.3l3 3 6-6.3" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
}
function UI_NO(c) {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="12" cy="12" r="9.5" stroke={c} strokeWidth="1.8" strokeDasharray="3 3" /></svg>);
}
