export interface PaymentTransaction {
  transactionId: string;
  idempotencyKey: string;
  merchantId: string;
  status: 'SUCCEEDED' | 'REQUIRES_ACTION_3DS' | 'BLOCKED' | 'DECLINED' | 'FAILED';
  amount: number;
  currency: string;
  provider: string;
  fallbackTriggered: boolean;
  fraudAssessment: {
    riskScore: number;
    riskTier: string;
    action: string;
    scaRecommendation: string;
    reasons: string[];
    fraudRingDetected: boolean;
  };
  routingDecision: {
    selectedProvider: string;
    ucbScore: number;
    expectedReward: number;
    alternatives: any[];
  };
  ledgerEntryId?: string;
  fees: {
    platformFee: number;
    providerFee: number;
    netToMerchant: number;
  };
  sagaTimeline: {
    step: string;
    timestamp: string;
    latencyMs: number;
    status: 'SUCCESS' | 'WARNING' | 'FAILED';
    details: Record<string, any>;
  }[];
  completedAt: string;
  isIdempotentReplay?: boolean;
}

export interface SystemMetrics {
  totalVolumeINR?: number;
  totalVolumeUSD: number;
  totalTransactions: number;
  successRatePct: number;
  blockedFraudCount: number;
  nettingFeesSavedINR?: number;
  nettingFeesSavedUSD: number;
  activeLedgerEntries: number;
  idempotencyStats: {
    totalKeys: number;
    inFlight: number;
    completed: number;
  };
}

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

export interface FXRate {
  pair: string;
  base: string;
  quote: string;
  interbankMid: number;
  bid: number;
  ask: number;
  providerMarkupPct: number;
  timestamp: string;
}

export interface NettingBatch {
  id: string;
  batchWindow: string;
  totalGrossVolumeINR?: number;
  totalNettedVolumeINR?: number;
  compressionRatioPct: number;
  estimatedFeesSavedINR?: number;
  totalGrossVolumeUSD: number;
  totalNettedVolumeUSD: number;
  estimatedFeesSavedUSD: number;
  netObligations: {
    merchantId: string;
    currency: string;
    grossReceivable: number;
    grossPayable: number;
    netBalance: number;
    settlementAction: 'RECEIVE_WIRE' | 'PAY_WIRE' | 'ZERO_BALANCE';
  }[];
  status: 'SETTLED';
  settledAt: string;
}

export interface Account {
  id: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  currency: string;
  name: string;
  merchantId?: string;
  balance: number;
  version: number;
}

export interface JournalEntry {
  id: string;
  index: number;
  timestamp: string;
  referenceId: string;
  referenceType: string;
  postings: {
    accountId: string;
    amount: number;
    direction: 'DEBIT' | 'CREDIT';
    currency: string;
    description: string;
  }[];
  prevHash: string;
  hash: string;
  metadata?: any;
}

export interface GraphData {
  nodes: {
    id: string;
    label: string;
    type: 'user' | 'card' | 'device' | 'ip' | 'merchant' | string;
    isFraud: boolean;
    degree: number;
  }[];
  links: {
    source: string;
    target: string;
    amount?: number;
  }[];
}

export interface RoutingStats {
  [provider: string]: {
    name: string;
    total_routed: number;
    success_count: number;
    fail_count: number;
    successRate: number;
    avg_latency: number;
    last_reward: number;
    color: string;
  };
}

export interface ReconciliationData {
  totalStatementItems: number;
  totalLedgerItems: number;
  matchedCount: number;
  unmatchedCount: number;
  discrepancyCount: number;
  matchRatePct: number;
  totalStatementAmount: number;
  totalLedgerAmount: number;
  netVariance: number;
  matches: {
    statementId: string;
    transactionId: string;
    amount: number;
    fee: number;
    matchType: string;
  }[];
  discrepancies: {
    reference: string;
    amountDifference: number;
    feeDifference: number;
    matchStatus: string;
    provider: string;
    description: string;
    isAnomaly?: boolean;
    anomalyScore?: number;
    anomalyType?: string;
  }[];
}
