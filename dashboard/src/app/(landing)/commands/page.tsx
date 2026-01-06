/**
 * Commands Page
 * 
 * Full page listing all bot commands with filtering and search
 */

import Commands from "@/components/landing/Commands";
import Footer from "@/components/landing/Footer";
import Header from "@/components/landing/Header";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Commands - Bypass Discord Music Bot",
  description: "Browse all 150+ commands available in Bypass Discord Music Bot. Play music, manage queues, apply audio filters, and more.",
};

export default function CommandsPage() {
  return (
    <main className="min-h-screen">
      <Header />
      {/* Spacer for fixed header */}
      <div className="h-20" />
      <Commands />
      <Footer />
    </main>
  );
}
