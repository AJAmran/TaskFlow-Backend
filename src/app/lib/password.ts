import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import config from "../config";

/**
 * 2026 password-hashing strategy.
 *
 * - bcryptjs (pure JS) রাখা হয়েছে কারণ Vercel/serverless-এ native
 *   addon (bcrypt/argon2) build করা ঝামেলা। API bcrypt-এর সাথে compatible,
 *   তাই পরে native `bcrypt` বা `argon2id`-এ migrate করা সহজ।
 * - OWASP 2025-26 অনুযায়ী cost factor কমপক্ষে 12 (default 12)।
 * - bcrypt সর্বোচ্চ 72 byte নেয় — লম্বা password নীরবে truncate হয়ে
 *   যেত। তাই 72 byte-এর বেশি হলে SHA-256 দিয়ে pre-hash করে base64
 *   (44 char) bcrypt-এ দেওয়া হয়। hash ও verify দুটোতেই একই নিয়ম।
 */
const BCRYPT_MAX_BYTES = 72;

const normalizePassword = (password: string): string => {
	if (Buffer.byteLength(password, "utf8") > BCRYPT_MAX_BYTES) {
		return crypto.createHash("sha256").update(password, "utf8").digest("base64");
	}
	return password;
};

const saltRounds = (): number => {
	const rounds = Number(config.bcrypt_salt_rounds);
	if (Number.isFinite(rounds) && rounds >= 10 && rounds <= 15) return rounds;
	return 12;
};

export const hashPassword = async (password: string): Promise<string> => {
	return bcrypt.hash(normalizePassword(password), saltRounds());
};

export const verifyPassword = async (
	password: string,
	hash: string,
): Promise<boolean> => {
	if (!password || !hash) return false;
	return bcrypt.compare(normalizePassword(password), hash);
};
