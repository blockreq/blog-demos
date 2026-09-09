import { OpenLaunchDemo } from "@/components/openlaunch-demo";
import { DemoCta } from "@/components/demo-cta";

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-36 pt-6">
      <OpenLaunchDemo />
      <DemoCta title="OpenLaunch · Base one-tx launch listen" />
    </main>
  );
}
