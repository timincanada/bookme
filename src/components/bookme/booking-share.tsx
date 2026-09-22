import { Check, Copy, Download, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import { encode } from "uqr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  brandedBookingUrl,
  displayBookingLink,
  liveBookingUrl,
} from "@/lib/bookme/booking-link";

export function BookingShare({
  slug,
  name,
  canShare,
}: {
  slug: string;
  name: string;
  canShare: boolean;
}) {
  const pretty = displayBookingLink(slug);
  const branded = brandedBookingUrl(slug);
  const live = liveBookingUrl(slug);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!canShare) return;
    await navigator.clipboard.writeText(branded);
    setCopied(true);
    toast.success("Copied " + pretty);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function savePoster() {
    if (!canShare) return;
    try {
      const blob = await renderBookingPoster({ live, pretty, name });
      const file = new File([blob], `bookme-${slug}.png`, { type: "image/png" });
      const canFiles = typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
      if (canFiles) {
        await navigator.share({
          files: [file],
          title: "Book with " + name,
          text: pretty,
        });
        return;
      }
      downloadBlob(blob, file.name);
      toast.success("QR saved");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error("Could not save the QR");
    }
  }

  async function shareSheet() {
    if (!canShare) return;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Book with " + name, url: live, text: pretty });
        return;
      }
      await copyLink();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      await copyLink();
    }
  }

  return (
    <div className="rounded-2xl bg-card p-5 shadow-card ring-1 ring-line">
      <div className="mx-auto max-w-[220px]">
        <div className="overflow-hidden rounded-xl bg-cream p-3 ring-1 ring-line">
          <QrMark value={live} />
        </div>
      </div>
      <a
        href={live}
        className="mt-4 block text-center font-display text-xl font-medium tracking-tight text-ink"
      >
        {pretty}
      </a>
      <p className="mt-1 text-center text-sm text-muted">
        Scan to book. Forward the code, or print it for the wall.
      </p>
      {canShare ? (
        <div className="mt-5 grid gap-2">
          <Button size="field" onClick={() => void copyLink()}>
            {copied ? <Check className="size-4" strokeWidth={2} /> : <Copy className="size-4" strokeWidth={1.75} />}
            {copied ? "Copied" : "Copy short link"}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="field" onClick={() => void savePoster()}>
              <Download className="size-4" strokeWidth={1.75} />
              Save QR
            </Button>
            <Button variant="outline" size="field" onClick={() => void shareSheet()}>
              <Share2 className="size-4" strokeWidth={1.75} />
              Share
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-center text-sm text-muted">Start a trial to copy and share this page.</p>
      )}
    </div>
  );
}

function QrMark({ value }: { value: string }) {
  const qr = useMemo(() => encode(value, { ecc: "H", border: 2 }), [value]);
  const d = useMemo(() => {
    const parts: string[] = [];
    for (let y = 0; y < qr.size; y++) {
      for (let x = 0; x < qr.size; x++) {
        if (qr.data[y][x]) parts.push(`M${x} ${y}h1v1h-1z`);
      }
    }
    return parts.join("");
  }, [qr]);

  return (
    <svg
      viewBox={`0 0 ${qr.size} ${qr.size}`}
      className="block aspect-square w-full"
      shapeRendering="crispEdges"
      role="img"
      aria-label="Booking QR code"
    >
      <rect width={qr.size} height={qr.size} className="fill-cream" />
      <path d={d} className="fill-forest" />
    </svg>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function renderBookingPoster(input: { live: string; pretty: string; name: string }) {
  await document.fonts.ready.catch(() => undefined);
  const width = 1080;
  const height = 1440;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const root = getComputedStyle(document.documentElement);
  const paper = root.getPropertyValue("--color-paper").trim() || "#faf8f3";
  const cream = root.getPropertyValue("--color-cream").trim() || "#faf8f3";
  const forest = root.getPropertyValue("--color-forest").trim() || "#154734";
  const ink = root.getPropertyValue("--color-ink").trim() || "#1c1916";
  const muted = root.getPropertyValue("--color-muted").trim() || "#6f6b64";

  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);

  const qr = encode(input.live, { ecc: "H", border: 2 });
  const qrBox = 760;
  const qrX = (width - qrBox) / 2;
  const qrY = 180;
  const cell = qrBox / qr.size;
  ctx.fillStyle = cream;
  roundRect(ctx, qrX - 28, qrY - 28, qrBox + 56, qrBox + 56, 36);
  ctx.fill();
  ctx.fillStyle = forest;
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.data[y][x]) ctx.fillRect(qrX + x * cell, qrY + y * cell, cell + 0.4, cell + 0.4);
    }
  }

  ctx.fillStyle = forest;
  ctx.font = '600 28px Figtree, ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("BookMe", width / 2, 88);

  ctx.fillStyle = ink;
  ctx.font = '500 52px Fraunces, ui-serif, Georgia, serif';
  ctx.fillText("Book with " + input.name, width / 2, qrY + qrBox + 120);

  ctx.fillStyle = forest;
  ctx.font = '600 36px Figtree, ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(input.pretty, width / 2, qrY + qrBox + 184);

  ctx.fillStyle = muted;
  ctx.font = '500 24px Figtree, ui-sans-serif, system-ui, sans-serif';
  ctx.fillText("Scan to book a lesson", width / 2, qrY + qrBox + 236);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG failed"))), "image/png");
  });
  return blob;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
