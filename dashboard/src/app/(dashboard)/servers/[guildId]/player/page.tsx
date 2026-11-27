import { Suspense } from "react";
import { PlayerScreen } from "@/components/fest/player/PlayerScreen";

export default function PlayerPage() {
  return (
    <Suspense fallback={null}>
      <PlayerScreen />
    </Suspense>
  );
}
