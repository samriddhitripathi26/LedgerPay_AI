/**
 * LedgerPay Client SDK - Drop-in Payment Orchestration & Checkout Library
 * Compatible with any web application, ERP, or e-commerce platform.
 * Usage:
 *   <script src="http://localhost:4000/sdk/ledgerpay.js"></script>
 *   const lp = new LedgerPay({ publishableKey: 'pk_live_ledgerpay_enterprise' });
 *   lp.openCheckout({ amount: 1500, currency: 'INR', customer: { email: 'user@acme.com' } });
 */
(function (global) {
  'use strict';

  class LedgerPay {
    constructor(options = {}) {
      this.publishableKey = options.publishableKey || 'pk_live_ledgerpay_enterprise';
      this.endpoint = options.endpoint || (window.location.origin.includes('5173') ? 'http://localhost:4000/api/v1' : (window.location.origin + '/api/v1'));
      this.merchantName = options.merchantName || 'Acme Global Corp';
      this.theme = options.theme || 'dark';
      this._injectStyles();
    }

    _injectStyles() {
      if (document.getElementById('ledgerpay-sdk-styles')) return;
      const css = `
        .lp-backdrop {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(4, 7, 13, 0.82);
          backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          z-index: 999999;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif;
          opacity: 0; transition: opacity 0.2s ease;
        }
        .lp-backdrop.lp-active { opacity: 1; }
        .lp-modal {
          background: #12131a;
          border: 1px solid #1e212b;
          border-radius: 12px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05);
          width: 100%; max-width: 440px;
          overflow: hidden;
          color: #f8fafc;
          transform: translateY(12px) scale(0.98);
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .lp-backdrop.lp-active .lp-modal { transform: translateY(0) scale(1); }
        .lp-header {
          background: #12131a;
          border-bottom: 1px solid #1e212b;
          padding: 16px 20px;
          display: flex; justify-content: space-between; align-items: center;
        }
        .lp-brand-col h4 { margin: 0; font-size: 15px; font-weight: 700; color: #ffffff; letter-spacing: -0.2px; }
        .lp-brand-col span { font-size: 11px; color: #9499ad; }
        .lp-badge-live {
          display: inline-flex; align-items: center; gap: 4px;
          background: rgba(16, 185, 129, 0.12); color: #34d399; font-size: 10px; font-weight: 600;
          padding: 2px 7px; border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.25);
        }
        .lp-badge-live::before {
          content: ''; width: 5px; height: 5px; background: #34d399; border-radius: 50%;
        }
        .lp-amount-banner {
          background: #090a0f;
          padding: 16px 20px;
          border-bottom: 1px solid #1e212b;
          display: flex; justify-content: space-between; align-items: baseline;
        }
        .lp-amount-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64697d; }
        .lp-amount-val { font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
        .lp-currency-sub { font-size: 13px; color: #9499ad; margin-left: 4px; font-weight: 500; }
        .lp-body { padding: 18px 20px; }
        .lp-tabs {
          display: grid; grid-template-columns: 1fr 1fr 1fr;
          gap: 6px; background: #0c0d12;
          padding: 4px; border-radius: 8px; border: 1px solid #1e212b;
          margin-bottom: 16px;
        }
        .lp-tab-btn {
          background: transparent; border: none; color: #9499ad;
          font-size: 12px; font-weight: 600; padding: 7px 4px;
          border-radius: 6px; cursor: pointer; transition: all 0.15s;
        }
        .lp-tab-btn.active {
          background: #1e212b; color: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.4);
        }
        .lp-field { margin-bottom: 12px; }
        .lp-field label { display: block; font-size: 11px; font-weight: 600; color: #9499ad; margin-bottom: 5px; }
        .lp-input {
          width: 100%; box-sizing: border-box; background: #0c0d12;
          border: 1px solid #1e212b; border-radius: 7px;
          color: #f8fafc; font-size: 13px; padding: 9px 12px;
          outline: none; transition: border-color 0.15s;
        }
        .lp-input:focus { border-color: #3b82f6; }
        .lp-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .lp-submit-btn {
          width: 100%; background: #2563eb; color: #ffffff;
          border: none; border-radius: 8px; font-size: 14px; font-weight: 600;
          padding: 12px; cursor: pointer; transition: background 0.15s;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          margin-top: 16px;
        }
        .lp-submit-btn:hover { background: #1d4ed8; }
        .lp-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .lp-footer-trust {
          margin-top: 14px; text-align: center; font-size: 10px; color: #64748b;
          display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .lp-close-btn {
          background: transparent; border: none; color: #64748b;
          cursor: pointer; font-size: 20px; line-height: 1; padding: 4px;
        }
        .lp-close-btn:hover { color: #ffffff; }
        .lp-upi-qr-box {
          background: #ffffff; border-radius: 10px; padding: 14px;
          width: 140px; height: 140px; margin: 0 auto 12px;
          display: flex; align-items: center; justify-content: center;
        }
        .lp-upi-apps {
          display: flex; justify-content: center; gap: 8px; margin-bottom: 12px;
        }
        .lp-upi-pill {
          background: #172033; border: 1px solid #283652; border-radius: 6px;
          font-size: 11px; font-weight: 500; color: #cbd5e1; padding: 4px 10px;
          cursor: pointer;
        }
        .lp-upi-pill:hover { background: #1e2d4a; border-color: #3b82f6; }
      `;
      const styleEl = document.createElement('style');
      styleEl.id = 'ledgerpay-sdk-styles';
      styleEl.textContent = css;
      document.head.appendChild(styleEl);
    }

    openCheckout(options) {
      const {
        amount = 1500,
        currency = 'INR',
        orderId = 'ORD_' + Math.floor(Math.random() * 900000 + 100000),
        customer = {},
        onSuccess = () => {},
        onDismiss = () => {},
        onFailure = () => {}
      } = options;

      const currSymbol = currency.toUpperCase() === 'INR' ? '₹' : (currency.toUpperCase() === 'USD' ? '$' : '€');
      const formattedAmount = `${currSymbol}${Number(amount).toLocaleString('en-IN')}`;

      // Create modal DOM
      const backdrop = document.createElement('div');
      backdrop.className = 'lp-backdrop';

      backdrop.innerHTML = `
        <div class="lp-modal" role="dialog" aria-modal="true">
          <div class="lp-header">
            <div class="lp-brand-col">
              <h4>${this.merchantName}</h4>
              <span>Secured by LedgerPay</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="lp-badge-live">LIVE</span>
              <button class="lp-close-btn" id="lp-btn-close">&times;</button>
            </div>
          </div>
          <div class="lp-amount-banner">
            <div>
              <div class="lp-amount-label">Amount Payable</div>
              <div style="font-size:11px; color:#64748b;">Order Ref: ${orderId}</div>
            </div>
            <div>
              <span class="lp-amount-val">${formattedAmount}</span>
              <span class="lp-currency-sub">${currency.toUpperCase()}</span>
            </div>
          </div>
          <div class="lp-body">
            <div class="lp-tabs">
              <button class="lp-tab-btn active" data-tab="upi">UPI / QR</button>
              <button class="lp-tab-btn" data-tab="card">Cards</button>
              <button class="lp-tab-btn" data-tab="netbanking">NetBanking</button>
            </div>

            <!-- UPI TAB -->
            <div id="lp-tab-pane-upi">
              <div class="lp-upi-qr-box">
                <svg width="120" height="120" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <!-- Simulated Clean QR Code Matrix -->
                  <rect width="100" height="100" fill="white"/>
                  <rect x="10" y="10" width="26" height="26" fill="#0f172a" rx="2"/>
                  <rect x="15" y="15" width="16" height="16" fill="white"/>
                  <rect x="19" y="19" width="8" height="8" fill="#0f172a"/>
                  <rect x="64" y="10" width="26" height="26" fill="#0f172a" rx="2"/>
                  <rect x="69" y="15" width="16" height="16" fill="white"/>
                  <rect x="73" y="19" width="8" height="8" fill="#0f172a"/>
                  <rect x="10" y="64" width="26" height="26" fill="#0f172a" rx="2"/>
                  <rect x="15" y="69" width="16" height="16" fill="white"/>
                  <rect x="19" y="73" width="8" height="8" fill="#0f172a"/>
                  <rect x="42" y="14" width="6" height="14" fill="#0f172a"/>
                  <rect x="42" y="34" width="14" height="6" fill="#0f172a"/>
                  <rect x="46" y="46" width="8" height="8" fill="#2563eb"/>
                  <rect x="64" y="42" width="14" height="6" fill="#0f172a"/>
                  <rect x="42" y="64" width="6" height="18" fill="#0f172a"/>
                  <rect x="60" y="64" width="18" height="6" fill="#0f172a"/>
                  <rect x="72" y="74" width="14" height="14" fill="#0f172a"/>
                </svg>
              </div>
              <div style="text-align:center; font-size:11px; color:#94a3b8; margin-bottom:12px;">Scan with any UPI app (GPay, PhonePe, Paytm)</div>
              <div class="lp-upi-apps">
                <span class="lp-upi-pill">Google Pay</span>
                <span class="lp-upi-pill">PhonePe</span>
                <span class="lp-upi-pill">Paytm</span>
                <span class="lp-upi-pill">BHIM</span>
              </div>
              <div class="lp-field">
                <label>Or enter UPI ID / VPA</label>
                <input class="lp-input" id="lp-upi-input" placeholder="e.g. yourname@okaxis" value="${customer.upiId || 'customer@okaxis'}">
              </div>
            </div>

            <!-- CARD TAB -->
            <div id="lp-tab-pane-card" style="display:none;">
              <div class="lp-field">
                <label>Card Number (RuPay, Visa, Mastercard)</label>
                <input class="lp-input" id="lp-card-num" placeholder="4111 2222 3333 4444" value="4532 8901 2345 6789" maxlength="19">
              </div>
              <div class="lp-grid-2">
                <div class="lp-field">
                  <label>Expiry (MM/YY)</label>
                  <input class="lp-input" id="lp-card-exp" placeholder="12/28" value="08/29" maxlength="5">
                </div>
                <div class="lp-field">
                  <label>CVV / CVC</label>
                  <input class="lp-input" id="lp-card-cvv" placeholder="•••" value="882" maxlength="4" type="password">
                </div>
              </div>
              <div class="lp-field">
                <label>Cardholder Name</label>
                <input class="lp-input" id="lp-card-name" placeholder="Name on Card" value="${customer.name || 'Priya Sharma'}">
              </div>
            </div>

            <!-- NETBANKING TAB -->
            <div id="lp-tab-pane-netbanking" style="display:none;">
              <div class="lp-field">
                <label>Select Major Indian Bank</label>
                <select class="lp-input" id="lp-bank-select" style="background:#090d16;">
                  <option value="HDFC">HDFC Bank</option>
                  <option value="ICICI">ICICI Bank</option>
                  <option value="SBI">State Bank of India (SBI)</option>
                  <option value="AXIS">Axis Bank</option>
                  <option value="KOTAK">Kotak Mahindra Bank</option>
                </select>
              </div>
              <div style="font-size:11px; color:#64748b; line-height:1.4; margin-top:8px;">
                You will be redirected to your bank's secure NetBanking portal for 2-factor OTP authorization.
              </div>
            </div>

            <!-- PAY BUTTON -->
            <button class="lp-submit-btn" id="lp-btn-pay">
              <span id="lp-btn-text">Pay ${formattedAmount}</span>
            </button>

            <div class="lp-footer-trust">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <span>256-bit Encrypted • ISO 20022 Double-Entry Verified</span>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(backdrop);
      requestAnimationFrame(() => backdrop.classList.add('lp-active'));

      let activeMethod = 'upi';

      // Tab switcher
      backdrop.querySelectorAll('.lp-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          backdrop.querySelectorAll('.lp-tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          activeMethod = btn.getAttribute('data-tab');

          backdrop.querySelector('#lp-tab-pane-upi').style.display = activeMethod === 'upi' ? 'block' : 'none';
          backdrop.querySelector('#lp-tab-pane-card').style.display = activeMethod === 'card' ? 'block' : 'none';
          backdrop.querySelector('#lp-tab-pane-netbanking').style.display = activeMethod === 'netbanking' ? 'block' : 'none';
        });
      });

      // Close handler
      const close = () => {
        backdrop.classList.remove('lp-active');
        setTimeout(() => {
          if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
          onDismiss();
        }, 220);
      };

      backdrop.querySelector('#lp-btn-close').addEventListener('click', close);
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) close();
      });

      // Submit payment
      const payBtn = backdrop.querySelector('#lp-btn-pay');
      const btnText = backdrop.querySelector('#lp-btn-text');

      payBtn.addEventListener('click', async () => {
        payBtn.disabled = true;
        btnText.textContent = 'Authorizing & Booking...';

        const idempotencyKey = 'idemp_sdk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const payload = {
          idempotencyKey,
          merchantId: 'mch_acme_corp',
          amount: Number(amount),
          currency: currency.toUpperCase(),
          paymentMethod: activeMethod,
          upiId: activeMethod === 'upi' ? (backdrop.querySelector('#lp-upi-input').value || 'customer@okaxis') : undefined,
          customer: {
            id: customer.id || 'usr_sdk_client',
            email: customer.email || 'customer@acme.com',
            ipAddress: '127.0.0.1',
            country: 'IN'
          },
          description: `Online Checkout via LedgerPay SDK (${orderId})`,
          metadata: { orderId, checkoutSource: 'embed_sdk' }
        };

        try {
          const res = await fetch(`${this.endpoint}/payments/charge`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': idempotencyKey,
              'Authorization': `Bearer ${this.publishableKey}`
            },
            body: JSON.stringify(payload)
          });

          const data = await res.json();
          if (res.ok && data.status === 'SUCCEEDED') {
            btnText.textContent = '✓ Payment Successful';
            payBtn.style.background = '#059669';
            setTimeout(() => {
              backdrop.classList.remove('lp-active');
              setTimeout(() => {
                if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
                onSuccess(data);
              }, 200);
            }, 600);
          } else {
            throw new Error(data.error || 'Payment failed or flagged by risk engine');
          }
        } catch (err) {
          payBtn.disabled = false;
          payBtn.style.background = '#dc2626';
          btnText.textContent = 'Payment Failed - Retry';
          alert('LedgerPay Error: ' + err.message);
          onFailure(err);
        }
      });
    }
  }

  // Auto-bind declarative HTML buttons: <button data-ledgerpay-amount="1500" data-ledgerpay-currency="INR">
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-ledgerpay-checkout]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const lp = new LedgerPay({
          publishableKey: el.getAttribute('data-publishable-key') || 'pk_live_ledgerpay_enterprise'
        });
        lp.openCheckout({
          amount: Number(el.getAttribute('data-amount') || 1500),
          currency: el.getAttribute('data-currency') || 'INR',
          orderId: el.getAttribute('data-order-id') || undefined
        });
      });
    });
  });

  global.LedgerPay = LedgerPay;
})(typeof window !== 'undefined' ? window : this);
