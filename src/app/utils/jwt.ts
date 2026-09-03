import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

const createToken = (
	payload: string | object | Buffer,
	secret: string,
	expiresIn: string | number,
): string => {
	return jwt.sign(payload as JwtPayload, secret, {
		expiresIn,
	} as SignOptions);
};

type VerifySuccess = { success: true; data: JwtPayload & Record<string, unknown> };
type VerifyFailure = { success: false; error: string };

const verifyToken = (token: string, secret: string): VerifySuccess | VerifyFailure => {
	try {
		const decoded = jwt.verify(token, secret) as JwtPayload & Record<string, unknown>;
		return { success: true, data: decoded };
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : "Invalid token";
		return { success: false, error: message };
	}
};

export const jwtUtils = {
	createToken,
	verifyToken,
};
