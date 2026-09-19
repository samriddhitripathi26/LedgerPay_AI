import React, { useState, useEffect } from 'react';
import { GitFork, Check } from 'lucide-react';

interface WorkflowBuilderTabProps {
  activeMerchant: string;
}

export const WorkflowBuilderTab: React.FC<WorkflowBuilderTabProps> = ({ activeMerchant }) => {
  const [workflow, setWorkflow] = useState<any | null>(null);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const fetchWorkflow = async () => {
    try {
      const res = await fetch(`http://localhost:4000/api/v1/workflows/${activeMerchant}`);
      if (res.ok) {
        setWorkflow(await res.json());
      }
    } catch (e) {
      console.error('Error fetching workflow:', e);
    }
  };

  const saveWorkflow = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/v1/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflow)
      });
      if (res.ok) {
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2500);
      }
    } catch (e: any) {
      alert(`Failed to save workflow: ${e.message}`);
    }
  };

  useEffect(() => {
    fetchWorkflow();
  }, [activeMerchant]);

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
            <span className="label-quiet">Custom Logic Engine</span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--ink)', marginTop: '2px' }}>
              Merchant Workflow Rule Compiler (DAG)
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)', maxWidth: '780px', marginTop: '4px' }}>
              Merchants configure custom payment flows, threshold rules, and retry policies compiled to Directed Acyclic Graphs (DAG).
            </p>
          </div>

          <button onClick={saveWorkflow} className="btn-cobalt">
            <Check size={14} />
            <span>{isSaved ? 'Workflow Deployed' : 'Deploy Workflow DAG'}</span>
          </button>
        </div>
      </div>

      {/* ==================== WORKFLOW PIPELINE & LIVE EVALUATOR SPLIT ==================== */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        
        {/* Left Column: Pipeline Execution Sequence */}
        <div className="instrument-section" style={{ padding: '24px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            borderBottom: '1px solid var(--hairline)',
            paddingBottom: '14px'
          }}>
            <div>
              <span className="label-quiet">Merchant Scope: {activeMerchant}</span>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--ink)', marginTop: '2px' }}>
                {workflow?.name || 'Standard Routing & Step-Up Pipeline'}
              </h3>
            </div>
            <span className="pill-state pill-green">Active in Saga Engine</span>
          </div>

          {/* Sequential Nodes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {workflow?.nodes?.map((node: any, idx: number) => {
              const isTrigger = node.type === 'TRIGGER';
              const isCondition = node.type === 'CONDITION';
              const isAction = node.type === 'ACTION';

              return (
                <div key={node.id} style={{ width: '100%' }}>
                  <div style={{
                    width: '100%',
                    background: 'var(--surface-subtle)',
                    border: '1px solid var(--hairline)',
                    padding: '16px 20px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span className={`pill-state ${isTrigger ? 'pill-cobalt' : isCondition ? 'pill-amber' : 'pill-green'}`}>
                        {node.type}
                      </span>
                      <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
                        Step #{idx + 1} &bull; {node.id}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.98rem', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>
                      {node.name}
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)' }}>
                      {node.config?.actionType && (
                        <div>Action: <b style={{ color: 'var(--cobalt)' }}>{node.config.actionType}</b></div>
                      )}
                      {node.config?.field && (
                        <div>
                          Condition: <span className="mono">{node.config.field} {node.config.operator} {JSON.stringify(node.config.value)}</span>
                        </div>
                      )}
                      {node.config?.message && (
                        <div style={{ color: 'var(--ink-muted)', marginTop: '2px', fontStyle: 'italic' }}>
                          "{node.config.message}"
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Flow Connector Line */}
                  {idx < (workflow?.nodes?.length || 0) - 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0', color: 'var(--hairline-strong)' }}>
                      &darr;
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Live Decision Simulator */}
        <div className="instrument-section" style={{ padding: '24px' }}>
          <div style={{ borderBottom: '1px solid var(--hairline)', paddingBottom: '14px', marginBottom: '20px' }}>
            <span className="label-quiet">Validation Sandbox</span>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--ink)', marginTop: '2px' }}>
              Live Payload Rule Evaluator
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--ink-secondary)', marginTop: '4px' }}>
              Test how an incoming transaction triggers conditions and resolves downstream actions.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="label-quiet" style={{ display: 'block', marginBottom: '4px' }}>Simulation Scenario</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span className="pill-state pill-cobalt" style={{ cursor: 'pointer' }}>Standard UPI Flow</span>
                <span className="pill-state pill-amber" style={{ cursor: 'pointer' }}>High Risk Step-Up</span>
                <span className="pill-state pill-green" style={{ cursor: 'pointer' }}>VIP Zero-Friction</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="label-quiet" style={{ display: 'block', marginBottom: '4px' }}>Simulated Amount</label>
                <input
                  type="text"
                  readOnly
                  value="₹45,000.00"
                  style={{ width: '100%', background: 'var(--surface-subtle)' }}
                />
              </div>
              <div>
                <label className="label-quiet" style={{ display: 'block', marginBottom: '4px' }}>Simulated GNN Risk</label>
                <input
                  type="text"
                  readOnly
                  value="82 / 100 (High Risk)"
                  style={{ width: '100%', background: 'var(--surface-subtle)', color: 'var(--red)', fontWeight: 600 }}
                />
              </div>
            </div>

            <div style={{
              background: 'var(--surface-subtle)',
              border: '1px solid var(--hairline)',
              padding: '16px'
            }}>
              <span className="label-quiet" style={{ display: 'block', marginBottom: '8px' }}>Evaluated Decision Trail</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>1. Trigger: Payment Intent Initialized</span>
                  <span className="pill-state pill-green">Passed</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>2. Condition: riskScore &gt; 75 (Score: 82)</span>
                  <span className="pill-state pill-amber">Matched True</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>3. Action: STEP_UP_3DS Challenge Required</span>
                  <span className="pill-state pill-cobalt">Enforced</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--hairline)', paddingTop: '14px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--ink-secondary)' }}>
                Compiler Status: <b style={{ color: 'var(--green)' }}>Syntactically Verified</b>
              </span>
              <button onClick={saveWorkflow} className="btn-cobalt">
                {isSaved ? <Check size={14} /> : <GitFork size={14} />}
                <span>{isSaved ? 'Rules Compiled' : 'Deploy Pipeline'}</span>
              </button>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
