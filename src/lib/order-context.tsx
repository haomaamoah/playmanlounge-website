"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { menu, type MenuItem } from "@/lib/content";

export type CartLine = { item: MenuItem; qty: number };

type OrderContextValue = {
  lines: CartLine[];
  add: (id: string) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  count: number;
  total: number;
  notice: string;
};

const OrderContext = createContext<OrderContextValue | null>(null);

export function OrderProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [notice, setNotice] = useState("");

  const add = useCallback((id: string) => {
    const item = menu.find((m) => m.id === id);
    if (!item) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.item.id === id);
      if (existing) {
        return prev.map((l) =>
          l.item.id === id ? { ...l, qty: l.qty + 1 } : l
        );
      }
      return [...prev, { item, qty: 1 }];
    });
    setNotice(`${item.name} added to your order`);
  }, []);

  const remove = useCallback((id: string) => {
    setLines((prev) => prev.filter((l) => l.item.id !== id));
  }, []);

  const setQty = useCallback((id: string, qty: number) => {
    setLines((prev) => {
      if (qty <= 0) return prev.filter((l) => l.item.id !== id);
      return prev.map((l) => (l.item.id === id ? { ...l, qty } : l));
    });
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    setNotice("Order cleared");
  }, []);

  const count = lines.reduce((n, l) => n + l.qty, 0);
  const total = lines.reduce((n, l) => n + l.qty * l.item.price, 0);

  const value = useMemo(
    () => ({
      lines,
      add,
      remove,
      setQty,
      clear,
      count,
      total,
      notice,
    }),
    [lines, add, remove, setQty, clear, count, total, notice]
  );

  return (
    <OrderContext.Provider value={value}>{children}</OrderContext.Provider>
  );
}

export function useOrder() {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error("useOrder must be used within OrderProvider");
  return ctx;
}
