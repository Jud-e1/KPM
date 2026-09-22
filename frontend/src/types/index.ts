export interface Item {
  id: number;
  title: string;
  description: string | null;
  category: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ItemCreateInput {
  title: string;
  description?: string;
  category?: string;
  status?: string;
}

export interface ItemUpdateInput {
  title?: string;
  description?: string;
  category?: string;
  status?: string;
}

export interface DatabaseHealth {
  status: "healthy" | "unreachable" | "error";
  connected: boolean;
  message: string;
  version?: string;
  server?: string;
  database?: string;
  error?: string;
}

export interface SystemHealth {
  status: "online" | "degraded" | "offline";
  app_name: string;
  environment: string;
  database: DatabaseHealth;
}
