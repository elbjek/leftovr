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
    // Exceptions: cache-merge and _shared/avoidances are pure TS with vitest
    // suites, so they run here.
    include: [
      "src/**/*.test.ts",
      "supabase/functions/normalize-receipt/cache-merge.test.ts",
      "supabase/functions/_shared/avoidances.test.ts",
    ],
    globals: true,
  },
  define: {
    __DEV__: false,
  },
});
