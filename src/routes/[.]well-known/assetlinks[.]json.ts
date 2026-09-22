import { createFileRoute } from "@tanstack/react-router";

/** Android App Links. ANDROID_CERT_SHA256: comma-separated SHA-256 fingerprints (Play app signing, optionally upload key). */
export const Route = createFileRoute("/.well-known/assetlinks.json")({
  server: {
    handlers: {
      GET: () => {
        const fingerprints = String(process.env.ANDROID_CERT_SHA256 || "")
          .split(",")
          .map((f) => f.trim().toUpperCase())
          .filter((f) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f));
        if (!fingerprints.length) return new Response("Not configured", { status: 404 });
        return Response.json([
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: { namespace: "android_app", package_name: "app.bookme.training", sha256_cert_fingerprints: fingerprints },
          },
        ]);
      },
    },
  },
});
