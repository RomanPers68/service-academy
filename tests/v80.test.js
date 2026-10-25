// v80 (Доп. 393): голос шефа и сомелье к блюду и «Как произносить».
// Запись — в форме блюда (voice-upload → корзина menu-voice, этап 30), в блюде остаётся ссылка; на обороте карточки —
// кнопки голосов (один звук за раз) и «Как произносить»; в тренажёре — «Голоса шефа и сомелье» (по одному и подряд) и
// словарь произношения (вино, кухня, бар): живой голос radio-tts (say / say_o), без него — голос телефона.
// Вид — tools/claude/e2e-v80.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { PRONOUNCE, PRON_CATS } from "../data/pronounce.js";
import { stressText, plainText, hasStress, findPronounce, searchPronounce } from "../lib/pronounce.js";

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const ACUTE = String.fromCharCode(0x301);
const V = "аеёиоуыэюяАЕЁИОУЫЭЮЯ";

describe("v80: словарь произношения", () => {
  it("разделы — вино, кухня, бар; у каждого слова оригинал и язык; без повторов", () => {
    expect(PRON_CATS.map((c) => c.id)).toEqual(["wine", "kitchen", "bar"]);
    expect(PRONOUNCE.length).toBeGreaterThan(150);
    for (const e of PRONOUNCE) {
      expect([e.w, PRON_CATS.some((c) => c.id === e.cat)]).toEqual([e.w, true]);
      expect([e.w, !!e.o && !!e.lang]).toEqual([e.w, true]);
    }
    const keys = PRONOUNCE.map((e) => plainText(e.w).toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("разметка: «+» только перед гласной; в слове из двух слогов и больше — ровно одно ударение (или «ё»)", () => {
    for (const e of PRONOUNCE) {
      [...e.w].forEach((ch, i) => { if (ch === "+") expect([e.w, V.includes(e.w[i + 1] || "")]).toEqual([e.w, true]); });
      for (const part of e.w.split(/[ ]/)) {
        // части через дефис («Блан-де-бл+ан», «Деми-с+ек»): ударение — у слова целиком
        const n = (part.match(/\+/g) || []).length;
        const syl = [...part.replace(/\+/g, "")].filter((ch) => V.includes(ch)).length;
        const yo = /ё/i.test(part);
        if (part.includes("-")) { expect([e.w, n >= 1 || yo]).toEqual([e.w, true]); continue; }
        expect([e.w, part, n <= 1]).toEqual([e.w, part, true]);
        if (syl >= 2 && !yo && !/^д’/.test(part)) expect([e.w, part, n]).toEqual([e.w, part, 1]);
        if (syl <= 1) expect([e.w, part, n]).toEqual([e.w, part, 0]);   // односложным знак не нужен
      }
    }
  });
  it("спорные слова в словарь не попали — их скажет свой сомелье или шеф", () => {
    for (const w of ["темпур", "гевюрц", "грюнер", "зинфандел", "пинотаж"]) expect([w, PRONOUNCE.some((e) => plainText(e.w).toLowerCase().includes(w))]).toEqual([w, false]);
  });
  it("частые ловушки — с подсказкой", () => {
    const tip = (w) => (PRONOUNCE.find((e) => plainText(e.w) === w) || {}).tip || "";
    expect(tip("Эспрессо")).toContain("экспрессо");
    expect(tip("Тапас")).toContain("тапАс");
    expect(tip("Брускетта")).toContain("«ск»");
    expect(stressText(PRONOUNCE.find((e) => e.o === "Aperol").w)).toBe("А" + ACUTE + "пероль");
  });
});

describe("v80: ударения и поиск", () => {
  it("«+» и заглавная гласная → знак ударения; без разметки — как было", () => {
    expect(stressText("бурр+ата")).toBe("бурра" + ACUTE + "та");
    expect(stressText("буррАта")).toBe("бурра" + ACUTE + "та");
    expect(stressText("АмарОне")).toBe("Амаро" + ACUTE + "не");
    expect(stressText("Амароне")).toBe("Амароне");
    expect(stressText("БУРРАТА")).toBe("БУРРАТА");
    expect(stressText("Шатонёф-дю-П+ап")).toBe("Шатонёф-дю-Па" + ACUTE + "п");
    expect(stressText("салат с буррАтой и тОматами")).toBe("салат с бурра" + ACUTE + "той и то" + ACUTE + "матами");
    expect(plainText("Шардон+е")).toBe("Шардоне");
    expect([hasStress("Буррата"), hasStress("бурр+ата"), hasStress("Гёдза")]).toEqual([false, true, true]);
  });
  it("слова словаря в названии блюда — по-русски, в падеже и в оригинале", () => {
    const f = (n) => findPronounce(n).map((e) => plainText(e.w));
    expect(f("Салат с бурратой и томатами")).toEqual(["Буррата"]);
    expect(f("Тартар из гребешка с юдзу")).toEqual(["Тартар", "Юдзу"]);
    expect(f("Burrata & tomatoes")).toEqual(["Буррата"]);
    expect(f("Том ям с креветками")).toEqual(["Том ям"]);
    expect(f("Борщ")).toEqual([]);
    expect(f("Томаты черри")).toEqual([]);   // короткое «том» — только целым словом
  });
  it("поиск — без ударений и регистра, по-русски и в оригинале", () => {
    expect(searchPronounce("кьян").map((e) => e.o)).toEqual(["Chianti"]);
    expect(searchPronounce("CHARD").map((e) => e.o)).toEqual(["Chardonnay"]);
    expect(searchPronounce("", "bar").length).toBeGreaterThan(20);
  });
});

describe("v80: запись голоса и плеер", () => {
  const vn = code(rd("lib/voice-note.js"));
  const ui = code(rd("ui/voice-note.jsx"));
  it("запись: до минуты; время — по монотонным часам; AudioContext закрывается один раз", () => {
    expect(vn).toContain("export const VOICE_MAX_SEC = 60;");
    expect(vn).toContain("const clock = () => (typeof performance !== \"undefined\" && performance.now ? performance.now() : Date.now());");
    expect(vn).toContain("const a = ac; ac = null;");
    expect(vn).toContain('["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"]');
  });
  it("звук для всех телефонов: AAC остаётся, остальное — WAV 16 кГц", async () => {
    expect(vn).toContain('import { blobToWav16k } from "./voice";');
    expect(vn).toContain("export const keepAsIs = (type) => /mp4a|aac/i.test(type || \"\") || (/mp4/i.test(type || \"\") && isSafari());");
    expect(vn).toMatch(/if \(keepAsIs\(type\)\) return \{ blob, mime: "audio\/mp4" \};\s*const wav = await blobToWav16k\(blob\);\s*return \{ blob: wav, mime: "audio\/wav" \};/);
  });
  it("загрузка — voice-upload; файлы не удаляются сразу, уборка — после публикации", () => {
    expect(vn).toContain("`${SUPABASE_URL}/functions/v1/voice-upload`");
    expect(vn).toContain("export function sweepVoices(restaurant)");
    expect(vn).toContain("call({ restaurant, sweep: true })");
    expect(vn).not.toContain("remove:");
    expect(ui).not.toContain("removeClip");
  });
  it("один звук за раз; обещание ссылки — с беззвучным WAV по нажатию (iPhone)", () => {
    expect(ui).toContain("export function stopVoice() { const p = playing; playing = null; if (p) { try { p.stop(); } catch (e) {} } }");
    expect(ui).toContain('if (url && typeof url.then === "function") {');
    expect(ui).toContain("const s = silentUrl();");
    expect(ui).toContain("audio.ontimeupdate = null; audio.onended = null; audio.onerror = null;");
  });
  it("запись в форме: «жив» — в эффекте (двойной монтаж StrictMode), очередь подряд занимает эфир и с пустого", () => {
    expect(ui).toContain("React.useEffect(() => { alive.current = true; return () => {");
    expect(ui).toContain("if (!meRef.current || playing !== meRef.current) meRef.current = claimVoice(halt);");
    expect(rd("ui/voice-note.jsx")).toContain("// один и тот же <audio> на всю очередь");
  });
  it("подпись: «Шеф · Алексей», а «шеф Алексей» — без повтора", () => {
    expect(ui).toContain("nm.toLowerCase().startsWith(meta.label.toLowerCase())");
  });
});

describe("v80: тренажёр меню", () => {
  const mt = code(rd("ui/menu-trainer.jsx"));
  it("плитки: голоса — если есть записи; словарь — всегда", () => {
    expect(mt).toContain("...(voiceCount ? [{ key: \"voices\"");
    expect(mt).toContain('title: "Голоса шефа и сомелье"');
    expect(mt).toContain('title: "Как произносить"');
    expect(mt).toContain('if (mode === "say") return <PronounceScreen');
    expect(mt).toContain('if (mode === "voices") return <VoicesList');
  });
  it("оборот карточки: «Как произносить» и голоса — нажатие не переворачивает карточку", () => {
    expect(mt).toContain("<SayLine d={d} gold={gold} text={text} sub={sub} a11y={a11y} />");
    expect(mt).toContain('<div data-dish-voices="" style={{ marginBottom: 10 }} onClick={(e) => e.stopPropagation()}>');
  });
  it("форма блюда: «Как произносить» с превью, запись шефа и сомелье, уборка после публикации", () => {
    expect(mt).toContain('placeholder="Как произносить: «+» перед ударной гласной, например бурр+ата"');
    expect(mt).toContain("<VoiceRecorder key={k} kind={k}");
    expect(mt).toContain("sweepVoices(restaurant);");
  });
  it("«не опубликовано» видит и вложенные поля (перезапись голоса)", () => {
    expect(mt).toContain("const canonSort = (v) => Array.isArray(v) ? v.map(canonSort)");
    expect(mt).not.toContain("JSON.stringify(o, Object.keys(o).sort())");
  });
  it("Наставник знает своё ударение и записи к блюду", () => {
    const rc = code(rd("lib/reference-context.js"));
    expect(rc).toContain("Как произносить (ударение — «+» перед гласной)");
    expect(rc).toContain("В карточке блюда есть запись:");
  });
});

describe("v80: сервер", () => {
  const fn = rd("supabase/functions/voice-upload/index.ts");
  const sql = rd("supabase/supabase-stage30-voice.sql");
  const tts = rd("supabase/functions/radio-tts/index.ts");
  it("voice-upload: вход и права как у фото, корзина menu-voice, до 3 МБ, m4a / wav / mp3", () => {
    expect(fn).toContain("/rest/v1/rpc/whoami");
    expect(fn).toContain('const allowed = !!emp.is_admin || ["manager", "senior"].includes(String(emp.position || ""));');
    expect(fn).toContain('const BUCKET = "menu-voice";');
    expect(fn).toContain("const MAX_BYTES = 3 * 1024 * 1024;");
    expect(fn).toContain('const KINDS = ["chef", "som"];');
    expect(fn).toContain('const CT: Record<string, string> = { m4a: "audio/mp4", wav: "audio/wav", mp3: "audio/mpeg" };');
  });
  it("уборка: только по опубликованному меню, папка своего заведения, старше 14 дней; меню не прочиталось — не трогаем", () => {
    expect(fn).toContain("const KEEP_DAYS = 14;");
    expect(fn).toContain("/rest/v1/rpc/menu_get");
    expect(fn).toContain('if (!menu) return json({ ok: false, error: "menu" }, 502);');
    expect(fn).toContain("body: JSON.stringify({ prefix: folder, limit: 1000, offset: 0 })");
    expect(fn).toContain("body: JSON.stringify({ prefixes: drop })");
  });
  it("этап 30: публичная корзина menu-voice, 3 МБ, только звук; чтение — всем", () => {
    expect(sql).toContain("values ('menu-voice', 'menu-voice', true, 3145728, array['audio/mp4','audio/wav','audio/mpeg'])");
    expect(sql).toContain('create policy "menu voice public read" on storage.objects');
    expect(sql).not.toMatch(/for insert|for update|for delete/i);
  });
  it("radio-tts: голоса произношения say (по-русски с ударением) и say_o (в оригинале)", () => {
    expect(tts).toContain('const WHO = ["host", "guest", "staff", "guest_f", "mentor", "say", "say_o"];');
    expect(tts).toContain("say: \"Диктор учит официантов произносить названия блюд и вин.");
    expect(tts).toContain("say_o: \"Носитель языка оригинала.");
  });
});

describe("v80: метка и журнал", () => {
  it("«сборка v80», «Дополнение 393»", () => {
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(8\d|9\d|\d{3,})<\/span>/);   // v80 и дальше
    expect(rd("CHANGES.md")).toContain("# Дополнение 393 — голос шефа и сомелье, как произносить меню и вина (v80)");
  });
});
