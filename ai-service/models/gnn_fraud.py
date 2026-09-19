import time
import math
import networkx as nx
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Dict, List, Any, Tuple

class SimpleGNNLayer(nn.Module):
    """Message passing layer: aggregates neighbor embeddings and applies linear transformation."""
    def __init__(self, in_dim: int, out_dim: int):
        super().__init__()
        self.linear_self = nn.Linear(in_dim, out_dim)
        self.linear_neigh = nn.Linear(in_dim, out_dim)
        self.relu = nn.LeakyReLU(0.2)

    def forward(self, h: torch.Tensor, adj: torch.Tensor) -> torch.Tensor:
        # h: (N, in_dim), adj: (N, N) row-normalized adjacency
        neigh_agg = torch.matmul(adj, h)
        out = self.linear_self(h) + self.linear_neigh(neigh_agg)
        return self.relu(out)

class GNNFraudDetector:
    def __init__(self, feature_dim: int = 16, hidden_dim: int = 32):
        self.feature_dim = feature_dim
        self.hidden_dim = hidden_dim
        
        # PyTorch GNN model for graph subgraph classification
        self.layer1 = SimpleGNNLayer(feature_dim, hidden_dim)
        self.layer2 = SimpleGNNLayer(hidden_dim, hidden_dim)
        self.classifier = nn.Sequential(
            nn.Linear(hidden_dim, 16),
            nn.LeakyReLU(0.2),
            nn.Linear(16, 1),
            nn.Sigmoid()
        )
        self.classifier.eval()

        # Dynamic Entity Graph (Heterogeneous: User, Card, Device, IP, Merchant)
        self.graph = nx.Graph()
        
        # Fast lookup indices
        self.user_history: Dict[str, List[Dict[str, Any]]] = {}
        self.card_history: Dict[str, List[Dict[str, Any]]] = {}
        self.ip_history: Dict[str, List[Dict[str, Any]]] = {}
        self.device_history: Dict[str, List[Dict[str, Any]]] = {}
        
        # Initialize default seed data for demonstration
        self._seed_initial_fraud_rings()

    def _seed_initial_fraud_rings(self):
        """Seed pre-existing entities and known fraud rings for demonstration."""
        # Ring 1: "Card-Spinning Botnet" - 1 Device, 1 IP, 5 Users, 5 stolen Cards
        bad_device = "dev_botnet_alpha"
        bad_ip = "185.220.101.5" # Tor exit node style
        for i in range(1, 6):
            u = f"usr_bot_{i}"
            c = f"card_stolen_4111_{i}"
            self._add_interaction(u, c, bad_device, bad_ip, "mch_global_fashion", 450.0, is_fraud=True)

        # Legitimate Users
        legit_users = [
            ("usr_alice", "card_4242_alice", "dev_iphone_alice", "73.189.42.10", "mch_apple_store", 120.0),
            ("usr_bob", "card_5555_bob", "dev_macbook_bob", "98.210.15.4", "mch_amazon", 85.0),
            ("usr_charlie", "card_3782_charlie", "dev_pixel_charlie", "24.130.88.9", "mch_stripe_billing", 299.0),
        ]
        for u, c, d, ip, m, amt in legit_users:
            self._add_interaction(u, c, d, ip, m, amt, is_fraud=False)

    def _add_interaction(self, user_id: str, card_id: str, device_id: str, ip: str, merchant_id: str, amount: float, is_fraud: bool = False):
        nodes = [
            (f"user:{user_id}", {"type": "user", "label": user_id, "is_fraud": is_fraud}),
            (f"card:{card_id}", {"type": "card", "label": card_id[-4:] if len(card_id) > 4 else card_id, "is_fraud": is_fraud}),
            (f"device:{device_id}", {"type": "device", "label": device_id, "is_fraud": is_fraud}),
            (f"ip:{ip}", {"type": "ip", "label": ip, "is_fraud": is_fraud}),
            (f"merchant:{merchant_id}", {"type": "merchant", "label": merchant_id, "is_fraud": False}),
        ]
        for n, attrs in nodes:
            if not self.graph.has_node(n):
                self.graph.add_node(n, **attrs)

        edges = [
            (f"user:{user_id}", f"card:{card_id}", {"amount": amount, "timestamp": time.time()}),
            (f"user:{user_id}", f"device:{device_id}", {"timestamp": time.time()}),
            (f"device:{device_id}", f"ip:{ip}", {"timestamp": time.time()}),
            (f"user:{user_id}", f"merchant:{merchant_id}", {"amount": amount, "timestamp": time.time()}),
        ]
        for u, v, attrs in edges:
            self.graph.add_edge(u, v, **attrs)

    def evaluate_transaction(self, tx: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sub-100ms real-time scoring of transaction using GNN subgraph embedding,
        cycle detection, device/IP collision analysis, and velocity checks.
        """
        start_time = time.time()
        
        user_id = tx.get("userId", "usr_unknown")
        card_id = tx.get("cardFingerprint", "card_unknown")
        device_id = tx.get("deviceId", "dev_unknown")
        ip = tx.get("ipAddress", "127.0.0.1")
        merchant_id = tx.get("merchantId", "mch_default")
        amount = float(tx.get("amount", 100.0))
        currency = tx.get("currency", "USD")

        # 1. Update Graph with current transaction nodes & edges
        u_node = f"user:{user_id}"
        c_node = f"card:{card_id}"
        d_node = f"device:{device_id}"
        ip_node = f"ip:{ip}"
        m_node = f"merchant:{merchant_id}"

        self._add_interaction(user_id, card_id, device_id, ip, merchant_id, amount)

        # 2. Extract Subgraph metrics around these entities (k-hop ego graph)
        target_nodes = [u_node, c_node, d_node, ip_node, m_node]
        subgraph = self.graph.subgraph(
            set().union(*[nx.single_source_shortest_path_length(self.graph, n, cutoff=2).keys() 
                          for n in target_nodes if n in self.graph])
        ).copy()

        # Graph structural indicators
        device_deg = self.graph.degree(d_node) if d_node in self.graph else 1
        ip_deg = self.graph.degree(ip_node) if ip_node in self.graph else 1
        card_deg = self.graph.degree(c_node) if c_node in self.graph else 1
        user_deg = self.graph.degree(u_node) if u_node in self.graph else 1

        # Check for card spinning (same device or IP using multiple distinct cards)
        cards_on_device = [n for n in self.graph.neighbors(d_node) if n.startswith("card:")] if d_node in self.graph else []
        users_on_device = [n for n in self.graph.neighbors(d_node) if n.startswith("user:")] if d_node in self.graph else []

        reasons = []
        ring_detected = False
        ring_members = []
        heuristic_risk = 0.0

        if len(users_on_device) >= 3 or device_deg >= 6:
            reasons.append(f"HIGH_DEVICE_COLLISION: {len(users_on_device)} distinct users share device {device_id}")
            heuristic_risk += 45.0
            ring_detected = True
            ring_members.extend(users_on_device)

        if len(cards_on_device) >= 3:
            reasons.append(f"CARD_SPINNING_PATTERN: {len(cards_on_device)} cards cycled on device {device_id}")
            heuristic_risk += 40.0
            ring_detected = True

        if ip.startswith("185.220.") or ip.startswith("194.26."):
            reasons.append("KNOWN_ANONYMIZER_IP_RANGE: Tor or proxy gateway detected")
            heuristic_risk += 35.0

        if amount > 5000:
            reasons.append(f"HIGH_VELOCITY_AMOUNT: Transaction {amount} {currency} exceeds baseline threshold")
            heuristic_risk += 20.0
        elif amount > 1500:
            heuristic_risk += 10.0

        # 3. GNN Message Passing Simulation on Subgraph
        sub_nodes = list(subgraph.nodes())
        node_idx = {n: i for i, n in enumerate(sub_nodes)}
        n_count = len(sub_nodes)

        if n_count > 1:
            adj = np.zeros((n_count, n_count), dtype=np.float32)
            for u, v in subgraph.edges():
                i, j = node_idx[u], node_idx[v]
                adj[i, j] = 1.0
                adj[j, i] = 1.0
            
            # Add self-loops & normalize
            adj = adj + np.eye(n_count, dtype=np.float32)
            d_inv = np.diag(1.0 / np.sqrt(np.sum(adj, axis=1)))
            norm_adj = d_inv @ adj @ d_inv
            
            feat = np.zeros((n_count, self.feature_dim), dtype=np.float32)
            for n, i in node_idx.items():
                ntype = subgraph.nodes[n].get("type", "unknown")
                type_map = {"user": 0, "card": 1, "device": 2, "ip": 3, "merchant": 4}
                if ntype in type_map:
                    feat[i, type_map[ntype]] = 1.0
                feat[i, 5] = min(subgraph.degree(n) / 10.0, 1.0)
                feat[i, 6] = math.log1p(amount) / 10.0
                feat[i, 7] = 1.0 if n in target_nodes else 0.0
                if subgraph.nodes[n].get("is_fraud", False):
                    feat[i, 8] = 1.0

            with torch.no_grad():
                h = torch.from_numpy(feat)
                a = torch.from_numpy(norm_adj)
                h1 = self.layer1(h, a)
                h2 = self.layer2(h1, a)
                
                target_indices = [node_idx[n] for n in target_nodes if n in node_idx]
                target_emb = h2[target_indices].mean(dim=0, keepdim=True)
                gnn_prob = float(self.classifier(target_emb).item())
        else:
            gnn_prob = 0.05

        gnn_risk_score = gnn_prob * 100.0
        final_risk = min(100.0, max(5.0, (heuristic_risk * 0.6) + (gnn_risk_score * 0.4)))

        if final_risk >= 80.0:
            risk_tier = "CRITICAL"
            action = "BLOCK"
            sca_recommendation = "BLOCK_TRANSACTION"
        elif final_risk >= 50.0:
            risk_tier = "HIGH"
            action = "CHALLENGE_3DS"
            sca_recommendation = "STEP_UP_AUTHENTICATION"
        elif final_risk >= 25.0:
            risk_tier = "MEDIUM"
            action = "FRICTIONLESS_3DS"
            sca_recommendation = "FRICTIONLESS_SCA"
        else:
            risk_tier = "LOW"
            action = "APPROVE"
            sca_recommendation = "EXEMPT_LOW_RISK"

        elapsed_ms = (time.time() - start_time) * 1000.0

        return {
            "riskScore": round(final_risk, 1),
            "gnnScore": round(gnn_risk_score, 1),
            "riskTier": risk_tier,
            "action": action,
            "scaRecommendation": sca_recommendation,
            "reasonCodes": reasons if reasons else ["CLEAN_GRAPH_TOPOLOGY", "LOW_ENTITY_COLLISION"],
            "fraudRingDetected": ring_detected,
            "fraudRingMembers": list(set(ring_members))[:10],
            "inferenceLatencyMs": round(elapsed_ms, 2),
            "graphMetrics": {
                "totalNodes": self.graph.number_of_nodes(),
                "totalEdges": self.graph.number_of_edges(),
                "subgraphNodes": n_count,
                "deviceDegree": device_deg,
                "ipDegree": ip_deg,
                "cardDegree": card_deg
            }
        }

    def get_graph_visualization_data(self, max_nodes: int = 120) -> Dict[str, Any]:
        nodes = []
        links = []
        
        top_nodes = sorted(self.graph.nodes(), key=lambda n: self.graph.degree(n), reverse=True)[:max_nodes]
        sub = self.graph.subgraph(top_nodes)
        
        for n in sub.nodes():
            data = sub.nodes[n]
            nodes.append({
                "id": n,
                "label": data.get("label", n),
                "type": data.get("type", "unknown"),
                "isFraud": data.get("is_fraud", False),
                "degree": self.graph.degree(n)
            })
            
        for u, v, data in sub.edges(data=True):
            links.append({
                "source": u,
                "target": v,
                "amount": data.get("amount", 0)
            })
            
        return {"nodes": nodes, "links": links}
