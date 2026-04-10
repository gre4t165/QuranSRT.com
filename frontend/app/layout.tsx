import type { Metadata } from "next";
import { Amiri, DM_Sans } from "next/font/google";
import "./globals.css";

const amiri = Amiri({
  subsets: ["latin", "arabic"],
  weight: ["400", "700"],
  variable: "--font-amiri",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "QuranSRT — Generate Subtitle Al-Quran Langsung di Browser",
  description:
    "Platform web untuk generate file subtitle SRT Al-Quran beserta audio MP3. Zero install — cukup buka browser.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`${amiri.variable} ${dmSans.variable} font-body antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
