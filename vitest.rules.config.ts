import { defineConfig } from "vitest/config";

// Security-rules tests only; run inside the Firestore emulator by `npm run test:rules`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["firestore.rules.test.ts"],
  },
});
