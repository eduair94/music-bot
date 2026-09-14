export { auth as middleware } from "@/auth";

export const config = {
  matcher: [
    /*
     * Run the auth middleware on everything except:
     * - api/auth (Auth.js routes)
     * - _next/static, _next/image, files with an extension (static assets)
     * - login
     * - public marketing pages, which are prerendered and never read a session
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*|login|commands|install|privacy|terms|invite|support|opengraph-image|apple-icon|$).*)",
  ],
};
