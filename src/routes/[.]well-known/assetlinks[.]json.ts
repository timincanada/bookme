import { createFileRoute } from "@tanstack/react-router";

/**
 * Android App Links for both apps.
 * ANDROID_CERT_SHA256 / ANDROID_CERT_SHA256_STUDENT: comma-separated SHA-256
 * fingerprints (Play app signing, optionally the upload key too).
 */
export const Route = createFileRoute("/.well-known/assetlinks.json")({
  server: {
    handlers: {
      GET: () => {
        const parse = (raw: string | undefined) =>
          String(raw || "")
            .split(",")
            .map((f) => f.trim().toUpperCase())
            .filter((f) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f));

        const entries = [
          { pkg: "app.bookme.training", fingerprints: parse(process.env.ANDROID_CERT_SHA256) },
          { pkg: "app.bookme.student", fingerprints: parse(process.env.ANDROID_CERT_SHA256_STUDENT) },
        ].filter((e) => e.fingerprints.length);

        if (!entries.length) return new Response("Not configured", { status: 404 });
        return Response.json(
          entries.map((e) => ({
            relation: ["delegate_permission/common.handle_all_urls"],
            target: { namespace: "android_app", package_name: e.pkg, sha256_cert_fingerprints: e.fingerprints },
          })),
        );
      },
    },
  },
});
