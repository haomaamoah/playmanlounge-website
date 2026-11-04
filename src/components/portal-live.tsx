"use client";

import { useEffect } from "react";
import type { StreamChange } from "@/lib/live/apply";
import type { LivePortal } from "@/lib/live/changes";

/** Subscribes the portal to database changes and hands each emission to the widgets that are listening. */
export function PortalLive({ portal }: { portal: LivePortal }) {
  useEffect(() => {
    const source = new EventSource(`/api/stream?portal=${portal}`);
    source.onmessage = (event) => {
      const change = JSON.parse(event.data) as StreamChange;
      if (!change?.table || !change.event) return;
      window.dispatchEvent(new CustomEvent<StreamChange>("pml-stream", { detail: change }));
    };
    return () => source.close();
  }, [portal]);
  return null;
}
