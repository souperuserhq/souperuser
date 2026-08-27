import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "souperuser — all the flavor. none of the root.",
  description:
    "Read-only GitHub access for AI assistants via MCP. Engineers share repos with one GitHub App; everyone else connects Claude or ChatGPT with one invite link. Open source, self-hostable.",
  icons: { icon: "/logo.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
