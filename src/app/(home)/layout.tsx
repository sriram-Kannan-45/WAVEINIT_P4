import Storefront from "@/components/layout/storefront";
import { IntroExperience } from "@/components/intro/IntroExperience";
import frames from "../../../public/intro/frames.json";

export const dynamic = "force-dynamic";

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="home-experience">
      <IntroExperience frames={frames} />
      <div id="boutique" className="intro-store" tabIndex={-1}>
        <Storefront>{children}</Storefront>
      </div>
    </div>
  );
}
