import { useState, useEffect } from 'react';
import { Card, Row, Col, Tab, Nav, Form, Table, Button, Badge, Alert, Spinner } from 'react-bootstrap';
import PageMetaData from '@/components/PageTitle';
import { RequirePerm } from '@/components/auth/ProtectedRoute';
import { managementApi, accessApi } from '@/lib/api';
import { useNotificationContext } from '@/context/useNotificationContext';
import IconifyIcon from '@/components/wrappers/IconifyIcon';

const PermissionsPage = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [extraPermissions, setExtraPermissions] = useState([]);
  const [deniedPermissions, setDeniedPermissions] = useState([]);
  const [homeRoute, setHomeRoute] = useState('');
  const [pageAccess, setPageAccess] = useState([]);
  const [departmentRestrictions, setDepartmentRestrictions] = useState([]);
  const [sectionRestrictions, setSectionRestrictions] = useState([]);
  const [activeTab, setActiveTab] = useState('users');
  
  const { showNotification } = useNotificationContext();

  const loadUsers = async () => {
    try {
      const response = await managementApi.getUsers({ page: 1, limit: 100 });
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadPermissions = async () => {
    try {
      const response = await accessApi.getPermissions();
      setPermissions(response.data);
    } catch (error) {
      console.error('Failed to load permissions:', error);
    }
  };

  const loadRoles = async () => {
    try {
      const response = await accessApi.getRoles();
      setRoles(response.data);
    } catch (error) {
      console.error('Failed to load roles:', error);
    }
  };

  const loadDepartments = async () => {
    try {
      const response = await managementApi.getDepartments({ page: 1, limit: 100 });
      setDepartments(response.data);
    } catch (error) {
      console.error('Failed to load departments:', error);
    }
  };

  const loadSections = async () => {
    try {
      const response = await managementApi.getSections({ page: 1, limit: 100 });
      setSections(response.data);
    } catch (error) {
      console.error('Failed to load sections:', error);
    }
  };

  const loadUserAccess = async (userId) => {
    try {
      const response = await accessApi.getUserAccess(userId);
      const access = response.data.access;
      
      // Combine role permissions and extra permissions for individual display
      const allPermissions = [
        ...(access.permsExtra || []),
        // Get permissions from roles and add them too
        ...((access.roles || []).flatMap(roleKey => {
          const role = roles.find(r => r.key === roleKey);
          return role ? role.permissions : [];
        }))
      ];
      
      setSelectedRoles(access.roles || []);
      setExtraPermissions([...new Set(allPermissions)]); // Remove duplicates
      setDeniedPermissions(access.permsDenied || []);
      setHomeRoute(access.homeRoute || '');
      setPageAccess(access.pageAccess || []);
      setDepartmentRestrictions(access.departmentRestrictions?.map(d => d._id) || []);
      setSectionRestrictions(access.sectionRestrictions?.map(s => s._id) || []);
    } catch (error) {
      console.error('Failed to load user access:', error);
    }
  };

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    loadUserAccess(user._id);
  };

  const handleSaveAccess = async () => {
    if (!selectedUser) return;
    
    try {
      setSaving(true);
      const accessData = {
        roles: [], // No longer using roles, using individual permissions
        permsExtra: extraPermissions, // This now contains all selected permissions
        permsDenied: deniedPermissions,
        homeRoute: homeRoute || undefined,
        pageAccess: [], // Simplified - no complex page rules
        departmentRestrictions: departmentRestrictions,
        sectionRestrictions: sectionRestrictions
      };
      
      await accessApi.updateUserAccess(selectedUser._id, accessData);
      showNotification({
        message: 'User access updated successfully',
        variant: 'success'
      });
    } catch (error) {
      showNotification({
        message: error.message,
        variant: 'danger'
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = (roleKey) => {
    setSelectedRoles(prev => 
      prev.includes(roleKey) 
        ? prev.filter(r => r !== roleKey)
        : [...prev, roleKey]
    );
  };

  const toggleExtraPermission = (permKey) => {
    setExtraPermissions(prev => 
      prev.includes(permKey) 
        ? prev.filter(p => p !== permKey)
        : [...prev, permKey]
    );
  };

  const addPageAccessRule = () => {
    setPageAccess(prev => [...prev, {
      permission: '',
      allowedPages: [],
      maxPages: undefined,
      sectionsAllowed: []
    }]);
  };

  const updatePageAccessRule = (index, field, value) => {
    setPageAccess(prev => prev.map((rule, i) => 
      i === index ? { ...rule, [field]: value } : rule
    ));
  };

  const removePageAccessRule = (index) => {
    setPageAccess(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadUsers(), loadPermissions(), loadRoles(), loadDepartments(), loadSections()]);
      setLoading(false);
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <RequirePerm perm="management.permissions">
        <PageMetaData title="Access Control" />
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      </RequirePerm>
    );
  }

  return (
    <RequirePerm perm="management.permissions">
      <PageMetaData title="Access Control" />
      
      <div className="container-fluid">
        <Row>
          <Col>
            <Card>
              <Card.Header>
                <h4 className="card-title mb-0">Access Control & Permissions</h4>
              </Card.Header>
              
              <Card.Body>
                <Tab.Container activeKey={activeTab} onSelect={setActiveTab}>
                  <Nav variant="tabs" className="mb-3">
                    <Nav.Item>
                      <Nav.Link eventKey="users">User Access</Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                      <Nav.Link eventKey="registry">Permission Registry</Nav.Link>
                    </Nav.Item>
                  </Nav>

                  <Tab.Content>
                    <Tab.Pane eventKey="users">
                      <Row>
                        <Col md={4}>
                          <Card>
                            <Card.Header>
                              <h6 className="mb-0">Select User</h6>
                            </Card.Header>
                            <Card.Body className="p-0" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                              {users.map((user) => (
                                <div
                                  key={user._id}
                                  className={`p-3 border-bottom cursor-pointer ${selectedUser?._id === user._id ? 'bg-light' : ''}`}
                                  onClick={() => handleUserSelect(user)}
                                  style={{ cursor: 'pointer' }}
                                >
                                  <strong>{user.username}</strong>
                                  <div className="text-muted small">{user.email}</div>
                                </div>
                              ))}
                            </Card.Body>
                          </Card>
                        </Col>

                        <Col md={8}>
                          {selectedUser ? (
                            <Card>
                              <Card.Header className="d-flex justify-content-between align-items-center">
                                <div>
                                  <h6 className="mb-0">Access Configuration</h6>
                                  <small className="text-muted">{selectedUser.username}</small>
                                </div>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={handleSaveAccess}
                                  disabled={saving}
                                >
                                  {saving ? 'Saving...' : 'Save Changes'}
                                </Button>
                              </Card.Header>
                              
                              <Card.Body>
                                <Row>
                                  <Col>
                                    <h6>Page Access Permissions</h6>
                                    <p className="text-muted small">Select individual pages this user can access</p>
                                    
                                    {permissions.map(permission => (
                                      <Form.Check
                                        key={permission.key}
                                        type="checkbox"
                                        id={`perm-${permission.key}`}
                                        label={`${permission.label} ${permission.group ? `(${permission.group})` : ''}`}
                                        checked={extraPermissions.includes(permission.key)}
                                        onChange={() => toggleExtraPermission(permission.key)}
                                        className="mb-2"
                                      />
                                    ))}

                                    <h6 className="mt-3">Home Route</h6>
                                    <Form.Control
                                      type="text"
                                      placeholder="e.g., /dashboard/admin"
                                      value={homeRoute}
                                      onChange={(e) => setHomeRoute(e.target.value)}
                                      size="sm"
                                    />


                                    <h6 className="mt-3">Department Restrictions</h6>
                                    <Form.Select
                                      size="sm"
                                      multiple
                                      value={departmentRestrictions}
                                      onChange={(e) => {
                                        const selected = Array.from(e.target.selectedOptions, option => option.value);
                                        setDepartmentRestrictions(selected);
                                      }}
                                    >
                                      {departments.map(dept => (
                                        <option key={dept._id} value={dept._id}>
                                          {dept.name}
                                        </option>
                                      ))}
                                    </Form.Select>
                                    <Form.Text className="text-muted">
                                      Hold Ctrl/Cmd to select multiple departments
                                    </Form.Text>

                                    <h6 className="mt-3">Section Restrictions</h6>
                                    <Form.Select
                                      size="sm"
                                      multiple
                                      value={sectionRestrictions}
                                      onChange={(e) => {
                                        const selected = Array.from(e.target.selectedOptions, option => option.value);
                                        setSectionRestrictions(selected);
                                      }}
                                    >
                                      {sections.map(section => (
                                        <option key={section._id} value={section._id}>
                                          {section.departmentId?.name} - {section.name}
                                        </option>
                                      ))}
                                    </Form.Select>
                                    <Form.Text className="text-muted">
                                      Hold Ctrl/Cmd to select multiple sections
                                    </Form.Text>
                                  </Col>
                                </Row>
                              </Card.Body>
                            </Card>
                          ) : (
                            <Card>
                              <Card.Body className="text-center py-5">
                                <h5>Select a User</h5>
                                <p className="text-muted">Choose a user to manage their permissions</p>
                              </Card.Body>
                            </Card>
                          )}
                        </Col>
                      </Row>
                    </Tab.Pane>

                    <Tab.Pane eventKey="registry">
                      <Card>
                        <Card.Header>
                          <h6 className="mb-0">Permission Registry</h6>
                        </Card.Header>
                        <Card.Body>
                          <Table responsive hover>
                            <thead>
                              <tr>
                                <th>Permission Key</th>
                                <th>Label</th>
                                <th>Group</th>
                              </tr>
                            </thead>
                            <tbody>
                              {permissions.map((perm) => (
                                <tr key={perm.key}>
                                  <td><code>{perm.key}</code></td>
                                  <td>{perm.label}</td>
                                  <td>
                                    {perm.group && <Badge bg="secondary">{perm.group}</Badge>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </Card.Body>
                      </Card>
                    </Tab.Pane>
                  </Tab.Content>
                </Tab.Container>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>
    </RequirePerm>
  );
};

export default PermissionsPage;