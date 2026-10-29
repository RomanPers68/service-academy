// v105 (Доп. 418): линза в переписке. Владелец (29.10, снимок «Вся команда»): «может, в чат линзу интегрируем?».
// Сообщения читают, поэтому колец вокруг пузырей нет: стекло и свет, как у карточек на главной. e2e — tools/claude/e2e-v105.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const rd = (f) => readFileSync(f, "utf8");
const SRC = rd("ui/home-look.jsx");
const V105 = SRC.slice(SRC.indexOf("/* ── v105"), SRC.lastIndexOf("`;"));
const CHAT = rd("ui/chat.jsx"), CARDS = rd("ui/chat-cards.jsx");

describe("v105: пузыри", () => {
  it("чужие — стекло: свет сверху, золотой ободок, блик; свои — золото с бликом и светлым ободком", () => {
    expect(V105).toContain("html.sa-lens .ch-in,html.sa-lens .ch-typing{background:radial-gradient(140% 120% at 18% 0%,var(--lk-sheen-in),transparent 58%),var(--in);");
    expect(V105).toContain("box-shadow:inset 0 0 0 1px var(--lk-rim-in),inset 0 1.5px 0 var(--lk-hl-in),var(--lk-sh-b)}");
    expect(V105).toContain("html.sa-lens .ch-out{background:radial-gradient(140% 120% at 18% 0%,var(--lk-sheen-out),transparent 55%),linear-gradient(180deg,var(--out-a),var(--out-b));");
    expect(V105).toContain("--lk-rim-in:rgba(214,178,102,0.30);");
    expect(V105).toContain("html.sa-lens .sa-dlg.ch.lt{--lk-rim-in:rgba(139,106,48,0.30);");
  });
  it("текст прежний: ни цвета, ни кегля, ни отступов у пузырей; колец (::after со смещением) у пузырей нет", () => {
    const rules = V105.split("\n").filter((l) => /\.ch-(in|out)\b[^{]*\{/.test(l));
    for (const r of rules) expect(r, r).not.toMatch(/(^|[;{])\s*(color|font-size|padding|margin|width|height):/);
    expect(V105).not.toMatch(/\.ch-(in|out|b)::after\{[^}]*inset:-3\.5px/);
  });
  it("«тебя упомянули» — ободок ярче; у Наставника своя рамка, ободок не двоится", () => {
    expect(V105).toContain("html.sa-lens .ch-row.atme .ch-in{--lk-rim-in:rgba(228,200,140,0.78);");
    expect(V105).toContain("html.sa-lens .ch-b.ai{--lk-rim-in:transparent}");
    expect(CARDS).toContain(".ch-b.ai{border:1px solid var(--edge-gold)}");
  });
});

describe("v105: хвостик продолжает ободок", () => {
  it("две маски той же формы, что TAIL в ui/chat.jsx: с краем (ободок) и на 1 px внутрь (заливка поверх)", () => {
    expect(CHAT).toContain("<path d='M6 0C6 7.5 4.6 12.6 0 16h11v-5H6z'/>");
    expect(SRC).toContain('const TAIL_RIM = tailSvg("M6 0C6 7.5 4.6 12.6 0 16h11v-5H7V0z"), TAIL_FILL = tailSvg("M7 0C7 7.3 5.7 12 2.6 15H11v-4H7z");');
    expect(V105).toContain("html.sa-lens .sa-dlg.ch{--tail-o:${TAIL_RIM};--tail-i:${TAIL_FILL};");
    expect(V105).toContain("html.sa-lens .ch-row.tail .ch-b::before{-webkit-mask-image:var(--tail-o);mask-image:var(--tail-o)}");
    expect(V105).toContain("html.sa-lens .ch-row.tail .ch-in::before{background:linear-gradient(var(--lk-rim-in),var(--lk-rim-in)),var(--in)}");
    expect(V105).toContain("-webkit-mask:var(--tail-i) no-repeat 0 0/100% 100%;mask:var(--tail-i) no-repeat 0 0/100% 100%}");
    expect(V105).toContain("html.sa-lens .ch-row.tail .ch-out::after{right:-6px;background:var(--out-b);transform:scaleX(-1)}");
  });
  it("хвостик в ui/chat.jsx — прежний (::before, маска --tail): в виде «как сейчас» ничего не меняется", () => {
    expect(CHAT).toContain('.ch-row.tail .ch-b::before{content:"";position:absolute;bottom:0;width:11px;height:16px;-webkit-mask:var(--tail) no-repeat 0 0/100% 100%;');
    expect(CHAT).toContain(".ch-row.tail .ch-in::before{left:-6px;background:var(--in)}");
  });
});

describe("v105: карточки, плашки, поля", () => {
  it("карточки и вызов — стекло с бликом; золотой корешок — с бликом (погасший и стоп-лист — прежние)", () => {
    expect(V105).toContain("html.sa-lens .ch-card,html.sa-lens .ch-call{background:radial-gradient(120% 90% at 30% 0%,var(--lk-sheen-in),transparent 60%),var(--card);");
    expect(V105).toContain("html.sa-lens .ch-card:not(.done):not(.stopc) .ch-card-tile{");
  });
  it("«Иду», «Забрать» и другие главные кнопки карточек — стеклянные плашки с кольцом, как кнопки листов; вторичные — прежние", () => {
    expect(V105).toContain("html.sa-lens .ch-go,html.sa-lens .ch-cbtn:not(.ghost):not(.bad){position:relative;color:var(--lk-hi);");
    expect(V105).toContain("html.sa-lens .ch-go::after,html.sa-lens .ch-cbtn:not(.ghost):not(.bad)::after,html.sa-lens .ch-more::after{");
    expect(V105).toContain("html.sa-lens.sa-light .ch-go,html.sa-lens.sa-light .ch-cbtn:not(.ghost):not(.bad){background:radial-gradient(120% 160% at 50% 0%,rgba(255,255,255,0.85),rgba(176,138,70,0.22) 70%);");
    expect(CARDS).toContain('className="ch-cbtn ghost"');
  });
  it("«Сегодня» — плашка с кольцом по её скруглению; строка ввода, поиск и поля листов — стекло, в фокусе ободок ярче", () => {
    expect(V105).toContain('html.sa-lens .ch-day::after{content:"";position:absolute;inset:-3.5px;border-radius:15.5px;');
    expect(CHAT).toMatch(/\.ch-day\{[^}]*border-radius:12px;/);
    expect(V105).toContain("html.sa-lens .ch-input,html.sa-lens .ch-search,html.sa-lens .ch-field{background:var(--lk-glass);border-color:transparent;");
    expect(V105).toContain("html.sa-lens .ch-input:focus,html.sa-lens .ch-search:focus,html.sa-lens .ch-field:focus{box-shadow:inset 0 0 0 1px var(--lk-hi),");
  });
  it("с состоянием — прежние: чипы, строки выбора, нажатые реакции, галочки, счётчики", () => {
    expect(V105).not.toMatch(/\.ch-chip|\.ch-opt[{\[ ]|\.ch-rx|\.ch-tick|\.ch-badge|\.ch-rbtn|\.ch-person/);
  });
  it("классы, на которые опирается линза, на месте", () => {
    for (const c of [".ch-in{", ".ch-out{", ".ch-call{", ".ch-go{", ".ch-day{", ".ch-sys{", ".ch-more{", ".ch-input{", ".ch-search{", ".ch-field{", ".ch-swipe{", ".ch-mc{"]) expect(CHAT, c).toContain(c);
    for (const c of [".ch-card{", ".ch-card-tile{", ".ch-cbtn{", ".ch-sg{", ".ch-typing{", ".ch-ai-nm .ch-ai-d{"]) expect(CARDS, c).toContain(c);
  });
});
