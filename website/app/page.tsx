import Commands from "./components/Commands";
import Comparison from "./components/Comparison";
import FAQ from "./components/FAQ";
import Features from "./components/Features";
import Footer from "./components/Footer";
import Header from "./components/Header";
import Hero from "./components/Hero";
import Pricing from "./components/Pricing";

export default function Home() {
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
