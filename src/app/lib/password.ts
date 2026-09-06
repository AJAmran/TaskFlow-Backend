import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import config from "../config";

/**
 * Password hashing and verification utilities.
 * Handles normalization for passwords longer than bcrypt's 72-byte limit.
 */
const BCRYPT_MAX_BYTES = 72;

const normalizePassword = (password: string): string => {
	if (Buffer.byteLength(password, "utf8") > BCRYPT_MAX_BYTES) {
		return crypto
			.createHash("sha256")
			.update(password, "utf8")
			.digest("base64");
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
