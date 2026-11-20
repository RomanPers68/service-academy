// ui/floor-tools.jsx — v179 (Доп. 504): инструменты редактора схемы зала.
//
// Владелец (20.11): «Давай улучшим рассадку, сделаем ее более удобной и красивой. Из неудобного, как мне показалось,
// это само составление столов. Может добавим добавление плана зала по фото или что-то вроде этого?»
//   • KindPalette — какой стол ставить: на 2, 4, 6, 8 мест, квадратный, круглый, длинный; нажатие на клетку ставит его;
//   • EditorActions — «Шаг назад» и «Фото плана»;
//   • StartCard — пустой зал: «Быстрее всего по фото»;
//   • PhotoCard — фото под сеткой: насколько видно, «Расставить столы по фото» (ИИ), повернуть, другое фото, убрать;
//   • CopyBtn — «Ещё такой» в карточке стола, RenumberBtn — «Пронумеровать по порядку».
// Схема и экран — ui/seating.jsx, расчёт — lib/seating.js и lib/floor-scan.js, фото на телефоне — lib/floor-photo.js.
import React from "react";
import { labelStyle } from "./tokens";
import { TABLE_KINDS } from "../lib/seating";
import { KindIcon } from "./table-art";

const pl = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };
const chip = (c, on, a11y) => ({ padding: "7px 12px", borderRadius: 999, border: `1px solid ${on ? c.gold : c.line}`, background: on ? (a11y ? "rgba(139,106,48,0.18)" : "rgba(200,169,110,0.22)") : "transparent",
  color: on ? c.text : c.sub, fontFamily: "Georgia, serif", fontSize: 13.5, cursor: "pointer" });
const btn = (c, main) => ({ padding: "12px 14px", borderRadius: 16, fontFamily: "Georgia, serif", fontSize: 15, cursor: "pointer",
  ...(main ? { border: 0, background: c.gold, color: "#1A1008", fontWeight: "bold" } : { border: `1px solid ${c.gold}`, background: "transparent", color: c.text }) });
const link = (color) => ({ border: 0, background: "none", color, fontFamily: "Georgia, serif", fontSize: 13.5, cursor: "pointer", padding: "4px 2px" });
const SHAPE_WORD = { sq: "Квадратный", rd: "Круглый", long: "Длинный" };
export const kindLabel = (q) => SHAPE_WORD[q.shape] + " на " + q.seats + " " + pl(q.seats, "место", "места", "мест");

const Svg = ({ s, color, children }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>);
export const CameraIcon = ({ s = 18, color }) => <Svg s={s} color={color}><path d="M4 8h3.2l1.8-2.6h6l1.8 2.6H20v11H4z" /><circle cx="12" cy="13.2" r="3.6" /></Svg>;
export const UndoIcon = ({ s = 16, color }) => <Svg s={s} color={color}><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></Svg>;
const RotateIcon = ({ s = 15, color }) => <Svg s={s} color={color}><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></Svg>;

/** Какой стол ставить: значок стола со стульями и сколько мест */
export function KindPalette({ c, a11y, kind, onKind }) {
  return (
    <div data-kinds="" role="radiogroup" aria-label="Какой стол ставить" style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
      {TABLE_KINDS.map((q) => {
        const on = kind === q.k;
        return (
          <button key={q.k} type="button" role="radio" aria-checked={on} aria-label={kindLabel(q)} data-kind={q.k} onClick={() => onKind(q.k)}
            data-lens-btn={on ? "tab" : "soft"} data-lens-ink="" style={{ ...chip(c, on, a11y), padding: "5px 9px 5px 7px", display: "inline-flex", alignItems: "center", gap: 5 }}>
            <KindIcon shape={q.shape} seats={q.seats} size={19} color={on ? c.gold : c.sub} /><span>{q.seats}</span>
          </button>);
      })}
    </div>
  );
}

/** «Шаг назад» и «Фото плана» над схемой */
export function EditorActions({ c, a11y, canUndo, onUndo, hasPhoto, photoBusy, onPhoto }) {
  return (
    <div data-editor-actions="" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
      <button type="button" data-undo="" disabled={!canUndo} onClick={onUndo} data-lens-btn="soft" data-lens-ink=""
        style={{ ...chip(c, false, a11y), display: "inline-flex", alignItems: "center", gap: 6, opacity: canUndo ? 1 : 0.42, cursor: canUndo ? "pointer" : "default" }}>
        <UndoIcon color={canUndo ? c.gold : c.sub} />Шаг назад</button>
      <button type="button" data-photo="" disabled={photoBusy} onClick={onPhoto} data-lens-btn="soft" data-lens-ink=""
        style={{ ...chip(c, false, a11y), display: "inline-flex", alignItems: "center", gap: 6, opacity: photoBusy ? 0.6 : 1 }}>
        <CameraIcon s={17} color={c.gold} />{photoBusy ? "Открываю фото…" : hasPhoto ? "Другое фото" : "Фото плана"}</button>
    </div>
  );
}

/** Пустой зал без фото: быстрее всего — сфотографировать план */
export function StartCard({ c, onPhoto, busy }) {
  return (
    <div data-floor-start="" data-lens-card="" style={{ ...c.frost, padding: "14px 16px", marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span style={{ marginTop: 1 }}><CameraIcon s={26} color={c.gold} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, color: c.text, marginBottom: 4 }}>Быстрее всего по фото</div>
          <div style={{ fontSize: 13, color: c.sub, lineHeight: 1.5 }}>Сфотографируй план зала: чертёж, план эвакуации, схему из программы броней или рисунок от руки. Столы рисуй квадратами и кругами, в каждом номер и сколько мест. ИИ расставит столы сам, тебе останется поправить.</div>
        </div>
      </div>
      <button type="button" data-floor-photo-start="" disabled={busy} onClick={onPhoto} data-lens-btn="main" style={{ ...btn(c, true), width: "100%", marginTop: 12, opacity: busy ? 0.6 : 1 }}>
        {busy ? "Открываю фото…" : "Сфотографировать план"}</button>
      <div style={{ fontSize: 12.5, color: c.sub, marginTop: 10, lineHeight: 1.45 }}>Или расставь сам: выбери стол ниже и нажимай на клетки схемы, каждый раз встанет такой стол.</div>
    </div>
  );
}

const Spinner = ({ color }) => (<>
  <style>{"@keyframes saFpSpin{to{transform:rotate(360deg)}}"}</style>
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" focusable="false" style={{ flex: "none", animation: "saFpSpin 0.9s linear infinite" }}>
    <path d="M12 3a9 9 0 1 1-8.5 6" /></svg></>);

/**
 * Фото плана под сеткой: насколько видно, распознать столы, повернуть, другое фото, убрать.
 * ask — в зале уже есть столы: спросить, вместо них или добавить (onAnswer("replace" | "add" | ""))
 */
export function PhotoCard({ c, a11y, rec, scanBusy, ask, nTables, onOp, onScan, onAnswer, onRotate, onDrop, onPhoto, rotating }) {
  const op = Math.round((rec.op || 0.5) * 100);
  return (
    <div data-bg-card="" data-lens-card="" style={{ ...c.frost, padding: "12px 14px", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ ...labelStyle(14.5), color: c.gold, flex: 1 }}>Фото плана</span>
        <span style={{ fontSize: 11.5, color: c.sub }}>лежит только на этом телефоне</span>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: c.sub, marginBottom: 12 }}>
        <span>Видно</span>
        <input type="range" min="15" max="85" step="5" value={op} data-bg-op="" aria-label="Насколько видно фото под схемой"
          onChange={(e) => onOp(Number(e.target.value) / 100)} style={{ flex: 1, minWidth: 0, accentColor: c.gold }} />
        <span style={{ minWidth: 34, textAlign: "right", color: c.text }}>{op}%</span>
      </label>
      {ask ? (
        <div data-scan-ask="" role="group" aria-label="Как расставить столы по фото" style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 13.5, color: c.text, lineHeight: 1.45, marginBottom: 10 }}>
            В зале уже {nTables} {pl(nTables, "стол", "стола", "столов")}. Поставить столы с фото вместо них или добавить к ним?</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" data-scan-mode="replace" onClick={() => onAnswer("replace")} data-lens-btn="main" style={{ ...btn(c, true), padding: "10px 14px", fontSize: 14 }}>Вместо них</button>
            <button type="button" data-scan-mode="add" onClick={() => onAnswer("add")} data-lens-btn="soft" style={{ ...btn(c), padding: "10px 14px", fontSize: 14 }}>Добавить</button>
            <button type="button" data-scan-mode="" onClick={() => onAnswer("")} style={link(c.sub)}>Отмена</button>
          </div>
        </div>
      ) : scanBusy ? (
        <div data-scan-busy="" role="status" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: c.text, padding: "10px 2px" }}>
          <Spinner color={c.gold} />Смотрю на план и расставляю столы. Обычно это 10–30 секунд.</div>
      ) : (
        <button type="button" data-scan="" onClick={onScan} data-lens-btn="main" style={{ ...btn(c, true), width: "100%" }}>Расставить столы по фото</button>
      )}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10 }}>
        <button type="button" data-bg-rotate="" disabled={scanBusy || rotating} onClick={onRotate} style={{ ...link(c.gold), display: "inline-flex", alignItems: "center", gap: 5, opacity: scanBusy || rotating ? 0.5 : 1 }}>
          <RotateIcon color={c.gold} />Повернуть</button>
        <button type="button" data-bg-change="" disabled={scanBusy} onClick={onPhoto} style={{ ...link(c.gold), opacity: scanBusy ? 0.5 : 1 }}>Другое фото</button>
        <button type="button" data-bg-drop="" disabled={scanBusy} onClick={onDrop} style={{ ...link(c.red), opacity: scanBusy ? 0.5 : 1 }}>Убрать фото</button>
      </div>
      <div style={{ fontSize: 11.5, color: c.sub, marginTop: 8, lineHeight: 1.45 }}>
        ИИ находит на фото столы и ставит их на сетку: форму, места и номера, если они подписаны. Потом проверь и поправь. Схему видит вся смена, а фото только ты.</div>
    </div>
  );
}

/** «Ещё такой»: копия выбранного стола рядом */
export const CopyBtn = ({ c, onClick }) => (
  <button type="button" data-edit-copy="" onClick={onClick} style={link(c.gold)}>Ещё такой</button>);

/** «Пронумеровать по порядку»: второе нажатие в течение 4 секунд */
export const RenumberBtn = ({ c, sure, onClick }) => (
  <button type="button" data-renumber="" onClick={onClick} style={{ ...link(sure ? c.red : c.gold), textAlign: "left", lineHeight: 1.4 }}>
    {sure ? "Номера станут 1, 2, 3… по залам и рядам. Нажми ещё раз" : "Пронумеровать по порядку"}</button>);
