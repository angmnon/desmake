"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Grid3x3, DollarSign, Share2, User, Check, Copy, ExternalLink } from "lucide-react";
import { money } from "@/lib/data";
import { ShareSheet } from "@/components/ShareSheet";

type Overview = {
  works: number;
  views: number;
  saves: number;
  shares: number;
  referred_visits: number;
  creator_earnings: { pending_cents: number; paid_cents: number; total_cents: number };
  referral_earnings: { pending_cents: number; paid_cents: number; total_cents: number };
};
type PerDesign = { slug: string; title: string; views: number; saves: number; shares: number };
type Earnings = {
  creator: { pending_cents: number; paid_cents: number; total_cents: number };
  referral: { pending_cents: number; paid_cents: number; total_cents: number };
  recent: Array<{ kind: "creator" | "referral"; id: string; order_id: string; design_slug: string; rate: number; cents: number; status: string; created_at: string }>;
};

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "designs", label: "My designs", icon: Grid3x3 },
  { id: "earnings", label: "Earnings", icon: DollarSign },
  { id: "share", label: "Share", icon: Share2 },
  { id: "profile", label: "Profile", icon: User },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function DashboardClient({ handle, name }: { handle: string; name: string }) {
  const [tab, setTab] = useState<TabId>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [designs, setDesigns] = useState<PerDesign[]>([]);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [loading, setLoading] = useState(true);

  // profile editor
  const [pName, setPName] = useState(name);
  const [city, setCity] = useState("");
  const [roleTag, setRoleTag] = useState("");
  const [bio, setBio] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch("/api/analytics", { headers: { Accept: "application/json" } }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/earnings", { headers: { Accept: "application/json" } }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([a, e]) => {
        if (cancelled) return;
        if (a) {
          setOverview(a.overview);
          setDesigns(a.designs ?? []);
        }
        if (e) setEarnings(e);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const refLink = `${origin}/api/ref?ref=${encodeURIComponent(handle)}`;
  const profileLink = `${origin}/creators/${encodeURIComponent(handle)}`;

  const saveProfile = async () => {
    setSaved(false);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: pName, city, roleTag, bio }),
    });
    if (res.ok) setSaved(true);
  };

  return (
    <div>
      <section style={{ paddingTop: "clamp(28px,4vw,48px)" }}>
        <div className="container-wide">
          <div className="row-between mb-6 wrap gap-3">
            <div>
              <span className="eyebrow eyebrow-dot">Creator dashboard</span>
              <h1 className="h2 mt-2">Welcome, {name}</h1>
              <p className="small muted mono">@{handle}</p>
            </div>
            <Link href="/studio" className="btn">Open Studio</Link>
          </div>

          <div className="row gap-2 wrap mb-6">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  className={`btn ${tab === t.id ? "" : "btn-outline"}`}
                  onClick={() => setTab(t.id)}
                >
                  <Icon size={15} /> {t.label}
                </button>
              );
            })}
          </div>

          {loading && !overview ? (
            <p className="small muted">Loading your dashboard…</p>
          ) : tab === "overview" ? (
            <OverviewTab overview={overview} earnings={earnings} />
          ) : tab === "designs" ? (
            <DesignsTab designs={designs} />
          ) : tab === "earnings" ? (
            <EarningsTab earnings={earnings} />
          ) : tab === "share" ? (
            <ShareTab handle={handle} refLink={refLink} profileLink={profileLink} />
          ) : (
            <ProfileTab
              pName={pName} setPName={setPName}
              city={city} setCity={setCity}
              roleTag={roleTag} setRoleTag={setRoleTag}
              bio={bio} setBio={setBio}
              saved={saved} onSave={saveProfile}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card" style={{ padding: 22 }}>
      <div className="tiny mono" style={{ color: "var(--color-tx-3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
      <div className="display mono mt-2" style={{ fontSize: "clamp(26px,3vw,38px)", lineHeight: 1 }}>{value}</div>
      {sub && <div className="small mt-1" style={{ color: "var(--color-tx-2)" }}>{sub}</div>}
    </div>
  );
}

function OverviewTab({ overview, earnings }: { overview: Overview | null; earnings: Earnings | null }) {
  if (!overview) return <p className="small muted">No data yet.</p>;
  const c = overview.creator_earnings;
  const r = overview.referral_earnings;
  return (
    <div className="stack gap-5">
      <div className="grid g-4" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        <Stat label="Works" value={String(overview.works)} />
        <Stat label="Views" value={String(overview.views)} />
        <Stat label="Saves" value={String(overview.saves)} />
        <Stat label="Shares" value={String(overview.shares)} />
      </div>
      <div className="grid g-4" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
        <div className="card" style={{ padding: 22 }}>
          <div className="row gap-2 mb-3"><DollarSign size={16} /> <b>Creator earnings</b></div>
          <Stat label="Total earned" value={money(c.total_cents)} sub={`${money(c.pending_cents)} pending · ${money(c.paid_cents)} paid`} />
        </div>
        <div className="card" style={{ padding: 22 }}>
          <div className="row gap-2 mb-3"><Share2 size={16} /> <b>Referral earnings</b></div>
          <Stat label="Total earned" value={money(r.total_cents)} sub={`${money(r.pending_cents)} pending · ${money(r.paid_cents)} paid`} />
        </div>
      </div>
      {earnings && (
        <div className="card" style={{ padding: 22 }}>
          <div className="h5 mb-3">Recent activity</div>
          <div className="stack gap-2">
            {earnings.recent.slice(0, 8).map((e) => (
              <div key={e.id} className="row-between small">
                <span>
                  <span className={`badge ${e.kind === "referral" ? "badge-cobalt" : ""}`} style={{ marginRight: 8, fontSize: "0.625rem" }}>{e.kind}</span>
                  {e.design_slug}
                </span>
                <span className="mono">{money(e.cents)} · {e.status}</span>
              </div>
            ))}
            {earnings.recent.length === 0 && <span className="small muted">No earnings yet — share your designs to start earning.</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function DesignsTab({ designs }: { designs: PerDesign[] }) {
  if (designs.length === 0) return <p className="small muted">You haven&apos;t published any designs yet. <Link href="/studio" className="link-u">Open Studio</Link> to create one.</p>;
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(12,12,13,0.1)" }}>
            <th className="small" style={{ padding: "12px 16px" }}>Design</th>
            <th className="small" style={{ padding: "12px 16px" }}>Views</th>
            <th className="small" style={{ padding: "12px 16px" }}>Saves</th>
            <th className="small" style={{ padding: "12px 16px" }}>Shares</th>
          </tr>
        </thead>
        <tbody>
          {designs.map((d) => (
            <tr key={d.slug} style={{ borderBottom: "1px solid rgba(12,12,13,0.06)" }}>
              <td style={{ padding: "12px 16px" }}><Link href={`/listing/${d.slug}`} className="link-u small">{d.title}</Link></td>
              <td className="mono small" style={{ padding: "12px 16px" }}>{d.views}</td>
              <td className="mono small" style={{ padding: "12px 16px" }}>{d.saves}</td>
              <td className="mono small" style={{ padding: "12px 16px" }}>{d.shares}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EarningsTab({ earnings }: { earnings: Earnings | null }) {
  if (!earnings) return <p className="small muted">No earnings data.</p>;
  return (
    <div className="stack gap-4">
      <div className="grid g-4" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
        <Stat label="Creator total" value={money(earnings.creator.total_cents)} sub={`${money(earnings.creator.pending_cents)} pending`} />
        <Stat label="Referral total" value={money(earnings.referral.total_cents)} sub={`${money(earnings.referral.pending_cents)} pending`} />
      </div>
      <div className="card" style={{ padding: 22 }}>
        <div className="h5 mb-3">Ledger</div>
        <div className="stack gap-2">
          {earnings.recent.map((e) => (
            <div key={e.id} className="row-between small">
              <span>
                <span className="badge" style={{ marginRight: 8, fontSize: "0.625rem" }}>{e.kind}</span>
                {e.design_slug}
              </span>
              <span className="mono">{money(e.cents)} · {e.status}</span>
            </div>
          ))}
          {earnings.recent.length === 0 && <span className="small muted">Nothing yet.</span>}
        </div>
      </div>
    </div>
  );
}

function ShareTab({ handle, refLink, profileLink }: { handle: string; refLink: string; profileLink: string }) {
  const [copied, setCopied] = useState<"ref" | "profile" | null>(null);
  const copy = async (which: "ref" | "profile") => {
    try {
      await navigator.clipboard.writeText(which === "ref" ? refLink : profileLink);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* ignore */ }
  };
  return (
    <div className="stack gap-4">
      <div className="card" style={{ padding: 22 }}>
        <div className="h5 mb-1">Your referral link</div>
        <p className="small muted mb-3">Share this anywhere. Any purchase through it earns you <b>7%</b> for 30 days.</p>
        <div className="row gap-2">
          <input readOnly value={refLink} onFocus={(e) => e.currentTarget.select()} className="input" style={{ flex: 1, fontFamily: "monospace", fontSize: 13 }} />
          <button className="btn" onClick={() => copy("ref")}>{copied === "ref" ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}</button>
        </div>
      </div>
      <div className="card" style={{ padding: 22 }}>
        <div className="h5 mb-1">Your profile</div>
        <div className="row gap-2">
          <input readOnly value={profileLink} onFocus={(e) => e.currentTarget.select()} className="input" style={{ flex: 1, fontFamily: "monospace", fontSize: 13 }} />
          <button className="btn" onClick={() => copy("profile")}>{copied === "profile" ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}</button>
          <Link href={profileLink} className="btn btn-outline" target="_blank"><ExternalLink size={15} /></Link>
        </div>
      </div>
      <ShareSheet handle={handle} label="Open share sheet" />
    </div>
  );
}

function ProfileTab(props: {
  pName: string; setPName: (v: string) => void;
  city: string; setCity: (v: string) => void;
  roleTag: string; setRoleTag: (v: string) => void;
  bio: string; setBio: (v: string) => void;
  saved: boolean; onSave: () => void;
}) {
  return (
    <div className="card" style={{ padding: 24, maxWidth: 560 }}>
      <div className="h5 mb-4">Edit creator profile</div>
      <div className="stack gap-4">
        <label className="stack gap-1">
          <span className="tiny mono" style={{ color: "var(--color-tx-3)" }}>Display name</span>
          <input className="input" value={props.pName} onChange={(e) => props.setPName(e.target.value)} maxLength={80} />
        </label>
        <label className="stack gap-1">
          <span className="tiny mono" style={{ color: "var(--color-tx-3)" }}>City</span>
          <input className="input" value={props.city} onChange={(e) => props.setCity(e.target.value)} placeholder="Worldwide" maxLength={80} />
        </label>
        <label className="stack gap-1">
          <span className="tiny mono" style={{ color: "var(--color-tx-3)" }}>Role tag</span>
          <input className="input" value={props.roleTag} onChange={(e) => props.setRoleTag(e.target.value)} placeholder="Patterns & Illustration" maxLength={60} />
        </label>
        <label className="stack gap-1">
          <span className="tiny mono" style={{ color: "var(--color-tx-3)" }}>Bio</span>
          <textarea className="input" value={props.bio} onChange={(e) => props.setBio(e.target.value)} rows={4} maxLength={280} />
        </label>
        <div className="row gap-3">
          <button className="btn" onClick={props.onSave}>Save profile</button>
          {props.saved && <span className="small row gap-1" style={{ color: "var(--color-ink)" }}><Check size={15} /> Saved</span>}
        </div>
      </div>
    </div>
  );
}
