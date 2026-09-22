/**
 * Apple Wallet pass signing config (Vercel / runtime env).
 *
 * Required to sign .pkpass files:
 *   APPLE_PASS_TYPE_ID          e.g. pass.com.bookme.coach
 *   APPLE_PASS_TEAM_ID          10-char Apple Team ID
 *   APPLE_PASS_CERT             Pass Type ID certificate PEM (or raw/base64)
 *   APPLE_PASS_KEY              Matching private key PEM (or raw/base64)
 *   APPLE_WWDR_CERT             Apple WWDR intermediate PEM (or raw/base64)
 *
 * Alternates (same values, base64-encoded — useful in Vercel UI):
 *   APPLE_PASS_CERT_BASE64
 *   APPLE_PASS_KEY_BASE64
 *   APPLE_WWDR_CERT_BASE64
 *
 * Optional:
 *   APPLE_PASS_CERT_PASSWORD    passphrase for encrypted private key / p12
 *   APPLE_PASS_P12              PKCS#12 blob (PEM/base64); used if CERT+KEY absent
 *   APPLE_PASS_P12_BASE64
 *   APPLE_PASS_WEB_SERVICE_URL  future pass update webServiceURL
 *   APPLE_PASS_AUTH_TOKEN_SECRET  HMAC secret to mint authenticationToken
 *
 * Without the required signing vars the download route returns 503 and the
 * UI shows a short “signing isn’t configured yet” dialog. Do not invent demo
 * certs; Apple Developer org / Pass Type ID cert must be provisioned first.
 */

import { env } from "@/lib/env.server";

export type AppleWalletEnv = {
  passTypeId: string;
  teamId: string;
  /** Signer certificate PEM */
  signerCert: string;
  /** Signer private key PEM */
  signerKey: string;
  /** Optional key passphrase */
  signerKeyPassphrase?: string;
  /** Apple WWDR intermediate PEM */
  wwdr: string;
  /** Optional hooks for later dynamic updates / lesson passes */
  webServiceURL?: string;
  authTokenSecret?: string;
};

function readPem(primary: string, base64Alt: string): string | undefined {
  const raw = env(primary);
  if (raw) return normalizePem(raw);
  const b64 = env(base64Alt);
  if (!b64) return undefined;
  try {
    return normalizePem(Buffer.from(b64, "base64").toString("utf8"));
  } catch {
    return undefined;
  }
}

/** Accept pasted PEM with literal \n or missing headers noise. */
function normalizePem(value: string): string {
  let v = value.trim();
  if (v.includes("\\n")) v = v.replace(/\\n/g, "\n");
  return v;
}

export function appleWalletSigningConfigured(): boolean {
  try {
    getAppleWalletEnv();
    return true;
  } catch {
    return false;
  }
}

export function getAppleWalletEnv(): AppleWalletEnv {
  const passTypeId = env("APPLE_PASS_TYPE_ID");
  const teamId = env("APPLE_PASS_TEAM_ID");
  const wwdr = readPem("APPLE_WWDR_CERT", "APPLE_WWDR_CERT_BASE64");
  let signerCert = readPem("APPLE_PASS_CERT", "APPLE_PASS_CERT_BASE64");
  let signerKey = readPem("APPLE_PASS_KEY", "APPLE_PASS_KEY_BASE64");
  const signerKeyPassphrase = env("APPLE_PASS_CERT_PASSWORD");

  // Optional PKCS#12 path — extract PEM with node-forge when CERT/KEY missing.
  if ((!signerCert || !signerKey) && (env("APPLE_PASS_P12") || env("APPLE_PASS_P12_BASE64"))) {
    const extracted = extractP12(
      env("APPLE_PASS_P12") ||
        Buffer.from(env("APPLE_PASS_P12_BASE64")!, "base64").toString("binary"),
      signerKeyPassphrase || "",
    );
    signerCert = signerCert || extracted.cert;
    signerKey = signerKey || extracted.key;
  }

  if (!passTypeId || !teamId || !signerCert || !signerKey || !wwdr) {
    throw new Error("Apple Wallet pass signing is not configured");
  }

  return {
    passTypeId,
    teamId,
    signerCert,
    signerKey,
    signerKeyPassphrase: signerKeyPassphrase || undefined,
    wwdr,
    webServiceURL: env("APPLE_PASS_WEB_SERVICE_URL"),
    authTokenSecret: env("APPLE_PASS_AUTH_TOKEN_SECRET"),
  };
}

function extractP12(p12Raw: string, password: string): { cert: string; key: string } {
  // Lazy require — node-forge ships without perfect types in this install.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const forge = require("node-forge") as any;
  const binary = p12Raw.includes("BEGIN")
    ? forge.util.decode64(
        p12Raw
          .replace(/-----BEGIN[^-]+-----/g, "")
          .replace(/-----END[^-]+-----/g, "")
          .replace(/\s+/g, ""),
      )
    : p12Raw;
  const asn1 = forge.asn1.fromDer(binary);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const keyBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
      forge.pki.oids.pkcs8ShroudedKeyBag
    ] || p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag];
  const certBag = certBags[forge.pki.oids.certBag]?.[0];
  const keyBag = keyBags?.[0];
  if (!certBag?.cert || !keyBag?.key) {
    throw new Error("APPLE_PASS_P12 did not contain a certificate and private key");
  }
  return {
    cert: forge.pki.certificateToPem(certBag.cert),
    key: forge.pki.privateKeyToPem(keyBag.key),
  };
}
