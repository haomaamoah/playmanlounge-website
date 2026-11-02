"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/** Each portal list asks the server for this many rows, then the next page only when the reader reaches the end. */
export const LIST_PAGE_SIZE = 50;

type Page<T> = { items: T[]; total: number };
type Phase = "loading" | "ready" | "more";
type ListState<T> = { key: string; items: T[]; total: number; error: string; phase: Phase };

export function useInfiniteList<T>(queryKey: string, load: (offset: number, signal: AbortSignal) => Promise<Page<T>>) {
  const loadRef = useRef(load);
  const [tick, setTick] = useState(0);
  const requestKey = `${queryKey}:${tick}`;
  const [state, setState] = useState<ListState<T>>({ key: requestKey, items: [], total: 0, error: "", phase: "loading" });
  const seen = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const current = state.key === requestKey ? state : { key: requestKey, items: [] as T[], total: 0, error: "", phase: "loading" as const };

  if (state.key !== requestKey) setState(current);

  useEffect(() => { loadRef.current = load; });

  const reload = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    if (current.phase !== "loading") return;
    const id = ++generation.current;
    seen.current = 0;
    const controller = new AbortController();
    loadRef.current(0, controller.signal).then((page) => {
      if (id !== generation.current) return;
      seen.current = page.items.length;
      setState({ key: requestKey, items: page.items, total: page.total, error: "", phase: "ready" });
    }).catch((reason: Error) => {
      if (controller.signal.aborted || id !== generation.current) return;
      seen.current = 0;
      setState({ key: requestKey, items: [], total: 0, error: reason.message || "Could not load records.", phase: "ready" });
    });
    return () => controller.abort();
  }, [current.phase, requestKey]);

  const hasMore = current.phase !== "loading" && current.items.length < current.total;

  useEffect(() => {
    const node = sentinel.current;
    if (!node || current.phase !== "ready" || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      if (seen.current >= current.total) return;
      const id = generation.current;
      const offset = seen.current;
      setState((previous) => previous.key === requestKey ? { ...previous, phase: "more" } : previous);
      const controller = new AbortController();
      loadRef.current(offset, controller.signal).then((page) => {
        if (id !== generation.current) return;
        seen.current = page.items.length ? offset + page.items.length : page.total;
        setState((previous) => previous.key === requestKey ? {
          ...previous,
          items: page.items.length ? [...previous.items, ...page.items] : previous.items,
          total: page.total,
          phase: "ready",
        } : previous);
      }).catch((reason: Error) => {
        if (controller.signal.aborted || id !== generation.current) return;
        setState((previous) => previous.key === requestKey ? { ...previous, error: reason.message || "Could not load more records.", phase: "ready" } : previous);
      });
    }, { rootMargin: "240px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [current.phase, current.total, hasMore, requestKey]);

  return {
    items: current.items,
    total: current.total,
    error: current.error,
    loading: current.phase === "loading",
    loadingMore: current.phase === "more",
    reload,
    sentinel,
    hasMore,
  };
}

export function InfiniteScroll({
  sentinel,
  loadingMore,
}: {
  sentinel: RefObject<HTMLDivElement | null>;
  loadingMore: boolean;
}) {
  return <div ref={sentinel} className="min-h-px">
    {loadingMore && <p role="status" className="text-muted-foreground py-4 text-sm">Loading more…</p>}
  </div>;
}
