import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";
import { cspNonceForRequest } from "@/lib/csp";
import { NotFound } from "@/components/not-found";

export function getRouter() {
  const nonce = cspNonceForRequest();
  return createRouter({
    routeTree,
    ssr: nonce ? { nonce } : undefined,
    defaultErrorComponent: AppErrorComponent,
    defaultNotFoundComponent: NotFound,
    defaultPendingComponent: function Pending() {
      return <main className="min-h-screen bg-paper" />;
    },
  });
}
