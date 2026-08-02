import type { CSSProperties, ReactNode } from "react";

/**
 * Renders a destination-less affordance honestly.
 *
 * The codebase previously used `href="#"` for surfaces that were never built
 * (legal pages, docs, payout guides, the agent SDK waitlist). Those render as
 * real links, are keyboard-focusable, and silently do nothing when activated —
 * which reads as a broken app rather than an unfinished one.
 *
 * This component renders a non-interactive <span> instead: not focusable, not
 * clickable, visually de-emphasised, and announced as disabled to assistive tech.
 * When a real route lands, swap the call site back to <Link href="...">.
 */
export function Inactive({
  children,
  className = "",
  style,
  label = "Not available in this build",
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  label?: string;
}) {
  return (
    <span
      role="link"
      aria-disabled="true"
      title={label}
      className={`dm-inactive ${className}`.trim()}
      style={style}
    >
      {children}
    </span>
  );
}
