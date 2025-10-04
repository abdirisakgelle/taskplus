import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Form, Row, Col, Badge, Alert, Modal } from 'react-bootstrap';
import { supportApi } from '@/lib/api';
import Swal from 'sweetalert2';

const FollowUpsPage = () => {
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({
    q: '',
    range: '7d'
  });
  const [showModal, setShowModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState({
    issue_solved: null,
    customer_location: '',
    satisfied: null,
    repeated_issue: null,
    follow_up_notes: ''
  });

  useEffect(() => {
    loadFollowUps();
  }, [pagination.page, pagination.pageSize, filters]);

  const loadFollowUps = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        pageSize: pagination.pageSize,
        ...filters
      };
      
      const response = await supportApi.getPendingFollowUps(params);
      setFollowUps(response.data);
      setPagination(prev => ({
        ...prev,
        total: response.meta.total
      }));
    } catch (err) {
      console.error('Error loading follow-ups:', err);
      Swal.fire({
        title: 'Error!',
        text: err.message,
        icon: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleFollowUp = (ticket) => {
    setSelectedTicket(ticket);
    setFormData({
      issue_solved: null,
      customer_location: '',
      satisfied: null,
      repeated_issue: null,
      follow_up_notes: ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Client-side validation
      const errors = [];
      if (formData.issue_solved === null) {
        errors.push('Please select if the issue was solved');
      }
      if (formData.issue_solved === 1 && formData.satisfied === null) {
        errors.push('Please indicate if you are satisfied');
      }
      if (formData.issue_solved === 0 && (!formData.follow_up_notes || formData.follow_up_notes.trim().length < 5)) {
        errors.push('Please add at least 5 characters in the notes');
      }
      
      if (errors.length > 0) {
        Swal.fire({
          title: 'Complete required fields',
          html: errors.map(error => `• ${error}`).join('<br>'),
          icon: 'warning'
        });
        return;
      }

      const submitData = {
        ticket_id: selectedTicket.ticket_id,
        follow_up_agent_id: 1, // Current user's employee_id
        issue_solved: formData.issue_solved,
        satisfied: formData.satisfied,
        repeated_issue: formData.repeated_issue,
        follow_up_notes: formData.follow_up_notes,
        customer_location: formData.customer_location
      };

      await supportApi.createFollowUp(submitData);
      
      setShowModal(false);
      
      if (formData.issue_solved === 1) {
        Swal.fire({
          title: 'Follow-up saved (Solved)',
          text: 'The follow-up has been recorded successfully.',
          icon: 'success',
          timer: 3000
        });
      } else {
        Swal.fire({
          title: 'Ticket reopened and assigned back to the original agent',
          text: 'The ticket has been reopened for further resolution.',
          icon: 'info',
          timer: 3000
        });
      }
      
      loadFollowUps();
    } catch (err) {
      console.error('Error submitting follow-up:', err);
      
      if (err.errors && err.errors.length > 0) {
        const errorList = err.errors.map(error => `• ${error.detail}`).join('<br>');
        Swal.fire({
          title: 'Complete required fields',
          html: errorList,
          icon: 'warning'
        });
      } else {
        Swal.fire({
          title: "Couldn't save follow-up",
          text: err.message,
          icon: 'error'
        });
      }
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTicketId = (ticketId) => {
    return `#${ticketId.toString().padStart(4, '0')}`;
  };

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-12">
          <Card>
            <Card.Header>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h4 className="mb-0">Pending Follow-Ups</h4>
                  <p className="text-muted mb-0">Tickets and supervisor-reviewed cases from the last 7 days, not yet followed up.</p>
                </div>
                <div className="d-flex gap-2">
                  <Form.Select
                    value={filters.range}
                    onChange={(e) => handleFilterChange('range', e.target.value)}
                    style={{ width: 'auto' }}
                  >
                    <option value="7d">Show: Last 7 days</option>
                    <option value="30d">Show: Last 30 days</option>
                    <option value="all">Show: All time</option>
                  </Form.Select>
                  <Button variant="outline-primary" onClick={loadFollowUps}>
                    Refresh
                  </Button>
                </div>
              </div>
            </Card.Header>
            <Card.Body>
              {/* Search Bar */}
              <Row className="mb-3">
                <Col md={6}>
                  <Form.Control
                    type="text"
                    placeholder="Search..."
                    value={filters.q}
                    onChange={(e) => handleFilterChange('q', e.target.value)}
                  />
                </Col>
              </Row>

              {/* Follow-ups Table */}
              <Table responsive striped hover>
                <thead>
                  <tr>
                    <th>Ticket ID</th>
                    <th>Customer Phone</th>
                    <th>Issue Type</th>
                    <th>Resolution Status</th>
                    <th>Supervisor Status</th>
                    <th>Created/Reviewed Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="text-center">
                        <div className="spinner-border" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                      </td>
                    </tr>
                  ) : followUps.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center text-muted">
                        No pending follow-ups found
                      </td>
                    </tr>
                  ) : (
                    followUps.map((ticket) => (
                      <tr key={ticket.ticket_id}>
                        <td>{formatTicketId(ticket.ticket_id)}</td>
                        <td>{ticket.customer_phone}</td>
                        <td>{ticket.issue_type || 'N/A'}</td>
                        <td>
                          <Badge bg={ticket.resolution_status === 'Completed' ? 'success' : 'warning'}>
                            {ticket.resolution_status}
                          </Badge>
                        </td>
                        <td>{ticket.supervisor_status}</td>
                        <td>{formatDate(ticket.date)}</td>
                        <td>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleFollowUp(ticket)}
                          >
                            Follow Up
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>

              {/* Pagination */}
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  Showing {followUps.length} of {pagination.total} follow-ups
                </div>
                <div>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    disabled={pagination.page === 1}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  >
                    Previous
                  </Button>
                  <span className="mx-2">
                    Page {pagination.page} of {Math.ceil(pagination.total / pagination.pageSize)}
                  </span>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>

      {/* Follow-Up Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Follow Up for Ticket {selectedTicket ? formatTicketId(selectedTicket.ticket_id) : ''}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Row>
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label>Was your issue solved?</Form.Label>
                  <div>
                    <Form.Check
                      inline
                      type="radio"
                      name="issue_solved"
                      id="issue_solved_yes"
                      label="Yes"
                      checked={formData.issue_solved === 1}
                      onChange={() => setFormData(prev => ({ ...prev, issue_solved: 1 }))}
                    />
                    <Form.Check
                      inline
                      type="radio"
                      name="issue_solved"
                      id="issue_solved_no"
                      label="No"
                      checked={formData.issue_solved === 0}
                      onChange={() => setFormData(prev => ({ ...prev, issue_solved: 0, repeated_issue: 1 }))}
                    />
                  </div>
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label>Customer Location</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Enter customer location"
                    value={formData.customer_location}
                    onChange={(e) => setFormData(prev => ({ ...prev, customer_location: e.target.value }))}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label>Are you satisfied with the resolution?</Form.Label>
                  <div>
                    <Form.Check
                      inline
                      type="radio"
                      name="satisfied"
                      id="satisfied_yes"
                      label="Yes"
                      checked={formData.satisfied === 1}
                      onChange={() => setFormData(prev => ({ ...prev, satisfied: 1 }))}
                      disabled={formData.issue_solved !== 1}
                    />
                    <Form.Check
                      inline
                      type="radio"
                      name="satisfied"
                      id="satisfied_no"
                      label="No"
                      checked={formData.satisfied === 0}
                      onChange={() => setFormData(prev => ({ ...prev, satisfied: 0 }))}
                      disabled={formData.issue_solved !== 1}
                    />
                  </div>
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label>Is this a repeated issue?</Form.Label>
                  <div>
                    <Form.Check
                      inline
                      type="radio"
                      name="repeated_issue"
                      id="repeated_yes"
                      label="Yes"
                      checked={formData.repeated_issue === 1}
                      onChange={() => setFormData(prev => ({ ...prev, repeated_issue: 1 }))}
                    />
                    <Form.Check
                      inline
                      type="radio"
                      name="repeated_issue"
                      id="repeated_no"
                      label="No"
                      checked={formData.repeated_issue === 0}
                      onChange={() => setFormData(prev => ({ ...prev, repeated_issue: 0 }))}
                    />
                  </div>
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label>Follow-up Notes</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    placeholder="Additional notes about the follow-up..."
                    value={formData.follow_up_notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, follow_up_notes: e.target.value }))}
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" type="submit">
              Submit Follow-Up
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default FollowUpsPage;