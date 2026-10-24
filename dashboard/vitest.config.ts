import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // next-auth's ESM build imports "next/server" without an extension, which
    // Node's resolver rejects; letting Vite transform it resolves the import.
    server: { deps: { inline: ["next-auth"] } },
  },
});
