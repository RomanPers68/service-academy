// ui/org.jsx — v198 (Доп. 523): «Заведения и должности» у владельца, окно «+ Заведение» и «+ Должность» и ряды
// выбора (форма нового сотрудника, перевод сотрудника). Списки и правила — lib/org.js и lib/org-model.js, сервер —
// этап 61. Владелец (26.11): «Как думаешь как это можно сделать удобно и красиво?» — один экран со списками в
// «Команде» и пунктирные «+» прямо в форме: добавил, и новое сразу выбрано.
import React from "react";
import { createPortal } from "react-dom";
import { vibrate, onActivate } from "../lib/utils";
import { saveVenue, savePosition } from "../lib/org";
import { useLevels, loadLevels, setPositionUp } from "../lib/live-check-api";   // v200 (Доп. 525): «старше менеджера»
import { plural } from "../lib/mastery.js";
import { venueNames, hiddenVenues, pickPositions, hiddenPositions, baseLabel, BASES, BASE_HINT, orgErr, doneText, cleanName,
  VENUE_MAX, POSITION_MAX } from "../lib/org-model";
import { labelStyle } from "./tokens";
import { UI_SVG } from "./icons";

const SERIF = "Georgia, serif";
const palette = (a11y) => (a11y
  ? { bg: "linear-gradient(180deg,#FFF9EC,#F4E8CD)", base: "#F7EEDB", edge: "rgba(139,106,48,0.42)", text: "#2A2113", sub: "#6B5A3E", gold: "#7A5A1E", veil: "rgba(70,52,24,0.42)", err: "#9A3B24", pit: "rgba(139,106,48,0.08)", ok: "#2A6B45" }
  : { bg: "linear-gradient(180deg,#2E2312,#1E170C)", base: "#241B0E", edge: "rgba(214,178,102,0.45)", text: "#EFE4C8", sub: "#B3A58A", gold: "#E8C983", veil: "rgba(8,6,3,0.66)", err: "#F0A08A", pit: "rgba(226,186,116,0.07)", ok: "#5DBB8A" });

/** Чип выбора — как в форме нового сотрудника */
export const orgChip = (a11y, active) => ({
  padding: "8px 13px", borderRadius: 18, fontSize: 12.5, fontFamily: SERIF, cursor: "pointer",
  border: active ? (a11y ? "1.5px solid #7A5D2A" : "1px solid #C8A96E") : (a11y ? "1px solid rgba(160,120,60,0.4)" : "1px solid rgba(200,160,80,0.3)"),
  background: active ? (a11y ? "rgba(139,106,48,0.14)" : "rgba(200,169,110,0.12)") : "transparent",
  boxShadow: active ? (a11y ? "inset 0 0 12px rgba(255,255,255,0.4), inset 0 1px 0 rgba(255,255,255,0.8)" : "inset 0 0 12px rgba(255,230,170,0.09), inset 0 1px 0 rgba(255,255,255,0.14)") : "none",
  color: active ? (a11y ? "#6B4E1A" : "#E8D9B8") : (a11y ? "#7A6A50" : "#9A8C74"),
  fontWeight: active ? "bold" : "normal", transition: "all 0.2s ease",
});
/** Пунктирный «+» в конце ряда */
const addChipStyle = (a11y) => ({ ...orgChip(a11y, false), display: "inline-flex", alignItems: "center", gap: 4,
  border: a11y ? "1px dashed rgba(122,93,42,0.7)" : "1px dashed rgba(214,178,102,0.65)", color: a11y ? "#7A5D2A" : "#D9BE84" });

/** Ряд выбора: items [{ id, label }]; add — пунктирный «+» (только владельцу) */
export function ChipRow({ a11y, items, value, onPick, add = null, attr = "data-org-pick" }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {items.map((it) => (
        <div key={it.id} {...{ [attr]: it.id }} className={"sa-btn" + (value === it.id ? " sa-chip-on" : "")} style={orgChip(a11y, value === it.id)}
          role="button" aria-pressed={value === it.id}
          onClick={() => { vibrate("light"); onPick(it.id); }} {...onActivate(() => { vibrate("light"); onPick(it.id); })}>{it.label}</div>
      ))}
      {add ? (
        <div data-org-add={add.kind} className="sa-btn" style={addChipStyle(a11y)} role="button"
          onClick={() => { vibrate("light"); add.onClick(); }} {...onActivate(() => { vibrate("light"); add.onClick(); })}>
          <span aria-hidden="true" style={{ fontSize: 15, lineHeight: 1 }}>+</span>{add.label}
        </div>
      ) : null}
    </div>
  );
}

const field = (c) => ({ width: "100%", boxSizing: "border-box", padding: "13px 14px", borderRadius: 14, border: "1px solid " + c.edge, background: c.pit,
  color: c.text, fontFamily: SERIF, fontSize: 16, outline: "none" });
const mainBtn = (busy) => ({ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 50, borderRadius: 999, border: 0, width: "100%",
  background: "linear-gradient(172deg,#F1DBA4 0%,#DDBE7F 46%,#BC9A5E 100%)", color: "#24180A", fontFamily: SERIF, fontWeight: "bold", fontSize: 16,
  cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 });
const softBtn = (c) => ({ minHeight: 44, borderRadius: 999, border: "1px solid " + c.edge, background: "transparent", color: c.sub, fontFamily: SERIF, fontSize: 15, cursor: "pointer", width: "100%" });

/** «Работает как» — шесть встроенных, подписи из списка (владелец мог переименовать) и что это даёт */
function BasePick({ a11y, org, base, onPick }) {
  const c = palette(a11y);
  return (
    <>
      <div style={{ ...labelStyle(13.5), color: c.sub, margin: "14px 0 8px" }}>Работает как</div>
      <ChipRow a11y={a11y} attr="data-org-base" items={BASES.map((b) => ({ id: b, label: baseLabel(org, b) }))} value={base} onPick={onPick} />
      <div data-org-hint="" style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 10, padding: "10px 12px", borderRadius: 14, background: c.pit,
        border: "1px solid " + c.edge, color: c.sub, fontSize: 13.5, lineHeight: 1.45 }}>
        <span aria-hidden="true" style={{ flexShrink: 0, marginTop: 1, display: "inline-flex" }}>{UI_SVG.bulb(c.gold, 15)}</span>
        <span>{BASE_HINT[base]}</span>
      </div>
    </>
  );
}

/** Окно «Новое заведение» / «Новая должность»: ввести название (и «работает как») или вернуть скрытое.
 *  onDone(ответ) — после удачного сохранения: форма сразу выбирает новое. */
export function OrgSheet({ a11y, kind, org, onClose, onDone }) {
  const c = palette(a11y);
  const isV = kind === "venue";
  const [text, setText] = React.useState("");
  const [base, setBase] = React.useState("waiter");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const hidden = isV ? hiddenVenues(org) : hiddenPositions(org);
  const name = cleanName(text);
  const done = (r) => { setBusy(false); if (r && r.ok) { vibrate("heavy"); onDone(r); } else { vibrate("error"); setErr(orgErr(r && r.error)); } };
  const submit = async () => {
    if (busy) return;
    if (!name) { setErr(orgErr("bad_request")); return; }
    setBusy(true); setErr("");
    done(isV ? await saveVenue({ newName: name }) : await savePosition({ label: name, base }));
  };
  const back = async (it) => {
    if (busy) return;
    setBusy(true); setErr("");
    done(isV ? await saveVenue({ name: it.name, hidden: false }) : await savePosition({ id: it.id, hidden: false }));
  };
  const body = (
    <div data-org-sheet={kind} onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9600, background: c.veil, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div role="dialog" aria-modal="true" aria-label={isV ? "Новое заведение" : "Новая должность"} data-lens-card="" data-lens-float="" onClick={(ev) => ev.stopPropagation()}
        className="sa-panel-in"
        style={{ position: "relative", width: "100%", maxWidth: 520, maxHeight: "92vh", overflowY: "auto", borderRadius: "22px 22px 0 0", padding: "16px 16px calc(18px + env(safe-area-inset-bottom, 0px))",
          fontFamily: SERIF, backgroundColor: c.base, backgroundImage: c.bg, border: "1px solid " + c.edge, borderBottom: 0, boxShadow: "0 -12px 40px rgba(0,0,0,0.45)", color: c.text }}>
        <button type="button" aria-label="Закрыть" data-lens="disc" data-lens-x="" onClick={onClose}
          style={{ position: "absolute", top: 8, right: 8, width: 40, height: 40, borderRadius: "50%", border: 0, background: "none", color: c.sub, fontSize: 22, lineHeight: 1, cursor: "pointer" }}>×</button>
        <div style={{ fontSize: 19, fontWeight: "bold", paddingRight: 40 }}>{isV ? "Новое заведение" : "Новая должность"}</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.45, color: c.sub, marginTop: 4 }}>
          {isV ? "Сразу появится в меню, в выборе у новых сотрудников и в концепции." : "Сразу появится в выборе у новых сотрудников и при переводе."}
        </div>
        <input data-org-name="" data-lens-field="" autoFocus value={text} maxLength={isV ? VENUE_MAX : POSITION_MAX}
          placeholder={isV ? "Название, например «Алёнка»" : "Название, например «Бариста»"}
          onChange={(e) => { setText(e.target.value); setErr(""); }} onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          style={{ ...field(c), marginTop: 14 }} />
        {!isV ? <BasePick a11y={a11y} org={org} base={base} onPick={setBase} /> : null}
        {hidden.length ? (
          <>
            <div style={{ ...labelStyle(13.5), color: c.sub, margin: "16px 0 8px" }}>{isV ? "Вернуть скрытое" : "Вернуть скрытую"}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {hidden.map((it) => (
                <div key={isV ? it.name : it.id} data-org-return={isV ? it.name : it.id} className="sa-btn" role="button" style={addChipStyle(a11y)}
                  onClick={() => back(it)} {...onActivate(() => back(it))}>
                  <span aria-hidden="true" style={{ fontSize: 13, lineHeight: 1 }}>↺</span>{isV ? it.name : it.label}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12.5, color: c.sub, marginTop: 8, lineHeight: 1.45 }}>
              {isV ? "Вернётся со своими сотрудниками, меню и историей." : "Вернётся с прежними правами и курсом."}
            </div>
          </>
        ) : null}
        {err ? <div data-org-err="" role="alert" style={{ color: c.err, fontSize: 13.5, marginTop: 12 }}>{err}</div> : null}
        <button type="button" data-org-save="" data-lens-btn="main" disabled={busy} onClick={submit} style={{ ...mainBtn(busy), marginTop: 18 }}>
          {busy ? "Сохраняю…" : "Добавить"}
        </button>
      </div>
    </div>
  );
  return createPortal(body, document.body);
}

const staffText = (n) => (n == null ? "" : n === 0 ? "пока никого" : n + " " + plural(n, "сотрудник", "сотрудника", "сотрудников"));

/** Экран «Заведения и должности» (владелец): добавить, переименовать, скрыть и вернуть */
export function OrgScreen({ T, a11y, org, onBack }) {
  const c = palette(a11y);
  const [sheet, setSheet] = React.useState(null);        // venue | position
  const [edit, setEdit] = React.useState(null);          // { kind, key, text, base, builtin }
  const [open, setOpen] = React.useState({ venue: false, position: false });   // «Скрытые» раскрыты
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);            // { ok, text }
  const say = (ok, text) => { setMsg({ ok, text }); };
  const after = (kind, r) => { setBusy(false); if (r && r.ok) { vibrate("heavy"); setEdit(null); say(true, doneText(kind, r)); } else { vibrate("error"); say(false, orgErr(r && r.error)); } };
  const hideVenue = async (v, hidden) => { if (busy) return; setBusy(true); after("venue", await saveVenue({ name: v.name, hidden })); };
  const hidePos = async (p, hidden) => { if (busy) return; setBusy(true); after("position", await savePosition({ id: p.id, hidden })); };
  // v200 (Доп. 525): своя должность «работает как» менеджер может стоять на ступень выше: управляющий проверяет и менеджеров
  const lv = useLevels();
  React.useEffect(() => { if (org.stage) loadLevels(); }, [org.stage]);
  const upOf = (p) => !!p && !p.builtin && p.base === "manager" && lv.ups.includes(p.id);
  const toggleUp = async (p) => {
    if (busy || !p) return;
    setBusy(true);
    const r = await setPositionUp(p.id, !upOf(p));
    setBusy(false);
    if (r && r.ok) { vibrate("heavy"); say(true, r.up ? "«" + p.label + "» теперь старше менеджера: проверяет и менеджеров." : "«" + p.label + "» теперь на одной ступени с менеджером."); }
    else { vibrate("error"); say(false, r && r.error === "stage" ? "Ступени живой проверки появятся после этапа базы 63." : orgErr(r && r.error)); }
  };
  const saveEdit = async () => {
    if (busy || !edit) return;
    const name = cleanName(edit.text);
    if (!name) { say(false, orgErr("bad_request")); return; }
    setBusy(true);
    if (edit.kind === "venue") after("venue", await saveVenue({ name: edit.key, newName: name }));
    else after("position", await savePosition({ id: edit.key, label: name, base: edit.builtin ? null : edit.base }));
  };
  const visV = org.venues.filter((v) => !v.hidden).sort((a, b) => a.sort - b.sort);
  const hidV = hiddenVenues(org);
  const visP = pickPositions(org);
  const hidP = hiddenPositions(org);
  const card = { ...T.modCard, cursor: "default", flexDirection: "column", alignItems: "stretch", gap: 0, padding: "4px 14px" };
  const rowBtn = (hot) => ({ border: "1px solid " + (hot ? c.edge : "transparent"), background: "none", color: hot ? c.gold : c.sub, fontFamily: SERIF, fontSize: 13,
    padding: "7px 11px", borderRadius: 999, cursor: "pointer", flexShrink: 0 });
  const head = (title, kind, n) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "18px 0 8px" }}>
      <div style={{ ...labelStyle(13.5), color: c.sub }}>{title}{n ? " · " + n : ""}</div>
      {org.stage ? (
        <button type="button" data-org-open={kind} className="sa-btn" data-lens-btn="soft" onClick={() => { vibrate("light"); setMsg(null); setSheet(kind); }}
          style={{ ...addChipStyle(a11y), fontSize: 13.5, padding: "7px 13px" }}><span aria-hidden="true" style={{ fontSize: 15, lineHeight: 1 }}>+</span>{kind === "venue" ? "Заведение" : "Должность"}</button>
      ) : null}
    </div>
  );
  const editPanel = (kind) => (edit && edit.kind === kind ? (
    <div data-org-edit={edit.key} className="sa-fast" style={{ padding: "12px 0 10px" }}>
      <input data-org-edit-name="" data-lens-field="" autoFocus value={edit.text} maxLength={kind === "venue" ? VENUE_MAX : POSITION_MAX}
        onChange={(e) => setEdit({ ...edit, text: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); }} style={field(c)} />
      {kind === "venue" ? <div style={{ fontSize: 12.5, color: c.sub, marginTop: 8, lineHeight: 1.45 }}>Название поменяется везде: у сотрудников, в меню, в графике и в истории.</div> : null}
      {kind === "position" && !edit.builtin ? <BasePick a11y={a11y} org={org} base={edit.base} onPick={(b) => setEdit({ ...edit, base: b })} /> : null}
      {kind === "position" && !edit.builtin && lv.stage && (org.positions.find((p) => p.id === edit.key) || {}).base === "manager" ? (() => {
        const pos = org.positions.find((p) => p.id === edit.key), on = upOf(pos);
        return (
          <button type="button" data-org-up={edit.key} aria-pressed={on} disabled={busy} onClick={() => toggleUp(pos)}
            style={{ ...orgChip(a11y, on), display: "flex", alignItems: "center", gap: 8, width: "100%", marginTop: 10, textAlign: "left", fontSize: 13 }}>
            <span aria-hidden="true" style={{ width: 18, flexShrink: 0, textAlign: "center" }}>{on ? "✓" : "○"}</span>
            <span>Старше менеджера: в живой проверке проверяет и менеджеров</span>
          </button>);
      })() : null}
      {kind === "position" && edit.builtin ? <div style={{ fontSize: 12.5, color: c.sub, marginTop: 8, lineHeight: 1.45 }}>Встроенная должность: меняется только название, права и курс прежние.</div> : null}
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button type="button" data-lens-btn="soft" style={{ ...softBtn(c), flex: 1 }} onClick={() => setEdit(null)}>Отмена</button>
        <button type="button" data-org-edit-save="" data-lens-btn="main" disabled={busy} style={{ ...mainBtn(busy), flex: 1, minHeight: 44, fontSize: 15 }} onClick={saveEdit}>{busy ? "…" : "Сохранить"}</button>
      </div>
    </div>
  ) : null);
  const row = (key, title, sub, acts, last) => (
    <div key={key} style={{ borderBottom: last ? "none" : "1px solid " + (a11y ? "rgba(139,106,48,0.18)" : "rgba(214,178,102,0.14)") }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: T.modTitle.color, fontSize: 15, fontWeight: "bold", fontFamily: SERIF, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
          {sub ? <div style={{ color: T.modSub.color, fontSize: 12, marginTop: 2 }}>{sub}</div> : null}
        </div>
        {acts}
      </div>
    </div>
  );
  return (
    <div style={T.screen} className="sa-screen">
      <div style={T.lessHead}>
        <button className="sa-hit" style={T.backBtn2} data-lens="back" aria-label="Вернуться" onClick={onBack}>‹</button>
        <div style={T.lessHeadTitle}>Заведения и должности</div>
      </div>
      <div data-org-screen="" style={{ flex: 1, padding: "14px 18px 110px" }}>
        <div style={{ color: T.modSub.color, fontSize: 13, lineHeight: 1.55 }}>
          Что добавишь, сразу появится в меню, в выборе у новых сотрудников и в концепции. Скрытое пропадает из списков, а сотрудники, меню и история остаются.
        </div>
        {!org.stage ? (
          <div data-org-nostage="" style={{ ...T.modCard, cursor: "default", marginTop: 14, color: T.para.color, fontSize: 13.5, lineHeight: 1.55, display: "block" }}>
            Списки пока из приложения. Чтобы их менять, нужен этап базы 61: файл supabase-stage61-places.sql один раз запустить в Supabase. Экран «Сервер» покажет, что он на месте.
          </div>
        ) : null}
        {msg ? <div data-org-msg={msg.ok ? "ok" : "err"} role="status" className="sa-fast" style={{ marginTop: 12, color: msg.ok ? c.ok : c.err, fontSize: 13.5, lineHeight: 1.5 }}>{msg.text}</div> : null}

        {head("Заведения", "venue", visV.length)}
        <div data-org-list="venue" style={card}>
          {visV.length ? visV.map((v, i) => (
            <React.Fragment key={v.name}>
              {row(v.name, v.name, staffText(v.staff), org.stage ? (
                <>
                  <button type="button" data-org-rename={v.name} style={rowBtn(true)} onClick={() => { setMsg(null); setEdit({ kind: "venue", key: v.name, text: v.name }); }}>Изменить</button>
                  <button type="button" data-org-hide={v.name} style={rowBtn(false)} disabled={busy} onClick={() => hideVenue(v, true)}>Скрыть</button>
                </>
              ) : null, i === visV.length - 1 && !(edit && edit.kind === "venue" && edit.key === v.name))}
              {edit && edit.key === v.name ? editPanel("venue") : null}
            </React.Fragment>
          )) : <div style={{ color: T.modSub.color, fontSize: 13.5, padding: "12px 0" }}>Список пуст. Добавь первое заведение.</div>}
        </div>
        {hidV.length ? (
          <div style={{ marginTop: 8 }}>
            <button type="button" data-org-hidden="venue" onClick={() => setOpen({ ...open, venue: !open.venue })}
              style={{ border: 0, background: "none", color: c.sub, fontFamily: SERIF, fontSize: 13.5, padding: "6px 0", cursor: "pointer" }}>
              {(open.venue ? "▾ " : "▸ ") + "Скрытые · " + hidV.length}
            </button>
            {open.venue ? (
              <div style={card}>
                {hidV.map((v, i) => row(v.name, v.name, staffText(v.staff),
                  <button type="button" data-org-unhide={v.name} style={rowBtn(true)} disabled={busy} onClick={() => hideVenue(v, false)}>Вернуть</button>, i === hidV.length - 1))}
              </div>
            ) : null}
          </div>
        ) : null}

        {head("Должности", "position", visP.length)}
        <div data-org-list="position" style={card}>
          {visP.map((p, i) => (
            <React.Fragment key={p.id}>
              {row(p.id, p.label, [p.builtin ? "встроенная" : "как " + baseLabel(org, p.base).toLowerCase(), upOf(p) ? "старше менеджера" : "", staffText(p.staff)].filter(Boolean).join(" · "), org.stage ? (
                <>
                  <button type="button" data-org-rename={p.id} style={rowBtn(true)} onClick={() => { setMsg(null); setEdit({ kind: "position", key: p.id, text: p.label, base: p.base, builtin: p.builtin }); }}>Изменить</button>
                  <button type="button" data-org-hide={p.id} style={rowBtn(false)} disabled={busy} onClick={() => hidePos(p, true)}>Скрыть</button>
                </>
              ) : null, i === visP.length - 1 && !(edit && edit.kind === "position" && edit.key === p.id))}
              {edit && edit.key === p.id ? editPanel("position") : null}
            </React.Fragment>
          ))}
        </div>
        {hidP.length ? (
          <div style={{ marginTop: 8 }}>
            <button type="button" data-org-hidden="position" onClick={() => setOpen({ ...open, position: !open.position })}
              style={{ border: 0, background: "none", color: c.sub, fontFamily: SERIF, fontSize: 13.5, padding: "6px 0", cursor: "pointer" }}>
              {(open.position ? "▾ " : "▸ ") + "Скрытые · " + hidP.length}
            </button>
            {open.position ? (
              <div style={card}>
                {hidP.map((p, i) => row(p.id, p.label, p.builtin ? "встроенная" : "как " + baseLabel(org, p.base).toLowerCase(),
                  <button type="button" data-org-unhide={p.id} style={rowBtn(true)} disabled={busy} onClick={() => hidePos(p, false)}>Вернуть</button>, i === hidP.length - 1))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {sheet ? <OrgSheet a11y={a11y} kind={sheet} org={org} onClose={() => setSheet(null)}
        onDone={(r) => { setSheet(null); say(true, doneText(sheet, r)); }} /> : null}
    </div>
  );
}
