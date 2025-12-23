import Header from "./components/Header";
import Hero from "./components/Hero";
import Features from "./components/Features";
import Comparison from "./components/Comparison";
import Pricing from "./components/Pricing";
import Commands from "./components/Commands";
import FAQ from "./components/FAQ";
import Footer from "./components/Footer";

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
