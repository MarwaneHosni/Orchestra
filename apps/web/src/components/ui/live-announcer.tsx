"use client";

import { useEffect, useState } from "react";

interface LiveAnnouncerProps {
  message: string;
  priority?: "polite" | "assertive";
  clearAfter?: number;
}

export function LiveAnnouncer({ message, priority = "polite", clearAfter = 4000 }: LiveAnnouncerProps) {
  const [active, setActive] = useState("");

  useEffect(() => {
    if (!message) return;
    setActive(message);
    const t = setTimeout(() => setActive(""), clearAfter);
    return () => clearTimeout(t);
  }, [message, clearAfter]);

  return (
    <div role="status" aria-live={priority} aria-atomic="true" className="sr-only">
      {active}
    </div>
  );
}
