import Image from "next/image";
import { team } from "@/lib/content";
import { asset } from "@/lib/asset";

export function TeamSection() {
  return (
    <section id="team" aria-labelledby="team-heading" className="bg-surface py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 id="team-heading" className="font-display text-4xl sm:text-5xl">
          Meet The Team
        </h2>
        <p className="text-muted-foreground mt-3 max-w-xl text-base">
          Two people keep Play Man Lounge moving: the kitchen, and the inbox.
        </p>
        <ul className="mt-10 grid gap-10 md:grid-cols-2">
          {team.map((person) => (
            <li key={person.id} className="flex flex-col gap-4 sm:flex-row sm:gap-6">
              <Image
                src={asset(person.image)}
                alt={`Portrait of ${person.name}`}
                width={person.width}
                height={person.height}
                className="aspect-square w-full max-w-48 object-cover"
              />
              <div>
                <h3 className="font-display text-3xl">{person.name}</h3>
                <p className="text-gold mt-1 font-medium">{person.title}</p>
                <p className="mt-3 text-base leading-relaxed">{person.bio}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
