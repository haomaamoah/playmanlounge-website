"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { site } from "@/lib/content";
import { STAFF_PIN } from "@/lib/mocks/seed";
import { useMockStore } from "@/lib/mocks/store";

export function LoginView() {
  const router = useRouter();
  const { login } = useMockStore();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (login(pin)) {
      router.replace("/admin/orders");
      return;
    }
    setError("That PIN does not open the desk.");
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-16">
      <Image
        src={site.logo.src}
        alt=""
        width={72}
        height={72}
        className="size-16 object-contain"
      />
      <h1 className="font-display mt-6 text-4xl text-cream">Kitchen desk</h1>
      <p className="mt-3 text-base leading-relaxed text-cream/80">
        Staff preview only. No real login. PIN for this UI is{" "}
        <span className="font-semibold text-gold">{STAFF_PIN}</span>.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block">
          <span className="text-sm text-cream/80">PIN</span>
          <input
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
            className="mt-2 h-12 w-full border border-cream/30 bg-cocoa-deep px-3 text-lg tracking-[0.4em] text-cream"
          />
        </label>
        {error ? (
          <p className="text-gold text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="bg-palm text-cream hover:bg-palm/90 inline-flex min-h-12 w-full items-center justify-center font-semibold"
        >
          Open the board
        </button>
      </form>
    </div>
  );
}
