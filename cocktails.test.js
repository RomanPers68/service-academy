// Колода бармена: спеки целые, id уникальны, у каждого коктейля есть история.
import { describe, it, expect } from "vitest";
import { COCKTAILS } from "../data/cocktails";
import { COCKTAIL_STORIES } from "../data/cocktail-stories";

describe("cocktails", () => {
  it("id уникальны, у всех есть название и спек", () => {
    const ids = COCKTAILS.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of COCKTAILS) {
      expect(typeof c.name).toBe("string");
      expect(Array.isArray(c.ing) && c.ing.length > 0).toBe(true);
      for (const i of c.ing) expect(typeof i[0]).toBe("string");
    }
  });
  it("у каждого коктейля есть история и фраза гостю", () => {
    for (const c of COCKTAILS) {
      const st = COCKTAIL_STORIES[c.id];
      expect(st && st.story && st.guest ? true : c.id).toBe(true);
    }
  });
});
