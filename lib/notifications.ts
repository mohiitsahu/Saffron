import { prisma } from "@/lib/prisma";

// New requests waiting for the chef's answer, for events that haven't happened yet.
export function countPendingRequests(chefUserId: string) {
  return prisma.booking.count({
    where: { chefId: chefUserId, status: "REQUESTED", eventDate: { gt: new Date() } },
  });
}