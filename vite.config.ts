import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    host: "myapp.local",
    https: {
      key: "./localhost+3-key.pem",
      cert: "./localhost+3.pem",
    },
  },
});
