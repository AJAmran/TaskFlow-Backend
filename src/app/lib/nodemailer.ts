import ejs from "ejs";
import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";
import config from "../config";

export const transporter = nodemailer.createTransport({
	service: "gmail",
	auth: {
		user: config.smtp_user,
		pass: config.smtp_password,
	},
});

const templateDirs = [
	path.join(process.cwd(), "dist", "src", "app", "templates"),
	path.join(process.cwd(), "src", "app", "templates"),
];

export const renderEjsTemplate = async (
	templateName: string,
	data: Record<string, unknown>,
): Promise<string> => {
	for (const dir of templateDirs) {
		try {
			const template = await fs.promises.readFile(
				path.join(dir, `${templateName}.ejs`),
				"utf-8",
			);
			return ejs.render(template, data);
		} catch {}
	}
	throw new Error(`Email template not found: ${templateName}`);
};
