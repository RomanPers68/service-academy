// v65 (Доп. 378): AI-интервью в ленте главной у руководителей; лента подбирает размер кружков под ширину;
// ответ голосом в AI-собеседовании. Вид в браузере — tools/claude/e2e-v65.mjs (DOCK HR STOP BACK LEAVE ERR TEXT LIGHT).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dockFit, DOCK_MIN } from "../lib/dock-fit.js";
import { HINTS } from "../data/hints.js";

const rd = (f) => readFileSync(f, "utf8");

describe("v65: размер кружков ленты (dockFit)", () => {
  // ширины ряда — замер в браузере (без SOS): 393 → 282, 375 → 268, 360 → 253, 320 → 213; самая длинная подпись
  // в шрифте приложения: у руководителя «AI-интервью» ≈ 64 px, у сотрудника «Справочник» ≈ 61 px
  it("четыре инструмента на обычном телефоне — как было: 36 px (393) и 34 px (узкий), подписи ездят", () => {
    expect(dockFit(282, 61, 4, 36)).toEqual({ ring: 36, labels: true });
    expect(dockFit(253, 61, 4, 34)).toEqual({ ring: 34, labels: true });
  });
  it("пять у руководителя: 393 — 36, 375 — 33, 360 — 30 px; подпись влезает", () => {
    expect(dockFit(282, 64, 5, 36)).toEqual({ ring: 36, labels: true });
    expect(dockFit(268, 64, 5, 34)).toEqual({ ring: 33, labels: true });
    expect(dockFit(253, 64, 5, 34)).toEqual({ ring: 30, labels: true });
    // шрифт телефона шире на пару пикселей — кружок на пиксель меньше, но подпись всё равно влезает
    expect(dockFit(282, 67, 5, 36)).toEqual({ ring: 35, labels: true });
  });
  it("не влезает с подписью даже при 28 px — только значки (подписи не раскрываются), кружки — сколько поместится", () => {
    const r = dockFit(213, 64, 5, 34);
    expect(r.labels).toBe(false);
    expect(r.ring).toBeGreaterThanOrEqual(26);
    expect(r.ring).toBeLessThanOrEqual(34);
    expect(DOCK_MIN).toBe(28);
  });
  it("сотрудник на 320 (четыре): раньше «Справочник» вылезал на 15 px — теперь кружки 30 px и подпись влезает", () => {
    expect(dockFit(213, 61, 4, 34)).toEqual({ ring: 30, labels: true });
  });
  it("пока не измерено (0) — прежний размер, подписи как раньше; кружок никогда не больше прежнего", () => {
    expect(dockFit(0, 0, 5, 36)).toEqual({ ring: 36, labels: true });
    expect(dockFit(2000, 60, 3, 36).ring).toBe(36);
  });
});

describe("v65: AI-интервью в ленте у руководителей", () => {
  const rs = rd("ui/screens-roleselect.jsx");
  it("плитка «AI-интервью» открывает собеседование; в ленте — только у тех, кому App передаёт onCandidate", () => {
    expect(rs).toContain('if (onCandidate) tiles.push({ key:"hire", label:"AI-интервью", onClick:onCandidate, icon:(');
    expect(rs).toContain('...(isStaff && onCandidate ? ["hire"] : [])');
    expect(rs).toContain('const ORDER = ["sp", "ob", "menu", "gl", "cl", "hire"];');
    const app = rd("App.jsx");
    expect(app).toContain('onCandidate={(profile?.is_admin || ["manager","senior"].includes(profile?.position)) ? () => navigate("candidate") : null}');
    // во вкладке «Команда» собеседование осталось
    expect(app).toContain('staff && { key:"hire", group:"Управление", icon:"hire", label:"Собеседование", sub:"Кандидаты и AI HR", onClick:() => navigate("candidate") },');   // v71: группа «Управление»
  });
  it("лента меряет себя: ширина ряда и самой длинной подписи → dockFit; подписи не раскрываются, если не влезают", () => {
    expect(rs).toContain('import { dockFit } from "../lib/dock-fit";');
    expect(rs).toContain("const { ring, labels: labelsOn } = dockFit(toolsFit.w, toolsFit.l, n, base);");
    expect(rs).toContain('el.querySelectorAll("[data-tool-label]")');
    expect(rs).toContain("try { ro = new ResizeObserver(upd); ro.observe(el); } catch (e) {}");
    expect(rs).toContain("const on = labelsOn && tools.length ? (toolSpot % tools.length) === i : false;");
    expect(rs).toContain('data-tools-row="" data-tools-ring={ring} data-tools-labels={labelsOn ? "on" : "off"}');
  });
  it("тур главной руководителя и «Гид» — про AI-интервью", () => {
    expect(HINTS.home_admin[1]).toBe("Эта лента всегда под рукой: справочник, меню, глоссарий, чек-листы и AI-интервью для кандидатов. Красный круг справа — SOS, когда всё горит.");
    expect(rd("ui/guide.jsx")).toContain("Вход — «AI-интервью» в ленте на главной или «Команда» → «Собеседование».");
  });
});

describe("v65: ответ голосом в AI-собеседовании", () => {
  const c = rd("ui/candidate.jsx");
  it("кнопка-волна на месте «Отправить», пока поле пустое; диктовка осталась и гасит волну, пока пишет", () => {
    expect(c).toContain('import { TalkButton, TalkBar, TalkDots, TalkSpeaking, canTalk } from "./talk";');
    expect(c).toContain('{!aiInput.trim() && talkOk ? (');
    expect(c).toContain('<TalkButton size={46} disabled={aiBusy || micBusy} onClick={openTalk} label="Отвечать голосом" />');
    expect(c).toContain("onText={t => setAiInput(v => (v ? v.trimEnd() + \" \" : \"\") + t)} onBusy={setMicBusy}");
  });
  it("полоса разговора: голос «Наставник», первым — вопрос, на который ещё не ответили; ход — talkTurn", () => {
    expect(c).toContain('<TalkBar who="hr" name="Интервьюер" voice="mentor" phone={{ pitch: 1, rate: 1 }} first={lastAi}');
    expect(c).toContain("ask={talkTurn} onState={setTalkState} onClose={() => setTalk(false)} />");
    expect(c).toContain('const lastAi = aiMsgs.length && aiMsgs[aiMsgs.length - 1].role === "assistant" ? aiMsgs[aiMsgs.length - 1].content : null;');
  });
  it("ход голосом: ответ — в переписку (с пометкой voice) и к интервьюеру; сбой — ответ убираем, причина — в полосу", () => {
    expect(c).toContain('const list = [...before, { role: "user", content: said, voice: true }];');
    // v66: ход голосом уходит с пометкой voice (интервьюер отвечает короче, оценщик знает про распознавание)
    expect(c).toContain('try { d = await callHr("chat", list, { voice: true }); } catch (e) { d = { error: "network" }; }');
    expect(c).toContain("aiMsgsRef.current = before; setAiMsgs(before);");
    expect(c).toContain('"ИИ не ответил — коснитесь волны и ответьте ещё раз."');
    // интервьюеру уходят только роль и текст (без пометки voice)
    expect(c).toContain("messages: msgs.map(m => ({ role: m.role, content: m.content })),");
  });
  it("в переписке: пузырь с точками, пока кандидат говорит; значок у вопроса, пока он звучит", () => {
    expect(c).toContain('{talk && (talkState === "hearing" || talkState === "recognizing") ? (');
    expect(c).toContain('data-talk-pending=""');
    expect(c).toContain('{talk && talkState === "speaking" && m.role === "assistant" && i === aiMsgs.length - 1');
  });
  it("«Завершить» закрывает разговор; в истории — «AI-интервью голосом» и сколько ответов голосом", () => {
    expect(c).toMatch(/const finishAi = \(\) => \{\n\s*if \(aiBusy\) return;\n\s*setTalk\(false\);/);
    expect(c).toContain('roleLabel: role.label + " · AI-интервью" + (voiceN * 2 >= Math.max(1, aiAnswered) && voiceN ? " голосом" : "")');
    expect(c).toContain("aiVoice: voiceN,");
  });
  it("‹ в AI-интервью с ответами — «Прервать собеседование?», разговор голосом закрывается", () => {
    expect(c).toContain('if (phase === "ai" && aiAnswered > 0) { setTalk(false); setConfirmLeave(true); return; }');
  });
  it("тексты: передача телефона и подсказка собеседования — про голос", () => {
    expect(c).toContain("В AI-режиме кандидат отвечает своими словами — текстом или голосом (волна справа от поля:");
    expect(HINTS.candidate[1]).toBe("Дальше передай телефон кандидату. Интервью ведёт наставник, ты не участвуешь. Отвечать можно и голосом — вопросы звучат вслух.");
  });
  it("карточки выбора: рамка выбранного — border и borderTop вместе", () => {
    expect(c).toContain('...(role.id === rl.id ? { border: a11y ? "1.5px solid #7A5D2A" : "1px solid #C8A96E", borderTop: a11y ? "1.5px solid #7A5D2A" : "1px solid #C8A96E" } : {}) }}>');
    expect(c).toContain('...(exp?.id === x.id ? { border: a11y ? "1.5px solid #7A5D2A" : "1px solid #C8A96E", borderTop: a11y ? "1.5px solid #7A5D2A" : "1px solid #C8A96E" } : {}) }}>');
  });
  it("сервер не меняли: stt и radio-tts — те же функции, что у Наставника", () => {
    const t = rd("ui/talk.jsx");
    expect(t).toContain("const STT_URL = () => `${SUPABASE_URL}/functions/v1/stt`;");
    expect(t).toContain("const TTS_URL = () => `${SUPABASE_URL}/functions/v1/radio-tts`;");
  });
});

describe("v65: метка сборки и описание", () => {
  it("«сборка v65», «Дополнение 378»", () => {
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v\d{2}<\/span>/);   // v66 — следующая метка
    expect(rd("CHANGES.md")).toContain("# Дополнение 378");
  });
});
