import { Col, Row } from 'react-bootstrap';
import PageMetaData from '@/components/PageTitle';
import Conversions from './components/Conversions';
import SessionByBrowser from './components/SessionByBrowser';
import Stats from './components/Stats';
import TopPages from './components/TopPages';
export default function Home() {
  return <>
      <PageMetaData title="Analytics" />

      <Stats />
      <Row>
        <Col>
          <Conversions />
        </Col>
      </Row>
      <Row>
        <Col lg={6}>
          <SessionByBrowser />
        </Col>
        <Col lg={6}>
          <TopPages />
        </Col>
      </Row>
    </>;
}