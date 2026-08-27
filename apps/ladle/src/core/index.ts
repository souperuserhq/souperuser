export { isPathAllowed, filterTree, MAX_FILE_BYTES, BLOCKED_PATH_PATTERNS } from "./secrets-filter.js";

/** A GitHub App installation — one per org/user that installed Souperuser. */
export interface Installation {
  id: number;
  accountLogin: string;
  accountType: "Organization" | "User";
}

/** A connected repo ("Pot") within an installation. */
export interface Pot {
  repoId: number;
  installationId: number;
  fullName: string; // "owner/name"
  private: boolean;
}

/** A Menu: the subset of an installation's repos a Taster may access. */
export interface Menu {
  id: string;
  installationId: number;
  name: string;
  repoFullNames: string[];
}

/** A Taster: a read-only user bound to exactly one Menu. */
export interface Taster {
  id: string;
  installationId: number;
  menuId: string;
  label: string;
  revokedAt: string | null;
}

export interface KitchenLogEntry {
  tasterId: string;
  installationId: number;
  tool: string;
  repo: string | null;
  detail: string | null;
}
