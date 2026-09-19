export interface WorkflowRuleNode {
  id: string;
  name: string;
  type: 'TRIGGER' | 'CONDITION' | 'ACTION';
  config: {
    field?: 'amount' | 'riskScore' | 'currency' | 'paymentMethod' | 'customerCountry' | 'providerStatus';
    operator?: 'GREATER_THAN' | 'LESS_THAN' | 'EQUALS' | 'IN' | 'CONTAINS';
    value?: any;
    actionType?: 'REQUIRE_3DS' | 'FORCE_PROVIDER' | 'APPLY_DISCOUNT' | 'BLOCK' | 'AUTO_RETRY_BACKUP' | 'MANUAL_REVIEW';
    targetProvider?: string;
    message?: string;
  };
  nextNodes?: string[];
}

export interface WorkflowDefinition {
  id: string;
  merchantId: string;
  name: string;
  enabled: boolean;
  nodes: WorkflowRuleNode[];
  edges: { id: string; source: string; target: string; conditionOutcome?: boolean }[];
}

export class WorkflowEngine {
  private merchantWorkflows: Map<string, WorkflowDefinition> = new Map();

  constructor() {
    this.seedDefaultMerchantWorkflows();
  }

  private seedDefaultMerchantWorkflows() {
    const defaultWorkflow: WorkflowDefinition = {
      id: 'wf_global_policy_01',
      merchantId: 'mch_acme_corp',
      name: 'Acme Smart Risk & Routing Flow',
      enabled: true,
      nodes: [
        {
          id: 'node_trigger',
          name: 'Payment Request Received',
          type: 'TRIGGER',
          config: {},
          nextNodes: ['node_cond_high_val']
        },
        {
          id: 'node_cond_high_val',
          name: 'Amount > $1,000 OR Risk > 40',
          type: 'CONDITION',
          config: {
            field: 'riskScore',
            operator: 'GREATER_THAN',
            value: 40
          },
          nextNodes: ['node_act_3ds', 'node_cond_cross_border']
        },
        {
          id: 'node_act_3ds',
          name: 'Trigger 3DS Step-Up Challenge',
          type: 'ACTION',
          config: {
            actionType: 'REQUIRE_3DS',
            message: 'High risk or high value payment requires 3D Secure verification'
          }
        },
        {
          id: 'node_cond_cross_border',
          name: 'Currency is EUR or GBP',
          type: 'CONDITION',
          config: {
            field: 'currency',
            operator: 'IN',
            value: ['EUR', 'GBP']
          },
          nextNodes: ['node_act_route_adyen']
        },
        {
          id: 'node_act_route_adyen',
          name: 'Prefer Adyen (EU Interchange Advantage)',
          type: 'ACTION',
          config: {
            actionType: 'FORCE_PROVIDER',
            targetProvider: 'adyen',
            message: 'Routed to Adyen for European settlement optimization'
          }
        }
      ],
      edges: [
        { id: 'e1', source: 'node_trigger', target: 'node_cond_high_val' },
        { id: 'e2', source: 'node_cond_high_val', target: 'node_act_3ds', conditionOutcome: true },
        { id: 'e3', source: 'node_cond_high_val', target: 'node_cond_cross_border', conditionOutcome: false },
        { id: 'e4', source: 'node_cond_cross_border', target: 'node_act_route_adyen', conditionOutcome: true }
      ]
    };

    this.merchantWorkflows.set(defaultWorkflow.merchantId, defaultWorkflow);
  }

  public getWorkflow(merchantId: string): WorkflowDefinition | undefined {
    return this.merchantWorkflows.get(merchantId) || this.merchantWorkflows.get('mch_acme_corp');
  }

  public saveWorkflow(workflow: WorkflowDefinition): void {
    this.merchantWorkflows.set(workflow.merchantId, workflow);
  }

  public evaluate(context: {
    amount: number;
    currency: string;
    riskScore: number;
    paymentMethod: string;
    merchantId: string;
    customerCountry: string;
  }): {
    executedActions: string[];
    forcedProvider?: string;
    require3DS: boolean;
    block: boolean;
    notes: string[];
  } {
    const wf = this.getWorkflow(context.merchantId);
    const executedActions: string[] = [];
    const notes: string[] = [];
    let forcedProvider: string | undefined;
    let require3DS = false;
    let block = false;

    if (!wf || !wf.enabled) {
      return { executedActions, require3DS, block, notes };
    }

    // Evaluate conditions
    for (const node of wf.nodes) {
      if (node.type === 'CONDITION') {
        const { field, operator, value } = node.config;
        let matched = false;

        const actualVal = context[field as keyof typeof context];

        if (operator === 'GREATER_THAN') {
          matched = Number(actualVal) > Number(value);
        } else if (operator === 'LESS_THAN') {
          matched = Number(actualVal) < Number(value);
        } else if (operator === 'EQUALS') {
          matched = actualVal === value;
        } else if (operator === 'IN' && Array.isArray(value)) {
          matched = value.includes(actualVal);
        }

        if (matched && node.nextNodes) {
          for (const nextId of node.nextNodes) {
            const actionNode = wf.nodes.find(n => n.id === nextId);
            if (actionNode && actionNode.type === 'ACTION') {
              executedActions.push(actionNode.name);
              if (actionNode.config.actionType === 'REQUIRE_3DS') {
                require3DS = true;
                notes.push(actionNode.config.message || 'Workflow rule triggered 3DS Challenge');
              } else if (actionNode.config.actionType === 'FORCE_PROVIDER') {
                forcedProvider = actionNode.config.targetProvider;
                notes.push(`Workflow rule pinned route to ${forcedProvider}`);
              } else if (actionNode.config.actionType === 'BLOCK') {
                block = true;
                notes.push(actionNode.config.message || 'Workflow rule blocked transaction');
              }
            }
          }
        }
      }
    }

    return { executedActions, forcedProvider, require3DS, block, notes };
  }
}
