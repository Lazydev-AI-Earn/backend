import { z } from "zod";
import { isAddress } from "viem";

export const uuidSchema = z.string().uuid();

export const walletSchema = z
  .string()
  .refine((value) => isAddress(value), "Invalid wallet address")
  .transform((value) => value.toLowerCase());

export const txHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash")
  .optional();

export const positiveDecimalString = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine((value) => /^\d+(\.\d+)?$/.test(value), "Must be a positive decimal")
  .refine((value) => Number(value) > 0, "Must be greater than zero");

export const nonNegativeDecimalString = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine((value) => /^\d+(\.\d+)?$/.test(value), "Must be a non-negative decimal");

export const optionalFutureDate = z
  .string()
  .datetime()
  .optional()
  .refine((value) => !value || new Date(value).getTime() > Date.now(), {
    message: "Deadline must be in the future",
  });

export function paginationQuery() {
  return z.object({
    page: z
      .string()
      .optional()
      .transform((value) => Math.max(1, Number(value || 1))),
    limit: z
      .string()
      .optional()
      .transform((value) => Math.min(100, Math.max(1, Number(value || 20)))),
  });
}

export function toSkipTake(query) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  return { skip: (page - 1) * limit, take: limit };
}
