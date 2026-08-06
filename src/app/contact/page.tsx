import { ContentPage } from "@/components/ContentPage";

export const metadata = { title: "Contact", description: "Get in touch with the Desmake team — support, creators, press, and partnerships." };

export default function ContactPage() {
  return (
    <ContentPage
      eyebrow="Company"
      title="Say hello"
      intro="Questions about an order, your creator account, or working with us? Pick the channel that fits and we'll get back to you. Most messages are answered within one business day."
      updated="Last updated August 2026"
      sections={[
        {
          layout: "cards",
          heading: "The right inbox",
          intro: "Routing to the right team gets you an answer faster.",
          cards: [
            { badge: "Help", title: "Support", text: "Order status, shipping, returns, and account help." },
            { badge: "Creators", title: "Creator care", text: "Publishing, payouts, and guideline questions for sellers." },
            { badge: "Press", title: "Press & media", text: "Interviews, assets, and company information requests." },
            { badge: "Partners", title: "Partnerships", text: "Manufacturing nodes, brands, and integration partners." },
          ],
        },
        {
          layout: "prose",
          heading: "Before you write",
          body: (
            <p className="lead muted">
              If your question is about a specific order, include the order number — it's on the confirmation email and in
              your account under <strong>Orders</strong>. For account access, the fastest path is often the sign-in page's
              recovery flow. We never ask for your password by email.
            </p>
          ),
        },
        {
          layout: "bullets",
          heading: "Response times",
          items: [
            { title: "Support", text: "Typically within 1 business day." },
            { title: "Creator care", text: "Typically within 1 business day." },
            { title: "Press & partners", text: "Within 2–3 business days." },
            { title: "Emergencies", text: "Order or safety issues are prioritised and triaged the same day." },
          ],
        },
      ]}
      cta={{
        eyebrow: "Self-serve first",
        title: "Many answers are one click away",
        text: "Your orders, payouts, and account live in your dashboard — no email required.",
        label: "Go to my account",
        href: "/account",
      }}
    />
  );
}
