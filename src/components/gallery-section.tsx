"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { gallery } from "@/lib/content";

export function GallerySection() {
  const [active, setActive] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (active === null) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  const item = active !== null ? gallery[active] : null;

  return (
    <section
      id="gallery"
      aria-labelledby="gallery-heading"
      className="bg-card py-16 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 id="gallery-heading" className="font-display text-4xl sm:text-5xl">
          Gallery
        </h2>
        <p className="text-muted-foreground mt-3 max-w-xl text-base">
          The kitchen hub, the wok, the packs. Tap a photo to enlarge it.
        </p>
        <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {gallery.map((photo, index) => (
            <li
              key={photo.src}
              className={index === 0 ? "col-span-2 sm:col-span-2 sm:row-span-2" : ""}
            >
              <button
                type="button"
                onClick={() => setActive(index)}
                className="block w-full cursor-pointer overflow-hidden"
              >
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  width={photo.width}
                  height={photo.height}
                  className={`w-full object-cover ${index === 0 ? "aspect-4/3 sm:aspect-square" : "aspect-4/3"}`}
                />
              </button>
            </li>
          ))}
        </ul>
      </div>
      {item && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-cocoa/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lightbox-title"
          onClick={() => setActive(null)}
        >
          <button
            ref={closeRef}
            type="button"
            className="bg-cream text-cocoa absolute top-4 right-4 inline-flex min-h-11 min-w-11 items-center justify-center"
            onClick={() => setActive(null)}
          >
            <X className="size-5" aria-hidden="true" />
            <span className="sr-only">Close photograph</span>
          </button>
          <figure
            className="max-h-[90svh] max-w-5xl"
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              src={item.src}
              alt=""
              width={item.width}
              height={item.height}
              className="max-h-[80svh] w-auto object-contain"
            />
            <figcaption id="lightbox-title" className="text-cream mt-3 text-sm">
              {item.alt}
            </figcaption>
          </figure>
        </div>
      )}
    </section>
  );
}
