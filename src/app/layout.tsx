import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "BeautyPass", template: "%s · BeautyPass" },
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='9' fill='%233a1828'/%3E%3Cpath d='M16 5C16.7 12.3 19.7 15.3 27 16C19.7 16.7 16.7 19.7 16 27C15.3 19.7 12.3 16.7 5 16C12.3 15.3 15.3 12.3 16 5Z' fill='%23e3c79f'/%3E%3C/svg%3E",
  },
  robots: { index: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;1,6..96,400&family=Manrope:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
