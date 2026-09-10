// Дымовой рендер ключевых экранов (Доп. 218): ловит ошибки первого рендера,
// которые не видит сборщик — «undefined is not an object», «Cannot access before initialization» и т.п.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };

const T = { screen: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, para: { color: "#eee" }, bold: { color: "#fff" }, doneBtn: {}, secTitle: {}, modCard: {}, modBar: {}, modArrow: {}, lessHead: {}, lessHeadTitle: {}, backBtn2: {}, bullet: {}, a11y: false };
const profile = { id: "u1", name: "Тест", surname: "Тестов", restaurant: "Два моря, Океан", position: "manager", is_admin: true };

describe("smoke render", () => {
  it("Колода бармена", async () => { const { CocktailsScreen } = await import("../ui/cocktails"); expect(renderToString(<CocktailsScreen T={T} profile={profile} onBack={() => {}} onBuild={() => {}} onOpenDish={() => {}} />).length).toBeGreaterThan(1000); });
  it("Сборка руками", async () => { const { BarLabScreen } = await import("../ui/bar-lab"); expect(renderToString(<BarLabScreen T={T} profile={profile} onBack={() => {}} onOpenDeck={() => {}} />).length).toBeGreaterThan(1000); });
  it("Сборка руками — со своей картой бара и печатями (Доп. 222)", async () => {
    store.sa_menu_shared = JSON.stringify({ [profile.restaurant]: [{ id: "__barcard__", cocktails: ["negroni", "daiquiri", "mojito"] }] });
    store["sa_bar_mastery_" + profile.name + "_" + profile.surname] = JSON.stringify({ negroni: { level: 2, streak: 1 } });
    const { BarLabScreen } = await import("../ui/bar-lab");
    expect(renderToString(<BarLabScreen T={T} profile={profile} onBack={() => {}} onOpenDeck={() => {}} />).length).toBeGreaterThan(1000);
    expect(renderToString(<BarLabScreen T={T} profile={profile} startId="daiquiri" onBack={() => {}} onOpenDeck={() => {}} />).length).toBeGreaterThan(500);
    delete store.sa_menu_shared;
  });
  it("Тренажёр меню", async () => { const { MenuTrainerScreen } = await import("../ui/menu-trainer"); expect(renderToString(<MenuTrainerScreen T={T} profile={profile} role="waiter" onBack={() => {}} />).length).toBeGreaterThan(500); });
  it("Рейтинг", async () => { const { LeaderboardScreen } = await import("../ui/screens-gamification"); expect(renderToString(<LeaderboardScreen T={T} leaderboard={[]} scores={[]} profile={profile} onBack={() => {}} />).length).toBeGreaterThan(500); });
  it("Книга отзывов", async () => { const { GuestBookScreen } = await import("../ui/guestbook"); expect(renderToString(<GuestBookScreen T={T} profile={profile} role="bar" onBack={() => {}} />).length).toBeGreaterThan(500); });
  it("Справочник", async () => { const { ReferenceSection } = await import("../ui/ReferenceSection"); expect(renderToString(<ReferenceSection T={T} profile={profile} onExit={() => {}} onCocktails={() => {}} onBarLab={() => {}} />).length).toBeGreaterThan(500); });
});
