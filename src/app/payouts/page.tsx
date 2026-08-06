import { ContentPage } from "@/components/ContentPage";

export const metadata = { title: "Creator Payouts", description: "How Desmake pays creators — transparent margins, per-order payouts, and clear thresholds." };

export default function PayoutsPage() {
  return (
    <ContentPage
      eyebrow="Creators"
      title="You make. We pay."
      intro="Payouts on Desmake are built on one rule: you see exactly what you earn on every sale. Your margin is tracked per order and released on a clear schedule — no black boxes."
      updated="Last updated August 2026"
      sections={[
        {
          layout: "cards",
          heading: "How payouts work",
          intro: "From sale to settled, the flow is transparent.",
          cards: [
            { badge: "Per order", title: "Margin tracked", text: "Each sale records your set margin separately from manufacturing and shipping costs." },
            { badge: "On fulfilment", title: "Held until shipped", text: "Funds are reserved when the order is placed and released once the item ships and the return window clears." },
            { badge: "Scheduled", title: "Paid regularly", text: "Released payouts are batched and sent on a recurring schedule to your linked account." },
            { badge: "Visible", title: "Always itemised", text: "Your account shows every order, its margin, and its payout status in real time." },
          ],
        },
        {
          layout: "bullets",
          heading: "What you keep",
          intro: "A simple, honest split on every order.",
          items: [
            { title: "Your margin is yours", text: "Set it per design. Start at $0 to test the catalogue, raise it as your audience grows." },
            { title: "No upfront cost", text: "Nothing is charged to list, generate, or host your storefront." },
            { title: "No inventory risk", text: "Items are made after they sell, so there is never stock to finance." },
            { title: "Defects covered", text: "Remakes and refunds for manufacturing faults come out of our side, not your margin." },
          ],
        },
        {
          layout: "prose",
          heading: "Thresholds & timing",
          body: (
            <p className="lead muted">
              Payouts accumulate and are released once a minimum balance is reached. Specific thresholds, schedules, and
              supported payout regions are confirmed when you connect a payout method in your account — we surface the exact
              numbers before you confirm, so there are no surprises.
            </p>
          ),
        },
      ]}
      cta={{
        eyebrow: "For creators",
        title: "Start earning on your work",
        text: "Publish your first design and watch the margin build with every sale.",
        label: "Become a creator",
        href: "/creators",
      }}
    />
  );
}
