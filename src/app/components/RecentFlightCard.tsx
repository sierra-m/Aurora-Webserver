import React from 'react';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Image from 'react-bootstrap/Image';
import type {RedactedModem} from "../../server/types/util.ts";
import dayjs from "dayjs";
import {chooseRandomIcon} from "../util/balloonIcons";
import '../style/recentflightcard.css';

export interface RecentFlightCardProps {
  uid: string;
  modem: RedactedModem;
  startDate: dayjs.Dayjs;
  callback: () => void;
}

const RecentFlightCard = (props: RecentFlightCardProps) => {
  return (
    <a style={{cursor: 'pointer'}} onClick={props.callback}>
      <Card className={'quick-shadow recent-flight-card'} border={'primary'}>
        <Card.Body>
          <Row className="align-items-center">
            <Col xs={2}>
              <Image width={40} height={40} src={chooseRandomIcon(props.uid)} alt={'Recent Flight Balloon Icon'}/>
            </Col>
            <Col xs={5}>
              <strong>{props.modem.name}</strong>
            </Col>
            <Col>
              <p className={'text-primary mb-0'}>{props.startDate.format("YYYY-MM-DD")}</p>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </a>
  );
};

export default React.memo(RecentFlightCard);