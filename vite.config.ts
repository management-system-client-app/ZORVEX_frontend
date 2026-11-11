import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = (env.VITE_API_URL || "https://e-commerce-chi-seven-16.vercel.app")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api\/v1$/i, "")
    .replace(/\/api$/i, "");
  const preferredPort = Number(env.PORT || process.env.PORT || 5173);

  const apiProxy = {
    "/api": {
      target: apiTarget,
      changeOrigin: true,
      secure: true,
    },
  };

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: "0.0.0.0",
      port: preferredPort,
      strictPort: false,
      proxy: apiProxy,
    },
    preview: {
      host: "0.0.0.0",
      port: preferredPort,
      strictPort: false,
      proxy: apiProxy,
    },
  };
});
