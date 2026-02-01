export interface LockOptions {
  owner: string
  repo: string
  branch: string
}

export type RulesetEnforcement = 'active' | 'disabled' | 'evaluate' | 'enabled'

export interface RulesetSummary {
  id: number
  name: string
  target: string
  enforcement: RulesetEnforcement
}

export interface RulesetStatusResult {
  locked: boolean
  found: boolean
  name: string
  rulesetId?: number
  enforcement?: RulesetEnforcement
}
