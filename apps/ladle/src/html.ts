/** Tiny server-rendered HTML helpers — no framework, auditable at a glance. */

export function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function page(title: string, body: string): Response {
  const fullTitle = title === "Souperuser" ? "souperuser — all the flavor. none of the root." : `${title} — souperuser`;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<link rel="icon" type="image/svg+xml" href="/logo.svg">
<style>
  /* Same design tokens as the marketing site (apps/web/app/globals.css). */
  :root { --ink: #111111; --muted: #888888; --line: #e2e2e2; --bg: #ffffff; --accent: #e0402e; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink);
         font: 14px/1.75 ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
  main { max-width: 660px; margin: 0 auto; padding: 2.5rem 1.25rem 5rem; }
  h1 { font-size: 16px; margin: 0 0 1.25rem; }
  h1 span { color: var(--accent); }
  h2 { font-size: 14px; margin: 2.5rem 0 1rem; }
  h3 { font-size: 14px; margin: 0 0 0.75rem; }
  a { color: inherit; text-decoration: underline; text-underline-offset: 3px;
      text-decoration-color: var(--muted); }
  a:hover { color: var(--accent); text-decoration-color: var(--accent); }
  code, pre { font-family: inherit; background: #f6f6f6;
              border: 1px solid var(--line); border-radius: 4px; padding: 0.1em 0.35em; }
  pre { padding: 1rem; overflow-x: auto; }
  .card { border: 1px solid var(--line); border-radius: 8px;
          padding: 1.25rem 1.5rem; margin: 1.5rem 0; }
  .btn { display: inline-block; background: var(--ink); color: #fff; border: 0;
         padding: 0.5rem 1.1rem; border-radius: 4px; font: inherit;
         text-decoration: none; cursor: pointer; }
  .btn:hover { background: var(--accent); color: #fff; }
  .muted { color: var(--muted); font-size: 13px; }
  .logo { display: flex; align-items: center; gap: 0.75rem; margin: 0 0 2.5rem; font-weight: 700; }
  .logo img { width: 74px; height: 74px; display: block; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td, th { text-align: left; padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--line); }
  th { color: var(--muted); font-weight: 400; }
  label { display: block; margin: 0.75rem 0 0.25rem; font-weight: 700; }
  input[type=text] { width: 100%; padding: 0.5rem; border: 1px solid var(--line);
                     border-radius: 4px; font: inherit; background: var(--bg); color: var(--ink); }
</style>
</head>
<body><main>${body}</main></body>
</html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
