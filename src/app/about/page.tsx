import { ContentPage } from "@/components/ContentPage";
import Link from "next/link";

export const metadata = { title: "About", description: "Desmake is the AI-native design marketplace connecting creators with a global on-demand manufacturing network." };

export default function AboutPage() {
  return (
    <ContentPage
      eyebrow="Company"
      title="We make manufacturing feel like publishing"
      intro="Desmake is the AI-native marketplace where a single design becomes a sellable product — produced on demand, close to the buyer, with no inventory and no minimums."
      updated="Last updated August 2026"
      sections={[
        {
          layout: "prose",
          heading: "Why we built this",
          body: (
            <>
              <p className="lead muted">
                For most of the last decade, turning art into a physical product meant choosing between two bad options:
                print thousands of units you might not sell, or hand-manage a patchwork of print-on-demand apps that each
                speak their own language.
              </p>
              <p className="small muted">
                We believed the right model was closer to how the web works. You publish once. The network figures out how to
                make it, where to make it, and how to ship it. Desmake is that network — a Design-to-Market engine that sits
                between a creator&apos;s idea and a buyer&apos;s doorstep.
              </p>
              <p className="small muted">
                AI is the multiplier, not the point. It helps you generate, mock up, and localise faster, but the hard problem
                we actually solve is manufacturing: matching every design to the adapters that can make it, pricing it
                honestly, and routing each order to the node with the best cost-to-door.
              </p>
            </>
          ),
        },
        {
          layout: "stats",
          items: [
            { v: "2,481", k: "Items in production now" },
            { v: "34", k: "Shipping countries" },
            { v: "$1.2M", k: "Paid to creators" },
            { v: "4 min", k: "Avg. upload → live" },
          ],
        },
        {
          layout: "cards",
          heading: "What we care about",
          intro: "A few principles that shape every product decision.",
          cards: [
            { title: "No inventory, ever", text: "Nothing is made until it is sold. That means zero dead stock, zero warehouses, and zero risk pushed onto creators." },
            { title: "Honest pricing", text: "Every listing shows the real manufacturing cost and the creator margin. No hidden fees, no mystery math." },
            { title: "Made close to home", text: "Orders route to the factory node nearest the buyer, cutting transit time and shipping emissions." },
            { title: "Creators get paid", text: "Transparent payouts on every sale. You keep making; we handle the rest of the supply chain." },
            { title: "AI as a co-pilot", text: "Generation and mockups speed you up — but you stay in control of the work and the rights." },
            { title: "Open by default", text: "An API, an MCP server, and webhooks so agents and tools can build on the same factory floor you use." },
          ],
        },
        {
          layout: "prose",
          heading: "Where we're headed",
          body: (
            <p className="lead muted">
              The long-term goal is simple to say and hard to do: make manufacturing as easy to trigger as sending a message.
              We&apos;re expanding adapter types, deepening the agent tooling, and bringing more regional factory nodes online
              so &ldquo;made anywhere&rdquo; is also &ldquo;made nearby.&rdquo;
            </p>
          ),
        },
      ]}
      cta={{
        eyebrow: "Join us",
        title: "Design once. Manufacture anywhere.",
        text: "Create an account and publish your first design in minutes — no inventory, no minimums.",
        label: "Start creating",
        href: "/studio",
      }}
    />
  );
}
