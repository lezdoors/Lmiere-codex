import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    build: {
      outDir: "dist/client",
    },
    define: {
      "import.meta.env.VITE_NEON_AUTH_URL": JSON.stringify(
        env.VITE_NEON_AUTH_URL || env.NEON_AUTH_BASE_URL || "",
      ),
    },
    optimizeDeps: {
      include: ["react", "react-dom/client"],
    },
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      warmup: {
        clientFiles: ["./src/main.jsx"],
      },
    },
    plugins: [react()],
  };
});
