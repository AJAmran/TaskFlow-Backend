import crypto from "crypto";
import httpStatus from "http-status";
import { OrgRole, SubscriptionPlan, SubscriptionStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { calculatePagination } from "../../utils/pagination";

// helpers
const slugify = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const generateInviteToken = () => crypto.randomBytes(32).toString("hex");

// Organization
const createOrganization = async (userId: string, payload: { name: string; slug?: string }) => {
  const baseSlug = payload.slug ? payload.slug.toLowerCase().trim() : slugify(payload.name);
  let slug = baseSlug;
  let attempt = 0;

  // ensure unique slug — try suffix if taken
  while (true) {
    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (!existing) break;
    attempt += 1;
    if (attempt > 5) {
      slug = `${baseSlug}-${crypto.randomBytes(3).toString("hex")}`;
      break;
    }
    slug = `${baseSlug}-${crypto.randomBytes(2).toString("hex")}`;
  }

  const result = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: payload.name.trim(),
        slug,
        ownerUserId: userId,
      },
    });

    const subscription = await tx.subscription.create({
      data: {
        organizationId: organization.id,
        plan: SubscriptionPlan.FREE,
        status: SubscriptionStatus.ACTIVE,
        maxProjects: 3,
        maxMembers: 5,
      },
    });

    const membership = await tx.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId,
        role: OrgRole.ORG_OWNER,
        joinedAt: new Date(),
      },
    });

    await tx.activityLog.create({
      data: {
        userId,
        action: "ORGANIZATION_CREATED",
        meta: { organizationId: organization.id, slug },
      },
    });

    return { organization, subscription, membership };
  });

  return result;
};

const getMyOrganizations = async (userId: string, query: { page?: number; limit?: number }) => {
  const { page, limit, skip } = calculatePagination(query);
  const where = {
    userId,
    deletedAt: null,
    organization: { deletedAt: null },
  };

  const [memberships, total] = await Promise.all([
    prisma.organizationMember.findMany({
      where,
      include: {
        organization: {
          include: {
            subscription: true,
            _count: { select: { members: { where: { deletedAt: null } }, projects: { where: { deletedAt: null } } } },
          },
        },
      },
      skip,
      take: limit,
      orderBy: { invitedAt: "desc" },
    }),
    prisma.organizationMember.count({ where }),
  ]);

  const data = (memberships as unknown as Array<{ id: string; role: OrgRole; joinedAt: Date | null; organization: unknown }>).map(
    (m) => ({
      membershipId: m.id,
      role: m.role,
      joinedAt: m.joinedAt,
      organization: m.organization,
    }),
  );

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const getOrganizationById = async (userId: string, organizationId: string) => {
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
  if (!membership || membership.deletedAt) {
    throw new AppError(httpStatus.FORBIDDEN, "You are not a member of this organization");
  }

  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    include: {
      subscription: true,
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { members: { where: { deletedAt: null } }, teams: { where: { deletedAt: null } }, projects: { where: { deletedAt: null } } } },
    },
  });
  if (!organization) throw new AppError(httpStatus.NOT_FOUND, "Organization not found");

  return { organization, myRole: membership.role };
};

const updateOrganization = async (
  userId: string,
  organizationId: string,
  payload: { name?: string; slug?: string },
) => {
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
  if (!membership || membership.deletedAt) {
    throw new AppError(httpStatus.FORBIDDEN, "You are not a member of this organization");
  }
  if (membership.role !== OrgRole.ORG_OWNER) {
    throw new AppError(httpStatus.FORBIDDEN, "Only ORG_OWNER can update organization");
  }

  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
  });
  if (!organization) throw new AppError(httpStatus.NOT_FOUND, "Organization not found");

  if (payload.slug) {
    const slug = payload.slug.toLowerCase().trim();
    if (slug !== organization.slug) {
      const exists = await prisma.organization.findUnique({ where: { slug } });
      if (exists) throw new AppError(httpStatus.CONFLICT, "Slug already taken");
    }
    payload.slug = slug;
  }

  const updated = await prisma.organization.update({
    where: { id: organizationId },
    data: {
      ...(payload.name && { name: payload.name.trim() }),
      ...(payload.slug && { slug: payload.slug }),
    },
  });

  await prisma.activityLog.create({
    data: {
      userId,
      action: "ORGANIZATION_UPDATED",
      meta: { organizationId, changes: payload },
    },
  });

  return updated;
};

// Invitation
const inviteMember = async (
  invitedById: string,
  organizationId: string,
  payload: { email: string; role?: OrgRole },
) => {
  const email = payload.email.toLowerCase().trim();
  const role = payload.role || OrgRole.MEMBER;

  // verify inviter is ORG_OWNER
  const inviterMembership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: invitedById } },
  });
  if (!inviterMembership || inviterMembership.deletedAt) {
    throw new AppError(httpStatus.FORBIDDEN, "You are not a member of this organization");
  }
  if (inviterMembership.role !== OrgRole.ORG_OWNER) {
    throw new AppError(httpStatus.FORBIDDEN, "Only ORG_OWNER can invite members");
  }

  const organization = await prisma.organization.findFirst({ where: { id: organizationId, deletedAt: null } });
  if (!organization) throw new AppError(httpStatus.NOT_FOUND, "Organization not found");

  // check if target user already member (if user exists)
  const targetUser = await prisma.user.findUnique({ where: { email } });
  if (targetUser) {
    const existingMember = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: targetUser.id } },
    });
    if (existingMember && !existingMember.deletedAt) {
      throw new AppError(httpStatus.CONFLICT, "User is already a member of this organization");
    }
  }

  // check pending invitation
  const existingInvite = await prisma.organizationInvitation.findUnique({
    where: { organizationId_email: { organizationId, email } },
  });
  if (existingInvite && !existingInvite.acceptedAt && new Date(existingInvite.expiresAt) > new Date()) {
    throw new AppError(httpStatus.CONFLICT, "An active invitation already exists for this email");
  }

  // optional early limit check (soft)
  // we allow invite even at limit but warn; acceptance will enforce
  const subscription = await prisma.subscription.findUnique({ where: { organizationId } });
  const memberCount = await prisma.organizationMember.count({ where: { organizationId, deletedAt: null } });
  if (subscription && memberCount >= subscription.maxMembers) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      `Organization member limit reached (${subscription.maxMembers}) for ${subscription.plan} plan. Please upgrade.`,
    );
  }

  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // if expired invite exists, delete it to allow re-invite (upsert)
  if (existingInvite) {
    await prisma.organizationInvitation.delete({ where: { id: existingInvite.id } });
  }

  const invitation = await prisma.organizationInvitation.create({
    data: {
      organizationId,
      email,
      role,
      token,
      expiresAt,
      invitedById,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: invitedById,
      action: "MEMBER_INVITED",
      meta: { organizationId, email, role, invitationId: invitation.id },
    },
  });

  // Try to send email — don't fail if fails
  try {
    const { transporter } = await import("../../lib/nodemailer");
    const { default: config } = await import("../../config");
    const inviteLink = `${config.frontend_url || config.backend_url}/invite?token=${token}`;
    await transporter.sendMail({
      from: `"TaskFlow" <${config.email_sender}>`,
      to: email,
      subject: `You've been invited to join ${organization.name} on TaskFlow`,
      html: `<p>Hello,</p><p>You've been invited to join <b>${organization.name}</b> as <b>${role}</b>.</p><p>Invite token: <code>${token}</code></p><p>Or click: <a href="${inviteLink}">${inviteLink}</a></p><p>Expires in 7 days.</p>`,
      text: `You've been invited to join ${organization.name} as ${role}. Token: ${token}. Expires in 7 days.`,
    });
  } catch (e) {
    console.warn("⚠️  Invite email failed:", (e as Error).message);
  }

  return invitation;
};

const acceptInvite = async (userId: string, token: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  const invitation = await prisma.organizationInvitation.findUnique({ where: { token } });
  if (!invitation) throw new AppError(httpStatus.NOT_FOUND, "Invalid invitation token");
  if (invitation.acceptedAt) throw new AppError(httpStatus.BAD_REQUEST, "Invitation already accepted");
  if (new Date(invitation.expiresAt) < new Date()) throw new AppError(httpStatus.BAD_REQUEST, "Invitation has expired");

  if (invitation.email.toLowerCase().trim() !== user.email.toLowerCase().trim()) {
    throw new AppError(httpStatus.FORBIDDEN, "Invitation email does not match your account email");
  }

  const result = await prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.findUnique({ where: { organizationId: invitation.organizationId } });
    if (!subscription) throw new AppError(httpStatus.NOT_FOUND, "Organization subscription not found");

    const memberCount = await tx.organizationMember.count({
      where: { organizationId: invitation.organizationId, deletedAt: null },
    });
    if (memberCount >= subscription.maxMembers) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        `Member limit reached (${subscription.maxMembers}) for ${subscription.plan} plan. Please upgrade.`,
      );
    }

    const existing = await tx.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: invitation.organizationId, userId } },
    });
    if (existing && !existing.deletedAt) {
      throw new AppError(httpStatus.CONFLICT, "You are already a member of this organization");
    }

    // if soft-deleted membership exists, restore it
    let membership;
    if (existing && existing.deletedAt) {
      membership = await tx.organizationMember.update({
        where: { id: existing.id },
        data: { deletedAt: null, role: invitation.role, joinedAt: new Date() },
      });
    } else {
      membership = await tx.organizationMember.create({
        data: {
          organizationId: invitation.organizationId,
          userId,
          role: invitation.role,
          joinedAt: new Date(),
        },
      });
    }

    await tx.organizationInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    await tx.activityLog.create({
      data: {
        userId,
        action: "INVITATION_ACCEPTED",
        meta: { organizationId: invitation.organizationId, invitationId: invitation.id, role: invitation.role },
      },
    });

    return membership;
  });

  return result;
};

// ---------- Members ----------
const listMembers = async (
  requesterId: string,
  organizationId: string,
  query: { page?: number; limit?: number },
) => {
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: requesterId } },
  });
  if (!membership || membership.deletedAt) {
    throw new AppError(httpStatus.FORBIDDEN, "You are not a member of this organization");
  }

  const { page, limit, skip } = calculatePagination(query);
  const where = { organizationId, deletedAt: null };

  const [members, total] = await Promise.all([
    prisma.organizationMember.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true, profileImage: true, platformRole: true, isActive: true } } },
      skip,
      take: limit,
      orderBy: { invitedAt: "asc" },
    }),
    prisma.organizationMember.count({ where }),
  ]);

  return {
    data: members,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const updateMemberRole = async (
  requesterId: string,
  organizationId: string,
  targetUserId: string,
  newRole: OrgRole,
) => {
  const requesterMembership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: requesterId } },
  });
  if (!requesterMembership || requesterMembership.deletedAt) {
    throw new AppError(httpStatus.FORBIDDEN, "You are not a member of this organization");
  }
  if (requesterMembership.role !== OrgRole.ORG_OWNER) {
    throw new AppError(httpStatus.FORBIDDEN, "Only ORG_OWNER can update member roles");
  }

  const target = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: targetUserId } },
  });
  if (!target || target.deletedAt) throw new AppError(httpStatus.NOT_FOUND, "Member not found");

  if (target.role === newRole) return target;

  // prevent demoting last owner
  if (target.role === OrgRole.ORG_OWNER && newRole === OrgRole.MEMBER) {
    const ownerCount = await prisma.organizationMember.count({
      where: { organizationId, role: OrgRole.ORG_OWNER, deletedAt: null },
    });
    if (ownerCount <= 1) {
      throw new AppError(httpStatus.BAD_REQUEST, "Cannot demote the last ORG_OWNER");
    }
  }

  const updated = await prisma.organizationMember.update({
    where: { id: target.id },
    data: { role: newRole },
  });

  await prisma.activityLog.create({
    data: {
      userId: requesterId,
      action: "MEMBER_ROLE_UPDATED",
      meta: { organizationId, targetUserId, oldRole: target.role, newRole },
    },
  });

  return updated;
};

const removeMember = async (requesterId: string, organizationId: string, targetUserId: string) => {
  const requesterMembership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: requesterId } },
  });
  if (!requesterMembership || requesterMembership.deletedAt) {
    throw new AppError(httpStatus.FORBIDDEN, "You are not a member of this organization");
  }
  if (requesterMembership.role !== OrgRole.ORG_OWNER) {
    throw new AppError(httpStatus.FORBIDDEN, "Only ORG_OWNER can remove members");
  }

  if (requesterId === targetUserId) {
    throw new AppError(httpStatus.BAD_REQUEST, "You cannot remove yourself");
  }

  const target = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: targetUserId } },
  });
  if (!target || target.deletedAt) throw new AppError(httpStatus.NOT_FOUND, "Member not found");

  // if target is owner, ensure at least one owner remains
  if (target.role === OrgRole.ORG_OWNER) {
    const ownerCount = await prisma.organizationMember.count({
      where: { organizationId, role: OrgRole.ORG_OWNER, deletedAt: null },
    });
    if (ownerCount <= 1) {
      throw new AppError(httpStatus.BAD_REQUEST, "Cannot remove the last ORG_OWNER");
    }
  }

  // prevent removing org ownerUserId? allow but we already check owner count
  const updated = await prisma.organizationMember.update({
    where: { id: target.id },
    data: { deletedAt: new Date() },
  });

  await prisma.activityLog.create({
    data: {
      userId: requesterId,
      action: "MEMBER_REMOVED",
      meta: { organizationId, targetUserId },
    },
  });

  return updated;
};

export const OrganizationService = {
  createOrganization,
  getMyOrganizations,
  getOrganizationById,
  updateOrganization,
  inviteMember,
  acceptInvite,
  listMembers,
  updateMemberRole,
  removeMember,
};
