import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import config from "../config";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/AppError";
import { jwtUtils } from "../utils/jwt";
import { OrgRole, PlatformRole } from "../../generated/prisma/enums";

export interface RequestUser {
  userId: string;
  email: string;
  name: string;
  platformRole: PlatformRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}

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

    const { userId, email, name, platformRole } = verified.data as {
      userId: string;
      email: string;
      name: string;
      platformRole: PlatformRole;
    };

    if (!userId || !email) {
      throw new AppError(httpStatus.UNAUTHORIZED, "Invalid token payload.");
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt) {
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

    req.user = { userId, email, name, platformRole };
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


      if (
        req.user.platformRole === PlatformRole.SUPER_ADMIN &&
        allowedRoles.includes(OrgRole.ORG_OWNER as unknown as OrgRole)
      ) {

      }

      const organizationId =
        (req.params.organizationId as string) ||
        (req.params.orgId as string) ||
        (req.body?.organizationId as string) ||
        (req.query?.organizationId as string);

      if (!organizationId) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "organizationId is required for role check.",
        );
      }

      const membership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: { organizationId, userId: req.user.userId },
        },
      });

      if (!membership || membership.deletedAt) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "You are not a member of this organization.",
        );
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(membership.role)) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "Forbidden. You don't have permission to access this resource.",
        );
      }

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

    const organizationId =
      (req.params.organizationId as string) ||
      (req.params.orgId as string) ||
      (req.body?.organizationId as string) ||
      (req.query?.organizationId as string);

    if (!organizationId) {
      throw new AppError(httpStatus.BAD_REQUEST, "organizationId is required.");
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId: req.user.userId },
      },
    });

    if (!membership || membership.deletedAt) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You are not a member of this organization.",
      );
    }


    (req as unknown as Record<string, unknown>).organizationMember = membership;
    next();
  } catch (error) {
    next(error);
  }
};

export const auth = (...requiredRoles: (OrgRole | PlatformRole)[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    await authenticate(req, res, (err?: unknown) => {
      if (err) return next(err);

      if (requiredRoles.length === 0) return next();

      const wantsSuperAdmin = requiredRoles.includes(
        PlatformRole.SUPER_ADMIN as unknown as OrgRole,
      );
      if (wantsSuperAdmin) {
        return requireSuperAdmin(req, res, next);
      }

      const orgRoles = requiredRoles as OrgRole[];
      return requireRole(...orgRoles)(req, res, next);
    });
  };
};
