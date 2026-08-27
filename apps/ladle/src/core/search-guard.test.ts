import { describe, expect, it } from "vitest";
import { hasScopeQualifier } from "./search-guard.js";

describe("hasScopeQualifier", () => {
  it("rejects scope-widening qualifiers anywhere in the query", () => {
    expect(hasScopeQualifier("repo:acme/other secret")).toBe(true);
    expect(hasScopeQualifier("password OR repo:acme/other")).toBe(true);
    expect(hasScopeQualifier("org:acme token")).toBe(true);
    expect(hasScopeQualifier("user:someone key")).toBe(true);
    expect(hasScopeQualifier("foo -repo:acme/other")).toBe(true);
    expect(hasScopeQualifier("(repo:acme/other)")).toBe(true);
    expect(hasScopeQualifier("REPO:acme/other")).toBe(true);
  });

  it("allows ordinary search terms", () => {
    expect(hasScopeQualifier("calculateDiscount")).toBe(false);
    expect(hasScopeQualifier("stripe checkout")).toBe(false);
    expect(hasScopeQualifier("path:src language:ts useEffect")).toBe(false);
    expect(hasScopeQualifier("monorepo: how it works")).toBe(false);
    expect(hasScopeQualifier("userspace: notes")).toBe(false);
    expect(hasScopeQualifier("reorg: cleanup plan")).toBe(false);
  });
});
