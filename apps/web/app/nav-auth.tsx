"use client";

import { useEffect, useState } from "react";

/**
 * Renders "sign in" by default and swaps to "dashboard" + @login when the
 * Worker confirms a session. Site and Worker are sibling hostnames of the same
 * registrable domain, so the session cookie rides along on the fetch.
 */
export function NavAuth({ ladleUrl }: { ladleUrl: string }) {
  const [login, setLogin] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${ladleUrl}/dash/whoami`, { credentials: "include" })
      .then((res) => (res.ok ? (res.json() as Promise<{ login?: string }>) : null))
      .then((data) => {
        if (!cancelled && data?.login) setLogin(data.login);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ladleUrl]);

  if (!login) {
    return (
      <a className="nav-signin" href={`${ladleUrl}/dash`}>
        sign in
      </a>
    );
  }
  return (
    <span className="nav-auth">
      <a className="nav-signin" href={`${ladleUrl}/dash`}>
        dashboard
      </a>
      <span className="nav-login">@{login}</span>
    </span>
  );
}
