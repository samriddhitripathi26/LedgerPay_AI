import numpy as np
import datetime
from typing import Dict, List, Any

class TreasuryForecaster:
    """
    Time-Series Liquidity Forecaster & Netting Optimizer for Treasury Management.
    Projects future currency inflows, warns of reserve deficits, and recommends hedging.
    """
    def __init__(self):
        self.currencies = ["USD", "EUR", "GBP", "JPY", "CAD", "SGD"]
        # Baseline volatility and daily volume parameters
        self.currency_profiles = {
            "USD": {"base_daily": 150000.0, "growth_trend": 1.002, "volatility": 0.08},
            "EUR": {"base_daily": 110000.0, "growth_trend": 1.001, "volatility": 0.09},
            "GBP": {"base_daily": 75000.0,  "growth_trend": 0.999, "volatility": 0.11},
            "JPY": {"base_daily": 18000000.0,"growth_trend": 1.000, "volatility": 0.12},
            "CAD": {"base_daily": 45000.0,  "growth_trend": 1.001, "volatility": 0.07},
            "SGD": {"base_daily": 35000.0,  "growth_trend": 1.003, "volatility": 0.06},
        }

    def forecast_currency_flows(self, currency: str, current_balance: float, days: int = 14) -> Dict[str, Any]:
        """
        Produces day-by-day projected inflows, projected outflows, and projected end-of-day balances.
        Flags threshold breaches and recommends conversions.
        """
        curr = currency.upper()
        prof = self.currency_profiles.get(curr, {"base_daily": 50000.0, "growth_trend": 1.0, "volatility": 0.1})
        
        rng = np.random.RandomState(abs(hash(curr)) % 10000)
        today = datetime.date.today()
        
        timeline = []
        running_balance = current_balance
        min_reserve_target = prof["base_daily"] * 0.4
        
        projected_inflows_total = 0.0
        projected_outflows_total = 0.0
        deficit_detected = False
        deficit_day = None

        for d in range(1, days + 1):
            date_str = (today + datetime.timedelta(days=d)).isoformat()
            
            # Day of week factor (weekends lower volume)
            weekday = (today + datetime.timedelta(days=d)).weekday()
            dow_factor = 0.4 if weekday >= 5 else 1.15
            
            trend_mult = (prof["growth_trend"] ** d)
            noise_in = rng.normal(1.0, prof["volatility"])
            noise_out = rng.normal(1.0, prof["volatility"] * 1.1)

            inflow = round(prof["base_daily"] * trend_mult * dow_factor * max(0.2, noise_in), 2)
            outflow = round(prof["base_daily"] * 0.92 * trend_mult * dow_factor * max(0.2, noise_out), 2)
            
            running_balance += (inflow - outflow)
            projected_inflows_total += inflow
            projected_outflows_total += outflow

            is_deficit = running_balance < min_reserve_target
            if is_deficit and not deficit_detected:
                deficit_detected = True
                deficit_day = date_str

            timeline.append({
                "date": date_str,
                "dayIndex": d,
                "inflow": inflow,
                "outflow": outflow,
                "projectedBalance": round(running_balance, 2),
                "isDeficitRisk": is_deficit
            })

        # Generate intelligent Treasury Recommendations
        recommendations = []
        if deficit_detected:
            recommendations.append({
                "type": "LIQUIDITY_INJECTION",
                "severity": "HIGH",
                "message": f"Projected {curr} liquidity falls below target reserve on {deficit_day}. Pre-fund {curr} balance via USD automated conversion.",
                "suggestedAction": "CONVERT_BASE_TO_FOREIGN",
                "recommendedAmount": round(min_reserve_target * 1.5, 2)
            })
        elif running_balance > (prof["base_daily"] * 3.5):
            recommendations.append({
                "type": "SURPLUS_SWEEP",
                "severity": "MEDIUM",
                "message": f"Excessive {curr} accumulation projected ({round(running_balance, 2)}). Sweep surplus to base currency or yield treasury pool.",
                "suggestedAction": "AUTO_SWEEP_TO_BASE",
                "recommendedAmount": round(running_balance - (prof["base_daily"] * 1.5), 2)
            })
        else:
            recommendations.append({
                "type": "OPTIMAL_LIQUIDITY",
                "severity": "LOW",
                "message": f"{curr} liquidity is well-balanced within target risk boundaries for the next {days} days.",
                "suggestedAction": "MAINTAIN_RUN_RATE",
                "recommendedAmount": 0.0
            })

        return {
            "currency": curr,
            "horizonDays": days,
            "currentBalance": current_balance,
            "minReserveTarget": round(min_reserve_target, 2),
            "projectedFinalBalance": round(running_balance, 2),
            "totalProjectedInflow": round(projected_inflows_total, 2),
            "totalProjectedOutflow": round(projected_outflows_total, 2),
            "deficitRisk": deficit_detected,
            "timeline": timeline,
            "recommendations": recommendations
        }

class ReconciliationAnomalyDetector:
    """
    Statistical Outlier & Anomaly Detector for Payment Statements vs Internal Ledger.
    Identifies discrepancy spikes, ghost charges, and provider fee overcharges.
    """
    def detect_discrepancy_anomalies(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Analyzes reconciliation discrepancy items using z-score and rule heuristics.
        """
        if not items:
            return []

        diffs = [abs(float(it.get("amountDifference", 0.0))) for it in items]
        mean_diff = float(np.mean(diffs)) if diffs else 0.0
        std_diff = float(np.std(diffs)) if diffs and np.std(diffs) > 1e-4 else 1.0

        enriched = []
        for it in items:
            amt_diff = abs(float(it.get("amountDifference", 0.0)))
            z_score = (amt_diff - mean_diff) / std_diff if std_diff > 0 else 0.0
            
            status = it.get("matchStatus", "UNMATCHED")
            is_anomaly = False
            anomaly_type = "NONE"
            anomaly_score = 0.0

            if status == "UNMATCHED_STATEMENT_ONLY":
                is_anomaly = True
                anomaly_type = "GHOST_PROVIDER_SETTLEMENT"
                anomaly_score = 90.0
            elif status == "UNMATCHED_LEDGER_ONLY":
                is_anomaly = True
                anomaly_type = "UNSETTLED_INTERNAL_CHARGE"
                anomaly_score = 75.0
            elif z_score > 2.0 or amt_diff > 50.0:
                is_anomaly = True
                anomaly_type = "STATISTICAL_AMOUNT_VARIANCE"
                anomaly_score = min(100.0, 50.0 + (z_score * 20.0))
            elif abs(float(it.get("feeDifference", 0.0))) > 2.50:
                is_anomaly = True
                anomaly_type = "PROVIDER_FEE_SURCHARGE"
                anomaly_score = 65.0

            enriched.append({
                **it,
                "isAnomaly": is_anomaly,
                "anomalyType": anomaly_type,
                "anomalyScore": round(anomaly_score, 1),
                "zScore": round(float(z_score), 2)
            })

        return enriched
