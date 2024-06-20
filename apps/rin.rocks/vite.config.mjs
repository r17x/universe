import { defineConfig } from "vite";
import melangePlugin from "vite-plugin-melange";

import { tamaguiExtractPlugin, tamaguiPlugin } from '@tamagui/vite-plugin'
import { tamaguiConfig } from "./tamagui.config";
import react from "@vitejs/plugin-react-swc";


/** @type {import('vite').UserConfig} */
export default defineConfig({
  build: {
    outDir: "./dist",
  },
  plugins: [
    react(),

    tamaguiPlugin({
      config: './tamagui.config.ts',
      components: ['tamagui'],
    }),

    process.env.NODE_ENV === 'production'
      ? tamaguiExtractPlugin(tamaguiConfig.themeConfig)
      : null,

    melangePlugin({
      buildCommand: "dune build @melange",
      watchCommand: "dune build @melange --watch",
    }),

  ].filter(Boolean)
});
