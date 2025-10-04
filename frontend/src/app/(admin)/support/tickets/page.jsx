import { useState, useEffect, useMemo } from 'react';
import { Col, Row, Card, Button, Badge, Form, InputGroup, Table, Spinner, Alert } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import PageMetaData from '@/components/PageTitle';
import { supportApi } from '@/lib/api';
import { useAuth } from '@/lib/simpleAuth';

const Tickets = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [editingTicketId, setEditingTicketId] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    resolution_status: searchParams.get('status') ? [searchParams.get('status')] : [],
    issue_category: searchParams.get('category') ? [searchParams.get('category')] : [],
    agent_id: searchParams.get('agent') || '',
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || ''
  });

  // Form state for Add Ticket
  const [formData, setFormData] = useState({
    customer_phone: '',
    customer_location: '',
    communication_channel: 'Phone',
    device_type: '',
    issue_category: '',
    issue_type: '',
    issue_description: '',
    agent_id: '',
    resolution_status: 'Pending',
    first_call_resolution: 'No'
  });

  const issueCategories = [
    'App', 'IPTV', 'Streaming', 'VOD', 'Subscription', 'OTP', 'Programming', 'Other'
  ];

  const communicationChannels = [
    'WhatsApp', 'Phone', 'Email', 'In-App'
  ];

  const deviceTypes = [
    'Huawei', 'Samsung', 'iPhone', 'Android', 'iPad', 'Windows', 'Mac', 'Linux', 'Other'
  ];

  const issueTypes = [
    'Login Issue', 'Channel Missing', 'Streaming Problem', 'Payment Issue', 
    'Account Problem', 'Technical Issue', 'Billing Question', 'Other'
  ];

  const statusOptions = [
    { value: 'Pending', label: 'Pending', variant: 'warning' },
    { value: 'In-Progress', label: 'In Progress', variant: 'info' },
    { value: 'Completed', label: 'Completed', variant: 'success' }
  ];

  // Load tickets
  const loadTickets = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        page: pagination.page,
        pageSize: pagination.limit,
        ...filters
      };
      
      // Clean up empty filters
      Object.keys(params).forEach(key => {
        if (params[key] === '' || (Array.isArray(params[key]) && params[key].length === 0)) {
          delete params[key];
        }
      });
      
      const response = await supportApi.getTickets(params);
      setTickets(response.data || []);
      setPagination(prev => ({
        ...prev,
        total: response.meta?.total || 0
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load employees for dropdown
  const loadEmployees = async () => {
    try {
      const response = await managementApi.getEmployees();
      setEmployees(response.data || []);
    } catch (err) {
      console.error('Failed to load employees:', err);
    }
  };

  useEffect(() => {
    loadTickets();
    loadEmployees();
  }, [filters, pagination.page]);

  // Debug: Log user data to see available fields
  useEffect(() => {
    if (user) {
      console.log('Current user data:', user);
      console.log('Employee ID:', user.employeeId?.employee_id || user.employee?.employee_id);
      console.log('Employee object:', user.employeeId);
    }
  }, [user]);

  // Update URL when filters change
  useEffect(() => {
    const newParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value && (Array.isArray(value) ? value.length > 0 : true)) {
        if (Array.isArray(value)) {
          newParams.set(key, value.join(','));
        } else {
          newParams.set(key, value);
        }
      }
    });
    setSearchParams(newParams);
  }, [filters, setSearchParams]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleStatusChange = async (ticketId, currentStatus) => {
    try {
      // Cycle through statuses: Pending → In-Progress → Completed → Pending
      let newStatus;
      switch (currentStatus) {
        case 'Pending':
          newStatus = 'In-Progress';
          break;
        case 'In-Progress':
          newStatus = 'Completed';
          break;
        case 'Completed':
          newStatus = 'Pending';
          break;
        default:
          newStatus = 'In-Progress';
      }

      // Update status directly without any popups
      await supportApi.updateTicket(ticketId, { resolution_status: newStatus });
      
      // Show a brief success toast
      Swal.fire({
        title: 'Status Updated!',
        text: `Changed to ${newStatus}`,
        icon: 'success',
        timer: 1500,
        toast: true,
        position: 'top-end',
        showConfirmButton: false
      });
      
      // Refresh the ticket list
      loadTickets();
    } catch (err) {
      Swal.fire({
        title: 'Error!',
        text: err.message,
        icon: 'error',
        timer: 2000
      });
    }
  };


  const handleViewTicket = async (ticketId) => {
    try {
      const response = await supportApi.getTicket(ticketId);
      const ticket = response.data;
      
      // Debug: Log the ticket data to console
      console.log('Ticket data received:', ticket);
      
      // Format the ticket details in a two-column layout to fit without scrolling
      const ticketDetails = `
        <div style="text-align: left; font-family: Arial, sans-serif; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; max-width: 900px;">
          <div>
            <div style="margin-bottom: 8px;">
              <strong>Ticket ID:</strong> #${String(ticket.ticket_id).padStart(4, '0')}
            </div>
            <div style="margin-bottom: 8px;">
              <strong>Date:</strong> ${new Date(ticket.createdAt).toLocaleDateString('en-US', { 
                month: 'numeric', 
                day: 'numeric', 
                year: 'numeric' 
              })}, ${new Date(ticket.createdAt).toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit', 
                second: '2-digit',
                hour12: true 
              })}
            </div>
            <div style="margin-bottom: 8px;">
              <strong>Customer Phone:</strong> ${ticket.customer_phone}
            </div>
            <div style="margin-bottom: 8px;">
              <strong>Customer Location:</strong> ${ticket.customer_location || '-'}
            </div>
            <div style="margin-bottom: 8px;">
              <strong>Channel:</strong> ${ticket.communication_channel || '-'}
            </div>
            <div style="margin-bottom: 8px;">
              <strong>Device Type:</strong> ${ticket.device_type || '-'}
            </div>
            <div style="margin-bottom: 8px;">
              <strong>Issue Category:</strong> ${ticket.issue_category || '-'}
            </div>
            <div style="margin-bottom: 8px;">
              <strong>Issue Type:</strong> ${ticket.issue_type || '-'}
            </div>
          </div>
          <div>
            <div style="margin-bottom: 8px;">
              <strong>Issue Description:</strong> ${ticket.issue_description || '-'}
            </div>
            <div style="margin-bottom: 8px;">
              <strong>Agent ID:</strong> ${ticket.agent_id || '-'}
            </div>
            <div style="margin-bottom: 8px;">
              <strong>First Call Resolution:</strong> ${ticket.first_call_resolution || '-'}
            </div>
            <div style="margin-bottom: 8px;">
              <strong>Resolution Status:</strong> ${ticket.resolution_status || '-'}
            </div>
            <div style="margin-bottom: 8px;">
              <strong>Created At:</strong> ${new Date(ticket.createdAt).toLocaleString()}
            </div>
            <div style="margin-bottom: 8px;">
              <strong>Updated At:</strong> ${new Date(ticket.updatedAt).toLocaleString()}
            </div>
            <div style="margin-bottom: 8px;">
              <strong>MongoDB ID:</strong> ${ticket._id || '-'}
            </div>
            <div style="margin-bottom: 8px;">
              <strong>Version:</strong> ${ticket.__v || '0'}
            </div>
          </div>
        </div>
      `;
      
      Swal.fire({
        title: 'Ticket Details',
        html: ticketDetails,
        icon: 'info',
        width: '950px',
        heightAuto: false,
        confirmButtonText: 'Close',
        confirmButtonColor: '#6f42c1',
        showCloseButton: true,
        allowOutsideClick: true,
        allowEscapeKey: true,
        customClass: {
          popup: 'swal2-popup-custom',
          container: 'swal2-container-custom'
        }
      });
    } catch (err) {
      Swal.fire({
        title: 'Error!',
        text: err.message,
        icon: 'error'
      });
    }
  };

  const handleEditTicket = async (ticketId) => {
    try {
      // Fetch ticket details
      const response = await supportApi.getTicket(ticketId);
      const ticket = response.data;
      
      // Pre-fill the form with ticket data
      setFormData({
        customer_phone: ticket.customer_phone,
        customer_location: ticket.customer_location || '',
        communication_channel: ticket.communication_channel,
        device_type: ticket.device_type || '',
        issue_category: ticket.issue_category,
        issue_type: ticket.issue_type || '',
        issue_description: ticket.issue_description,
        agent_id: ticket.agent_id || '',
        resolution_status: ticket.resolution_status,
        first_call_resolution: ticket.first_call_resolution
      });
      
      // Set editing mode
      setEditingTicketId(ticketId);
      setShowModal(true);
      
      Swal.fire({
        title: 'Edit Mode',
        text: `Editing ticket #${ticketId}. Form has been pre-filled with current data.`,
        icon: 'info',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire({
        title: 'Error!',
        text: err.message,
        icon: 'error'
      });
    }
  };

  const handleDeleteTicket = async (ticketId) => {
    try {
      const result = await Swal.fire({
        title: 'Delete Ticket',
        text: `Are you sure you want to delete ticket #${ticketId}? This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#d33',
        reverseButtons: true
      });

      if (result.isConfirmed) {
        // Show loading
        Swal.fire({
          title: 'Deleting...',
          text: 'Please wait while we delete the ticket.',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        // Call delete API
        await supportApi.deleteTicket(ticketId);
        
        Swal.fire({
          title: 'Deleted!',
          text: `Ticket #${ticketId} has been successfully deleted.`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
        
        // Reload tickets list
        loadTickets();
      }
    } catch (err) {
      Swal.fire({
        title: 'Error!',
        text: err.message,
        icon: 'error'
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // A) Frontend validation before submit
      
      // Validate customer_phone: digits only, 7-15 digits
      if (!formData.customer_phone) {
        Swal.fire({
          title: 'Invalid Phone',
          text: 'Customer phone is required.',
          icon: 'error'
        });
        return;
      }
      
      const phoneRegex = /^[0-9]{7,15}$/;
      if (!phoneRegex.test(formData.customer_phone)) {
        Swal.fire({
          title: 'Invalid Phone',
          text: 'Please enter digits only (7–15).',
          icon: 'error'
        });
        return;
      }

      // Validate issue_category: required
      if (!formData.issue_category) {
        Swal.fire({
          title: 'Validation Error',
          text: 'Issue Category is required.',
          icon: 'error'
        });
        return;
      }

      // Validate issue_description: trim and reject if only whitespace
      if (formData.issue_description && formData.issue_description.trim() === '') {
        Swal.fire({
          title: 'Validation Error',
          text: 'Issue description cannot be only whitespace.',
          icon: 'error'
        });
        return;
      }

      // B) Auto-set required defaults in payload
      const cleanFormData = {
        customer_phone: formData.customer_phone,
        customer_location: formData.customer_location || '',
        communication_channel: formData.communication_channel || 'Phone',
        device_type: formData.device_type || '',
        issue_category: formData.issue_category,
        issue_type: formData.issue_type || '',
        issue_description: formData.issue_description?.trim() || '',
        agent_id: user?.employeeId?.employee_id || user?.employee?.employee_id || null,
        resolution_status: formData.resolution_status || 'Pending',
        first_call_resolution: formData.first_call_resolution || 'No'
      };

      // FCR remains as set by user - no auto-update

      console.log('Submitting ticket with data:', cleanFormData);

      let response;
      if (editingTicketId) {
        // Update existing ticket
        response = await supportApi.updateTicket(editingTicketId, cleanFormData);
        Swal.fire({
          title: 'Success!',
          text: `Ticket #${editingTicketId} updated successfully.`,
          icon: 'success',
          timer: 2000
        });
      } else {
        // Create new ticket
        response = await supportApi.createTicket(cleanFormData);
        Swal.fire({
          title: 'Success!',
          text: 'Ticket created successfully.',
          icon: 'success',
          timer: 2000
        });
      }
      
      setShowAddModal(false);
      setEditingTicketId(null);
      setFormData({
        customer_phone: '',
        customer_location: '',
        communication_channel: 'Phone',
        device_type: '',
        issue_category: '',
        issue_type: '',
        issue_description: '',
        agent_id: '',
        resolution_status: 'Pending',
        first_call_resolution: 'No'
      });
      
      loadTickets();
    } catch (err) {
      // Handle API field-level errors
      if (err.errors && Array.isArray(err.errors)) {
        const errorList = err.errors.map(error => 
          `<li><strong>${error.field}:</strong> ${error.detail}</li>`
        ).join('');
        
        Swal.fire({
          title: 'Validation errors',
          html: `<ul style="text-align: left;">${errorList}</ul>`,
          icon: 'error'
        });
        return;
      }
      
      // Generic error handling
      Swal.fire({
        title: 'Error!',
        text: err.message,
        icon: 'error'
      });
    }
  };

  const getStatusBadge = (status) => {
    const option = statusOptions.find(opt => opt.value === status);
    return (
      <Badge bg={option?.variant || 'secondary'}>
        {option?.label || status}
      </Badge>
    );
  };

  const getStateBadge = (ticket) => {
    if (ticket.ticket_state === 'Closed') {
      return <Badge bg="success">Closed</Badge>;
    } else if (ticket.ticket_state === 'Reopened') {
      return <Badge bg="danger">Reopened</Badge>;
    } else {
      return <Badge bg="primary">Open</Badge>;
    }
  };

  const getFCRBadge = (fcr) => {
    return (
      <Badge bg={fcr === 'Yes' ? 'success' : 'secondary'}>
        {fcr}
      </Badge>
    );
  };

  if (loading && tickets.length === 0) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <>
      <PageMetaData title="Tickets" />
      
      <Row>
        <Col>
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h4 className="mb-0">Support Tickets</h4>
              <Button 
                variant="primary" 
                onClick={() => setShowAddModal(true)}
              >
                Add Ticket
              </Button>
            </Card.Header>
            
            <Card.Body>
              {error && (
                <Alert variant="danger" className="mb-3">
                  {error}
                </Alert>
              )}

              {/* Filters */}
              <Row className="mb-3">
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Search</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Phone, location, description..."
                      value={filters.search}
                      onChange={(e) => handleFilterChange('search', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>Status</Form.Label>
                    <Form.Select
                      value={filters.resolution_status[0] || ''}
                      onChange={(e) => handleFilterChange('resolution_status', e.target.value ? [e.target.value] : [])}
                    >
                      <option value="">All Status</option>
                      {statusOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>Category</Form.Label>
                    <Form.Select
                      value={filters.issue_category[0] || ''}
                      onChange={(e) => handleFilterChange('issue_category', e.target.value ? [e.target.value] : [])}
                    >
                      <option value="">All Categories</option>
                      {issueCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>Agent</Form.Label>
                    <Form.Select
                      value={filters.agent_id}
                      onChange={(e) => handleFilterChange('agent_id', e.target.value)}
                    >
                      <option value="">All Agents</option>
                      {employees.map(emp => (
                        <option key={emp.employee_id} value={emp.employee_id}>{emp.name}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Row>
                    <Col>
                      <Form.Group>
                        <Form.Label>From Date</Form.Label>
                        <Form.Control
                          type="date"
                          value={filters.from}
                          onChange={(e) => handleFilterChange('from', e.target.value)}
                        />
                      </Form.Group>
                    </Col>
                    <Col>
                      <Form.Group>
                        <Form.Label>To Date</Form.Label>
                        <Form.Control
                          type="date"
                          value={filters.to}
                          onChange={(e) => handleFilterChange('to', e.target.value)}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                </Col>
              </Row>

              {/* Tickets Table */}
              <Table responsive striped hover>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Channel</th>
                    <th>Device</th>
                    <th>Category</th>
                    <th>Issue Type</th>
                    <th>Description</th>
                    <th>Agent</th>
                    <th>Status</th>
                    <th>FCR</th>
                    <th>State</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map(ticket => (
                    <tr key={ticket.ticket_id}>
                      <td>{ticket.ticket_id}</td>
                      <td>{new Date(ticket.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div>
                          <strong>{ticket.customer_phone}</strong>
                          {ticket.customer_location && (
                            <div className="text-muted small">{ticket.customer_location}</div>
                          )}
                        </div>
                      </td>
                      <td>{ticket.communication_channel}</td>
                      <td>{ticket.device_type || '-'}</td>
                      <td>{ticket.issue_category}</td>
                      <td>{ticket.issue_type || '-'}</td>
                      <td>
                        <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ticket.issue_description}
                        </div>
                      </td>
                      <td>{ticket.agent_info?.name || '-'}</td>
                      <td>{getStatusBadge(ticket.resolution_status)}</td>
                      <td>{getFCRBadge(ticket.first_call_resolution)}</td>
                      <td>{getStateBadge(ticket)}</td>
                      <td>
                        <div className="d-flex gap-1">
                          {/* View Button - Always available */}
                          <Button
                            size="sm"
                            variant="outline-primary"
                            onClick={() => handleViewTicket(ticket.ticket_id)}
                            title="View Ticket"
                          >
                            <i className="fas fa-eye"></i>
                          </Button>
                          
                          {/* Edit Button - Always available */}
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            onClick={() => handleEditTicket(ticket.ticket_id)}
                            title="Edit Ticket"
                          >
                            <i className="fas fa-edit"></i>
                          </Button>
                          
                          {/* Delete Button - Always available */}
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() => handleDeleteTicket(ticket.ticket_id)}
                            title="Delete Ticket"
                          >
                            <i className="fas fa-trash"></i>
                          </Button>
                          
                          {/* Unified Status Change Button - Hidden for Completed tickets */}
                          {ticket.resolution_status !== 'Completed' && (
                            <Button
                              size="sm"
                              variant={ticket.resolution_status === 'In-Progress' ? 'info' : 'warning'}
                              onClick={() => handleStatusChange(ticket.ticket_id, ticket.resolution_status)}
                              title={`Current Status: ${ticket.resolution_status}`}
                            >
                              {ticket.resolution_status === 'In-Progress' ? <i className="fas fa-clock"></i> :
                               <i className="fas fa-pause"></i>}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              {/* Pagination */}
              {pagination.total > 0 && (
                <div className="d-flex justify-content-between align-items-center mt-3">
                  <div>
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} tickets
                  </div>
                  <div>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      disabled={pagination.page === 1}
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    >
                      Previous
                    </Button>
                    <span className="mx-2">Page {pagination.page}</span>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      disabled={pagination.page * pagination.limit >= pagination.total}
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    >
                      Next
                    </Button>
            </div>
          </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Add Ticket Modal */}
      {showAddModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editingTicketId ? `Edit Ticket #${editingTicketId}` : 'Add New Ticket'}</h5>
                <Button
                  variant="outline-secondary"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingTicketId(null);
                  }}
                >
                  ×
                </Button>
              </div>
              
              <Form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Customer Phone *</Form.Label>
                        <Form.Control
                          type="tel"
                          value={formData.customer_phone}
                          onChange={(e) => setFormData(prev => ({ ...prev, customer_phone: e.target.value }))}
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Customer Location</Form.Label>
                        <Form.Control
                          type="text"
                          value={formData.customer_location}
                          onChange={(e) => setFormData(prev => ({ ...prev, customer_location: e.target.value }))}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Communication Channel</Form.Label>
                        <Form.Select
                          value={formData.communication_channel}
                          onChange={(e) => setFormData(prev => ({ ...prev, communication_channel: e.target.value }))}
                        >
                          {communicationChannels.map(channel => (
                            <option key={channel} value={channel}>{channel}</option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Issue Category *</Form.Label>
                        <Form.Select
                          value={formData.issue_category}
                          onChange={(e) => setFormData(prev => ({ ...prev, issue_category: e.target.value }))}
                          required
                        >
                          <option value="">Select Category</option>
                          {issueCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>
                  
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Device Type</Form.Label>
                        <Form.Select
                          value={formData.device_type}
                          onChange={(e) => setFormData(prev => ({ ...prev, device_type: e.target.value }))}
                        >
                          <option value="">Select Device Type</option>
                          {deviceTypes.map(device => (
                            <option key={device} value={device}>{device}</option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Issue Type</Form.Label>
                        <Form.Select
                          value={formData.issue_type}
                          onChange={(e) => setFormData(prev => ({ ...prev, issue_type: e.target.value }))}
                        >
                          <option value="">Select Issue Type</option>
                          {issueTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>
                  
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Resolution Status</Form.Label>
                        <Form.Select
                          value={formData.resolution_status || 'Pending'}
                          onChange={(e) => {
                            const newStatus = e.target.value;
                            setFormData(prev => ({ 
                              ...prev, 
                              resolution_status: newStatus
                              // FCR remains unchanged when status changes
                            }));
                          }}
                        >
                          <option value="Pending">Pending</option>
                          <option value="In-Progress">In-Progress</option>
                          <option value="Completed">Completed</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>First Call Resolution</Form.Label>
                        <Form.Control
                          type="text"
                          value={formData.first_call_resolution || 'No'}
                          disabled
                          className="bg-light"
                          readOnly
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  
                  <Row>
                    <Col>
                      <Form.Group className="mb-3">
                        <Form.Label>Issue Description *</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={4}
                          value={formData.issue_description}
                          onChange={(e) => setFormData(prev => ({ ...prev, issue_description: e.target.value }))}
                          required
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  
                  <Row>
                    <Col>
                      <div className="alert alert-info mb-0">
                        <small>
                          <i className="fas fa-info-circle me-1"></i>
                          This ticket will be automatically assigned to you ({user?.username || user?.email || 'Current User'})
                        </small>
                      </div>
                    </Col>
                  </Row>
                </div>
                
                <div className="modal-footer">
                  <Button
                    variant="outline-secondary"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                  >
                    Create Ticket
                  </Button>
                </div>
              </Form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Tickets;