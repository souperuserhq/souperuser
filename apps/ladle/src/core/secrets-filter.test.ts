import { describe, expect, it } from "vitest";
import { filterTree, isPathAllowed } from "./secrets-filter.js";

describe("isPathAllowed", () => {
  it("blocks env files anywhere in the tree", () => {
    expect(isPathAllowed(".env")).toBe(false);
    expect(isPathAllowed(".env.local")).toBe(false);
    expect(isPathAllowed(".env.production")).toBe(false);
    expect(isPathAllowed("apps/api/.env")).toBe(false);
    expect(isPathAllowed("deep/nested/dir/.env.staging")).toBe(false);
  });

  it("allows env example/template files", () => {
    expect(isPathAllowed(".env.example")).toBe(true);
    expect(isPathAllowed(".env.sample")).toBe(true);
    expect(isPathAllowed("apps/api/.env.template")).toBe(true);
  });

  it("blocks private keys and certificates", () => {
    expect(isPathAllowed("certs/server.pem")).toBe(false);
    expect(isPathAllowed("signing.key")).toBe(false);
    expect(isPathAllowed("app.p12")).toBe(false);
    expect(isPathAllowed("release.keystore")).toBe(false);
  });

  it("blocks SSH keys", () => {
    expect(isPathAllowed("id_rsa")).toBe(false);
    expect(isPathAllowed("id_ed25519.pub")).toBe(false);
    expect(isPathAllowed(".ssh/config")).toBe(false);
    expect(isPathAllowed("home/.ssh/known_hosts")).toBe(false);
  });

  it("blocks credential stores", () => {
    expect(isPathAllowed(".npmrc")).toBe(false);
    expect(isPathAllowed(".netrc")).toBe(false);
    expect(isPathAllowed("config/credentials.json")).toBe(false);
    expect(isPathAllowed("secrets.yaml")).toBe(false);
    expect(isPathAllowed("gcp/service-account-prod.json")).toBe(false);
    expect(isPathAllowed(".aws/credentials")).toBe(false);
  });

  it("blocks terraform state", () => {
    expect(isPathAllowed("infra/terraform.tfstate")).toBe(false);
    expect(isPathAllowed("infra/terraform.tfstate.backup")).toBe(false);
    expect(isPathAllowed("prod.tfvars")).toBe(false);
  });

  it("allows normal source files", () => {
    expect(isPathAllowed("src/index.ts")).toBe(true);
    expect(isPathAllowed("README.md")).toBe(true);
    expect(isPathAllowed("package.json")).toBe(true);
    expect(isPathAllowed("src/environment.ts")).toBe(true);
    expect(isPathAllowed("docs/secrets-management.md")).toBe(true);
    expect(isPathAllowed("keyboard.tsx")).toBe(true);
    expect(isPathAllowed("monkey.ts")).toBe(true);
  });

  it("is not fooled by leading slashes", () => {
    expect(isPathAllowed("/.env")).toBe(false);
    expect(isPathAllowed("//id_rsa")).toBe(false);
  });
});

describe("filterTree", () => {
  it("removes blocked paths and keeps the rest in order", () => {
    const tree = ["README.md", ".env", "src/app.ts", "certs/tls.key", "docs/guide.md"];
    expect(filterTree(tree)).toEqual(["README.md", "src/app.ts", "docs/guide.md"]);
  });
});
