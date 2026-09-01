/**
 * Server-side x402 PaymentPayload validation before facilitator broadcast.
 */

import { normalizeAddress } from '../crypto/address.js';
import type { PaymentPayload, PaymentRequirements } from '../types.js';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validatePaymentPayload(
  payload: unknown,
  expectedRequirements: PaymentRequirements
): ValidationResult {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Payment payload must be an object' };
  }

  const p = payload as Partial<PaymentPayload>;

  if (p.x402Version !== 2) {
    return { valid: false, error: `Unsupported x402 version: ${p.x402Version}, expected 2` };
  }

  if (!p.accepted || typeof p.accepted !== 'object') {
    return { valid: false, error: 'Missing accepted payment requirements block' };
  }

  if (p.accepted.network !== expectedRequirements.network) {
    return {
      valid: false,
      error: `Network mismatch: accepted ${p.accepted.network}, expected ${expectedRequirements.network}`,
    };
  }

  if (p.accepted.amount !== expectedRequirements.amount) {
    return {
      valid: false,
      error: `Amount mismatch: accepted ${p.accepted.amount}, expected ${expectedRequirements.amount}`,
    };
  }

  try {
    if (normalizeAddress(p.accepted.payTo) !== normalizeAddress(expectedRequirements.payTo)) {
      return { valid: false, error: 'Payee address mismatch in accepted block' };
    }

    if (normalizeAddress(p.accepted.asset) !== normalizeAddress(expectedRequirements.asset)) {
      return { valid: false, error: 'Asset contract mismatch in accepted block' };
    }
  } catch (err: unknown) {
    return { valid: false, error: `Address validation failed: ${(err as Error).message}` };
  }

  const payloadBlock = p.payload;
  if (!payloadBlock || typeof payloadBlock !== 'object') {
    return { valid: false, error: 'Missing payload block with signature and authorization' };
  }

  const auth = payloadBlock.authorization;
  if (!auth || typeof auth !== 'object') {
    return { valid: false, error: 'Missing authorization details in payload' };
  }

  try {
    if (normalizeAddress(auth.to) !== normalizeAddress(expectedRequirements.payTo)) {
      return { valid: false, error: 'Authorization recipient does not match payee address' };
    }
  } catch {
    return { valid: false, error: 'Invalid recipient address in authorization' };
  }

  if (auth.value !== expectedRequirements.amount) {
    return { valid: false, error: 'Signed authorization value does not match required amount' };
  }

  const now = Math.floor(Date.now() / 1000);
  const validBefore = Number(auth.validBefore);
  if (isNaN(validBefore) || validBefore <= now) {
    return { valid: false, error: 'Authorization signature is expired (validBefore in past)' };
  }

  if (!payloadBlock.signature || typeof payloadBlock.signature !== 'string' || !payloadBlock.signature.startsWith('0x')) {
    return { valid: false, error: 'Invalid or missing signature' };
  }

  return { valid: true };
}
