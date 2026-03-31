const API_URL = 'http://127.0.0.1:8000/api';


async function request(endpoint: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;


  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };


  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }


  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });


  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || `Error ${res.status}`);
  }


  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }


  return res.text();
}


// Interfaces
export interface Lead {
  id: string;
  name: string;
  phone: string;
  agency: string;
  origin: string;
  campaign: string;
  stage: string;
  dca_id: string;
  dca_name?: string;
  asesor_id?: string;
  asesor_name?: string;
  created_at: string;
  created_by?: string;
  created_by_name?: string;
  notes?: string;
}


export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  agency: string;
  agencies?: string[];
  active?: boolean;
  created_at?: string;
}


export interface Sale {
  id: string;
  lead_id: string;
  lead_name?: string;
  marca: string;
  modelo: string;
  version?: string;
  precio: number;
  tipo_venta?: string;
  asesor_id?: string;
  asesor_name?: string;
  dca_id?: string;
  dca_name?: string;
  agency?: string;
  origen?: string;
  campaign?: string;
  facturado_a?: string;
  fecha_factura?: string;
}


export interface AgencyMetrics {
  agency: string;
  stages: Record<string, number>;
  total_leads: number;
  conversion_rates: Record<string, number>;
  health: Record<string, string>;
}


export interface DashboardData {
  filter_type: string;
  start_date: string;
  agencies: AgencyMetrics[];
}


export interface LeadsResponse {
  leads: Lead[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}


export interface Campaign {
  id: string;
  nombre: string;
  agencia: string;
  canal: string;
  proveedor: string;
  tipo_campana: string;
  fecha_oferta_comercial?: string;
  fecha_aprobacion?: string;
  fecha_activacion?: string;
  fecha_finalizacion?: string;
  estado: string;
  presupuesto: number;
  moneda: string;
  dias_activos: number;
  leads_generados: number;
  leads_por_dia: number;
  ventas_atribuidas: number;
  monto_vendido: number;
  costo_por_lead: number;
  costo_por_venta: number;
  roi: number;
  created_at: string;
  updated_at?: string;
}


export interface MarketingDashboardData {
  filter_type: string;
  start_date: string;
  total_leads: number;
  total_facturadas: number;
  conversion_rate: number;
  leads_by_origin: { origin: string; count: number }[];
  campaign_metrics: {
    id: string;
    nombre: string;
    agencia: string;
    estado: string;
    dias_activos: number;
    leads_generados: number;
    leads_por_dia: number;
  }[];
  leads_by_day_of_week: { day: string; count: number }[];
  lead_trend: { day: number; count: number }[];
  funnel_data: { stage: string; count: number }[];
  dca_performance: {
    dca_id: string;
    dca_name: string;
    total_leads: number;
    contactados: number;
    citados: number;
    cumplidas: number;
  }[];
  asesor_performance: {
    asesor_id: string;
    asesor_name: string;
    total_asignados: number;
    demos: number;
    cierres: number;
    facturadas: number;
    conversion_rate: number;
  }[];
}


// Auth
export const login = (data: { email: string; password: string }) =>
  request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });


export const register = (data: {
  email: string;
  password: string;
  name: string;
  role: string;
  agency: string;
}) =>
  request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });


export const getCurrentUser = (): Promise<User> =>
  request('/auth/me');


// Dashboard
export const getDashboardMetrics = (filterType: string = 'month'): Promise<DashboardData> =>
  request(`/metrics/dashboard?filter_type=${encodeURIComponent(filterType)}`);


// Agency metrics
export const getAgencyMetrics = (agency: string, filterType: string = 'month') =>
  request(`/metrics/agency/${encodeURIComponent(agency)}?filter_type=${encodeURIComponent(filterType)}`);


// DCA metrics
export const getDCAMetrics = (dcaId: string, filterType: string = 'month') =>
  request(`/metrics/dca/${encodeURIComponent(dcaId)}?filter_type=${encodeURIComponent(filterType)}`);


// Leads
export const getLeads = (params?: {
  agency?: string;
  stage?: string;
  dca_id?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}): Promise<LeadsResponse> => {
  const query = new URLSearchParams();


  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, String(value));
      }
    });
  }


  const qs = query.toString();
  return request(`/leads${qs ? `?${qs}` : ''}`);
};


export const getLead = (id: string): Promise<Lead> =>
  request(`/leads/${encodeURIComponent(id)}`);


export const createLead = (data: {
  name: string;
  phone: string;
  agency: string;
  origin: string;
  campaign?: string;
  campaign_id?: string;
  dca_id: string;
}): Promise<Lead> =>
  request('/leads', {
    method: 'POST',
    body: JSON.stringify(data),
  });


export const updateLead = (
  id: string,
  data: {
    stage?: string;
    name?: string;
    phone?: string;
    asesor_id?: string;
    dca_id?: string;
    origin?: string;
    campaign?: string;
    agency?: string;
    notes?: string;
  }
): Promise<Lead> =>
  request(`/leads/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });


export const deleteLead = (id: string): Promise<{ message: string; id: string }> =>
  request(`/leads/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });


// Users
export const getUsers = (params?: { agency?: string; role?: string }): Promise<User[]> => {
  const query = new URLSearchParams();


  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, String(value));
      }
    });
  }


  const qs = query.toString();
  return request(`/users${qs ? `?${qs}` : ''}`);
};


export const getAllUsers = (): Promise<User[]> =>
  request('/users/all');


export const createUser = (data: {
  email: string;
  password: string;
  name: string;
  role: string;
  agency: string;
  agencies?: string[];
}): Promise<User> =>
  request('/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });


export const updateUser = (
  id: string,
  data: {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
    agency?: string;
    agencies?: string[];
    active?: boolean;
  }
): Promise<User> =>
  request(`/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });


export const deactivateUser = (id: string): Promise<void> =>
  request(`/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });


export const deleteUserPermanent = (id: string): Promise<{ message: string }> =>
  request(`/users/${encodeURIComponent(id)}/permanent`, {
    method: 'DELETE',
  });


export const getDCAs = (agency?: string): Promise<User[]> => {
  const qs = agency ? `?agency=${encodeURIComponent(agency)}` : '';
  return request(`/users/dcas${qs}`);
};


export const getAsesores = (agency?: string): Promise<User[]> => {
  const qs = agency ? `?agency=${encodeURIComponent(agency)}` : '';
  return request(`/users/asesores${qs}`);
};


// Sales
export const getSales = (params?: { agency?: string; dca_id?: string }): Promise<Sale[]> => {
  const query = new URLSearchParams();


  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, String(value));
      }
    });
  }


  const qs = query.toString();
  return request(`/sales${qs ? `?${qs}` : ''}`);
};


export const createSale = (data: {
  lead_id: string;
  marca: string;
  modelo: string;
  version: string;
  precio: number;
  tipo_venta: string;
  asesor_id: string;
  dca_id: string;
  origen: string;
  campaign: string;
  facturado_a: string;
  fecha_factura: string;
}): Promise<Sale> =>
  request('/sales', {
    method: 'POST',
    body: JSON.stringify(data),
  });


// Reports
export const getReportsOverview = (
  filterType: string = 'month',
  startDate?: string,
  endDate?: string
) => {
  const query = new URLSearchParams();
  query.append('filter_type', filterType);
  if (startDate) query.append('start_date_param', startDate);
  if (endDate) query.append('end_date_param', endDate);


  return request(`/reports/overview?${query.toString()}`);
};


// Campaigns
export const getCampaigns = (params?: { agency?: string; estado?: string }): Promise<Campaign[]> => {
  const query = new URLSearchParams();


  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, String(value));
      }
    });
  }


  const qs = query.toString();
  return request(`/campaigns${qs ? `?${qs}` : ''}`);
};


export const getActiveCampaigns = (agency?: string): Promise<Campaign[]> => {
  const qs = agency ? `?agency=${encodeURIComponent(agency)}` : '';
  return request(`/campaigns/active${qs}`);
};


export const getCampaign = (id: string): Promise<Campaign> =>
  request(`/campaigns/${encodeURIComponent(id)}`);


export const createCampaign = (data: {
  nombre: string;
  agencia: string;
  canal: string;
  proveedor: string;
  tipo_campana: string;
  fecha_oferta_comercial?: string;
  fecha_aprobacion?: string;
  fecha_activacion?: string;
  fecha_finalizacion?: string;
  estado: string;
  presupuesto?: number;
  moneda?: string;
}): Promise<Campaign> =>
  request('/campaigns', {
    method: 'POST',
    body: JSON.stringify(data),
  });


export const updateCampaign = (
  id: string,
  data: Partial<{
    nombre: string;
    agencia: string;
    canal: string;
    proveedor: string;
    tipo_campana: string;
    fecha_oferta_comercial: string;
    fecha_aprobacion: string;
    fecha_activacion: string;
    fecha_finalizacion: string;
    estado: string;
    presupuesto: number;
    moneda: string;
  }>
): Promise<Campaign> =>
  request(`/campaigns/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });


export const deleteCampaign = (id: string): Promise<{ message: string }> =>
  request(`/campaigns/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });


// Marketing Dashboard
export const getMarketingDashboard = (params?: {
  filter_type?: string;
  agency?: string;
  campaign_id?: string;
  year?: number;
  start_date_param?: string;
  end_date_param?: string;
}): Promise<MarketingDashboardData> => {
  const query = new URLSearchParams();


  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, String(value));
      }
    });
  }


  const qs = query.toString();
  return request(`/marketing/dashboard${qs ? `?${qs}` : ''}`);
};


// Config
export const getConfig = () =>
  request('/config');


export default request;