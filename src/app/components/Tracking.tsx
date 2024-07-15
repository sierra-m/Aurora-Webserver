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

import React, { Component } from 'react'
import '../custom.scss'
import '../style/tracking.css'
import Column from 'react-bootstrap/Col'
import Row from 'react-bootstrap/Row'
import Container from 'react-bootstrap/Container'
import Accordion from 'react-bootstrap/Accordion'
import Card from 'react-bootstrap/Card'
import Button from 'react-bootstrap/Button'
import Image from 'react-bootstrap/Image'
import Form from 'react-bootstrap/Form'
import Tab from 'react-bootstrap/Tab'
import Nav from 'react-bootstrap/Nav'
import Alert from 'react-bootstrap/Alert'
import queryString from 'query-string';

import Select from 'react-select'
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

import TrackerMap from './TrackerMap'
import AltitudeChart from './AltitudeChart'
import LandingPrediction from '../util/landing'
import LogWindow, {LogItem} from './LogWindow'
import { SelectedFlightData, ActiveFlightCard } from "./Containers";
import FlightSelect from "./FlightSelect";

import { Flight } from '../util/flight'
import { getVelocity } from "../util/velocity";

import balloonIcon from '../images/balloonIcon.png'
import threeBarIcon from '../images/threeBarIcon.png'
import clockIcon from '../images/clockIcon.png'
import chartIcon from '../images/chartIcon.png'

import {Buffer} from "buffer";
import type {
  ActiveFlightRecord,
  RecentActiveFlightsResponse,
  SearchRecord,
  SearchResponse
} from "../../server/routes/meta.ts";
import type {RedactedModem} from "../../server/util/modems.ts";

const logTime = () => moment().format('HH:mm:ss');

const format = require('string-format');
format.extend(String.prototype, {});

const UPDATE_DELAY = 5000;
const ACTIVE_DELAY = 30000;


const validateUID = (uid) => {
  return uid.match(/[0-9a-f]{8}\-[0-9a-f]{4}\-4[0-9a-f]{3}\-[89ab][0-9a-f]{3}\-[0-9a-f]{12}/i);
}


const standardizeUID = (uid) => {
  let standardUid;
  if (uid.length === 22) {
    const asHex = Buffer.from(uid, 'base64').toString('hex');
    standardUid = `${asHex.slice(0,8)}-${asHex.slice(8,12)}-${asHex.slice(12,16)}-${asHex.slice(16,20)}-${asHex.slice(20)}`;
  } else {
    standardUid = uid;
  }
  if (typeof standardUid === 'string' && validateUID(standardUid)) {
    return standardUid;
  }
}

const compressUID = (uid: string) => {
  let asBase64 = Buffer.from(uid.replaceAll('-', ''), 'hex').toString('base64');
  // Buffer in node v12 does not support url-safe b64 encoding, so we need to manually format this
  // as per https://datatracker.ietf.org/doc/html/rfc4648#section-5
  return asBase64.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export interface ActiveFlight extends Omit<ActiveFlightRecord, 'datetime' | 'startDate'>{
  datetime: dayjs.Dayjs;
  startDate: dayjs.Dayjs;
  compressedUid: string;
  callback: () => void;
}

export interface FlightsByDate extends SearchRecord {
  callback: () => Promise<void>;
}

class Tracking extends Component {
  constructor (props) {
    super(props);
    this.updateInterval = null;
    this.activeInterval = null;
  }

  /*
  *   STATE
  *   -----
  *   modemList: `list`
  *   |   list of modem objects
  *   flightList: `list`
  *   |   list of flights under one imei
  *   currentFlight: :class:`Flight`
  *   |   current loaded flight
  *
  */
  state = {
    modemList: [],
    flightList: [],
    modemsByDateList: [],

    // Current flight selected by dropdowns
    currentFlight: null,

    // Current flight landing prediction model
    landingPrediction: null,

    // Predicted zone
    landingZone: null,

    // Altitude chart dataset
    altitudes: [],

    // active flights tab data
    activeFlights: [],

    // Green balloon on map, stores a :class:`FlightPoint`
    selectedPosition: null,

    // Change this to anything to redraw the altitude chart
    chartRedrawKey: 0,

    // Select variables (option objects for select components)
    selectedModemOption: null,
    selectedFlightOption: null,

    // Selected modem info (partial imei, org, name)
    selectedModem: null,

    // Check box
    useLandingPrediction: false,

    // Radio buttons
    chosenVelocityRadio: 'custom',

    payloadMass: null,
    parachuteDiameter: null,
    dragCoefficient: null,

    // indicates whether current flight is active
    activeFlight: false,

    chartAnimation: true,

    groundElevation: false,
    accordionKey: 'flight-select'
  };
  payloadMass;
  parachuteDiameter;
  dragCoefficient;

  calculateVelocity = (altitude: number) => {
    const mass = (this.payloadMass !== undefined && this.payloadMass.value) || 0.001;
    const diameter = (this.parachuteDiameter !== undefined && this.parachuteDiameter.value) || 0.001;
    const drag = (this.dragCoefficient !== undefined && this.dragCoefficient.value) || 0.1;
    return getVelocity(altitude, mass, diameter, drag);
  };

  pinLogPrint = () => {};

  pinLogClear = () => {};

  registerControls = (printFunc, clearFunc) => {
    this.pinLogPrint = printFunc;
    this.pinLogClear = clearFunc;
  };

  /**
   * [ IMEI Select Dropdown Callback ]
   *
   * Fetches all flights associated with a given modem.
   * Response is a list of objects:
   *    [
   *        {
   *            date: {{ String }},
   *            uid: {{ String }}
   *        },
   *        ...
   *    ]
   *
   * @param {String} modem_name The modem name to load
   * @returns {Promise<void>}
   */
  fetchFlightsFrom = async (modem_name) => {
    try {
      const res = await fetch(`/api/meta/flights?modem_name=${modem_name}`);
      const data = await res.json();
      if (res.status !== 200) {
        console.log(`Error fetching flight list: ${data}`);
      }
      this.setState({flightList: data});
    } catch (e) {
      console.log(e);
    }
  };

  fetchModemsByDate = async (date: string) => {
    try {
      const res = await fetch(`/api/meta/search?date=${date}`);
      const data: SearchResponse = await res.json();
      if (res.status !== 200) {
        console.log(`Error modems by date: ${data}`);
      }
      if (data.found > 0) {
        // Set callbacks for map display
        const flightsByDate: Array<FlightsByDate> = data.results.map((result: SearchRecord) => {
          const flight: FlightsByDate = {...result, callback: async () => {
            await this.fetchFlight(result.uid);
          }};
          return flight;
        });
        this.setState({modemsByDateList: flightsByDate});
        return true;
      }
      return false;
    } catch (e) {
      console.log(e);
    }
  }

  /**
   * Flight selection callback
   * @param uid Optional search method
   * @returns {Promise<void>}
   */
  fetchFlight = async (uid) => {
    try {
      const compressedUid = compressUID(uid);
      console.log(`Requesting /api/flight?uid=${compressedUid} (${uid})`);
      const res = await fetch(`/api/flight?uid=${compressedUid}`);
      const data = await res.json();
      if (res.status !== 200) {
        console.log(`Failed to request flight: ${data}`);
        return;
      }

      const flight = new Flight(data);
      const prediction = new LandingPrediction(flight, this.calculateVelocity);
      await prediction.buildAltitudeProfile();

      const firstPoint = await flight.firstPoint();
      const lastPoint = await flight.lastPoint();

      const durationSince = moment.duration(moment.utc().diff(lastPoint.datetime));

      // start updates
      let active = false;
      let selected = firstPoint;
      clearInterval(this.updateInterval);
      if (durationSince.asHours() < 5) {
        active = true;
        selected = lastPoint;
        this.updateInterval = setInterval(this.fetchUpdates, UPDATE_DELAY);
        console.log('Enabled updating');
      }

      this.pinLogClear();

      await this.setState({
        currentFlight: flight,
        selectedPosition: selected,
        chartRedrawKey: Math.random(),
        landingPrediction: prediction,
        activeFlight: active,
        chartAnimation: true,
        groundElevation: false,
        accordionKey: 'flight-data',
        selectedModem: data.modem
      }, () => {
        const pinStates = this.state.currentFlight.pinStates();
        // Load pin states log
        for (const point of pinStates) {
          this.pinLogPrint(point.input, point.output, point.timestamp, point.altitude);
        }
      });
      await this.props.history.push(`/tracking?uid=${compressedUid}`);
    } catch (e) {
      console.log(e);
    }
  };

  fetchUpdates = async () => {
    try {
      if (this.state.currentFlight) {
        let mostRecent = this.state.currentFlight.lastValidPoint();
        let result = await fetch('/api/update', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({uid: mostRecent.uid, datetime: mostRecent.datetime.unix()})
        });
        let data = await result.json();
        if (result.status !== 200) {
          console.log(`Error fetching flight update: ${data}`);
          return;
        }

        if (data.update && data.result.length > 0) {
          // `Flight.add()` returns index added. Map the adds to an array and use the first
          // index as the entry for updating the altitude profile
          const updateIndicies = data.result.map(point => this.state.currentFlight.add(point));
          await this.state.landingPrediction.updateAltitudeProfile(updateIndicies[0], updateIndicies[updateIndicies.length - 1]);

          for (const point of data.result) {
            this.pinLogPrint(point.input_pins, point.output_pins, point.datetime, point.altitude);
          }

          let elevation = false;
          if (data.elevation) elevation = data.elevation;

          this.setState({
            currentFlight: this.state.currentFlight,
            chartRedrawKey: Math.random(),
            chartAnimation: false,
            groundElevation: elevation
          }, async () => {
            await this.setSelectedPosition(this.state.currentFlight.data.length - 1);
          });
        }
      }
    } catch (e) {
      console.log(e);
    }
  };

  /**
   * Fetches IMEI list and loads response
   * into imei Select dropdown
   * @returns {Promise<void>}
   */
  fetchIDList = async () => {
    try {
      const res = await fetch('/api/meta/modems');
      const data = await res.json();
      if (res.status !== 200) {
        console.log(`Error fetching modems: ${data}`);
        return;
      }

      await this.setState({modemList: data});
    } catch (e) {
      console.log(e)
    }
  };

  fetchActive = async () => {
    const res = await fetch('/api/meta/active');
    const data: RecentActiveFlightsResponse = await res.json();
    if (res.status !== 200) {
      console.log(`Error fetching active flights: ${data}`)
      return;
    }

    if (data.status === 'active') {
      console.log('Active flight(s)');
      if (data.points == null) {
        console.error(`fetchActive: data.points does not exist!`);
        return;
      }
      const activeFlights: Array<ActiveFlight> = data.points.map((partialPoint) => {
        return {
          uid: partialPoint.uid,
          datetime: dayjs.utc(partialPoint.datetime, 'YYYY-MM-DD[T]HH:mm:ss[Z]'),
          latitude: partialPoint.latitude,
          longitude: partialPoint.longitude,
          altitude: partialPoint.altitude,
          modem: partialPoint.modem,
          startDate: dayjs.utc(partialPoint.startDate, 'YYYY-MM-DD'),
          compressedUid: compressUID(partialPoint.uid),
          callback: () => {
            this.fetchFlight(partialPoint.uid);
          }
        } as ActiveFlight;
      });
      this.setState({activeFlights: activeFlights});
    }
  };

  /**
   * Change handler for IMEIs dropdown
   * @param {Object} change The new change
   */
  imeiSelectChange = async (change) => {
    const modem = this.state.modemList.find((m) => (m.name === change.value));
    this.setState({selectedModem: modem, selectedModemOption: change, selectedFlightOption: null});
    if (modem !== undefined) {
      console.log('Selection chosen:');
      console.log(`(${modem.partialImei}) ${modem.name}`);
      await this.fetchFlightsFrom(modem.name);
    }
  };

  /**
   * Change handler for Flights dropdown
   * @param {Object} change The new change
   */
  flightSelectChange = async (change) => {
    await this.setState({selectedFlightOption: change});
    if (change !== null) {
      await console.log('Flight chosen:');
      await console.log(change.label);
      if (this.state.selectedFlightOption !== null && this.state.selectedModem !== null) {
        await this.fetchFlight(change.value);
      }
    }
  };

  onVelocityProfileChange = (change) => {
    this.setState({chosenVelocityRadio: change});
    console.log('Velocity Profile: {}'.format(change))
  };

  setSelectedPosition = (index: number) => {
    if (this.state.currentFlight) {
      const point = this.state.currentFlight.get(index);
      //console.log(`Velocity at ${point.altitude} m is ${this.calculateVelocity(point.altitude)}`);
      let zone = null;
      if (this.state.useLandingPrediction) {
        zone = this.state.landingPrediction.calculateLanding(point);
        zone['alt'] = 'TBD';
        //console.log(`Landing zone predicted:`);
        //console.log(zone);
      }

      this.setState({
        selectedPosition: point,
        landingZone: zone
      });
    }
  };

  setAccordionTab = async (key) => {
    await this.setState({accordionKey: key});
    console.log(`Set accordionKey ${key}`);
  };

  downloadFlight = async (format) => {
    const uid = this.state.currentFlight.firstPoint().uid;
    try {
      window.open(`/api/flight?uid=${uid}&format=${format}`)
    } catch (e) {
      alert(`File fetch failed: ${e}`)
    }
  };

  async componentDidMount () {
    await this.fetchIDList();
    await this.fetchActive();
    this.activeInterval = setInterval(this.fetchActive, ACTIVE_DELAY);
    const params = queryString.parse(this.props.location.search);

    if ('uid' in params && typeof params.uid === 'string' && params.uid.length > 0) {
      await this.fetchFlight(standardizeUID(params.uid));
    }
  }

  render () {
    return (
      <Container>
        <Row className={'mt-3'}>
          <Column>
            <h1>Flight Tracker</h1>
          </Column>
        </Row>
        <Row>
          <Column lg={8} className={'my-2'}>
            <div className={'map-rounded'}>
              <TrackerMap
                coordinates={this.state.currentFlight && this.state.currentFlight.coords()}
                startPosition={this.state.currentFlight && this.state.currentFlight.firstValidPoint().coords()}
                endPosition={this.state.currentFlight && !this.state.activeFlight && this.state.currentFlight.lastValidPoint().coords()}
                defaultCenter={this.state.currentFlight && this.state.selectedPosition.coords()}
                selectedPosition={this.state.selectedPosition}
                landingZone={Math.random() && this.state.landingZone}
                selectPosition={this.setSelectedPosition}
                activeFlights={this.state.activeFlights}
                modemsByDateList={this.state.modemsByDateList}
              />
            </div>
            {this.state.currentFlight &&
              <a href={'/tracking'}
                 className={'text-secondary link-offset-2 link-underline-opacity-50 link-underline-opacity-100-hover'}>
                ← Return to active flights
              </a>}
          </Column>
          <Column className={'my-2'}>
            <Accordion activeKey={this.state.accordionKey}>
              <Card>
                <Card.Header>
                  <Image src={threeBarIcon} className={'icon-bar ml-2'}/>
                  <Accordion.Toggle as={Button} variant="link" eventKey="flight-select" onClick={() => this.setAccordionTab('flight-select')}>
                    Flight Select
                  </Accordion.Toggle>
                </Card.Header>
                <Accordion.Collapse eventKey="flight-select">
                  <Card.Body>
                    <FlightSelect
                      modemList={this.state.modemList}
                      flightDateList={this.state.flightList}
                      modemsByDateList={this.state.modemsByDateList}
                      fetchFlightsFrom={this.fetchFlightsFrom}
                      fetchModemsByDate={this.fetchModemsByDate}
                      fetchFlight={this.fetchFlight}
                      clearFlightDateList={() => {this.setState({flightList: []})}}
                      clearModemsByDateList={() => {this.setState({modemsByDateList: []})}}
                      clearSelectedFlight={() => {this.setState({currentFlight: null, selectedPosition: null})}}
                    />
                  </Card.Body>
                </Accordion.Collapse>
              </Card>
              <Card>
                <Card.Header>
                  <Image src={balloonIcon} className={'icon-balloon ml-2'}/>
                  <Accordion.Toggle as={Button} variant="link" eventKey="payload-details" onClick={() => this.setAccordionTab('payload-details')}>
                    Payload Details
                  </Accordion.Toggle>
                </Card.Header>
                <Accordion.Collapse eventKey="payload-details">
                  <Card.Body className={'custom-curve-window'}>
                    <Alert className={'pt-3'} variant={'warning'}>
                      This feature is a work-in-progress, but may be available in future updates
                    </Alert>
                    <Form>
                      <Form.Check disabled={true} label={'Landing prediction'} onClick={() =>
                        this.setState({useLandingPrediction: !this.state.useLandingPrediction})
                      }/>
                    </Form>
                    <h6 className={'mt-2'}>Velocity Profile</h6>
                    <Form>
                      <Form.Check label={'Custom Function'} type={'radio'}
                                  id={'velocity-cust-radio'}
                                  onClick={() => this.onVelocityProfileChange('custom')}
                                  checked={this.state.chosenVelocityRadio === 'custom'}
                                  disabled={!this.state.useLandingPrediction}
                      />

                      <Row>
                        <Column lg={'auto'} md={'auto'} sm={'auto'} xs={'auto'} xl={'auto'}
                                className={'mr-0 pr-0 my-3'}>
                          <p disabled={this.state.chosenVelocityRadio !== 'custom'}>y = </p>
                        </Column>
                        <Column className={'ml-0 pl-1 my-2'}>
                          <Form.Group>
                            <Form.Control type={'text'} placeholder={'sqrt(x)'}
                                          disabled={this.state.chosenVelocityRadio !== 'custom'}/>
                            <Form.Text className="text-muted">
                              Define a custom velocity function with variable "x"
                            </Form.Text>
                          </Form.Group>
                        </Column>
                      </Row>

                      <Form.Check label={'Descent Equation'} type={'radio'}
                                  id={'velocity-calc-radio'}
                                  onClick={() => this.onVelocityProfileChange('calculate')}
                                  checked={this.state.chosenVelocityRadio === 'calculate'}
                                  disabled={!this.state.useLandingPrediction}
                      />
                    </Form>

                    {/* Render Calculation Input Variables */}
                    {this.state.chosenVelocityRadio === 'calculate' &&
                    <Form>
                      <Form.Group>
                        <Form.Label>Payload Mass</Form.Label>
                        <Form.Control type={'number'} placeholder={'kilograms'} min={'0'}
                                      max={'60'} step={'any'} disabled={!this.state.useLandingPrediction}
                                      ref={change => this.payloadMass = change}
                                      onChange={this.testVelocity}
                        />
                      </Form.Group>
                      <Form.Group>
                        <Form.Label>Parachute Diameter</Form.Label>
                        <Form.Control type={'number'} placeholder={'meters'} min={'0.01'}
                                      max={'20'} step={'any'} disabled={!this.state.useLandingPrediction}
                                      ref={change => this.parachuteDiameter = change}
                                      onChange={this.testVelocity}
                        />
                      </Form.Group>
                      <Form.Group>
                        <Form.Label>Drag Coefficient</Form.Label>
                        <Form.Control type={'number'} placeholder={'unitless'} min={'0.01'}
                                      max={'2'} step={'any'} disabled={!this.state.useLandingPrediction}
                                      ref={change => this.dragCoefficient = change}
                                      onChange={this.testVelocity}
                        />
                      </Form.Group>
                    </Form>
                    }
                  </Card.Body>
                </Accordion.Collapse>
              </Card>
              <Card>
                <Card.Header>
                  <Image src={clockIcon} className={'icon-bar ml-2'}/>
                  <Accordion.Toggle as={Button} variant="link" eventKey="active-flights" onClick={() => this.setAccordionTab('active-flights')}>
                    Active Flights
                  </Accordion.Toggle>
                </Card.Header>
                <Accordion.Collapse eventKey="active-flights">
                  <Card.Body style={{overflowY: 'auto', maxHeight: '20rem'}}>
                    {this.state.activeFlights.length > 0 &&
                    this.state.activeFlights.map(partialPoint => (
                      <ActiveFlight
                        {...partialPoint}
                      />
                    ))
                    }
                    {this.state.activeFlights.length === 0 &&
                    <Card.Text className={'text-secondary'}>There are no active flights.</Card.Text>
                    }
                  </Card.Body>
                </Accordion.Collapse>
              </Card>
              <Card>
                <Card.Header>
                  <Image src={chartIcon} className={'icon-bar ml-2'}/>
                  <Accordion.Toggle as={Button} variant="link" eventKey="flight-data" onClick={() => this.setAccordionTab('flight-data')}>
                    Flight Data
                  </Accordion.Toggle>
                </Card.Header>
                <Accordion.Collapse eventKey="flight-data">
                  <Card.Body style={{overflowY: 'auto', height: '45vh', maxHeight: '280px'}}>
                    <Card.Title className={'mb-1'}>Selected Flight</Card.Title>
                    {this.state.currentFlight === null && <Card.Text>Please select a flight.</Card.Text>}
                    {this.state.currentFlight &&
                    <SelectedFlightData
                      modem={this.state.selectedModem}
                      date={this.state.currentFlight.start_date.format('MMMM Do, YYYY')}
                      datetime={this.state.selectedPosition.datetime.format('YYYY-MM-DD HH:mm:ss')}
                      duration={moment.duration(this.state.selectedPosition.datetime.utc().diff(this.state.currentFlight.firstPoint().datetime.utc())).humanize()}
                      max_altitude={this.state.currentFlight.stats.max_altitude}
                      min_altitude={this.state.currentFlight.stats.min_altitude}
                      avg_ground={this.state.currentFlight.stats.avg_ground}
                      max_ground={this.state.currentFlight.stats.max_ground}
                      max_vertical={this.state.currentFlight.stats.max_vertical}
                      lat={this.state.selectedPosition.latitude}
                      long={this.state.selectedPosition.longitude}
                      altitude={this.state.selectedPosition.altitude}
                      vertical={this.state.selectedPosition.vertical_velocity}
                      ground={this.state.selectedPosition.ground_speed}
                      elevation={this.state.groundElevation}
                      downloadFlight={this.downloadFlight}
                      isActive={this.state.activeFlight}
                    />
                    }
                  </Card.Body>
                </Accordion.Collapse>
              </Card>
            </Accordion>
          </Column>
        </Row>
        <Row>
          <Column lg={12} xl={12} md={12} sm={12} xs={12}>
            <Card className={'my-3'} style={{height: '36rem'}}>
              <Card.Body style={{maxHeight: '530px'}}>
                <Tab.Container id="data-tabs" defaultActiveKey="altitude">
                  <Nav justify variant="pills">
                    <Nav.Item>
                      <Nav.Link eventKey="altitude">Altitude</Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                      <Nav.Link eventKey="wind-layers">Wind Layers</Nav.Link>
                    </Nav.Item>
                  </Nav>
                  <Tab.Content>
                    <Tab.Pane eventKey="altitude">
                      <Card.Title className={'mt-3'}>Altitude over Time</Card.Title>
                      {this.state.selectedPosition &&
                        <Card.Subtitle>
                          Selected Point: {this.state.selectedPosition.datetime.clone().local().format('YYYY-MM-DD HH:mm:ss')}
                        </Card.Subtitle>}
                      <AltitudeChart
                        dataName={'Balloon Altitude'}
                        data={this.state.currentFlight && this.state.currentFlight.altitudes()}
                        key={this.state.chartRedrawKey}
                        labels={this.state.currentFlight && this.state.currentFlight.datetimes()}
                        selectPosition={this.setSelectedPosition}
                        animation={this.state.chartAnimation}
                        style={{height: '18rem', maxHeight: '18rem'}}
                      />
                    </Tab.Pane>
                    <Tab.Pane eventKey="wind-layers">
                      <Alert className={'pt-3'} variant={'info'}>
                        Wind layer graph: coming soon! 🕝
                      </Alert>
                    </Tab.Pane>
                  </Tab.Content>
                </Tab.Container>
              </Card.Body>
            </Card>
          </Column>
        </Row>
        <Row>
          <Column xs={12}>
            <Card className={'mt-3'} style={{height: '37rem'}}>
              <Card.Body>
                <Card.Title className={'mt-3'}>Pin States</Card.Title>
                <Card.Text>
                  <div className={'pb-3'}>This log shows NAL Modem pin states for each time stamp.</div>
                  <Alert variant={'info'}>
                    <em>Note:</em> Flights before April 2024 do not have recorded pin states due to a storage error, this
                    may be fixed
                    in future updates
                  </Alert>
                </Card.Text>
                <LogWindow
                  registerControls={this.registerControls}
                  title={'Pin States Log'}
                  autoscroll={true}
                  selectedPosition={this.state.selectedPosition}
                />
              </Card.Body>
            </Card>
          </Column>
        </Row>
      </Container>
    )
  }
}

export default Tracking;