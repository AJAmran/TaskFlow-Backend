import axios from "axios";
import config from "../config";
import { redisClient } from "./redis";

const ID_TOKEN_KEY = "bkash:id_token";
const ID_TOKEN_TTL = 3500;

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

export const grantIdToken = async (force = false): Promise<string> => {
  if (!force) {
    try {
      if (redisClient.isOpen) {
        const cached = await redisClient.get(ID_TOKEN_KEY);
        if (cached) return cached;
      }
    } catch {}
  }

  const { data } = await axios.post<BkashGrantResult>(
    `${baseUrl()}/tokenized/checkout/token/grant`,
    { app_key: config.bkash_app_key, app_secret: config.bkash_app_secret },
    {
      headers: { username: config.bkash_username, password: config.bkash_password },
      timeout: 15000,
    },
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
  axios.isAxiosError(error) && error.response?.status === 401;

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
  const { data } = await withFreshTokenRetry((idToken) =>
    axios.post<BkashCreateResult>(
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
      {
        headers: { Authorization: idToken, "X-App-Key": config.bkash_app_key },
        timeout: 15000,
      },
    ),
  );

  if (!data?.paymentID || !data?.bkashURL) {
    throw new Error(`bKash create payment failed: ${data?.statusMessage || "no paymentID/bkashURL"}`);
  }

  return data;
};

export const executeBkashPayment = async (paymentID: string): Promise<BkashExecuteResult> => {
  const { data } = await withFreshTokenRetry((idToken) =>
    axios.post<BkashExecuteResult>(
      `${baseUrl()}/tokenized/checkout/execute`,
      { paymentID },
      {
        headers: { Authorization: idToken, "X-App-Key": config.bkash_app_key },
        timeout: 15000,
      },
    ),
  );
  return data;
};

export const queryBkashPayment = async (paymentID: string): Promise<BkashExecuteResult> => {
  const { data } = await withFreshTokenRetry((idToken) =>
    axios.post<BkashExecuteResult>(
      `${baseUrl()}/tokenized/checkout/payment/status`,
      { paymentID },
      {
        headers: { Authorization: idToken, "X-App-Key": config.bkash_app_key },
        timeout: 15000,
      },
    ),
  );
  return data;
};
