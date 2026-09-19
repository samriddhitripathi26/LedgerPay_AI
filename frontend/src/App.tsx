import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { OverviewTab } from './components/OverviewTab';
import { PaymentStudioTab } from './components/PaymentStudioTab';
import { FraudIntelligenceTab } from './components/FraudIntelligenceTab';
import { SmartRoutingTab } from './components/SmartRoutingTab';
import { TreasuryTab } from './components/TreasuryTab';
import { LedgerExplorerTab } from './components/LedgerExplorerTab';
import { WorkflowBuilderTab } from './components/WorkflowBuilderTab';
import { ReconciliationTab } from './components/ReconciliationTab';
import { DeveloperTab } from './components/DeveloperTab';
import type { PaymentTransaction, SystemMetrics } from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [activeMerchant, setActiveMerchant] = useState<string>('mch_acme_corp');
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [selectedTx, setSelectedTx] = useState<PaymentTransaction | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [systemHealth, setSystemHealth] = useState({
    backend: true,
    ai: true,
    ledgerValid: true
  });

  const fetchGlobalState = async () => {
    setIsRefreshing(true);
    try {
      // 1. Metrics
      const mRes = await fetch('http://localhost:4000/api/v1/system/metrics');
      if (mRes.ok) setMetrics(await mRes.json());

      // 2. Transactions
      const txRes = await fetch('http://localhost:4000/api/v1/payments');
      if (txRes.ok) {
        const txs = await txRes.json();
        setTransactions(txs);
        if (!selectedTx && txs.length > 0) {
          setSelectedTx(txs[0]);
        }
      }

      // 3. Health
      const bHealth = await fetch('http://localhost:4000/health').then(r => r.ok).catch(() => false);
      const aiHealth = await fetch('http://127.0.0.1:5000/health').then(r => r.ok).catch(() => false);
      const ledVerify = await fetch('http://localhost:4000/api/v1/ledger/verify').then(r => r.json()).then(d => d.isValid).catch(() => false);

      setSystemHealth({
        backend: bHealth,
        ai: aiHealth,
        ledgerValid: ledVerify
      });
    } catch (e) {
      console.error('Error refreshing state:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGlobalState();
    // Periodic telemetry sync every 15 seconds
    const interval = setInterval(fetchGlobalState, 15000);
    return () => clearInterval(interval);
  }, []);

  const handlePaymentSuccess = (newTx: PaymentTransaction) => {
    setTransactions(prev => [newTx, ...prev]);
    setSelectedTx(newTx);
    fetchGlobalState();
  };

  const handleNettingSuccess = () => {
    fetchGlobalState();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeMerchant={activeMerchant}
        setActiveMerchant={setActiveMerchant}
        systemHealth={systemHealth}
        onRefresh={fetchGlobalState}
        isRefreshing={isRefreshing}
      />

      {/* Main Tab Content */}
      <main style={{ flex: 1, padding: '20px 24px', width: '100%' }}>
        {activeTab === 'overview' && (
          <OverviewTab
            metrics={metrics}
            transactions={transactions}
            onSelectTx={setSelectedTx}
            selectedTx={selectedTx}
          />
        )}

        {activeTab === 'simulator' && (
          <PaymentStudioTab
            onPaymentSuccess={handlePaymentSuccess}
            activeMerchant={activeMerchant}
          />
        )}

        {activeTab === 'fraud' && (
          <FraudIntelligenceTab />
        )}

        {activeTab === 'routing' && (
          <SmartRoutingTab />
        )}

        {activeTab === 'treasury' && (
          <TreasuryTab
            activeMerchant={activeMerchant}
            onNettingSuccess={handleNettingSuccess}
          />
        )}

        {activeTab === 'ledger' && (
          <LedgerExplorerTab />
        )}

        {activeTab === 'developer' && (
          <DeveloperTab
            activeMerchant={activeMerchant}
          />
        )}

        {activeTab === 'workflow' && (
          <WorkflowBuilderTab
            activeMerchant={activeMerchant}
          />
        )}

        {activeTab === 'reconciliation' && (
          <ReconciliationTab />
        )}
      </main>

      {/* Clean Instrument Panel Footer */}
      <footer style={{
        borderTop: '1px solid var(--hairline)',
        padding: '14px 24px',
        fontSize: '0.75rem',
        color: 'var(--ink-muted)',
        background: 'var(--base)',
        width: '100%'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '10px' }}>
          <span>LedgerPay AI &bull; Base Currency: INR (₹)</span>
          <span>Zero Double-Charges &bull; LinUCB Smart Routing &bull; SHA-256 Ledger Verified</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
