import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Track My Spend",
  description: "App personal para controlar ingresos, egresos y presupuesto mensual.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Track My Spend",
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  themeColor: "#2f7d5c",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
