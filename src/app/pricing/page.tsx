import { ContentPage } from "@/components/ContentPage";

import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  path: "/pricing",
  title: "Desmake pricing — transparent cost, your margin, no upfront fees",
  description:
    "How Desmake pricing works: transparent manufacturing cost, the margin you set, and no subscription or listing fees. You pay only when an item sells.",
});

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
      breadcrumb={[
        { name: "Home", href: "/" },
        { name: "Pricing", href: "/pricing" },
      ]}
      faq={[
        {
          q: "How much does it cost to sell on Desmake?",
          a: "Nothing upfront. There are no listing fees and no subscription. You pay the real manufacturing cost only when an item sells, and you keep the margin you set.",
        },
        {
          q: "What is my margin?",
          a: "You choose a royalty between 10% and 50% per sale. Start at $0 while you learn the catalogue and raise it as your audience grows. Every listing shows the exact cost breakdown.",
        },
        {
          q: "When and how do I get paid?",
          a: "Your margin is tracked per order and released on a scheduled payout once the item ships and the return window clears. You can watch every order and its status in your account.",
        },
        {
          q: "Are there any hidden fees?",
          a: "No. Manufacturing, standard payment processing and shipping are shown separately and taken from the order total. Defective or misprinted items are remade or refunded on our side, not yours.",
        },
        {
          q: "Do I need inventory?",
          a: "No. Items are made to order after they sell, so there is never stock to finance and no minimum order quantity.",
        },
      ]}
    />
  );
}
