import { useState, useEffect } from 'react';
import { Col, Row, Card, Button, Badge, Form, Table, Spinner, Alert } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import PageMetaData from '@/components/PageTitle';
import { supportApi, managementApi } from '@/lib/api';
import { useAuth } from '@/lib/simpleAuth';

const Reviews = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  // Filters
  const [filters, setFilters] = useState({
    reviewer_id: searchParams.get('reviewer') || '',
    resolved: searchParams.get('resolved') || '',
    date: searchParams.get('date') || ''
  });


  // Load reviews
  const loadReviews = async () => {
    try {
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
      
      const response = await supportApi.getReviews(params);
      setReviews(response.data || []);
      setPagination(prev => ({
        ...prev,
        total: response.meta?.total || 0
      }));
    } catch (err) {
      setError(err.message);
      throw err;
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
    const loadData = async () => {
      setLoading(true);
      try {
        await loadReviews();
        await loadEmployees();
      } catch (err) {
        console.error('Error loading data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [filters, pagination.page]);

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


  const handleResolveReview = async (reviewId) => {
    try {
      const result = await Swal.fire({
        title: 'Resolve Review',
        text: 'Mark resolved after QA check?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, mark as resolved!',
        cancelButtonText: 'Cancel',
        input: 'select',
        inputOptions: {
          'true': 'Resolved',
          'false': 'Not Resolved'
        },
        inputValue: 'true',
        input2: 'textarea',
        input2Label: 'Additional Notes',
        input2Placeholder: 'Enter any additional notes...'
      });

      if (result.isConfirmed) {
        await supportApi.resolveReview(reviewId, {
          resolved: result.value === 'true',
          notes: result.value2 || ''
        });
        
        Swal.fire({
          title: 'Success!',
          text: 'Review resolved successfully.',
          icon: 'success',
          timer: 2000
        });
        
        loadReviews();
      }
    } catch (err) {
      Swal.fire({
        title: 'Error!',
        text: err.message,
        icon: 'error'
      });
    }
  };

  const getResolvedBadge = (resolved) => {
    return (
      <Badge bg={resolved ? 'success' : 'warning'}>
        {resolved ? 'Resolved' : 'Pending'}
      </Badge>
    );
  };


  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <>
      <PageMetaData title="QA Reviews" />
      
      <Row>
        <Col>
          <Card>
            <Card.Header>
              <h4 className="mb-0">QA Reviews</h4>
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
                    <Form.Label>Reviewer</Form.Label>
                    <Form.Select
                      value={filters.reviewer_id}
                      onChange={(e) => handleFilterChange('reviewer_id', e.target.value)}
                    >
                      <option value="">All Reviewers</option>
                      {employees.map(emp => (
                        <option key={emp.employee_id} value={emp.employee_id}>{emp.name}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>Resolved</Form.Label>
                    <Form.Select
                      value={filters.resolved}
                      onChange={(e) => handleFilterChange('resolved', e.target.value)}
                    >
                      <option value="">All Status</option>
                      <option value="true">Resolved</option>
                      <option value="false">Not Resolved</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>Date</Form.Label>
                    <Form.Control
                      type="date"
                      value={filters.date}
                      onChange={(e) => handleFilterChange('date', e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>

              {/* Reviews Table */}
              {reviews.length === 0 ? (
                <Alert variant="info" className="text-center">
                  No reviews found. Try adjusting your filters.
                </Alert>
              ) : (
                <Table responsive striped hover>
                  <thead>
                    <tr>
                      <th>Review ID</th>
                      <th>Ticket ID</th>
                      <th>Reviewer</th>
                      <th>Date</th>
                      <th>Issue Status</th>
                      <th>Resolved</th>
                      <th>Notes</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviews.map(review => (
                      <tr key={review.review_id}>
                        <td>{review.review_id}</td>
                        <td>
                          <Button 
                            variant="link" 
                            size="sm"
                            onClick={() => window.open(`/support/tickets/${review.ticket_id}`, '_blank')}
                          >
                            #{review.ticket_id}
                          </Button>
                        </td>
                        <td>{review.reviewer_info?.name || '-'}</td>
                        <td>{new Date(review.review_date).toLocaleDateString()}</td>
                        <td>{review.issue_status}</td>
                        <td>{getResolvedBadge(review.resolved)}</td>
                        <td>
                          <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {review.notes || '-'}
                          </div>
                        </td>
                        <td>
                          {!review.resolved && (
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() => handleResolveReview(review.review_id)}
                            >
                              Resolve
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}

              {/* Pagination */}
              {pagination.total > 0 && (
                <div className="d-flex justify-content-between align-items-center mt-3">
                  <div>
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} reviews
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

    </>
  );
};

export default Reviews;