"use client";

import { CollectionsScreen } from "@/components/fest/account/Setlists";

/** Collections, set as setlists. `demo` swaps the API for in-memory fixtures (demo mode without a session). */
export function CollectionsClient({ demo = false }: { demo?: boolean }) {
  return <CollectionsScreen demo={demo} />;
}
