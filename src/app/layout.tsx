import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { TOOLS } from "@/lib/pdf-tools/registry";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Small Editor — Free online PDF tools",
  description:
    "44 free PDF tools: merge, split, compress, convert, sign, watermark, OCR and more. Files are deleted automatically after 2 hours.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <div className="flex min-h-screen flex-col bg-background">
          {children}
          <footer className="mt-auto border-t">
            <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-1 px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-sm text-muted-foreground sm:flex-row">
              <p>Files are processed locally and deleted automatically after 2 hours.</p>
              <p>{TOOLS.length} tools</p>
            </div>
          </footer>
          <Toaster />
        </div>
      </body>
    </html>
  );
}
