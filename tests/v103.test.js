// v103 (Доп. 416): «Линза» в чате и на белой бумаге. Владелец (29.10, снимки из Telegram): «может эти кружки тоже
// сделаем линзами? В чате я имею в виду» и «ну и эту печать, в теме для чтения… как в тёмной». e2e —
// tools/claude/e2e-v103.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import { NowInvitation } from "../ui/now-hero";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
const before = { mode: "before", mins: 26, from: 11, to: 24, title: "Разминка перед сменой", sub: "3 вопроса · 2 мин", cta: "Начать", action: "warmup" };

describe("v103: чат — линзы по классам (ui/chat.jsx, ui/chat-cards.jsx)", () => {
  const CSS = rd("ui/home-look.jsx");
  it("кружки чатов и людей, «назад» в шапке, кружки листа «+», «вниз», колокольчик — стекло, ободок, кольцо", () => {
    expect(CSS).toContain("html.sa-lens .ch-ava,html.sa-lens .ch-tile-i,html.sa-lens .ch-back,html.sa-lens .ch-down,html.sa-lens .ch-bell{");
    expect(CSS).toContain("html.sa-lens .ch-ava::after,html.sa-lens .ch-tile-i::after,html.sa-lens .ch-back::after,html.sa-lens .ch-down::after,html.sa-lens .ch-bell::after{");
    expect(CSS).toContain("html.sa-lens .ch-ava.team,html.sa-lens .ch-tile-i,html.sa-lens .ch-back{color:var(--lk-gold)!important}");
    expect(CSS).toContain("html.sa-lens .ch-back{width:34px;height:34px;margin:3px}");
  });
  it("«вниз» — уже position:absolute: относительной не делаем (кольцо и так у кнопки)", () => {
    expect(CSS).toContain("html.sa-lens .ch-tile-i,html.sa-lens .ch-back,html.sa-lens .ch-bell{position:relative}");
    expect(rd("ui/chat.jsx")).toMatch(/\.ch-down\{position:absolute;/);
  });
  it("«отправить» (главное действие), сообщения и карточки переписки — без линзы", () => {
    // v104 (Доп. 417): «отправить» и кнопки подтверждения листов — линзы по просьбе владельца (раздел v104); здесь — v103
    const end = CSS.indexOf("/* ── v104"), chat = CSS.slice(CSS.indexOf("/* ── v103"), end > 0 ? end : undefined);
    expect(chat).not.toMatch(/\.ch-send|\.ch-bubble|\.ch-msg|\.ch-card/);
  });
  it("классы чата, на которые опирается линза, на месте", () => {
    const cards = rd("ui/chat-cards.jsx"), chat = rd("ui/chat.jsx");
    expect(cards).toContain('<span className="ch-tile-i" aria-hidden="true">{TILE_IC[t.id]}</span>');
    expect(chat).toContain('className="ch-back" data-sa-back=""');
    expect(chat).toContain('<span className={"ch-ava team" + (big ? " big" : "")} aria-hidden="true">');
  });
});

describe("v103: «Начать» на белой бумаге — линза в виде «Линза»", () => {
  it("«Для чтения» + «Линза» — линза тёмным золотом, сургуча нет", () => {
    const html = R(h(NowInvitation, { ctx: before, a11y: true, lens: true, on: {} }));
    expect(html).toContain('data-hero="paper"');
    expect(html).toContain('data-now-lens="light"');
    expect(html).not.toContain("data-now-seal");
    const at = html.indexOf("data-now-lens"), el = html.slice(at, html.indexOf(">", at));
    expect(el).toContain("background:rgba(139,106,48,0.09)");
    expect(el).toContain("box-shadow:inset 0 0 0 1px rgba(139,106,48,0.55), inset 0 0 18px rgba(255,255,255,0.5), inset 0 1.5px 0 rgba(255,255,255,0.95)");
    expect(html).toContain("border:1.5px solid rgba(139,106,48,0.7)");
  });
  it("«как сейчас» на белой бумаге — сургуч, как был; тёмная — линза в любом виде", () => {
    const light = R(h(NowInvitation, { ctx: before, a11y: true, on: {} }));
    expect(light).toContain("data-now-seal");
    expect(light).not.toContain("data-now-lens");
    for (const lens of [true, false]) {
      const dark = R(h(NowInvitation, { ctx: before, a11y: false, lens, on: {} }));
      expect(dark).toContain('data-now-lens=""');
      expect(dark).not.toContain("data-now-seal");
    }
  });
  it("главная передаёт вид в приглашение", () => {
    expect(rd("ui/screens-roleselect.jsx")).toContain('<NowInvitation key={card.mode} ctx={card} a11y={a11y} rows={rows} foot={foot} on={ctx ? nowOn : { go }}\n                  lens={look === "lens"} fade={');
    expect(rd("ui/now-hero.jsx")).toContain('{dark ? <Lens size={44} icon={icon} /> : lens ? <Lens size={44} icon={icon} light /> : <WaxSeal size={50} icon={icon} />}');
  });
});
