// supabase/functions/app-api/shim.js — v207 (Доп. 533): то, чего ждут обработчики из api/ (писались для Vercel/Node),
// а в Supabase (Deno) может не быть: process.env и Buffer. Подключается в entry.js первым — до самих обработчиков:
// api/_auth.js читает process.env уже при загрузке.
import { Buffer } from "node:buffer";

const g = globalThis;
if (!g.process) g.process = { env: {} };
if (!g.process.env) g.process.env = {};
try {
  const all = g.Deno && g.Deno.env && typeof g.Deno.env.toObject === "function" ? g.Deno.env.toObject() : {};
  for (const [k, v] of Object.entries(all)) if (g.process.env[k] === undefined) g.process.env[k] = v;
} catch (e) { /* нет прав на окружение — обработчики возьмут свои значения по умолчанию */ }
if (!g.Buffer) g.Buffer = Buffer;
