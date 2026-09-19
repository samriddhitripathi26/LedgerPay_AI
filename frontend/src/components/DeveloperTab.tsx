import React, { useState, useEffect } from 'react';
import { Copy, Eye, EyeOff, RefreshCw, Send, Check } from 'lucide-react';
import type { MerchantApiKeys, WebhookDeliveryLog } from '../types';

interface DeveloperTabProps {
  activeMerchant: string;
}

export const DeveloperTab: React.FC<DeveloperTabProps> = ({ activeMerchant }) => {
  const [keys, setKeys] = useState<MerchantApiKeys | null>(null);
  const [showSecret, setShowSecret] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [webhookUrlInput, setWebhookUrlInput] = useState<string>('');
  const [isSavingUrl, setIsSavingUrl] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Webhook Tester State
  const [selectedEvent, setSelectedEvent] = useState<string>('payment.captured');
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<WebhookDeliveryLog | null>(null);
  const [activeSnippetTab, setActiveSnippetTab] = useState<'node' | 'python' | 'curl' | 'react'>('node');

  // Fetch API Keys & Webhook configuration
  const fetchDeveloperConfig = async () => {
    try {
      const res = await fetch(`http://localhost:4000/api/v1/developer/keys/${activeMerchant}`);
      if (res.ok) {
        const data: MerchantApiKeys = await res.json();
        setKeys(data);
        setWebhookUrlInput(data.webhookUrl || 'https://webhook.site/ledgerpay-demo');
      }
    } catch (err) {
      console.error('Error fetching developer keys:', err);
    }
  };

  useEffect(() => {
    fetchDeveloperConfig();
  }, [activeMerchant]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRotateKeys = async () => {
    if (!confirm('Are you sure you want to rotate your secret API key? Existing integrations will need to be updated.')) {
      return;
    }
    try {
      const res = await fetch('http://localhost:4000/api/v1/developer/keys/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId: activeMerchant })
      });
      if (res.ok) {
        const data = await res.json();
        setKeys(data);
        alert('API keys rotated successfully.');
      }
    } catch (err) {
      alert('Failed to rotate keys: ' + err);
    }
  };

  const handleSaveWebhookUrl = async () => {
    setIsSavingUrl(true);
    setSaveMessage(null);
    try {
      const res = await fetch('http://localhost:4000/api/v1/developer/webhooks/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: activeMerchant,
          webhookUrl: webhookUrlInput
        })
      });
      if (res.ok) {
        setSaveMessage('Webhook URL saved.');
        setTimeout(() => setSaveMessage(null), 3000);
      }
    } catch (err: any) {
      alert('Failed to save webhook URL: ' + err.message);
    } finally {
      setIsSavingUrl(false);
    }
  };

  const handleDispatchTestWebhook = async () => {
    setIsDispatching(true);
    setTestResult(null);
    try {
      const res = await fetch('http://localhost:4000/api/v1/developer/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: activeMerchant,
          eventType: selectedEvent
        })
      });
      const data = await res.json();
      setTestResult(data.deliveryLog);
    } catch (err: any) {
      alert('Failed to dispatch test webhook: ' + err.message);
    } finally {
      setIsDispatching(false);
    }
  };

  const snippets = {
    node: `// LedgerPay AI Node.js SDK
import { LedgerPay } from '@ledgerpay/sdk';

const client = new LedgerPay({
  apiKey: '${keys?.publishableKey || 'pk_live_demo'}',
  secretKey: '${keys?.secretKey || 'sk_live_demo'}'
});

const charge = await client.payments.create({
  amount: 1499.00,
  currency: 'INR',
  paymentMethod: 'upi',
  idempotencyKey: 'idem_' + Date.now()
});
console.log('Booked Hash:', charge.ledgerHash);`,

    python: `# LedgerPay AI Python Client
import ledgerpay

client = ledgerpay.Client(
    api_key="${keys?.publishableKey || 'pk_live_demo'}",
    secret_key="${keys?.secretKey || 'sk_live_demo'}"
)

charge = client.payments.create(
    amount=1499.00,
    currency="INR",
    payment_method="upi",
    idempotency_key=f"idem_{int(time.time())}"
)
print(f"Booked Hash: {charge.ledger_hash}")`,

    curl: `# Direct HTTP Inscription
curl -X POST http://localhost:4000/api/v1/payments/charge \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${keys?.secretKey || 'sk_live_demo'}" \\
  -H "Idempotency-Key: idem_1710112345" \\
  -d '{
    "merchantId": "${activeMerchant}",
    "amount": 1499.00,
    "currency": "INR",
    "paymentMethod": "upi"
  }'`,

    react: `// React Client SDK with Double-Charge Prevention
import { useLedgerPay } from '@ledgerpay/react';

export function CheckoutButton() {
  const { processPayment } = useLedgerPay({
    publishableKey: '${keys?.publishableKey || 'pk_live_demo'}'
  });

  return (
    <button onClick={() => processPayment({ amount: 1499.00, currency: 'INR' })}>
      Pay ₹1,499 with UPI
    </button>
  );
}`
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
            <span className="label-quiet">Developer Hub</span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--ink)', marginTop: '2px' }}>
              API Credentials & Integration Sandbox
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)', maxWidth: '780px', marginTop: '4px' }}>
              Secure API authentication keys, webhook notification endpoints with HMAC-SHA256 signatures, and multi-language SDK snippets.
            </p>
          </div>

          <button onClick={handleRotateKeys} className="btn-quiet">
            <RefreshCw size={13} />
            <span>Rotate Secret Key</span>
          </button>
        </div>
      </div>

      {/* ==================== API KEYS SECTION ==================== */}
      <div className="instrument-section">
        <div style={{ borderBottom: '1px solid var(--hairline)', paddingBottom: '12px', marginBottom: '18px' }}>
          <span className="label-quiet">Authentication Credentials</span>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--ink)', marginTop: '2px' }}>
            API Keys
          </h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Public Key */}
          <div style={{ padding: '16px', background: 'var(--surface-subtle)', border: '1px solid var(--hairline)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span className="label-quiet">Publishable Key (Client-Side)</span>
              <button onClick={() => handleCopy(keys?.publishableKey || '', 'pub')} className="btn-quiet" style={{ padding: '4px 10px', fontSize: '0.72rem' }}>
                <Copy size={12} />
                <span>{copiedKey === 'pub' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="mono" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink)' }}>
              {keys?.publishableKey || 'pk_live_79a2bf83910c2e9'}
            </div>
          </div>

          {/* Secret Key */}
          <div style={{ padding: '16px', background: 'var(--surface-subtle)', border: '1px solid var(--hairline)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span className="label-quiet">Secret Key (Server-Side)</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setShowSecret(!showSecret)} className="btn-quiet" style={{ padding: '4px 10px', fontSize: '0.72rem' }}>
                  {showSecret ? <EyeOff size={12} /> : <Eye size={12} />}
                  <span>{showSecret ? 'Hide' : 'Reveal'}</span>
                </button>
                <button onClick={() => handleCopy(keys?.secretKey || '', 'sec')} className="btn-quiet" style={{ padding: '4px 10px', fontSize: '0.72rem' }}>
                  <Copy size={12} />
                  <span>{copiedKey === 'sec' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
            <div className="mono" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink)' }}>
              {showSecret ? (keys?.secretKey || 'sk_live_99d10e82c1bf3201') : 'sk_live_••••••••••••••••••••••••••••'}
            </div>
          </div>
        </div>
      </div>

      {/* ==================== WEBHOOKS DISPATCHER ==================== */}
      <div className="instrument-section">
        <div style={{ borderBottom: '1px solid var(--hairline)', paddingBottom: '12px', marginBottom: '18px' }}>
          <span className="label-quiet">Event Webhooks</span>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--ink)', marginTop: '2px' }}>
            Endpoint & Dispatch Tester
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
          {/* Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="label-quiet" style={{ display: 'block', marginBottom: '4px' }}>Receiving Webhook URL</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={webhookUrlInput}
                  onChange={(e) => setWebhookUrlInput(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button onClick={handleSaveWebhookUrl} disabled={isSavingUrl} className="btn-quiet">
                  <span>Save</span>
                </button>
              </div>
              {saveMessage && (
                <span style={{ fontSize: '0.75rem', color: 'var(--green)', fontWeight: 600, marginTop: '4px', display: 'block' }}>
                  {saveMessage}
                </span>
              )}
            </div>

            <div>
              <label className="label-quiet" style={{ display: 'block', marginBottom: '4px' }}>Test Dispatch Event</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={selectedEvent}
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="payment.captured">payment.captured</option>
                  <option value="fraud.flagged">fraud.flagged</option>
                  <option value="netting.settled">netting.settled</option>
                  <option value="ledger.audited">ledger.audited</option>
                </select>
                <button
                  onClick={handleDispatchTestWebhook}
                  disabled={isDispatching}
                  className="btn-cobalt"
                >
                  <Send size={13} />
                  <span>{isDispatching ? 'Sending...' : 'Dispatch Test'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Test Result Box */}
          <div style={{ padding: '16px', background: 'var(--surface-subtle)', border: '1px solid var(--hairline)', fontSize: '0.78rem' }}>
            <span className="label-quiet" style={{ display: 'block', marginBottom: '8px' }}>Dispatch Status</span>
            {testResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div>HTTP Status: <b style={{ color: testResult.statusCode === 200 ? 'var(--green)' : 'var(--red)' }}>{testResult.statusCode} OK</b></div>
                <div>Event Type: <span className="mono">{testResult.event}</span></div>
                <div>Latency: <span className="mono">{testResult.latencyMs}ms</span></div>
                <div>Signature: <span className="mono">HMAC-SHA256</span></div>
              </div>
            ) : (
              <div style={{ color: 'var(--ink-muted)' }}>
                Click "Dispatch Test" to verify your receiving endpoint.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==================== CODE SNIPPETS ==================== */}
      <div style={{ background: '#0E0F14', border: '1px solid #1E2029', padding: '24px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #1E2029',
          paddingBottom: '14px',
          marginBottom: '16px'
        }}>
          <div>
            <span className="label-quiet" style={{ color: '#878994' }}>Integration Guide</span>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#FFFFFF', marginTop: '2px' }}>
              SDK Implementation Snippets
            </h3>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {(['node', 'python', 'curl', 'react'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveSnippetTab(tab)}
                style={{
                  background: activeSnippetTab === tab ? 'var(--cobalt)' : 'transparent',
                  color: activeSnippetTab === tab ? '#FFFFFF' : '#878994',
                  border: 'none',
                  padding: '4px 10px',
                  borderRadius: '2px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {tab.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <pre style={{
          color: '#E0E7FF',
          fontSize: '0.8rem',
          lineHeight: 1.5,
          overflowX: 'auto',
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.02)',
          fontFamily: 'var(--font-mono)'
        }}>
          {snippets[activeSnippetTab]}
        </pre>
      </div>

    </div>
  );
};
