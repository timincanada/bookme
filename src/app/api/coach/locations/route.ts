import { NextRequest, NextResponse } from "next/server";
import { currentCoach } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const coach = await currentCoach();
  if (!coach) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { name, address, kind, id, active } = await req.json();
  if (id) {
    const loc = coach.locations.find((l) => l.id === id);
    if (!loc) return NextResponse.json({ error: "Location not found" }, { status: 404 });
    const nextActive = typeof active === "boolean" ? active : loc.active;
    if (!nextActive) {
      const others = coach.locations.filter((l) => l.id !== id && l.active).length;
      if (others === 0) {
        return NextResponse.json({ error: "Keep at least one location on" }, { status: 400 });
      }
    }
    await prisma.location.update({
      where: { id },
      data: {
        name: name ?? loc.name,
        address: address ?? loc.address,
        kind: kind ?? loc.kind,
        active: nextActive,
      },
    });
    return NextResponse.json({ ok: true });
  }
  if (!name) return NextResponse.json({ error: "Location name is required" }, { status: 400 });
  const created = await prisma.location.create({
    data: {
      coachId: coach.id,
      name,
      address: address || "",
      kind: kind || "in_person",
    },
  });
  return NextResponse.json({ id: created.id });
}
