export type UserRole = 'admin' | 'manager' | 'sales'

export interface User {
  id: number
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface UserOption {
  id: number
  email: string
  full_name: string
  role: UserRole
}

export interface Client {
  id: number
  first_name: string
  last_name: string
  email?: string
  phone?: string
  company?: string
  owner_id: number
  created_at: string
  updated_at: string
}

export interface Stage {
  id: number
  name: string
  position: number
  is_default: boolean
  created_at: string
}

export interface Deal {
  id: number
  title: string
  description?: string
  client_id: number
  stage_id: number
  owner_id: number
  amount?: number
  closed_at?: string
  created_at: string
  updated_at: string
}

export interface Task {
  id: number
  title: string
  description?: string
  deal_id: number
  assignee_id: number
  due_date?: string
  is_completed: boolean
  created_at: string
  updated_at: string
}

export interface Activity {
  id: number
  type: 'call' | 'email' | 'meeting' | 'note'
  description: string
  client_id: number
  deal_id?: number
  user_id: number
  created_at: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  per_page: number
}

export interface TokenResponse {
  access_token: string
  token_type?: 'bearer'
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload extends LoginPayload {
  full_name: string
  role: UserRole
}

export interface ClientPayload {
  first_name: string
  last_name: string
  email?: string
  phone?: string
  company?: string
}

export interface StagePayload {
  name: string
  position: number
  is_default?: boolean
}

export interface DealPayload {
  title: string
  description?: string
  client_id: number
  stage_id: number
  amount?: number
}

export interface DealUpdatePayload extends Partial<DealPayload> {
  owner_id?: number
}

export interface TaskPayload {
  title: string
  description?: string
  deal_id: number
  assignee_id?: number
  due_date?: string
}

export interface TaskUpdatePayload extends Partial<TaskPayload> {
  is_completed?: boolean
}

export interface ActivityPayload {
  type: Activity['type']
  description: string
  client_id: number
  deal_id?: number
}

export interface StageStats {
  stage_name: string
  deal_count: number
  total_amount: number
}

export interface FunnelReport {
  total_deals: number
  total_amount: number
  conversion_rate?: number | null
  stages: StageStats[]
}
