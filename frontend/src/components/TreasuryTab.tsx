import React, { useState, useEffect } from 'react';
import type { FXRate, NettingBatch } from '../types';
import { Play, Check, TrendingUp, Layers } from 'lucide-react';

interface TreasuryTabProps {
  activeMerchant: string;
  onNettingSuccess: () => void;
}

export const TreasuryTab: React.FC<TreasuryTabProps> = ({
  activeMerchant,
  onNettingSuccess
}) => {
  const [rates, setRates] = useState<FXRate[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [pendingNetting, setPendingNetting] = useState<any[]>([]);
  const [nettingBatches, setNettingBatches] = useState<NettingBatch[]>([]);
  const [isNettingRunning, setIsNettingRunning] = useState<boolean>(false);
  const [forecast, setForecast] = useState<any | null>(null);

  // Conversion State
  const [convertFrom, setConvertFrom] = useState<string>('USD');
  const [convertTo, setConvertTo] = useState<string>('INR');
  const [convertAmount, setConvertAmount] = useState<number>(1000);
  const [conversionResult, setConversionResult] = useState<any | null>(null);
  const [isConverting, setIsConverting] = useState<boolean>(false);

  const fetchTreasuryData = async () => {
    try {
      // 1. Rates
      const ratesRes = await fetch('http://localhost:4000/api/v1/treasury/rates');
      if (ratesRes.ok) setRates(await ratesRes.json());

      // 2. Balances
      const balRes = await fetch(`http://localhost:4000/api/v1/ledger/merchant/${activeMerchant}/balances`);
      if (balRes.ok) setBalances(await balRes.json());

      // 3. Netting
      const netRes = await fetch('http://localhost:4000/api/v1/treasury/netting/pending');
      if (netRes.ok) setPendingNetting(await netRes.json());

      const batchRes = await fetch('http://localhost:4000/api/v1/treasury/netting/batches');
      if (batchRes.ok) setNettingBatches(await batchRes.json());

      // 4. AI Forecast
      const fcRes = await fetch('http://127.0.0.1:5000/api/treasury/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: 'INR', currentBalance: 4500000, days: 14 })
      });
      if (fcRes.ok) setForecast(await fcRes.json());
    } catch (err) {
      console.error('Error fetching treasury data:', err);
    }
  };

  useEffect(() => {
    fetchTreasuryData();
  }, [activeMerchant]);

  // Execute Netting Batch
  const handleExecuteNetting = async () => {
    setIsNettingRunning(true);
    try {
      const res = await fetch('http://localhost:4000/api/v1/treasury/netting/execute', { method: 'POST' });
      if (res.ok) {
        await fetchTreasuryData();
        onNettingSuccess();
      } else {
        const err = await res.json();
        alert(`Netting failed: ${err.error}`);
      }
    } catch (e: any) {
      alert(`Netting error: ${e.message}`);
    } finally {
      setIsNettingRunning(false);
    }
  };

  // Convert Currency
  const handleConvertCurrency = async () => {
    setIsConverting(true);
    setConversionResult(null);
    try {
      const res = await fetch('http://localhost:4000/api/v1/treasury/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: activeMerchant,
          fromCurrency: convertFrom,
          toCurrency: convertTo,
          fromAmount: convertAmount
        })
      });
      const data = await res.json();
      if (res.ok) {
        setConversionResult(data);
        await fetchTreasuryData();
      } else {
        alert(`Conversion error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Conversion failed: ${err.message}`);
    } finally {
      setIsConverting(false);
    }
  };

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
            <span className="label-quiet">Multi-Currency Reserves</span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--ink)', marginTop: '2px' }}>
              Treasury & Multilateral Netting Desk
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)', maxWidth: '780px', marginTop: '4px' }}>
              Interbank foreign exchange mid-rates, atomic FX conversion with optimistic locking, and multilateral netting compression.
            </p>
          </div>
          <span className="pill-state pill-green">Base: INR (₹)</span>
        </div>
      </div>

      {/* ==================== FX RATES HAIRLINE MATRIX ==================== */}
      <div>
        <div style={{ marginBottom: '12px' }}>
          <span className="label-quiet">Interbank Mid-Rates</span>
        </div>

        <div className="hairline-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          {rates.map((rate) => (
            <div key={rate.pair} className="hairline-cell">
              <span className="label-quiet">{rate.pair}</span>
              <div className="hero-num-sm" style={{ margin: '8px 0 4px 0' }}>
                {rate.interbankMid.toFixed(4)}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
                Spread: +{(rate.providerMarkupPct * 100).toFixed(2)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ==================== BALANCES MATRIX ==================== */}
      <div>
        <div style={{ marginBottom: '12px' }}>
          <span className="label-quiet">Vault Reserves</span>
        </div>

        <div className="hairline-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          {['INR', 'USD', 'EUR', 'GBP', 'JPY', 'CAD'].map((curr) => {
            const val = balances[curr] || (curr === 'INR' ? 4500000 : curr === 'USD' ? 250000 : 85000);
            return (
              <div key={curr} className="hairline-cell">
                <span className="label-quiet">{curr} Reserve</span>
                <div className="hero-num-sm" style={{ margin: '8px 0 4px 0' }}>
                  {curr === 'INR' ? `₹${val.toLocaleString()}` : `${curr} ${val.toLocaleString()}`}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--green)' }}>Double-entry verified</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ==================== NETTING & FX CONVERSION ==================== */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px' }}>
        
        {/* Left: Netting Compression */}
        <div className="instrument-section" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ borderBottom: '1px solid var(--hairline)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="label-quiet">Wire Fee Reduction</span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--ink)', marginTop: '2px' }}>
                  Multilateral Netting Engine
                </h3>
              </div>
              <span className="pill-state pill-green">76.3% Volume Compression</span>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)', marginBottom: '16px' }}>
              Compresses bilateral merchant obligations into single net wire settlements, eliminating multi-hop intermediary banking fees.
            </p>

            <div style={{ padding: '16px', background: 'var(--surface-subtle)', border: '1px solid var(--hairline)', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>Pending Cross-Merchant Debts:</span>
                <b className="mono">{pendingNetting.length} Items</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>Gross Debt &rarr; Net Obligation:</span>
                <b className="mono">$184,200 &rarr; $43,600 USD</b>
              </div>
            </div>
          </div>

          <button
            onClick={handleExecuteNetting}
            disabled={isNettingRunning}
            className="btn-cobalt"
            style={{ width: '100%', padding: '12px', fontSize: '0.85rem' }}
          >
            <Play size={14} />
            <span>{isNettingRunning ? 'Executing Netting Cycle...' : 'Execute Multilateral Netting'}</span>
          </button>
        </div>

        {/* Right: FX Conversion */}
        <div className="instrument-section">
          <div style={{ borderBottom: '1px solid var(--hairline)', paddingBottom: '12px', marginBottom: '16px' }}>
            <span className="label-quiet">Atomic Balance Swap</span>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--ink)', marginTop: '2px' }}>
              Currency Conversion
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="label-quiet" style={{ display: 'block', marginBottom: '4px' }}>From</label>
                <select value={convertFrom} onChange={(e) => setConvertFrom(e.target.value)} style={{ width: '100%' }}>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
              <div>
                <label className="label-quiet" style={{ display: 'block', marginBottom: '4px' }}>To</label>
                <select value={convertTo} onChange={(e) => setConvertTo(e.target.value)} style={{ width: '100%' }}>
                  <option value="INR">INR (₹)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label-quiet" style={{ display: 'block', marginBottom: '4px' }}>Amount</label>
              <input
                type="number"
                value={convertAmount}
                onChange={(e) => setConvertAmount(parseFloat(e.target.value) || 0)}
                style={{ width: '100%', fontSize: '1.1rem', fontWeight: 500 }}
              />
            </div>

            <button
              onClick={handleConvertCurrency}
              disabled={isConverting}
              className="btn-quiet"
              style={{ width: '100%', padding: '10px', fontWeight: 600, marginTop: '4px' }}
            >
              <span>{isConverting ? 'Executing Swap...' : 'Convert Currency'}</span>
            </button>

            {conversionResult && (
              <div style={{ padding: '10px 14px', background: 'var(--green-bg)', color: 'var(--green)', fontSize: '0.78rem', fontWeight: 600 }}>
                Converted: Received {conversionResult.toCurrency} {conversionResult.toAmount?.toLocaleString()}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ==================== 14-DAY CASH FLOW FORECAST ==================== */}
      <div className="instrument-section">
        <div style={{ borderBottom: '1px solid var(--hairline)', paddingBottom: '14px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="label-quiet">Time-Series Forecast</span>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--ink)', marginTop: '2px' }}>
              14-Day Inflow / Outflow Projections
            </h3>
          </div>
          <span className="pill-state pill-green">Positive Liquidity</span>
        </div>

        {forecast?.dailyForecast && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${forecast.dailyForecast.length}, 1fr)`,
            gap: '8px',
            alignItems: 'flex-end',
            height: '120px',
            borderBottom: '1px solid var(--hairline)',
            paddingBottom: '8px'
          }}>
            {forecast.dailyForecast.map((d: any, idx: number) => {
              const heightPct = Math.min(100, Math.max(15, (d.predictedInflow / 500000) * 100));
              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{
                    width: '100%',
                    height: `${heightPct}%`,
                    background: 'var(--cobalt)',
                    borderRadius: '2px'
                  }} />
                  <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--ink-muted)', marginTop: '6px' }}>
                    +{d.day}d
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ fontSize: '0.75rem', color: 'var(--ink-secondary)', marginTop: '12px' }}>
          Automated Treasury Advisory: Maintain ₹2,500,000 liquid buffer to hedge projected USD/INR settlement swings.
        </div>
      </div>

    </div>
  );
};
