import type { InstanceStatus } from './types'
import { STATUS_PHASE_MAP } from './constants'

// Geçerli durum geçişleri
const TRANSITIONS: Record<InstanceStatus, InstanceStatus[]> = {
  DRAFT: ['COLLECTING', 'ANALYZING'],
  COLLECTING: ['ANALYZING', 'DRAFT', 'FAILED'],
  ANALYZING: ['GENERATING_PLAN', 'NEEDS_ACTION', 'FAILED'],
  GENERATING_PLAN: ['READY_FOR_REVIEW', 'FAILED'],
  READY_FOR_REVIEW: ['APPLYING', 'GENERATING_PLAN'],
  APPLYING: ['RUNNING', 'NEEDS_ACTION', 'FAILED'],
  RUNNING: ['NEEDS_ACTION', 'FAILED', 'RUNNING'],
  NEEDS_ACTION: ['COLLECTING', 'ANALYZING', 'APPLYING', 'RUNNING', 'FAILED'],
  FAILED: ['DRAFT', 'COLLECTING', 'ANALYZING', 'APPLYING'],
}

export function canTransition(from: InstanceStatus, to: InstanceStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function getPhase(status: InstanceStatus): 1 | 2 | 3 {
  return STATUS_PHASE_MAP[status]
}

export function getAvailableActions(status: InstanceStatus): string[] {
  switch (status) {
    case 'DRAFT':
      return ['save_inputs', 'start_analysis']
    case 'COLLECTING':
      return ['save_inputs']
    case 'ANALYZING':
      return []
    case 'GENERATING_PLAN':
      return []
    case 'READY_FOR_REVIEW':
      return ['approve_and_apply', 'regenerate_plan']
    case 'APPLYING':
      return []
    case 'RUNNING':
      return ['view_metrics', 'optimize']
    case 'NEEDS_ACTION':
      return ['fix_issues', 'retry']
    case 'FAILED':
      return ['retry', 'view_error']
    default:
      return []
  }
}
