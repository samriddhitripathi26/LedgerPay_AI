export interface StatementItem {
  statementId: string;
  externalReference: string;
  amount: number;
  fee: number;
  currency: string;
  timestamp: string;
  provider: string;
  cardLast4?: string;
  description?: string;
}

export interface InternalLedgerItem {
  transactionId: string;
  merchantId: string;
  amount: number;
  fee: number;
  currency: string;
  provider: string;
  timestamp: string;
  status: string;
}

export interface ReconciliationResult {
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
    matchType: 'EXACT_REF' | 'FUZZY_MATCH';
    variance: number;
  }[];
  discrepancies: {
    reference: string;
    amountDifference: number;
    feeDifference: number;
    matchStatus: 'UNMATCHED_STATEMENT_ONLY' | 'UNMATCHED_LEDGER_ONLY' | 'AMOUNT_MISMATCH';
    provider: string;
    description: string;
    isAnomaly?: boolean;
    anomalyScore?: number;
    anomalyType?: string;
  }[];
}

export class ReconciliationEngine {
  private lastReconciliation?: ReconciliationResult;

  /**
   * Generates sample bank & provider settlement feeds for demonstration.
   */
  public generateSampleFeeds(internalTransactions: InternalLedgerItem[]): StatementItem[] {
    const feeds: StatementItem[] = [];

    // Create matching statements for most internal transactions
    internalTransactions.forEach((tx, idx) => {
      // 90% clean match
      if (idx % 10 !== 0) {
        feeds.push({
          statementId: `stmt_item_${idx}`,
          externalReference: tx.transactionId,
          amount: tx.amount,
          fee: tx.fee,
          currency: tx.currency,
          provider: tx.provider,
          timestamp: tx.timestamp,
          description: `Settlement payout for ${tx.transactionId}`
        });
      } else if (idx % 10 === 0) {
        // Intentionally create a fee surcharge variance or slight amount rounding
        feeds.push({
          statementId: `stmt_item_${idx}`,
          externalReference: tx.transactionId,
          amount: tx.amount,
          fee: tx.fee + 1.85, // Surcharge variance
          currency: tx.currency,
          provider: tx.provider,
          timestamp: tx.timestamp,
          description: `Settlement payout with provider surcharge`
        });
      }
    });

    // Add a ghost provider settlement item not present in internal ledger
    feeds.push({
      statementId: 'stmt_ghost_999',
      externalReference: 'tx_ghost_unrecorded_891',
      amount: 450.0,
      fee: 14.50,
      currency: 'USD',
      provider: 'stripe',
      timestamp: new Date().toISOString(),
      description: 'Stripe Direct Billing (Unrecorded internally)'
    });

    return feeds;
  }

  public reconcile(
    statementItems: StatementItem[],
    ledgerItems: InternalLedgerItem[]
  ): ReconciliationResult {
    const ledgerMapByRef = new Map<string, InternalLedgerItem>();
    const matchedLedgerIds = new Set<string>();

    ledgerItems.forEach(item => {
      ledgerMapByRef.set(item.transactionId, item);
    });

    const matches: ReconciliationResult['matches'] = [];
    const discrepancies: ReconciliationResult['discrepancies'] = [];

    let totalStmtAmt = 0;
    let totalLedgerAmt = 0;

    // First pass: match statement items against ledger
    for (const stmt of statementItems) {
      totalStmtAmt += stmt.amount;
      const internal = ledgerMapByRef.get(stmt.externalReference);

      if (internal) {
        matchedLedgerIds.add(internal.transactionId);
        const amtDiff = Math.abs(stmt.amount - internal.amount);
        const feeDiff = Math.abs(stmt.fee - internal.fee);

        if (amtDiff < 0.01 && feeDiff < 0.05) {
          matches.push({
            statementId: stmt.statementId,
            transactionId: internal.transactionId,
            amount: stmt.amount,
            fee: stmt.fee,
            matchType: 'EXACT_REF',
            variance: 0.0
          });
        } else {
          discrepancies.push({
            reference: stmt.externalReference,
            amountDifference: Number((stmt.amount - internal.amount).toFixed(2)),
            feeDifference: Number((stmt.fee - internal.fee).toFixed(2)),
            matchStatus: 'AMOUNT_MISMATCH',
            provider: stmt.provider,
            description: `Amount or fee variance: Provider recorded fee ${stmt.fee}, ledger expected ${internal.fee}`
          });
        }
      } else {
        // Statement item has no corresponding internal ledger item
        discrepancies.push({
          reference: stmt.externalReference,
          amountDifference: stmt.amount,
          feeDifference: stmt.fee,
          matchStatus: 'UNMATCHED_STATEMENT_ONLY',
          provider: stmt.provider,
          description: `Ghost provider transaction not recorded in internal ledger: ${stmt.description}`
        });
      }
    }

    // Second pass: find ledger items never settled by provider
    for (const led of ledgerItems) {
      totalLedgerAmt += led.amount;
      if (!matchedLedgerIds.has(led.transactionId)) {
        discrepancies.push({
          reference: led.transactionId,
          amountDifference: led.amount,
          feeDifference: led.fee,
          matchStatus: 'UNMATCHED_LEDGER_ONLY',
          provider: led.provider,
          description: `Internal transaction awaiting bank settlement: ${led.transactionId}`
        });
      }
    }

    const matchedCount = matches.length;
    const discrepancyCount = discrepancies.length;
    const totalProcessed = matchedCount + discrepancyCount;
    const matchRatePct = totalProcessed > 0 ? (matchedCount / totalProcessed) * 100 : 100;

    const result: ReconciliationResult = {
      totalStatementItems: statementItems.length,
      totalLedgerItems: ledgerItems.length,
      matchedCount,
      unmatchedCount: discrepancies.filter(d => d.matchStatus !== 'AMOUNT_MISMATCH').length,
      discrepancyCount,
      matchRatePct: Number(matchRatePct.toFixed(1)),
      totalStatementAmount: Number(totalStmtAmt.toFixed(2)),
      totalLedgerAmount: Number(totalLedgerAmt.toFixed(2)),
      netVariance: Number((totalStmtAmt - totalLedgerAmt).toFixed(2)),
      matches,
      discrepancies
    };

    this.lastReconciliation = result;
    return result;
  }

  public getLastReconciliation(): ReconciliationResult | undefined {
    return this.lastReconciliation;
  }
}
