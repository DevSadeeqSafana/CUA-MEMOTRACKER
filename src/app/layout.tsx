import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IMTS - Cosmopolitan University Abuja",
  description: "Internal Memo Tracker System for Cosmopolitan University Abuja.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${outfit.variable} font-sans antialiased`}
      >
        <Toaster position="top-right" toastOptions={{ duration: 4000, style: { borderRadius: '1rem', background: '#fff', color: '#1a365d', fontWeight: 'bold' } }} />
        {children}
      </body>
    </html>
  );
}
