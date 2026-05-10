import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cohort Analysis Copilot v1.1",
  description: "Subscription cohort analysis powered by Rudra AI — understand your trialists, acquisitions and renewals with Hindu calendar context.",
  openGraph: {
    title: "Cohort Analysis Copilot v1.1",
    description: "Subscription cohort analysis powered by Rudra AI",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
