import "dotenv/config";

import { PrismaNeonHttp } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

function createPrismaClient() {
	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) {
		throw new Error(
			"DATABASE_URL is not set. Add it to your environment / .env file.",
		);
	}

	// Neon's HTTP driver adapter works on Cloudflare Workers (uses fetch),
	// unlike the `pg` TCP driver which fails to bundle on Workers.
	const adapter = new PrismaNeonHttp(connectionString, {
		arrayMode: true,
		fullResults: true,
	});
	return new PrismaClient({ adapter });
}

// Reuse a single instance per process to avoid exhausting connections.
const globalForPrisma = globalThis as unknown as {
	prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = prisma;
}
