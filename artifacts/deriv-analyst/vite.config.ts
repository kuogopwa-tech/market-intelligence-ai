import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const isReplit = !!process.env.REPL_ID;

const basePath = process.env.BASE_PATH || "/";

const plugins: PluginOption[] = [
  react(),
  tailwindcss(),
];

if (process.env.NODE_ENV !== "production" && isReplit) {
  try {
    const runtimeErr = await import("@replit/vite-plugin-runtime-error-modal");
    if (runtimeErr?.default) plugins.push(runtimeErr.default());
  } catch {}

  try {
    const cart = await import("@replit/vite-plugin-cartographer");
    if (cart?.cartographer) {
      plugins.push(
        cart.cartographer({
          root: path.resolve(import.meta.dirname, ".."),
        })
      );
    }
  } catch {}

  try {
    const banner = await import("@replit/vite-plugin-dev-banner");
    if (banner?.devBanner) plugins.push(banner.devBanner());
  } catch {}
}

const server = {
  host: "0.0.0.0",
  strictPort: true,
  allowedHosts: true as true,
  fs: {
    strict: true,
  },
  proxy: {
    "/api": {
      target: "http://localhost:3000",
      changeOrigin: true,
      secure: false,
    },
  },
  port: Number(process.env.PORT ?? 5173),
};

export default defineConfig({
  base: basePath,
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist", "public"),
    emptyOutDir: true,
    sourcemap: false,
  },
  server,
  preview: {
    host: "0.0.0.0",
    allowedHosts: true as true,
  },
});