/**
 * Coach booking-card Generic pass (.pkpass).
 *
 * Architecture notes (future work — not implemented here):
 * - webServiceURL / authenticationToken hooks enable Apple Wallet push updates
 *   once a pass update web service + APNs are wired.
 * - Individual lesson passes can reuse branding + signing helpers; keep coach
 *   card serials namespaced as `coach-{id}` so lesson serials can be
 *   `lesson-{id}` without collision.
 */

import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PKPass } from "passkit-generator";
import { brandedBookingUrl, displayBookingLink } from "@/lib/bookme/booking-link";
import {
  appleWalletSigningConfigured,
  getAppleWalletEnv,
} from "./pass-config";

export { appleWalletSigningConfigured as signingConfigured };

const FOREST = "rgb(21, 71, 52)";
const CREAM = "rgb(250, 248, 243)";

export type CoachPassInput = {
  id: string;
  slug: string;
  name: string;
  title?: string | null;
  sport?: string | null;
  city?: string | null;
  locations?: { name: string; address?: string | null; active?: boolean }[];
};

function brandDir() {
  return path.join(process.cwd(), "public", "brand");
}

async function readBrand(file: string): Promise<Buffer> {
  return readFile(path.join(brandDir(), file));
}

function roleLine(coach: CoachPassInput): string {
  const sport = (coach.sport || "").trim();
  const title = (coach.title || "").trim();
  if (sport && title && !title.toLowerCase().includes(sport.toLowerCase())) {
    return `${title} · ${sport}`;
  }
  return title || sport || "Coach";
}

function locationLine(coach: CoachPassInput): string | null {
  const active = (coach.locations || []).filter((l) => l.active !== false);
  const loc = active[0] || coach.locations?.[0];
  if (loc) {
    const bits = [loc.name, loc.address].map((s) => (s || "").trim()).filter(Boolean);
    if (bits.length) return bits.join(" — ");
  }
  const city = (coach.city || "").trim();
  return city || null;
}

function mintAuthToken(coachId: string, secret: string): string {
  return createHmac("sha256", secret).update(`coach:${coachId}`).digest("hex");
}

export async function buildCoachPass(coach: CoachPassInput): Promise<Buffer> {
  const cfg = getAppleWalletEnv();
  const bookingUrl = brandedBookingUrl(coach.slug);
  const pretty = displayBookingLink(coach.slug);
  const loc = locationLine(coach);

  const [icon, logo, mark] = await Promise.all([
    readBrand("bookme-app-icon.png"),
    readBrand("bookme-logo-primary.png"),
    readBrand("bookme-mark.png"),
  ]);

  // PassKit requires icon; logo appears on the strip. Reuse brand PNGs at 1x/2x.
  const buffers: Record<string, Buffer> = {
    "icon.png": mark,
    ["icon" + "@2x.png"]: icon,
    "logo.png": logo,
    ["logo" + "@2x.png"]: logo,
  };

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: cfg.passTypeId,
    teamIdentifier: cfg.teamId,
    organizationName: "BookMe",
    description: `Book with ${coach.name}`,
    serialNumber: `coach-${coach.id}`,
    foregroundColor: CREAM,
    backgroundColor: FOREST,
    labelColor: CREAM,
    generic: {
      primaryFields: [
        {
          key: "name",
          label: "COACH",
          value: coach.name,
        },
      ],
      secondaryFields: [
        {
          key: "role",
          label: "SPORT / ROLE",
          value: roleLine(coach),
        },
      ],
      auxiliaryFields: [
        {
          key: "booking",
          label: "BOOKING LINK",
          value: pretty,
        },
        ...(loc
          ? [
              {
                key: "location",
                label: "LOCATION",
                value: loc,
              },
            ]
          : []),
      ],
      backFields: [
        {
          key: "booking-url",
          label: "Open booking page",
          value: bookingUrl,
          attributedValue: `<a href="${bookingUrl}">${pretty}</a>`,
        },
        {
          key: "about",
          label: "BookMe",
          value: "Share this card so players can book lessons with you.",
        },
      ],
    },
    barcodes: [
      {
        format: "PKBarcodeFormatQR",
        message: bookingUrl,
        messageEncoding: "iso-8859-1",
        altText: pretty,
      },
    ],
  } as const;

  // Optional update architecture (no web service implementation yet).
  const props: Record<string, unknown> = { ...passJson };
  if (cfg.webServiceURL && cfg.authTokenSecret) {
    props.webServiceURL = cfg.webServiceURL.replace(/\/$/, "");
    props.authenticationToken = mintAuthToken(coach.id, cfg.authTokenSecret);
  }

  const pass = new PKPass(
    {
      ...buffers,
      "pass.json": Buffer.from(JSON.stringify(props)),
    },
    {
      wwdr: cfg.wwdr,
      signerCert: cfg.signerCert,
      signerKey: cfg.signerKey,
      signerKeyPassphrase: cfg.signerKeyPassphrase,
    },
  );

  return pass.getAsBuffer();
}
