import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import Script from "next/script";
import { Providers } from "@/components/layout/providers";
import { siteUrl } from "@/lib/utils";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#05130b",
};
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
    default: "Achu Designer Boutique | Buy Sarees, Kurtis & Designer Ethnic Wear Online",
    template: "%s | Achu Designer Boutique",
  },
  description:
    "Explore Achu Designer Boutique for luxury Indian wear. Shop handpicked designer sarees, stylish kurtis, bridal attire, and custom ethnic ensembles. Quick WhatsApp enquiry.",
  keywords: [
    "Achu Boutique",
    "Achu Designer Boutique",
    "Achu boutique online",
    "Achu sarees",
    "Achu designer wear",
    "Buy sarees online",
    "Designer sarees online",
    "Kurtis and ethnic wear",
    "Indian ethnic wear boutique",
    "Bridal sarees Erode",
    "Designer blouses Thindal",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "Achu Designer Boutique",
    locale: "en_IN",
    title: "Achu Designer Boutique | Buy Sarees, Kurtis & Designer Ethnic Wear Online",
    description:
      "Explore Achu Designer Boutique for luxury Indian wear. Handcrafted sarees, designer kurtis, bridal ensembles, and customized stitching.",
    images: [
      {
        url: "/brand/achu-designer-boutique-logo.png",
        width: 1209,
        height: 1287,
        alt: "Achu Designer Boutique official logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Achu Designer Boutique | Buy Sarees, Kurtis & Designer Ethnic Wear Online",
    description:
      "Luxury Indian ethnic wear, handpicked designer sarees, festive kurtis, and bridal collections at Achu Designer Boutique.",
    images: ["/brand/achu-designer-boutique-logo.png"],
  },
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
