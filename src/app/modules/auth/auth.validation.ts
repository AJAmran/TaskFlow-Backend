import { z } from "zod";

const registerSchema = z.object({
	name: z
		.string({ message: "Name is required" })
		.trim()
		.min(2, "Name must be at least 2 characters")
		.max(50, "Name must be at most 50 characters"),
	email: z.string().trim().toLowerCase().pipe(z.email("Invalid email format")),
	password: z
		.string({ message: "Password is required" })
		.min(8, "Password must be at least 8 characters")
		.regex(/[a-z]/, "Password must contain at least 1 lowercase letter")
		.regex(/[A-Z]/, "Password must contain at least 1 uppercase letter")
		.regex(/[0-9]/, "Password must contain at least 1 number")
		.regex(
			/[^A-Za-z0-9]/,
			"Password must contain at least 1 special character",
		),
});

const loginSchema = z.object({
	email: z.string().trim().toLowerCase().pipe(z.email("Invalid email format")),
	password: z
		.string({ message: "Password is required" })
		.min(1, "Password is required"),
});

const googleLoginSchema = z.object({
	idToken: z
		.string({ message: "Google idToken is required" })
		.min(10, "Invalid idToken"),
});

const verifyEmailSchema = z.object({
	email: z.string().trim().toLowerCase().pipe(z.email("Invalid email format")),
	otp: z
		.string()
		.trim()
		.length(6, "OTP must be 6 digits")
		.regex(/^\d{6}$/, "OTP must be 6 digits"),
});

const resendOtpSchema = z.object({
	email: z.string().trim().toLowerCase().pipe(z.email("Invalid email format")),
});

const forgotPasswordSchema = z.object({
	email: z.string().trim().toLowerCase().pipe(z.email("Invalid email format")),
});

const resetPasswordSchema = z.object({
	email: z.string().trim().toLowerCase().pipe(z.email("Invalid email format")),
	otp: z
		.string()
		.trim()
		.length(6, "OTP must be 6 digits")
		.regex(/^\d{6}$/, "OTP must be 6 digits"),
	newPassword: z
		.string({ message: "New password is required" })
		.min(8, "Password must be at least 8 characters")
		.regex(/[a-z]/, "Password must contain at least 1 lowercase letter")
		.regex(/[A-Z]/, "Password must contain at least 1 uppercase letter")
		.regex(/[0-9]/, "Password must contain at least 1 number")
		.regex(
			/[^A-Za-z0-9]/,
			"Password must contain at least 1 special character",
		),
});

const changePasswordSchema = z.object({
	oldPassword: z.string({ message: "Old password is required" }).min(1),
	newPassword: z
		.string({ message: "New password is required" })
		.min(8, "Password must be at least 8 characters")
		.regex(/[a-z]/, "Password must contain at least 1 lowercase letter")
		.regex(/[A-Z]/, "Password must contain at least 1 uppercase letter")
		.regex(/[0-9]/, "Password must contain at least 1 number")
		.regex(
			/[^A-Za-z0-9]/,
			"Password must contain at least 1 special character",
		),
});

export const AuthValidation = {
	registerSchema,
	loginSchema,
	googleLoginSchema,
	verifyEmailSchema,
	resendOtpSchema,
	forgotPasswordSchema,
	resetPasswordSchema,
	changePasswordSchema,
};
