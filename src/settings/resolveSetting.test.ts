import { describe, expect, it } from "vitest";
import { resolveSetting } from "./resolveSetting";

describe("resolveSetting", () => {
  it("uses the default when nothing is saved", () => {
    expect(resolveSetting(undefined, undefined, true)).toBe(true);
    expect(resolveSetting(undefined, undefined, false)).toBe(false);
  });

  it("uses this browser's setting when the account has none", () => {
    expect(resolveSetting(undefined, false, true)).toBe(false);
    expect(resolveSetting(undefined, true, false)).toBe(true);
  });

  it("prefers the account's setting over this browser's", () => {
    expect(resolveSetting(true, false, false)).toBe(true);
    expect(resolveSetting(false, true, true)).toBe(false);
  });
});
