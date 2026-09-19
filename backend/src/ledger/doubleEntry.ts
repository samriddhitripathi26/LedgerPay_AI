import crypto from 'crypto';

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export interface Account {
  id: string; // e.g. "merchant:mch_acme:USD" or "asset:clearing:stripe:USD"
  type: AccountType;
  currency: string;
  name: string;
  merchantId?: string;
  balance: number; // Signed or positive; assets debited+, liabilities credited+
  version: number; // For optimistic concurrency locking
  createdAt: string;
}

export interface JournalPosting {
  accountId: string;
  amount: number;
  direction: 'DEBIT' | 'CREDIT';
  currency: string;
  description: string;
}

export interface JournalEntry {
  id: string;
  index: number;
  timestamp: string;
  referenceId: string; // e.g. transactionId or nettingBatchId
  referenceType: 'PAYMENT' | 'FX_CONVERSION' | 'NETTING_SETTLEMENT' | 'FEE' | 'REFUND' | 'RECON_ADJUSTMENT';
  postings: JournalPosting[];
  prevHash: string;
  hash: string;
  metadata?: Record<string, any>;
}

export class DoubleEntryLedger {
  private accounts: Map<string, Account> = new Map();
  private journal: JournalEntry[] = [];
  private lastHash: string = '0000000000000000000000000000000000000000000000000000000000000000';

  constructor() {
    this.seedDefaultAccounts();
  }

  private seedDefaultAccounts() {
    const currencies = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'];
    const providers = ['stripe', 'adyen', 'paypal', 'checkout_com'];
    const merchants = ['mch_acme_corp', 'mch_global_fashion', 'mch_crypto_exchange', 'mch_default'];

    // Platform accounts
    currencies.forEach(curr => {
      this.getOrCreateAccount(`revenue:platform_fees:${curr}`, 'REVENUE', curr, `Platform Fees (${curr})`);
      this.getOrCreateAccount(`revenue:fx_spread:${curr}`, 'REVENUE', curr, `FX Spread Revenue (${curr})`);
      this.getOrCreateAccount(`expense:fx_loss:${curr}`, 'EXPENSE', curr, `FX Loss Expense (${curr})`);
      this.getOrCreateAccount(`asset:bank_treasury:${curr}`, 'ASSET', curr, `Bank Treasury Master (${curr})`);

      providers.forEach(p => {
        this.getOrCreateAccount(`asset:clearing:${p}:${curr}`, 'ASSET', curr, `${p.toUpperCase()} Clearing (${curr})`);
        this.getOrCreateAccount(`expense:provider_fees:${p}:${curr}`, 'EXPENSE', curr, `${p.toUpperCase()} Fees (${curr})`);
        this.getOrCreateAccount(`liability:provider_payable:${p}:${curr}`, 'LIABILITY', curr, `${p.toUpperCase()} Payable (${curr})`);
      });

      merchants.forEach(m => {
        this.getOrCreateAccount(`liability:merchant_payable:${m}:${curr}`, 'LIABILITY', curr, `${m} Payable (${curr})`, m);
      });
    });

    // Seed starting liquidity in INR and foreign treasury
    this.getOrCreateAccount('asset:bank_treasury:INR', 'ASSET', 'INR', 'Bank Treasury Master (INR)').balance = 2500000;
    this.getOrCreateAccount('asset:bank_treasury:USD', 'ASSET', 'USD', 'Bank Treasury Master (USD)').balance = 50000;
    this.getOrCreateAccount('asset:bank_treasury:EUR', 'ASSET', 'EUR', 'Bank Treasury Master (EUR)').balance = 40000;
    this.getOrCreateAccount('liability:merchant_payable:mch_acme_corp:INR', 'LIABILITY', 'INR', 'Acme INR Payable', 'mch_acme_corp').balance = 850000;
    this.getOrCreateAccount('liability:merchant_payable:mch_acme_corp:USD', 'LIABILITY', 'USD', 'Acme USD Payable', 'mch_acme_corp').balance = 12500;
    this.getOrCreateAccount('liability:merchant_payable:mch_global_fashion:INR', 'LIABILITY', 'INR', 'Global Fashion INR', 'mch_global_fashion').balance = 420000;
    this.getOrCreateAccount('liability:merchant_payable:mch_global_fashion:EUR', 'LIABILITY', 'EUR', 'Global Fashion EUR', 'mch_global_fashion').balance = 8500;
  }

  public getOrCreateAccount(id: string, type: AccountType, currency: string, name: string, merchantId?: string): Account {
    if (!this.accounts.has(id)) {
      this.accounts.set(id, {
        id,
        type,
        currency: currency.toUpperCase(),
        name,
        merchantId,
        balance: 0,
        version: 1,
        createdAt: new Date().toISOString()
      });
    }
    return this.accounts.get(id)!;
  }

  public getAccount(id: string): Account | undefined {
    return this.accounts.get(id);
  }

  public getMerchantBalances(merchantId: string): Record<string, number> {
    const balances: Record<string, number> = {};
    for (const [id, acc] of this.accounts.entries()) {
      if (acc.merchantId === merchantId && acc.type === 'LIABILITY') {
        balances[acc.currency] = Math.round(acc.balance * 100) / 100;
      }
    }
    return balances;
  }

  public getAllAccounts(): Account[] {
    return Array.from(this.accounts.values());
  }

  public getJournal(): JournalEntry[] {
    return this.journal;
  }

  public calculateHash(index: number, timestamp: string, refId: string, postings: JournalPosting[], prevHash: string): string {
    const dataString = JSON.stringify({ index, timestamp, refId, postings, prevHash });
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Records an atomic journal entry.
   * STRICT CONSTRAINT: For every currency in the postings, sum(DEBITS) must equal sum(CREDITS).
   * Also computes SHA-256 hash chaining to guarantee tamper resistance.
   */
  public recordEntry(
    referenceId: string,
    referenceType: JournalEntry['referenceType'],
    postings: JournalPosting[],
    metadata?: Record<string, any>
  ): JournalEntry {
    if (!postings || postings.length < 2) {
      throw new Error(`Double-entry requires at least two postings; received ${postings?.length || 0}`);
    }

    // 1. Verify currency balance invariant: sum(Debits) === sum(Credits) for each currency
    const currencySums: Record<string, { debit: number; credit: number }> = {};

    for (const post of postings) {
      const curr = post.currency.toUpperCase();
      if (!currencySums[curr]) {
        currencySums[curr] = { debit: 0, credit: 0 };
      }
      if (post.amount <= 0) {
        throw new Error(`Invalid posting amount: ${post.amount}. Must be strictly positive.`);
      }

      if (post.direction === 'DEBIT') {
        currencySums[curr].debit += post.amount;
      } else {
        currencySums[curr].credit += post.amount;
      }
    }

    for (const [curr, sums] of Object.entries(currencySums)) {
      const diff = Math.abs(sums.debit - sums.credit);
      if (diff > 0.001) {
        throw new Error(
          `Imbalanced journal entry for ${curr}: Debits (${sums.debit.toFixed(4)}) != Credits (${sums.credit.toFixed(4)}), diff = ${diff.toFixed(4)}`
        );
      }
    }

    // 2. Atomically apply postings to account balances
    // Ensure all accounts exist
    for (const post of postings) {
      if (!this.accounts.has(post.accountId)) {
        throw new Error(`Account not found: ${post.accountId}`);
      }
    }

    for (const post of postings) {
      const acc = this.accounts.get(post.accountId)!;
      // Normal balance rules:
      // ASSET & EXPENSE: Debit increases (+), Credit decreases (-)
      // LIABILITY, EQUITY & REVENUE: Credit increases (+), Debit decreases (-)
      if (acc.type === 'ASSET' || acc.type === 'EXPENSE') {
        acc.balance += (post.direction === 'DEBIT' ? post.amount : -post.amount);
      } else {
        acc.balance += (post.direction === 'CREDIT' ? post.amount : -post.amount);
      }
      acc.version += 1;
    }

    // 3. Construct journal entry and compute cryptographic hash
    const index = this.journal.length + 1;
    const timestamp = new Date().toISOString();
    const hash = this.calculateHash(index, timestamp, referenceId, postings, this.lastHash);

    const entry: JournalEntry = {
      id: `jnl_${crypto.randomUUID().slice(0, 8)}`,
      index,
      timestamp,
      referenceId,
      referenceType,
      postings,
      prevHash: this.lastHash,
      hash,
      metadata
    };

    this.journal.push(entry);
    this.lastHash = hash;

    return entry;
  }

  /**
   * Cryptographic integrity verification: recalculates hashes from index 1 to the end.
   */
  public verifyLedgerIntegrity(): { isValid: boolean; checkedCount: number; brokenIndex?: number } {
    let currentPrev = '0000000000000000000000000000000000000000000000000000000000000000';
    for (let i = 0; i < this.journal.length; i++) {
      const entry = this.journal[i];
      if (entry.prevHash !== currentPrev) {
        return { isValid: false, checkedCount: i, brokenIndex: entry.index };
      }
      const recalculated = this.calculateHash(entry.index, entry.timestamp, entry.referenceId, entry.postings, entry.prevHash);
      if (recalculated !== entry.hash) {
        return { isValid: false, checkedCount: i, brokenIndex: entry.index };
      }
      currentPrev = entry.hash;
    }
    return { isValid: true, checkedCount: this.journal.length };
  }

  /**
   * Generates a complete CSV export of all journal entries and debit/credit postings.
   */
  public exportJournalCSV(): string {
    const headers = [
      'Entry ID',
      'Index',
      'Timestamp',
      'Reference ID',
      'Reference Type',
      'Account ID',
      'Direction',
      'Amount',
      'Currency',
      'Description',
      'Entry Hash',
      'Prev Hash'
    ];

    const rows: string[] = [headers.join(',')];

    for (const entry of this.journal) {
      for (const posting of entry.postings) {
        const row = [
          `"${entry.id}"`,
          entry.index,
          `"${entry.timestamp}"`,
          `"${entry.referenceId}"`,
          `"${entry.referenceType}"`,
          `"${posting.accountId}"`,
          `"${posting.direction}"`,
          posting.amount.toFixed(2),
          `"${posting.currency}"`,
          `"${(posting.description || '').replace(/"/g, '""')}"`,
          `"${entry.hash}"`,
          `"${entry.prevHash}"`
        ];
        rows.push(row.join(','));
      }
    }

    return rows.join('\n');
  }
}
