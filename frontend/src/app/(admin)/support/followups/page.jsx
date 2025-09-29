import { Col, Row } from 'react-bootstrap';
import PageMetaData from '@/components/PageTitle';

export default function FollowUps() {
  return (
    <>
      <PageMetaData title="Follow-ups" />
      
      <Row>
        <Col>
          <div className="card">
            <div className="card-body text-center">
              <h1 className="display-4 mb-4">Follow-ups</h1>
              <p className="lead">
                Customer follow-up management and relationship tracking.
              </p>
              <p className="text-muted">
                This page will contain follow-up schedules, customer communication history, and relationship management tools.
              </p>
            </div>
          </div>
        </Col>
      </Row>
    </>
  );
}
