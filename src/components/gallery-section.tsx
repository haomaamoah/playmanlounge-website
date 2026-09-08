"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { gallery } from "@/lib/content";

export function GallerySection() {
  return (
    <section id="gallery" className="bg-black py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-sm uppercase tracking-[0.28em] text-primary">
          From the stall
        </p>
        <h2 className="font-display mt-3 text-5xl tracking-wide text-white sm:text-7xl">
          Gallery
        </h2>
        <p className="mt-4 max-w-2xl text-zinc-400">
          Photos pulled from the Playman Lounge Google Business listing — the
          real kiosk, the boards, the wood, the orange.
        </p>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gallery.map((shot, i) => (
            <motion.figure
              key={shot.src}
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: i * 0.05, duration: 0.45 }}
              className={`relative overflow-hidden rounded-2xl border border-white/10 ${
                i === 0 ? "sm:col-span-2 lg:col-span-2 lg:row-span-2 min-h-[280px]" : "min-h-[220px]"
              }`}
            >
              <Image
                src={shot.src}
                alt={shot.alt}
                fill
                className="object-cover transition duration-700 hover:scale-105"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-sm uppercase tracking-[0.2em] text-white">
                {shot.caption}
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
