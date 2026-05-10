import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cohort Analysis",
  description: "Razorpay subscription cohort dashboard with AI insights",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
