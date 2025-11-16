import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Change Management Dashboard",
  description: "ICGRIS-style change management tracking dashboard"
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
