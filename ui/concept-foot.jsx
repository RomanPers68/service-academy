// ui/concept-foot.jsx — v192 (Доп. 517): «Ознакомлен(а)» и тренажёр рассказа гостю внизу раздела «О нас» в треке.
//
// Владелец (23.11), про семь идей для «О нас»: «Ты правильно понял. Делаем все 7». Раздел из «О нас» в треке обычно
// «для ознакомления» (тест там для самопроверки), поэтому подтверждение — отметка «Ознакомлен(а)» в конце раздела:
// руководитель видит дату в листе ознакомления. Отметить можно, когда уроки раздела пройдены (или прочитан весь раздел
// одной страницей в «О нас»). Рядом — тренажёр «Рассказ гостю за 30 секунд», если в разделе есть образец, и «Что
// изменилось», если раздел обновили после отметки.
// Данные и действия приходят из App через ConceptCtx: меню раздела (ui/module-menu.jsx) об этом ничего не знает.
import React from "react";
import { UI_SVG } from "./icons";
import { conceptAck, conceptPitch, conceptChanges, dayWords } from "../lib/concept";

/** { concept, word («Ознакомлен(а)»), busy, onAck(), onAbout(), onPitch(track) } — из App. */
export const ConceptCtx = React.createContext(null);

const plural = (n, a, b, c) => (n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c);

export function ConceptFoot({ mod, completed = {}, passive = false }) {
  const cx = React.useContext(ConceptCtx);
  if (!cx || !cx.concept || !mod || !mod.concept) return null;
  const track = String(mod.id || "").replace(/^cn-/, "");
  const ack = conceptAck(cx.concept);
  if (!ack.has) return null;
  const steps = (mod.lessons || []).filter((l) => l.type !== "result" && l.type !== "quiz");
  const left = steps.filter((l) => !completed[l.id]).length;
  const pitch = conceptPitch(cx.concept, track);
  const chg = conceptChanges(cx.concept, track);
  const off = passive ? -1 : undefined;
  const go = (fn) => (passive ? undefined : fn);
  const tile = (key, cls, icon, title, sub, onClick, disabled, mark) => (
    <button key={key} type="button" tabIndex={off} className={"tbm-act" + cls} disabled={disabled} onClick={go(onClick)} aria-label={title + " · " + sub} {...mark}>
      <span className="tbm-act-ic" aria-hidden="true">{icon}</span>
      <span className="tbm-act-tx"><span className="tbm-act-t">{title}</span><span className="tbm-act-s">{sub}</span></span>
    </button>);
  // строка над плитками — частями: каждая часть не рвётся, переносится между частями (как строка свежести темы)
  const line = ack.need
    ? (chg.items.length ? ["Раздел обновили:", chg.items.length + " " + plural(chg.items.length, "изменение", "изменения", "изменений")]
      : ["Подтверждение для руководителя:", "отметка «" + cx.word + "»"])
    : ["Отметка стоит:", "руководитель видит её", "в листе ознакомления"];
  return (
    <div className="tbm-acts" data-cn-foot={ack.need ? "need" : "ok"} style={{ margin: "14px -8px 8px" }}>
      <div className="tbm-fresh"><span className="tbm-fresh-t">{line.map((x, i) => <React.Fragment key={i}>{i ? " " : null}<span>{x}</span></React.Fragment>)}</span></div>
      <div className="tbm-actrow">
        {ack.need
          ? tile("ack", left ? "" : " hot", UI_SVG.checkSquare("currentColor", 17), cx.busy ? "Минуту…" : cx.word,
              left ? "после уроков: " + plural(left, "остался", "осталось", "осталось") + " " + left : "руководитель увидит дату", cx.onAck, !!left || !!cx.busy, { "data-cn-footack": left ? "wait" : "go" })
          : tile("ok", " gold got", UI_SVG.checkCircle("currentColor", 17), cx.word, ack.at ? dayWords(ack.at) : "отметка стоит", cx.onAbout, false, { "data-cn-footok": "" })}
        {pitch ? tile("pitch", "", UI_SVG.dialog("currentColor", 17), "Рассказ гостю", "30 секунд своими словами", () => cx.onPitch(track), false, { "data-cn-footpitch": "" }) : null}
      </div>
      {ack.need && left ? <button type="button" className="tbm-cellar" tabIndex={off} data-cn-footall="" onClick={go(cx.onAbout)} style={{ alignSelf: "flex-start" }}>Или прочитай весь раздел одной страницей ›</button> : null}
      {chg.items.length && !(ack.need && left) ? <button type="button" className="tbm-cellar" tabIndex={off} data-cn-footchg="" onClick={go(cx.onAbout)} style={{ alignSelf: "flex-start" }}>Что изменилось ›</button> : null}
    </div>);
}
