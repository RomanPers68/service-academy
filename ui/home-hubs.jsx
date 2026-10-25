import React from "react";
import { shiftLabel } from "../lib/streak";
import { Candle } from "./table-bits";
import { ensureTableCss } from "./table-css";
import { ymd } from "../lib/streak";
import { EmptyState, useHintOnce, HintBubble } from "./widgets";
import { LOGO_SRC_DARK } from "../assets/logo";
import { WEEKDAY, MONTH_GEN } from "../lib/dates";
import { onActivate, vibrate, isFemaleName } from "../lib/utils";
import { ROLE_TITLE, masterKey } from "../lib/mastery";
import { useViewport, useColumn } from "./viewport";
import { labelStyle } from "./tokens";   // v73 (Доп. 386): подписи — курсивом, без моноширинного капса   // v52 (Доп. 365): компьютер — «сегодня» слева, разделы плитками справа

// ── Дополнение 133: вкладки «Смена», «Команда», «Я» ───────────────────────────
// Один компонент-хаб: заголовок с малым фирменным знаком, подзаголовок и список
// карточек-разделов в стиле «Морозный след» — иней без блюра: мягкое внутреннее
// свечение по всей площади, светящаяся кромка. Работает в тёмной и светлой темах.
// Ничего нового не делает — только ведёт в существующие экраны.

const ICON = {
  schedule: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>,
  checklist: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 9l2 2 4-4M8 16h8"/></svg>,
  guest: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  book: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M8 7h7M8 11h5"/></svg>,
  onboarding: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M5 12v5c0 1.5 3 3 7 3s7-1.5 7-3v-5"/></svg>,
  daily: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg>,
  trophy: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8M9 18h6"/></svg>,
  stats: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>,
  mentor: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6M15 11l2 2 4-4"/><path d="M14 20c0-2.5 2-4.5 5-4.5"/></svg>,
  analytics: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 4"/></svg>,
  team: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="3"/><circle cx="16" cy="9" r="2.5"/><path d="M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6M14 19c0-2.5 2-4.5 4.5-4.5S23 16.5 23 19"/></svg>,
  hire: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="3"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/></svg>,
  edit: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20l1-4L16.5 4.5a2.12 2.12 0 0 1 3 3L8 19l-4 1z"/><path d="M14.5 6.5l3 3"/></svg>,
  profile: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="9" r="4"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>,
  cert: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5"/><path d="M9 12.8L8 22l4-2.2L16 22l-1-9.2"/></svg>,
  roles: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h10M4 18h7"/></svg>,
  mistakes: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4M12 16h.01"/><circle cx="12" cy="12" r="9"/></svg>,
  // Доп. 304–305: чек недели и напоминание о смене
  receipt: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21V3z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>,
  // Доп. 309: отчёт по сотруднику — лист с графиком
  report: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h7l4 4v14H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4h4"/><path d="M9.5 17v-3M12.5 17v-5M15.5 17v-2"/></svg>,
  bell: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>,
  // v30: лига недели (кубок со звездой) и свеча на двоих (две свечи)
  league: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4h10v4a5 5 0 0 1-10 0V4z"/><path d="M12 13v4M8.5 21h7M9.5 17h5"/><path d="M12 5.6l.8 1.6 1.7.2-1.2 1.2.3 1.7-1.6-.8-1.6.8.3-1.7-1.2-1.2 1.7-.2z"/></svg>,
  pair: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 21v-8h4v8M14 21v-8h4v8"/><path d="M8 10.5c-1.2-1-1.2-2.6 0-4 .3 1 1 1.2 1 1.2.1-1.5.8-2.5 1.2-3 .4 2 .9 3.2-.2 4.8"/><path d="M16 10.5c-1.2-1-1.2-2.6 0-4 .3 1 1 1.2 1 1.2.1-1.5.8-2.5 1.2-3 .4 2 .9 3.2-.2 4.8"/><path d="M4 21h16"/></svg>,
  guestai: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/><path d="M18.5 3.5l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5z"/></svg>,
  radio: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="9" width="18" height="12" rx="3"/><path d="M7 9l10-5"/><circle cx="15.5" cy="15" r="2.5"/><path d="M6.5 13.5h3M6.5 16.5h3"/></svg>,
  month: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M12 13l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z"/></svg>,
  // v84: спасибо от гостей — сердце с галочкой
  thanks: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/><path d="M9.5 11.5l1.8 1.8 3.4-3.6"/></svg>,
  // v83: случаи из нашего зала — реплика с историей
  cases: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z"/><path d="M8 8.5h8M8 11.5h5"/></svg>,
  // v82: брифинг смены — рупор
  brief: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9.5h3l9-5v15l-9-5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z"/><path d="M7 14.5l1.5 5h2.6L9.6 14.5"/><path d="M19.5 9.5a3.5 3.5 0 0 1 0 5"/></svg>,
  // v31: «Погреб тем» — бокал с уровнем вина
  cellar: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12c0 6-2 11-6 13-4-2-6-7-6-13z"/><path d="M7 8.5h10"/><path d="M12 16v5M8.5 21h7"/></svg>,
  // v40: «Путь мастера» — медаль: лента и круг с маленькой звездой
  mastery: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 2.5h3.1l1.8 6.5M6.5 2.5l2.7 7.2M17.5 2.5h-3.1l-1.8 6.5M17.5 2.5l-2.7 7.2"/><circle cx="12" cy="15" r="6"/><path d="M12 12.7l.59 1.59 1.69.07-1.33 1.05.46 1.63L12 16.1l-1.41.94.46-1.63-1.33-1.05 1.69-.07z"/></svg>,
};

export function HubScreen({ T, a11y, title, subtitle, items = [], footer, hero, hintKey, hintSteps, compactGroups = null, groupOrder = null }) {
  // Подсказка вкладки. Ключ и тексты приходят снаружи: HubScreen общий для
  // «Смены» и «Команды», а объяснять им надо разное — и по-разному для
  // сотрудника и руководителя.
  const [hint, hintDone] = useHintOnce(hintKey || "hub", !!hintKey && !!(hintSteps || []).length);
  const [hstep, setHstep] = React.useState(0);
  // v52: широкий экран — колонка до 1080 px: слева то, что происходит сегодня (смена, квест, лидеры, прогресс),
  // справа разделы плитками в две-три колонки. Портрет — прежний список.
  const wide = useViewport().wide;
  useColumn(wide ? 1080 : 0);
  const gold = a11y ? "#7A5D2A" : "#D2A85A";
  const text = T.modTitle?.color || (a11y ? "#2A1F0E" : "#EFE4C8");
  const sub = T.modSub?.color || (a11y ? "#6B5B40" : "#9C8760");
  // «Морозный след»: иней без блюра
  const frost = {
    background: a11y ? "rgba(250,242,222,0.62)" : "rgba(226,186,116,0.09)",
    border: a11y ? "1px solid rgba(139,106,48,0.30)" : "1px solid rgba(255,255,255,0.13)",
    boxShadow: a11y
      ? "inset 0 0 26px rgba(255,255,255,0.55), inset 0 1px 0 rgba(255,255,255,0.9), 0 6px 18px rgba(120,85,25,0.14)"
      : "inset 0 0 26px rgba(255,248,230,0.07), inset 0 1px 0 rgba(255,255,255,0.12), 0 8px 24px rgba(0,0,0,0.45)",
  };
  return (
    <div style={T.screen} className="sa-screen">
      <div style={{ padding: "18px 16px 8px", display: "flex", alignItems: "center", gap: 12 }}>
        <img src={LOGO_SRC_DARK} alt="" aria-hidden="true" decoding="sync" style={{ width: 44, height: 36, objectFit: "contain", filter: a11y ? "none" : "brightness(0) saturate(100%) invert(95%) sepia(10%) saturate(400%) hue-rotate(340deg) brightness(98%)" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 25, color: text, lineHeight: 1.15 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12.5, color: sub, marginTop: 2 }}>{subtitle}</div>}
        </div>
      </div>
      {(() => {
        const hintEl = hint && (hintSteps || []).length ? (() => {
          const last = hstep >= hintSteps.length - 1;
          return (
            <HintBubble a11y={a11y} text={hintSteps[hstep]} arrow="up"
              step={hstep + 1} total={hintSteps.length}
              onNext={last ? null : () => setHstep(v => v + 1)}
              onClose={hintDone} style={{ margin:"4px 0 8px" }} />
          );
        })() : null;
        const list = items.filter(Boolean);
        const badgeEl = (it, c) => it.badge ? <span style={{ minWidth: 22, height: 22, padding: "0 7px", borderRadius: 12, background: c, color: a11y ? "#fff" : "#1a160f", fontSize: 12.5, fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{it.badge}</span>
          : <span style={{ color: c, fontSize: 21, opacity: 0.7, flexShrink: 0 }}>›</span>;
        const card = (it, idx) => {
          const c = it.red ? (a11y ? "#A33A2A" : "#E07A6E") : gold;
          const go = () => { vibrate("light"); it.onClick && it.onClick(); };
          return (
            <div key={it.key} className="sa-card sa-pagein" onClick={go} {...onActivate(go)} aria-label={it.label}
              style={{ ...frost, animationDelay: `${Math.min(idx, 8) * 45}ms`, borderRadius: 18, padding: "13px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", position: "relative", overflow: "hidden", WebkitTapHighlightColor: "transparent" }}>
              {/* v73 (Доп. 386): косого блика поверх плитки больше нет — примета сгенерированных интерфейсов */}
              {/* v78 (Доп. 391): значок без плашки — квадрат со значком, заголовок, подпись и «›» на каждом экране был
                  самым узнаваемым шаблоном сгенерированных интерфейсов; цвет, свечение карточки и сам значок — прежние */}
              <div data-hub-ic="" style={{ width: 32, height: 44, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {(ICON[it.icon] || ICON.book)(c)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 16, color: it.red ? c : text, lineHeight: 1.25 }}>{it.label}</div>
                {it.sub && <div style={{ fontSize: 12.5, color: sub, marginTop: 2, lineHeight: 1.4 }}>{it.sub}</div>}
              </div>
              {badgeEl(it, c)}
            </div>
          );
        };
        // v71: разделы группами. Аудит v70: «Я» — 12 одинаковых карточек подряд, «Команда» у руководителя — 10, и
        // «Сотрудники» с «Собеседованием» в самом низу. У пункта может быть group — над первым пунктом группы
        // встаёт заголовок; группа из compactGroups — строками в одной карточке (как список настроек телефона).
        const head = (g, k) => (
          <div key={"g:" + k} data-hub-group={g} role="heading" aria-level={2}
            style={{ gridColumn: "1 / -1", ...labelStyle(a11y ? 16 : 14.5), color: gold, opacity: 0.9, margin: k ? "10px 4px 0" : "2px 4px 0" }}>{g}</div>
        );
        const rows = (group, idx0) => (
          <div key={"c:" + group[0].key} data-hub-compact className="sa-pagein" style={{ ...frost, borderRadius: 18, padding: "2px 0", animationDelay: `${Math.min(idx0, 8) * 45}ms` }}>
            {group.map((it, j) => {
              const c = it.red ? (a11y ? "#A33A2A" : "#E07A6E") : gold;
              const go = () => { vibrate("light"); it.onClick && it.onClick(); };
              return (
                <div key={it.key} className="sa-card" onClick={go} {...onActivate(go)} aria-label={it.label}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", minHeight: 48, boxSizing: "border-box", cursor: "pointer", WebkitTapHighlightColor: "transparent",
                    borderTop: j ? `1px solid ${a11y ? "rgba(139,106,48,0.16)" : "rgba(255,240,210,0.08)"}` : "none" }}>
                  <span style={{ width: 24, height: 24, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", transform: "scale(0.86)" }}>{(ICON[it.icon] || ICON.book)(c)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "Georgia, serif", fontSize: 15.5, color: it.red ? c : text, lineHeight: 1.25 }}>{it.label}</div>
                    {it.sub && it.subCompact !== false ? <div style={{ fontSize: 12, color: sub, marginTop: 1, lineHeight: 1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.sub}</div> : null}
                  </div>
                  {badgeEl(it, c)}
                </div>
              );
            })}
          </div>
        );
        const grouped = list.some((it) => it.group);
        const tiles = [];
        if (!grouped) list.forEach((it, idx) => tiles.push(card(it, idx)));
        else {
          // группы — в порядке groupOrder, остальные — в порядке появления; внутри группы порядок пунктов прежний
          const names = [];
          list.forEach((it) => { const n = it.group || ""; if (!names.includes(n)) names.push(n); });
          const rank = (n) => { const k = (groupOrder || []).indexOf(n); return k < 0 ? 100 + names.indexOf(n) : k; };
          names.sort((a, b) => rank(a) - rank(b));
          let idx = 0;
          names.forEach((name, g) => {
            const run = list.filter((it) => (it.group || "") === name);
            if (name) tiles.push(head(name, g));
            if (!wide && compactGroups && compactGroups.includes(name)) tiles.push(rows(run, idx));
            else run.forEach((it, j) => tiles.push(card(it, idx + j)));
            idx += run.length;
          });
        }
        return wide ? (
          <div className="sa-hub2" data-hub2="">
            <div className="sa-hub2-l">{hero}{hintEl}</div>
            <div className="sa-hub2-r"><div className="sa-hubtiles">{tiles}</div>{footer}</div>
          </div>
        ) : (
          <div style={{ padding: "6px 16px 100px", display: "flex", flexDirection: "column", gap: 10 }}>
            {hero}
            {hintEl}
            {tiles}
            {footer}
          </div>
        );
      })()}
    </div>
  );
}

// ── Дополнение 145: живые блоки над списками хабов и скелет ──────────────────
export const frostOf = (a11y) => ({
  background: a11y ? "rgba(250,242,222,0.62)" : "rgba(226,186,116,0.09)",
  border: a11y ? "1px solid rgba(139,106,48,0.30)" : "1px solid rgba(255,255,255,0.13)",
  boxShadow: a11y
    ? "inset 0 0 26px rgba(255,255,255,0.55), inset 0 1px 0 rgba(255,255,255,0.9), 0 6px 18px rgba(120,85,25,0.14)"
    : "inset 0 0 26px rgba(255,248,230,0.07), inset 0 1px 0 rgba(255,255,255,0.12), 0 8px 24px rgba(0,0,0,0.45)",
});
const tagStyle = (a11y) => ({ ...labelStyle(a11y ? 14.5 : 13.5), color: a11y ? "#7A5D2A" : "#D2A85A" });

/** Скелет карточки — пока данные едут (мерцание из css: .sa-skel). */
export function SkeletonCard({ a11y, h = 74, style }) {
  return <div className="sa-skel" aria-hidden="true" style={{ height: h, borderRadius: 18, border: a11y ? "1px solid rgba(139,106,48,0.18)" : "1px solid rgba(255,255,255,0.07)", ...style }} />;
}

const DAYS = WEEKDAY, MONTHS = MONTH_GEN;   // v59: один словарь дат (lib/dates.js)

/** «Смена»: сегодняшняя смена из офлайн-сводки графика (sa_today_shift). */
export function ShiftHero({ a11y, onOpen, shift = null }) {
  const t = new Date();
  const key = t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
  let label = null;
  try { const r = JSON.parse(localStorage.getItem("sa_today_shift") || "null"); if (r && r.date === key && r.label) label = r.label; } catch (e) {}
  // v31: сводки экрана графика нет — берём ту же смену, что видят квест и разминка (своя копия
  // графика). Раньше здесь было «Сегодня смен нет», а квест ниже показывал «Вечер · 16:00–24:00»
  if (!label && shift) label = shift.off ? "выходной" : (shift.label || shiftLabel(shift) || null);
  const off = label === "выходной";
  const text = a11y ? "#2A1F0E" : "#EFE4C8", sub = a11y ? "#6B5B40" : "#9C8760", gold = a11y ? "#7A5D2A" : "#D2A85A";
  const go = () => { vibrate("light"); onOpen && onOpen(); };
  return (
    <div className="sa-card sa-pagein" onClick={go} {...onActivate(go)} style={{ ...frostOf(a11y), borderRadius: 18, padding: "14px 16px", cursor: "pointer", marginBottom: 4 }}>
      <div style={tagStyle(a11y)}>Сегодня · {DAYS[t.getDay()]}, {t.getDate()} {MONTHS[t.getMonth()]}</div>
      {label ? (<>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 25, color: off ? gold : text, lineHeight: 1.1 }}>
            {off ? "Выходной" : label}
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: sub, marginTop: 4 }}>
          {off ? "Отдыхай, а завтра загляни в график" : "Тап покажет, кто в смене с тобой и кто старший"}
        </div>
      </>) : (
        /* «Смена не найдена» читалось как ошибка приложения, хотя это просто
           выходной или ещё не составленный график. Общий пустой вид и человечная
           формулировка вместо технической. */
        <div style={{ marginTop: 8 }}>
          <EmptyState a11y={a11y} title="Сегодня смен нет"
            hint="В графике виден весь месяц и твой ближайший день"
            action="Открыть график" onAction={go}
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth="1.6" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>} />
        </div>
      )}
    </div>
  );
}

/** «Команда»: три лидера по среднему баллу тестов. */
export function TeamHero({ a11y, leaderboard = [], profile, onOpen }) {
  const text = a11y ? "#2A1F0E" : "#EFE4C8", sub = a11y ? "#6B5B40" : "#9C8760", gold = a11y ? "#7A5D2A" : "#D2A85A";
  const mine = profile?.restaurant;
  const pool = mine ? leaderboard.filter(p => p.restaurant === mine) : leaderboard;
  const top = pool.slice(0, 3);
  const me = pool.findIndex(p => p.name === profile?.name && (p.surname || "") === (profile?.surname || ""));
  // Доп. 311: и место во всей сети — когда заведений больше одного
  const nets = new Set(leaderboard.map(p => p.restaurant || "")).size;
  const meNet = mine && nets > 1 ? leaderboard.findIndex(p => p.name === profile?.name && (p.surname || "") === (profile?.surname || "")) : -1;
  const go = () => { vibrate("light"); onOpen && onOpen(); };
  if (!top.length) return (
    <div className="sa-card sa-pagein" onClick={go} {...onActivate(go)} style={{ ...frostOf(a11y), borderRadius: 18, padding: "14px 16px", cursor: "pointer", marginBottom: 4 }}>
      <div style={tagStyle(a11y)}>Лидеры ресторана</div>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 16, color: text, marginTop: 6 }}>Пока пусто</div>
      <div style={{ fontSize: 12.5, color: sub, marginTop: 2 }}>Первый пройденный тест откроет рейтинг</div>
    </div>
  );
  const medal = ["#E8C56A", "#C9C9C9", "#C89A6E"];
  return (
    <div className="sa-card sa-pagein" onClick={go} {...onActivate(go)} style={{ ...frostOf(a11y), borderRadius: 18, padding: "14px 16px", cursor: "pointer", marginBottom: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={tagStyle(a11y)}>Лидеры ресторана</div>
        {me >= 0 && <div style={{ fontSize: 11, color: sub }}>ты <span style={{ color: gold }}>{me + 1}-й</span>{meNet >= 0 ? <> · в сети <span style={{ color: gold }}>{meNet + 1}-й</span></> : null}</div>}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        {top.map((p, i) => {
          const ini = `${(p.name || "?")[0]}${(p.surname || "")[0] || ""}`.toUpperCase();
          return (
            /* v58 (Доп. 371): медальон над именем — имени достаётся вся ширина ячейки, «Ангели…» больше нет */
            <div key={i} data-leader="" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, textAlign: "center" }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif", fontSize: 12.5, color: a11y ? "#2A1F0E" : "#1a160f", background: medal[i], boxShadow: `0 0 0 2px ${medal[i]}55` }}>{ini}</div>
              <div style={{ minWidth: 0, maxWidth: "100%" }}>
                <div data-leader-name="" style={{ fontSize: 12.5, color: text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.2 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: sub }}>{p.avg}%</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** «Я»: кольцо прогресса роли, серия дней, счётчики. */
export function MeHero({ a11y, done = 0, total = 0, streak, roleLabel, onOpen }) {
  ensureTableCss();   // свеча серии (Доп. 288)
  const text = a11y ? "#2A1F0E" : "#EFE4C8", sub = a11y ? "#6B5B40" : "#9C8760", gold = a11y ? "#7A5D2A" : "#D2A85A";
  const pct = total ? Math.round((done / total) * 100) : 0;
  const R = 26, C = 2 * Math.PI * R;
  const go = () => { vibrate("light"); onOpen && onOpen(); };
  const days = streak?.count || 0;
  const dword = days % 10 === 1 && days % 100 !== 11 ? "день" : days % 10 >= 2 && days % 10 <= 4 && (days % 100 < 12 || days % 100 > 14) ? "дня" : "дней";
  return (
    <div className="sa-card sa-pagein" onClick={go} {...onActivate(go)} style={{ ...frostOf(a11y), borderRadius: 18, padding: "14px 16px", cursor: "pointer", marginBottom: 4, display: "flex", alignItems: "center", gap: 12 }}>
      <svg width="68" height="68" viewBox="0 0 68 68" aria-hidden="true" style={{ flexShrink: 0 }}>
        <circle cx="34" cy="34" r={R} fill="none" stroke={a11y ? "rgba(139,106,48,0.22)" : "rgba(214,178,102,0.18)"} strokeWidth="6" />
        <circle cx="34" cy="34" r={R} fill="none" stroke={gold} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} transform="rotate(-90 34 34)" style={{ transition: "stroke-dashoffset .8s cubic-bezier(.16,1,.3,1)" }} />
        <text x="34" y="38" textAnchor="middle" fontSize="13" fontFamily="Georgia, serif" fill={text}>{pct}%</text>
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={tagStyle(a11y)}>{roleLabel || "Твой трек"}</div>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 16, color: text, marginTop: 4 }}>{done} из {total} уроков</div>
        <div style={{ fontSize: 12.5, color: sub, marginTop: 2 }}>
          {days > 0 ? <><span className="tbv" style={{ color: gold, display: "inline-flex", alignItems: "center", gap: 3, verticalAlign: "-2px" }}><Candle s={15} lit={streak.last === ymd(new Date())} />{days} {dword}</span> подряд</> : "Начни серию: заходи каждый день"}
        </div>
      </div>
    </div>
  );
}

// ── v40: «Мастер роли» — коллега стал мастером (этап 26: mastery_list) ─────────
// Строки сервера: [{ who: "Анна Смирнова", name, role, at, me }], новые сверху.
const DAY_MS = 86400000;
const dayStart = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };
/** «сегодня», «вчера», «3 дня назад», «неделю назад» — по календарным дням телефона. */
export function relDay(at, now = Date.now()) {
  const d = Math.round((dayStart(now) - dayStart(at)) / DAY_MS);
  if (d <= 0) return "сегодня";
  if (d === 1) return "вчера";
  if (d === 7) return "неделю назад";
  return d + " " + plural(d, "день", "дня", "дней") + " назад";
}
/** Новость для баннера: самый свежий чужой мастер за 7 дней и сколько ещё новых мастеров
 *  (людей, а не записей: у одного человека ролей может быть несколько). Нечего показать — null. */
export function mastersNews(rows, now = Date.now()) {
  const whoOf = (r) => String(r.who || r.name || "").replace(/\s+/g, " ").trim();
  const fresh = (Array.isArray(rows) ? rows : [])
    .filter((r) => r && typeof r === "object" && !r.me && whoOf(r))
    .map((r) => ({ r, t: Date.parse(r.at) }))
    .filter((x) => Number.isFinite(x.t) && now - x.t <= 7 * DAY_MS && x.t - now <= DAY_MS / 2)   // полдня вперёд — часы сервера
    .sort((a, b) => b.t - a.t);
  if (!fresh.length) return null;
  const top = fresh[0].r, who = whoOf(top), sp = who.indexOf(" ");
  const name = sp < 0 ? who : who.slice(0, sp), surname = sp < 0 ? "" : who.slice(sp + 1);
  const key = masterKey(who, "");
  const more = new Set(fresh.map((x) => masterKey(whoOf(x.r), "")).filter((k) => k !== key)).size;
  return { who, name, surname, female: isFemaleName(name, surname), role: top.role || "", title: ROLE_TITLE[top.role] || "", when: relDay(fresh[0].t, now), more };
}

/** v40: баннер «Мастер роли» — коллега стал мастером за последние 7 дней (свои записи не в счёт). */
export function MastersBanner({ a11y, rows = [], onOpen }) {
  const news = mastersNews(rows);
  if (!news) return null;
  const text = a11y ? "#2A1F0E" : "#EFE4C8", sub = a11y ? "#6B5B40" : "#9C8760", gold = a11y ? "#7A5D2A" : "#D2A85A";
  const go = () => { vibrate("light"); onOpen && onOpen(); };
  // «роли «Ядро»» не разрываем: название роли не остаётся одно на строке
  const line = news.who + (news.female ? " стала" : " стал") + " мастером роли" + (news.title ? "\u00A0«" + news.title + "»" : "");
  return (
    <div className="sa-card sa-pagein" data-ms-banner="" role="button" tabIndex={0} onClick={go} {...onActivate(go)}
      style={{ ...frostOf(a11y), borderRadius: 18, padding: "12px 14px", cursor: "pointer", marginBottom: 4, WebkitTapHighlightColor: "transparent" }}>
      <div style={{ ...labelStyle(a11y ? 14 : 13.5), color: gold }}>Мастер роли</div>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 15, color: text, lineHeight: 1.3, marginTop: 4 }}>{line}</div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: 10, rowGap: 2, marginTop: 4, fontSize: a11y ? 13 : 12.5, lineHeight: 1.4 }}>
        <span style={{ color: sub }}>{news.when + (news.more ? " · ещё " + news.more + " " + plural(news.more, "новый мастер", "новых мастера", "новых мастеров") + " за неделю" : "")}</span>
        <span style={{ marginLeft: "auto", color: gold, fontFamily: "Georgia, serif", fontWeight: "bold", whiteSpace: "nowrap" }}>Путь мастера ›</span>
      </div>
    </div>
  );
}


// ── v57 (Доп. 370): «Жизнь команды» — события коллег своего заведения за две недели (lib/team-feed.js):
// сданные тесты, мастера роли, рекорды тренажёров и печати Сборки, «спасибо команде». Пусто — карточки нет.
const FEED_ICON = {
  test: (c) => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>),
  master: (c) => (<svg width="13" height="13" viewBox="0 0 24 24" fill={c}><path d="M12 2.5l2.1 6.4 6.4 2.1-6.4 2.1L12 19.5l-2.1-6.4-6.4-2.1 6.4-2.1z" /></svg>),
  record: (c) => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z" /></svg>),
  thanks: (c) => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>),
};
export function TeamFeed({ a11y, items = [], now = Date.now(), first = 3 }) {
  const [open, setOpen] = React.useState(false);
  if (!Array.isArray(items) || !items.length) return null;
  const text = a11y ? "#2A1F0E" : "#EFE4C8", sub = a11y ? "#6B5B40" : "#9C8760", gold = a11y ? "#7A5D2A" : "#D2A85A";
  const line = a11y ? "rgba(139,106,48,0.18)" : "rgba(255,255,255,0.07)";
  const shown = open ? items : items.slice(0, first);
  const toggle = () => { vibrate("light"); setOpen((v) => !v); };
  return (
    <div className="sa-card sa-pagein" data-team-feed="" style={{ ...frostOf(a11y), borderRadius: 18, padding: "12px 14px 4px", marginBottom: 4 }}>
      <div style={{ ...labelStyle(a11y ? 14 : 13.5), color: gold, marginBottom: 2 }}>Жизнь команды</div>
      {shown.map((it, i) => (
        <div key={i} data-feed-item={it.kind} className={i >= first ? "sa-fadein" : undefined}
          style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderTop: i ? "1px solid " + line : "none" }}>
          <span aria-hidden="true" style={{ width: 24, height: 24, flexShrink: 0, borderRadius: "50%", display: "grid", placeItems: "center",
            border: "1px solid " + (a11y ? "rgba(122,93,42,0.4)" : "rgba(214,178,102,0.4)"), background: a11y ? "rgba(255,250,238,0.6)" : "rgba(214,178,102,0.07)" }}>
            {(FEED_ICON[it.kind] || FEED_ICON.test)(gold)}
          </span>
          <div style={{ flex: 1, minWidth: 0, fontFamily: "Georgia, serif", fontSize: a11y ? 14.5 : 13.5, lineHeight: 1.4, color: text }}>
            <b style={{ color: it.me ? gold : text }}>{it.who}</b> {it.text}
          </div>
          <span style={{ flexShrink: 0, fontSize: a11y ? 12.5 : 11.5, color: sub, whiteSpace: "nowrap", marginTop: 2 }}>{relDay(it.at, now)}</span>
        </div>
      ))}
      {items.length > first ? (
        <button type="button" className="sa-btn" data-feed-more="" onClick={toggle} aria-expanded={open}
          style={{ display: "block", width: "100%", padding: "8px 0 10px", border: 0, borderTop: "1px solid " + line, background: "transparent", cursor: "pointer",
            color: gold, fontFamily: "Georgia, serif", fontSize: a11y ? 14 : 13, fontWeight: "bold", textAlign: "left" }}>
          {open ? "Свернуть" : "Ещё " + (items.length - first) + " ›"}
        </button>
      ) : <div style={{ height: 6 }} />}
    </div>
  );
}
