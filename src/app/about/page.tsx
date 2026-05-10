"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/features/site-header";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader linkTitle />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Hero */}
        <section className="text-center mb-10 sm:mb-12">
          <p className="text-sm font-serif text-primary uppercase tracking-widest mb-3">
            About
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">
            The story behind this site
          </h1>
        </section>

        {/* Story */}
        <article className="space-y-5 text-foreground/90 leading-relaxed">
          <p>
            Last year in Cannes, I had almost no time to get to the French
            pharmacies.
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
            told her to push that week. I bought it. I had no time to research,
            no signal to filter, no objective second opinion. Some of those
            products I loved. Some I regretted. A few I&apos;m pretty sure I gave
            away.
          </p>
          <p>
            That week, I had the same conversation with five or six different
            women. Different jobs, different ages, different reasons they were in
            Cannes. Same problem. Everyone wanted a smarter way to do this.
          </p>
          <p>There wasn&apos;t one.</p>
          <p>
            There were TikToks, scattered. There were pharmacy reps, biased.
            There were forums, dated. There was no single, calm, objective place
            to do your research before you got on the plane.
          </p>
          <p>So I started building it last summer.</p>
          <p>
            I paused for a while. Life. Work. The usual. But I&apos;m headed back
            to Cannes this year, and I figured: if I&apos;m going to use this
            thing, my entire network might as well use it too.
          </p>

          <h2 className="font-serif text-2xl font-semibold pt-6">What this is</h2>
          <p>
            A clean database of French pharmacy beauty products: ingredients,
            what they actually do, what they&apos;re best for, what they cost,
            where to find them, and what&apos;s worth your suitcase space.
          </p>
          <p>
            The selections are independent. No brand has paid to be here, and no
            brand has any say in what makes the list or how it&apos;s described.
          </p>
          <p>
            Some product links are affiliate links. They are there for one reason:
            convenience. If you find something you want, you can buy it in one
            click instead of hunting for it somewhere else. If you do, I might
            earn a small commission at no cost to you. The recommendations
            don&apos;t change either way.
          </p>
          <p>
            The point is speed and clarity. You walk into a French pharmacy with
            a short list. You know exactly what you&apos;re after. You leave with
            the things you&apos;ll still be using in six months, not the things
            you bought because someone behind a counter said you should.
          </p>

          <h2 className="font-serif text-2xl font-semibold pt-6">Who it&apos;s for</h2>
          <p>
            Women going to Cannes who&apos;d rather not waste an afternoon on a
            wrong guess. Men shopping for the women in their lives. Anyone
            heading to France this summer who wants to bring back the good stuff,
            not just the popular stuff.
          </p>
          <p>
            If you&apos;re the kind of person who designs your trip the way you
            design the rest of your life: fewer choices, better ones. This is
            built for you.
          </p>

          <h2 className="font-serif text-2xl font-semibold pt-6">Why I&apos;m sharing it now</h2>
          <p>
            When something doesn&apos;t exist the way you need it, you build it.
            Then you share it.
          </p>
          <p>
            Use it before you go. Tell me what&apos;s missing. I&apos;m still
            adding.
          </p>

          <p className="font-serif text-xl pt-4">Jen</p>
        </article>

        {/* CTA */}
        <section className="mt-12 text-center">
          <Link href="/">
            <Button size="lg" className="rounded-full">
              Browse the catalog
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </section>

        {/* Disclaimer */}
        <footer className="mt-16 pt-8 border-t border-stone text-center">
          <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
            Prices are approximate and may vary by pharmacy. Product availability
            changes; check with the pharmacy. Not medical advice; consult a
            dermatologist for skin concerns.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto mt-4">
            Some links on this site are affiliate links. If you buy through them,
            I may earn a small commission at no extra cost to you.
          </p>
          <p className="text-xs text-muted-foreground mt-4">
            &copy; 2026 Pharmacie Beauty. Built by Jennifer Kattula.
          </p>
        </footer>
      </main>
    </div>
  );
}
