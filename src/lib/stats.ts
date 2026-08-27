import { prisma } from "./db";

export async function getBookingViews() {
  try {
    return await prisma.publicVisitor.count();
  } catch {
    return 0;
  }
}
