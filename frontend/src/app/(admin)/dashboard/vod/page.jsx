import { Col, Row } from 'react-bootstrap';
import PageMetaData from '@/components/PageTitle';

export default function VODDashboard() {
  return (
    <>
      <PageMetaData title="VOD Dashboard" />
      
      <Row>
        <Col>
          <div className="card">
            <div className="card-body text-center">
              <h1 className="display-4 mb-4">VOD Dashboard</h1>
              <p className="lead">
                Video-on-demand content management, viewership analytics, and library insights.
              </p>
              <p className="text-muted">
                This page will contain video library statistics, viewer engagement metrics, content performance, and streaming analytics.
              </p>
            </div>
          </div>
        </Col>
      </Row>
    </>
  );
}
