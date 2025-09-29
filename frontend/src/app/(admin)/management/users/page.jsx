import { useState, useEffect } from 'react';
import { Button, Card, Modal, Form, Table, Alert, Spinner, Row, Col, Badge } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import PageMetaData from '@/components/PageTitle';
import { RequirePerm } from '@/components/auth/ProtectedRoute';
import { managementApi } from '@/lib/api';
import { useNotificationContext } from '@/context/useNotificationContext';
import IconifyIcon from '@/components/wrappers/IconifyIcon';

const userCreateSchema = yup.object({
  username: yup.string().min(3, 'Username must be at least 3 characters').required('Username is required'),
  email: yup.string().email('Invalid email format').required('Email is required'),
  password: yup.string().min(8, 'Password must be at least 8 characters').required('Password is required'),
  confirmPassword: yup.string()
    .oneOf([yup.ref('password')], 'Passwords must match')
    .required('Confirm password is required'),
  employeeId: yup.string().required('Employee is required')
});

const userUpdateSchema = yup.object({
  username: yup.string().min(3, 'Username must be at least 3 characters').required('Username is required'),
  email: yup.string().email('Invalid email format').required('Email is required'),
  password: yup.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: yup.string().when('password', {
    is: (password) => password && password.length > 0,
    then: (schema) => schema.oneOf([yup.ref('password')], 'Passwords must match').required('Confirm password is required'),
    otherwise: (schema) => schema.notRequired()
  }),
  status: yup.string().oneOf(['active', 'disabled'], 'Invalid status')
});

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [unassignedEmployees, setUnassignedEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [filters, setFilters] = useState({ status: '', q: '' });
  
  const { showNotification } = useNotificationContext();

  const isEditing = !!editingUser;
  const schema = isEditing ? userUpdateSchema : userCreateSchema;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { 
      username: '', 
      email: '', 
      password: '', 
      confirmPassword: '',
      employeeId: '',
      status: 'active'
    }
  });

  const loadUnassignedEmployees = async () => {
    try {
      const response = await managementApi.getUnassignedEmployees();
      setUnassignedEmployees(response.data);
    } catch (error) {
      console.error('Failed to load unassigned employees:', error);
    }
  };

  const loadUsers = async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: pagination.limit };
      if (filters.status) params.status = filters.status;
      if (filters.q) params.q = filters.q;
      
      const response = await managementApi.getUsers(params);
      setUsers(response.data);
      setPagination(prev => ({ ...prev, ...response.meta }));
    } catch (error) {
      showNotification({
        message: error.message,
        variant: 'danger'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data) => {
    try {
      const submitData = { ...data };
      delete submitData.confirmPassword; // Remove confirm password from submission

      if (editingUser) {
        // Remove empty password for updates
        if (!submitData.password) {
          delete submitData.password;
        }
        await managementApi.updateUser(editingUser._id, submitData);
        showNotification({
          message: 'User updated successfully',
          variant: 'success'
        });
      } else {
        await managementApi.createUser(submitData);
        showNotification({
          message: 'User created successfully',
          variant: 'success'
        });
      }
      
      setShowModal(false);
      setEditingUser(null);
      reset();
      loadUsers(pagination.page);
    } catch (error) {
      showNotification({
        message: error.message,
        variant: 'danger'
      });
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setValue('username', user.username);
    setValue('email', user.email);
    setValue('status', user.status);
    setValue('password', '');
    setValue('confirmPassword', '');
    setShowModal(true);
  };

  const handleDelete = async (user) => {
    try {
      await managementApi.deleteUser(user._id);
      showNotification({
        message: 'User deleted successfully',
        variant: 'success'
      });
      setDeleteConfirm(null);
      loadUsers(pagination.page);
    } catch (error) {
      showNotification({
        message: error.message,
        variant: 'danger'
      });
      setDeleteConfirm(null);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
    reset();
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'disabled': return 'danger';
      default: return 'secondary';
    }
  };

  useEffect(() => {
    if (showModal && !editingUser) {
      loadUnassignedEmployees();
    }
  }, [showModal, editingUser]);

  useEffect(() => {
    loadUsers();
  }, [filters.status, filters.q]);

  return (
    <RequirePerm perm="management.users">
      <PageMetaData title="Users" />
      
      <div className="container-fluid">
        <Row>
          <Col>
            <Card>
              <Card.Header>
                <Row className="align-items-center">
                  <Col>
                    <h4 className="card-title mb-0">Users</h4>
                  </Col>
                  <Col xs="auto">
                    <Button 
                      variant="primary" 
                      onClick={() => setShowModal(true)}
                      size="sm"
                    >
                      <IconifyIcon icon="solar:add-circle-broken" className="me-1" />
                      Add User
                    </Button>
                  </Col>
                </Row>
              </Card.Header>
              
              <Card.Body>
                {/* Filters */}
                <Row className="mb-3">
                  <Col md={4}>
                    <Form.Label>Filter by Status</Form.Label>
                    <Form.Select
                      value={filters.status}
                      onChange={(e) => handleFilterChange('status', e.target.value)}
                    >
                      <option value="">All Status</option>
                      <option value="active">Active</option>
                      <option value="disabled">Disabled</option>
                    </Form.Select>
                  </Col>
                  <Col md={4}>
                    <Form.Label>Search</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Search username or email..."
                      value={filters.q}
                      onChange={(e) => handleFilterChange('q', e.target.value)}
                    />
                  </Col>
                </Row>

                {loading ? (
                  <div className="text-center py-4">
                    <Spinner animation="border" />
                  </div>
                ) : (
                  <>
                    <Table responsive hover>
                      <thead>
                        <tr>
                          <th>Username</th>
                          <th>Email</th>
                          <th>Employee</th>
                          <th>Status</th>
                          <th>Last Login</th>
                          <th>Created</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr key={user._id}>
                            <td>
                              <strong>{user.username}</strong>
                            </td>
                            <td>{user.email}</td>
                            <td>
                              {user.employeeId ? (
                                <div>
                                  <div>{user.employeeId.name}</div>
                                  <small className="text-muted">
                                    {user.employeeId.departmentId?.name} • {user.employeeId.sectionId?.name}
                                  </small>
                                </div>
                              ) : (
                                <span className="text-muted">No employee linked</span>
                              )}
                            </td>
                            <td>
                              <Badge bg={getStatusBadgeVariant(user.status)}>
                                {user.status}
                              </Badge>
                            </td>
                            <td>
                              {user.lastLogin ? (
                                new Date(user.lastLogin).toLocaleDateString()
                              ) : (
                                <span className="text-muted">Never</span>
                              )}
                            </td>
                            <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                            <td>
                              <Button
                                variant="outline-primary"
                                size="sm"
                                className="me-1"
                                onClick={() => handleEdit(user)}
                              >
                                <IconifyIcon icon="solar:pen-broken" />
                              </Button>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => setDeleteConfirm(user)}
                              >
                                <IconifyIcon icon="solar:trash-bin-minimalistic-broken" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>

                    {users.length === 0 && (
                      <div className="text-center py-4">
                        <p className="text-muted">No users found</p>
                      </div>
                    )}
                  </>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>

      {/* Add/Edit Modal */}
      <Modal show={showModal} onHide={handleCloseModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {editingUser ? 'Edit User' : 'Add User'}
          </Modal.Title>
        </Modal.Header>
        
        <Form onSubmit={handleSubmit(handleSave)}>
          <Modal.Body>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Username</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Enter username"
                    {...register('username')}
                    isInvalid={!!errors.username}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.username?.message}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    placeholder="Enter email"
                    {...register('email')}
                    isInvalid={!!errors.email}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.email?.message}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Password {editingUser && '(leave blank to keep current)'}</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder="Enter password"
                    {...register('password')}
                    isInvalid={!!errors.password}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.password?.message}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Confirm Password</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder="Confirm password"
                    {...register('confirmPassword')}
                    isInvalid={!!errors.confirmPassword}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.confirmPassword?.message}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
            </Row>

            <Row>
              {!editingUser && (
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Employee</Form.Label>
                    <Form.Select
                      {...register('employeeId')}
                      isInvalid={!!errors.employeeId}
                    >
                      <option value="">Select Employee</option>
                      {unassignedEmployees.map((employee) => (
                        <option key={employee._id} value={employee._id}>
                          {employee.name} - {employee.departmentId?.name} • {employee.sectionId?.name}
                        </option>
                      ))}
                    </Form.Select>
                    <Form.Control.Feedback type="invalid">
                      {errors.employeeId?.message}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
              )}
              {editingUser && (
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Status</Form.Label>
                    <Form.Select
                      {...register('status')}
                      isInvalid={!!errors.status}
                    >
                      <option value="active">Active</option>
                      <option value="disabled">Disabled</option>
                    </Form.Select>
                    <Form.Control.Feedback type="invalid">
                      {errors.status?.message}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
              )}
            </Row>

            {!editingUser && unassignedEmployees.length === 0 && (
              <Alert variant="warning">
                <IconifyIcon icon="solar:info-circle-broken" className="me-2" />
                No unassigned employees available. All employees already have user accounts.
              </Alert>
            )}
          </Modal.Body>
          
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button 
              variant="primary" 
              type="submit" 
              disabled={isSubmitting || (!editingUser && unassignedEmployees.length === 0)}
            >
              {isSubmitting ? (
                <>
                  <Spinner animation="border" size="sm" className="me-1" />
                  Saving...
                </>
              ) : (
                editingUser ? 'Update' : 'Create'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal show={!!deleteConfirm} onHide={() => setDeleteConfirm(null)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="warning">
            <IconifyIcon icon="solar:danger-triangle-broken" className="me-2" />
            Are you sure you want to delete user "{deleteConfirm?.username}"?
            <br />
            <small>This action cannot be undone.</small>
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
            Cancel
          </Button>
          <Button 
            variant="danger" 
            onClick={() => handleDelete(deleteConfirm)}
          >
            Delete
          </Button>
        </Modal.Footer>
      </Modal>
    </RequirePerm>
  );
};

export default UsersPage;