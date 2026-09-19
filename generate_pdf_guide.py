import os
import sys
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """Canvas that enables two-pass page numbering ('Page X of Y') and consistent headers/footers."""
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))

        # Running Header on page 2+
        if self._pageNumber > 1:
            self.drawString(36, letter[1] - 25, "LedgerPay AI -- Comprehensive Project & Website Feature Manual")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(36, letter[1] - 28, letter[0] - 36, letter[1] - 28)

        # Running Footer on all pages
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(36, 28, letter[0] - 36, 28)
        self.drawString(36, 18, "LedgerPay AI Enterprise Guide  |  Zero Double-Charges  |  AI Fraud GNN  |  Smart Routing")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(letter[0] - 36, 18, page_str)

        self.restoreState()


def create_pdf(filename="LedgerPay_AI_Project_Guide.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=34,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    
    # Custom Palette
    c_primary = colors.HexColor("#0F172A")    # Deep Navy
    c_brand = colors.HexColor("#1E40AF")      # Royal Blue
    c_accent = colors.HexColor("#4338CA")     # Indigo
    c_slate = colors.HexColor("#334155")      # Slate text
    c_card_bg = colors.HexColor("#F8FAFC")    # Light background
    c_border = colors.HexColor("#CBD5E1")     # Light border

    # Typography
    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#FFFFFF")
    )

    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#E2E8F0")
    )

    h1_style = ParagraphStyle(
        'SectionH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=c_brand,
        spaceBefore=8,
        spaceAfter=3,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=c_primary,
        spaceBefore=6,
        spaceAfter=2,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=c_slate,
        spaceAfter=3
    )

    bullet_style = ParagraphStyle(
        'CustomBullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=c_slate,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=2
    )

    callout_style = ParagraphStyle(
        'CalloutText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor("#1E293B")
    )

    callout_bold = ParagraphStyle(
        'CalloutBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=c_brand
    )

    story = []

    # =========================================================================
    # COVER / HERO BANNER
    # =========================================================================
    banner_content = [
        [Paragraph("LEDGERPAY AI - EXECUTIVE & BEGINNER OVERVIEW", ParagraphStyle('SubHeader', parent=subtitle_style, fontSize=8.5, textColor=colors.HexColor("#93C5FD")))],
        [Spacer(1, 2)],
        [Paragraph("Intelligent Payment Orchestration & Multi-Currency Treasury", title_style)],
        [Spacer(1, 3)],
        [Paragraph("A Plain-English Guide to the Entire System and Every Feature on the Website", subtitle_style)],
        [Spacer(1, 4)],
        [Paragraph("<b>Target Audience:</b> Beginners, Product Owners, and Store Managers | <b>No Technical Background Required</b>", ParagraphStyle('Meta', parent=subtitle_style, fontSize=7.5, textColor=colors.HexColor("#BFDBFE")))]
    ]
    banner_table = Table(banner_content, colWidths=[540])
    banner_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#0F172A")),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 14),
        ('RIGHTPADDING', (0, 0), (-1, -1), 14),
        ('ROUNDEDCORNERS', [4, 4, 4, 4]),
    ]))
    story.append(banner_table)
    story.append(Spacer(1, 6))

    # =========================================================================
    # SECTION 1: WHAT IS THIS PROJECT? (IN SIMPLE WORDS)
    # =========================================================================
    story.append(Paragraph("1. What is LedgerPay AI in Very Simple Words?", h1_style))
    story.append(Paragraph(
        "Think of <b>LedgerPay AI</b> as a smart, automated financial director for an online business. "
        "When an online store accepts money from customers, multiple things can go wrong: "
        "customers might click 'Pay' twice and get charged two times, a payment gateway might crash and lose the sale, "
        "fraudsters might try stolen cards, or banks might eat up large chunks of profits through high international transfer fees.",
        body_style
    ))
    story.append(Paragraph(
        "LedgerPay AI sits in the middle between your online store and various payment companies (such as Stripe, Adyen, PayPal, and UPI). "
        "It handles all the complex logic automatically so the store owner never has to worry about lost money or angry customers.",
        body_style
    ))

    # 4 Quick Pillar Cards
    pillars = [
        [
            Paragraph("<b>1. Zero Double-Charges</b><br/><font color='#64748B'>Guarantees a customer is never charged twice, even if they rapidly spam the submit button during network lag.</font>", body_style),
            Paragraph("<b>2. AI Fraud Ring Detector</b><br/><font color='#64748B'>Uses artificial intelligence to spot groups of fraudsters sharing stolen cards, fake devices, or proxies in under 50 milliseconds.</font>", body_style)
        ],
        [
            Paragraph("<b>3. Smart Payment Router</b><br/><font color='#64748B'>Continuously tests and selects the cheapest, fastest, and most reliable payment provider for every transaction.</font>", body_style),
            Paragraph("<b>4. Immutable Ledger & Treasury</b><br/><font color='#64748B'>Keeps a tamper-proof book of accounts where total debits equal total credits, and reduces bank wire fees via netting.</font>", body_style)
        ]
    ]
    p_table = Table(pillars, colWidths=[266, 266])
    p_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), c_card_bg),
        ('BOX', (0, 0), (-1, -1), 0.5, c_border),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, c_border),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
    ]))
    story.append(p_table)
    story.append(Spacer(1, 6))

    # =========================================================================
    # SECTION 2: THE 3 BUILDING BLOCKS (HOW IT WORKS TOGETHER)
    # =========================================================================
    story.append(Paragraph("2. The Three Building Blocks of the System", h1_style))
    story.append(Paragraph(
        "The system is organized into three clean layers that collaborate in real time:",
        body_style
    ))

    arch_data = [
        [
            Paragraph("<b>Component</b>", ParagraphStyle('Th', parent=body_style, fontName='Helvetica-Bold', textColor=c_primary)),
            Paragraph("<b>Role & Purpose</b>", ParagraphStyle('Th', parent=body_style, fontName='Helvetica-Bold', textColor=c_primary)),
            Paragraph("<b>Simple Analogy</b>", ParagraphStyle('Th', parent=body_style, fontName='Helvetica-Bold', textColor=c_primary))
        ],
        [
            Paragraph("<b>Frontend UI (Website)</b><br/><font color='#64748B'>Runs on Port 3000</font>", body_style),
            Paragraph("The visual control room you see in your browser. Admins and merchants use it to view live payments, test scenarios, review fraud networks, and verify account balances.", body_style),
            Paragraph("The dashboard and steering wheel of a modern car.", body_style)
        ],
        [
            Paragraph("<b>Core Gateway (Backend)</b><br/><font color='#64748B'>Runs on Port 4000</font>", body_style),
            Paragraph("The operational engine. It accepts payments, prevents race conditions, enforces merchant rules, writes to the ledger, and coordinates with banks.", body_style),
            Paragraph("The engine, transmission, and brakes keeping everything moving safely.", body_style)
        ],
        [
            Paragraph("<b>AI Microservice (Brain)</b><br/><font color='#64748B'>Runs on Port 5000</font>", body_style),
            Paragraph("The intelligent analysis engine. It calculates fraud risk scores, detects coordinated fraud rings, and uses machine learning to choose the best payment provider.", body_style),
            Paragraph("The intelligent co-pilot and radar scanning the road ahead.", body_style)
        ]
    ]
    arch_table = Table(arch_data, colWidths=[120, 275, 145])
    arch_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#EEF2F6")),
        ('BOX', (0, 0), (-1, -1), 0.5, c_border),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, c_border),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(arch_table)
    story.append(Spacer(1, 8))

    # =========================================================================
    # SECTION 3: DETAILED WEBSITE FEATURES (EXPLORING EVERY TAB)
    # =========================================================================
    story.append(Paragraph("3. Complete Website Functionalities & Feature Guide", h1_style))
    story.append(Paragraph(
        "When you open the web application at <b>http://127.0.0.1:3000</b>, you access the complete Control Plane Studio. "
        "Here is what each section and tab does, explained in plain language:",
        body_style
    ))

    # --- TOP NAVIGATION BAR ---
    story.append(Paragraph("Top Navigation Bar (Global Controls)", h2_style))
    story.append(Paragraph(
        "The header bar stays pinned across all pages so you always know system status and can switch contexts:",
        body_style
    ))
    story.append(Paragraph("- <b>Merchant Switcher:</b> A dropdown menu that switches between store accounts (e.g., Acme Corp or Global Retail). All transactions and balances automatically update for that merchant.", bullet_style))
    story.append(Paragraph("- <b>System Health Lights:</b> Three real-time indicators showing whether the Core Backend, AI Engine, and Cryptographic Ledger are online and healthy.", bullet_style))
    story.append(Paragraph("- <b>Instant Sync Button:</b> One click refreshes the entire system state, pulling the newest transactions, ledger accounts, and AI models.", bullet_style))
    story.append(Spacer(1, 5))

    # --- TAB 1: OVERVIEW DASHBOARD ---
    story.append(Paragraph("Feature 1: Overview Dashboard (System Health & Activity)", h2_style))
    story.append(Paragraph(
        "The central dashboard gives managers an instant pulse on their business:",
        body_style
    ))
    story.append(Paragraph("- <b>Executive Metric Cards:</b> Displays Total Processed Volume, Authorization Win Rate (percentage of transactions approved by banks), Blocked Fraud Attacks, and Netting Savings.", bullet_style))
    story.append(Paragraph("- <b>System Invariant Badges:</b> Confirms that atomic concurrency locks are guarding payments and that the accounting ledger is balanced to the cent.", bullet_style))
    story.append(Paragraph("- <b>Live Payment Stream:</b> Chronological list of incoming payments showing amount, currency, customer, selected gateway, and approval status.", bullet_style))
    story.append(Paragraph("- <b>Transaction Inspector:</b> Clicking any payment opens a side drawer showing its complete timeline, risk score, processing fee, and cryptographic receipt.", bullet_style))
    story.append(Spacer(1, 5))

    # --- TAB 2: PAYMENT STUDIO ---
    story.append(Paragraph("Feature 2: Payment Studio & Concurrency Simulator", h2_style))
    story.append(Paragraph(
        "An interactive laboratory where you can test payments and see safety mechanisms in action:",
        body_style
    ))
    story.append(Paragraph("- <b>Custom Payment Creator:</b> Fill out an order with any amount, currency (INR, USD, EUR, GBP), and payment method (UPI or Cards).", bullet_style))
    story.append(Paragraph("- <b>Preset Scenario Buttons:</b> Four instant buttons to test common real-life payments without typing: Instant UPI, RuPay Domestic Checkout, Cross-Border Invoice, and High-Risk Tor Botnet Attack.", bullet_style))
    story.append(Paragraph("- <b>Visual Saga Tracker:</b> When you submit a payment, a live progress pipeline lights up each step: Idempotency Lock -> AI Fraud Scan -> Smart Provider Selection -> Gateway Charge -> Double-Entry Ledger Entry.", bullet_style))
    story.append(Paragraph("- <b>Concurrency Stress Test ('The Double-Charge Buster'):</b> Fires 10 simultaneous requests at the exact same millisecond. Proves that only 1 transaction gets booked, while the other 9 are rejected with a 409 Conflict code, guaranteeing zero double charges.", bullet_style))
    story.append(Spacer(1, 5))

    # --- TAB 3: FRAUD INTELLIGENCE ---
    story.append(Paragraph("Feature 3: AI Fraud Intelligence Network", h2_style))
    story.append(Paragraph(
        "Traditional fraud filters only look at one card at a time. LedgerPay AI looks at the whole web of connections:",
        body_style
    ))
    story.append(Paragraph("- <b>Interactive 2D Network Canvas:</b> Visually draws dots (nodes) representing Users, Credit Cards, Device Fingerprints, and IP Addresses. Lines connect entities that interact together.", bullet_style))
    story.append(Paragraph("- <b>'Inject Syndicate Attack' Button:</b> Simulates an organized criminal attack where multiple fake accounts try spinning stolen cards from the same device, causing suspicious nodes to glow red.", bullet_style))
    story.append(Paragraph("- <b>Node Inspector:</b> Click any entity on the canvas to see its calculated risk score, its neighboring connections, and why the AI flagged it.", bullet_style))
    story.append(Paragraph("- <b>Smart 3DS Decisions:</b> Assigns checkout tiers: Low risk proceeds friction-free, medium risk triggers an OTP challenge, and extreme risk is rejected before contacting the bank.", bullet_style))
    story.append(Spacer(1, 5))

    # --- TAB 4: SMART ROUTING ---
    story.append(Paragraph("Feature 4: Smart Routing with Reinforcement Learning", h2_style))
    story.append(Paragraph(
        "Payment gateways charge different fees and occasionally suffer outages. This feature automatically optimizes where traffic goes:",
        body_style
    ))
    story.append(Paragraph("- <b>Provider Performance Grid:</b> Compares Stripe, Adyen, PayPal, and Checkout.com across their live success rates, fee schedules, and response speeds.", bullet_style))
    story.append(Paragraph("- <b>Routing Sandbox:</b> Adjust amount and risk sliders to see in real time which provider the AI chooses and the mathematical reasoning behind the choice.", bullet_style))
    story.append(Paragraph("- <b>Self-Healing & Auto-Failover:</b> If a primary provider declines a card or goes down, the system automatically routes the payment through a secondary provider so the sale is never lost.", bullet_style))
    story.append(Spacer(1, 5))

    # --- TAB 5: TREASURY & NETTING ---
    story.append(Paragraph("Feature 5: Multi-Currency Treasury & Multilateral Netting", h2_style))
    story.append(Paragraph(
        "For companies dealing across borders, this tab automates currency management and slashes bank wire fees:",
        body_style
    ))
    story.append(Paragraph("- <b>Multi-Currency Vault:</b> Live account balances in USD, EUR, GBP, JPY, CAD, and INR with real-time interbank foreign exchange rates.", bullet_style))
    story.append(Paragraph("- <b>Atomic Currency Conversion:</b> Convert funds between currencies instantly with built-in balance checks to prevent spending money that isn't there.", bullet_style))
    story.append(Paragraph("- <b>Multilateral Netting Engine:</b> When multiple stores or partners owe each other money, this engine cancels out mutual debts and calculates the net difference, reducing wire transfer volume by over 70%.", bullet_style))
    story.append(Paragraph("- <b>14-Day AI Cash Flow Forecaster:</b> An intelligent chart that forecasts upcoming daily inflows and outflows, warning if your account might run low on cash.", bullet_style))
    story.append(Spacer(1, 5))

    # --- TAB 6: LEDGER EXPLORER ---
    story.append(Paragraph("Feature 6: Cryptographic Double-Entry Ledger Explorer", h2_style))
    story.append(Paragraph(
        "The ultimate accounting source of truth for all money moving through the platform:",
        body_style
    ))
    story.append(Paragraph("- <b>Strict Double-Entry Invariant:</b> Every transaction records two equal sides: total debits must equal total credits. No money can ever go missing unnoticed.", bullet_style))
    story.append(Paragraph("- <b>SHA-256 Cryptographic Chain:</b> Similar to how a blockchain works, each journal entry contains the cryptographic seal of the previous entry. Altering any past record immediately breaks the chain.", bullet_style))
    story.append(Paragraph("- <b>'Verify Hash Chain Integrity' Button:</b> Audits all records from day one to right now, verifying that no transactions have been secretly edited or deleted.", bullet_style))
    story.append(Paragraph("- <b>Chart of Accounts:</b> An organized financial view categorizing funds into Assets, Liabilities, Equity, Revenues, and Processing Expenses.", bullet_style))
    story.append(Spacer(1, 5))

    # --- TAB 7: WORKFLOW BUILDER ---
    story.append(Paragraph("Feature 7: Visual Workflow Rule Builder", h2_style))
    story.append(Paragraph(
        "Allows business owners to set custom payment handling rules without writing code:",
        body_style
    ))
    story.append(Paragraph("- <b>Visual Flow Cards:</b> Create condition and action cards (for example: if an order exceeds a certain amount, trigger extra customer verification).", bullet_style))
    story.append(Paragraph("- <b>Custom Routing Rules:</b> Direct specific currencies or high-value clients to preferred gateways.", bullet_style))
    story.append(Spacer(1, 5))

    # --- TAB 8: RECONCILIATION ---
    story.append(Paragraph("Feature 8: Real-Time Bank & Provider Reconciliation", h2_style))
    story.append(Paragraph(
        "Ensures your internal accounting matches what your bank actually settled:",
        body_style
    ))
    story.append(Paragraph("- <b>Automated Statement Matching:</b> Compares internal records against external provider settlement reports.", bullet_style))
    story.append(Paragraph("- <b>Anomaly Detection:</b> Catches hidden bank fee overcharges, delayed payouts, or 'ghost settlements' where money was deposited without an internal order.", bullet_style))
    story.append(Paragraph("- <b>'Run Statement Reconciliation' Button:</b> Triggers a fresh reconciliation audit scan on demand.", bullet_style))
    story.append(Spacer(1, 5))

    # --- TAB 9: DEVELOPER TAB ---
    story.append(Paragraph("Feature 9: Developer Hub & API Sandbox", h2_style))
    story.append(Paragraph(
        "Everything software engineers need to connect their applications:",
        body_style
    ))
    story.append(Paragraph("- <b>API Keys:</b> Securely view and rotate Public and Secret API keys.", bullet_style))
    story.append(Paragraph("- <b>Webhook Settings & Tester:</b> Configure notification URLs and send test events with one click.", bullet_style))
    story.append(Paragraph("- <b>Code Samples:</b> Ready-to-copy code snippets in Node.js, Python, cURL, and React.", bullet_style))
    story.append(Spacer(1, 6))

    # =========================================================================
    # SECTION 4: THE LIFECYCLE OF A PAYMENT
    # =========================================================================
    story.append(Paragraph("4. The Step-by-Step Journey of a Single Payment", h1_style))
    story.append(Paragraph(
        "Here is what happens in the span of less than one second when a customer clicks 'Pay':",
        body_style
    ))

    journey_steps = [
        [
            Paragraph("<b>#</b>", ParagraphStyle('Th', parent=body_style, fontName='Helvetica-Bold', textColor=c_primary)),
            Paragraph("<b>Phase</b>", ParagraphStyle('Th', parent=body_style, fontName='Helvetica-Bold', textColor=c_primary)),
            Paragraph("<b>What Happens Behind the Scenes</b>", ParagraphStyle('Th', parent=body_style, fontName='Helvetica-Bold', textColor=c_primary))
        ],
        [
            Paragraph("<b>1</b>", body_style),
            Paragraph("<b>Concurrency Lock</b>", body_style),
            Paragraph("The gateway locks the unique payment ID. If duplicate requests arrive simultaneously, they bounce off harmlessly without creating a double charge.", body_style)
        ],
        [
            Paragraph("<b>2</b>", body_style),
            Paragraph("<b>AI Fraud Scan</b>", body_style),
            Paragraph("The AI microservice checks the buyer's card, device, and network. If suspicious, it triggers an OTP challenge or blocks the payment before contacting the bank.", body_style)
        ],
        [
            Paragraph("<b>3</b>", body_style),
            Paragraph("<b>Smart Routing</b>", body_style),
            Paragraph("The AI chooses the most reliable and affordable provider (Stripe, Adyen, PayPal, or UPI) based on live win rates and fees.", body_style)
        ],
        [
            Paragraph("<b>4</b>", body_style),
            Paragraph("<b>Ledger Booking</b>", body_style),
            Paragraph("The transaction is recorded in the double-entry ledger where debits equal credits, sealed with a SHA-256 cryptographic hash.", body_style)
        ],
        [
            Paragraph("<b>5</b>", body_style),
            Paragraph("<b>Treasury & Webhook</b>", body_style),
            Paragraph("Funds are queued for multilateral netting to reduce wire fees, and the merchant's store receives an instant confirmation alert.", body_style)
        ]
    ]
    j_table = Table(journey_steps, colWidths=[20, 115, 405])
    j_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#EEF2F6")),
        ('BOX', (0, 0), (-1, -1), 0.5, c_border),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, c_border),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(j_table)
    story.append(Spacer(1, 6))

    # =========================================================================
    # SECTION 5: BEGINNER'S GLOSSARY
    # =========================================================================
    story.append(Paragraph("5. Beginner's Vocabulary Cheat Sheet", h1_style))
    story.append(Paragraph(
        "Clear definitions for the key technical terms used throughout the system:",
        body_style
    ))

    glossary_data = [
        [
            Paragraph("<b>Term</b>", ParagraphStyle('Th', parent=body_style, fontName='Helvetica-Bold', textColor=c_primary)),
            Paragraph("<b>Simple Explanation</b>", ParagraphStyle('Th', parent=body_style, fontName='Helvetica-Bold', textColor=c_primary))
        ],
        [
            Paragraph("<b>Idempotency</b>", body_style),
            Paragraph("A safety guarantee that performing the same action multiple times has the exact same effect as doing it once. Prevents accidental double-charging.", body_style)
        ],
        [
            Paragraph("<b>Double-Entry Ledger</b>", body_style),
            Paragraph("An accounting method where every financial event is recorded in two places (a debit and an equal credit) so that total accounts always balance to zero.", body_style)
        ],
        [
            Paragraph("<b>SHA-256 Hash Chain</b>", body_style),
            Paragraph("A cryptographic chain linking every transaction to the previous one, making any secret edits or deletions mathematically impossible to hide.", body_style)
        ],
        [
            Paragraph("<b>Multilateral Netting</b>", body_style),
            Paragraph("An automated settlement process where multiple stores cancel out mutual debts, wiring only the net difference to save on bank wire fees.", body_style)
        ],
        [
            Paragraph("<b>Distributed Saga</b>", body_style),
            Paragraph("A coordinated workflow that ensures if a transaction fails halfway (like an issuer decline), all prior temporary steps are cleanly rolled back.", body_style)
        ],
        [
            Paragraph("<b>GNN (Graph Neural Network)</b>", body_style),
            Paragraph("An AI model that maps connections between cards, devices, and users to expose criminal fraud rings.", body_style)
        ],
        [
            Paragraph("<b>Contextual Bandit (LinUCB)</b>", body_style),
            Paragraph("A self-learning AI algorithm that chooses the optimal payment gateway for each transaction while learning from past successes and failures.", body_style)
        ]
    ]
    g_table = Table(glossary_data, colWidths=[130, 410])
    g_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#EEF2F6")),
        ('BOX', (0, 0), (-1, -1), 0.5, c_border),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, c_border),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(g_table)
    story.append(Spacer(1, 6))

    # =========================================================================
    # SUMMARY CALLOUT BOX
    # =========================================================================
    summary_box_content = [
        [Paragraph("<b>Key Takeaway for New Users:</b>", callout_bold)],
        [Paragraph(
            "LedgerPay AI eliminates the complexity of running a global payments system. "
            "It gives businesses peace of mind that payments will always be routed through the best gateway, "
            "customers will never be double-charged, fraud rings will be stopped in their tracks, "
            "and accounting books will balance with 100% mathematical certainty.",
            callout_style
        )]
    ]
    summary_table = Table(summary_box_content, colWidths=[540])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#EFF6FF")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#3B82F6")),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('ROUNDEDCORNERS', [4, 4, 4, 4])
    ]))
    story.append(summary_table)

    # Build the document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Document successfully created at: {os.path.abspath(filename)}")

if __name__ == "__main__":
    create_pdf()
