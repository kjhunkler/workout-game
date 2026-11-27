import { defineConfig } from "vite";
import { execFileSync } from "node:child_process";
const buildId = execFileSync("git", ["rev-parse", "--short=12", "HEAD"], {
  encoding: "utf8",
}).trim();
export default defineConfig({
  base: "/workout-game/",
  define: { __APP_BUILD__: JSON.stringify(buildId) },
  worker: { format: "es" },
  build: { target: "es2022" },
});
