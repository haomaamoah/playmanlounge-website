"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { LivePortal } from "@/lib/live/changes";

/** Keeps the open portal in step with the database. Lists refetch; server pages refresh. */
export function PortalLive({ portal }: { portal: LivePortal }) {
  const router = useRouter();
  useEffect(() => {
    const source = new EventSource(`/api/stream?portal=${portal}`);
    let timer = 0;
    source.onmessage = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        window.dispatchEvent(new Event("pml-db-change"));
        router.refresh();
      }, 400);
    };
    return () => {
      window.clearTimeout(timer);
      source.close();
    };
  }, [portal, router]);
  return null;
}
