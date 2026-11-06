// ui/golist.jsx — v141 (Доп. 458): гоу-лист в брифинге смены.
//
// GoEditor   — руководителю в «Брифинге смены»: две-три позиции из меню и «Барной карты» (в стопе — не выбрать), у каждой
//              три строки: чем хорошо, с чем предложить, фраза гостю (подставляются из карточки, можно поправить или
//              попросить Наставника), «Как вчера» — вчерашний гоу-лист одной кнопкой.
// GoPicker   — выбор: поиск, вкладки «Блюда», «Коктейли», «Вина», «Крепкое».
// GoBody     — гоу-лист для чтения: в брифинге, в показе и у сотрудника; с итогом смены, если он записан.
// GoResult   — «Итог гоу-листа»: сколько продано каждой позиции (по отчёту iiko), этап 50 (brief_go_save).
// Расчёт — lib/golist.js; цвета и стекло — те же, что у брифинга (палитра приходит из ui/briefing.jsx).
import React from "react";
import { createPortal } from "react-dom";
import { vibrate } from "../lib/utils";
import { labelStyle } from "./tokens";
import { rpc, saToken, rpcMissing, SUPABASE_URL, SUPABASE_KEY } from "../api/supabase";
import { GO_MAX, GO_KINDS, GO_KIND_WORD, GO_LIMITS, goCandidates, goSearch, goItem, goNormalize, goRows, goAiPrompt, goParseAi, goSoldNormalize, goSoldLine, dayBefore } from "../lib/golist";

const portal = (el) => (typeof document !== "undefined" && document.body && document.body.nodeType === 1 ? createPortal(el, document.body) : el);
const SHELL = (a11y) => ({ position: "fixed", inset: 0, top: "var(--sa-st, 0px)", zIndex: 1000, boxSizing: "border-box", fontFamily: "Georgia, serif",
  background: a11y ? "#E8DEC8" : "linear-gradient(160deg,#1A1008 0%,#1A1008 100%)", paddingBottom: "env(safe-area-inset-bottom, 0px)", display: "flex", flexDirection: "column" });
const field = (c) => ({ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 10, border: `1px solid ${c.line}`, background: c.a11y ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.25)",
  color: c.text, fontFamily: "Georgia, serif", fontSize: 14, outline: "none" });
const pill = (c, main) => ({ padding: "8px 14px", borderRadius: 999, border: main ? 0 : `1px solid ${c.gold}`, background: main ? c.gold : "transparent", color: main ? "#1A1008" : c.gold,
  fontFamily: "Georgia, serif", fontSize: 13, fontWeight: main ? "bold" : "normal", cursor: "pointer" });
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const dayWord = (day, today) => { if (day === today) return "сегодня"; const [, m, d] = String(day).split("-").map(Number); const dm = m && d ? d + " " + MONTHS[m - 1] : ""; return day === dayBefore(today) ? "вчера" + (dm ? ", " + dm : "") : dm; };
const hm = (iso) => { const t = new Date(iso || ""); return Number.isNaN(t.getTime()) ? "" : String(t.getHours()).padStart(2, "0") + ":" + String(t.getMinutes()).padStart(2, "0"); };

// ── Чтение: позиция за позицией, три строки, итог смены ──────────────────────────────
export function GoBody({ b, c, big = false, sold = null }) {
  const list = goNormalize(b);
  if (!list.length) return null;
  const fs = big ? 21 : 14.5, small = big ? 15 : 12.5;
  const s = sold ? goSoldNormalize(sold, list) : {};
  return (
    <div data-go-body="">
      {list.map((g, i) => (
        <div key={g.id} data-go-item={g.id} style={{ marginBottom: i < list.length - 1 ? (big ? 18 : 11) : 0 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: fs, color: c.text, lineHeight: 1.35 }}>{g.name}
            {s[g.id] != null ? <span data-go-sold={g.id} style={{ fontSize: small, color: c.gold }}> · продано {s[g.id]}</span> : null}</div>
          {goRows(g).map(([k, v]) => (
            <div key={k} style={{ fontSize: small + 1, color: c.text, marginTop: 3, lineHeight: 1.45 }}><span style={{ color: c.gold }}>{k}:</span> {v}</div>))}
        </div>))}
    </div>
  );
}

// ── Выбор из меню и «Барной карты» ───────────────────────────────────────────────────
export function GoPicker({ a11y, c, menu, picked, onPick, onClose }) {
  const all = React.useMemo(() => goCandidates(menu), [menu]);
  const kinds = GO_KINDS.filter(([k]) => all.some((x) => x.kind === k));
  const [tab, setTab] = React.useState(kinds.length ? kinds[0][0] : "dish");
  const [q, setQ] = React.useState("");
  const ids = new Set((picked || []).map((g) => g.id));
  const list = goSearch(q.trim() ? all : all.filter((x) => x.kind === tab), q);
  const full = ids.size >= GO_MAX;
  return portal(
    <div data-go-picker="" role="dialog" aria-modal="true" aria-label="Гоу-лист: выбор из меню" className="sa-layer sa-safex" style={SHELL(a11y)}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "max(14px, calc(44px - var(--sa-st, 0px))) 16px 8px" }}>
        <button type="button" data-sa-back="" data-lens="disc" data-lens-x="" aria-label="Закрыть" onClick={onClose} style={{ border: 0, background: "none", color: c.sub, fontSize: 28, cursor: "pointer", lineHeight: 1, padding: "0 6px 2px 0" }}>×</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 16, color: c.text }}>Гоу-лист</div>
          <div style={{ fontSize: 12.5, color: c.sub }}>Две-три позиции, которые смена советует сегодня</div>
        </div>
        <div data-go-count="" style={{ fontSize: 13, color: c.gold, whiteSpace: "nowrap" }}>{ids.size} из {GO_MAX}</div>
      </div>
      <div style={{ padding: "0 16px 8px" }}>
        <input data-lens-field="" data-go-search="" type="search" value={q} onChange={(e) => setQ(e.target.value.slice(0, 40))} placeholder="Найти в меню" aria-label="Найти в меню" className="sa-field" style={field(c)} />
        {!q.trim() && kinds.length > 1 ? (
          // капсула, как вкладки «Барной карты» (ui/bar-card.jsx): выбранная — золотая плашка
          <div data-lens-seg="flat" role="tablist" aria-label="Что выбрать" style={{ display: "flex", gap: 4, marginTop: 10, padding: 3, borderRadius: 999,
            border: `1px solid ${a11y ? "rgba(139,106,48,0.35)" : "rgba(214,178,102,0.35)"}`, background: a11y ? "rgba(255,255,255,0.45)" : "rgba(255,248,230,0.05)" }}>
            {kinds.map(([k, t]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} data-go-tab={k} data-lens-btn={tab === k ? "tab" : undefined} onClick={() => { vibrate("light"); setTab(k); }}
                style={{ flex: 1, padding: "7px 4px", borderRadius: 999, border: "none", background: tab === k ? "linear-gradient(180deg,#E4C88C," + c.gold + ")" : "transparent",
                  color: tab === k ? "#1a160f" : c.sub, fontWeight: tab === k ? "bold" : "normal", fontFamily: "Georgia, serif", fontSize: 13.5, whiteSpace: "nowrap", cursor: "pointer" }}>{t}</button>))}
          </div>) : null}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 16px", WebkitOverflowScrolling: "touch" }}>
        {!all.length ? <div style={{ fontSize: 13.5, color: c.sub, lineHeight: 1.5, padding: "12px 2px" }}>В меню команды пока пусто. Блюда добавляют в «Меню», вина и крепкое в «Барной карте».</div> : null}
        {all.length && !list.length ? <div style={{ fontSize: 13.5, color: c.sub, padding: "12px 2px" }}>Ничего не нашлось.</div> : null}
        {list.map((x) => {
          const on = ids.has(x.id), off = x.stop || (!on && full);
          const sub = x.stop ? "в стопе" : [GO_KIND_WORD[x.kind], x.src && x.src.cat ? String(x.src.cat) : ""].filter(Boolean).join(" · ");
          return (
            <button key={x.id} type="button" data-go-opt={x.id} data-lens-opt="" aria-pressed={on} disabled={off && !on} onClick={() => { if (off && !on) return; vibrate("light"); onPick(x, !on); }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: "11px 12px", marginBottom: 6, borderRadius: 12, cursor: off && !on ? "default" : "pointer",
                border: `1px solid ${on ? c.gold : c.line}`, background: on ? (a11y ? "rgba(139,106,48,0.14)" : "rgba(200,169,110,0.14)") : "transparent", opacity: off && !on ? 0.45 : 1, fontFamily: "Georgia, serif" }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14.5, color: c.text }}>{x.name}</span>
                <span style={{ display: "block", fontSize: 12, color: x.stop ? c.red : c.sub, marginTop: 1 }}>{sub}</span>
              </span>
              <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: "50%", border: `1px solid ${on ? c.gold : c.line}`, background: on ? c.gold : "transparent", color: "#1A1008",
                display: "grid", placeItems: "center", fontSize: 13, flexShrink: 0 }}>{on ? "✓" : ""}</span>
            </button>);
        })}
      </div>
      <div style={{ padding: "10px 16px 14px" }}>
        <button type="button" data-go-done="" data-lens-btn="main" onClick={onClose} style={{ width: "100%", padding: 14, borderRadius: 16, border: 0, background: c.gold, color: "#1A1008", fontFamily: "Georgia, serif", fontSize: 15, fontWeight: "bold", cursor: "pointer" }}>Готово</button>
      </div>
    </div>
  );
}

// ── Руководителю: блок «Гоу-лист» в брифинге ────────────────────────────────────────
// go — выбранные позиции; setGo(next); prev — { day, items, label } для «Как вчера»; blocked — id позиций, которые сейчас в стопе
export function GoEditor({ a11y, c, menu, go, setGo, isOn, onToggle, prev, blocked, restaurant, onTyping }) {
  const [pick, setPick] = React.useState(false);
  const [ai, setAi] = React.useState({});   // id → "busy" | текст ошибки
  const list = goNormalize(go);
  const bad = new Set(blocked || []);
  const cands = React.useMemo(() => goCandidates(menu), [menu]);
  const onPick = (x, add) => {
    if (add) { if (list.length >= GO_MAX || list.some((g) => g.id === x.id)) return; setGo([...list, goItem(x, menu)]); }
    else setGo(list.filter((g) => g.id !== x.id));
  };
  const edit = (id, k, v) => setGo(list.map((g) => (g.id === id ? { ...g, [k]: v.slice(0, GO_LIMITS[k]) } : g)));
  const remove = (id) => { vibrate("light"); setGo(list.filter((g) => g.id !== id)); };
  const askAi = (g) => {
    if (ai[g.id] === "busy") return;
    setAi((s) => ({ ...s, [g.id]: "busy" }));
    const cand = cands.find((x) => x.id === g.id) || null;
    fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY },
      body: JSON.stringify({ token: saToken(), messages: [{ role: "user", content: goAiPrompt(g, cand, restaurant) }] }) })
      .then((r) => r.json()).then((j) => {
        const p = j && j.ok ? goParseAi(j.reply) : null;
        if (!p) { setAi((s) => ({ ...s, [g.id]: "Наставник не ответил. Попробуй ещё раз." })); return; }
        vibrate("success");
        setGo(goNormalize(go).map((x) => (x.id === g.id ? { ...x, why: p.why || x.why, pair: p.pair || x.pair, say: p.say || x.say } : x)));
        setAi((s) => { const n = { ...s }; delete n[g.id]; return n; });
      }).catch(() => setAi((s) => ({ ...s, [g.id]: "Нет связи с Наставником." })));
  };
  const lbl = { ...labelStyle(12), color: c.sub, margin: "8px 0 3px" };
  const has = list.length > 0;
  return (
    <div data-brief-block="go" data-on={isOn ? "1" : "0"} data-lens-card="" style={{ ...c.frost, padding: "12px 14px", marginBottom: 10, opacity: has && !isOn ? 0.55 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div style={{ ...labelStyle(13.5), color: c.gold, flex: 1 }}>Гоу-лист</div>
        {has ? <button type="button" role="switch" aria-checked={isOn} aria-label={(isOn ? "Убрать из брифинга: " : "Включить в брифинг: ") + "Гоу-лист"} onClick={onToggle}
          style={{ position: "relative", width: 40, height: 24, borderRadius: 12, border: `1px solid ${isOn ? c.gold : c.line}`, background: isOn ? (a11y ? "rgba(139,106,48,0.25)" : "rgba(200,169,110,0.35)") : "transparent", cursor: "pointer", flexShrink: 0 }}>
          <span style={{ position: "absolute", top: 2, left: 2, width: 18, height: 18, borderRadius: "50%", background: isOn ? (a11y ? "#8B6A30" : "#E4C88C") : c.sub, transform: isOn ? "translateX(16px)" : "none", transition: "transform .2s" }} />
        </button> : null}
      </div>
      {!has ? <div style={{ fontSize: 12.5, color: c.sub, lineHeight: 1.5 }}>Две-три позиции, которые смена советует сегодня: новинка, высокая маржа или то, что нужно продать до конца срока.</div> : null}
      {list.map((g) => (
        <div key={g.id} data-go-edit={g.id} style={{ borderTop: `1px solid ${c.line}`, padding: "10px 0 6px", marginTop: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0, fontFamily: "Georgia, serif", fontSize: 15, color: c.text }}>{g.name}<span style={{ fontSize: 12, color: c.sub }}> · {GO_KIND_WORD[g.kind] || "позиция"}</span></div>
            <button type="button" data-go-remove={g.id} aria-label={"Убрать из гоу-листа: " + g.name} onClick={() => remove(g.id)} style={{ border: 0, background: "none", color: c.sub, fontSize: 22, lineHeight: 1, cursor: "pointer", padding: "0 2px" }}>×</button>
          </div>
          {bad.has(g.id) ? <div data-go-stop={g.id} role="alert" style={{ fontSize: 12.5, color: c.red, marginTop: 3 }}>В стопе: в брифинг не уйдёт. Убери или замени.</div> : null}
          <div style={lbl}>Чем хорошо</div>
          <input data-lens-field="" data-go-field="why" value={g.why} onChange={(e) => edit(g.id, "why", e.target.value)} onFocus={() => onTyping(true)} onBlur={() => onTyping(false)} placeholder="Нежный, с дымком, порция на одного" className="sa-field" style={field(c)} />
          <div style={lbl}>С чем предложить</div>
          <input data-lens-field="" data-go-field="pair" value={g.pair} onChange={(e) => edit(g.id, "pair", e.target.value)} onFocus={() => onTyping(true)} onBlur={() => onTyping(false)} placeholder="С бокалом пино нуар или лимонадом" className="sa-field" style={field(c)} />
          <div style={lbl}>Фраза гостю</div>
          <textarea data-lens-field="" data-go-field="say" rows={2} value={g.say} onChange={(e) => edit(g.id, "say", e.target.value)} onFocus={() => onTyping(true)} onBlur={() => onTyping(false)} placeholder="Сегодня советую тартар: шеф сам коптит желток" className="sa-field" style={{ ...field(c), resize: "vertical" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
            <button type="button" data-go-ai={g.id} data-lens-btn="soft" onClick={() => askAi(g)} disabled={ai[g.id] === "busy"} style={{ ...pill(c, false), padding: "6px 12px", fontSize: 12.5, opacity: ai[g.id] === "busy" ? 0.6 : 1 }}>
              {ai[g.id] === "busy" ? "Наставник пишет…" : "Подсказать фразы"}</button>
            {ai[g.id] && ai[g.id] !== "busy" ? <span role="alert" style={{ fontSize: 12, color: c.red }}>{ai[g.id]}</span> : null}
          </div>
        </div>))}
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button type="button" data-go-add="" data-lens-btn="soft" onClick={() => { vibrate("light"); setPick(true); }} disabled={list.length >= GO_MAX}
          style={{ ...pill(c, false), opacity: list.length >= GO_MAX ? 0.5 : 1 }}>{list.length ? "Из меню · " + list.length + " из " + GO_MAX : "Выбрать из меню"}</button>
        {prev && prev.items && prev.items.length && !list.length ? (
          <button type="button" data-go-again="" data-lens-btn="soft" onClick={() => { vibrate("light"); setGo(goNormalize(prev.items)); }} style={pill(c, false)}>{prev.label}</button>) : null}
      </div>
      {pick ? <GoPicker a11y={a11y} c={c} menu={menu} picked={list} onPick={onPick} onClose={() => setPick(false)} /> : null}
    </div>
  );
}

// ── «Итог гоу-листа»: сколько продано (этап 50) ──────────────────────────────────────
// r — { day, go, sold, saved, at, by } из brief_go_get; today — день «ГГГГ-ММ-ДД»; onSaved(r) — после записи
export function GoResult({ c, r, today, onSaved, onTyping }) {
  const list = goNormalize(r && r.go);
  const [vals, setVals] = React.useState(() => { const s = goSoldNormalize(r && r.sold, list), o = {}; list.forEach((g) => { o[g.id] = s[g.id] != null ? String(s[g.id]) : ""; }); return o; });
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);   // { ok, text }
  if (!list.length) return null;
  const filled = list.filter((g) => /^\d{1,5}$/.test(String(vals[g.id] || "").trim()));
  const save = () => {
    if (busy || !filled.length) return;
    const sold = {};
    filled.forEach((g) => { sold[g.id] = Number(String(vals[g.id]).trim()); });
    setBusy(true); setMsg(null);
    rpc("brief_go_save", { p_token: saToken(), p_day: r.day, p_sold: sold }).then((x) => {
      setBusy(false);
      if (x && x.ok) { vibrate("success"); setMsg({ ok: true, text: "Итог записан: команда увидит его в брифинге." }); if (onSaved) onSaved({ ...r, sold: x.sold, saved: true, at: x.at, by: x.by }); }
      else if (rpcMissing(x)) setMsg({ ok: false, text: "На сервере ещё нет этапа 50 (supabase-stage50-golist.sql). Гоу-лист работает и без него, а итог запишется после этапа." });
      else if (x && x.error === "forbidden") setMsg({ ok: false, text: "Итог записывает руководитель или старший." });
      else if (x && x.error === "bad_day") setMsg({ ok: false, text: "Итог пишут за сегодня или за вчера." });
      else setMsg({ ok: false, text: "Не записалось. Проверь связь и попробуй ещё раз." });
    }).catch(() => { setBusy(false); setMsg({ ok: false, text: "Нет связи. Итог можно записать позже, до конца завтрашнего дня." }); });
  };
  const when = dayWord(r.day, today);
  return (
    <div data-go-result={r.day} data-lens-card="" style={{ ...c.frost, padding: "12px 14px", marginBottom: 10 }}>
      <div style={{ ...labelStyle(13.5), color: c.gold, marginBottom: 4 }}>Итог гоу-листа{when ? " · " + when : ""}</div>
      <div style={{ fontSize: 12.5, color: c.sub, lineHeight: 1.45, marginBottom: 8 }}>Сколько продано каждой позиции: это видно в отчёте iiko по блюдам.</div>
      {list.map((g) => (
        <label key={g.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderTop: `1px solid ${c.line}` }}>
          <span style={{ flex: 1, minWidth: 0, fontFamily: "Georgia, serif", fontSize: 14.5, color: c.text }}>{g.name}</span>
          <input data-lens-field="" data-go-sold-input={g.id} inputMode="numeric" pattern="[0-9]*" value={vals[g.id] || ""} aria-label={"Продано: " + g.name}
            onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 5); setVals((s) => ({ ...s, [g.id]: v })); }} onFocus={() => onTyping && onTyping(true)} onBlur={() => onTyping && onTyping(false)}
            className="sa-field" style={{ ...field(c), width: 76, textAlign: "center" }} />
          <span style={{ fontSize: 12.5, color: c.sub }}>шт.</span>
        </label>))}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        <button type="button" data-go-save="" data-lens-btn="main" onClick={save} disabled={busy || !filled.length} style={{ ...pill(c, true), opacity: busy || !filled.length ? 0.55 : 1 }}>{busy ? "Записываю…" : r.saved ? "Обновить итог" : "Записать итог"}</button>
        {r.saved && !msg ? <span data-go-saved="" style={{ fontSize: 12, color: c.sub }}>Записано{hm(r.at) ? " в " + hm(r.at) : ""}{r.by ? " · " + r.by : ""}: {goSoldLine(list, r.sold)}</span> : null}
      </div>
      {msg ? <div role="status" style={{ fontSize: 12.5, color: msg.ok ? c.text : c.red, lineHeight: 1.45, marginTop: 8 }}>{msg.text}</div> : null}
    </div>
  );
}
