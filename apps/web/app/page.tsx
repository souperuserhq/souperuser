const GITHUB_URL = "https://github.com/souperuserhq/souperuser";
const LADLE_URL = "https://mcp.souperuser.com";

export default function Home() {
  return (
    <main>
      <header>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="souperuser" />
        <nav>
          <a href={GITHUB_URL}>source</a>
          <a href={`${GITHUB_URL}/blob/main/SECURITY.md`}>security</a>
          <a href={`${LADLE_URL}/dash`}>dashboard</a>
        </nav>
      </header>

      <p className="intro">
        souperuser gives your teammates&apos; AI read-only access to your repos — no GitHub account needed.
      </p>

      <div className="term">
        <div className="term-bar">
          <div className="dots">
            <span />
            <span />
            <span />
          </div>
          <div className="title">claude</div>
        </div>
        <div className="term-body">
          <span className="status">● connected: souperuser (read-only)</span>
          {"\n\n"}
          <span className="you">| where does the 10% discount come from?</span>
          {"\n\n"}
          {"  src/checkout/discount.ts — orders over €100.\n\n"}
          <span className="you">| </span>
          <span className="cursor" />
        </div>
      </div>

      <p>
        You install a read-only GitHub App and pick which repos to share. Your PM gets an invite link, connects Claude
        or ChatGPT, and asks the code directly — instead of asking you.
      </p>

      <p>
        Deliberately boring: one Cloudflare Worker, nothing stored, live GitHub proxy, a secrets filter, an audit log.
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
        <li>You see every read in the kitchen log. Revoke anytime, one click.</li>
      </ol>

      <p className="sep">* * *</p>

      <h2>why you can say yes</h2>
      <ul>
        <li>read-only by construction — GitHub enforces the boundary, not our code.</li>
        <li>nothing stored — files are fetched live. no index, no embeddings, no copies.</li>
        <li>
          secrets never served — <a href={`${GITHUB_URL}/blob/main/packages/core/src/secrets-filter.ts`}>the filter</a>{" "}
          is one screen of tested regexes.
        </li>
        <li>per-person menus — every call re-checks what that person may see.</li>
        <li>open source (MIT) — audit it, or self-host it in ~15 minutes so your code never touches our infra.</li>
      </ul>

      <p className="sep">* * *</p>

      <h2>vocabulary</h2>
      <p className="muted">
        Cooks (engineers) share pots (repos) via menus with tasters (read-only users). The ladle (MCP server) serves.
        Everything is written to the kitchen log.
      </p>

      <footer>
        <a href={GITHUB_URL}>github</a> · <a href={`${GITHUB_URL}/blob/main/SECURITY.md`}>security</a> ·{" "}
        <a href={`${GITHUB_URL}#self-hosting-15-minutes`}>self-host</a> · MIT
      </footer>
    </main>
  );
}
