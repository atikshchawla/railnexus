import { neon } from "@neondatabase/serverless";

export type StoredServiceRequest = {
	id: number;
	receivedAt: string;
	body: Record<string, unknown>;
};

let cachedSql: ReturnType<typeof neon> | null = null;

function getSql() {
	if (!cachedSql) {
		if (!process.env.DATABASE_URL) {
			throw new Error(
				"DATABASE_URL is not set. Add it to your environment / .env file.",
			);
		}
		// Neon's HTTP driver works natively on Cloudflare Workers (uses fetch).
		cachedSql = neon(process.env.DATABASE_URL);
	}
	return cachedSql;
}

function rowToRequest(row: {
	id: number;
	receivedAt: Date | string;
	request: unknown;
}): StoredServiceRequest {
	const body =
		typeof row.request === "string" ? JSON.parse(row.request) : row.request;
	return {
		id: row.id,
		receivedAt:
			row.receivedAt instanceof Date
				? row.receivedAt.toISOString()
				: new Date(row.receivedAt).toISOString(),
		body: body as Record<string, unknown>,
	};
}

export async function listServiceRequests(): Promise<StoredServiceRequest[]> {
	const rows = await getSql()`SELECT id, "receivedAt", "request" FROM "ServiceRequest" ORDER BY id ASC`;
	return (rows as Array<{
		id: number;
		receivedAt: Date | string;
		request: unknown;
	}>).map(rowToRequest);
}

export async function insertServiceRequest(
	body: Record<string, unknown>,
): Promise<void> {
	await getSql()`INSERT INTO "ServiceRequest" ("request") VALUES (${JSON.stringify(
		body,
	)}::jsonb)`;
}

export async function clearServiceRequests(): Promise<void> {
	await getSql()`DELETE FROM "ServiceRequest"`;
}
