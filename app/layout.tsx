import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FileForge – All-in-One File Converter & Compressor",
  description:
    "Convert images to PDF, extract PDF pages as images, and compress images – all client-side in your browser. No uploads, no servers, 100% private.",
  keywords: ["file converter", "image to pdf", "pdf to image", "image compressor", "browser tool"],
  openGraph: {
    title: "FileForge – All-in-One File Converter & Compressor",
    description:
      "Convert images to PDF, extract PDF pages as images, and compress images – all client-side in your browser.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
