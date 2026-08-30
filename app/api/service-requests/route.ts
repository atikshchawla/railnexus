import { NextRequest, NextResponse } from "next/server";

type StoredRequest = {
	receivedAt: string;
	body: unknown;
};

// In-memory storage for received requests (dev only — resets on restart).
const received: StoredRequest[] = [];

export async function POST(request: NextRequest) {
	try {
		// 1. Read request body
		const body = await request.json();

		received.push({ receivedAt: new Date().toISOString(), body });

		console.log("Service request received:", body);

		// 2. Temporary response (authentication will be added later)
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
	return NextResponse.json({ requests: received }, { status: 200 });
}