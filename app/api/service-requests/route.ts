import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
	try {
		// 1. Read request body
		const body = await request.json();

		// 2. Persist to Postgres so the request is visible across all instances.
		await prisma.serviceRequest.create({
			data: { request: body as object },
		});

		console.log("Service request received:", body);

		// 3. Temporary response (authentication will be added later)
		return NextResponse.json(
			{
				success: true,
				message: "Service request received",
				request: body,
			},
			{ status: 200 }
		);
	} catch (error) {
		console.error("Failed to process service request:", error);

		return NextResponse.json(
			{ error: "Invalid request body" },
			{ status: 400 }
		);
	}
}

export async function GET() {
	try {
		const stored = await prisma.serviceRequest.findMany({
			orderBy: { id: "asc" },
		});

		const requests = stored.map((r) => ({
			receivedAt: r.receivedAt.toISOString(),
			body: r.request,
		}));

		return NextResponse.json({ requests }, { status: 200 });
	} catch (error) {
		console.error("Failed to list service requests:", error);

		return NextResponse.json({ requests: [] }, { status: 500 });
	}
}

export async function DELETE() {
	try {
		await prisma.serviceRequest.deleteMany();

		return NextResponse.json(
			{ success: true, message: "All service requests removed" },
			{ status: 200 }
		);
	} catch (error) {
		console.error("Failed to remove service requests:", error);

		return NextResponse.json(
			{ error: "Failed to remove requests" },
			{ status: 500 }
		);
	}
}
