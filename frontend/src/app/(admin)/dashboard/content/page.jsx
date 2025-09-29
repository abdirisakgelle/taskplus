import { Col, Row } from 'react-bootstrap';
import PageMetaData from '@/components/PageTitle';

export default function ContentDashboard() {
  return (
    <>
      <PageMetaData title="Content Production Dashboard" />
      
      <Row>
        <Col>
          <div className="card">
            <div className="card-body text-center">
              <h1 className="display-4 mb-4">Content Production</h1>
              <p className="lead">
                Creative workflow overview, production pipeline, and content performance metrics.
              </p>
              <p className="text-muted">
                This page will contain content creation stages, production timelines, creative team workload, and content performance analytics.
              </p>
            </div>
          </div>
        </Col>
      </Row>
    </>
  );
}
