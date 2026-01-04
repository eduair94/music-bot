/**
 * Landing Page
 * 
 * Marketing home page for the Bypass Discord Music Bot
 */

import Commands from "@/components/landing/Commands";
import Comparison from "@/components/landing/Comparison";
import FAQ from "@/components/landing/FAQ";
import Features from "@/components/landing/Features";
import Footer from "@/components/landing/Footer";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import Pricing from "@/components/landing/Pricing";

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <Hero />
      <Features />
      <Comparison />
      <Pricing />
      <Commands />
      <FAQ />
      <Footer />
    </main>
  );
}
