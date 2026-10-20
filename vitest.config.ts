import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Needs the Firestore emulator (Java); run with `npm run test:rules` instead.
    exclude: ["**/node_modules/**", "firestore.rules.test.ts"],
  },
});
