import { notFound } from "next/navigation";
import { getPolicy } from "@/lib/data";
const titles: Record<string, string> = {
  "shipping-policy": "Shipping policy",
  "return-exchange": "Returns & exchanges",
  "privacy-policy": "Privacy policy",
  terms: "Terms & conditions",
};
export async function generateMetadata({
  params,
}: {
  params: Promise<{ policy: string }>;
}) {
  const { policy } = await params;
  return {
    title: titles[policy] || "Page unavailable",
    alternates: { canonical: `/${policy}` },
  };
}
export default async function PolicyPage({
  params,
}: {
  params: Promise<{ policy: string }>;
}) {
  const { policy } = await params;
  if (!titles[policy]) notFound();
  const p = await getPolicy(policy);
  return (
    <>
      <div className="page-heading">
        <div className="container">
          <p className="eyebrow">HERE TO HELP</p>
          <h1>{p?.title || titles[policy]}</h1>
        </div>
      </div>
      <div className="container">
        <div className="policy-content">
          {p?.content ||
            "This policy has not yet been published. The boutique owner must provide and publish the applicable policy before launch. Please contact the boutique for details."}
        </div>
      </div>
    </>
  );
}
