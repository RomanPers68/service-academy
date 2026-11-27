// lib/file-kind.js — v209 (Доп. 535): какой файл выбрали и как его прочитать — общее для «Редактора меню» (v208) и
// винной и барной карты. PDF уходит на сервер файлом; Word (.docx) и текст читаются прямо на телефоне
// (lib/docx-text.js) и уходят текстом: запрос лёгкий, модель читает быстрее.
import { docxText } from "./docx-text.js";

export const DOC_ACCEPT = ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";
export const DOC_TEXT_MAX = 120000;   // знаков текста в запросе — как MAX_TEXT/DOC_MAX у сервера

/** Что за файл: "pdf" | "docx" | "txt" | "doc" (старый Word — не открыть) | "" (другое). */
export const fileKind = (file) => {
  const n = String((file && file.name) || "").toLowerCase(), t = String((file && file.type) || "");
  return /\.pdf$/.test(n) || t === "application/pdf" ? "pdf"
    : /\.docx$/.test(n) || /wordprocessingml/.test(t) ? "docx"
    : /\.(txt|md)$/.test(n) || /^text\/plain/.test(t) ? "txt"
    : /\.doc$/.test(n) || t === "application/msword" ? "doc" : "";
};

/** Word или текст → строка без пробелов по краям. Ошибки чтения Word — как у docxText ("zip", "no-inflate"). */
export async function fileText(file, kind = fileKind(file)) {
  return String(kind === "docx" ? await docxText(await file.arrayBuffer()) : await file.text()).trim();
}
