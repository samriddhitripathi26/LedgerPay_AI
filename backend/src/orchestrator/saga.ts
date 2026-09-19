import { IdempotencyManager } from './idempotency.js';
import { DoubleEntryLedger, JournalPosting } from '../ledger/doubleEntry.js';
import { WorkflowEngine } from '../workflow/engine.js';
import crypto from 'crypto';

export interface PaymentRequest {
  idempotencyKey: string;
  merchantId: string;
  amount: number;
  currency: string;
  paymentMethod: 'card' | 'sepa' | 'ach' | 'ideal' | 'paypal' | 'upi' | 'netbanking';
  upiId?: string;
  cardDetails?: {
    numberMasked: string;
    expMonth: number;
    expYear: number;
    fingerprint: string;
    brand: string;
  };
  customer: {
    id: string;
    email: string;
    ipAddress: string;
    deviceId: string;
    country: string;
  };
  description?: string;
  metadata?: Record<string, any>;
}

export type SagaState =
  | 'IDEMPOTENCY_CHECK'
  | 'FRAUD_ANALYSIS'
  | 'DYNAMIC_3DS_DECISION'
  | 'WORKFLOW_EVALUATION'
  | 'SMART_ROUTING'
  | 'PROVIDER_AUTHORIZE'
  | 'PROVIDER_RETRY_FALLBACK'
  | 'LEDGER_BOOKING'
  | 'OUTBOX_DISPATCH'
  | 'COMPLETED'
  | 'FAILED_BLOCKED_FRAUD'
  | 'FAILED_PROVIDER_DECLINE'
  | 'FAILED_SYSTEM_ERROR';

export interface SagaStepLog {
  step: SagaState;
  timestamp: string;
  latencyMs: number;
  status: 'SUCCESS' | 'WARNING' | 'FAILED';
  details: Record<string, any>;
}

export interface PaymentResult {
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
  sagaTimeline: SagaStepLog[];
  completedAt: string;
  isIdempotentReplay?: boolean;
}

export interface OutboxEvent {
  id: string;
  eventType: 'PAYMENT_SUCCEEDED' | 'PAYMENT_BLOCKED_FRAUD' | 'PAYMENT_DECLINED' | 'NETTING_BATCH_SETTLED';
  aggregateId: string;
  payload: any;
  status: 'PENDING' | 'DISPATCHED';
  createdAt: string;
}

export class PaymentSagaOrchestrator {
  private idempotencyManager: IdempotencyManager;
  private ledger: DoubleEntryLedger;
  private workflowEngine: WorkflowEngine;
  private outbox: OutboxEvent[] = [];
  private transactions: Map<string, PaymentResult> = new Map();
  private aiServiceUrl = 'http://127.0.0.1:5000';

  constructor(
    idempotencyManager: IdempotencyManager,
    ledger: DoubleEntryLedger,
    workflowEngine: WorkflowEngine
  ) {
    this.idempotencyManager = idempotencyManager;
    this.ledger = ledger;
    this.workflowEngine = workflowEngine;
    this.seedHistoricalTransactions();
  }

  private seedHistoricalTransactions() {
    // Pre-populate with realistic transactions for initial dashboard metrics in INR & major FX
    const sampleMerchants = ['mch_acme_corp', 'mch_global_fashion', 'mch_crypto_exchange'];
    const providers = ['stripe', 'adyen', 'checkout_com'];
    const currencies = ['INR', 'INR', 'INR', 'USD', 'INR', 'EUR', 'INR'];
    const amounts = [4500, 12800, 850, 150.0, 24500, 180.0, 75000, 1200, 34000, 9500, 68000, 2500, 18500, 42000, 8900];

    for (let i = 1; i <= 15; i++) {
      const txId = `tx_hist_${1000 + i}`;
      const mch = sampleMerchants[i % sampleMerchants.length];
      const p = providers[i % providers.length];
      const curr = currencies[(i - 1) % currencies.length];
      const amt = amounts[i - 1] || (1000 * i);
      const isUPI = curr === 'INR' && i % 2 === 0;

      let platFee = 0;
      let provFee = 0;
      if (curr === 'INR') {
        platFee = isUPI ? Number((amt * 0.0015 + 1.0).toFixed(2)) : Number((amt * 0.005 + 2.0).toFixed(2));
        provFee = isUPI ? Number((amt * 0.002 + 0.5).toFixed(2)) : Number((amt * 0.018 + 3.0).toFixed(2));
      } else {
        platFee = Number((amt * 0.005 + 0.15).toFixed(2));
        provFee = Number((amt * 0.024 + 0.20).toFixed(2));
      }
      const net = Number((amt - platFee - provFee).toFixed(2));

      this.transactions.set(txId, {
        transactionId: txId,
        idempotencyKey: `idem_hist_${1000 + i}`,
        merchantId: mch,
        status: i === 7 ? 'BLOCKED' : 'SUCCEEDED',
        amount: amt,
        currency: curr,
        provider: p,
        fallbackTriggered: i % 5 === 0,
        fraudAssessment: {
          riskScore: i === 7 ? 88.5 : 12.0 + (i * 2),
          riskTier: i === 7 ? 'CRITICAL' : 'LOW',
          action: i === 7 ? 'BLOCK' : 'APPROVE',
          scaRecommendation: i === 7 ? 'BLOCK_TRANSACTION' : 'EXEMPT_LOW_RISK',
          reasons: i === 7 ? ['HIGH_DEVICE_COLLISION', 'KNOWN_ANONYMIZER_IP_RANGE'] : ['CLEAN_GRAPH_TOPOLOGY'],
          fraudRingDetected: i === 7
        },
        routingDecision: {
          selectedProvider: p,
          ucbScore: 1.15,
          expectedReward: 0.92,
          alternatives: []
        },
        ledgerEntryId: `jnl_hist_${i}`,
        fees: {
          platformFee: platFee,
          providerFee: provFee,
          netToMerchant: net
        },
        sagaTimeline: [],
        completedAt: new Date(Date.now() - (16 - i) * 1800000).toISOString()
      });
    }
  }

  public async processPayment(req: PaymentRequest): Promise<PaymentResult> {
    const overallStart = Date.now();
    const timeline: SagaStepLog[] = [];

    // Helper to log step in saga
    const logStep = (step: SagaState, status: 'SUCCESS' | 'WARNING' | 'FAILED', details: Record<string, any>, durationMs: number) => {
      timeline.push({
        step,
        timestamp: new Date().toISOString(),
        latencyMs: Math.round(durationMs * 100) / 100,
        status,
        details
      });
    };

    // ----------------------------------------------------
    // STEP 1: IDEMPOTENCY LOCK & CONCURRENCY CONTROL
    // ----------------------------------------------------
    const t0 = Date.now();
    const lock = this.idempotencyManager.acquireLock(req.merchantId, req.idempotencyKey);

    if (!lock.acquired) {
      if (lock.status === 'COMPLETED' && lock.record?.responseBody) {
        logStep('IDEMPOTENCY_CHECK', 'SUCCESS', { message: 'Idempotency match: replay cached response without side-effects', status: 'CACHED_REPLAY' }, Date.now() - t0);
        const replay = {
          ...lock.record.responseBody,
          isIdempotentReplay: true
        };
        return replay;
      } else if (lock.status === 'IN_FLIGHT') {
        logStep('IDEMPOTENCY_CHECK', 'WARNING', { message: 'Concurrent duplicate request detected in flight' }, Date.now() - t0);
        throw new Error(`409 Conflict: Concurrent request for idempotency-key "${req.idempotencyKey}" is actively processing.`);
      }
    }
    logStep('IDEMPOTENCY_CHECK', 'SUCCESS', { message: 'Atomic lease acquired. Unique key reserved.', key: req.idempotencyKey }, Date.now() - t0);

    const transactionId = `tx_${crypto.randomUUID().slice(0, 10)}`;

    try {
      // ----------------------------------------------------
      // STEP 2: AI GNN FRAUD DETECTION & RING ANALYSIS
      // ----------------------------------------------------
      const t1 = Date.now();
      let fraudAssessment: any;

      try {
        const fraudRes = await fetch(`${this.aiServiceUrl}/api/fraud/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionId,
            userId: req.customer.id,
            amount: req.amount,
            currency: req.currency,
            cardFingerprint: req.cardDetails?.fingerprint || `fp_${req.customer.id.slice(-4)}`,
            deviceId: req.customer.deviceId,
            ipAddress: req.customer.ipAddress,
            merchantId: req.merchantId,
            paymentMethod: req.paymentMethod,
            customerCountry: req.customer.country
          }),
          signal: AbortSignal.timeout(1500)
        });

        if (fraudRes.ok) {
          fraudAssessment = await fraudRes.json();
        } else {
          throw new Error(`AI service returned HTTP ${fraudRes.status}`);
        }
      } catch (err: any) {
        // Resilient in-process fallback heuristic if Python service is offline
        const isAnonymizer = req.customer.ipAddress.startsWith('185.220.') || req.customer.ipAddress.startsWith('194.26.');
        const isLarge = req.amount > 5000;
        const fallbackRisk = (isAnonymizer ? 65 : 10) + (isLarge ? 25 : 5);
        fraudAssessment = {
          riskScore: fallbackRisk,
          riskTier: fallbackRisk > 70 ? 'CRITICAL' : fallbackRisk > 40 ? 'HIGH' : 'LOW',
          action: fallbackRisk > 70 ? 'BLOCK' : fallbackRisk > 40 ? 'CHALLENGE_3DS' : 'APPROVE',
          scaRecommendation: fallbackRisk > 40 ? 'STEP_UP_AUTHENTICATION' : 'EXEMPT_LOW_RISK',
          reasonCodes: isAnonymizer ? ['KNOWN_ANONYMIZER_IP_RANGE'] : ['CLEAN_GRAPH_TOPOLOGY'],
          fraudRingDetected: false,
          inferenceLatencyMs: 2.5
        };
      }

      logStep('FRAUD_ANALYSIS', fraudAssessment.riskScore >= 70 ? 'WARNING' : 'SUCCESS', {
        riskScore: fraudAssessment.riskScore,
        tier: fraudAssessment.riskTier,
        action: fraudAssessment.action,
        ringDetected: fraudAssessment.fraudRingDetected,
        reasons: fraudAssessment.reasonCodes
      }, Date.now() - t1);

      // Check if blocked by AI Fraud Engine
      if (fraudAssessment.action === 'BLOCK') {
        const blockResult: PaymentResult = {
          transactionId,
          idempotencyKey: req.idempotencyKey,
          merchantId: req.merchantId,
          status: 'BLOCKED',
          amount: req.amount,
          currency: req.currency,
          provider: 'none',
          fallbackTriggered: false,
          fraudAssessment: {
            riskScore: fraudAssessment.riskScore,
            riskTier: fraudAssessment.riskTier,
            action: fraudAssessment.action,
            scaRecommendation: fraudAssessment.scaRecommendation,
            reasons: fraudAssessment.reasonCodes,
            fraudRingDetected: fraudAssessment.fraudRingDetected
          },
          routingDecision: { selectedProvider: 'blocked', ucbScore: 0, expectedReward: 0, alternatives: [] },
          fees: { platformFee: 0, providerFee: 0, netToMerchant: 0 },
          sagaTimeline: timeline,
          completedAt: new Date().toISOString()
        };

        logStep('FAILED_BLOCKED_FRAUD', 'FAILED', { reason: 'Blocked by GNN Fraud Engine threshold' }, 1);
        this.recordOutboxEvent('PAYMENT_BLOCKED_FRAUD', transactionId, blockResult);
        this.idempotencyManager.commit(req.merchantId, req.idempotencyKey, 200, blockResult);
        this.transactions.set(transactionId, blockResult);
        return blockResult;
      }

      // ----------------------------------------------------
      // STEP 3: DYNAMIC 3DS / SCA EVALUATION
      // ----------------------------------------------------
      const t2 = Date.now();
      const requires3DS = fraudAssessment.action === 'CHALLENGE_3DS' || fraudAssessment.riskScore > 45;
      logStep('DYNAMIC_3DS_DECISION', 'SUCCESS', {
        scaDecision: requires3DS ? 'CHALLENGE_REQUESTED' : 'FRICTIONLESS_EXEMPTION',
        recommendation: fraudAssessment.scaRecommendation
      }, Date.now() - t2);

      // ----------------------------------------------------
      // STEP 4: WORKFLOW RULES EVALUATION
      // ----------------------------------------------------
      const t3 = Date.now();
      const workflowEval = this.workflowEngine.evaluate({
        amount: req.amount,
        currency: req.currency,
        riskScore: fraudAssessment.riskScore,
        paymentMethod: req.paymentMethod,
        merchantId: req.merchantId,
        customerCountry: req.customer.country
      });

      logStep('WORKFLOW_EVALUATION', 'SUCCESS', {
        executedRules: workflowEval.executedActions,
        forcedProvider: workflowEval.forcedProvider,
        notes: workflowEval.notes
      }, Date.now() - t3);

      // ----------------------------------------------------
      // STEP 5: SMART ROUTING VIA CONTEXTUAL BANDIT
      // ----------------------------------------------------
      const t4 = Date.now();
      let routingResult: any;

      try {
        const routeRes = await fetch(`${this.aiServiceUrl}/api/routing/select`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionId,
            amount: req.amount,
            currency: req.currency,
            paymentMethod: req.paymentMethod,
            customerCountry: req.customer.country,
            riskScore: fraudAssessment.riskScore,
            merchantTier: 'standard'
          }),
          signal: AbortSignal.timeout(1500)
        });

        if (routeRes.ok) {
          routingResult = await routeRes.json();
        } else {
          throw new Error('Routing service error');
        }
      } catch (err) {
        // Fallback rule
        routingResult = {
          selectedProvider: workflowEval.forcedProvider || (req.currency === 'EUR' ? 'adyen' : 'stripe'),
          fallbackProvider: 'checkout_com',
          ranking: [
            { provider: 'stripe', ucbScore: 1.12, expectedReward: 0.88 },
            { provider: 'adyen', ucbScore: 1.09, expectedReward: 0.86 },
            { provider: 'checkout_com', ucbScore: 1.04, expectedReward: 0.82 },
            { provider: 'paypal', ucbScore: 0.98, expectedReward: 0.79 }
          ],
          routingReason: 'Contextual fallback policy'
        };
      }

      if (workflowEval.forcedProvider) {
        routingResult.selectedProvider = workflowEval.forcedProvider;
        routingResult.routingReason = `Merchant visual rule override: pinned to ${workflowEval.forcedProvider}`;
      }

      logStep('SMART_ROUTING', 'SUCCESS', {
        primary: routingResult.selectedProvider,
        fallback: routingResult.fallbackProvider,
        reason: routingResult.routingReason
      }, Date.now() - t4);

      // ----------------------------------------------------
      // STEP 6: PROVIDER EXECUTION & FALLBACK RETRY
      // ----------------------------------------------------
      const t5 = Date.now();
      let activeProvider = routingResult.selectedProvider;
      let fallbackTriggered = false;

      // Simulate provider processing (95% success rate for primary; if simulated decline, trigger automatic saga fallback)
      const primaryDeclined = req.description?.toLowerCase().includes('simulate_decline');

      if (primaryDeclined) {
        logStep('PROVIDER_AUTHORIZE', 'WARNING', {
          provider: activeProvider,
          status: 'DECLINED_BY_ISSUER',
          message: 'Primary provider declined authorization. Triggering saga fallback.'
        }, Date.now() - t5);

        // Fallback retry
        const t5_fallback = Date.now();
        activeProvider = routingResult.fallbackProvider || 'checkout_com';
        fallbackTriggered = true;

        logStep('PROVIDER_RETRY_FALLBACK', 'SUCCESS', {
          fallbackProvider: activeProvider,
          status: 'AUTHORIZED',
          message: `Successfully rescued payment via backup provider ${activeProvider}`
        }, Date.now() - t5_fallback);
      } else {
        logStep('PROVIDER_AUTHORIZE', 'SUCCESS', {
          provider: activeProvider,
          status: 'AUTHORIZED',
          authCode: `AUTH_${Math.random().toString(36).slice(2, 8).toUpperCase()}`
        }, Date.now() - t5);
      }

      // ----------------------------------------------------
      // STEP 7: DOUBLE-ENTRY LEDGER ATOMIC BOOKING
      // ----------------------------------------------------
      const t6 = Date.now();
      const curr = req.currency.toUpperCase();
      let platformFee = 0;
      let providerFee = 0;

      if (curr === 'INR') {
        if (req.paymentMethod === 'upi') {
          platformFee = Number((req.amount * 0.0015 + 1.0).toFixed(2));
          providerFee = Number((req.amount * 0.002 + 0.5).toFixed(2));
        } else if (req.paymentMethod === 'netbanking') {
          platformFee = Number((req.amount * 0.004 + 2.0).toFixed(2));
          providerFee = Number((req.amount * 0.012 + 4.0).toFixed(2));
        } else {
          // Card / RuPay
          platformFee = Number((req.amount * 0.005 + 2.0).toFixed(2));
          providerFee = Number((req.amount * 0.018 + 3.0).toFixed(2));
        }
      } else {
        platformFee = Number((req.amount * 0.006 + 0.15).toFixed(2));
        providerFee = Number((req.amount * 0.024 + 0.20).toFixed(2));
      }
      const netToMerchant = Number((req.amount - platformFee - providerFee).toFixed(2));

      // Balanced postings: sum(Debits) === sum(Credits)
      // Total Debit = req.amount
      // Total Credit = netToMerchant + platformFee + providerFee = req.amount
      const postings: JournalPosting[] = [
        {
          accountId: `asset:clearing:${activeProvider}:${curr}`,
          direction: 'DEBIT',
          amount: req.amount,
          currency: curr,
          description: `Gross charge collection via ${activeProvider}`
        },
        {
          accountId: `liability:merchant_payable:${req.merchantId}:${curr}`,
          direction: 'CREDIT',
          amount: netToMerchant,
          currency: curr,
          description: `Net settlement payable for ${transactionId}`
        },
        {
          accountId: `revenue:platform_fees:${curr}`,
          direction: 'CREDIT',
          amount: platformFee,
          currency: curr,
          description: `Platform transaction fee margin`
        },
        {
          accountId: `liability:provider_payable:${activeProvider}:${curr}`,
          direction: 'CREDIT',
          amount: providerFee,
          currency: curr,
          description: `Provider interchange fee obligation`
        }
      ];

      const ledgerEntry = this.ledger.recordEntry(transactionId, 'PAYMENT', postings, {
        merchantId: req.merchantId,
        provider: activeProvider,
        gross: req.amount,
        currency: curr
      });

      logStep('LEDGER_BOOKING', 'SUCCESS', {
        journalIndex: ledgerEntry.index,
        journalHash: ledgerEntry.hash.slice(0, 16) + '...',
        balancedPostings: postings.length
      }, Date.now() - t6);

      // ----------------------------------------------------
      // STEP 8: TRANSACTIONAL EVENT OUTBOX
      // ----------------------------------------------------
      const t7 = Date.now();
      const finalResult: PaymentResult = {
        transactionId,
        idempotencyKey: req.idempotencyKey,
        merchantId: req.merchantId,
        status: 'SUCCEEDED',
        amount: req.amount,
        currency: req.currency,
        provider: activeProvider,
        fallbackTriggered,
        fraudAssessment: {
          riskScore: fraudAssessment.riskScore,
          riskTier: fraudAssessment.riskTier,
          action: fraudAssessment.action,
          scaRecommendation: fraudAssessment.scaRecommendation,
          reasons: fraudAssessment.reasonCodes,
          fraudRingDetected: fraudAssessment.fraudRingDetected
        },
        routingDecision: {
          selectedProvider: activeProvider,
          ucbScore: routingResult.ranking?.[0]?.ucbScore || 1.15,
          expectedReward: routingResult.ranking?.[0]?.expectedReward || 0.92,
          alternatives: routingResult.ranking || []
        },
        ledgerEntryId: ledgerEntry.id,
        fees: {
          platformFee,
          providerFee,
          netToMerchant
        },
        sagaTimeline: timeline,
        completedAt: new Date().toISOString()
      };

      this.recordOutboxEvent('PAYMENT_SUCCEEDED', transactionId, finalResult);
      logStep('OUTBOX_DISPATCH', 'SUCCESS', { eventType: 'PAYMENT_SUCCEEDED', queue: 'kafka/rabbitmq_outbox' }, Date.now() - t7);

      // ----------------------------------------------------
      // STEP 9: ONLINE RL BANDIT FEEDBACK
      // ----------------------------------------------------
      try {
        fetch(`${this.aiServiceUrl}/api/routing/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: activeProvider,
            transaction: { amount: req.amount, currency: req.currency, riskScore: fraudAssessment.riskScore },
            outcome: { success: true, latencyMs: Date.now() - overallStart, fee: providerFee }
          })
        }).catch(() => {});
      } catch (e) {}

      // Commit to Idempotency Store
      this.idempotencyManager.commit(req.merchantId, req.idempotencyKey, 200, finalResult);
      this.transactions.set(transactionId, finalResult);

      return finalResult;
    } catch (err: any) {
      logStep('FAILED_SYSTEM_ERROR', 'FAILED', { error: err.message }, Date.now() - overallStart);
      this.idempotencyManager.release(req.merchantId, req.idempotencyKey);
      throw err;
    }
  }

  private recordOutboxEvent(eventType: OutboxEvent['eventType'], aggregateId: string, payload: any) {
    this.outbox.unshift({
      id: `evt_${crypto.randomUUID().slice(0, 8)}`,
      eventType,
      aggregateId,
      payload,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    });
  }

  public getOutboxEvents(limit = 20): OutboxEvent[] {
    return this.outbox.slice(0, limit);
  }

  public getAllTransactions(): PaymentResult[] {
    return Array.from(this.transactions.values()).sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );
  }

  public getTransaction(txId: string): PaymentResult | undefined {
    return this.transactions.get(txId);
  }
}
