import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { coachForUser, loadCoachBundle } from "@/lib/bookme/api";
import {
  appleWalletSigningConfigured,
  buildCoachPass,
} from "@/lib/bookme/apple-wallet";
import { getSessionUser } from "@/lib/auth/verify.server";

async function handle(request: Request) {
  if (!appleWalletSigningConfigured()) {
    return Response.json(
      {
        error: "Apple Wallet pass signing is not configured",
        code: "WALLET_SIGNING_UNCONFIGURED",
      },
      { status: 503 },
    );
  }

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || undefined;
  let user;
  try {
    user = await getSessionUser(bearer);
  } catch {
    user = null;
  }
  if (!user) {
    return Response.json({ error: "Sign in required", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const sql = await getSql();
  const coach = await coachForUser(sql, user.id);
  if (!coach) {
    return Response.json({ error: "Coach profile required", code: "NO_COACH" }, { status: 404 });
  }

  try {
    const bundle = await loadCoachBundle(sql, coach);
    const buffer = await buildCoachPass({
      id: coach.id,
      slug: coach.slug,
      name: coach.name,
      title: coach.title,
      sport: coach.sport,
      city: coach.city,
      locations: bundle.activeLocations.map((l) => ({
        name: l.name,
        address: l.address,
        active: true,
      })),
    });

    const filename = `bookme-${coach.slug}.pkpass`;
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[wallet/coach-pass]", err);
    return Response.json(
      { error: "Could not generate Wallet pass", code: "WALLET_PASS_FAILED" },
      { status: 500 },
    );
  }
}

export const Route = createFileRoute("/api/wallet/coach-pass")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
    },
  },
});
