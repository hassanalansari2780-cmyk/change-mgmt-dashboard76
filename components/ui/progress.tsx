"use client";

import * as React from "react";
import { clsx } from "clsx";

export interface ProgressProps
  extends React.HTMLAttributes<HTMLDivElement> {
  value?: number; // 0–100
}

export function Progress({
  value = 0,
  className,
  ...props
}: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value ?? 0));

  return (
    <div
      className={clsx(
        "relative w-full h-2 overflow-hidden rounded-full bg-muted",
        className,
      )}
      {...props}
    >
      <div
        className="h-full bg-emerald-600 transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
