import type { Component } from 'vue'

export type FlowNodeStatus = 'pending' | 'active' | 'completed'
export type ConnectorDirection = 'right' | 'down'

export interface FlowNodeData {
  id: string
  title: string
  link: string
  statusKey: string
}

export interface FlowRowNode {
  node: FlowNodeData
  icon?: Component
  connector?: ConnectorDirection
}

export interface FlowNodeStatusInfo {
  status: string
  count: number
  latest?: string
}
