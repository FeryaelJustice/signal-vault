"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useVaultStore } from "@/lib/vault/vaultStore";
import { Button } from "@/components/ui/button";
import { clsx } from "clsx";
import { toast } from "sonner";

const NAV_LINKS = [
  { href: "/vault", label: "Vault" },
  { href: "/rooms", label: "Rooms" },
];

export function AppNav() {
  const { user, logout } = useAuth();
  const { locked, lock } = useVaultStore();
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    try {
      lock();
      await logout();
      router.push("/login");
    } catch {
      toast.error("Logout failed");
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
        {/* Logo */}
        <Link
          href="/vault"
          className="flex items-center gap-2 font-mono text-sm font-semibold tracking-wide text-foreground"
          aria-label="SignalVault home"
        >
          <ShieldIcon className="h-5 w-5 text-primary" />
          <span className="hidden sm:inline">SignalVault</span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1" aria-label="Main navigation">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                pathname.startsWith(link.href)
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {/* Vault lock badge */}
          {!locked && (
            <button
              onClick={lock}
              className="flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-green-400 ring-1 ring-green-400/20 transition-colors hover:bg-destructive/10 hover:text-red-400 hover:ring-red-400/20"
              title="Lock vault"
              aria-label="Vault unlocked — click to lock"
            >
              <UnlockIcon className="h-3 w-3" />
              Unlocked
            </button>
          )}
          {locked && (
            <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border">
              <LockIcon className="h-3 w-3" />
              Locked
            </span>
          )}

          {/* User email */}
          {user && (
            <span className="hidden text-xs text-muted-foreground md:block truncate max-w-[160px]">
              {user.email}
            </span>
          )}

          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function UnlockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  );
}
