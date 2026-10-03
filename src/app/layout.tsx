import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import Script from "next/script";
import { Providers } from "@/components/layout/providers";
import { siteUrl } from "@/lib/utils";
import "./globals.css";
const heading = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-heading",
  display: "swap",
});
const body = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Achu Designer Boutique | Elegance in every detail",
    template: "%s | Achu Designer Boutique",
  },
  description:
    "Explore the Achu Designer Boutique collection of Indian wear. Browse pieces, choose your size, and enquire through WhatsApp.",
  openGraph: {
    type: "website",
    siteName: "Achu Designer Boutique",
    images: [
      {
        url: "/brand/achu-designer-boutique-logo.png",
        width: 1209,
        height: 1287,
      },
    ],
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/brand/achu-designer-boutique-logo.png" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ga = process.env.NEXT_PUBLIC_GA_ID;
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${heading.variable} ${body.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
        {ga && /^G-[A-Z0-9]+$/.test(ga) && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${ga}`}
              strategy="afterInteractive"
            />
            <Script
              id="google-analytics"
              strategy="afterInteractive"
            >{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga}');`}</Script>
          </>
        )}
      </body>
    </html>
  );
}
