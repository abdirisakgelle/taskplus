import { useState, useEffect } from 'react';
import { Button, Card, Modal, Form, Table, Alert, Spinner } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import PageMetaData from '@/components/PageTitle';
import { RequirePerm } from '@/components/auth/ProtectedRoute';
import { managementApi } from '@/lib/api';
import { useNotificationContext } from '@/context/useNotificationContext';
import IconifyIcon from '@/components/wrappers/IconifyIcon';

const departmentSchema = yup.object({
  name: yup.string().min(2, 'Name must be at least 2 characters').required('Name is required')
});

const DepartmentsPage = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  
  const { showNotification } = useNotificationContext();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: yupResolver(departmentSchema),
    defaultValues: { name: '' }
  });

  const loadDepartments = async (page = 1) => {
    try {
      setLoading(true);
      const response = await managementApi.getDepartments({ page, limit: pagination.limit });
      setDepartments(response.data);
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
      if (editingDepartment) {
        await managementApi.updateDepartment(editingDepartment._id, data);
        showNotification({
          message: 'Department updated successfully',
          variant: 'success'
        });
      } else {
        await managementApi.createDepartment(data);
        showNotification({
          message: 'Department created successfully',
          variant: 'success'
        });
      }
      
      setShowModal(false);
      setEditingDepartment(null);
      reset();
      loadDepartments(pagination.page);
    } catch (error) {
      showNotification({
        message: error.message,
        variant: 'danger'
      });
    }
  };

  const handleEdit = (department) => {
    setEditingDepartment(department);
    setValue('name', department.name);
    setShowModal(true);
  };

  const handleDelete = async (department) => {
    try {
      await managementApi.deleteDepartment(department._id);
      showNotification({
        message: 'Department deleted successfully',
        variant: 'success'
      });
      setDeleteConfirm(null);
      loadDepartments(pagination.page);
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
    setEditingDepartment(null);
    reset();
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  return (
    <RequirePerm perm="management.departments">
      <PageMetaData title="Departments" />
      
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <Card>
              <Card.Header className="d-flex justify-content-between align-items-center">
                <h4 className="card-title mb-0">Departments</h4>
                <Button 
                  variant="primary" 
                  onClick={() => setShowModal(true)}
                  size="sm"
                >
                  <IconifyIcon icon="solar:add-circle-broken" className="me-1" />
                  Add Department
                </Button>
              </Card.Header>
              
              <Card.Body>
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
                          <th>Created</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {departments.map((department) => (
                          <tr key={department._id}>
                            <td>{department.name}</td>
                            <td>{new Date(department.createdAt).toLocaleDateString()}</td>
                            <td>
                              <Button
                                variant="outline-primary"
                                size="sm"
                                className="me-1"
                                onClick={() => handleEdit(department)}
                              >
                                <IconifyIcon icon="solar:pen-broken" />
                              </Button>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => setDeleteConfirm(department)}
                              >
                                <IconifyIcon icon="solar:trash-bin-minimalistic-broken" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>

                    {departments.length === 0 && (
                      <div className="text-center py-4">
                        <p className="text-muted">No departments found</p>
                      </div>
                    )}
                  </>
                )}
              </Card.Body>
            </Card>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal show={showModal} onHide={handleCloseModal}>
        <Modal.Header closeButton>
          <Modal.Title>
            {editingDepartment ? 'Edit Department' : 'Add Department'}
          </Modal.Title>
        </Modal.Header>
        
        <Form onSubmit={handleSubmit(handleSave)}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Department Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter department name"
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
                editingDepartment ? 'Update' : 'Create'
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

export default DepartmentsPage;