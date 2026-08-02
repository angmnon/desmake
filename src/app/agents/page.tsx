import Link from "next/link";
import { ArrowRight, Bot, Sparkles, Workflow, Zap, Globe, Shield } from "lucide-react";
import { Inactive } from "@/components/Inactive";

const AGENTS = [
  { name: "Brief → Design", desc: "Turn a written creative brief into 8 production-ready concepts in 30 seconds.", icon: <Sparkles size={20} strokeWidth={1.8} />, adapters: ["poster", "apparel", "sticker"] },
  { name: "Brand Kit", desc: "Upload a reference image and we extract palette, type, vibe — then apply to any product.", icon: <Workflow size={20} strokeWidth={1.8} />, adapters: ["all surfaces"] },
  { name: "Trend Scanner", desc: "Scans the marketplace and cultural signals to surface what's selling right now.", icon: <Zap size={20} strokeWidth={1.8} />, adapters: ["analytics"] },
  { name: "Localizer", desc: "Auto-translate and culturally adapt your listing for 32 markets in one click.", icon: <Globe size={20} strokeWidth={1.8} />, adapters: ["all listings"] },
  { name: "IP Guard", desc: "Scans every generation against our copyright graph before publication.", icon: <Shield size={20} strokeWidth={1.8} />, adapters: ["compliance"] },
];

export default function AgentsPage() {
  return (
    <div>
      <section style={{ paddingTop: "clamp(32px,4vw,56px)" }}>
        <div className="container-narrow center">
          <span className="eyebrow eyebrow-dot">AI Agents</span>
          <h1 className="display balance" style={{ marginTop: 14 }}>Agents that do the <span className="serif-i">work.</span></h1>
          <p className="lead" style={{ maxWidth: "48ch", margin: "20px auto 28px" }}>
            A growing library of specialized AI agents that automate the tedious parts of running a creative business — from ideation to localization to compliance.
          </p>
          <div className="row gap-3" style={{ justifyContent: "center" }}>
            <Link href="/studio" className="btn btn-lg">Try in Studio <ArrowRight size={18} strokeWidth={1.8} /></Link>
          </div>
        </div>
      </section>

      <section className="section-sm">
        <div className="container-wide">
          <div className="grid g-3" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
            {AGENTS.map((a, i) => (
              <div key={a.name} className="card" style={{ padding: 28 }}>
                <div className="row-between mb-4">
                  <div className="row gap-2 items-center">
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--color-paper-2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-ink)" }}>{a.icon}</div>
                    <div>
                      <h3 className="h5">{a.name}</h3>
                      <div className="tiny mono" style={{ color: "var(--color-tx-3)" }}>agent_{String(i + 1).padStart(2, "0")}</div>
                    </div>
                  </div>
                  <span className="badge badge-outline" style={{ fontSize: "0.625rem" }}>
                    {i < 2 ? "Available" : "Coming soon"}
                  </span>
                </div>
                <p className="small muted" style={{ marginBottom: 16 }}>{a.desc}</p>
                <div className="row gap-1 wrap">
                  {a.adapters.map((x) => (
                    <span key={x} className="tag mono" style={{ fontSize: "0.625rem" }}>{x}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-sm">
        <div className="container-wide">
          <div className="card" style={{ padding: "clamp(40px,5vw,64px)", background: "var(--color-ink)", color: "#fff" }}>
            <div style={{ maxWidth: 640 }}>
              <div className="eyebrow mb-4" style={{ color: "rgba(255,255,255,0.5)" }}>
                <Bot size={12} /> For developers
              </div>
              <h2 className="h2" style={{ fontSize: "clamp(28px,3.5vw,44px)" }}>Build your own agents.</h2>
              <p className="lead" style={{ color: "rgba(255,255,255,0.7)", marginTop: 12, marginBottom: 28 }}>
                The Agent SDK is in private beta. Ship agents that hook into every stage of the pipeline — creation, moderation, distribution, pricing.
              </p>
              <Inactive className="btn btn-lg btn-outline" label="Private beta waitlist is not open yet" style={{ borderColor: "rgba(255,255,255,0.3)", color: "#fff" }}>
                Request access <ArrowRight size={18} strokeWidth={1.8} />
              </Inactive>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
