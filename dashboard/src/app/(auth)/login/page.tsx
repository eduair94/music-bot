import { auth } from "@/auth";
import { LoginButton } from "@/components/auth/LoginButton";
import { textLink } from "@/components/fest/account/styles";
import { FestMark } from "@/components/fest/TopBar";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SUPPORT_INVITE_URL } from "../../../../../shared/links";

/** Auth.js sends failed sign-ins here with ?error=<type>. */
function errorMessage(error: string) {
  if (error === "OAuthCallbackError" || error === "AccessDenied") {
    return "Discord didn't finish the sign-in, so nothing was changed. Try again when you're ready.";
  }
  return "Sign-in failed on our side. Please try again in a moment.";
}

/** Only same-site paths are allowed as the post-login destination. */
function safeCallback(raw: string | undefined): string {
  if (!raw) return "/servers";
  try {
    const url = new URL(raw, "http://local");
    if (url.origin !== "http://local") {
      // Absolute URL: keep only the path if it points back at this site.
      const site = process.env.NEXTAUTH_URL || process.env.AUTH_URL;
      if (!site || new URL(site).origin !== new URL(raw).origin) return "/servers";
    }
    const path = url.pathname + url.search;
    return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/login") ? path : "/servers";
  } catch {
    return "/servers";
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; callbackUrl?: string | string[] }>;
}) {
  const session = await auth();
  const { error, callbackUrl } = await searchParams;
  const next = safeCallback(Array.isArray(callbackUrl) ? callbackUrl[0] : callbackUrl);

  if (session) redirect(next);

  const errorType = Array.isArray(error) ? error[0] : error;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* The poster: four stages, one night. A short band on phones, the full column from lg. */}
      <div className="relative h-[26dvh] min-h-40 overflow-hidden border-b-2 border-ink lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/dash/login-bill.webp"
          alt=""
          width={1024}
          height={1536}
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover object-[50%_58%] lg:object-center"
        />
      </div>

      <main className="flex min-w-0 flex-col px-4 pb-8 pt-6 sm:px-10 lg:px-16 lg:pt-10">
        <Link href="/" className="flex items-center gap-2 self-start" aria-label="Bypass home">
          <FestMark />
          <span className="bill text-[30px]">Bypass</span>
        </Link>

        <div className="my-auto max-w-[31rem] py-10 lg:py-16">
          <h1 className="bill text-balance text-[52px] sm:text-[68px] xl:text-[76px]">Run every stage from one bill</h1>
          <p className="mt-6 text-[17px] leading-relaxed text-ink-2">
            Sign in with Discord to run Bypass from the browser: the live player and queue, who may control the music,
            and every server setting.
          </p>
          <p className="mt-3 text-[17px] leading-relaxed text-ink-2">
            Extra stages, so one server can play in several voice channels at once, are coming next.
          </p>

          {errorType ? (
            <div role="alert" className="mt-7 flex gap-3 rounded-[4px] border border-now bg-paper px-3.5 py-3 text-[14px] leading-snug text-ink">
              <AlertTriangle size={18} className="mt-px shrink-0 text-now" aria-hidden />
              <p>
                {errorMessage(errorType)} If it keeps happening, tell us in the{" "}
                <a href={SUPPORT_INVITE_URL} target="_blank" rel="noreferrer" className={textLink}>
                  support server
                </a>
                .
              </p>
            </div>
          ) : null}

          <div className="mt-8">
            <LoginButton callbackUrl={next} />
          </div>
          <p className="mt-4 text-[13px] leading-relaxed text-ink-3">
            Discord shares your name, avatar, email and server list with Bypass. Signing in also adds you to the Bypass
            support server, once (Discord lists this as &ldquo;Join servers for you&rdquo;); leave it whenever you like and
            we won&apos;t add you again. By signing in you agree to the{" "}
            <Link href="/terms" className={textLink}>
              Terms
            </Link>{" "}
            and the{" "}
            <Link href="/privacy" className={textLink}>
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        <footer className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-3">
          <Link href="/" className="hover:text-ink">
            Home
          </Link>
          <Link href="/commands" className="hover:text-ink">
            Commands
          </Link>
          <a href={SUPPORT_INVITE_URL} target="_blank" rel="noreferrer" className="hover:text-ink">
            Support server
          </a>
        </footer>
      </main>
    </div>
  );
}
