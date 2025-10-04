const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Generic API client with envelope handling
 * @param {string} path - API endpoint path
 * @param {object} options - Fetch options
 * @returns {Promise<any>} - Response data
 */
export async function api(path, options = {}) {
  const url = path.startsWith('/') ? `${API_BASE_URL}${path}` : `${API_BASE_URL}/${path}`;
  
  const defaultOptions = {
    credentials: 'include', // Include cookies for auth
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };

  const config = { ...defaultOptions, ...options };

  try {
    const response = await fetch(url, config);
    
    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }
      return response;
    }

    const json = await response.json().catch(() => ({}));
    
    // Handle envelope responses
    if (!json.ok) {
      const errorMessage = json?.error?.message || `Request failed (${response.status})`;
      
      // Redirect to login on 401, but don't do it during initial load
      if (response.status === 401 && !window.location.pathname.includes('/auth/')) {
        window.location.href = '/auth/sign-in';
        return;
      }
      
      // Create error with full error object for field-level validation
      const error = new Error(errorMessage);
      error.response = json;
      error.errors = json?.error?.errors;
      throw error;
    }
    
    return json;
  } catch (error) {
    // Network or other errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Network error - please check your connection');
    }
    throw error;
  }
}

// Convenience methods
export const apiGet = (path, params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, value.toString());
    }
  });
  
  const queryString = searchParams.toString();
  const fullPath = queryString ? `${path}?${queryString}` : path;
  
  return api(fullPath, { method: 'GET' });
};

export const apiPost = (path, data) => {
  return api(path, {
    method: 'POST',
    body: JSON.stringify(data)
  });
};

export const apiPut = (path, data) => {
  return api(path, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
};

export const apiDelete = (path) => {
  return api(path, { method: 'DELETE' });
};

export const apiPatch = (path, data) => {
  return api(path, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
};

// Auth-specific API calls
export const authApi = {
  login: (identifier, password) => 
    apiPost('/auth/login', { identifier, password }),
  
  logout: () => 
    apiPost('/auth/logout', {}),
  
  me: () => 
    apiGet('/auth/me')
};

// Management API calls
export const managementApi = {
  // Departments
  getDepartments: (params = {}) => 
    apiGet('/departments', params),
  
  getDepartment: (id) => 
    apiGet(`/departments/${id}`),
  
  createDepartment: (data) => 
    apiPost('/departments', data),
  
  updateDepartment: (id, data) => 
    apiPut(`/departments/${id}`, data),
  
  deleteDepartment: (id) => 
    apiDelete(`/departments/${id}`),
  
  getDepartmentSections: (id, params = {}) => 
    apiGet(`/departments/${id}/sections`, params),

  // Sections
  getSections: (params = {}) => 
    apiGet('/sections', params),
  
  getSection: (id) => 
    apiGet(`/sections/${id}`),
  
  createSection: (data) => 
    apiPost('/sections', data),
  
  updateSection: (id, data) => 
    apiPut(`/sections/${id}`, data),
  
  deleteSection: (id) => 
    apiDelete(`/sections/${id}`),

  // Employees
  getEmployees: (params = {}) => 
    apiGet('/employees', params),
  
  getEmployee: (id) => 
    apiGet(`/employees/${id}`),
  
  createEmployee: (data) => 
    apiPost('/employees', data),
  
  updateEmployee: (id, data) => 
    apiPut(`/employees/${id}`, data),
  
  deleteEmployee: (id) => 
    apiDelete(`/employees/${id}`),
  
  getUnassignedEmployees: () => 
    apiGet('/employees/unassigned'),

  // Users
  getUsers: (params = {}) => 
    apiGet('/users', params),
  
  getUser: (id) => 
    apiGet(`/users/${id}`),
  
  createUser: (data) => 
    apiPost('/users', data),
  
  updateUser: (id, data) => 
    apiPut(`/users/${id}`, data),
  
  deleteUser: (id) => 
    apiDelete(`/users/${id}`)
};

// Access control API calls
export const accessApi = {
  getPermissions: () => 
    apiGet('/access/permissions'),
  
  getRoles: () => 
    apiGet('/access/roles'),
  
  getUserAccess: (userId) => 
    apiGet(`/access/users/${userId}`),
  
  updateUserAccess: (userId, data) => 
    apiPost(`/access/users/${userId}`, data),

  getPageRestrictions: (userId, permission) =>
    apiGet(`/access/page-restrictions/${userId}/${permission}`),

  getDepartments: () =>
    apiGet('/access/departments'),

  getSections: () =>
    apiGet('/access/sections')
};

// Support API calls
export const supportApi = {
  // Tickets
  getTickets: (params = {}) => 
    apiGet('/tickets', params),
  
  getTicket: (id) => 
    apiGet(`/tickets/${id}`),
  
  createTicket: (data) => 
    apiPost('/tickets', data),
  
    updateTicket: (id, data) => 
      apiPatch(`/tickets/${id}`, data),
    
    deleteTicket: (id) => 
      api(`/tickets/${id}`, { method: 'DELETE' }),
    
    reopenTicket: (id) => 
      apiPatch(`/tickets/${id}/reopen`, {}),
  
  getStuckTickets: () => 
    apiGet('/tickets/stuck/tickets'),

  // Follow-ups
  getFollowUps: (params = {}) => 
    apiGet('/follow-ups', params),
  
  getPendingFollowUps: (params = {}) => 
    apiGet('/follow-ups/pending', params),
  
  getFollowUp: (id) => 
    apiGet(`/follow-ups/${id}`),
  
  createFollowUp: (data) => 
    apiPost('/follow-ups', data),
  
  updateFollowUp: (id, data) => 
    apiPatch(`/follow-ups/${id}`, data),
  
  markSolved: (id, data) => 
    apiPatch(`/follow-ups/${id}/solved`, data),
  
  markNotSolved: (id, data) => 
    apiPatch(`/follow-ups/${id}/not-solved`, data),
  
  noAnswer: (id, data) => 
    apiPatch(`/follow-ups/${id}/no-answer`, data),
  
  assignToMe: (id) => 
    apiPatch(`/follow-ups/${id}/assign-to-me`, {}),

  // Reviews
  getReviews: (params = {}) => 
    apiGet('/reviews', params),
  
  getReview: (id) => 
    apiGet(`/reviews/${id}`),
  
  createReview: (data) => 
    apiPost('/reviews', data),
  
  updateReview: (id, data) => 
    apiPatch(`/reviews/${id}`, data),
  
  getStuckTicketsForReview: () => 
    apiGet('/reviews/stuck/tickets'),
  
  resolveReview: (id, data) => 
    apiPatch(`/reviews/${id}/resolve`, data)
};
