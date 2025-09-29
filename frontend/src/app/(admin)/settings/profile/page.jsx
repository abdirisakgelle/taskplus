import { Col, Row } from 'react-bootstrap';
import PageMetaData from '@/components/PageTitle';

export default function Profile() {
  return (
    <>
      <PageMetaData title="Profile" />
      
      <Row>
        <Col>
          <div className="card">
            <div className="card-body text-center">
              <h1 className="display-4 mb-4">Profile</h1>
              <p className="lead">
                Personal profile management and account preferences.
              </p>
              <p className="text-muted">
                This page will contain user profile settings, personal information, preferences, and account customization options.
              </p>
            </div>
          </div>
        </Col>
      </Row>
    </>
  );
}
