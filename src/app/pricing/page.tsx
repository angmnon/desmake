import { ContentPage } from "@/components/ContentPage";

export const metadata = { title: "Pricing", description: "How Desmake pricing works — transparent manufacturing cost, your margin, and no upfront fees." };

export default function PricingPage() {
  return (
    <ContentPage
      eyebrow="Manufacturing"
      title="Pricing you can actually read"
      intro="There is no subscription to sell on Desmake. You pay the real manufacturing cost when an item sells; you keep the margin you set. No listing fees, no monthly minimums, no inventory."
      updated="Last updated August 2026"
      sections={[
        {
          layout: "cards",
          heading: "How a price is built",
          intro: "Every listing shows the same three numbers, broken out clearly.",
          cards: [
            { badge: "Base", title: "Manufacturing cost", text: "The adapter's real production cost for the product and print method — what it costs to actually make it." },
            { badge: "You set", title: "Your margin", text: "The amount you earn on each sale. Start at $0 while you learn the catalogue, raise it whenever you like." },
            { badge: "Buyer pays", title: "Retail price", text: "Manufacturing cost + your margin + estimated tax. Shipping is shown separately at checkout." },
          ],
        },
        {
          layout: "bullets",
          heading: "What's free",
          intro: "The things that should never cost you anything as a creator.",
          items: [
            { title: "Publishing", text: "List unlimited designs. There is no per-listing fee and no cap on catalogue size." },
            { title: "AI generation", text: "Generate preview variations in Studio at no charge while we're in open beta." },
            { title: "Mockups & copy", text: "Product mockups, titles, and descriptions are generated as part of publishing." },
            { title: "Storefront", text: "Your creator profile and every public listing are hosted on Desmake at no cost." },
          ],
        },
        {
          layout: "bullets",
          heading: "What you pay when something sells",
          intro: "Costs are deducted per order, never upfront.",
          items: [
            { title: "Manufacturing", text: "The adapter cost for the item and print method, taken from the order total." },
            { title: "Payment fees", text: "Standard processor fees apply to the buyer's payment, as with any checkout." },
            { title: "Shipping", text: "Calculated by destination and adapter; shown to the buyer before they pay." },
            { title: "Returns", text: "Defective or misprinted items are remade or refunded on our side — not yours to absorb." },
          ],
        },
        {
          layout: "prose",
          heading: "An example",
          body: (
            <p className="lead muted">
              A heavyweight tee costs the adapter <strong>$12.00</strong> to make and print. You set a <strong>$8.00</strong> margin.
              The buyer sees a <strong>$20.00</strong> retail price plus shipping and estimated tax. When the order lands, the
              $12.00 goes to manufacturing and your <strong>$8.00</strong> is queued for payout. Nothing leaves your account
              up front.
            </p>
          ),
        },
      ]}
      cta={{
        eyebrow: "Get started",
        title: "Set your first margin in minutes",
        text: "Publish a design, choose your price, and watch the cost breakdown update live.",
        label: "Open Studio",
        href: "/studio",
      }}
    />
  );
}
