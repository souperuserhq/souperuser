import { ClaudeMark, GitHubMark, McpMark, OpenAIMark } from "./logos";
import { NavAuth } from "./nav-auth";

const GITHUB_URL = "https://github.com/souperuserhq/souperuser";
const LADLE_URL = "https://mcp.souperuser.com";

export default function Home() {
  return (
    <main>
      <header>
        <span className="wordmark">souperuser</span>
        <nav>
          <a href={GITHUB_URL}>source</a>
          <a href={`${GITHUB_URL}/blob/main/SECURITY.md`}>security</a>
          <NavAuth ladleUrl={LADLE_URL} />
        </nav>
      </header>

      <h1 className="intro">
        souperuser gives your teammates&apos; AI read-only access to your repos — no GitHub account needed.
      </h1>

      <figure
        className="flow"
        role="img"
        aria-label="Your GitHub repos, read-only through souperuser — hosted or on your server — to your teammates' AI: Claude or ChatGPT. No GitHub account needed."
      >
        <div className="flow-inner" aria-hidden="true">
          <div className="flow-node">
            <div className="flow-box flow-box-stack">
              <GitHubMark />
            </div>
            <span className="flow-labels">
              <span className="flow-label flow-label-title">your repos</span>
              <span className="flow-label">you pick which</span>
              <span className="flow-label">revoke anytime</span>
            </span>
          </div>

          <div className="flow-arrow">
            <span className="flow-arrow-label">read-only</span>
            <span className="flow-line" />
          </div>

          <div className="flow-node">
            <div className="flow-box">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="" />
            </div>
            <span className="flow-labels">
              <span className="flow-label flow-label-title flow-label-icon">
                <McpMark /> souperuser mcp
              </span>
              <span className="flow-label">hosted or</span>
              <span className="flow-label">your server</span>
            </span>
          </div>

          <div className="flow-arrow">
            <span className="flow-arrow-label">invite link</span>
            <span className="flow-line" />
          </div>

          <div className="flow-node">
            <div className="flow-box">
              <div className="flow-clients">
                <span className="flow-client">
                  <ClaudeMark /> claude
                </span>
                <span className="flow-client">
                  <OpenAIMark /> chatgpt
                </span>
              </div>
            </div>
            <span className="flow-labels">
              <span className="flow-label flow-label-title">their AI</span>
              <span className="flow-label flow-label-ok">no github account</span>
              <span className="flow-label flow-label-ok">needed</span>
            </span>
          </div>
        </div>
      </figure>

      <p>
        You install a read-only GitHub App and pick which repos to share. Your PM gets an invite link, connects Claude,
        ChatGPT, or any AI that speaks{" "}
        <span
          className="tip"
          tabIndex={0}
          data-tip="Model Context Protocol — the open standard for connecting AI assistants to tools and data."
        >
          MCP
        </span>
        , and asks the code directly — instead of asking you.
      </p>

      <p>
        Deliberately boring: one Cloudflare Worker, nothing stored, live GitHub proxy, a{" "}
        <span
          className="tip"
          tabIndex={0}
          data-tip="One screen of tested regexes strips .env files, keys, and certs before the AI sees a byte."
        >
          secrets filter
        </span>
        , an{" "}
        <span className="tip" tabIndex={0} data-tip="Every read is logged — who, what, when. Revoke anytime, one click.">
          audit log
        </span>
        .
      </p>

      <p className="sep">* * *</p>

      <h2>how it works</h2>
      <ol>
        <li>
          You install the <a href="https://github.com/apps/souperuser-mcp">GitHub App</a> and pick repos. It can only
          read — <code>contents: read</code>, <code>metadata: read</code>.
        </li>
        <li>You send your teammate an invite link with the repos they may see.</li>
        <li>They paste one URL into their AI. That&apos;s it.</li>
        <li>You see every read in the audit log. Revoke anytime, one click.</li>
      </ol>

      <p className="sep">* * *</p>

      <h2>why you can say yes</h2>
      <ul>
        <li>read-only by construction — GitHub enforces the boundary, not our code.</li>
        <li>nothing stored — files are fetched live. no index, no embeddings, no copies.</li>
        <li>
          secrets never served — <a href={`${GITHUB_URL}/blob/main/apps/ladle/src/core/secrets-filter.ts`}>the filter</a>{" "}
          is one screen of tested regexes.
        </li>
        <li>per-person menus — every call re-checks what that person may see.</li>
        <li>open source (MIT) — audit it, or one-click deploy your own so your code never touches our infra.</li>
      </ul>

      <footer>
        <a href={GITHUB_URL}>github</a> · <a href={`${GITHUB_URL}/blob/main/SECURITY.md`}>security</a> ·{" "}
        <a href={`${GITHUB_URL}#self-hosting`}>self-host</a> · MIT
      </footer>
    </main>
  );
}
