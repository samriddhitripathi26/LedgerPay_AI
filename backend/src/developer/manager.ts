import crypto from 'crypto';

export interface MerchantApiKeys {
  merchantId: string;
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
  webhookUrl: string;
  environment: 'live' | 'test';
}

export interface WebhookDeliveryLog {
  id: string;
  event: string;
  timestamp: string;
  webhookUrl: string;
  signature: string;
  statusCode: number;
  status: 'DELIVERED' | 'FAILED';
  latencyMs: number;
  payload: Record<string, any>;
}

export class DeveloperManager {
  private keys: Map<string, MerchantApiKeys> = new Map();
  private deliveryLogs: WebhookDeliveryLog[] = [];

  constructor() {
    this.seedDefaultKeys();
  }

  private seedDefaultKeys() {
    const merchants = ['mch_acme_corp', 'mch_global_fashion', 'mch_crypto_exchange', 'mch_default'];
    merchants.forEach(m => {
      this.keys.set(m, {
        merchantId: m,
        publishableKey: `pk_live_${crypto.randomBytes(12).toString('hex')}`,
        secretKey: `sk_live_${crypto.randomBytes(24).toString('hex')}`,
        webhookSecret: `whsec_${crypto.randomBytes(16).toString('hex')}`,
        webhookUrl: 'https://api.merchant.com/webhooks/ledgerpay',
        environment: 'live'
      });
    });

    // Seed some initial delivery logs for rich UX
    this.deliveryLogs.push(
      {
        id: 'wh_log_01',
        event: 'payment.captured',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        webhookUrl: 'https://api.merchant.com/webhooks/ledgerpay',
        signature: 'sha256=d3f28a9b7c891e45f921820ac189283741829371982739182371982371982371',
        statusCode: 200,
        status: 'DELIVERED',
        latencyMs: 142,
        payload: {
          id: 'evt_01',
          type: 'payment.captured',
          data: { transactionId: 'tx_demo_882', amount: 12500, currency: 'INR', status: 'SUCCEEDED' }
        }
      },
      {
        id: 'wh_log_02',
        event: 'settlement.netted',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        webhookUrl: 'https://api.merchant.com/webhooks/ledgerpay',
        signature: 'sha256=a89bc21389def283948729183719823719823719823719823719823719823719',
        statusCode: 200,
        status: 'DELIVERED',
        latencyMs: 98,
        payload: {
          id: 'evt_02',
          type: 'settlement.netted',
          data: { batchId: 'net_batch_demo', volumeINR: 730000, compressionRatio: '76.3%' }
        }
      }
    );
  }

  public getKeys(merchantId: string = 'mch_acme_corp'): MerchantApiKeys {
    if (!this.keys.has(merchantId)) {
      this.keys.set(merchantId, {
        merchantId,
        publishableKey: `pk_live_${crypto.randomBytes(12).toString('hex')}`,
        secretKey: `sk_live_${crypto.randomBytes(24).toString('hex')}`,
        webhookSecret: `whsec_${crypto.randomBytes(16).toString('hex')}`,
        webhookUrl: 'https://api.merchant.com/webhooks/ledgerpay',
        environment: 'live'
      });
    }
    return this.keys.get(merchantId)!;
  }

  public updateWebhookUrl(merchantId: string, url: string): MerchantApiKeys {
    const keys = this.getKeys(merchantId);
    keys.webhookUrl = url;
    return keys;
  }

  public rotateSecretKey(merchantId: string): MerchantApiKeys {
    const keys = this.getKeys(merchantId);
    keys.secretKey = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
    return keys;
  }

  public getDeliveryLogs(): WebhookDeliveryLog[] {
    return this.deliveryLogs;
  }

  public dispatchTestWebhook(merchantId: string, eventType: string = 'payment.captured', customPayload?: Record<string, any>): {
    success: boolean;
    signature: string;
    log: WebhookDeliveryLog;
  } {
    const keys = this.getKeys(merchantId);
    const eventId = `evt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const timestamp = new Date().toISOString();

    const payload = customPayload || {
      id: eventId,
      object: 'event',
      type: eventType,
      created: Math.floor(Date.now() / 1000),
      data: {
        transactionId: `tx_live_${Date.now()}`,
        merchantId,
        amount: 15000,
        currency: 'INR',
        paymentMethod: 'upi',
        vpa: 'merchant@okaxis',
        status: eventType === 'payment.failed' ? 'FAILED' : 'SUCCEEDED',
        idempotencyKey: `idem_test_${Date.now()}`,
        ledgerJournalIndex: 42
      }
    };

    const payloadString = JSON.stringify(payload);
    const signature = `sha256=${crypto
      .createHmac('sha256', keys.webhookSecret)
      .update(payloadString)
      .digest('hex')}`;

    const log: WebhookDeliveryLog = {
      id: `wh_log_${Date.now()}`,
      event: eventType,
      timestamp,
      webhookUrl: keys.webhookUrl,
      signature,
      statusCode: 200,
      status: 'DELIVERED',
      latencyMs: Math.floor(65 + Math.random() * 85),
      payload
    };

    this.deliveryLogs.unshift(log);
    if (this.deliveryLogs.length > 50) this.deliveryLogs.pop();

    return {
      success: true,
      signature,
      log
    };
  }
}
