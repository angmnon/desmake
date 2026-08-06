import { ContentPage } from "@/components/ContentPage";

export const metadata = { title: "Cookie Policy", description: "How and why Desmake uses cookies." };

export default function CookiesPage() {
  return (
    <ContentPage
      eyebrow="Legal"
      title="Cookie Policy"
      intro="Cookies are small files your browser stores so sites can remember you. Here's exactly which ones Desmake uses and why."
      updated="Last updated August 2026"
      sections={[
        {
          layout: "cards",
          heading: "The cookies we use",
          intro: "Grouped by what they do.",
          cards: [
            { badge: "Essential", title: "Session", text: "Keeps you signed in and routes protected pages correctly. Cannot be turned off." },
            { badge: "Essential", title: "Cart", text: "Remembers what's in your bag between visits, stored locally on your device." },
            { badge: "Analytics", title: "Usage", text: "Helps us understand which pages work so we can improve them. Aggregated, not personal." },
            { badge: "Preferences", title: "Settings", text: "Remembers small UI choices, like your last-selected studio style." },
          ],
        },
        {
          layout: "prose",
          heading: "Managing cookies",
          body: (
            <p className="lead muted">
              You can block or delete cookies in your browser settings. Blocking essential cookies will sign you out and break
              checkout; analytics and preference cookies are optional and safe to remove.
            </p>
          ),
        },
        {
          layout: "prose",
          heading: "Third parties",
          body: (
            <p className="lead muted">
              Payment and analytics providers may set their own cookies when you check out or browse. Those are governed by
              their policies, not ours. We minimise third-party tracking wherever we can.
            </p>
          ),
        },
      ]}
      cta={{
        eyebrow: "Related",
        title: "How we handle the rest of your data",
        text: "Cookies are only part of the story — see our Privacy Policy for the full picture.",
        label: "Privacy Policy",
        href: "/privacy",
      }}
    />
  );
}
