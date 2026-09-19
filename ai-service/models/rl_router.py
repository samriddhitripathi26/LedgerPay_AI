import time
import numpy as np
from typing import Dict, List, Any, Optional

class ContextualBanditRouter:
    """
    LinUCB (Linear Upper Confidence Bound) Contextual Bandit for Smart Payment Routing.
    Selects optimal payment provider balancing success rate, transaction fees, and latency.
    Learns online in real-time from transaction outcomes.
    """
    def __init__(self, alpha: float = 0.6, feature_dim: int = 8):
        self.alpha = alpha  # Exploration factor
        self.feature_dim = feature_dim
        
        # Available Provider Arms
        self.providers = ["stripe", "adyen", "paypal", "checkout_com"]
        
        # Provider base profiles (latency baseline ms, fee percentage, fixed fee USD)
        self.provider_profiles = {
            "stripe": {"base_latency": 280, "fee_pct": 0.029, "fee_fixed": 0.30, "color": "#635BFF", "name": "Stripe Global"},
            "adyen": {"base_latency": 210, "fee_pct": 0.025, "fee_fixed": 0.25, "color": "#0ABF53", "name": "Adyen Enterprise"},
            "paypal": {"base_latency": 350, "fee_pct": 0.034, "fee_fixed": 0.49, "color": "#00457C", "name": "PayPal Commerce"},
            "checkout_com": {"base_latency": 190, "fee_pct": 0.023, "fee_fixed": 0.20, "color": "#001D3D", "name": "Checkout.com Modular"}
        }

        # LinUCB state per arm: A_inv matrix (d x d) and b vector (d x 1)
        self.A = {arm: np.eye(feature_dim, dtype=np.float64) for arm in self.providers}
        self.b = {arm: np.zeros((feature_dim, 1), dtype=np.float64) for arm in self.providers}
        
        # Telemetry metrics
        self.stats = {
            arm: {
                "total_routed": 0,
                "success_count": 0,
                "fail_count": 0,
                "total_fees_saved": 0.0,
                "avg_latency": self.provider_profiles[arm]["base_latency"],
                "last_reward": 0.0
            }
            for arm in self.providers
        }

        self._seed_initial_bandit_history()

    def _seed_initial_bandit_history(self):
        """Seed realistic historical samples so the bandit doesn't start completely uncalibrated."""
        rng = np.random.RandomState(42)
        for arm in self.providers:
            # Generate 25 pseudo transactions
            for _ in range(25):
                ctx = rng.uniform(0.1, 0.9, size=(self.feature_dim, 1))
                # Adyen / Checkout have slightly better baseline success on EU/Cross-border
                success = rng.choice([1.0, 0.0], p=[0.93 if arm in ["adyen", "checkout_com"] else 0.89, 0.07 if arm in ["adyen", "checkout_com"] else 0.11])
                reward = success - 0.05
                self.A[arm] += ctx @ ctx.T
                self.b[arm] += reward * ctx
                self.stats[arm]["total_routed"] += 1
                if success > 0.5:
                    self.stats[arm]["success_count"] += 1
                else:
                    self.stats[arm]["fail_count"] += 1

    def build_context_vector(self, tx: Dict[str, Any]) -> np.ndarray:
        """
        Builds normalized 8-dimensional feature vector:
        [0]: log(amount) / 10.0
        [1]: is_cross_border (0 or 1)
        [2]: fraud_risk_score / 100.0
        [3]: currency_eur_or_gbp (0 or 1)
        [4]: currency_usd (0 or 1)
        [5]: method_card vs alternative (1 or 0)
        [6]: merchant_tier_high_volume (0 or 1)
        [7]: bias constant (1.0)
        """
        amt_val = tx.get("amount")
        amt = float(amt_val if amt_val is not None else 100.0)
        
        curr_val = tx.get("currency")
        currency = str(curr_val if curr_val is not None else "USD").upper()
        
        risk_val = tx.get("riskScore")
        risk = float(risk_val if risk_val is not None else 15.0) / 100.0
        
        method = str(tx.get("paymentMethod") or "card")
        merchant_tier = str(tx.get("merchantTier") or "standard")
        dest_country = str(tx.get("customerCountry") or "US")

        x = np.zeros((self.feature_dim, 1), dtype=np.float64)
        x[0, 0] = np.log1p(amt) / 10.0
        x[1, 0] = 1.0 if dest_country not in ["US", "USA"] else 0.0
        x[2, 0] = risk
        x[3, 0] = 1.0 if currency in ["EUR", "GBP"] else 0.0
        x[4, 0] = 1.0 if currency == "USD" else 0.0
        x[5, 0] = 1.0 if method in ["card", "credit_card"] else 0.0
        x[6, 0] = 1.0 if merchant_tier == "enterprise" else 0.0
        x[7, 0] = 1.0  # Bias
        return x

    def select_route(self, tx: Dict[str, Any]) -> Dict[str, Any]:
        """
        Computes expected payout for each arm using LinUCB:
        p_a = x^T * theta_a + alpha * sqrt(x^T * A_a^{-1} * x)
        Returns ranked list of providers for primary routing and fallback chains.
        """
        start_time = time.time()
        x = self.build_context_vector(tx)
        amount = float(tx.get("amount", 100.0))

        scores = {}
        expected_returns = {}
        confidences = {}
        fee_estimates = {}

        for arm in self.providers:
            A_inv = np.linalg.inv(self.A[arm])
            theta = A_inv @ self.b[arm]
            
            # Expected reward
            expected_val = float((x.T @ theta)[0, 0])
            
            # Confidence bound (exploration bonus)
            var = float((x.T @ A_inv @ x)[0, 0])
            cb = self.alpha * np.sqrt(max(0.0, var))
            
            ucb_score = expected_val + cb
            
            # Estimate fee
            prof = self.provider_profiles[arm]
            est_fee = round((amount * prof["fee_pct"]) + prof["fee_fixed"], 2)
            
            scores[arm] = ucb_score
            expected_returns[arm] = round(expected_val, 4)
            confidences[arm] = round(cb, 4)
            fee_estimates[arm] = est_fee

        # Rank arms descending by UCB score
        ranked_arms = sorted(self.providers, key=lambda a: scores[a], reverse=True)
        primary_provider = ranked_arms[0]
        fallback_provider = ranked_arms[1]

        elapsed_ms = (time.time() - start_time) * 1000.0

        return {
            "selectedProvider": primary_provider,
            "providerName": self.provider_profiles[primary_provider]["name"],
            "fallbackProvider": fallback_provider,
            "ranking": [
                {
                    "provider": arm,
                    "name": self.provider_profiles[arm]["name"],
                    "ucbScore": round(scores[arm], 4),
                    "expectedReward": expected_returns[arm],
                    "explorationBonus": confidences[arm],
                    "estimatedFee": fee_estimates[arm],
                    "baseLatencyMs": self.provider_profiles[arm]["base_latency"],
                    "color": self.provider_profiles[arm]["color"]
                }
                for arm in ranked_arms
            ],
            "routingReason": f"Optimal LinUCB policy: highest expected net-revenue score ({round(scores[primary_provider], 3)})",
            "contextVector": [round(float(v), 3) for v in x.flatten()],
            "decisionLatencyMs": round(elapsed_ms, 2)
        }

    def record_feedback(self, arm: str, tx: Dict[str, Any], outcome: Dict[str, Any]):
        """
        Updates the LinUCB model online:
        A_a = A_a + x * x^T
        b_a = b_a + r * x
        Reward formulation:
          r = (1.0 if success else -1.2) - (fee_cost / amount) - (latency_ms / 2000.0)
        """
        if arm not in self.providers:
            return

        x = self.build_context_vector(tx)
        success = bool(outcome.get("success", True))
        latency = float(outcome.get("latencyMs", self.provider_profiles[arm]["base_latency"]))
        fee = float(outcome.get("fee", 0.35))
        amount = max(1.0, float(tx.get("amount", 100.0)))

        # Reward engineering
        base_r = 1.0 if success else -1.2
        fee_penalty = min(0.4, fee / amount)
        lat_penalty = min(0.3, latency / 2000.0)
        reward = base_r - fee_penalty - lat_penalty

        # Update ridge regression matrices
        self.A[arm] += x @ x.T
        self.b[arm] += reward * x

        # Update telemetry stats
        s = self.stats[arm]
        s["total_routed"] += 1
        if success:
            s["success_count"] += 1
        else:
            s["fail_count"] += 1
        
        # Running average latency
        s["avg_latency"] = round((s["avg_latency"] * 0.9) + (latency * 0.1), 1)
        s["last_reward"] = round(reward, 3)

        return {
            "arm": arm,
            "reward": round(reward, 4),
            "updatedTotal": s["total_routed"],
            "successRate": round((s["success_count"] / max(1, s["total_routed"])) * 100, 1)
        }

    def get_stats(self) -> Dict[str, Any]:
        result = {}
        for arm in self.providers:
            s = self.stats[arm]
            tot = max(1, s["total_routed"])
            rate = round((s["success_count"] / tot) * 100, 1)
            result[arm] = {
                **s,
                "successRate": rate,
                "name": self.provider_profiles[arm]["name"],
                "color": self.provider_profiles[arm]["color"]
            }
        return result
