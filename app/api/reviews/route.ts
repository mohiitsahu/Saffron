import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reviewCreateSchema } from "@/lib/reviews";
import { fieldErrors } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to leave a review." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = reviewCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Some details need fixing. Check the highlighted fields.",
        fieldErrors: fieldErrors(parsed.error.issues),
      },
      { status: 400 }
    );
  }

  const { bookingId, rating, comment } = parsed.data;
  const userId = session.user.id;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      customerId: true,
      chefId: true,
      status: true,
      review: { select: { id: true } },
    },
  });

  // Strangers get the same answer as a missing booking.
  if (!booking || (booking.customerId !== userId && booking.chefId !== userId)) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }
  if (booking.customerId !== userId) {
    return NextResponse.json({ error: "Only the customer can leave a review." }, { status: 403 });
  }
  if (booking.status !== "COMPLETED") {
    return NextResponse.json(
      { error: "You can review a booking once it has been marked as completed." },
      { status: 409 }
    );
  }
  if (booking.review) {
    return NextResponse.json({ error: "You've already reviewed this booking." }, { status: 409 });
  }

  try {
    const review = await prisma.review.create({
      data: {
        bookingId: booking.id,
        chefId: booking.chefId,
        customerId: userId,
        rating,
        comment: comment || null,
      },
      select: { id: true, rating: true },
    });
    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    // Two clicks at once: the unique bookingId rule lets only one review through.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "You've already reviewed this booking." }, { status: 409 });
    }
    throw error;
  }
}