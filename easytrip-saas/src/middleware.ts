import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Le rotte sotto /app richiedono autenticazione
const isProtectedRoute = createRouteMatcher(["/app(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Escludi /api/webhooks/* (Stripe): il body deve restare raw per la firma; Clerk non deve intercettare.
    "/((?!_next|api/webhooks|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api(?!/webhooks)|trpc)(.*)",
  ],
};
