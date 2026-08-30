"use client";

import dynamic from "next/dynamic";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";

const ProductApp = dynamic(() => import("@/App"), {
  ssr: false,
  loading: () => (
    <main className="grid min-h-screen place-items-center bg-[#f2efe7] text-[#101511]">
      <span className="size-5 animate-pulse rounded-full bg-[#244cff]" />
      <span className="sr-only">Loading Get It in Writing</span>
    </main>
  ),
});

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export default function ClientApp() {
  if (convex === null) return <ProductApp />;
  return (
    <ConvexAuthProvider client={convex}>
      <ProductApp />
    </ConvexAuthProvider>
  );
}
