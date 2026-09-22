import { createFileRoute } from "@tanstack/react-router";

/** Universal Links for the iOS app. Needs APPLE_TEAM_ID in the environment. */
export const Route = createFileRoute("/.well-known/apple-app-site-association")({
  server: {
    handlers: {
      GET: () => {
        const team = String(process.env.APPLE_TEAM_ID || "").trim();
        if (!/^[A-Z0-9]{10}$/.test(team)) return new Response("Not configured", { status: 404 });
        return Response.json({
          applinks: {
            details: [
              {
                appIDs: [`${team}.app.bookme.training`],
                components: [{ "/": "/manage*" }, { "/": "/s" }, { "/": "/r/*" }, { "/": "/app*" }, { "/": "/welcome" }],
              },
            ],
          },
        });
      },
    },
  },
});
