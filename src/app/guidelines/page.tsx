import { ContentPage } from "@/components/ContentPage";

export const metadata = { title: "Creator Guidelines", description: "Content and conduct guidelines for creators publishing designs on Desmake." };

export default function GuidelinesPage() {
  return (
    <ContentPage
      eyebrow="Creators"
      title="Creator guidelines"
      intro="These guidelines keep the marketplace safe, original, and worth browsing. They apply to every design you publish — AI-generated or uploaded. Most are common sense; a few are spelled out so expectations are clear."
      updated="Last updated August 2026"
      sections={[
        {
          layout: "cards",
          heading: "What you can publish",
          intro: "The default answer is yes — within these boundaries.",
          cards: [
            { title: "Original work", text: "You own or have the rights to everything you publish, including AI prompts and source files." },
            { title: "AI-generated art", text: "AI-assisted designs are welcome. You're responsible for the output meeting the rules below." },
            { title: "Remix responsibly", text: "Borrowing styles is fine; copying another creator's specific work is not." },
            { title: "Tasteful by default", text: "Bold, weird, and experimental are encouraged. Hateful or explicit-for-shock is not." },
          ],
        },
        {
          layout: "bullets",
          heading: "What's not allowed",
          intro: "We remove designs that cross these lines.",
          items: [
            { title: "Infringing work", text: "No copyrighted characters, logos, trademarks, or other people's art without rights." },
            { title: "Hate & harassment", text: "No content that attacks people or groups, or promotes harm." },
            { title: "Misleading claims", text: "No fake endorsements, counterfeit branding, or deceptive product claims." },
            { title: "Restricted subjects", text: "Some categories (e.g. regulated goods) require extra review before they go live." },
          ],
        },
        {
          layout: "bullets",
          heading: "Quality expectations",
          intro: "Listings that meet these ship faster and sell better.",
          items: [
            { title: "Print-ready artwork", text: "Use sufficient resolution; the engine will flag soft uploads before publishing." },
            { title: "Clear titles & tags", text: "Accurate, searchable metadata helps buyers find your work." },
            { title: "Honest mockups", text: "Generated product previews should reflect the real item and colours." },
            { title: "Rightful rights", text: "Keep proof of ownership handy in case a claim is raised." },
          ],
        },
        {
          layout: "prose",
          heading: "Enforcement",
          body: (
            <p className="lead muted">
              Violations are reviewed case by case. First issues are usually a takedown with a note; repeated or serious
              breaches can limit publishing or suspend an account. If something of yours was removed and you think it was a
              mistake, you can appeal from your account.
            </p>
          ),
        },
      ]}
      cta={{
        eyebrow: "Ready?",
        title: "Publish work you're proud of",
        text: "Read the guidelines, then put your first design in front of buyers.",
        label: "Open Studio",
        href: "/studio",
      }}
    />
  );
}
