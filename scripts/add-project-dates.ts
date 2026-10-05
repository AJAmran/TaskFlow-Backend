import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const columns = [
	{ name: "startDate", type: "TIMESTAMP(3)" },
	{ name: "endDate", type: "TIMESTAMP(3)" },
];

const run = async () => {
	for (const column of columns) {
		await prisma.$executeRawUnsafe(
			`ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "${column.name}" ${column.type}`,
		);
		console.log(`projects.${column.name} ensured`);
	}

	const rows = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
		`SELECT column_name FROM information_schema.columns WHERE table_name = 'projects' AND column_name IN ('startDate', 'endDate')`,
	);
	console.log("present:", rows.map((r) => r.column_name).join(", "));
};

run()
	.catch((error) => {
		console.error("failed:", error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
