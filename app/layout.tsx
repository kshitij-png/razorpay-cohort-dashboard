import type { Metadata } from "next";
import "./globals.css";
import { APP_TITLE } from "@/lib/config";

export const metadata: Metadata = {
  title: APP_TITLE,
  description: "Subscription cohort analysis powered by Rudra AI — understand your trialists, acquisitions and renewals with Hindu calendar context.",
  openGraph: {
    title: APP_TITLE,
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
