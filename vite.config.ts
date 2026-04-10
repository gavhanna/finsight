import { defineConfig } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import viteTsConfigPaths from "vite-tsconfig-paths"
import tailwindcss from "@tailwindcss/vite"
import { nitro } from "nitro/vite"
import { execSync } from "child_process"

function getGitTag(): string {
  try {
    return execSync("git describe --tags --abbrev=0", { encoding: "utf8" }).trim()
  } catch {
    return "dev"
  }
}

const config = defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(getGitTag()),
  },
  plugins: [
    devtools(),
    nitro({ plugins: ["./src/server/plugins/cron.ts"] }),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
