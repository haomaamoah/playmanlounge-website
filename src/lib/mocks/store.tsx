"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { menu, pesewas, type MenuItem } from "@/lib/content";
import { newIds, nextStatus, seedState, STAFF_PIN } from "./seed";
import type {
  BagLine,
  MenuOverride,
  MockState,
  MomoNetwork,
  Order,
  OrderLine,
  OrderStatus,
} from "./types";

const STORAGE_KEY = "pml-ops-mock-v1";

function cloneSeed(): MockState {
  return structuredClone(seedState);
}

function readStorage(): MockState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MockState;
    if (!Array.isArray(parsed.orders) || !Array.isArray(parsed.payments)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage(state: MockState) {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function linesFromBag(bag: BagLine[]): OrderLine[] {
  return bag.flatMap((entry) => {
    const item = menu.find((candidate) => candidate.id === entry.itemId);
    if (!item || entry.qty <= 0) return [];
    return [
      {
        itemId: item.id,
        name: item.name,
        qty: entry.qty,
        unitPrice: item.price,
        image: item.image,
      },
    ];
  });
}

type MockStoreValue = {
  ready: boolean;
  orders: Order[];
  payments: MockState["payments"];
  menuOverrides: Record<string, MenuOverride>;
  bag: BagLine[];
  bagNotes: string;
  staffAuthed: boolean;
  bagCount: number;
  bagTotal: number;
  resolvedMenu: MenuItem[];
  login: (pin: string) => boolean;
  logout: () => void;
  addToBag: (itemId: string) => void;
  setBagQty: (itemId: string, qty: number) => void;
  setBagNotes: (notes: string) => void;
  clearBag: () => void;
  placeMockOrder: (input: {
    customerName: string;
    customerPhone: string;
    deliveryArea: string;
    network: MomoNetwork;
  }) => Order | null;
  setOrderStatus: (orderId: string, status: OrderStatus) => void;
  advanceOrder: (orderId: string) => void;
  patchMenu: (itemId: string, patch: MenuOverride) => void;
};

const MockStoreContext = createContext<MockStoreValue | null>(null);

export function MockStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MockState>(cloneSeed);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStorage();
    if (stored) {
      // Hydrate from this tab's session after SSR; not a reactive external store.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage bootstrap
      setState(stored);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    writeStorage(state);
  }, [ready, state]);

  const update = useCallback((recipe: (prev: MockState) => MockState) => {
    setState((prev) => recipe(prev));
  }, []);

  const login = useCallback((pin: string) => {
    const ok = pin.trim() === STAFF_PIN;
    if (ok) {
      flushSync(() => {
        update((prev) => ({ ...prev, staffAuthed: true }));
      });
    }
    return ok;
  }, [update]);

  const logout = useCallback(() => {
    update((prev) => ({ ...prev, staffAuthed: false }));
  }, [update]);

  const addToBag = useCallback((itemId: string) => {
    const item = menu.find((entry) => entry.id === itemId);
    if (!item) return;
    update((prev) => {
      const soldOut = prev.menuOverrides[itemId]?.soldOut;
      if (soldOut) return prev;
      const existing = prev.bag.find((line) => line.itemId === itemId);
      const bag = existing
        ? prev.bag.map((line) =>
            line.itemId === itemId ? { ...line, qty: line.qty + 1 } : line
          )
        : [...prev.bag, { itemId, qty: 1 }];
      return { ...prev, bag };
    });
  }, [update]);

  const setBagQty = useCallback((itemId: string, qty: number) => {
    update((prev) => {
      const bag =
        qty <= 0
          ? prev.bag.filter((line) => line.itemId !== itemId)
          : prev.bag.map((line) =>
              line.itemId === itemId ? { ...line, qty } : line
            );
      return { ...prev, bag };
    });
  }, [update]);

  const setBagNotes = useCallback((notes: string) => {
    update((prev) => ({ ...prev, bagNotes: notes }));
  }, [update]);

  const clearBag = useCallback(() => {
    update((prev) => ({ ...prev, bag: [], bagNotes: "" }));
  }, [update]);

  const placeMockOrder = useCallback(
    (input: {
      customerName: string;
      customerPhone: string;
      deliveryArea: string;
      network: MomoNetwork;
    }) => {
      const ids = newIds();
      const createdAt = new Date().toISOString();
      const box: { order: Order | null } = { order: null };
      flushSync(() => {
        update((prev) => {
        const orderLines = linesFromBag(prev.bag).map((entry) => {
          const override = prev.menuOverrides[entry.itemId];
          return {
            ...entry,
            name: override?.name ?? entry.name,
            unitPrice: override?.price ?? entry.unitPrice,
          };
        });
        if (orderLines.length === 0) return prev;
        if (prev.orders.some((entry) => entry.id === ids.orderId)) return prev;
        const total =
          pesewas(
            orderLines.reduce((sum, entry) => sum + entry.qty * entry.unitPrice, 0)
          ) / 100;
        const isKitchenTest = orderLines.every(
          (entry) => entry.itemId === "kitchen-test"
        );
        const created: Order = {
          id: ids.orderId,
          createdAt,
          customerName: input.customerName.trim(),
          customerPhone: input.customerPhone.trim(),
          deliveryArea: input.deliveryArea,
          notes: prev.bagNotes.trim(),
          lines: orderLines,
          total,
          status: "paid",
          paymentId: ids.paymentId,
        };
        box.order = created;
        return {
          ...prev,
          bag: [],
          bagNotes: "",
          orders: [created, ...prev.orders],
          payments: [
            {
              id: ids.paymentId,
              orderId: ids.orderId,
              status: "paid",
              network: input.network,
              reference: ids.reference,
              amount: total,
              isKitchenTest,
              createdAt,
            },
            ...prev.payments,
          ],
        };
        });
      });
      return box.order;
    },
    [update]
  );

  const setOrderStatus = useCallback((orderId: string, status: OrderStatus) => {
    update((prev) => ({
      ...prev,
      orders: prev.orders.map((order) =>
        order.id === orderId ? { ...order, status } : order
      ),
    }));
  }, [update]);

  const advanceOrder = useCallback((orderId: string) => {
    update((prev) => ({
      ...prev,
      orders: prev.orders.map((order) => {
        if (order.id !== orderId) return order;
        const upcoming = nextStatus(order.status);
        return upcoming ? { ...order, status: upcoming } : order;
      }),
    }));
  }, [update]);

  const patchMenu = useCallback((itemId: string, patch: MenuOverride) => {
    update((prev) => ({
      ...prev,
      menuOverrides: {
        ...prev.menuOverrides,
        [itemId]: { ...prev.menuOverrides[itemId], ...patch },
      },
    }));
  }, [update]);

  const bagCount = state.bag.reduce((sum, line) => sum + line.qty, 0);
  const bagTotal =
    pesewas(
      state.bag.reduce((sum, line) => {
        const item = menu.find((entry) => entry.id === line.itemId);
        const price = state.menuOverrides[line.itemId]?.price ?? item?.price ?? 0;
        return sum + line.qty * price;
      }, 0)
    ) / 100;

  const resolvedMenu = useMemo(
    () =>
      menu.map((item) => {
        const override = state.menuOverrides[item.id];
        if (!override) return item;
        return {
          ...item,
          name: override.name ?? item.name,
          price: override.price ?? item.price,
        };
      }),
    [state.menuOverrides]
  );

  const value = useMemo<MockStoreValue>(
    () => ({
      ready,
      orders: state.orders,
      payments: state.payments,
      menuOverrides: state.menuOverrides,
      bag: state.bag,
      bagNotes: state.bagNotes,
      staffAuthed: state.staffAuthed,
      bagCount,
      bagTotal,
      resolvedMenu,
      login,
      logout,
      addToBag,
      setBagQty,
      setBagNotes,
      clearBag,
      placeMockOrder,
      setOrderStatus,
      advanceOrder,
      patchMenu,
    }),
    [
      ready,
      state,
      bagCount,
      bagTotal,
      resolvedMenu,
      login,
      logout,
      addToBag,
      setBagQty,
      setBagNotes,
      clearBag,
      placeMockOrder,
      setOrderStatus,
      advanceOrder,
      patchMenu,
    ]
  );

  return (
    <MockStoreContext.Provider value={value}>{children}</MockStoreContext.Provider>
  );
}

export function useMockStore() {
  const ctx = useContext(MockStoreContext);
  if (!ctx) throw new Error("useMockStore must be used within MockStoreProvider");
  return ctx;
}

export function useMenuItem(id: string) {
  const { resolvedMenu, menuOverrides } = useMockStore();
  const item = resolvedMenu.find((entry) => entry.id === id);
  return {
    item,
    soldOut: Boolean(menuOverrides[id]?.soldOut),
  };
}
