/**
 * Multi-facilitator client supporting PayAI and CDP authenticated nodes with automatic failover.
 */

import type { FacilitatorConfig, PaymentPayload, PaymentRequirements, SettlementResult } from '../types.js';

export class FacilitatorClient {
  private facilitators: FacilitatorConfig[];

  constructor(facilitators?: Array<string | FacilitatorConfig>) {
    if (!facilitators || facilitators.length === 0) {
      this.facilitators = [
        { url: 'https://facilitator.payai.network' },
        { url: 'https://api.cdp.coinbase.com/platform/v2/x402' },
      ];
    } else {
      this.facilitators = facilitators.map((f) => (typeof f === 'string' ? { url: f } : f));
    }
  }

  private getHeaders(config: FacilitatorConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.headers,
    };

    if (config.apiKeySecret) {
      headers['Authorization'] = `Bearer ${config.apiKeySecret.trim()}`;
    } else if (config.bearerToken) {
      headers['Authorization'] = `Bearer ${config.bearerToken.trim()}`;
    }

    if (config.apiKeyId) {
      const keyId = config.apiKeyId.trim();
      headers['CB-ACCESS-KEY'] = keyId;
      headers['X-CDP-KEY-ID'] = keyId;
    }

    return headers;
  }

  /**
   * Dispatches verification and settlement against the configured facilitator list with failover.
   */
  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettlementResult> {
    let lastError: string | null = null;

    const requestBody = JSON.stringify({
      x402Version: 2,
      paymentPayload: payload,
      paymentRequirements: requirements,
    });

    for (const facilitator of this.facilitators) {
      try {
        const baseUrl = facilitator.url.replace(/\/+$/, '');
        const headers = this.getHeaders(facilitator);
        const timeoutMs = facilitator.timeoutMs || 15000;

        // 1. Verify
        const verifyController = new AbortController();
        const verifyTimer = setTimeout(() => verifyController.abort(), timeoutMs);

        const verifyRes = await fetch(`${baseUrl}/verify`, {
          method: 'POST',
          headers,
          body: requestBody,
          signal: verifyController.signal,
        });
        clearTimeout(verifyTimer);

        if (!verifyRes.ok) {
          const errorText = await verifyRes.text().catch(() => '');
          lastError = `Facilitator ${baseUrl} /verify returned HTTP ${verifyRes.status}: ${errorText}`;
          continue;
        }

        const verifyData = (await verifyRes.json()) as { isValid?: boolean; invalidReason?: string };
        if (!verifyData.isValid) {
          return {
            success: false,
            message: verifyData.invalidReason || 'Payment verification failed',
            facilitator: baseUrl,
          };
        }

        // 2. Settle
        const settleController = new AbortController();
        const settleTimer = setTimeout(() => settleController.abort(), timeoutMs);

        const settleRes = await fetch(`${baseUrl}/settle`, {
          method: 'POST',
          headers,
          body: requestBody,
          signal: settleController.signal,
        });
        clearTimeout(settleTimer);

        if (!settleRes.ok) {
          const errorText = await settleRes.text().catch(() => '');
          lastError = `Facilitator ${baseUrl} /settle returned HTTP ${settleRes.status}: ${errorText}`;
          continue;
        }

        const settleData = (await settleRes.json()) as {
          success?: boolean;
          transaction?: string;
          network?: string;
          amount?: string | number;
          payer?: string;
          errorReason?: string;
        };

        if (!settleData.success) {
          return {
            success: false,
            message: settleData.errorReason || 'Settlement broadcast failed',
            facilitator: baseUrl,
          };
        }

        // Security check: verify settled network matches requested
        if (settleData.network && settleData.network !== requirements.network) {
          return {
            success: false,
            message: `Facilitator settled on unexpected network ${settleData.network}, expected ${requirements.network}`,
            facilitator: baseUrl,
          };
        }

        return {
          success: true,
          txHash: settleData.transaction || null,
          settledAmount: settleData.amount || requirements.amount,
          payer: settleData.payer || payload.payload.authorization.from,
          facilitator: baseUrl,
          rawResponse: settleData as Record<string, unknown>,
        };
      } catch (err: unknown) {
        lastError = (err as Error).message;
      }
    }

    return {
      success: false,
      message: `No facilitator was able to settle the payment. Last error: ${lastError}`,
    };
  }
}
