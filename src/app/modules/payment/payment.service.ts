import crypto from "node:crypto";
import httpStatus from "http-status";
import {
	SubscriptionPlan,
	SubscriptionStatus,
} from "../../../generated/prisma/enums";
import { Prisma } from "../../../generated/prisma/client";
import { assertOrgAccess } from "../../middleware/auth";
import {
	createBkashPayment,
	executeBkashPayment,
	queryBkashPayment,
} from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";

const PLAN_CATALOG = {
	[SubscriptionPlan.PRO]: {
		amount: 500,
		maxProjects: 20,
		maxMembers: 50,
		days: 30,
	},
	[SubscriptionPlan.TEAM]: {
		amount: 1000,
		maxProjects: 50,
		maxMembers: 200,
		days: 30,
	},
} as const;

type PaidPlan = keyof typeof PLAN_CATALOG;

const ensureOwner = (userId: string, organizationId: string) =>
	assertOrgAccess(userId, organizationId, { requireOwner: true });

const ensureMember = (userId: string, organizationId: string) =>
	assertOrgAccess(userId, organizationId);

const sanitizePayment = <T extends { gatewayResponse?: unknown }>(payment: T) => {
	const { gatewayResponse: _dropped, ...rest } = payment;
	return rest;
};

const confirmSuccess = async (
	paymentId: string,
	gatewayResponse: unknown,
	actorUserId: string,
	trxID?: string,
	gatewayAmount?: string,
	gatewayCurrency?: string,
) => {
	const plan = (gatewayResponse as { plan?: SubscriptionPlan } | null)?.plan;
	const catalog =
		plan && plan in PLAN_CATALOG ? PLAN_CATALOG[plan as PaidPlan] : null;

	return prisma.$transaction(async (tx) => {
		const payment = await tx.payment.findUnique({ where: { id: paymentId } });
		if (!payment) throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
		if (payment.status === "SUCCESS") return payment;

		if (
			gatewayAmount !== undefined &&
			Number(gatewayAmount) !== Number(payment.amount)
		) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				`Payment amount mismatch: charged ${gatewayAmount}, expected ${payment.amount}. Contact support.`,
			);
		}
		if (
			gatewayCurrency &&
			gatewayCurrency !== payment.currency &&
			catalog
		) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				`Payment currency mismatch: charged ${gatewayCurrency}, expected ${payment.currency}. Contact support.`,
			);
		}

		const updated = await tx.payment.update({
			where: { id: paymentId },
			data: {
				status: "SUCCESS",
				trxID,
				gatewayResponse: gatewayResponse as Prisma.InputJsonValue,
			},
		});

		if (catalog && plan) {
			await tx.subscription.update({
				where: { organizationId: payment.organizationId },
				data: {
					plan,
					status: SubscriptionStatus.ACTIVE,
					maxProjects: catalog.maxProjects,
					maxMembers: catalog.maxMembers,
					currentPeriodEnd: new Date(
						Date.now() + catalog.days * 24 * 60 * 60 * 1000,
					),
				},
			});
		}

		await tx.activityLog.create({
			data: {
				userId: actorUserId,
				action: "PAYMENT_SUCCESS",
				meta: {
					paymentId,
					organizationId: payment.organizationId,
					trxID,
					plan: plan ?? null,
				},
			},
		});

		return updated;
	});
};

const verifyWithGateway = async (bkashPaymentID: string) => {
	const executed = await executeBkashPayment(bkashPaymentID);
	let queried: Awaited<ReturnType<typeof queryBkashPayment>> | null = null;
	try {
		queried = await queryBkashPayment(bkashPaymentID);
	} catch {}
	const success =
		executed.transactionStatus === "Completed" ||
		executed.statusCode === "0000" ||
		queried?.transactionStatus === "Completed";
	const trxID = executed.trxID || (queried?.trxID as string | undefined);
	return { executed, queried, success, trxID };
};

const markFailed = (paymentId: string, gatewayResponse: unknown) =>
	prisma.payment.update({
		where: { id: paymentId },
		data: {
			status: "FAILED",
			gatewayResponse: gatewayResponse as Prisma.InputJsonValue,
		},
	});

const initiate = async (
	userId: string,
	payload: { organizationId: string; plan: PaidPlan },
) => {
	await ensureOwner(userId, payload.organizationId);

	const subscription = await prisma.subscription.findUnique({
		where: { organizationId: payload.organizationId },
	});
	if (!subscription)
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Organization subscription not found",
		);

	const catalog = PLAN_CATALOG[payload.plan];

	const local = await prisma.payment.create({
		data: {
			subscriptionId: subscription.id,
			organizationId: payload.organizationId,
			amount: new Prisma.Decimal(catalog.amount),
			currency: "BDT",
			paymentID: `tmp-${crypto.randomUUID()}`,
			status: "PENDING",
			gatewayResponse: { plan: payload.plan },
		},
	});

	let bkash: Awaited<ReturnType<typeof createBkashPayment>>;
	try {
		bkash = await createBkashPayment({
			amount: catalog.amount,
			merchantInvoiceNumber: local.id,
		});
	} catch {
		await prisma.payment.update({
			where: { id: local.id },
			data: {
				status: "FAILED",
				gatewayResponse: {
					plan: payload.plan,
					error: "Payment gateway request failed",
				},
			},
		});
		throw new AppError(
			httpStatus.BAD_GATEWAY,
			"bKash payment creation failed. Please try again.",
		);
	}

	const payment = await prisma.payment.update({
		where: { id: local.id },
		data: {
			paymentID: bkash.paymentID,
			gatewayResponse: { plan: payload.plan, create: bkash },
		},
	});

	return { payment: sanitizePayment(payment), bkashURL: bkash.bkashURL };
};

const execute = async (userId: string, paymentID: string) => {
	const scoped = await prisma.payment.findFirst({
		where: {
			paymentID,
			organization: { members: { some: { userId, deletedAt: null } } },
		},
	});
	if (!scoped) throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
	await ensureOwner(userId, scoped.organizationId);
	const existing = scoped;

	if (existing.status === "SUCCESS") {
		return {
			payment: sanitizePayment(existing),
			message: "Payment already processed",
		};
	}

	const { executed, queried, success, trxID } =
		await verifyWithGateway(paymentID);
	const gatewayResponse = {
		...(existing.gatewayResponse as object),
		execute: executed,
		query: queried,
	};

	if (!success) {
		const payment = await markFailed(existing.id, gatewayResponse);
		return {
			payment: sanitizePayment(payment),
			message: "Payment not completed at gateway",
		};
	}

	const payment = await confirmSuccess(
		existing.id,
		gatewayResponse,
		userId,
		trxID,
		executed.amount,
		executed.currency,
	);
	return {
		payment: sanitizePayment(payment),
		message: "Payment verified and subscription upgraded",
	};
};

const handleCallback = async (query: {
	paymentID?: string;
	status?: string;
}) => {
	const { paymentID, status } = query;
	if (!paymentID)
		throw new AppError(httpStatus.BAD_REQUEST, "paymentID is required");

	const existing = await prisma.payment.findUnique({ where: { paymentID } });
	if (!existing) throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
	if (existing.status === "SUCCESS") {
		return {
			payment: sanitizePayment(existing),
			message: "Payment already processed",
		};
	}

	if (status !== "success") {
		const payment = await prisma.payment.update({
			where: { id: existing.id },
			data: {
				status: status === "cancel" ? "CANCELLED" : "FAILED",
				gatewayResponse: {
					...(existing.gatewayResponse as object),
					callback: query,
				},
			},
		});
		return {
			payment: sanitizePayment(payment),
			message: `Payment ${payment.status.toLowerCase()} via gateway callback`,
		};
	}

	const { executed, queried, success, trxID } =
		await verifyWithGateway(paymentID);
	const gatewayResponse = {
		...(existing.gatewayResponse as object),
		execute: executed,
		query: queried,
		callback: query,
	};

	if (!success) {
		const payment = await markFailed(existing.id, gatewayResponse);
		return {
			payment: sanitizePayment(payment),
			message: "Payment not completed at gateway",
		};
	}

	const organization = await prisma.organization.findUnique({
		where: { id: existing.organizationId },
		select: { ownerUserId: true },
	});
	if (!organization)
		throw new AppError(httpStatus.NOT_FOUND, "Organization not found");
	const payment = await confirmSuccess(
		existing.id,
		gatewayResponse,
		organization.ownerUserId,
		trxID,
		executed.amount,
		executed.currency,
	);
	return {
		payment: sanitizePayment(payment),
		message: "Payment verified and subscription upgraded",
	};
};

const getById = async (userId: string, id: string) => {
	const payment = await prisma.payment.findFirst({
		where: {
			id,
			organization: { members: { some: { userId, deletedAt: null } } },
		},
	});
	if (!payment) throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
	return sanitizePayment(payment);
};

const getSubscription = async (userId: string, organizationId: string) => {
	await ensureMember(userId, organizationId);
	const subscription = await prisma.subscription.findUnique({
		where: { organizationId },
		include: {
			payments: {
				orderBy: { createdAt: "desc" },
				take: 10,
				select: {
					id: true,
					amount: true,
					currency: true,
					status: true,
					trxID: true,
					createdAt: true,
				},
			},
		},
	});
	if (!subscription)
		throw new AppError(httpStatus.NOT_FOUND, "Subscription not found");
	return subscription;
};

export const PaymentService = {
	initiate,
	execute,
	handleCallback,
	getById,
	getSubscription,
	PLAN_CATALOG,
};
