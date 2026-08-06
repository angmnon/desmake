import { ContentPage } from "@/components/ContentPage";

export const metadata = { title: "Terms of Service", description: "The terms that govern your use of Desmake." };

export default function TermsPage() {
  return (
    <ContentPage
      eyebrow="Legal"
      title="Terms of Service"
      intro="These terms govern your use of Desmake — whether you're buying, selling, or building on the platform. By using the site you agree to them."
      updated="Last updated August 2026"
      sections={[
        {
          layout: "prose",
          heading: "Your account",
          body: (
            <p className="lead muted">
              You&apos;re responsible for your account and for keeping your password safe. You must be authorized to publish any
              work you upload, and you confirm you have the rights to it.
            </p>
          ),
        },
        {
          layout: "bullets",
          heading: "Buying & selling",
          items: [
            { title: "Buyers", text: "Orders are made to order after purchase. Pricing, shipping, and return windows are shown before you pay." },
            { title: "Creators", text: "You keep the margin you set; manufacturing and shipping are deducted per order. See Payouts for timing." },
            { title: "Content", text: "You grant Desmake a licence to display and produce your designs solely to fulfil orders and operate the marketplace." },
            { title: "Conduct", text: "Follow the creator guidelines. We may remove content or limit accounts that don't." },
          ],
        },
        {
          layout: "prose",
          heading: "Our role",
          body: (
            <p className="lead muted">
              Desmake operates the marketplace and the manufacturing network. We facilitate production and fulfilment but are
              not the original author of creator content. Items are made on demand by independent manufacturing nodes in the
              network.
            </p>
          ),
        },
        {
          layout: "prose",
          heading: "Changes",
          body: (
            <p className="lead muted">
              We may update these terms as the product evolves. Material changes are announced, and continued use after an
              update means you accept the new terms.
            </p>
          ),
        },
      ]}
      cta={{
        eyebrow: "Related",
        title: "Read the fine print that matters to you",
        text: "Our privacy and cookie policies cover how your data is handled day to day.",
        label: "Privacy Policy",
        href: "/privacy",
      }}
    />
  );
}
