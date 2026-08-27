/**
 * The Ladle: the MCP server that serves answers out of the pot.
 * One fresh McpServer per request, scoped to a single Taster's Menu.
 */
import { McpServer } from "@modelcontextprotocol/server";
import { filterTree, isPathAllowed, MAX_FILE_BYTES } from "./core/index.js";
import * as z from "zod";
import { logKitchen } from "./db.js";
import type { Env, TasterProps } from "./env.js";
import {
  decodeBase64Content,
  getContents,
  getInstallationToken,
  getReadme,
  getRepo,
  getTreePaths,
  NotFoundError,
  searchCode,
} from "./github.js";

export interface TasterAccess {
  props: TasterProps;
  repoFullNames: string[];
}

const MAX_TREE_PATHS = 500;

function text(value: string) {
  return { content: [{ type: "text" as const, text: value }] };
}

function toolError(value: string) {
  return { content: [{ type: "text" as const, text: value }], isError: true };
}

export function buildServer(env: Env, access: TasterAccess, waitUntil: (p: Promise<unknown>) => void): McpServer {
  const server = new McpServer({ name: "souperuser", version: "0.1.0" });
  const { props, repoFullNames } = access;
  const menuSet = new Set(repoFullNames);

  const log = (tool: string, repo?: string, detail?: string) => {
    waitUntil(
      logKitchen(env, { tasterId: props.tasterId, installationId: props.installationId, tool, repo, detail }).catch(
        () => undefined,
      ),
    );
  };

  const requireRepo = (repo: string): string | null => (menuSet.has(repo) ? null : notOnMenu(repo));
  const notOnMenu = (repo: string) =>
    `"${repo}" is not on this user's menu. Available repos: ${repoFullNames.join(", ") || "(none)"}. Use list_pots to see what you can access.`;

  const token = () => getInstallationToken(env, props.installationId);

  server.registerTool(
    "list_pots",
    {
      description:
        "List the repositories this user is allowed to read. Always call this first to learn which repos are available before using other tools.",
    },
    async () => {
      log("list_pots");
      if (repoFullNames.length === 0) {
        return text("No repositories are currently on this user's menu. Ask the engineer who invited you to add repos.");
      }
      return text(`Repositories on the menu (read-only):\n${repoFullNames.map((r) => `- ${r}`).join("\n")}`);
    },
  );

  server.registerTool(
    "repo_overview",
    {
      description:
        "Get an orientation for one repository: description, primary language, README, and the file tree. Use this to understand a codebase's structure before searching or reading files.",
      inputSchema: z.object({
        repo: z.string().describe('Full repository name, e.g. "acme/webshop". Must be on the menu (see list_pots).'),
      }),
    },
    async ({ repo }) => {
      const denied = requireRepo(repo);
      if (denied) return toolError(denied);
      log("repo_overview", repo);
      try {
        const t = await token();
        const info = await getRepo(t, repo);
        const [readme, tree] = await Promise.all([getReadme(t, repo), getTreePaths(t, repo, info.default_branch)]);
        const paths = filterTree(tree.paths);
        const shownPaths = paths.slice(0, MAX_TREE_PATHS);
        const sections = [
          `# ${info.full_name}`,
          info.description ? `Description: ${info.description}` : null,
          `Primary language: ${info.language ?? "unknown"} | Default branch: ${info.default_branch} | Last updated: ${info.updated_at}`,
          `## File tree (${paths.length} files${paths.length > shownPaths.length || tree.truncated ? ", truncated" : ""})`,
          shownPaths.join("\n"),
          readme ? `## README\n${readme.slice(0, 20_000)}` : "(no README found)",
        ];
        return text(sections.filter(Boolean).join("\n\n"));
      } catch (err) {
        if (err instanceof NotFoundError) return toolError(`Repository "${repo}" was not found on GitHub.`);
        throw err;
      }
    },
  );

  server.registerTool(
    "search_code",
    {
      description:
        "Search for code inside one repository (GitHub code search syntax). Returns matching file paths with text fragments. Good for questions like 'where is the discount logic?'.",
      inputSchema: z.object({
        repo: z.string().describe('Full repository name, e.g. "acme/webshop".'),
        query: z.string().min(2).describe("Search terms, e.g. 'calculateDiscount' or 'stripe checkout'."),
      }),
    },
    async ({ repo, query }) => {
      const denied = requireRepo(repo);
      if (denied) return toolError(denied);
      log("search_code", repo, query);
      const matches = (await searchCode(await token(), repo, query)).filter((m) => isPathAllowed(m.path));
      if (matches.length === 0) {
        return text(`No matches for "${query}" in ${repo}. Try broader terms, or use repo_overview to browse the file tree.`);
      }
      const body = matches
        .map((m) => `### ${m.path}\n${m.fragments.map((f) => "```\n" + f + "\n```").join("\n") || "(match in file)"}`)
        .join("\n\n");
      return text(`Matches for "${query}" in ${repo}:\n\n${body}\n\nUse read_file to see the full contents of any of these files.`);
    },
  );

  server.registerTool(
    "read_file",
    {
      description:
        "Read one file (or list one directory) from a repository. Returns the raw file contents. Sensitive files (keys, .env, credentials) are never served.",
      inputSchema: z.object({
        repo: z.string().describe('Full repository name, e.g. "acme/webshop".'),
        path: z.string().describe('File or directory path inside the repo, e.g. "src/checkout/discount.ts" or "src".'),
      }),
    },
    async ({ repo, path }) => {
      const denied = requireRepo(repo);
      if (denied) return toolError(denied);
      if (!isPathAllowed(path)) {
        log("read_file:blocked", repo, path);
        return toolError(`"${path}" matches Souperuser's sensitive-file policy and will not be served.`);
      }
      log("read_file", repo, path);
      try {
        const result = await getContents(await token(), repo, path);
        if (Array.isArray(result)) {
          const entries = result
            .filter((e) => isPathAllowed(e.path))
            .map((e) => `${e.type === "dir" ? "dir " : "file"}  ${e.path}`)
            .join("\n");
          return text(`Directory listing for ${repo}/${path}:\n${entries}`);
        }
        const contents = decodeBase64Content(result.content);
        const truncated = contents.length > MAX_FILE_BYTES;
        const body = truncated ? contents.slice(0, MAX_FILE_BYTES) : contents;
        return text(`// ${repo}/${result.path}${truncated ? " (truncated)" : ""}\n${body}`);
      } catch (err) {
        if (err instanceof NotFoundError) return toolError(`"${path}" was not found in ${repo}.`);
        throw err;
      }
    },
  );

  return server;
}
