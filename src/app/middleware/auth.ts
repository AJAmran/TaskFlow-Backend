import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import config from "../config";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/AppError";
import { jwtUtils } from "../utils/jwt";
import { PlatformRole, type OrgRole } from "../../generated/prisma/enums";

export interface RequestUser {
	userId: string;
	email: string;
	name: string;
	platformRole: PlatformRole;
}

export interface RequestOrgMembership {
	id: string;
	organizationId: string;
	userId: string;
	role: OrgRole;
}

declare global {
	namespace Express {
		interface Request {
			user?: RequestUser;
			organizationMember?: RequestOrgMembership;
		}
	}
}

const resolveOrganizationId = (req: Request): string | undefined =>
	(req.params.organizationId as string) ||
	(req.params.orgId as string) ||
	(req.body?.organizationId as string) ||
	(req.query?.organizationId as string);

export const assertOrgAccess = async (
	userId: string,
	organizationId: string,
	options: { requireOwner?: boolean } = {},
): Promise<RequestOrgMembership> => {
	const membership = await prisma.organizationMember.findFirst({
		where: { organizationId, userId, deletedAt: null },
		include: { organization: { select: { status: true, deletedAt: true } } },
	});

	if (!membership || membership.organization.deletedAt) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You are not a member of this organization.",
		);
	}

	if (membership.organization.status !== "ACTIVE") {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"This workspace is suspended. Contact support to restore access.",
		);
	}

	if (options.requireOwner && membership.role !== "ORG_OWNER") {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Only workspace owners can perform this action.",
		);
	}

	return {
		id: membership.id,
		organizationId: membership.organizationId,
		userId: membership.userId,
		role: membership.role,
	};
};

const extractToken = (req: Request): string | undefined => {
	if (req.cookies?.accessToken) return req.cookies.accessToken as string;
	const header = req.headers.authorization;
	if (!header) return undefined;
	if (header.startsWith("Bearer ")) return header.split(" ")[1];
	return header;
};

export const authenticate = async (
	req: Request,
	_res: Response,
	next: NextFunction,
) => {
	try {
		const token = extractToken(req);
		if (!token) {
			throw new AppError(
				httpStatus.UNAUTHORIZED,
				"You are not logged in. Please log in to access this resource.",
			);
		}

		const verified = jwtUtils.verifyToken(token, config.jwt_access_secret);
		if (!verified.success) {
			throw new AppError(
				httpStatus.UNAUTHORIZED,
				verified.error || "Invalid or expired token.",
			);
		}

		const { userId, email } = verified.data as {
			userId: string;
			email: string;
			name: string;
			platformRole: PlatformRole;
		};

		if (!userId || !email) {
			throw new AppError(httpStatus.UNAUTHORIZED, "Invalid token payload.");
		}

		const user = await prisma.user.findUnique({ where: { id: userId } });
		if (!user || user.deletedAt || user.email !== email) {
			throw new AppError(
				httpStatus.UNAUTHORIZED,
				"User not found. Please log in again.",
			);
		}
		if (user.isActive === false) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"Your account has been blocked. Please contact support.",
			);
		}

		req.user = {
			userId: user.id,
			email: user.email,
			name: user.name,
			platformRole: user.platformRole,
		};
		next();
	} catch (error) {
		next(error);
	}
};

export const requireSuperAdmin = (
	req: Request,
	_res: Response,
	next: NextFunction,
) => {
	if (!req.user) {
		return next(new AppError(httpStatus.UNAUTHORIZED, "Not authenticated."));
	}
	if (req.user.platformRole !== PlatformRole.SUPER_ADMIN) {
		return next(
			new AppError(
				httpStatus.FORBIDDEN,
				"Forbidden. Super admin access required.",
			),
		);
	}
	next();
};

export const requireRole = (...allowedRoles: OrgRole[]) => {
	return async (req: Request, _res: Response, next: NextFunction) => {
		try {
			if (!req.user)
				throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated.");

			const organizationId = resolveOrganizationId(req);

			if (!organizationId) {
				throw new AppError(
					httpStatus.BAD_REQUEST,
					"organizationId is required for role check.",
				);
			}

		const membership = await assertOrgAccess(
			req.user.userId,
			organizationId,
			{
				requireOwner:
					allowedRoles.length === 1 && allowedRoles[0] === "ORG_OWNER",
			},
		);

			if (allowedRoles.length > 0 && !allowedRoles.includes(membership.role)) {
				throw new AppError(
					httpStatus.FORBIDDEN,
					"Forbidden. You don't have permission to access this resource.",
				);
			}

			req.organizationMember = membership;
			next();
		} catch (error) {
			next(error);
		}
	};
};

export const requireOrgMembership = async (
	req: Request,
	_res: Response,
	next: NextFunction,
) => {
	try {
		if (!req.user)
			throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated.");

		const organizationId = resolveOrganizationId(req);

		if (!organizationId) {
			throw new AppError(httpStatus.BAD_REQUEST, "organizationId is required.");
		}

		req.organizationMember = await assertOrgAccess(
			req.user.userId,
			organizationId,
		);
		next();
	} catch (error) {
		next(error);
	}
};
