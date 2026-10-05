import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const organizationId =
	process.argv[2] || "d2c0cbb8-e8a9-4e74-8c7b-91471d403dec";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
	const before = await prisma.subscription.findUnique({
		where: { organizationId },
	});
	console.log(
		`before: plan=${before?.plan} status=${before?.status} maxP=${before?.maxProjects} maxM=${before?.maxMembers}`,
	);
	const updated = await prisma.subscription.update({
		where: { organizationId },
		data: {
			plan: "FREE",
			status: "ACTIVE",
			maxProjects: 3,
			maxMembers: 5,
			currentPeriodEnd: null,
		},
	});
	console.log(
		`after: plan=${updated.plan} status=${updated.status} maxP=${updated.maxProjects} maxM=${updated.maxMembers}`,
	);
}

main()
	.catch((e) => {
		console.error("FAILED:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
