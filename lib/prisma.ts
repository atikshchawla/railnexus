import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

function createPrismaClient() {
	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) {
		throw new Error(
			"DATABASE_URL is not set. Add it to your environment / .env file.",
		);
	}

	const adapter = new PrismaPg({ connectionString });
	return new PrismaClient({ adapter });
}

// Reuse a single instance per process to avoid exhausting connection pools.
const globalForPrisma = globalThis as unknown as {
	prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = prisma;
}
