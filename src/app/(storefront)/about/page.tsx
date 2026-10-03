import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getStore } from "@/lib/data";
export const metadata = {
  title: "Our story",
  alternates: { canonical: "/about" },
};
export default async function About() {
  const store = await getStore();
  return (
    <>
      <div className="page-heading">
        <div className="container">
          <p className="eyebrow">THE STORY BEHIND THE EDIT</p>
          <h1>Beautifully, Achu.</h1>
          <p>A celebration of Indian wear and individual expression.</p>
        </div>
      </div>
      <div className="container about-grid">
        <div className="about-art">
          <Image
            src="/brand/achu-designer-boutique-logo.png"
            style={{ height: "auto" }}
            alt="Achu Designer Boutique official peacock logo"
            width={600}
            height={639}
          />
        </div>
        <div className="about-copy">
          <p className="eyebrow">OUR BOUTIQUE</p>
          <h2>{store.about_heading}</h2>
          <p>
            {store.about_story ||
              "Our boutique story will be shared here soon."}
          </p>
          <h3>Our collection philosophy</h3>
          <p>
            {store.about_philosophy ||
              "Our collection philosophy will be shared here soon."}
          </p>
          <Link className="button" href="/contact">
            Visit our store <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </>
  );
}
