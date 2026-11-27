import { defineConfig } from "vite";
export default defineConfig({
  base: "/workout-game/",
  worker: { format: "es" },
  build: { target: "es2022" },
});
