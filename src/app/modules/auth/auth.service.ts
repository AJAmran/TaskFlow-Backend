import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import httpStatus from "http-status";
import config from "../../config";
import { googleClient } from "../../lib/googleAuth";
import { renderEjsTemplate, transporter } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";
import { redisClient, requireRedis } from "../../lib/redis";
import { AppError } from "../../utils/AppError";
import { jwtUtils } from "../../utils/jwt";
import type { TokenPayload } from "google-auth-library";
import type {
  IChangePasswordPayload,
  IForgotPasswordPayload,
  IGoogleLoginPayload,
  ILoginPayload,
  IRegisterPayload,
  IResetPasswordPayload,
  IVerifyEmailPayload,
} from "./auth.interface";

const buildTokens = (user: {
  id: string;
  email: string;
  name: string;
  platformRole: string;
}) => {
  const payload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    platformRole: user.platformRole,
  };
  const accessToken = jwtUtils.createToken(
    payload,
    config.jwt_access_secret,
    config.jwt_access_expires_in,
  );
  const refreshToken = jwtUtils.createToken(
    payload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in,
  );
  return { accessToken, refreshToken, payload };
};

const sanitizeUser = <T extends { password?: string | null }>(
  user: T,
): Omit<T, "password"> => {
  const { password: _p, ...rest } = user;
  return rest;
};

const OTP_TTL_SECONDS = 600;
const OTP_RESEND_COOLDOWN = 60;

const otpVerifyKey = (email: string) => `otp:verify:${email.toLowerCase()}`;
const otpVerifyCooldownKey = (email: string) =>
  `otp:verify:cooldown:${email.toLowerCase()}`;
const otpResetKey = (email: string) => `otp:reset:${email.toLowerCase()}`;
const otpResetCooldownKey = (email: string) =>
  `otp:reset:cooldown:${email.toLowerCase()}`;

const generateOtp = (): string => crypto.randomInt(100000, 1000000).toString();

const sendVerificationEmail = async (
  email: string,
  otp: string,
  name: string,
): Promise<void> => {
  try {
    const html = await renderEjsTemplate("emailVerification", {
      name,
      otp,
      expiresIn: OTP_TTL_SECONDS / 60,
    });
    await transporter.sendMail({
      from: `"TaskFlow" <${config.email_sender}>`,
      to: email,
      subject: "Verify your TaskFlow email — OTP",
      html,
      text: `Hello ${name}, your TaskFlow OTP is ${otp} (expires in 10 minutes).`,
    });
  } catch (error) {
    try {
      await transporter.sendMail({
        from: `"TaskFlow" <${config.email_sender}>`,
        to: email,
        subject: "Verify your TaskFlow email — OTP",
        html: `<p>Hello ${name}, your OTP is <b>${otp}</b> (10 min).</p>`,
      });
    } catch {}
    console.warn("Failed to send verification email:", (error as Error).message);
  }
};

const sendResetPasswordEmail = async (
  email: string,
  otp: string,
  name: string,
): Promise<void> => {
  try {
    const html = await renderEjsTemplate("resetPassword", {
      name,
      otp,
      expiresIn: OTP_TTL_SECONDS / 60,
    });
    await transporter.sendMail({
      from: `"TaskFlow" <${config.email_sender}>`,
      to: email,
      subject: "Reset your TaskFlow password — OTP",
      html,
      text: `Hello ${name}, your password reset OTP is ${otp} (expires in 10 minutes).`,
    });
  } catch (error) {
    try {
      await transporter.sendMail({
        from: `"TaskFlow" <${config.email_sender}>`,
        to: email,
        subject: "Reset your TaskFlow password — OTP",
        html: `<p>Hello ${name}, your reset OTP is <b>${otp}</b> (10 min).</p>`,
      });
    } catch {}
    console.warn("Failed to send reset email:", (error as Error).message);
  }
};

const register = async (payload: IRegisterPayload) => {
  const email = payload.email.trim().toLowerCase();
  requireRedis();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && !existing.deletedAt) {
    if (!existing.isEmailVerified) {
      const onCooldown = await redisClient.get(otpVerifyCooldownKey(email));
      if (onCooldown) {
        throw new AppError(
          httpStatus.TOO_MANY_REQUESTS,
          `Please wait ${OTP_RESEND_COOLDOWN} seconds before requesting a new OTP`,
        );
      }
      const otp = generateOtp();
      await redisClient.set(otpVerifyKey(email), otp, {
        expiration: { type: "EX", value: OTP_TTL_SECONDS },
      });
      await redisClient.set(otpVerifyCooldownKey(email), "1", {
        expiration: { type: "EX", value: OTP_RESEND_COOLDOWN },
      });
      await sendVerificationEmail(email, otp, existing.name);
      throw new AppError(
        httpStatus.CONFLICT,
        "Account already exists but email not verified. A new OTP has been sent to your email.",
      );
    }
    throw new AppError(
      httpStatus.CONFLICT,
      "User with this email already exists",
    );
  }

  const hashedPassword = await bcrypt.hash(
    payload.password,
    Number(config.bcrypt_salt_rounds),
  );
  const user = await prisma.user.create({
    data: {
      name: payload.name.trim(),
      email,
      password: hashedPassword,
      provider: "credentials",
      platformRole: "USER" as const,
      isEmailVerified: false,
    },
  });

  const otp = generateOtp();
  await redisClient.set(otpVerifyKey(email), otp, {
    expiration: { type: "EX", value: OTP_TTL_SECONDS },
  });
  await redisClient.set(otpVerifyCooldownKey(email), "1", {
    expiration: { type: "EX", value: OTP_RESEND_COOLDOWN },
  });
  await sendVerificationEmail(email, otp, user.name);

  return {
    user: sanitizeUser(user),
    message:
      "Registration successful. OTP sent to email. Please verify within 10 minutes.",
  };
};

const login = async (payload: ILoginPayload) => {
  const email = payload.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.deletedAt)
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password");
  if (!user.password)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This account was created with Google. Please login with Google.",
    );
  if (!user.isActive)
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Your account has been blocked. Please contact support.",
    );
  if (!user.isEmailVerified && user.provider === "credentials" && user.platformRole !== "SUPER_ADMIN") {
    requireRedis();
    const otp = generateOtp();
    const cooldown = await redisClient.get(otpVerifyCooldownKey(email));
    if (!cooldown) {
      await redisClient.set(otpVerifyKey(email), otp, {
        expiration: { type: "EX", value: OTP_TTL_SECONDS },
      });
      await redisClient.set(otpVerifyCooldownKey(email), "1", {
        expiration: { type: "EX", value: OTP_RESEND_COOLDOWN },
      });
      await sendVerificationEmail(email, otp, user.name);
    }
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Email not verified. Please verify your email. An OTP has been sent if not recently.",
    );
  }
  const isMatched = await bcrypt.compare(payload.password, user.password as string);
  if (!isMatched)
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password");
  const tokens = buildTokens(user);
  return { user: sanitizeUser(user), ...tokens };
};

const refreshToken = async (token: string) => {
  const verifiedRefreshToken = jwtUtils.verifyToken(
    token,
    config.jwt_refresh_secret,
  );
  if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      config.node_env === "development"
        ? (verifiedRefreshToken as { success: false; error: string }).error
        : "Invalid refresh token",
    );
  }
  const data = verifiedRefreshToken.data as { userId: string; email: string };
  const user = await prisma.user.findUnique({ where: { id: data.userId } });
  if (!user || user.deletedAt || !user.isActive) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "User is inactive or not found",
    );
  }
  if (user.email !== data.email)
    throw new AppError(httpStatus.UNAUTHORIZED, "Token email mismatch");
  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    platformRole: user.platformRole,
  };
  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in,
  );
  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in,
  );
  return { accessToken, refreshToken };
};

const googleLogin = async (payload: IGoogleLoginPayload) => {
  let googlePayload: TokenPayload | undefined;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: payload.idToken,
      audience: config.google_client_id,
    });
    googlePayload = ticket.getPayload();
  } catch {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Invalid or expired Google ID token",
    );
  }
  if (!googlePayload?.email || !googlePayload?.name || !googlePayload?.sub)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Google token is missing required fields",
    );
  const email = googlePayload.email.trim().toLowerCase();
  const name = googlePayload.name;
  const googleId = googlePayload.sub;
  const profileImage = googlePayload.picture;
  let user = await prisma.user.findUnique({ where: { googleId } });
  if (!user) {
    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail) {
      if (existingByEmail.deletedAt || !existingByEmail.isActive)
        throw new AppError(
          httpStatus.FORBIDDEN,
          "Your account is blocked or deleted",
        );
      if (!existingByEmail.googleId) {
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            googleId,
            provider:
              existingByEmail.provider === "credentials"
                ? "credentials"
                : "google",
            profileImage: existingByEmail.profileImage || profileImage,
            isEmailVerified: true,
            emailVerifiedAt: new Date(),
          },
        });
        try {
          await redisClient.del(otpVerifyKey(email));
        } catch {}
      } else {
        if (!existingByEmail.isEmailVerified) {
          user = await prisma.user.update({
            where: { id: existingByEmail.id },
            data: { isEmailVerified: true, emailVerifiedAt: new Date() },
          });
        } else user = existingByEmail;
      }
    } else {
      user = await prisma.user.create({
        data: {
          name,
          email,
          provider: "google",
          googleId,
          profileImage,
          platformRole: "USER" as const,
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });
    }
  }
  if (!user || user.deletedAt || !user.isActive)
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Your account is blocked or deleted",
    );
  if (!user.isEmailVerified) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { isEmailVerified: true, emailVerifiedAt: new Date() },
    });
    try {
      await redisClient.del(otpVerifyKey(email));
    } catch {}
  }
  const tokens = buildTokens(user);
  return { user: sanitizeUser(user), ...tokens };
};

const changePassword = async (
  userId: string,
  payload: IChangePasswordPayload,
) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt)
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  if (!user.password)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Google accounts cannot change password. Please set a password via reset flow.",
    );
  const isOldMatched = await bcrypt.compare(payload.oldPassword, user.password);
  if (!isOldMatched)
    throw new AppError(httpStatus.UNAUTHORIZED, "Old password is incorrect");
  if (payload.oldPassword === payload.newPassword)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "New password must be different from old password",
    );
  const hashedNew = await bcrypt.hash(
    payload.newPassword,
    Number(config.bcrypt_salt_rounds),
  );
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedNew },
  });
  return null;
};

const verifyEmail = async (payload: IVerifyEmailPayload) => {
  const email = payload.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.deletedAt)
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  if (user.isEmailVerified)
    throw new AppError(httpStatus.BAD_REQUEST, "Email already verified");
  if (!user.isActive)
    throw new AppError(httpStatus.FORBIDDEN, "Account is blocked");
  requireRedis();
  const storedOtp = await redisClient.get(otpVerifyKey(email));
  if (!storedOtp)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "OTP expired or not found. Please request a new one.",
    );
  if (storedOtp !== payload.otp.trim())
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid OTP");
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { isEmailVerified: true, emailVerifiedAt: new Date() },
  });
  await redisClient.del(otpVerifyKey(email));
  await redisClient.del(otpVerifyCooldownKey(email));
  const tokens = buildTokens(updated);
  return { user: sanitizeUser(updated), ...tokens };
};

const resendOtp = async (emailRaw: string) => {
  const email = emailRaw.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.deletedAt)
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  if (user.isEmailVerified)
    throw new AppError(httpStatus.BAD_REQUEST, "Email already verified");
  if (!user.isActive)
    throw new AppError(httpStatus.FORBIDDEN, "Account is blocked");
  requireRedis();
  const cooldown = await redisClient.get(otpVerifyCooldownKey(email));
  if (cooldown)
    throw new AppError(
      httpStatus.TOO_MANY_REQUESTS,
      `Please wait ${OTP_RESEND_COOLDOWN} seconds before requesting a new OTP`,
    );
  const otp = generateOtp();
  await redisClient.set(otpVerifyKey(email), otp, {
    expiration: { type: "EX", value: OTP_TTL_SECONDS },
  });
  await redisClient.set(otpVerifyCooldownKey(email), "1", {
    expiration: { type: "EX", value: OTP_RESEND_COOLDOWN },
  });
  await sendVerificationEmail(email, otp, user.name);
  return { message: "OTP resent to email" };
};

const forgotPassword = async (payload: IForgotPasswordPayload) => {
  const email = payload.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.deletedAt)
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  if (!user.isActive)
    throw new AppError(httpStatus.FORBIDDEN, "Account is blocked");
  if (user.provider === "google" && !user.password)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Google account has no password. Please login with Google or set password after verifying email.",
    );
  requireRedis();
  const cooldown = await redisClient.get(otpResetCooldownKey(email));
  if (cooldown)
    throw new AppError(
      httpStatus.TOO_MANY_REQUESTS,
      `Please wait ${OTP_RESEND_COOLDOWN} seconds before requesting a new OTP`,
    );
  const otp = generateOtp();
  await redisClient.set(otpResetKey(email), otp, {
    expiration: { type: "EX", value: OTP_TTL_SECONDS },
  });
  await redisClient.set(otpResetCooldownKey(email), "1", {
    expiration: { type: "EX", value: OTP_RESEND_COOLDOWN },
  });
  await sendResetPasswordEmail(email, otp, user.name);
  return { message: "Password reset OTP sent to email" };
};

const resetPassword = async (payload: IResetPasswordPayload) => {
  const email = payload.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.deletedAt)
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  if (!user.isActive)
    throw new AppError(httpStatus.FORBIDDEN, "Account is blocked");
  requireRedis();
  const storedOtp = await redisClient.get(otpResetKey(email));
  if (!storedOtp)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "OTP expired or not found. Please request a new one.",
    );
  if (storedOtp !== payload.otp.trim())
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid OTP");
  const hashed = await bcrypt.hash(
    payload.newPassword,
    Number(config.bcrypt_salt_rounds),
  );
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed },
  });
  await redisClient.del(otpResetKey(email));
  await redisClient.del(otpResetCooldownKey(email));
  return {
    message: "Password reset successful. Please login with new password.",
  };
};

const getMe = async (userId: string) => {
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
  if (!user || user.deletedAt)
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  return user;
};

export const AuthService = {
  register,
  login,
  refreshToken,
  googleLogin,
  verifyEmail,
  resendOtp,
  forgotPassword,
  resetPassword,
  changePassword,
  getMe,
};
