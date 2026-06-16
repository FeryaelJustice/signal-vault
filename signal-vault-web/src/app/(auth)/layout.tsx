import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in — SignalVault",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      {/* Subtle background grid */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.65 0.18 264) 1px, transparent 1px), linear-gradient(90deg, oklch(0.65 0.18 264) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      {/* Brand mark */}
      <div className="mb-10 flex flex-col items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/30">
          <ShieldIcon />
        </div>
        <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
          SignalVault
        </span>
      </div>
      {children}
    </main>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="oklch(0.65 0.18 264)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
