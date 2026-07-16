import type { Metadata } from "next";
import { IBM_Plex_Serif, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const ibmPlexSerif = IBM_Plex_Serif({
  variable: "--font-plex-serif",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://bichongos.store"),
  title: "Bichongos · Hongos premium cultivados con precisión IoT",
  description:
    "Hongos premium cultivados con precisión IoT, trazables del sustrato al plato. Laboratorio de cultivo en Guarne, Antioquia.",
  openGraph: {
    title: "Bichongos",
    description:
      "Hongos premium cultivados con precisión IoT, trazables del sustrato al plato.",
    locale: "es_CO",
    type: "website",
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
      className={`${ibmPlexSerif.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-serif bg-crema text-tinta">
        {children}
      </body>
    </html>
  );
}
