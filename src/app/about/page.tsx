import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | Spotted",
  description:
    "Spotted helps UK fashion fans find shoppable alternatives to celebrity outfits — without the designer price tag.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative bg-primary text-primary-foreground texture-grain py-20 px-4 overflow-hidden">
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-64 w-[32rem] rounded-full bg-clay/15 blur-3xl" />
        <div className="relative mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold tracking-[0.3em] text-primary-foreground/50 uppercase mb-4">
            About Us
          </p>
          <h1 className="font-serif italic text-6xl sm:text-7xl tracking-tight mb-5 leading-none">
            Spotted
          </h1>
          <p className="text-primary-foreground/70 text-base sm:text-lg leading-relaxed max-w-lg mx-auto">
            We help UK fashion fans find shoppable alternatives to celebrity
            outfits — without the designer price tag.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 px-4">
        <div className="mx-auto max-w-2xl">
          <h2 className="font-serif italic text-3xl tracking-tight mb-5">What we do</h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              Every day, millions of people spot an outfit they love on a
              celebrity — and then spend hours trying to track down where to buy
              it. Spotted does that work for you.
            </p>
            <p>
              We track what UK celebrities are wearing, identify each clothing
              item, and curate shoppable alternatives across every price point —
              from budget-friendly high-street finds to premium investment pieces
              that match the original.
            </p>
            <p>
              Whether you want the exact item or an inspired-by dupe, Spotted
              gives you options.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4 bg-secondary/40 border-y border-border">
        <div className="mx-auto max-w-2xl">
          <h2 className="font-serif italic text-3xl tracking-tight mb-8">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                step: "1",
                title: "We spot the look",
                desc: "Our team tracks celebrity outfits across the UK and beyond.",
              },
              {
                step: "2",
                title: "We identify items",
                desc: "Each piece of clothing is tagged — category, colour, brand if known.",
              },
              {
                step: "3",
                title: "You shop for less",
                desc: "Browse budget, mid-range, and premium alternatives — all in one place.",
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col">
                <div className="w-10 h-10 rounded-full bg-clay-soft text-clay flex items-center justify-center text-lg font-serif italic mb-4">
                  {step}
                </div>
                <h3 className="font-bold mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Affiliate disclosure */}
      <section className="py-16 px-4">
        <div className="mx-auto max-w-2xl">
          <h2 className="font-serif italic text-3xl tracking-tight mb-4">A note on affiliate links</h2>
          <p className="text-muted-foreground leading-relaxed">
            Some product links on Spotted are affiliate links — if you click and
            buy, we may earn a small commission at no extra cost to you. This
            helps us keep the site free. We only link to products we genuinely
            think are good matches, and affiliate relationships never influence
            which items we feature.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-16 px-4 bg-primary text-primary-foreground texture-grain overflow-hidden">
        <div className="relative mx-auto max-w-md text-center">
          <h2 className="font-serif italic text-3xl sm:text-4xl tracking-tight mb-3">
            Start shopping smarter
          </h2>
          <p className="text-primary-foreground/60 text-sm mb-8">
            Browse celebrity looks and find your perfect match — at a price that
            works for you.
          </p>
          <Link
            href="/"
            className="inline-block bg-clay text-clay-foreground font-semibold px-6 py-3 rounded-full hover:bg-clay/90 transition-colors"
          >
            Browse looks
          </Link>
        </div>
      </section>
    </div>
  );
}
