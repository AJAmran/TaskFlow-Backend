import config from "../config";
import { redisClient } from "./redis";

const ID_TOKEN_KEY = "bkash:id_token";
const ID_TOKEN_TTL = 3500;
const REQUEST_TIMEOUT_MS = 15000;

export type BkashGrantResult = {
	id_token: string;
	token_type: string;
	expires_in: number;
};

export type BkashCreateResult = {
	paymentID: string;
	bkashURL: string;
	callbackURL: string;
	success: boolean;
	statusCode: string;
	statusMessage: string;
};

export type BkashExecuteResult = {
	paymentID: string;
	trxID?: string;
	transactionStatus?: string;
	amount?: string;
	currency?: string;
	statusCode?: string;
	statusMessage?: string;
	[key: string]: unknown;
};

const baseUrl = () => config.bkash_base_url.replace(/\/$/, "");

/**
 * 2026: axios-এর বদলে native fetch (Node 22+ stable)।
 * একটা dep কমে, timeout AbortController দিয়ে।
 */
const postJson = async <T>(
	url: string,
	body: unknown,
	headers: Record<string, string>,
): Promise<T> => {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const res = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json", ...headers },
			body: JSON.stringify(body),
			signal: controller.signal,
		});
		if (res.status === 401) {
			const err = new Error(`bKash unauthorized (401): ${url}`) as Error & {
				status?: number;
			};
			err.status = 401;
			throw err;
		}
		if (!res.ok) {
			const text = await res.text().catch(() => "");
			throw new Error(`bKash request failed (${res.status}): ${text}`);
		}
		return (await res.json()) as T;
	} finally {
		clearTimeout(timer);
	}
};

export const grantIdToken = async (force = false): Promise<string> => {
	if (!force) {
		try {
			if (redisClient.isOpen) {
				const cached = await redisClient.get(ID_TOKEN_KEY);
				if (cached) return cached;
			}
		} catch {}
	}

	const data = await postJson<BkashGrantResult>(
		`${baseUrl()}/tokenized/checkout/token/grant`,
		{ app_key: config.bkash_app_key, app_secret: config.bkash_app_secret },
		{ username: config.bkash_username, password: config.bkash_password },
	);

	if (!data?.id_token) throw new Error("bKash grant token failed: no id_token in response");

	try {
		if (redisClient.isOpen) {
			await redisClient.set(ID_TOKEN_KEY, data.id_token, {
				expiration: { type: "EX", value: ID_TOKEN_TTL },
			});
		}
	} catch {}

	return data.id_token;
};

const isUnauthorized = (error: unknown) =>
	(error as { status?: number })?.status === 401;

const withFreshTokenRetry = async <T>(fn: (idToken: string) => Promise<T>): Promise<T> => {
	try {
		return await fn(await grantIdToken());
	} catch (error) {
		if (!isUnauthorized(error)) throw error;
		return fn(await grantIdToken(true));
	}
};

export const createBkashPayment = async (params: {
	amount: number;
	merchantInvoiceNumber: string;
}): Promise<BkashCreateResult> => {
	const data = await withFreshTokenRetry((idToken) =>
		postJson<BkashCreateResult>(
			`${baseUrl()}/tokenized/checkout/create`,
			{
				mode: "0011",
				payerReference: params.merchantInvoiceNumber,
				callbackURL: config.bkash_callback_url,
				amount: String(params.amount),
				currency: "BDT",
				intent: "sale",
				merchantInvoiceNumber: params.merchantInvoiceNumber,
			},
			{ Authorization: idToken, "X-App-Key": config.bkash_app_key },
		),
	);

	if (!data?.paymentID || !data?.bkashURL) {
		throw new Error(`bKash create payment failed: ${data?.statusMessage || "no paymentID/bkashURL"}`);
	}

	return data;
};

export const executeBkashPayment = async (paymentID: string): Promise<BkashExecuteResult> => {
	const data = await withFreshTokenRetry((idToken) =>
		postJson<BkashExecuteResult>(
			`${baseUrl()}/tokenized/checkout/execute`,
			{ paymentID },
			{ Authorization: idToken, "X-App-Key": config.bkash_app_key },
		),
	);
	return data;
};

export const queryBkashPayment = async (paymentID: string): Promise<BkashExecuteResult> => {
	const data = await withFreshTokenRetry((idToken) =>
		postJson<BkashExecuteResult>(
			`${baseUrl()}/tokenized/checkout/payment/status`,
			{ paymentID },
			{ Authorization: idToken, "X-App-Key": config.bkash_app_key },
		),
	);
	return data;
};
