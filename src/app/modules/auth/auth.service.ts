import bcrypt from "bcryptjs";
import httpStatus from "http-status";
import config from "../../config";
import { googleClient } from "../../lib/googleAuth";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { jwtUtils } from "../../utils/jwt";
import type { IChangePasswordPayload, IGoogleLoginPayload, ILoginPayload, IRegisterPayload } from "./auth.interface";

// ── Helpers ─────────────────────────────────────────────

const buildTokens = (user: { id: string; email: string; name: string; platformRole: string }) => {
	const payload = {
		userId: user.id,
		email: user.email,
		name: user.name,
		platformRole: user.platformRole,
	};

	const accessToken = jwtUtils.createToken(payload, config.jwt_access_secret, config.jwt_access_expires_in);
	const refreshToken = jwtUtils.createToken(payload, config.jwt_refresh_secret, config.jwt_refresh_expires_in);

	return { accessToken, refreshToken, payload };
};

const sanitizeUser = <T extends { password?: string | null }>(user: T): Omit<T, "password"> => {
	const { password: _p, ...rest } = user;
	return rest;
};

// ── Register ────────────────────────────────────────────

const register = async (payload: IRegisterPayload) => {
	const email = payload.email.trim().toLowerCase();

	const existing = await prisma.user.findUnique({ where: { email } });
	if (existing && !existing.deletedAt) {
		throw new AppError(httpStatus.CONFLICT, "User with this email already exists");
	}

	// If soft-deleted, allow re-creation by reactivating? For now conflict.
	const hashedPassword = await bcrypt.hash(payload.password, Number(config.bcrypt_salt_rounds));

	const user = await prisma.user.create({
		data: {
			name: payload.name.trim(),
			email,
			password: hashedPassword,
			provider: "credentials",
			platformRole: "USER" as const,
		},
	});

	const tokens = buildTokens(user);

	return {
		user: sanitizeUser(user),
		...tokens,
	};
};

// ── Login ───────────────────────────────────────────────

const login = async (payload: ILoginPayload) => {
	const email = payload.email.trim().toLowerCase();

	const user = await prisma.user.findUnique({ where: { email } });

	if (!user || user.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (!user.isActive) {
		throw new AppError(httpStatus.FORBIDDEN, "Your account has been blocked. Please contact support.");
	}

	// Google-only accounts have no password
	if (!user.password) {
		if (user.provider === "google") {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"This account was created with Google. Please login with Google.",
			);
		}
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid credentials");
	}

	const isMatched = await bcrypt.compare(payload.password, user.password);
	if (!isMatched) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid credentials");
	}

	const tokens = buildTokens(user);

	return {
		user: sanitizeUser(user),
		...tokens,
	};
};

// ── Refresh Token ───────────────────────────────────────

const refreshToken = async (token: string) => {
	if (!token) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Refresh token is missing");
	}

	const verified = jwtUtils.verifyToken(token, config.jwt_refresh_secret);

	if (!verified.success || !verified.data) {
		throw new AppError(httpStatus.UNAUTHORIZED, verified.success ? "Invalid refresh token" : verified.error);
	}

	const data = verified.data as { userId: string; email: string };

	const user = await prisma.user.findUnique({ where: { id: data.userId } });

	if (!user || user.deletedAt || !user.isActive) {
		throw new AppError(httpStatus.UNAUTHORIZED, "User is inactive or not found");
	}

	// Optional: verify email in token matches db
	if (user.email !== data.email) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Token email mismatch");
	}

	const tokens = buildTokens(user);

	return {
		user: sanitizeUser(user),
		...tokens,
	};
};

// ── Google Login ────────────────────────────────────────

const googleLogin = async (payload: IGoogleLoginPayload) => {
	let googlePayload: import("google-auth-library").TokenPayload | undefined;

	try {
		const ticket = await googleClient.verifyIdToken({
			idToken: payload.idToken,
			audience: config.google_client_id,
		});
		googlePayload = ticket.getPayload();
	} catch {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid or expired Google ID token");
	}

	if (!googlePayload?.email || !googlePayload?.name || !googlePayload?.sub) {
		throw new AppError(httpStatus.BAD_REQUEST, "Google token is missing required fields");
	}

	const email = googlePayload.email.trim().toLowerCase();
	const name = googlePayload.name;
	const googleId = googlePayload.sub;
	const profileImage = googlePayload.picture;

	// 1. Find by googleId
	let user = await prisma.user.findUnique({ where: { googleId } });

	// 2. If not found by googleId, try by email
	if (!user) {
		const existingByEmail = await prisma.user.findUnique({ where: { email } });

		if (existingByEmail) {
			if (existingByEmail.deletedAt || !existingByEmail.isActive) {
				throw new AppError(httpStatus.FORBIDDEN, "Your account is blocked or deleted");
			}

			// Link googleId to existing credentials account
			if (!existingByEmail.googleId) {
				user = await prisma.user.update({
					where: { id: existingByEmail.id },
					data: {
						googleId,
						provider: existingByEmail.provider === "credentials" ? "credentials" : "google",
						profileImage: existingByEmail.profileImage || profileImage,
					},
				});
			} else {
				user = existingByEmail;
			}
		} else {
			// 3. Create new google user
			user = await prisma.user.create({
				data: {
					name,
					email,
					provider: "google",
					googleId,
					profileImage,
					platformRole: "USER" as const,
				},
			});
		}
	}

	if (!user || user.deletedAt || !user.isActive) {
		throw new AppError(httpStatus.FORBIDDEN, "Your account is blocked or deleted");
	}

	const tokens = buildTokens(user);

	return {
		user: sanitizeUser(user),
		...tokens,
	};
};

// ── Change Password ─────────────────────────────────────

const changePassword = async (userId: string, payload: IChangePasswordPayload) => {
	const user = await prisma.user.findUnique({ where: { id: userId } });

	if (!user || user.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (!user.password) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Google accounts cannot change password. Please set a password via reset flow.",
		);
	}

	const isOldMatched = await bcrypt.compare(payload.oldPassword, user.password);
	if (!isOldMatched) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Old password is incorrect");
	}

	if (payload.oldPassword === payload.newPassword) {
		throw new AppError(httpStatus.BAD_REQUEST, "New password must be different from old password");
	}

	const hashedNew = await bcrypt.hash(payload.newPassword, Number(config.bcrypt_salt_rounds));

	await prisma.user.update({
		where: { id: userId },
		data: { password: hashedNew },
	});

	return null;
};

// ── Get Me ──────────────────────────────────────────────

const getMe = async (userId: string) => {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		omit: { password: true },
		include: {
			memberships: {
				where: { deletedAt: null },
				include: { organization: { select: { id: true, name: true, slug: true, status: true } } },
			},
		},
	});

	if (!user || user.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	return user;
};

export const AuthService = {
	register,
	login,
	refreshToken,
	googleLogin,
	changePassword,
	getMe,
};
