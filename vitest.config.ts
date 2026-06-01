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
    include: ["src/**/*.test.ts"],
    globals: true,
  },
  define: {
    __DEV__: false,
  },
});
