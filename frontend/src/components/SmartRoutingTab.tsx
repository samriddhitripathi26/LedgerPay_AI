import React, { useState, useEffect } from 'react';
import type { RoutingStats } from '../types';
import { RefreshCw, Sliders, Check } from 'lucide-react';

export const SmartRoutingTab: React.FC = () => {
  const [stats, setStats] = useState<RoutingStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Interactive Route Sandbox State
  const [testAmount, setTestAmount] = useState<number>(350);
  const [testCurrency, setTestCurrency] = useState<string>('USD');
  const [testRisk, setTestRisk] = useState<number>(20);
  const [testCountry, setTestCountry] = useState<string>('US');
  const [testMethod, setTestMethod] = useState<string>('card');
  const [routingPrediction, setRoutingPrediction] = useState<any | null>(null);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:5000/api/routing/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch routing stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const predictRoute = async () => {
    try {
      const res = await fetch('http://127.0.0.1:5000/api/routing/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: testAmount,
          currency: testCurrency,
          riskScore: testRisk,
          customerCountry: testCountry,
          paymentMethod: testMethod,
          merchantTier: 'standard'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setRoutingPrediction(data);
      }
    } catch (err) {
      console.error('Failed to predict route:', err);
    }
  };

  useEffect(() => {
    fetchStats();
    predictRoute();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      predictRoute();
    }, 250);
    return () => clearTimeout(timer);
  }, [testAmount, testCurrency, testRisk, testCountry, testMethod]);

  const selectedArm = routingPrediction?.selectedProvider || 'stripe';

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
            <span className="label-quiet">Dynamic Contextual Routing</span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--ink)', marginTop: '2px' }}>
              LinUCB Contextual Bandit Matrix
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)', maxWidth: '780px', marginTop: '4px' }}>
              Reinforcement learning agent optimizes authorization rate, provider interchange fees, and response latency.
              Learns continuously online with immediate policy matrix updates.
            </p>
          </div>

          <button onClick={fetchStats} disabled={isLoading} className="btn-quiet">
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Update Policy Weights</span>
          </button>
        </div>
      </div>

      {/* ==================== 4 PROVIDER ARMS MATRIX (1PX HAIRLINE CELLS) ==================== */}
      <div className="hairline-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        {stats && Object.entries(stats).map(([armKey, arm]) => {
          const isSelected = selectedArm.toLowerCase() === armKey.toLowerCase();

          return (
            <div
              key={armKey}
              className="hairline-cell"
              style={{
                position: 'relative',
                background: isSelected ? 'var(--surface)' : 'var(--surface-subtle)',
                borderTop: isSelected ? '3px solid var(--cobalt)' : '1px solid var(--hairline)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--ink)' }}>
                  {arm.name}
                </h3>
                {isSelected ? (
                  <span className="pill-state pill-cobalt">Active Route</span>
                ) : (
                  <span style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', textTransform: 'uppercase' }}>{armKey}</span>
                )}
              </div>

              {/* Big Numerals */}
              <div style={{ margin: '18px 0 10px 0' }}>
                <span className="label-quiet">Clearance Win Rate</span>
                <div className="hero-num" style={{ margin: '4px 0 6px 0', color: arm.successRate >= 90 ? 'var(--green)' : 'var(--amber)' }}>
                  {arm.successRate}%
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.78rem', color: 'var(--ink-secondary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Circuit Latency:</span>
                  <span className="mono" style={{ fontWeight: 600, color: 'var(--ink)' }}>{arm.avg_latency} ms</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Volume Routed:</span>
                  <span className="mono">{arm.total_routed.toLocaleString()} txs</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Policy Reward:</span>
                  <span className="mono" style={{ fontWeight: 600, color: arm.last_reward >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {arm.last_reward > 0 ? `+${arm.last_reward}` : arm.last_reward}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ==================== POLICY SIMULATION SLIDERS ==================== */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        
        {/* Left: Sliders */}
        <div className="instrument-section">
          <div style={{ borderBottom: '1px solid var(--hairline)', paddingBottom: '12px', marginBottom: '16px' }}>
            <span className="label-quiet">Context Vector Controls</span>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--ink)', marginTop: '2px' }}>
              Transaction Parameters
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Amount Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--ink-muted)' }}>Transaction Sum</span>
                <b className="mono">${testAmount}</b>
              </div>
              <input
                type="range"
                min={10}
                max={2500}
                step={10}
                value={testAmount}
                onChange={(e) => setTestAmount(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--cobalt)' }}
              />
            </div>

            {/* Risk Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--ink-muted)' }}>Risk Assessment</span>
                <b className="mono">{testRisk} / 100</b>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={testRisk}
                onChange={(e) => setTestRisk(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: testRisk > 75 ? 'var(--red)' : 'var(--cobalt)' }}
              />
            </div>

            {/* Selects */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="label-quiet" style={{ display: 'block', marginBottom: '4px' }}>Country</label>
                <select
                  value={testCountry}
                  onChange={(e) => setTestCountry(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="US">United States (US)</option>
                  <option value="IN">India (IN)</option>
                  <option value="GB">United Kingdom (GB)</option>
                  <option value="EU">European Union (EU)</option>
                </select>
              </div>
              <div>
                <label className="label-quiet" style={{ display: 'block', marginBottom: '4px' }}>Currency</label>
                <select
                  value={testCurrency}
                  onChange={(e) => setTestCurrency(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="USD">USD ($)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Decision Output */}
        <div className="instrument-section" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ borderBottom: '1px solid var(--hairline)', paddingBottom: '12px', marginBottom: '16px' }}>
              <span className="label-quiet">Selected Arm Output</span>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--ink)', marginTop: '2px' }}>
                Optimal Route Decision
              </h3>
            </div>

            <div style={{ padding: '16px', background: 'var(--surface-subtle)', border: '1px solid var(--hairline)', marginBottom: '16px' }}>
              <span className="label-quiet">Selected Provider</span>
              <div className="hero-num-sm" style={{ margin: '4px 0', textTransform: 'capitalize', color: 'var(--cobalt)' }}>
                {routingPrediction?.selectedProvider || 'Stripe'}
              </div>
              <span className="pill-state pill-cobalt">Bandit Maximum Expected Payoff</span>
            </div>

            {/* Rank scores */}
            {routingPrediction?.armScores && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.78rem' }}>
                <span className="label-quiet">Expected Payoff Rank</span>
                {Object.entries(routingPrediction.armScores).map(([arm, score]: any) => (
                  <div key={arm} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--hairline)', paddingBottom: '4px' }}>
                    <span style={{ textTransform: 'capitalize', color: 'var(--ink-secondary)' }}>{arm}</span>
                    <span className="mono" style={{ fontWeight: 600 }}>{(score * 100).toFixed(2)} pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: '14px' }}>
            Auto-failover saga triggers instant fallback routing upon issuer decline or timeout.
          </div>
        </div>

      </div>

    </div>
  );
};
