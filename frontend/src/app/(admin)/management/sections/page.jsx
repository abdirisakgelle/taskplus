import { useState, useEffect } from 'react';
import { Button, Card, Modal, Form, Table, Alert, Spinner, Row, Col } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import PageMetaData from '@/components/PageTitle';
import { RequirePerm } from '@/components/auth/ProtectedRoute';
import { managementApi } from '@/lib/api';
import { useNotificationContext } from '@/context/useNotificationContext';
import IconifyIcon from '@/components/wrappers/IconifyIcon';

const sectionSchema = yup.object({
  departmentId: yup.string().required('Department is required'),
  name: yup.string().min(2, 'Name must be at least 2 characters').required('Name is required')
});

const SectionsPage = () => {
  const [sections, setSections] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [filters, setFilters] = useState({ departmentId: '' });
  
  const { showNotification } = useNotificationContext();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: yupResolver(sectionSchema),
    defaultValues: { departmentId: '', name: '' }
  });

  const loadDepartments = async () => {
    try {
      const response = await managementApi.getDepartments({ page: 1, limit: 100 });
      setDepartments(response.data);
    } catch (error) {
      console.error('Failed to load departments:', error);
    }
  };

  const loadSections = async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: pagination.limit };
      if (filters.departmentId) {
        params.departmentId = filters.departmentId;
      }
      
      const response = await managementApi.getSections(params);
      setSections(response.data);
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
      if (editingSection) {
        await managementApi.updateSection(editingSection._id, data);
        showNotification({
          message: 'Section updated successfully',
          variant: 'success'
        });
      } else {
        await managementApi.createSection(data);
        showNotification({
          message: 'Section created successfully',
          variant: 'success'
        });
      }
      
      setShowModal(false);
      setEditingSection(null);
      reset();
      loadSections(pagination.page);
    } catch (error) {
      showNotification({
        message: error.message,
        variant: 'danger'
      });
    }
  };

  const handleEdit = (section) => {
    setEditingSection(section);
    setValue('departmentId', section.departmentId._id);
    setValue('name', section.name);
    setShowModal(true);
  };

  const handleDelete = async (section) => {
    try {
      await managementApi.deleteSection(section._id);
      showNotification({
        message: 'Section deleted successfully',
        variant: 'success'
      });
      setDeleteConfirm(null);
      loadSections(pagination.page);
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
    setEditingSection(null);
    reset();
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    loadSections();
  }, [filters.departmentId]);

  return (
    <RequirePerm perm="management.sections">
      <PageMetaData title="Sections" />
      
      <div className="container-fluid">
        <Row>
          <Col>
            <Card>
              <Card.Header>
                <Row className="align-items-center">
                  <Col>
                    <h4 className="card-title mb-0">Sections</h4>
                  </Col>
                  <Col xs="auto">
                    <Button 
                      variant="primary" 
                      onClick={() => setShowModal(true)}
                      size="sm"
                    >
                      <IconifyIcon icon="solar:add-circle-broken" className="me-1" />
                      Add Section
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
                          <th>Department</th>
                          <th>Section Name</th>
                          <th>Created</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sections.map((section) => (
                          <tr key={section._id}>
                            <td>
                              <span className="badge bg-primary-subtle text-primary">
                                {section.departmentId?.name || 'Unknown'}
                              </span>
                            </td>
                            <td>{section.name}</td>
                            <td>{new Date(section.createdAt).toLocaleDateString()}</td>
                            <td>
                              <Button
                                variant="outline-primary"
                                size="sm"
                                className="me-1"
                                onClick={() => handleEdit(section)}
                              >
                                <IconifyIcon icon="solar:pen-broken" />
                              </Button>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => setDeleteConfirm(section)}
                              >
                                <IconifyIcon icon="solar:trash-bin-minimalistic-broken" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>

                    {sections.length === 0 && (
                      <div className="text-center py-4">
                        <p className="text-muted">
                          {filters.departmentId ? 'No sections found in selected department' : 'No sections found'}
                        </p>
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
      <Modal show={showModal} onHide={handleCloseModal}>
        <Modal.Header closeButton>
          <Modal.Title>
            {editingSection ? 'Edit Section' : 'Add Section'}
          </Modal.Title>
        </Modal.Header>
        
        <Form onSubmit={handleSubmit(handleSave)}>
          <Modal.Body>
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

            <Form.Group className="mb-3">
              <Form.Label>Section Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter section name"
                {...register('name')}
                isInvalid={!!errors.name}
              />
              <Form.Control.Feedback type="invalid">
                {errors.name?.message}
              </Form.Control.Feedback>
            </Form.Group>
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
                editingSection ? 'Update' : 'Create'
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
            Are you sure you want to delete "{deleteConfirm?.name}" from {deleteConfirm?.departmentId?.name}?
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

export default SectionsPage;