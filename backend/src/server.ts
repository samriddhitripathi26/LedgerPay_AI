import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { DoubleEntryLedger } from './ledger/doubleEntry.js';
import { IdempotencyManager } from './orchestrator/idempotency.js';
import { WorkflowEngine } from './workflow/engine.js';
import { TreasuryEngine } from './treasury/treasuryEngine.js';
import { ReconciliationEngine } from './reconciliation/engine.js';
import { PaymentSagaOrchestrator } from './orchestrator/saga.js';
import { DeveloperManager } from './developer/manager.js';
import { createApiRouter } from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.resolve(__dirname, '../public');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(publicPath));

// Initialize core singletons
const ledger = new DoubleEntryLedger();
const idempotencyManager = new IdempotencyManager();
const workflowEngine = new WorkflowEngine();
const treasuryEngine = new TreasuryEngine(ledger);
const reconciliationEngine = new ReconciliationEngine();
const sagaOrchestrator = new PaymentSagaOrchestrator(idempotencyManager, ledger, workflowEngine);
const developerManager = new DeveloperManager();

// Mount API router
app.use('/api/v1', createApiRouter(
  ledger,
  idempotencyManager,
  sagaOrchestrator,
  treasuryEngine,
  workflowEngine,
  reconciliationEngine,
  developerManager
));

app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'LedgerPay AI Core Orchestration Gateway',
    timestamp: new Date().toISOString(),
    ledgerBalanced: ledger.verifyLedgerIntegrity().isValid,
    journalCount: ledger.getJournal().length
  });
});

app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 LedgerPay AI Core Gateway running on http://localhost:${PORT}`);
  console.log(`🔒 Idempotency & Concurrency Manager: ACTIVE`);
  console.log(`📖 Cryptographic Double-Entry Ledger: VERIFIED`);
  console.log(`🌐 Treasury & Netting Engine: ONLINE`);
  console.log(`======================================================\n`);
});
