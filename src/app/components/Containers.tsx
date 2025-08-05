/*
* The MIT License (MIT)
*
* Copyright (c) 2024 Sierra MacLeod
*
* Permission is hereby granted, free of charge, to any person obtaining a
* copy of this software and associated documentation files (the "Software"),
* to deal in the Software without restriction, including without limitation
* the rights to use, copy, modify, merge, publish, distribute, sublicense,
* and/or sell copies of the Software, and to permit persons to whom the
* Software is furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in
* all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
* OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
* FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
* DEALINGS IN THE SOFTWARE.
*/

import Card from 'react-bootstrap/Card'
import Form from 'react-bootstrap/Form'
import {type FormControl, Spinner, type TooltipProps} from "react-bootstrap";
import Button from 'react-bootstrap/Button'
import Table from 'react-bootstrap/Table'
import InputGroup from 'react-bootstrap/InputGroup'
import Image from 'react-bootstrap/Image'
import ButtonGroup from 'react-bootstrap/ButtonGroup'
import Dropdown from 'react-bootstrap/Dropdown'
import DropdownButton from 'react-bootstrap/DropdownButton'
import React from 'react'
import dayjs from "dayjs";
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import {displayMetersFeet, displayMpsFps, displayKphMph} from '../util/helpers'
import '../style/containers.css'
import Badge from "react-bootstrap/Badge";
import "bootstrap-icons/font/bootstrap-icons.css";
import type {RedactedModem} from "../../server/types/util";
import type {PagePreferences} from "./Navigation.tsx";
import Tooltip from "react-bootstrap/Tooltip";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";


dayjs.extend(duration);
dayjs.extend(relativeTime);

const openGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://maps.google.com/?q=${lat},${lng}`);
}

export interface SelectedFlightDataProps {
    modem: RedactedModem;
    formattedDate: string;
    formattedDatetime: string;
    duration: string;
    maxAltitude: number;
    minAltitude: number;
    avgGroundSpeed: number;
    maxGroundSpeed: number;
    maxVerticalVelocity: number;
    latitude: number;
    longitude: number;
    altitude: number;
    verticalVelocity: number;
    groundSpeed: number;
    elevation?: number;
    downloadFlight: (format: string) => void;
    isActive: boolean;
    pagePreferences: PagePreferences;
}

export const SelectedFlightData = React.memo((props: SelectedFlightDataProps) => {

  const coordsFormatted = `${props.latitude.toFixed(4)}, ${props.longitude.toFixed(4)}`;

  const [showCopiedTooltip, setShowCopiedTooltip] = React.useState<boolean>(false);

  const copyLocation = React.useCallback(async () => {
      try {
        await navigator.clipboard.writeText(coordsFormatted);
        setShowCopiedTooltip(true);
        setTimeout(() => {
          setShowCopiedTooltip(false);
        }, 2000);
      } catch (err) {
        console.error(err);
      }
  }, [coordsFormatted]);

  const selectDownload = React.useCallback((eventKey: string | null, e: React.SyntheticEvent<unknown>) => {
    if (eventKey) {
      props.downloadFlight(eventKey);
    }
  }, [props.downloadFlight])

  const renderCopiedTooltip = React.useCallback((props: TooltipProps) => (
    <Tooltip id="copy-tooltip" {...props}>
      Copied!
    </Tooltip>
  ), []);

  return (
    <div>
      <Card.Text className={'pt-1'}>
        {props.isActive &&
          <div className={"pb-2"}>
            <Badge bg={'success'} className={'me-2'}>Active Flight</Badge>
            <Spinner animation={"border"} size="sm"/>
          </div>}
        {!props.isActive &&
          <div className={"pb-2"}>
            <Badge bg={'primary'}>Past Flight</Badge>
          </div>}
        <Table hover className={'pt-2'}>
          <tbody>
            <tr>
              <td className={'pt-0 pb-1'}><strong>Modem:</strong></td>
              <td className={'pt-0 pb-1'} align={'right'}>{props.modem.name}</td>
            </tr>
            <tr>
              <td className={'pt-0 pb-1'}><strong>IMEI:</strong></td>
              <td className={'pt-0 pb-1'} align={'right'}>{'*'.repeat(10) + props.modem.partialImei}</td>
            </tr>
            <tr>
              <td className={'pt-0 pb-1'}><strong>Date:</strong></td>
              <td className={'pt-0 pb-1'} align={'right'}>{props.formattedDate}</td>
            </tr>
            <tr className={'invisible-bottom-border'}>
              <td className={'pt-0 pb-1'}><strong>Organization:</strong></td>
              <td className={'pt-0 pb-1'} align={'right'}>{props.modem.org}</td>
            </tr>
          </tbody>
        </Table>
      </Card.Text>

      <Card.Subtitle className={'mt-1'}><h5>Current Point</h5></Card.Subtitle>
      <hr/>
      <Form className={'my-1'}>
        <Form.Group>
          <Form.Label column={false}>Location</Form.Label>
          <InputGroup>
            <Form.Control
              type={'input'}
              readOnly={true}
              value={coordsFormatted}
            />
            <OverlayTrigger
              placement={"bottom"}
              show={showCopiedTooltip}
              overlay={renderCopiedTooltip}
            >
              <Button onClick={copyLocation}>
                Copy
              </Button>
            </OverlayTrigger>
          </InputGroup>
        </Form.Group>
        <Button size={'sm'} variant={'outline-success'} onClick={() => openGoogleMaps(props.latitude, props.longitude)}>
          Open in Google Maps
          <i className="bi bi-box-arrow-up-right pl-3"></i>
        </Button>
      </Form>
      <Card.Text className={'my-1'} style={{fontSize: '10pt'}}><strong>Altitude:</strong> {displayMetersFeet(props.altitude, props.pagePreferences.useMetric)}
      </Card.Text>
      <Card.Text className={'my-0'} style={{fontSize: '10pt'}}><strong>Date/Time:</strong> {props.formattedDatetime}</Card.Text>
      <Card.Text className={'mt-0 mb-1 text-secondary'} style={{fontSize: '10pt'}}>({props.duration} from start)</Card.Text>
      <Card.Text className={'mb-1 mt-0'} style={{fontSize: '10pt'}}><strong>Vertical
        velocity:</strong> {displayMpsFps(props.verticalVelocity, props.pagePreferences.useMetric)}</Card.Text>
      <Card.Text className={'mb-1 mt-0'} style={{fontSize: '10pt'}}><strong>Ground speed:</strong> {displayKphMph(props.groundSpeed, props.pagePreferences.useMetric)}
      </Card.Text>
      {(props.elevation != null) &&
      [
        <Card.Text className={'mb-1 mt-0'} style={{fontSize: '10pt'}}><strong>Ground
          elevation:</strong> {displayMetersFeet(props.elevation, props.pagePreferences.useMetric)}</Card.Text>,
        <Card.Text className={'mb-1 mt-0'} style={{fontSize: '10pt'}}>
          {dayjs.duration((Math.abs(props.verticalVelocity) ** -1) * Math.abs(props.altitude - props.elevation), 'seconds').humanize()} until
          touchdown.
        </Card.Text>
      ]
      }
      <ButtonGroup className={'mt-1'}>
        <Button
          variant="outline-primary"
          onClick={React.useCallback(
            () => props.downloadFlight('csv'),
              [props.downloadFlight]
          )}
        >Download Flight</Button>
        <DropdownButton variant="outline-primary" as={ButtonGroup} title="" id="download-nested-dropdown" onSelect={selectDownload}>
          <Dropdown.Item eventKey="csv">CSV</Dropdown.Item>
          <Dropdown.Item eventKey="kml">KML</Dropdown.Item>
        </DropdownButton>
      </ButtonGroup>
      <Card.Subtitle className={'mb-2 mt-3'}>Statistics</Card.Subtitle>
      <div>
        <Table hover size="sm">
          <tbody style={{fontSize: '10pt'}}>
          <tr>
            <td><strong>Max Altitude:</strong></td>
            <td>{displayMetersFeet(props.maxAltitude, props.pagePreferences.useMetric)}</td>
          </tr>
          <tr>
            <td><strong>Min Altitude:</strong></td>
            <td>{displayMetersFeet(props.minAltitude, props.pagePreferences.useMetric)}</td>
          </tr>
          <tr>
            <td><strong>Average Ground Speed:</strong></td>
            <td>{displayKphMph(props.avgGroundSpeed, props.pagePreferences.useMetric)}</td>
          </tr>
          <tr>
            <td><strong>Max Ground Speed:</strong></td>
            <td>{displayKphMph(props.maxGroundSpeed, props.pagePreferences.useMetric)}</td>
          </tr>
          <tr>
            <td><strong>Max Vertical Speed:</strong></td>
            <td>{displayMpsFps(Math.abs(props.maxVerticalVelocity), props.pagePreferences.useMetric)}</td>
          </tr>
          </tbody>
        </Table>
      </div>

    </div>
  )
});


export interface ActiveFlightCardProps {
  uid: string;
  compressedUid: string;
  startDate: dayjs.Dayjs;
  modem: RedactedModem;
  lastDatetime: dayjs.Dayjs;
  callback: () => void;
}

export const ActiveFlightCard = React.memo((props: ActiveFlightCardProps) => {
  return (
    <a style={{cursor: 'pointer'}} onClick={props.callback}>
      <Card border="info" className="card-item quick-shadow">
        <Card.Body>
          <Card.Title>
            Modem: <span className={'text-primary-emphasis'}>{props.modem.name}</span> {`(IMEI ${props.modem.partialImei})`}
          </Card.Title>
          <Card.Subtitle className="mb-2 text-muted">Org: {props.modem.org}</Card.Subtitle>
          <Card.Text>
            <Table size={'sm'} className={'mb-0'}>
              <tbody>
                <tr>
                  <td>Start Date</td>
                  <td>{props.startDate.format('MMMM D, YYYY')} UTC</td>
                </tr>
                <tr className={'invisible-bottom-border'}>
                  <td>Last Updated</td>
                  <td>
                    {props.lastDatetime.format('YYYY-MM-DD HH:mm:ss')} UTC <br/>
                    (<span className={'text-warning-emphasis'}>{props.lastDatetime.fromNow()}</span>)
                  </td>
                </tr>
              </tbody>
            </Table>
          </Card.Text>
        </Card.Body>
      </Card>
    </a>
  )
});