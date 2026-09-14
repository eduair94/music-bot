"use client";

import { faqs } from "@/data/faq";
import Link from "next/link";
import { useId, useState } from "react";
import { FaDiscord } from "react-icons/fa";

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const baseId = useId();

  return (
    <section id="faq" className="py-28 bg-coal" aria-labelledby="faq-title">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-12 gap-12">
          {/* Sticky editorial header */}
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <div className="flex items-center gap-4 mb-6">
                <span className="console-label text-amber!">Liner notes</span>
                <span className="flex-1 h-px bg-line lg:max-w-24" aria-hidden="true" />
              </div>
              <h2 id="faq-title" className="font-display text-4xl md:text-5xl font-bold tracking-tight text-balance">
                Questions,
                <br />
                <span className="text-amber">answered.</span>
              </h2>
              <p className="text-dune mt-6 leading-relaxed">
                Everything server owners ask before hitting play.
              </p>

              <Link
                href="/support"
                prefetch={false}
                className="mt-8 inline-flex items-center gap-2 px-5 py-3 border border-line-strong hover:border-amber/60 text-cream font-semibold rounded-lg transition-colors"
              >
                <FaDiscord className="w-4 h-4 text-amber" aria-hidden="true" />
                Join the support server
              </Link>
            </div>
          </div>

          {/* Accordion */}
          <ul className="lg:col-span-8 space-y-3" role="list">
            {faqs.map((faq, index) => {
              const open = openIndex === index;
              const buttonId = `${baseId}-q${index}`;
              const panelId = `${baseId}-a${index}`;
              return (
                <li
                  key={faq.question}
                  className={`console-panel rounded-xl overflow-hidden transition-colors duration-300 ${
                    open ? "border-amber/40" : ""
                  }`}
                >
                  <h3 className="m-0">
                    <button
                      id={buttonId}
                      type="button"
                      onClick={() => setOpenIndex(open ? null : index)}
                      aria-expanded={open}
                      aria-controls={panelId}
                      className="w-full p-5 text-left flex items-center gap-4 hover:bg-panel-raised/50 transition-colors font-medium text-cream"
                    >
                      <span className={`font-mono text-xs ${open ? "text-amber" : "text-dust"}`} aria-hidden="true">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="flex-1">{faq.question}</span>
                      <svg
                        className={`w-5 h-5 transition-transform duration-300 shrink-0 ${
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
                      <p className="px-5 pb-5 pl-13 text-dune leading-relaxed text-sm">{faq.answer}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
