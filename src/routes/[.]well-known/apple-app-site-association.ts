import { createFileRoute } from "@tanstack/react-router";

/**
 * Universal Links for both iOS apps. Needs APPLE_TEAM_ID in the environment
 * (the student app's team can differ via APPLE_TEAM_ID_STUDENT).
 *
 * The paths are split so a phone with both apps installed opens the right one:
 * student links (portal, short link, swap requests) go to the student app,
 * coach links (app shell, welcome) to the coach app.
 */
export const Route = createFileRoute("/.well-known/apple-app-site-association")({
  server: {
    handlers: {
      GET: () => {
        const isTeam = (v: string) => /^[A-Z0-9]{10}$/.test(v);
        const coachTeam = String(process.env.APPLE_TEAM_ID || "").trim();
        const studentTeam = String(process.env.APPLE_TEAM_ID_STUDENT || coachTeam).trim();
        const details: Array<{ appIDs: string[]; components: Array<Record<string, string>> }> = [];

        if (isTeam(studentTeam)) {
          details.push({
            appIDs: [`${studentTeam}.app.bookme.student`],
            components: [{ "/": "/manage*" }, { "/": "/s" }, { "/": "/r/*" }],
          });
        }
        if (isTeam(coachTeam)) {
          details.push({
            appIDs: [`${coachTeam}.app.bookme.training`],
            components: [{ "/": "/app*" }, { "/": "/welcome" }],
          });
        }
        if (!details.length) return new Response("Not configured", { status: 404 });
        return Response.json({ applinks: { details } });
      },
    },
  },
});
