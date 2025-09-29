import { Col, Row } from 'react-bootstrap';
import PageMetaData from '@/components/PageTitle';

export default function SystemSettings() {
  return (
    <>
      <PageMetaData title="System Settings" />
      
      <Row>
        <Col>
          <div className="card">
            <div className="card-body text-center">
              <h1 className="display-4 mb-4">System Settings</h1>
              <p className="lead">
                System-wide configuration and administrative settings.
              </p>
              <p className="text-muted">
                This page will contain system configuration, global settings, feature toggles, and administrative controls.
              </p>
            </div>
          </div>
        </Col>
      </Row>
    </>
  );
}
