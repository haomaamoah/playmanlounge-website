"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { site } from "@/lib/content";

type Props = {
  mode: "login" | "signup";
  nextPath: string;
};

export function CustomerAuthForm({ mode, nextPath }: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const isSignup = mode === "signup";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const body = isSignup
      ? {
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          phone: String(form.get("phone") ?? ""),
          password: String(form.get("password") ?? ""),
          confirmPassword: String(form.get("confirmPassword") ?? ""),
        }
      : {
          identifier: String(form.get("identifier") ?? ""),
          password: String(form.get("password") ?? ""),
        };
    try {
      const response = await fetch(`/api/customer/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok !== true) {
        setError(data?.error ?? "We could not complete your request. Please try again.");
      } else if (isSignup && data.verificationRequired) {
        setNotice(`Check ${data.email} for a confirmation link, then sign in.`);
      } else {
        router.replace(nextPath);
        router.refresh();
      }
    } catch {
      setError("We could not connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-4.5rem)] w-full max-w-6xl items-center justify-center px-4 py-10 sm:px-6">
      <section className="w-full max-w-xl border border-border bg-white/50 p-6 shadow-sm sm:p-10">
        <Link href="/" className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-cocoa underline underline-offset-4">
          <Image src={site.logo.src} alt="" width={32} height={32} />
          Back to Play Man Lounge
        </Link>
        <p className="text-palm-ink text-xs font-bold tracking-[0.18em] uppercase">Play Man Lounge</p>
        <h1 className="font-display mt-3 text-4xl">{isSignup ? "Create your account" : "Welcome back"}</h1>
        <p className="text-muted-foreground mt-3 leading-relaxed">
          {isSignup ? "Save your details and keep your orders together." : "Sign in to explore the menu and manage your orders."}
        </p>
        <form onSubmit={submit} className="mt-8 space-y-5">
          {isSignup ? (
            <>
              <label className="block">
                <span className="text-sm font-semibold">Full name</span>
                <input name="name" autoComplete="name" required minLength={2} maxLength={100}
                  className="mt-2 min-h-12 w-full border border-border bg-surface px-3" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold">Email</span>
                <input name="email" type="email" autoComplete="email" required maxLength={254}
                  className="mt-2 min-h-12 w-full border border-border bg-surface px-3" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold">Phone number</span>
                <input name="phone" type="tel" autoComplete="tel-national" inputMode="numeric"
                  pattern="[0-9]{10}" minLength={10} maxLength={10} required
                  aria-describedby="phone-help"
                  className="mt-2 min-h-12 w-full border border-border bg-surface px-3" />
                <span id="phone-help" className="text-muted-foreground mt-1 block text-xs">Enter 10 digits without a country code.</span>
              </label>
            </>
          ) : (
            <label className="block">
              <span className="text-sm font-semibold">Email / Phone</span>
              <input name="identifier" autoComplete="username" required
                aria-label="Email or phone number" placeholder="Email / Phone"
                className="mt-2 min-h-12 w-full border border-border bg-surface px-3" />
            </label>
          )}
          <label className="block">
            <span className="text-sm font-semibold">Password</span>
            <input name="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"}
              minLength={isSignup ? 6 : undefined} maxLength={128} required
              className="mt-2 min-h-12 w-full border border-border bg-surface px-3" />
            {isSignup && <span className="text-muted-foreground mt-1 block text-xs">At least 6 characters.</span>}
          </label>
          {isSignup && (
            <label className="block">
              <span className="text-sm font-semibold">Confirm password</span>
              <input name="confirmPassword" type="password" autoComplete="new-password" minLength={6}
                maxLength={128} required className="mt-2 min-h-12 w-full border border-border bg-surface px-3" />
            </label>
          )}
          {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
          {notice && <p role="status" className="text-sm font-medium text-green-800">{notice}</p>}
          <button type="submit" disabled={busy}
            className="bg-cocoa text-cream hover:bg-cocoa-deep inline-flex min-h-12 w-full items-center justify-center px-5 font-semibold disabled:opacity-60">
            {busy ? "Please wait…" : isSignup ? "Create account" : "Log in"}
          </button>
        </form>
        <p className="text-muted-foreground mt-6 text-sm">
          {isSignup ? "Already have an account? " : "New to Play Man Lounge? "}
          <Link className="font-semibold text-cocoa underline underline-offset-4"
            href={isSignup ? `/customer/login?next=${encodeURIComponent(nextPath)}` : `/customer/signup?next=${encodeURIComponent(nextPath)}`}>
            {isSignup ? "Log in" : "Sign up"}
          </Link>
        </p>
      </section>
    </main>
  );
}
