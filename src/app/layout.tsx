import type { Metadata } from "next";
import { Instrument_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

// The two faces app.neatlogs.com serves: Instrument Sans for UI text,
// Geist Mono for timestamps and every numeric column.
const instrumentSans = Instrument_Sans({
    variable: "--font-instrument-sans",
    subsets: ["latin"],
    display: "swap",
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
    display: "swap",
});

export const metadata: Metadata = {
    title: "Traces",
    description: "Live trace viewer — virtualised and unoptimised builds",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
    return (
        <html lang="en" className={`${instrumentSans.variable} ${geistMono.variable} h-full antialiased`}>
            <body className="h-full">{children}</body>
        </html>
    );
}
