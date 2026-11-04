"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { applyStreamList, type StreamChange } from "@/lib/live/apply";

/** Each portal list asks the server for this many rows, then the next page only when the reader reaches the end. */
export const LIST_PAGE_SIZE = 50;

type Page<T> = { items: T[]; total: number };
type Phase = "loading" | "ready" | "more";
type ListState<T> = { key: string; items: T[]; total: number; error: string; phase: Phase };

type StreamOptions<T> = {
  table: string;
  id: (item: T) => string;
  accept?: (row: Record<string, unknown>) => boolean;
};

export function useInfiniteList<T>(
  queryKey: string,
  load: (offset: number, signal: AbortSignal) => Promise<Page<T>>,
  stream?: StreamOptions<T>,
) {
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
  const replace = useCallback((next: T, idOf: (item: T) => string) => {
    setState((previous) => ({
      ...previous,
      items: previous.items.map((item) => idOf(item) === idOf(next) ? next : item),
    }));
  }, []);
  const upsert = useCallback((next: T, idOf: (item: T) => string) => {
    setState((previous) => {
      const exists = previous.items.some((item) => idOf(item) === idOf(next));
      return {
        ...previous,
        items: exists
          ? previous.items.map((item) => idOf(item) === idOf(next) ? next : item)
          : [next, ...previous.items],
        total: exists ? previous.total : previous.total + 1,
      };
    });
  }, []);
  const remove = useCallback((id: string, idOf: (item: T) => string) => {
    setState((previous) => {
      if (!previous.items.some((item) => idOf(item) === id)) return previous;
      return {
        ...previous,
        items: previous.items.filter((item) => idOf(item) !== id),
        total: Math.max(0, previous.total - 1),
      };
    });
  }, []);
  const streamRef = useRef(stream);
  useEffect(() => { streamRef.current = stream; });

  useEffect(() => {
    const onStream = (event: Event) => {
      const spec = streamRef.current;
      const change = (event as CustomEvent<StreamChange>).detail;
      if (!spec || change.table !== spec.table) return;
      setState((previous) => {
        if (previous.phase === "loading") return previous;
        const applied = applyStreamList(previous.items, previous.total, change, spec.id, spec.accept);
        return { ...previous, items: applied.items, total: applied.total };
      });
    };
    window.addEventListener("pml-stream", onStream);
    return () => window.removeEventListener("pml-stream", onStream);
  }, []);

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
    replace,
    upsert,
    remove,
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
