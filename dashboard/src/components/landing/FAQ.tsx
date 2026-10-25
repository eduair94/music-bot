"use client";

import { faqs } from "@/data/faq";
import Link from "next/link";
import { useId, useState } from "react";
import { FaDiscord } from "react-icons/fa";

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const baseId = useId();

  return (
    <section id="faq" className="py-24 lg:py-32" aria-labelledby="faq-title">
      <div className="shell grid gap-x-8 gap-y-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <h2
              id="faq-title"
              className="font-display font-bold text-cream text-4xl sm:text-5xl lg:text-[3.5rem] leading-[1.02] tracking-[-0.03em] text-balance"
            >
              Questions, answered.
            </h2>
            <p className="mt-5 max-w-[24rem] text-lg text-dune leading-relaxed text-pretty">
              Everything server owners ask before hitting play.
            </p>

            <Link
              href="/support"
              prefetch={false}
              className="mt-8 inline-flex h-11 items-center gap-2 rounded-lg border border-line-strong px-5 text-sm font-semibold text-cream transition-colors hover:border-amber/60"
            >
              <FaDiscord className="h-4 w-4 text-amber" aria-hidden="true" />
              Join the support server
            </Link>
          </div>
        </div>

        <ul className="lg:col-span-8 border-b border-line" role="list">
          {faqs.map((faq, index) => {
            const open = openIndex === index;
            const buttonId = `${baseId}-q${index}`;
            const panelId = `${baseId}-a${index}`;
            return (
              <li key={faq.question} className="border-t border-line">
                <h3 className="m-0">
                  <button
                    id={buttonId}
                    type="button"
                    onClick={() => setOpenIndex(open ? null : index)}
                    aria-expanded={open}
                    aria-controls={panelId}
                    className="group flex w-full items-start justify-between gap-6 py-6 text-left text-lg font-medium text-cream"
                  >
                    <span className="transition-colors group-hover:text-amber-hot">{faq.question}</span>
                    <svg
                      className={`mt-1 h-5 w-5 shrink-0 transition-transform duration-300 ${
                        open ? "rotate-45 text-amber" : "text-dust"
                      }`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className="disclosure"
                  data-open={open}
                  inert={!open}
                >
                  <div>
                    <p className="max-w-[62ch] pb-7 pr-11 text-dune leading-relaxed text-pretty">{faq.answer}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
