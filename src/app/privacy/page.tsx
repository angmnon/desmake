import { ContentPage } from "@/components/ContentPage";

export const metadata = { title: "Privacy Policy", description: "How Desmake collects, uses, and protects your data." };

export default function PrivacyPage() {
  return (
    <ContentPage
      eyebrow="Legal"
      title="Privacy Policy"
      intro="This policy explains what we collect, why we collect it, and the choices you have. We keep it plain on purpose — you should understand your data without a law degree."
      updated="Last updated August 2026"
      sections={[
        {
          layout: "prose",
          heading: "What we collect",
          body: (
            <>
              <p className="lead muted">
                We collect the minimum needed to run the marketplace: your account email and name, the designs you publish,
                and the order and shipping details required to fulfil purchases.
              </p>
              <p className="small muted">
                We also store basic usage signals (such as which pages you visit) to improve the product. We do not sell your
                personal data, and we do not use your designs to train models without your permission.
              </p>
            </>
          ),
        },
        {
          layout: "bullets",
          heading: "How we use it",
          items: [
            { title: "Run your account", text: "Authenticate you, show your orders, and pay out earnings." },
            { title: "Fulfil orders", text: "Send the right artwork and address to the manufacturing node that makes and ships it." },
            { title: "Improve the product", text: "Understand what works so we can make Studio and the catalogue better." },
            { title: "Stay in touch", text: "Send transactional messages about your orders and account." },
          ],
        },
        {
          layout: "prose",
          heading: "Your choices",
          body: (
            <p className="lead muted">
              You can request a copy of your data or deletion of your account at any time from your account settings or by
              contacting us. Deleting your account removes your profile and published listings; orders already in production
              are completed so buyers aren&apos;t left empty-handed.
            </p>
          ),
        },
        {
          layout: "prose",
          heading: "Cookies",
          body: (
            <p className="lead muted">
              We use a small set of cookies to keep you signed in and to understand site usage. You can manage cookies in your
              browser — see our <a href="/cookies" className="link-u small">Cookie Policy</a> for details.
            </p>
          ),
        },
      ]}
      cta={{
        eyebrow: "Questions?",
        title: "We're happy to clarify",
        text: "If anything here is unclear, reach out and we'll walk you through it.",
        label: "Contact us",
        href: "/contact",
      }}
    />
  );
}
