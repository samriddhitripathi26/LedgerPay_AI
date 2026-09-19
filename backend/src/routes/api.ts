import { Router } from 'express';
import { DoubleEntryLedger } from '../ledger/doubleEntry.js';
import { IdempotencyManager } from '../orchestrator/idempotency.js';
import { PaymentSagaOrchestrator, PaymentRequest } from '../orchestrator/saga.js';
import { TreasuryEngine } from '../treasury/treasuryEngine.js';
import { WorkflowEngine, WorkflowDefinition } from '../workflow/engine.js';
import { ReconciliationEngine, InternalLedgerItem } from '../reconciliation/engine.js';
import { DeveloperManager } from '../developer/manager.js';

export function createApiRouter(
  ledger: DoubleEntryLedger,
  idempotencyManager: IdempotencyManager,
  saga: PaymentSagaOrchestrator,
  treasury: TreasuryEngine,
  workflowEngine: WorkflowEngine,
  reconciliation: ReconciliationEngine,
  developer: DeveloperManager
): Router {
  const router = Router();

  // ================= PAYMENTS =================
  const handlePaymentCharge = async (req: any, res: any) => {
    try {
      const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body.idempotencyKey;
      if (!idempotencyKey) {
        return res.status(400).json({ error: 'Missing required header: Idempotency-Key' });
      }

      const paymentPayload: PaymentRequest = {
        idempotencyKey,
        merchantId: req.body.merchantId || 'mch_acme_corp',
        amount: Number(req.body.amount || 100),
        currency: (req.body.currency || 'USD').toUpperCase(),
        paymentMethod: req.body.paymentMethod || 'card',
        cardDetails: req.body.cardDetails,
        customer: req.body.customer || {
          id: 'usr_default',
          email: 'customer@example.com',
          ipAddress: '127.0.0.1',
          deviceId: 'dev_default',
          country: 'US'
        },
        description: req.body.description,
        metadata: req.body.metadata
      };

      const result = await saga.processPayment(paymentPayload);
      return res.status(200).json(result);
    } catch (err: any) {
      if (err.message?.includes('409 Conflict')) {
        return res.status(409).json({ error: err.message });
      }
      return res.status(500).json({ error: err.message || 'Payment processing failed' });
    }
  };

  router.post('/payments/charge', handlePaymentCharge);
  router.post('/payments', handlePaymentCharge);

  router.get('/payments', (req, res) => {
    const transactions = saga.getAllTransactions();
    res.json(transactions);
  });

  router.get('/payments/:id', (req, res) => {
    const tx = saga.getTransaction(req.params.id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    res.json(tx);
  });

  // Concurrency Stress-Tester: Fires 10 concurrent requests simultaneously with the SAME idempotency key
  router.post('/payments/stress-test', async (req, res) => {
    const testKey = `stress_test_${Date.now()}`;
    const merchantId = req.body.merchantId || 'mch_acme_corp';
    const amount = Number(req.body.amount || 15000);
    const currency = (req.body.currency || 'INR').toUpperCase();
    const threads = 10;

    const payload: PaymentRequest = {
      idempotencyKey: testKey,
      merchantId,
      amount,
      currency,
      paymentMethod: req.body.paymentMethod || 'upi',
      upiId: 'stress_tester@okaxis',
      customer: {
        id: 'usr_stress_tester',
        email: 'stress@example.com',
        ipAddress: '72.14.201.2',
        deviceId: 'dev_stress_01',
        country: 'IN'
      },
      description: 'Automated Concurrency Stress Test'
    };

    const initialJournalCount = ledger.getJournal().length;
    const startTime = Date.now();

    // Fire 10 parallel promises simultaneously
    const promises = Array.from({ length: threads }).map((_, i) =>
      saga
        .processPayment(payload)
        .then(result => ({ threadId: i + 1, status: 'RESOLVED', code: 200, isReplay: !!result.isIdempotentReplay, txId: result.transactionId }))
        .catch(err => ({ threadId: i + 1, status: 'REJECTED_409', code: 409, message: err.message }))
    );

    const outcomes = await Promise.all(promises);
    const finalJournalCount = ledger.getJournal().length;
    const newBookings = finalJournalCount - initialJournalCount;

    return res.json({
      testIdempotencyKey: testKey,
      concurrentThreads: threads,
      elapsedMs: Date.now() - startTime,
      newLedgerBookingsCreated: newBookings,
      doubleChargePrevented: newBookings === 1,
      threadOutcomes: outcomes,
      conclusion: newBookings === 1 
        ? 'PERFECT CONCURRENCY CONTROL: Exactly 1 transaction booked, 0 double-charges under 10 concurrent threads.' 
        : 'RACE CONDITION DETECTED'
    });
  });

  // ================= LEDGER =================
  router.get('/ledger/accounts', (req, res) => {
    res.json(ledger.getAllAccounts());
  });

  router.get('/ledger/journal', (req, res) => {
    res.json(ledger.getJournal());
  });

  router.get('/ledger/verify', (req, res) => {
    const audit = ledger.verifyLedgerIntegrity();
    res.json(audit);
  });

  router.get(['/ledger/export/csv', '/ledger/journal/export/csv'], (req, res) => {
    const csv = ledger.exportJournalCSV();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="ledgerpay_double_entry_audit.csv"');
    res.status(200).send(csv);
  });

  router.get('/ledger/merchant/:merchantId/balances', (req, res) => {
    const balances = ledger.getMerchantBalances(req.params.merchantId);
    res.json(balances);
  });

  // ================= TREASURY & FX =================
  router.get('/treasury/rates', (req, res) => {
    res.json(treasury.getLiveRates());
  });

  router.post('/treasury/convert', (req, res) => {
    try {
      const { merchantId, fromCurrency, toCurrency, fromAmount, merchantTier } = req.body;
      const result = treasury.convertMerchantCurrency(
        merchantId || 'mch_acme_corp',
        fromCurrency,
        toCurrency,
        Number(fromAmount),
        merchantTier
      );
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/treasury/netting/pending', (req, res) => {
    res.json(treasury.getPendingNetting());
  });

  router.post('/treasury/netting/execute', (req, res) => {
    try {
      const batch = treasury.executeNettingBatch();
      res.json(batch);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/treasury/netting/batches', (req, res) => {
    res.json(treasury.getNettingBatches());
  });

  router.post('/treasury/netting/seed', (req, res) => {
    const { merchantId, counterpartyId, amount, currency, direction } = req.body;
    const tx = treasury.addNettingTransaction({
      merchantId: merchantId || 'mch_acme_corp',
      counterpartyId: counterpartyId || 'mch_global_fashion',
      amount: Number(amount || 15000),
      currency: currency || 'EUR',
      direction: direction || 'PAYABLE'
    });
    res.json(tx);
  });

  // ================= WORKFLOWS =================
  router.get('/workflows/:merchantId', (req, res) => {
    const wf = workflowEngine.getWorkflow(req.params.merchantId);
    res.json(wf);
  });

  router.post('/workflows', (req, res) => {
    const wf = req.body as WorkflowDefinition;
    workflowEngine.saveWorkflow(wf);
    res.json({ status: 'saved', workflow: wf });
  });

  // ================= RECONCILIATION =================
  router.post('/reconciliation/run', async (req, res) => {
    try {
      const transactions = saga.getAllTransactions();
      const internalItems: InternalLedgerItem[] = transactions.map(tx => ({
        transactionId: tx.transactionId,
        merchantId: tx.merchantId,
        amount: tx.amount,
        fee: tx.fees.providerFee,
        currency: tx.currency,
        provider: tx.provider,
        timestamp: tx.completedAt,
        status: tx.status
      }));

      // Generate statements or use provided
      const statements = req.body.statementItems || reconciliation.generateSampleFeeds(internalItems);
      const reconResult = reconciliation.reconcile(statements, internalItems);

      // Trigger anomaly detection via Python AI service
      try {
        const anomalyRes = await fetch('http://127.0.0.1:5000/api/reconciliation/anomalies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: reconResult.discrepancies }),
          signal: AbortSignal.timeout(2000)
        });
        if (anomalyRes.ok) {
          reconResult.discrepancies = await anomalyRes.json();
        }
      } catch (e) {}

      res.json(reconResult);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/reconciliation/latest', (req, res) => {
    const result = reconciliation.getLastReconciliation();
    res.json(result || { message: 'No reconciliation run yet' });
  });

  // ================= SYSTEM & METRICS =================
  router.get('/system/metrics', (req, res) => {
    const txs = saga.getAllTransactions();
    
    // Compute total volume in INR (converting non-INR via standard base rates)
    const inrRates: Record<string, number> = {
      INR: 1.0,
      USD: 83.5,
      EUR: 90.25,
      GBP: 106.1,
      AED: 22.75
    };

    let totalVolumeINR = 0;
    let totalVolumeUSD = 0;
    const usdRate = 83.5;

    for (const t of txs) {
      if (t.status === 'SUCCEEDED') {
        const rateToINR = inrRates[t.currency] || 1.0;
        const inrAmt = t.amount * rateToINR;
        totalVolumeINR += inrAmt;
        totalVolumeUSD += inrAmt / usdRate;
      }
    }

    const successful = txs.filter(t => t.status === 'SUCCEEDED').length;
    const blocked = txs.filter(t => t.status === 'BLOCKED').length;
    const successRate = txs.length > 0 ? (successful / txs.length) * 100 : 100;
    const nettingBatches = treasury.getNettingBatches();
    const totalFeesSavedINR = nettingBatches.reduce((sum, b) => sum + (b.estimatedFeesSavedINR || (b.estimatedFeesSavedUSD ? b.estimatedFeesSavedUSD * 83.5 : 0)), 0);
    const totalFeesSavedUSD = Math.round(totalFeesSavedINR / usdRate);

    res.json({
      totalVolumeINR: Math.round(totalVolumeINR),
      totalVolumeUSD: Math.round(totalVolumeUSD),
      totalTransactions: txs.length,
      successRatePct: Math.round(successRate * 10) / 10,
      blockedFraudCount: blocked,
      nettingFeesSavedINR: Math.round(totalFeesSavedINR),
      nettingFeesSavedUSD: totalFeesSavedUSD,
      activeLedgerEntries: ledger.getJournal().length,
      idempotencyStats: idempotencyManager.getStats()
    });
  });

  router.get('/system/outbox', (req, res) => {
    res.json(saga.getOutboxEvents());
  });

  // ================= DEVELOPER & INTEGRATION =================
  router.get('/developer/keys/:merchantId?', (req, res) => {
    const merchantId = req.params.merchantId || (req.query.merchantId as string) || 'mch_acme_corp';
    res.json(developer.getKeys(merchantId));
  });

  router.post('/developer/keys/rotate', (req, res) => {
    const merchantId = req.body.merchantId || 'mch_acme_corp';
    res.json(developer.rotateSecretKey(merchantId));
  });

  router.post(['/developer/webhook-url', '/developer/webhook/url'], (req, res) => {
    const { merchantId, url, webhookUrl } = req.body;
    res.json(developer.updateWebhookUrl(merchantId || 'mch_acme_corp', url || webhookUrl));
  });

  router.post(['/developer/webhooks/test', '/developer/webhook/test'], (req, res) => {
    const { merchantId, event, eventType, payload } = req.body;
    const result = developer.dispatchTestWebhook(
      merchantId || 'mch_acme_corp', 
      event || eventType || 'payment.captured', 
      payload
    );
    res.json(result);
  });

  router.get(['/developer/webhooks/logs', '/developer/webhook/logs'], (req, res) => {
    res.json(developer.getDeliveryLogs());
  });

  return router;
}
