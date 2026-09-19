import React, { useState, useEffect } from 'react';
import type { ReconciliationData } from '../types';
import { Play, Check, AlertTriangle } from 'lucide-react';

export const ReconciliationTab: React.FC = () => {
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const runReconciliation = async () => {
    setIsRunning(true);
    try {
      const res = await fetch('http://localhost:4000/api/v1/reconciliation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (res.ok) {
        setData(await res.json());
      }
    } catch (e: any) {
      alert(`Reconciliation error: ${e.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    runReconciliation();
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
          gap: '16px',
          borderBottom: '1px solid var(--hairline)',
          paddingBottom: '20px',
          marginBottom: '20px'
        }}>
          <div>
            <span className="label-quiet">Provider & Bank Reconciliation</span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--ink)', marginTop: '2px' }}>
              Statement Settlement Audit & Anomaly Detection
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)', maxWidth: '780px', marginTop: '4px' }}>
              Compares internal double-entry journal postings against external provider settlements and bank payout reports.
            </p>
          </div>

          <button
            onClick={runReconciliation}
            disabled={isRunning}
            className="btn-cobalt"
          >
            <Play size={13} />
            <span>{isRunning ? 'Auditing Statements...' : 'Run Reconciliation'}</span>
          </button>
        </div>

        {/* Hero Metrics Strip */}
        {data && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
            <div>
              <span className="label-quiet">Match Ratio</span>
              <div className="hero-num" style={{ margin: '4px 0', color: 'var(--green)' }}>
                {data.matchRatePct}%
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--ink-secondary)' }}>Within tolerance bounds</span>
            </div>

            <div>
              <span className="label-quiet">Matched Entries</span>
              <div className="hero-num" style={{ margin: '4px 0' }}>
                {data.matchedCount}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--green)' }}>Cleared into bank account</span>
            </div>

            <div>
              <span className="label-quiet">Flagged Discrepancies</span>
              <div className="hero-num" style={{ margin: '4px 0', color: data.discrepancyCount > 0 ? 'var(--red)' : 'var(--green)' }}>
                {data.discrepancyCount}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--ink-secondary)' }}>Fee variance / delayed payout</span>
            </div>

            <div>
              <span className="label-quiet">Net Settlement Variance</span>
              <div className="hero-num-sm" style={{ margin: '8px 0 4px 0' }}>
                ₹{data.netVariance.toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>Intermediary fee delta</span>
            </div>
          </div>
        )}
      </div>

      {/* ==================== CLEAN 2-COLUMN COMPARISON ==================== */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        
        {/* Left: Internal Ledger */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--hairline)' }}>
            <span className="label-quiet">Internal Postings</span>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--ink)' }}>
              Internal Double-Entry Books
            </h3>
          </div>

          <table className="instrument-table">
            <thead>
              <tr>
                <th>Reference ID</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'right' }}>State</th>
              </tr>
            </thead>
            <tbody>
              {data?.matches?.map((item, idx) => (
                <tr key={idx}>
                  <td className="mono" style={{ fontWeight: 600 }}>{item.transactionId}</td>
                  <td style={{ color: 'var(--ink-secondary)' }}>{item.matchType}</td>
                  <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>
                    ₹{(item.amount || 1499).toLocaleString('en-IN')}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="pill-state pill-green">Matched</span>
                  </td>
                </tr>
              ))}

              {data?.discrepancies?.map((disc, idx) => (
                <tr key={`disc_${idx}`} style={{ background: 'var(--red-bg)' }}>
                  <td className="mono" style={{ fontWeight: 600, color: 'var(--red)' }}>{disc.reference}</td>
                  <td style={{ color: 'var(--red)' }}>{disc.description}</td>
                  <td className="mono" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--red)' }}>
                    ₹{Math.abs(disc.amountDifference || 0).toLocaleString('en-IN')}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="pill-state pill-red">Anomaly</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right: Bank Feed */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--hairline)' }}>
            <span className="label-quiet">External Clearing</span>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--ink)' }}>
              Bank Statement Wire Feed
            </h3>
          </div>

          <table className="instrument-table">
            <thead>
              <tr>
                <th>Statement Ref</th>
                <th>Settlement</th>
                <th style={{ textAlign: 'right' }}>Settled Sum</th>
                <th style={{ textAlign: 'right' }}>Verification</th>
              </tr>
            </thead>
            <tbody>
              {data?.matches?.map((item, idx) => (
                <tr key={idx}>
                  <td className="mono" style={{ fontWeight: 600 }}>{item.statementId}</td>
                  <td style={{ color: 'var(--ink-secondary)' }}>Cleared via Wire</td>
                  <td className="mono" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--green)' }}>
                    ₹{(item.amount || 1499).toLocaleString('en-IN')}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="pill-state pill-green">Settled</span>
                  </td>
                </tr>
              ))}

              {data?.discrepancies?.map((disc, idx) => (
                <tr key={`disc_r_${idx}`} style={{ background: 'var(--amber-bg)' }}>
                  <td className="mono" style={{ fontWeight: 600, color: 'var(--amber)' }}>{disc.reference}</td>
                  <td style={{ color: 'var(--amber)' }}>Bank Settlement Delta</td>
                  <td className="mono" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--amber)' }}>
                    ₹{(disc.amountDifference || 120).toLocaleString('en-IN')}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="pill-state pill-amber">Variance</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
};
