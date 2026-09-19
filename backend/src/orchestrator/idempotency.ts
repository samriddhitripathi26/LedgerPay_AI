export interface IdempotencyRecord {
  key: string;
  merchantId: string;
  status: 'IN_FLIGHT' | 'COMPLETED' | 'FAILED';
  lockedAt: number;
  completedAt?: number;
  responseStatus?: number;
  responseBody?: any;
  requestFingerprint?: string;
  ttl: number; // milliseconds
}

export class IdempotencyManager {
  private records: Map<string, IdempotencyRecord> = new Map();
  private readonly defaultTTL = 86400 * 1000; // 24 hours
  private readonly lockTimeout = 10000; // 10s lease before auto-recovery

  private buildCompoundKey(merchantId: string, idempotencyKey: string): string {
    return `${merchantId}:${idempotencyKey}`;
  }

  /**
   * Atomically acquires an idempotency lock for the incoming request.
   * Returns:
   *  - { acquired: true }: First time request, lock acquired, proceed with processing.
   *  - { acquired: false, status: 'COMPLETED', cachedResponse }: Already finished, replay cached output.
   *  - { acquired: false, status: 'IN_FLIGHT' }: Concurrent duplicate request is already actively processing.
   */
  public acquireLock(
    merchantId: string,
    idempotencyKey: string,
    requestFingerprint?: string
  ): {
    acquired: boolean;
    status: 'NEW' | 'IN_FLIGHT' | 'COMPLETED';
    record?: IdempotencyRecord;
  } {
    const compoundKey = this.buildCompoundKey(merchantId, idempotencyKey);
    const now = Date.now();
    const existing = this.records.get(compoundKey);

    if (existing) {
      // Check if expired
      if (now - existing.lockedAt > existing.ttl) {
        this.records.delete(compoundKey);
      } else if (existing.status === 'COMPLETED') {
        return {
          acquired: false,
          status: 'COMPLETED',
          record: existing
        };
      } else if (existing.status === 'IN_FLIGHT') {
        // If locked longer than lockTimeout, consider it dead/abandoned and allow takeover
        if (now - existing.lockedAt > this.lockTimeout) {
          existing.lockedAt = now;
          existing.status = 'IN_FLIGHT';
          existing.requestFingerprint = requestFingerprint;
          return { acquired: true, status: 'NEW', record: existing };
        }
        return {
          acquired: false,
          status: 'IN_FLIGHT',
          record: existing
        };
      }
    }

    // New atomic lease
    const newRecord: IdempotencyRecord = {
      key: idempotencyKey,
      merchantId,
      status: 'IN_FLIGHT',
      lockedAt: now,
      requestFingerprint,
      ttl: this.defaultTTL
    };

    this.records.set(compoundKey, newRecord);
    return {
      acquired: true,
      status: 'NEW',
      record: newRecord
    };
  }

  public commit(
    merchantId: string,
    idempotencyKey: string,
    responseStatus: number,
    responseBody: any
  ): void {
    const compoundKey = this.buildCompoundKey(merchantId, idempotencyKey);
    const existing = this.records.get(compoundKey);
    if (existing) {
      existing.status = 'COMPLETED';
      existing.completedAt = Date.now();
      existing.responseStatus = responseStatus;
      existing.responseBody = responseBody;
    }
  }

  public release(merchantId: string, idempotencyKey: string): void {
    const compoundKey = this.buildCompoundKey(merchantId, idempotencyKey);
    this.records.delete(compoundKey);
  }

  public getStats(): { totalKeys: number; inFlight: number; completed: number } {
    let inFlight = 0;
    let completed = 0;
    for (const rec of this.records.values()) {
      if (rec.status === 'IN_FLIGHT') inFlight++;
      else if (rec.status === 'COMPLETED') completed++;
    }
    return {
      totalKeys: this.records.size,
      inFlight,
      completed
    };
  }
}
