// Type shim for edge-function-side globals used by files under src/lib/mcp/.
// These modules are bundled into a Deno function by the mcp-js Vite plugin.
declare const process: { env: Record<string, string | undefined> };
