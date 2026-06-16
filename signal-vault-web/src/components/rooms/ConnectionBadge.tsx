"use client";

import type { ConnectionStatus } from "@/lib/realtime/useRoomConnection";
import { clsx } from "clsx";

const STATUS_CONFIG: Record<
  ConnectionStatus,
  { label: string; dotClass: string; badgeClass: string }
> = {
  connecting: {
    label: "Connecting",
    dotClass: "bg-warning animate-pulse",
    badgeClass: "bg-warning/10 text-yellow-400 ring-warning/20",
  },
  connected: {
    label: "Connected",
    dotClass: "bg-success",
    badgeClass: "bg-success/10 text-green-400 ring-green-400/20",
  },
  reconnecting: {
    label: "Reconnecting",
    dotClass: "bg-warning animate-ping",
    badgeClass: "bg-warning/10 text-yellow-400 ring-warning/20",
  },
  disconnected: {
    label: "Disconnected",
    dotClass: "bg-muted-foreground",
    badgeClass: "bg-muted text-muted-foreground ring-border",
  },
};

interface ConnectionBadgeProps {
  status: ConnectionStatus;
  className?: string;
}

export function ConnectionBadge({ status, className }: ConnectionBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      role="status"
      aria-label={`WebSocket status: ${config.label}`}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1",
        config.badgeClass,
        className
      )}
    >
      <span
        className={clsx("h-1.5 w-1.5 rounded-full", config.dotClass)}
        aria-hidden="true"
      />
      {config.label}
    </span>
  );
}
