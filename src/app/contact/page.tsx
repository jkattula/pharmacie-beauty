"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/features/site-header";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="max-w-2xl mx-auto px-s-4 sm:px-s-5 lg:px-s-7 py-s-8 sm:py-s-9">
        {/* Hero */}
        <section className="text-center mb-s-5">
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-ink leading-[1.1]">
            Get in touch
          </h1>
        </section>

        {/* Body */}
        <article className="space-y-s-5 font-serif text-[17px] text-ink leading-[1.55] text-center">
          <p>
            Built by{" "}
            <span className="font-script text-2xl align-baseline lowercase">jennifer kattula</span>.
          </p>
          <p>
            Found something missing, or have a product I should add? I&apos;d
            love to hear from you.
          </p>
          <p>
            <a
              href="mailto:jkattula@gmail.com"
              className="underline decoration-ink3/40 underline-offset-2 hover:decoration-ink"
            >
              jkattula@gmail.com
            </a>
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
