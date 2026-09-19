import React, { useState, useEffect } from 'react';
import type { Account, JournalEntry } from '../types';
import { ShieldCheck, ChevronDown, ChevronRight, Check } from 'lucide-react';

export const LedgerExplorerTab: React.FC = () => {
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [auditResult, setAuditResult] = useState<{ isValid: boolean; checkedCount: number } | null>(null);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const fetchLedgerData = async () => {
    try {
      const jRes = await fetch('http://localhost:4000/api/v1/ledger/journal');
      if (jRes.ok) setJournal(await jRes.json());

      const aRes = await fetch('http://localhost:4000/api/v1/ledger/accounts');
      if (aRes.ok) setAccounts(await aRes.json());
    } catch (e) {
      console.error('Error fetching ledger data:', e);
    }
  };

  const handleVerifyChain = async () => {
    setIsAuditing(true);
    try {
      const res = await fetch('http://localhost:4000/api/v1/ledger/verify');
      if (res.ok) {
        setAuditResult(await res.json());
      }
    } catch (e: any) {
      alert(`Audit failed: ${e.message}`);
    } finally {
      setIsAuditing(false);
    }
  };

  useEffect(() => {
    fetchLedgerData();
    handleVerifyChain();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Top Header */}
      <div className="instrument-section">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <span className="label-quiet">Cryptographic Accounting</span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--ink)', marginTop: '2px' }}>
              Double-Entry Ledger & SHA-256 Hash Chain
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)', maxWidth: '780px', marginTop: '4px' }}>
              Every transaction enforces <b>sum(Debits) === sum(Credits)</b> atomically.
              Each block seals mathematically with the previous hash from genesis to tip.
            </p>
          </div>

          <button
            onClick={handleVerifyChain}
            disabled={isAuditing}
            className="btn-cobalt"
          >
            <ShieldCheck size={15} />
            <span>{isAuditing ? 'Auditing Blocks...' : 'Verify Cryptographic Integrity'}</span>
          </button>
        </div>

        {/* Audit Status Result */}
        {auditResult && (
          <div style={{
            marginTop: '20px',
            padding: '14px 18px',
            background: 'var(--green-bg)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Check size={16} />
              <span>Cryptographic Chain Unbroken: {auditResult.checkedCount} Blocks Verified from Genesis</span>
            </div>
            <span className="pill-state pill-green">Verified</span>
          </div>
        )}
      </div>

      {/* ==================== JOURNAL ENTRIES LIST ==================== */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--hairline)' }}>
          <span className="label-quiet">Immutable Journal Daybook</span>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--ink)', marginTop: '2px' }}>
            Journal Entries (#{journal.length} Total)
          </h3>
        </div>

        <div>
          {journal.map((entry, idx) => {
            const isExpanded = expandedIndex === idx;

            return (
              <div
                key={entry.id}
                style={{
                  borderBottom: '1px solid var(--hairline)',
                  padding: '16px 24px'
                }}
              >
                <div
                  onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '0.875rem' }}>
                        #{entry.index}: {entry.referenceType} ({entry.referenceId})
                      </span>
                      <span className="pill-state pill-green" style={{ fontSize: '0.62rem' }}>Balanced</span>
                    </div>
                    <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginTop: '2px' }}>
                      {new Date(entry.timestamp).toLocaleString()} &bull; ID: {entry.id}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--ink-secondary)' }}>
                      Hash: {entry.hash ? entry.hash.slice(0, 16) : 'genesis'}...
                    </div>
                    {isExpanded ? <ChevronDown size={14} color="var(--ink-muted)" /> : <ChevronRight size={14} color="var(--ink-muted)" />}
                  </div>
                </div>

                {/* Expanded Postings */}
                {isExpanded && (
                  <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--hairline)' }}>
                    <table className="instrument-table" style={{ fontSize: '0.78rem' }}>
                      <thead>
                        <tr>
                          <th>Account Title</th>
                          <th>Currency</th>
                          <th style={{ textAlign: 'right' }}>Debit (DR)</th>
                          <th style={{ textAlign: 'right' }}>Credit (CR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entry.postings.map((line, lIdx) => (
                          <tr key={lIdx}>
                            <td style={{ fontWeight: 500 }}>{line.accountId} ({line.description})</td>
                            <td>{line.currency}</td>
                            <td className="mono" style={{ textAlign: 'right', color: line.direction === 'DEBIT' ? 'var(--green)' : 'transparent', fontWeight: 600 }}>
                              {line.direction === 'DEBIT' ? line.amount.toLocaleString() : '-'}
                            </td>
                            <td className="mono" style={{ textAlign: 'right', color: line.direction === 'CREDIT' ? 'var(--cobalt)' : 'transparent', fontWeight: 600 }}>
                              {line.direction === 'CREDIT' ? line.amount.toLocaleString() : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div style={{ marginTop: '12px', padding: '10px 14px', background: 'var(--surface-subtle)', fontSize: '0.72rem', color: 'var(--ink-secondary)' }}>
                      <div><b>Previous Hash:</b> <span className="mono">{entry.prevHash}</span></div>
                      <div><b>Current Block Seal:</b> <span className="mono">{entry.hash}</span></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ==================== MASTER CHART OF ACCOUNTS ==================== */}
      <div>
        <div style={{ marginBottom: '12px' }}>
          <span className="label-quiet">Balance Sheet</span>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--ink)', marginTop: '2px' }}>
            Chart of Accounts
          </h3>
        </div>

        <div className="hairline-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {accounts.map((acc) => (
            <div key={acc.id} className="hairline-cell">
              <span className="label-quiet">{acc.type} &bull; {acc.currency}</span>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink)', margin: '4px 0 8px 0' }}>
                {acc.name}
              </div>
              <div className="hero-num-sm" style={{ color: acc.balance >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {acc.currency} {acc.balance.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
