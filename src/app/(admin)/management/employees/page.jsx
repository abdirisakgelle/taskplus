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

const employeeSchema = yup.object({
  name: yup.string().min(2, 'Name must be at least 2 characters').required('Name is required'),
  shift: yup.string().oneOf(['Morning', 'Afternoon', 'Night'], 'Invalid shift'),
  title: yup.string(),
  phone: yup.string(),
  departmentId: yup.string().required('Department is required'),
  sectionId: yup.string().required('Section is required')
});

const EmployeesPage = () => {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [filters, setFilters] = useState({ departmentId: '', sectionId: '' });
  
  const { showNotification } = useNotificationContext();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: yupResolver(employeeSchema),
    defaultValues: { 
      name: '', 
      shift: '', 
      title: '', 
      phone: '', 
      departmentId: '', 
      sectionId: '' 
    }
  });

  const watchDepartmentId = watch('departmentId');

  const loadDepartments = async () => {
    try {
      const response = await managementApi.getDepartments({ page: 1, limit: 100 });
      setDepartments(response.data);
    } catch (error) {
      console.error('Failed to load departments:', error);
    }
  };

  const loadSections = async (departmentId = null) => {
    if (!departmentId) {
      setSections([]);
      return;
    }
    
    try {
      const response = await managementApi.getSections({ departmentId, page: 1, limit: 100 });
      setSections(response.data);
    } catch (error) {
      console.error('Failed to load sections:', error);
      setSections([]);
    }
  };

  const loadEmployees = async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: pagination.limit };
      if (filters.departmentId) params.departmentId = filters.departmentId;
      if (filters.sectionId) params.sectionId = filters.sectionId;
      
      const response = await managementApi.getEmployees(params);
      setEmployees(response.data);
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
      if (editingEmployee) {
        await managementApi.updateEmployee(editingEmployee._id, data);
        showNotification({
          message: 'Employee updated successfully',
          variant: 'success'
        });
      } else {
        await managementApi.createEmployee(data);
        showNotification({
          message: 'Employee created successfully',
          variant: 'success'
        });
      }
      
      setShowModal(false);
      setEditingEmployee(null);
      reset();
      loadEmployees(pagination.page);
    } catch (error) {
      showNotification({
        message: error.message,
        variant: 'danger'
      });
    }
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setValue('name', employee.name);
    setValue('shift', employee.shift || '');
    setValue('title', employee.title || '');
    setValue('phone', employee.phone || '');
    setValue('departmentId', employee.departmentId._id);
    setValue('sectionId', employee.sectionId._id);
    
    // Load sections for the employee's department
    loadSections(employee.departmentId._id);
    setShowModal(true);
  };

  const handleDelete = async (employee) => {
    try {
      await managementApi.deleteEmployee(employee._id);
      showNotification({
        message: 'Employee deleted successfully',
        variant: 'success'
      });
      setDeleteConfirm(null);
      loadEmployees(pagination.page);
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
    setEditingEmployee(null);
    setSections([]);
    reset();
  };

  const handleFilterChange = async (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    
    // Reset section filter when department changes
    if (key === 'departmentId') {
      setFilters(prev => ({ ...prev, sectionId: '' }));
    }
  };

  const getShiftBadgeVariant = (shift) => {
    switch (shift) {
      case 'Morning': return 'success';
      case 'Afternoon': return 'warning';
      case 'Night': return 'info';
      default: return 'secondary';
    }
  };

  // Load sections when department changes in form
  useEffect(() => {
    if (watchDepartmentId) {
      loadSections(watchDepartmentId);
      setValue('sectionId', ''); // Reset section when department changes
    }
  }, [watchDepartmentId, setValue]);

  // Load sections for filter when department filter changes
  useEffect(() => {
    if (filters.departmentId) {
      loadSections(filters.departmentId);
    }
  }, [filters.departmentId]);

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [filters.departmentId, filters.sectionId]);

  return (
    <RequirePerm perm="management.employees">
      <PageMetaData title="Employees" />
      
      <div className="container-fluid">
        <Row>
          <Col>
            <Card>
              <Card.Header>
                <Row className="align-items-center">
                  <Col>
                    <h4 className="card-title mb-0">Employees</h4>
                  </Col>
                  <Col xs="auto">
                    <Button 
                      variant="primary" 
                      onClick={() => setShowModal(true)}
                      size="sm"
                    >
                      <IconifyIcon icon="solar:add-circle-broken" className="me-1" />
                      Add Employee
                    </Button>
                  </Col>
                </Row>
              </Card.Header>
              
              <Card.Body>
                {/* Filters */}
                <Row className="mb-3">
                  <Col md={4}>
                    <Form.Label>Filter by Department</Form.Label>
                    <Form.Select
                      value={filters.departmentId}
                      onChange={(e) => handleFilterChange('departmentId', e.target.value)}
                    >
                      <option value="">All Departments</option>
                      {departments.map((dept) => (
                        <option key={dept._id} value={dept._id}>
                          {dept.name}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col md={4}>
                    <Form.Label>Filter by Section</Form.Label>
                    <Form.Select
                      value={filters.sectionId}
                      onChange={(e) => handleFilterChange('sectionId', e.target.value)}
                      disabled={!filters.departmentId}
                    >
                      <option value="">All Sections</option>
                      {sections.map((section) => (
                        <option key={section._id} value={section._id}>
                          {section.name}
                        </option>
                      ))}
                    </Form.Select>
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
                          <th>Name</th>
                          <th>Shift</th>
                          <th>Title</th>
                          <th>Department</th>
                          <th>Section</th>
                          <th>Phone</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employees.map((employee) => (
                          <tr key={employee._id}>
                            <td>
                              <div>
                                <strong>{employee.name}</strong>
                                {employee.employee_id && (
                                  <small className="text-muted d-block">ID: {employee.employee_id}</small>
                                )}
                              </div>
                            </td>
                            <td>
                              {employee.shift && (
                                <Badge bg={getShiftBadgeVariant(employee.shift)}>
                                  {employee.shift}
                                </Badge>
                              )}
                            </td>
                            <td>{employee.title || '-'}</td>
                            <td>
                              <span className="badge bg-primary-subtle text-primary">
                                {employee.departmentId?.name || 'Unknown'}
                              </span>
                            </td>
                            <td>
                              <span className="badge bg-secondary-subtle text-secondary">
                                {employee.sectionId?.name || 'Unknown'}
                              </span>
                            </td>
                            <td>{employee.phone || '-'}</td>
                            <td>
                              <Button
                                variant="outline-primary"
                                size="sm"
                                className="me-1"
                                onClick={() => handleEdit(employee)}
                              >
                                <IconifyIcon icon="solar:pen-broken" />
                              </Button>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => setDeleteConfirm(employee)}
                              >
                                <IconifyIcon icon="solar:trash-bin-minimalistic-broken" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>

                    {employees.length === 0 && (
                      <div className="text-center py-4">
                        <p className="text-muted">No employees found</p>
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
            {editingEmployee ? 'Edit Employee' : 'Add Employee'}
          </Modal.Title>
        </Modal.Header>
        
        <Form onSubmit={handleSubmit(handleSave)}>
          <Modal.Body>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Full Name</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Enter full name"
                    {...register('name')}
                    isInvalid={!!errors.name}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.name?.message}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Shift</Form.Label>
                  <Form.Select
                    {...register('shift')}
                    isInvalid={!!errors.shift}
                  >
                    <option value="">Select Shift</option>
                    <option value="Morning">Morning</option>
                    <option value="Afternoon">Afternoon</option>
                    <option value="Night">Night</option>
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">
                    {errors.shift?.message}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Title</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Job title"
                    {...register('title')}
                    isInvalid={!!errors.title}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.title?.message}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Phone</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Phone number"
                    {...register('phone')}
                    isInvalid={!!errors.phone}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.phone?.message}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Department</Form.Label>
                  <Form.Select
                    {...register('departmentId')}
                    isInvalid={!!errors.departmentId}
                  >
                    <option value="">Select Department</option>
                    {departments.map((dept) => (
                      <option key={dept._id} value={dept._id}>
                        {dept.name}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">
                    {errors.departmentId?.message}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Section</Form.Label>
                  <Form.Select
                    {...register('sectionId')}
                    disabled={!watchDepartmentId}
                    isInvalid={!!errors.sectionId}
                  >
                    <option value="">Select Section</option>
                    {sections.map((section) => (
                      <option key={section._id} value={section._id}>
                        {section.name}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">
                    {errors.sectionId?.message}
                  </Form.Control.Feedback>
                  {!watchDepartmentId && (
                    <Form.Text className="text-muted">
                      Select a department first
                    </Form.Text>
                  )}
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button 
              variant="primary" 
              type="submit" 
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Spinner animation="border" size="sm" className="me-1" />
                  Saving...
                </>
              ) : (
                editingEmployee ? 'Update' : 'Create'
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
            Are you sure you want to delete "{deleteConfirm?.name}"?
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

export default EmployeesPage;