import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional

from models.gnn_fraud import GNNFraudDetector
from models.rl_router import ContextualBanditRouter
from models.forecaster import TreasuryForecaster, ReconciliationAnomalyDetector

app = FastAPI(
    title="LedgerPay AI - Microservice Engine",
    description="GNN Fraud Ring Detection, LinUCB Reinforcement Learning Payment Router, and Treasury Forecaster",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instantiate models
fraud_detector = GNNFraudDetector()
bandit_router = ContextualBanditRouter()
treasury_forecaster = TreasuryForecaster()
anomaly_detector = ReconciliationAnomalyDetector()

# Pydantic Request Schemas
class TransactionPayload(BaseModel):
    transactionId: Optional[str] = "tx_demo_01"
    userId: Optional[str] = "usr_demo"
    amount: float = 120.0
    currency: Optional[str] = "USD"
    cardFingerprint: Optional[str] = "card_4242_demo"
    deviceId: Optional[str] = "dev_browser_mac"
    ipAddress: Optional[str] = "192.168.1.1"
    merchantId: Optional[str] = "mch_acme_corp"
    paymentMethod: Optional[str] = "card"
    customerCountry: Optional[str] = "US"
    merchantTier: Optional[str] = "standard"
    riskScore: Optional[float] = None

class FeedbackPayload(BaseModel):
    provider: str
    transaction: Dict[str, Any]
    outcome: Dict[str, Any]

class ForecastRequest(BaseModel):
    currency: str = "USD"
    currentBalance: float = 250000.0
    days: int = 14

class ReconciliationPayload(BaseModel):
    items: List[Dict[str, Any]]

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "LedgerPay AI Machine Learning Core",
        "gnnNodes": fraud_detector.graph.number_of_nodes(),
        "banditProviders": list(bandit_router.providers),
        "torchVersion": "PyTorch Enabled"
    }

# ==================== GNN FRAUD DETECTION ====================
@app.post("/api/fraud/score")
def score_fraud(payload: TransactionPayload):
    tx_data = payload.model_dump()
    result = fraud_detector.evaluate_transaction(tx_data)
    return result

@app.get("/api/fraud/graph")
def get_entity_graph():
    return fraud_detector.get_graph_visualization_data()

@app.post("/api/fraud/seed-demo")
def seed_attack_scenario():
    """Injects a coordinated carding syndicate ring to demonstrate GNN ring detection in real-time."""
    syndicate_device = "dev_syndicate_compromised"
    syndicate_ip = "185.220.101.99"
    
    for i in range(1, 6):
        fraud_detector.evaluate_transaction({
            "userId": f"usr_bot_syndicate_{i}",
            "cardFingerprint": f"card_compromised_bin_{i}",
            "deviceId": syndicate_device,
            "ipAddress": syndicate_ip,
            "merchantId": "mch_crypto_exchange",
            "amount": 1450.0,
            "currency": "EUR"
        })
    return {
        "status": "seeded",
        "message": "Coordinated attack ring injected into dynamic entity graph. 5 distinct cards and users clustered on 1 proxy IP & compromised device.",
        "nodes": fraud_detector.graph.number_of_nodes(),
        "edges": fraud_detector.graph.number_of_edges()
    }

# ==================== SMART RL ROUTER ====================
@app.post("/api/routing/select")
def select_payment_route(payload: TransactionPayload):
    tx_data = payload.model_dump()
    decision = bandit_router.select_route(tx_data)
    return decision

@app.post("/api/routing/feedback")
def update_routing_feedback(payload: FeedbackPayload):
    update_res = bandit_router.record_feedback(payload.provider, payload.transaction, payload.outcome)
    return {
        "status": "updated",
        "feedback": update_res
    }

@app.get("/api/routing/stats")
def get_routing_stats():
    return bandit_router.get_stats()

# ==================== TREASURY & FORECASTING ====================
@app.post("/api/treasury/forecast")
def forecast_treasury(payload: ForecastRequest):
    return treasury_forecaster.forecast_currency_flows(payload.currency, payload.currentBalance, payload.days)

@app.post("/api/reconciliation/anomalies")
def detect_reconciliation_anomalies(payload: ReconciliationPayload):
    return anomaly_detector.detect_discrepancy_anomalies(payload.items)

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=5000)
