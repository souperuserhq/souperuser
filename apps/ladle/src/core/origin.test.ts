import { describe, expect, it } from "vitest";
import { originAllowed } from "./origin.js";

const WORKER = "mcp.souperuser.com";
const PUBLIC = "mcp.souperuser.com";

describe("originAllowed", () => {
  it("always allows the worker's own origin and localhost", () => {
    expect(originAllowed("mcp.souperuser.com", WORKER, null)).toBe(true);
    expect(originAllowed("localhost", WORKER, null)).toBe(true);
    expect(originAllowed("127.0.0.1", WORKER, null)).toBe(true);
  });

  it("allows the public host's parent domain and its subdomains", () => {
    expect(originAllowed("souperuser.com", WORKER, PUBLIC)).toBe(true);
    expect(originAllowed("www.souperuser.com", WORKER, PUBLIC)).toBe(true);
  });

  it("rejects unrelated and lookalike origins", () => {
    expect(originAllowed("evil.com", WORKER, PUBLIC)).toBe(false);
    expect(originAllowed("evilsouperuser.com", WORKER, PUBLIC)).toBe(false);
    expect(originAllowed("souperuser.com.evil.com", WORKER, PUBLIC)).toBe(false);
  });

  it("never widens trust on the default workers.dev self-host (no PUBLIC_URL)", () => {
    const host = "souperuser-ladle.someone.workers.dev";
    expect(originAllowed(host, host, null)).toBe(true);
    expect(originAllowed("attacker.someone.workers.dev", host, null)).toBe(false);
    expect(originAllowed("other.workers.dev", host, null)).toBe(false);
  });

  it("keeps trust inside one account when PUBLIC_URL is a workers.dev host", () => {
    const wd = "ladle.someone.workers.dev";
    expect(originAllowed("app.someone.workers.dev", wd, wd)).toBe(true);
    expect(originAllowed("evil.other.workers.dev", wd, wd)).toBe(false);
    expect(originAllowed("workers.dev", wd, wd)).toBe(false);
  });

  it("treats public suffixes and bare TLD parents as untrusted", () => {
    expect(originAllowed("evil.workers.dev", "someone.workers.dev", "someone.workers.dev")).toBe(false);
    expect(originAllowed("other.com", "example.com", "example.com")).toBe(false);
    expect(originAllowed("www.example.com", "example.com", "example.com")).toBe(false);
  });
});
