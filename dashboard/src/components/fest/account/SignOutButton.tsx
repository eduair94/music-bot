"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { Button } from "../ui";

/** Sign out; with `callbackUrl="/login"` it doubles as "sign in again" when the Discord token went stale. */
export function SignOutButton({
  className,
  label = "Sign out",
  callbackUrl = "/",
  icon = true,
}: {
  className?: string;
  label?: string;
  callbackUrl?: string;
  icon?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      className={className}
      busy={busy}
      onClick={() => {
        setBusy(true);
        void signOut({ callbackUrl });
      }}
    >
      {icon ? <LogOut size={16} /> : null} {label}
    </Button>
  );
}
