import { ContentPage } from "@/components/ContentPage";

export const metadata = { title: "Quality & Guarantees", description: "How Desmake keeps print and product quality consistent across every manufacturing adapter and node." };

export default function QualityPage() {
  return (
    <ContentPage
      eyebrow="Manufacturing"
      title="Quality, by design"
      intro="A marketplace is only as good as its worst shipment. Every adapter in the network is profiled, scored, and held to the same quality bar — so a print made in one node looks like one made in another."
      updated="Last updated August 2026"
      sections={[
        {
          layout: "bullets",
          heading: "How we keep it consistent",
          intro: "Quality is enforced at the network level, not left to chance.",
          items: [
            { title: "Adapter profiling", text: "Each adapter is scored on colour, resolution, and substrate before it can take live orders." },
            { title: "Artwork pre-checks", text: "Designs are analysed for print resolution, transparency, and bleed before they go live." },
            { title: "Node scoring", text: "Every node carries a quality score from real order outcomes; weak performers get less routing." },
            { title: "Buyer protection", text: "Defective or misprinted items are remade or refunded — creators are never on the hook." },
          ],
        },
        {
          layout: "cards",
          heading: "Our guarantees",
          intro: "What we stand behind on every order.",
          cards: [
            { title: "True-to-screen colour", text: "We calibrate adapters to a shared colour target so the print matches the preview." },
            { title: "No minimums, no compromise", text: "Single-unit orders are held to the same standard as bulk runs." },
            { title: "Remake or refund", text: "If it arrives wrong, we fix it. You keep your margin either way." },
            { title: "Transparent defects", text: "Quality issues feed back into node scoring, so the network gets better over time." },
          ],
        },
        {
          layout: "prose",
          heading: "Resolution matters",
          body: (
            <p className="lead muted">
              The D2M engine reads each upload&apos;s effective print resolution and flags artwork that will look soft at the
              intended size. AI-generated previews render at print-ready dimensions, and uploads are checked before publishing
              so buyers never receive a pixelated print.
            </p>
          ),
        },
      ]}
      cta={{
        eyebrow: "Standards",
        title: "Make something worth keeping",
        text: "Publish a design and let the network handle the rest — to a standard buyers can trust.",
        label: "Open Studio",
        href: "/studio",
      }}
    />
  );
}
