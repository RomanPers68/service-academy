// v49 (Доп. 362): график руководителя — месяц полоской и неделя во всю высоту, день по часам по тапу на число,
// подсказки в листе смены до выбора.
//
// Владелец — на три оставшиеся идеи с картинок «сейчас → станет»: «Давай все». Вид в браузере (обе темы, 393/360/320 px,
// нажатия, прилипающая шапка недели) — /home/claude/preview/e2e-v49.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const src = readFileSync("ui/schedule.jsx", "utf8");
const css = readFileSync("ui/css.js", "utf8");
const between = (a, b) => { const i = src.indexOf(a); expect(i).toBeGreaterThan(0); const j = src.indexOf(b, i); expect(j).toBeGreaterThan(i); return src.slice(i, j); };

describe("v49: лист смены подсказывает до выбора", () => {
  const pick = between("    {pick && (() => {", "    {/* v46: дыра в смене — кто из позиции может выйти");
  it("правила — тем же генератором, что «Заполнить черновик»: whyNot по плану, где клетка как будто пустая", () => {
    expect(pick).toContain("const probe = generateSchedule({ cfg, DAYS, dow, lvlOf, plan, locks: {}, POS, mkey, wishes: {}, hardOff, prevTail, freezeBefore: 0, restarts: 1, repairSweeps: 0 }); why = probe && probe.whyNot;");
    expect(pick).toContain('const pmFree = { ...plan, [who.id]: { ...(plan[who.id] || {}), [d]: "" } };');
    expect(pick).toContain("const w = !sh2.extra && why ? why(pmFree, who, d, sh2.k) : null;");
  });
  it("у каждой смены — «подходит · станет N из M ч» / причина; у текущей — «стоит сейчас»; отдельная — «в потребность не идёт»", () => {
    expect(pick).toContain(': status(true, on ? "стоит сейчас · правила соблюдены" : `подходит · станет ${after} из ${enW} ч`)}');
    expect(pick).toContain(": w ? status(false, w)");
    expect(pick).toContain("const after = hNow - curH + (on ? curH : len(sh2));");
    expect(pick).toContain("отдельная смена, в потребность не идёт");   // v74
  });
  it("сверху — часы человека и капсулы: покрытие позиции в этот день, просьба, «не смогу», отпуск", () => {
    expect(pick).toContain('data-pick-hours="" ');
    expect(pick).toContain("{posName(who.pos)}: в этот день {nHave} из {nNeed}, не хватает {nNeed - nHave === 1 ? \"одного\" : nNeed - nHave}");   // v75: треугольник — значком
    expect(pick).toContain('<Sign n="alert" s={13} sw={2} style={{ marginRight: 4, verticalAlign: "-1px" }} />{posName(who.pos)}');
    expect(pick).toContain("✓ {posName(who.pos)}: в этот день {nHave} из {nNeed}");
    expect(pick).toContain("просил(а) выходной");
    expect(pick).toContain("отметил(а) «не смогу»");
    expect(pick).toContain("в отпуске");
  });
  it("«Выходной» — видно, что снять смену там, где людей впритык, значит новая дыра; в позиции дыра — «Кто может выйти»", () => {
    expect(pick).toContain("status(false, `в позиции станет ${nHave - 1} из ${nNeed}`)");
    expect(pick).toContain('data-pick-fill="" onClick={() => { setPick(null); setFillAsk({ d, pos: who.pos }); vibrate("light"); }}');
    expect(pick).toContain(">Кто может выйти в этот день ›</button>");
  });
  it("решение — за руководителем: поставить можно и с предупреждением; прежняя подсказка про закрепление осталась", () => {
    expect(pick).toContain("Выбранная вручную смена закрепляется, генератор её не тронет.");   // v74
    expect(pick).toContain("Подсказки строятся по тем же правилам, что у «Заполнить черновик»: поставить можно и с предупреждением, тогда это будет в «Проверке».");   // v75: словами вместо ⚠
    expect(pick).toContain("onClick={() => setCell(who.id, d, sh2.k)}");                     // нажать можно любую смену
    expect(pick).toMatch(/\.\.\.ghostInk, flex:"1 1 46%", fontSize:12\.5, padding:"9px 8px" \}\}\s+onClick=\{\(\) => \{ setPick\(null\); setReplAsk/);
  });
});

describe("v49: день по часам", () => {
  const day = between("    {bossDay ? (() => {", "    {personSheet && (() => {");
  it("тап по числу в шапке таблицы открывает день; в «Сегодня» — «по часам ›» и «Сегодня по часам ›»", () => {
    expect(src).toContain('<b data-day-open={d} onClick={() => { setBossDay(d); vibrate("light"); }}');
    expect(src).not.toContain("<b onClick={() => setDayEdit(d)}");
    expect(src).toContain("const [bossDay, setBossDay] = React.useState(0);");
    expect((src.match(/data-today-hours=""/g) || []).length).toBe(2);
    expect(src).toContain(">Сегодня по часам ›</button>");
  });
  it("шапка: листок с числом, уровень дня, сколько в смене из нужных, кого не хватает, старший", () => {
    expect(day).toContain("<CalendarPage day={d} p={palette(a11y)} a11y={a11y} w={40} h={44} />");
    expect(day).toContain('lvT = holName(d) ? "Праздник" : lv === 3 ? "Пиковый день" : lv === 2 ? "Загруженный день" : "Обычный день"');
    expect(day).toContain("{lvT} · {onMain} из {needTot}");
    expect(day).toContain('"не хватает: " + missPos.map(x => x.t.toLowerCase()).join(", ") : "все на месте ✓"');
  });
  it("людей в зале по часам: от раннего прихода до позднего ухода, часы работы — подложкой, пустеющий зал — красным, «сейчас»", () => {
    expect(day).toContain("const H0 = Math.min(openH, ...on.map(x => shiftOf(plan[x.id][d]).from));");
    expect(day).toContain("const H1 = Math.max(closeH, ...on.map(x => endOf(shiftOf(plan[x.id][d]))));");
    expect(day).toContain("const thin = (c, hh) => isOpen(hh) && (c === 0 || c < mx * 0.3);");
    expect(day).toContain("открыты {openH}:00–{hlab(closeH)}:00");
    expect(day).toContain('data-day-now=""');
  });
  it("полосы по позициям: тап по человеку — его смена; дыра — «Кто может выйти?»; заметка — прежним окошком; картинка дня", () => {
    expect(day).toContain('data-day-person={x.id} onClick={() => { setPick({ id: x.id, d }); vibrate("light"); }}');
    expect(day).toContain('data-day-hole={pos} onClick={() => { setFillAsk({ d, pos }); vibrate("light"); }}');
    expect(day).toContain("const z = miss ? holeShiftOf({ d, pos, cfg, lvlOf, staff, plan, shiftOf }) : null;");
    expect(day).toContain('data-day-note="" onClick={() => { setDayEdit(d); vibrate("light"); }}');
    expect(day).toContain("const toShot = () => { setBossDay(0); exportToday(shotMode, d);");
    expect(src).toContain('<div data-shot-card="" data-lens-edge="" style={{ ...card }}>');   // v113: метка линзы
  });
  it("картинка смены — любого дня: заголовок днём недели, имя файла с датой; без дня — «Сегодня», как было", () => {
    expect(src).toContain("const drawTodayCard = (print = false, dd = 0) => {");
    expect(src).toContain("const t = new Date(); const td = dd || t.getDate();");
    expect(src).toContain('? DOWF[dow(td)][0].toUpperCase() + DOWF[dow(td)].slice(1) : "Сегодня") + " · " + td');
    expect(src).toContain('setShot({ url: URL.createObjectURL(blob), blob, kind: "today", day: dd,');
    expect(src).toContain("exportToday(mode, shot.day || 0)");
  });
});

describe("v49: месяц полоской, неделя во всю высоту", () => {
  const strip = between("        {(() => {\n          const gapOf = (d) => { const nd = needOf(d); let miss = 0;", "        <div style={{ fontSize:11, color:P.sub, fontStyle:\"italic\", marginBottom:6 }}>");
  it("«неделя / месяц» — переключателем в заголовке «Смены»; шести кнопок недель и «весь месяц» нет", () => {
    expect(src).toContain('data-sched-weekmode=""');
    expect(src).toContain('[["week", "неделя"], ["month", "месяц"]]');
    expect(src).not.toContain('}}>весь месяц</button>');
    expect(src).not.toMatch(/\{weeks\.map\(\(w, i\) => \(\s*<button key=\{i\} className="sa-btn" onClick=\{\(\) => setWeekIdx\(weekIdx === i \? null : i\)\}/);
  });
  it("полоска: недобор по дням, высота — уровень дня, сегодня в кольце, прошедшие бледнее, выбранная неделя в рамке; тап — неделя", () => {
    expect(strip).toContain("const gaps = Array.from({ length: DAYS }, (_, i) => gapOf(i + 1));");
    expect(strip).toContain("height: lv === 3 ? 30 : lv === 2 ? 24 : 18");
    expect(strip).toContain("opacity: past ? 0.42 : 1");
    expect(strip).toContain('data-strip-sel={selW[0] + "-" + selW[selW.length - 1]}');
    expect(strip).toContain("onClick={() => { const wi = weeks.findIndex(w => w.includes(d)); if (wi >= 0) setWeekIdx(wi); vibrate(\"light\"); }}");
    expect(strip).toContain("покрытие · {total");
  });
  it("«‹ 12–18 октября ›» со строкой недели; у краёв месяца стрелка не нажимается", () => {
    expect(strip).toContain('aria-label="Предыдущая неделя" disabled={weekIdx === 0}');
    expect(strip).toContain('aria-label="Следующая неделя" disabled={weekIdx >= weeks.length - 1}');
    expect(strip).toContain("тяжелее всего <b style={{ color:P.text }}>{DOWL[dow(worst.d)]} {worst.d}</b>");
    expect(strip).toContain("неделя закрыта полностью");
  });
  it("строки «месяц ███» и «на неделе не хватает … показать ›» ушли из «Сегодня» (переехали к полоске)", () => {
    expect(src).not.toContain("<span style={{ fontSize:11, color:P.sub, flexShrink:0 }}>месяц</span>");
    expect(src).not.toContain('{" · "}<span style={{ color:P.acc }}>показать ›</span></>}');
    expect(src).toContain("переехали в карточку «Смены» — к полоске месяца");
  });
  it("неделя — во всю высоту: класс sa-wk; без своей прокрутки, шапка прилипает к верху, колонки по шапке, 320 px — уже имена", () => {
    expect(src).toContain('className={"sa-schedgrid sa-hscroll" + (weekIdx != null ? " sa-wk" : "")}');
    expect(css).toContain(".sa-schedgrid.sa-wk{max-height:none;overflow:visible}");
    expect(css).toContain(".sa-schedgrid.sa-wk table{table-layout:fixed;width:100%;min-width:0}");
    expect(css).toContain(".sa-schedgrid.sa-wk tr:first-child th{top:env(safe-area-inset-top,0px)}");
    expect(css).toMatch(/@media \(max-width:335px\)\{\s+\.sa-schedgrid\.sa-wk td\.sa-schednm,\.sa-schedgrid\.sa-wk th\.sa-schednm\{width:75px!important/);
    expect(css).toContain(".sa-schedgrid{max-height:64vh;overflow-x:auto;overflow-y:auto;");   // месяц — коробкой, как было
  });
  it("золото сегодняшнего числа в шапке — на плотной подложке", () => {
    expect(src).toContain('"linear-gradient(180deg,rgba(212,168,90,0.26),rgba(212,168,90,0.10)), #191309"');
    expect(src).toContain('"linear-gradient(180deg,rgba(214,178,102,0.34),rgba(214,178,102,0.15)), linear-gradient(180deg,#FFFAEB,#F0E8D4)"');
  });
});

describe("v49: подсказки, метка, CHANGES", () => {
  it("подсказка руководителя — про тап по числу; метка сборки — v49; CHANGES — «Дополнение 362»", () => {
    expect(readFileSync("data/hints.js", "utf8")).toContain("Тап по числу показывает день по часам.");   // v74
    expect(readFileSync("ui/menu-trainer.jsx", "utf8")).toMatch(/· сборка v\d{2,}<\/span>/);   // v50 — следующая метка
    expect(readFileSync("CHANGES.md", "utf8")).toContain("# Дополнение 362 — график руководителя: месяц полоской, день по часам, подсказки в листе смены (v49)");
  });
});
