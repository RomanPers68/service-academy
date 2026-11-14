// Мини-замена vitest для песочницы без сети: describe / it / expect / хуки / vi (таймеры).
// Подключается сборщиком вместо "vitest" (run-tests.mjs). Покрывает то, чем пользуются tests/*.test.js проекта.
const root = { name: "", parent: null, kids: [], tests: [], beforeAll: [], afterAll: [], beforeEach: [], afterEach: [] };
let cur = root;
export function describe(name, fn) { const s = { name, parent: cur, kids: [], tests: [], beforeAll: [], afterAll: [], beforeEach: [], afterEach: [] }; cur.kids.push(s); const prev = cur; cur = s; try { fn(); } finally { cur = prev; } }
describe.skip = () => {}; describe.todo = () => {};
export function it(name, fn) { cur.tests.push({ name, fn }); }
it.skip = () => {}; it.todo = () => {};
export const test = it;
export const beforeAll = (fn) => cur.beforeAll.push(fn), afterAll = (fn) => cur.afterAll.push(fn), beforeEach = (fn) => cur.beforeEach.push(fn), afterEach = (fn) => cur.afterEach.push(fn);

const isAsym = (x) => x && typeof x === "object" && typeof x.asymmetricMatch === "function";
const show = (v) => { try { const s = typeof v === "string" ? JSON.stringify(v) : typeof v === "function" ? "[function]" : v instanceof RegExp ? String(v) : JSON.stringify(v, (k, x) => (x === undefined ? "__undefined__" : typeof x === "bigint" ? String(x) : x)); return (s === undefined ? String(v) : s).slice(0, 600); } catch (e) { return String(v).slice(0, 600); } };
function eq(a, b) {
  if (isAsym(b)) return b.asymmetricMatch(a);
  if (isAsym(a)) return a.asymmetricMatch(b);
  if (Object.is(a, b)) return true;
  if (typeof a === "number" && typeof b === "number") return a === b;   // +0 и −0
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (a instanceof Date || b instanceof Date) return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  if (a instanceof RegExp || b instanceof RegExp) return a instanceof RegExp && b instanceof RegExp && String(a) === String(b);
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (!eq(a[i], b[i])) return false; return true; }
  if (a instanceof Map || b instanceof Map) { if (!(a instanceof Map && b instanceof Map) || a.size !== b.size) return false; for (const [k, v] of a) if (!b.has(k) || !eq(v, b.get(k))) return false; return true; }
  if (a instanceof Set || b instanceof Set) { if (!(a instanceof Set && b instanceof Set) || a.size !== b.size) return false; for (const v of a) { let ok = false; for (const w of b) if (eq(v, w)) { ok = true; break; } if (!ok) return false; } return true; }
  const ka = Object.keys(a).filter((k) => a[k] !== undefined), kb = Object.keys(b).filter((k) => b[k] !== undefined);   // toEqual: undefined — как нет
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!Object.prototype.hasOwnProperty.call(b, k) || !eq(a[k], b[k])) return false;
  return true;
}
function subset(a, b) {   // toMatchObject: b — часть a
  if (isAsym(b)) return b.asymmetricMatch(a);
  if (b === null || typeof b !== "object") return eq(a, b);
  if (a === null || typeof a !== "object") return false;
  if (b instanceof Date || b instanceof RegExp) return eq(a, b);
  if (Array.isArray(b)) { if (!Array.isArray(a) || a.length !== b.length) return false; for (let i = 0; i < b.length; i++) if (!subset(a[i], b[i])) return false; return true; }
  for (const k of Object.keys(b)) { if (b[k] === undefined) { if (a[k] !== undefined) return false; continue; } if (!(k in a) || !subset(a[k], b[k])) return false; }
  return true;
}
const getPath = (o, path) => { const parts = Array.isArray(path) ? path : String(path).split(/[.[\]]+/).filter(Boolean); let x = o; for (const p of parts) { if (x == null || !(p in Object(x))) return { has: false }; x = x[p]; } return { has: true, v: x }; };
const thrownOk = (e, exp) => exp === undefined ? true : typeof exp === "string" ? String(e && e.message !== undefined ? e.message : e).includes(exp) : exp instanceof RegExp ? exp.test(String(e && e.message !== undefined ? e.message : e)) : typeof exp === "function" ? e instanceof exp : true;
function matchers(actual, neg) {
  const chk = (ok, msg) => { if (neg ? ok : !ok) throw new Error((neg ? "не ожидалось: " : "") + msg()); };
  const M = {
    toBe: (e) => chk(Object.is(actual, e), () => `toBe: получено ${show(actual)}, ожидалось ${show(e)}`),
    toEqual: (e) => chk(eq(actual, e), () => `toEqual: получено ${show(actual)}, ожидалось ${show(e)}`),
    toStrictEqual: (e) => chk(eq(actual, e), () => `toStrictEqual: получено ${show(actual)}, ожидалось ${show(e)}`),
    toContain: (e) => chk(typeof actual === "string" ? actual.includes(e) : actual && typeof actual.has === "function" && !Array.isArray(actual) ? actual.has(e) : Array.from(actual || []).some((x) => Object.is(x, e) || x === e), () => `toContain: в ${show(actual).slice(0, 220)}… нет ${show(e)}`),
    toContainEqual: (e) => chk(Array.from(actual || []).some((x) => eq(x, e)), () => `toContainEqual: нет ${show(e)} в ${show(actual)}`),
    toMatch: (e) => chk(typeof e === "string" ? String(actual).includes(e) : e.test(String(actual)), () => `toMatch: ${show(actual).slice(0, 220)}… не подходит под ${String(e)}`),
    toMatchObject: (e) => chk(subset(actual, e), () => `toMatchObject: получено ${show(actual)}, ожидалась часть ${show(e)}`),
    toBeGreaterThan: (e) => chk(actual > e, () => `${show(actual)} > ${show(e)}`),
    toBeGreaterThanOrEqual: (e) => chk(actual >= e, () => `${show(actual)} >= ${show(e)}`),
    toBeLessThan: (e) => chk(actual < e, () => `${show(actual)} < ${show(e)}`),
    toBeLessThanOrEqual: (e) => chk(actual <= e, () => `${show(actual)} <= ${show(e)}`),
    toBeNull: () => chk(actual === null, () => `toBeNull: ${show(actual)}`),
    toBeUndefined: () => chk(actual === undefined, () => `toBeUndefined: ${show(actual)}`),
    toBeDefined: () => chk(actual !== undefined, () => `toBeDefined`),
    toBeTruthy: () => chk(!!actual, () => `toBeTruthy: ${show(actual)}`),
    toBeFalsy: () => chk(!actual, () => `toBeFalsy: ${show(actual)}`),
    toBeNaN: () => chk(Number.isNaN(actual), () => `toBeNaN: ${show(actual)}`),
    toHaveLength: (n) => chk(actual != null && actual.length === n, () => `toHaveLength: длина ${actual == null ? "нет" : actual.length}, ожидалось ${n}`),
    toHaveProperty: (path, ...v) => { const g = getPath(actual, path); chk(g.has && (!v.length || eq(g.v, v[0])), () => `toHaveProperty ${show(path)}${v.length ? " = " + show(v[0]) : ""}: ${g.has ? show(g.v) : "нет"}`); },
    toBeCloseTo: (e, d = 2) => chk(Math.abs(actual - e) < Math.pow(10, -d) / 2, () => `toBeCloseTo: ${show(actual)} ≈ ${show(e)}`),
    toBeInstanceOf: (C) => chk(actual instanceof C, () => `toBeInstanceOf ${C && C.name}`),
    toBeTypeOf: (t) => chk(typeof actual === t, () => `toBeTypeOf ${t}: ${typeof actual}`),
    toThrow: (exp) => { let thrown = false, err; try { actual(); } catch (e) { thrown = true; err = e; } chk(thrown && thrownOk(err, exp), () => `toThrow${exp !== undefined ? " " + show(exp) : ""}: ${thrown ? "брошено " + show(err && err.message) : "не брошено"}`); },
  };
  M.toThrowError = M.toThrow;
  return M;
}
function asyncMatchers(promise, wantReject, neg) {
  const out = {};
  for (const name of Object.keys(matchers(null, false))) out[name] = async (...args) => {
    let v, err, rejected = false;
    try { v = await (typeof promise === "function" ? promise() : promise); } catch (e) { rejected = true; err = e; }
    if (wantReject) { if (!rejected) throw new Error("rejects: обещание выполнилось: " + show(v));
      if (name === "toThrow" || name === "toThrowError") { const ok = thrownOk(err, args[0]); if (neg ? ok : !ok) throw new Error(`rejects.toThrow ${show(args[0])}: брошено ${show(err && err.message)}`); return; }
      return matchers(err, neg)[name](...args); }
    if (rejected) throw err;
    return matchers(v, neg)[name](...args);
  };
  return out;
}
export function expect(actual) {
  const m = matchers(actual, false);
  m.not = matchers(actual, true);
  m.resolves = asyncMatchers(actual, false, false); m.resolves.not = asyncMatchers(actual, false, true);
  m.rejects = asyncMatchers(actual, true, false); m.rejects.not = asyncMatchers(actual, true, true);
  return m;
}
expect.any = (C) => ({ asymmetricMatch: (x) => C === String ? typeof x === "string" : C === Number ? typeof x === "number" : C === Boolean ? typeof x === "boolean" : C === Function ? typeof x === "function" : C === Object ? x !== null && typeof x === "object" : C === Array ? Array.isArray(x) : x instanceof C });
expect.anything = () => ({ asymmetricMatch: (x) => x !== null && x !== undefined });
expect.arrayContaining = (arr) => ({ asymmetricMatch: (x) => Array.isArray(x) && arr.every((e) => x.some((y) => eq(y, e))) });
expect.objectContaining = (obj) => ({ asymmetricMatch: (x) => x !== null && typeof x === "object" && Object.keys(obj).every((k) => k in x && eq(x[k], obj[k])) });
expect.stringContaining = (s) => ({ asymmetricMatch: (x) => typeof x === "string" && x.includes(s) });
expect.stringMatching = (r) => ({ asymmetricMatch: (x) => typeof x === "string" && (typeof r === "string" ? x.includes(r) : r.test(x)) });

// vi: подмена таймеров (useFakeTimers / advanceTimersByTime / useRealTimers)
const real = { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval };
let fake = null;
export const vi = {
  useFakeTimers() { fake = { now: 0, seq: 1, list: [] };
    globalThis.setTimeout = (fn, ms = 0, ...a) => { const id = fake.seq++; fake.list.push({ id, at: fake.now + Math.max(0, Number(ms) || 0), fn, a, every: 0 }); return id; };
    globalThis.setInterval = (fn, ms = 0, ...a) => { const id = fake.seq++; const e = Math.max(1, Number(ms) || 0); fake.list.push({ id, at: fake.now + e, fn, a, every: e }); return id; };
    globalThis.clearTimeout = globalThis.clearInterval = (id) => { if (fake) fake.list = fake.list.filter((t) => t.id !== id); };
    return vi; },
  advanceTimersByTime(ms) { if (!fake) return vi; const end = fake.now + ms;
    for (;;) { const due = fake.list.filter((t) => t.at <= end).sort((x, y) => x.at - y.at || x.id - y.id)[0]; if (!due) break;
      fake.now = due.at; if (due.every) due.at += due.every; else fake.list = fake.list.filter((t) => t !== due); due.fn(...due.a); }
    fake.now = end; return vi; },
  runAllTimers() { if (fake) { let n = 0; while (fake.list.length && n++ < 10000) vi.advanceTimersByTime(Math.max(0, Math.min(...fake.list.map((t) => t.at)) - fake.now)); } return vi; },
  useRealTimers() { fake = null; Object.assign(globalThis, real); return vi; },
};

// прогон: вызывается в конце собранного файла
globalThis.__vt_run = async () => {
  const res = { pass: 0, fail: 0, fails: [] };
  const hooks = (s, key) => { const chain = []; for (let x = s; x; x = x.parent) chain.unshift(x); return key === "afterEach" ? chain.reverse().flatMap((x) => x[key]) : chain.flatMap((x) => x[key]); };
  const path = (s) => { const p = []; for (let x = s; x && x.parent; x = x.parent) p.unshift(x.name); return p.join(" › "); };
  async function run(s) {
    let ok = true;
    try { for (const h of s.beforeAll) await h(); } catch (e) { ok = false; res.fail++; res.fails.push({ name: path(s) + " › beforeAll", msg: String(e && e.message || e).slice(0, 900) }); }
    if (ok) for (const t of s.tests) {
      try { for (const h of hooks(s, "beforeEach")) await h(); await t.fn(); for (const h of hooks(s, "afterEach")) await h(); res.pass++; }
      catch (e) { res.fail++; res.fails.push({ name: path(s) + " › " + t.name, msg: String(e && e.message || e).slice(0, 900) }); try { for (const h of hooks(s, "afterEach")) await h(); } catch (e2) {} }
    }
    if (ok) for (const k of s.kids) await run(k);
    try { for (const h of s.afterAll) await h(); } catch (e) { res.fail++; res.fails.push({ name: path(s) + " › afterAll", msg: String(e && e.message || e).slice(0, 900) }); }
  }
  await run(root);
  return res;
};
