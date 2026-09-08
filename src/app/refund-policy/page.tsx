import { ContentPage } from "@/components/ContentPage";

import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  path: "/refund-policy",
  title: "Desmake refund & return policy",
  description:
    "Desmake's refund and return policy — how returns and refunds work for AI-generated digital designs and made-to-order physical prints.",
});

export default function RefundPolicyPage() {
  return (
    <ContentPage
      eyebrow="Legal"
      title="Refund & Return Policy"
      intro="This policy explains how refunds and returns work at Desmake. Because we sell both instant digital downloads and made-to-order physical prints, the rules differ by product type — please read the section that applies to your order."
      updated="Last updated August 2026"
      sections={[
        {
          layout: "prose",
          heading: "Two kinds of products",
          body: (
            <p className="lead muted">
              Digital products are AI-generated designs and downloadable files delivered instantly to your account — once
              delivered, they are non-tangible and final. Physical products are made to order by our manufacturing network
              (posters, t-shirts, and other printed goods) and are produced only after you place an order.
            </p>
          ),
        },
        {
          layout: "bullets",
          heading: "Digital products",
          items: [
            { title: "No returns", text: "Because downloads are delivered immediately and can be copied, all sales of digital designs and files are final and non-refundable once the file has been made available." },
            { title: "Defective file", text: "If a download is corrupted, incomplete, or not as described, contact us within 14 days and we will re-deliver a corrected file or issue a refund." },
            { title: "Unused credit", text: "Where you purchased store credit that was never applied to a download, it remains refundable on request." },
          ],
        },
        {
          layout: "bullets",
          heading: "Physical (made-to-order) products",
          items: [
            { title: "Return window", text: "Physical prints may be returned within 30 days of delivery in original, unopened, and undamaged condition." },
            { title: "Made to order", text: "Items are produced on demand, so we cannot accept returns simply because you changed your mind after production has started. Start a return before the order ships to cancel without cost." },
            { title: "Refund timing", text: "Approved refunds are processed within 5–10 business days after we receive and inspect the returned item." },
            { title: "Refund method", text: "Refunds are returned to the original payment method used at checkout. We cannot issue refunds to a different account." },
          ],
        },
        {
          layout: "prose",
          heading: "Quality issues, exchanges & reprints",
          body: (
            <p className="lead muted">
              If a physical item arrives damaged, misprinted, or materially different from what you ordered, we will reprint or
              replace it at no cost. Report the issue within 30 days of delivery with photos of the defect, and we will arrange
              a replacement or a full refund including original shipping. For digital files, a corrected re-delivery is provided
              as described above.
            </p>
          ),
        },
        {
          layout: "prose",
          heading: "Governing law & disputes",
          body: (
            <p className="lead muted">
              This policy is governed by the laws of the jurisdiction in which Desmake, Inc. is established, without regard to
              conflict-of-law rules. Disputes that cannot be resolved informally will first be attempted through good-faith
              discussion and, where required, resolved by the competent courts of that jurisdiction.
            </p>
          ),
        },
        {
          layout: "prose",
          heading: "Contact",
          body: (
            <p className="lead muted">
              Questions about a refund or return? Email us at{" "}
              <a href="mailto:support@desmake.com" className="link-u">support@desmake.com</a> with your order number and we will
              help you through it.
            </p>
          ),
        },
      ]}
      cta={{
        eyebrow: "Related",
        title: "The rest of the fine print",
        text: "Our Terms of Service and Privacy Policy cover how the marketplace and your data are handled.",
        label: "Terms of Service",
        href: "/terms",
      }}
    />
  );
}
