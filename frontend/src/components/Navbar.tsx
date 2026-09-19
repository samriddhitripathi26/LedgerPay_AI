import React from 'react';
import { RefreshCw, Check } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeMerchant: string;
  setActiveMerchant: (merchant: string) => void;
  systemHealth: { backend: boolean; ai: boolean; ledgerValid: boolean };
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activeMerchant,
  setActiveMerchant,
  systemHealth,
  onRefresh,
  isRefreshing
}) => {
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'simulator', label: 'Terminal' },
    { id: 'fraud', label: 'Risk Radar' },
    { id: 'routing', label: 'Router' },
    { id: 'treasury', label: 'Treasury & FX' },
    { id: 'ledger', label: 'Ledger Audit' },
    { id: 'workflow', label: 'Workflows' },
    { id: 'reconciliation', label: 'Reconciliation' },
    { id: 'developer', label: 'Developer' }
  ];

  return (
    <header style={{
      background: 'var(--base)',
      borderBottom: '1px solid var(--hairline)',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      {/* Upper Meta Bar */}
      <div style={{
        width: '100%',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {/* Brand & Environment */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '1.05rem', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
            LedgerPay AI
          </span>
          <span style={{
            fontSize: '0.65rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '2px 6px',
            borderRadius: '2px',
            background: 'var(--green-bg)',
            color: 'var(--green)'
          }}>
            Operational
          </span>
        </div>

        {/* Quiet System Telemetry & Merchant Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '0.75rem' }}>
          {/* Health Indicators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', color: 'var(--ink-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: systemHealth.backend ? 'var(--green)' : 'var(--red)'
              }} />
              <span>Gateway</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: systemHealth.ai ? 'var(--cobalt)' : 'var(--amber)'
              }} />
              <span>AI Engine</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: systemHealth.ledgerValid ? 'var(--green)' : 'var(--amber)' }}>
              <Check size={12} />
              <span>Ledger Balanced</span>
            </div>
          </div>

          <span style={{ width: '1px', height: '14px', background: 'var(--hairline)' }} />

          {/* Merchant Selector */}
          <select
            value={activeMerchant}
            onChange={(e) => setActiveMerchant(e.target.value)}
            style={{
              padding: '5px 10px',
              fontSize: '0.75rem',
              background: 'var(--surface)',
              borderColor: 'var(--hairline)'
            }}
          >
            <option value="mch_acme_corp">Acme Corporation</option>
            <option value="mch_global_fashion">Global Fashion Group</option>
            <option value="mch_crypto_exchange">Nexus Financial</option>
          </select>

          {/* Quiet Sync Button */}
          <button
            onClick={onRefresh}
            className="btn-quiet"
            style={{ padding: '4px 10px', fontSize: '0.72rem' }}
            title="Sync Engine Telemetry"
          >
            <RefreshCw size={11} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Clean Tab Navigation with 1px Hairline */}
      <div style={{ width: '100%', padding: '0 24px' }}>
        <nav style={{ display: 'flex', gap: '28px', overflowX: 'auto' }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--cobalt)' : '2px solid transparent',
                  color: isActive ? 'var(--cobalt)' : 'var(--ink-secondary)',
                  padding: '10px 0 12px 0',
                  fontSize: '0.82rem',
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'color 0.15s ease, border-color 0.15s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
