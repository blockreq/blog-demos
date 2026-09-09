import { AnoncoinDemo } from "@/components/anoncoin-demo";
import { DemoCta } from "@/components/demo-cta";

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-36 pt-6">
      <AnoncoinDemo />
      <DemoCta title="Anoncoin · RH anon launch listen" />
    </main>
  );
}
