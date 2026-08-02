import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <section className="section">
      <div className="container-narrow center" style={{ padding: "clamp(64px,8vw,120px) 24px" }}>
        <div className="eyebrow eyebrow-dot">404</div>
        <h1 className="display balance" style={{ marginTop: 14 }}>Page not found</h1>
        <p className="lead muted" style={{ maxWidth: 420, margin: "16px auto 28px" }}>
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
        <div className="row gap-3 center" style={{ justifyContent: "center" }}>
          <Link href="/" className="btn btn-lg">Back home <ArrowRight size={18} strokeWidth={1.8} /></Link>
          <Link href="/explore" className="btn btn-lg btn-outline">Explore</Link>
        </div>
      </div>
    </section>
  );
}
