import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { SSEProvider } from "@/lib/sse-context";
import { I18nProvider } from "@/lib/i18n";
import { PWARegister } from "@/components/pwa-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MejoraWS — Dashboard",
  description: "CRM WhatsApp Autónomo con IA — Dashboard",
  manifest: "/manifest.json",
  themeColor: "#18181b",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PWARegister />
        <I18nProvider>
          <AuthProvider>
            <SSEProvider>{children}</SSEProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
