const { withRefContext } = await import("/tmp/refctx.mjs");
const out = withRefContext([{ role: "user", content: "Как решать споры при гостях?" }], { position: "waiter", restaurant: "Два моря, Океан" },
  { position: "waiter", roleTitle: "Официант", done: 1, total: 31, customLessons: [{ id: "cms-l-11", title: "Кто кому подчиняется", section: "Субординация" }, { id: "cms-l-12", title: "Если менеджера нет", section: "Субординация" }] });
const c = out[out.length - 1].content;
console.log(/\[cms-l-11\] Кто кому подчиняется \(раздел «Субординация»\)/.test(c) && /\[\[lesson:ID\]\]/.test(c) ? "✓ ассистент получает свои уроки с номерами" : "✗ нет своих уроков в контексте:\n" + c.slice(-400));
