import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { useHydrateBookMe } from "@/lib/store";
import { Toaster } from "sonner";
import { NativeBridge } from "@/lib/native/bridge";
import appCss from "../styles.css?url";

const APP_NAME = "BookMe";

function RootShell() {
  useHydrateBookMe();
  return (
    <>
      <Outlet />
      <NativeBridge />
      <Toaster
        position="top-center"
        toastOptions={{
          className:
            "!bg-card !text-ink !border-line !shadow-card !font-sans",
        }}
      />
    </>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content: "More time coaching. Less time scheduling.",
      },
      { name: "theme-color", content: "#154734" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&family=Figtree:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&display=swap",
      },
    ],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="font-sans antialiased bg-paper text-ink">
        <PreviewHostBridge />
        <AuthProvider>
          <RootShell />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
