"use client";

import { motion } from "framer-motion";
import { ArrowDown, MapPin, Star } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { GeometricField } from "@/components/geometric-field";
import { site } from "@/lib/content";
import { useOrder } from "@/components/order-context";

export function Hero() {
  const { setCartOpen } = useOrder();

  return (
    <section
      id="top"
      className="relative isolate min-h-[100svh] overflow-hidden bg-black pt-16"
    >
      <Image
        src="/media/kiosk-hero.png"
        alt="Playman Lounge kiosk at night"
        fill
        priority
        className="object-cover object-center opacity-45"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/30" />
      <GeometricField />
      <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-6xl flex-col justify-end px-4 pb-16 sm:px-6 lg:justify-center">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-4 flex items-center gap-2 text-sm uppercase tracking-[0.28em] text-primary"
        >
          <Star className="size-3.5 fill-primary text-primary" />
          {site.rating} on Google · Kaneshie, Accra
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.08 }}
          className="font-display text-[clamp(3.4rem,12vw,8.5rem)] leading-[0.85] tracking-[0.06em] text-white"
        >
          PLAYMAN
          <span className="block text-primary">LOUNGE</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="font-script mt-4 text-4xl text-white/90 sm:text-5xl"
        >
          {site.tagline}
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="mt-6 max-w-xl text-base leading-relaxed text-zinc-300 sm:text-lg"
        >
          {site.blurb}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <Button
            size="lg"
            className="h-12 rounded-full px-7 text-base"
            onClick={() => {
              setCartOpen(true);
              document.getElementById("menu")?.scrollIntoView({
                behavior: "smooth",
              });
            }}
          >
            Order now
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 rounded-full border-white/20 bg-black/30 px-7 text-base text-white hover:bg-white/10 hover:text-white"
            render={<a href="#visit" />}
          >
            <MapPin data-icon="inline-start" />
            Find the kiosk
          </Button>
        </motion.div>
        <a
          href="#menu"
          className="mt-14 inline-flex w-fit items-center gap-2 text-xs uppercase tracking-[0.3em] text-zinc-400 transition hover:text-primary"
        >
          Scroll the menu
          <ArrowDown className="size-3.5 animate-bounce" />
        </a>
      </div>
    </section>
  );
}
