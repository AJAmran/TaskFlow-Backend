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

export const renderEjsTemplate = async (
	templateName: string,
	data: Record<string, unknown>,
): Promise<string> => {
	const filePath = path.join(process.cwd(), "src", "app", "templates", `${templateName}.ejs`);
	const template = await fs.promises.readFile(filePath, "utf-8");
	return ejs.render(template, data);
};