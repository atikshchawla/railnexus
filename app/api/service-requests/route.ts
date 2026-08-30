import { NextRequest, NextResponse } from "next/server";

import {
	clearServiceRequests,
	insertServiceRequest,
	listServiceRequests,
} from "@/lib/db";

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();

		// Persist to Postgres (Neon HTTP driver) so the request is visible to
		// every instance, not just the one that handled the POST.
		await insertServiceRequest(body as Record<string, unknown>);

		console.log("Service request received:", body);

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
			{ error: "Invalid request body", detail: String(error) },
			{ status: 400 }
		);
	}
}

export async function GET() {
	try {
		const stored = await listServiceRequests();
		const requests = stored.map((r) => ({
			receivedAt: r.receivedAt,
			body: r.body,
		}));

		return NextResponse.json({ requests }, { status: 200 });
	} catch (error) {
		console.error("Failed to list service requests:", error);

		return NextResponse.json(
			{ requests: [], error: String(error) },
			{ status: 500 }
		);
	}
}

export async function DELETE() {
	try {
		await clearServiceRequests();

		return NextResponse.json(
			{ success: true, message: "All service requests removed" },
			{ status: 200 }
		);
	} catch (error) {
		console.error("Failed to remove service requests:", error);

		return NextResponse.json(
			{ error: "Failed to remove requests", detail: String(error) },
			{ status: 500 }
		);
	}
}
