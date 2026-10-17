import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// Vite config runs in Node but @types/node isn't a dev dependency here.
declare const process: { cwd(): string };

export default defineConfig(({ mode }) => {
  // Host dev hits Django on localhost:8000; inside Compose it's the `backend` service.
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_PROXY_TARGET || "http://localhost:8000";
  return {
    plugins: [react()],
    resolve: {
      alias: { "@": "/src" },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes("node_modules")) return "vendor";
          },
        },
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": apiTarget,
        "/ws": { target: apiTarget, ws: true },
      },
    },
  };
});
