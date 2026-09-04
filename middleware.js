// Routing middleware: the root serves the scroll-film landing (public/landing) — runs before the
// filesystem lookup, which is why a vercel.json rewrite alone cannot beat the SPA's static index.html.
// Everything else (/studio, /archive, /account, /api/*) is untouched.
export const config = { matcher: ['/'] };
export default function middleware(request) {
  const url = new URL(request.url);
  if (url.pathname !== '/') return;
  url.pathname = '/landing/index.html';
  return new Response(null, { headers: { 'x-middleware-rewrite': url.toString() } });
}
