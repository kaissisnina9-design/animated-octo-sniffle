export interface User {
  id: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export type UserRole = 'admin' | 'manager' | 'operator' | 'viewer';

export interface UserPublic extends Omit<User, 'password'> {}

export interface Warehouse {
  id: string;
  name: string;
  location: string | null;
  manager_id: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Row {
  id: string;
  warehouse_id: string;
  row_label: string;
  capacity: number;
  current_count: number;
  status: RowStatus;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export type RowStatus = 'active' | 'inactive' | 'maintenance';

export interface Alert {
  id: string;
  row_id: string;
  warehouse_id: string;
  alert_type: string;
  severity: AlertSeverity;
  message: string;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_at: Date | null;
  created_at: Date;
}

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}
