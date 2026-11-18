import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

// Metadados conforme docs/seo/SEO_SPEC.md (theme-color = fundo do ambiente de trabalho).
export const metadata: Metadata = {
  title: "Agent OS — painel ao vivo da equipa de agentes",
  description: "Painel local, só de leitura, para acompanhar ao vivo o que os agentes do Claude Code estão a fazer.",
  robots: { index: false, follow: false, noarchive: true },
  icons: { icon: { url: "/favicon.svg", type: "image/svg+xml" } },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0c0e11",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT" className={`${inter.variable} ${jetbrains.variable}`}>
      <body>
        <a href="#main" className="sr-only-focusable">
          Saltar para o conteúdo
        </a>
        <h1 className="sr-only">Agent OS</h1>
        {children}
      </body>
    </html>
  );
}
