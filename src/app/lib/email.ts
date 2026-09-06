import config from "../config";
import { transporter } from "./nodemailer";

export type SendEmailParams = {
	to: string;
	subject: string;
	html: string;
	text?: string;
};

/**
 * Send transactional email using Resend API if configured, falling back to Nodemailer SMTP.
 */
export const sendEmail = async (params: SendEmailParams): Promise<void> => {
	const { to, subject, html, text } = params;

	if (config.resend_api_key) {
		const from = config.resend_from || config.email_sender;
		const res = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${config.resend_api_key}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ from, to, subject, html, text }),
		});
		if (!res.ok) {
			const body = await res.text().catch(() => "");
			throw new Error(`Resend send failed (${res.status}): ${body}`);
		}
		return;
	}

	await transporter.sendMail({
		from: `"TaskFlow" <${config.email_sender}>`,
		to,
		subject,
		html,
		text,
	});
};
