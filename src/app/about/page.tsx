"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/features/site-header";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="max-w-2xl mx-auto px-s-4 sm:px-s-5 lg:px-s-7 py-s-8 sm:py-s-9">
        {/* Hero */}
        <section className="text-center mb-s-5">
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-ink leading-[1.1]">
            The story behind
            <br />
            <span className="font-script font-normal align-baseline">pharmacie beauty</span>
          </h1>
        </section>

        {/* Story */}
        <article className="space-y-s-5 font-serif text-[17px] text-ink leading-[1.55]">
          <p>
            Last June in Cannes, I had a long list, almost no time, and no real
            way to know what was worth it.
          </p>
          <p>
            You know the drill. Every woman who goes to Cannes wants the same
            thing: formulations you can&apos;t get in the U.S., usually less
            expensive, often something a French woman has been quietly using for
            thirty years. The plan was simple. The trip was not.
          </p>
          <p>
            When I finally made it inside a pharmacy, the woman behind the counter
            was warm, helpful, and pointing me toward whatever the brand reps had
            told her to push that week. 300 Euros later, I packed my bags with an
            uncurated bundle of products that I may or may not have been able to
            procure in the United States.
          </p>
          <p>
            That week, I had the same conversation with five or six different
            women on the Croisette. Different jobs, different ages, different
            reasons they were in Cannes. Same problem. Everyone wanted a smarter
            way to do this.
          </p>
          <p>
            There wasn&apos;t one. It all lived in my head from the various
            Instagram and TikTok influencers that I follow, as well as my
            BELOVED Underground Beauty Parlor teams group at work.
          </p>
          <p>So I started building one last summer.</p>
          <p>
            Then I paused. Life. Work. The usual. But I&apos;m headed back to
            Cannes this June, and I figured that if I&apos;m going to use this
            thing, my network might as well use it with me.
          </p>

          <h2 className="font-serif text-2xl text-ink pt-s-5 font-medium">What this is</h2>
          <p>
            A clean database of French pharmacy beauty products: ingredients,
            what they actually do, what they&apos;re best for, what they cost,
            where to find them, and what&apos;s worth your suitcase space.
          </p>
          <p>
            It&apos;s not a shopping list. It&apos;s a filter — for the
            half-hour you&apos;ll have between meetings to grab the things you
            actually want.
          </p>
          <p>
            The point is speed and clarity. You walk into a French pharmacy with
            a short list. You know exactly what you&apos;re after. You leave with
            the things you&apos;ll still be using in six months, not the things
            you bought because someone behind a counter said you should.
          </p>

          <h2 className="font-serif text-2xl text-ink pt-s-5 font-medium">Who it&apos;s for</h2>
          <p>
            Beauty junkies going to Cannes who&apos;d rather not waste an
            afternoon on a wrong guess. Anyone heading to France this summer
            who wants to bring back the good stuff, not just the popular stuff.
          </p>
          <p>
            If you&apos;re the kind of person who designs your trip the way you
            design the rest of your life — fewer choices, better ones — this is
            built for you.
          </p>

          <h2 className="font-serif text-2xl text-ink pt-s-5 font-medium">Why I&apos;m sharing it now</h2>
          <p>
            When something doesn&apos;t exist the way you need it, you build it.
            Then you share it.
          </p>
          <p>
            Use it before you go. Tell me what&apos;s missing. I&apos;m still
            adding.
          </p>

          <p className="font-script text-3xl pt-s-4 text-ink">Jen</p>

          <h2 className="font-serif text-2xl text-ink pt-s-6 font-medium">With thanks</h2>
          <p>
            To <span className="italic">Sherry Phillips</span> and{" "}
            <span className="italic">Claire Heidenreich</span> at Forbes —
            this idea started on the Croisette last June with the two of you.
            You took a vague frustration of mine and turned it into a &ldquo;you
            should actually build this.&rdquo; Here it is.
          </p>
          <p>
            The <span className="italic">Interlope</span> typeface in the logo is
            by{" "}
            <a
              href="https://velvetyne.fr/fonts/interlope/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-ink3/40 underline-offset-2 hover:decoration-ink"
            >
              Velvetyne
            </a>
            , a beautiful open-source type foundry. Free to use, generous by
            design — exactly the kind of thing the internet should make more of.
          </p>
        </article>

        {/* CTA */}
        <section className="mt-s-9 text-center">
          <Link href="/">
            <Button size="lg">
              Browse the catalog
              <ArrowRight className="ml-s-2 h-4 w-4" />
            </Button>
          </Link>
        </section>
      </main>
    </div>
  );
}
