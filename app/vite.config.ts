import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The app talks to a local validator / devnet by default. Nothing secret lives here:
// every value is a public RPC URL and a public program id.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
  build: { outDir: "dist", sourcemap: true },
});
