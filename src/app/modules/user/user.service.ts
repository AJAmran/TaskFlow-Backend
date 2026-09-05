import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";

const getProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    omit: { password: true },
    include: {
      memberships: {
        where: { deletedAt: null },
        include: {
          organization: {
            select: { id: true, name: true, slug: true, status: true },
          },
        },
      },
    },
  });
  if (!user || user.deletedAt) throw new AppError(httpStatus.NOT_FOUND, "User not found");
  return user;
};

const updateProfile = async (userId: string, payload: { name?: string; profileImage?: string }) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(payload.name !== undefined && { name: payload.name.trim() }),
      ...(payload.profileImage !== undefined && { profileImage: payload.profileImage }),
    },
    omit: { password: true },
  });
  return updated;
};

export const UserService = {
  getProfile,
  updateProfile,
};
