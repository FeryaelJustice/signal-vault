import "@testing-library/jest-dom";

// Polyfill Web Crypto for jsdom (Node 24 has it built-in but exposed under globalThis.crypto)
if (typeof globalThis.crypto === "undefined") {
  // Node crypto module
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require("crypto");
  Object.defineProperty(globalThis, "crypto", {
    value: nodeCrypto.webcrypto,
    writable: false,
  });
}
