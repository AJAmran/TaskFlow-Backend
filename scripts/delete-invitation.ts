import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const email = process.argv[2] || "salmaaktero538@gmail.com";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
	const found = await prisma.organizationInvitation.findMany({
		where: { email: email.toLowerCase() },
		select: {
			id: true,
			email: true,
			organizationId: true,
			acceptedAt: true,
			expiresAt: true,
		},
	});
	console.log(`found ${found.length} invitation(s) for ${email}`);
	for (const inv of found) {
		console.log(
			` - ${inv.id} org=${inv.organizationId} accepted=${inv.acceptedAt} expires=${inv.expiresAt}`,
		);
	}
	const deleted = await prisma.organizationInvitation.deleteMany({
		where: { email: email.toLowerCase() },
	});
	console.log(`deleted ${deleted.count} invitation(s)`);
}

main()
	.catch((e) => {
		console.error("FAILED:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
