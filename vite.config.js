import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Разделяем сборку на отдельные кэшируемые чанки.
        // Логика приложения при этом не меняется — это чисто сборочная оптимизация:
        //  • content-data — все уроки и диалоги (большой, но меняется редко)
        //  • vendor       — react/react-dom (практически не меняется)
        // Благодаря этому обновление кода приложения не заставляет браузер
        // перекачивать ~800 КБ контента и сам React заново.
        manualChunks(id) {
          // Ленивые данные — отдельными чанками, чтобы они не склеивались
          // со стартовым контентом и грузились только по dynamic import:
          if (id.includes("data/modules-spg")) return "content-spg";
          if (id.includes("data/dialogues.js")) return "content-dialogues";
          // Стартовый контент (уроки официанта/менеджера) — кэшируемый чанк
          if (id.includes("/data/modules")) return "content-core";
          if (id.includes("node_modules/react")) return "vendor";
        },
      },
    },
  },
});
