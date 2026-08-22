import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
}
const prisma = new PrismaClient();

async function main() {
  await prisma.payment.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.client.deleteMany();
  await prisma.weeklyHour.deleteMany();
  await prisma.dateBlock.deleteMany();
  await prisma.location.deleteMany();
  await prisma.service.deleteMany();
  await prisma.coach.deleteMany();

  const coach = await prisma.coach.create({
    data: {
      slug: "tim-zhang",
      name: "Tim Zhang",
      title: "Tennis Coach",
      city: "Markham, ON",
      timezone: "America/Toronto",
      languages: "English / 中文",
      email: "tim@bookme.test",
      passwordHash: hashPassword("coach123"),
      subscriptionStatus: "trialing",
      plan: "light",
      trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      services: {
        create: { name: "Private tennis", duration: 60, priceCad: 80 },
      },
      locations: {
        create: [
          { name: "Blackmore Tennis Club", address: "1720 Bur Oak Ave, Markham", kind: "in_person" },
          { name: "Mayfair Clubs", address: "50 Steelcase Rd, Markham", kind: "in_person" },
          { name: "Online", address: "Video lesson", kind: "online" },
        ],
      },
      hours: {
        create: [1, 2, 3, 4, 5].map((weekday) => ({
          weekday,
          startMin: 10 * 60,
          endMin: 20 * 60,
        })),
      },
    },
  });
  console.log("seeded", coach.slug);
}

main().finally(() => prisma.$disconnect());
