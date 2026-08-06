import { ContentPage } from "@/components/ContentPage";

export const metadata = { title: "Shipping", description: "How Desmake routes orders to the factory node closest to the buyer, with transparent lead times and tracking." };

export default function ShippingPage() {
  return (
    <ContentPage
      eyebrow="Manufacturing"
      title="Made close. Shipped clear."
      intro="Every order is routed to the manufacturing node best positioned to fulfil it — balancing cost, lead time, and distance to the buyer. You see the timeline; the buyer tracks the parcel to the door."
      updated="Last updated August 2026"
      sections={[
        {
          layout: "bullets",
          heading: "How routing works",
          intro: "The moment an order is placed, the Design-to-Market engine picks a node.",
          items: [
            { title: "Nearest capable node", text: "We prefer the adapter instance closest to the buyer that can make the product to spec." },
            { title: "Cost-to-door, not just cost", text: "Routing weighs manufacturing cost against shipping, so the cheapest path is the one that lands cheapest at the door." },
            { title: "Live lead times", text: "Each adapter publishes its current lead time; listings show it before checkout." },
            { title: "Automatic failover", text: "If a node is at capacity, the order quietly moves to the next best node — no action needed from you." },
          ],
        },
        {
          layout: "cards",
          heading: "What buyers get",
          intro: "A calm, predictable delivery experience on every order.",
          cards: [
            { title: "Tracking from day one", text: "A tracking link is issued as soon as the item is printed and handed to the carrier." },
            { title: "Estimated delivery", text: "Shown up front at checkout, computed from the chosen node and destination." },
            { title: "30-day returns", text: "Buyers can return within 30 days; defects and misprints are remade on our side." },
            { title: "Carbon-aware routing", text: "Shorter hops to the buyer mean lower transit emissions on average." },
          ],
        },
        {
          layout: "prose",
          heading: "Typical timelines",
          body: (
            <p className="lead muted">
              Most products print and ship within <strong>5–7 business days</strong>, with delivery a few days after dispatch.
              Adapter lead times are displayed on each product card and on the listing page, so expectations are set before
              the buyer ever pays.
            </p>
          ),
        },
      ]}
      cta={{
        eyebrow: "Ship anywhere",
        title: "Publish once, sell worldwide",
        text: "Your designs reach 34 countries through the manufacturing network — no logistics work required.",
        label: "Browse the catalogue",
        href: "/explore",
      }}
    />
  );
}
