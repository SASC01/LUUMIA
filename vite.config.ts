import { defineConfig } from "vite";

const proxy = {
  "/api": {
    target: process.env.LUUMIA_API_URL ?? "http://127.0.0.1:8042",
    rewrite: (path: string) => path.replace(/^\/api/, ""),
  },
};

export default defineConfig({
  root: "frontend",
  server: { port: 5174, strictPort: true, proxy },
  preview: { port: 4174, strictPort: true, proxy },
});
