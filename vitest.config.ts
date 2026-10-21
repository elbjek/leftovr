import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "expo-localization": resolve(__dirname, "src/test-stubs/expo-localization.ts"),
      "@react-native-async-storage/async-storage": resolve(
        __dirname,
        "src/test-stubs/async-storage.ts",
      ),
    },
  },
  test: {
    environment: "node",
    // Edge-function tests run under Deno (`deno test supabase/functions/...`); they
    // use Deno.test + https std imports that vitest's node loader can't resolve.
    // Exception: cache-merge is pure TS with a vitest suite, so it runs here.
    include: ["src/**/*.test.ts", "supabase/functions/normalize-receipt/cache-merge.test.ts"],
    globals: true,
  },
  define: {
    __DEV__: false,
  },
});
