import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  root: import.meta.dirname,
  css: {
    postcss: false,
  },
});
