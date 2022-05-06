import adapter from "@sveltejs/adapter-static";
import preprocess from "svelte-preprocess";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: preprocess(),

  kit: {
    adapter: adapter(),
    prerender: { default: true },
    paths: {
      base: process.env.APP_BASE || "",
    },
  },
};

export default config;
