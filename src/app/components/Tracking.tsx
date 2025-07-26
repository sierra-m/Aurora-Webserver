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

import React, {type EffectCallback, useState} from 'react'
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
import {Tabs} from "react-bootstrap";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import timezone from "dayjs/plugin/timezone";
import {Buffer} from "buffer";

dayjs.extend(utc);
dayjs.extend(duration);
dayjs.extend(relativeTime);
dayjs.extend(timezone);

import TrackerMap from './TrackerMap'
import AltitudeChart from './AltitudeChart'
import LandingPrediction from '../util/landing'
import LogWindow, {type LogClearFunc, type LogPrintFunc} from './LogWindow'
import { SelectedFlightData, ActiveFlightCard } from "./Containers";
import FlightSelect from "./FlightSelect";

import {Flight, FlightPoint, type FlightUid, type Position} from '../util/flight'
import { getVelocity } from "../util/velocity";

import balloonIcon from '../images/balloonIcon.png'
import threeBarIcon from '../images/threeBarIcon.png'
import clockIcon from '../images/clockIcon.png'
import chartIcon from '../images/chartIcon.png'

import type {
  ActiveFlightRecord, FlightsResponse,
  RecentActiveFlightsResponse,
  SearchRecord,
  SearchResponse,
  JsvFormat, Vector,
  UpdateResponse
} from "../../server/types/routes.ts";
import type {RedactedModem} from "../../server/types/util.ts";
import {useNavigate, useSearchParams} from "react-router-dom";
import {UPDATE_DELAY, ACTIVE_DELAY} from "../config.ts";
import type {PagePreferences} from "./Navigation.tsx";
import {metersToFeet} from "../util/helpers.ts";
import Badge from "react-bootstrap/Badge";

// @ts-ignore
window.Buffer = Buffer;

const validateUID = (uid: string) => {
  return uid.match(/[0-9a-f]{8}\-[0-9a-f]{4}\-4[0-9a-f]{3}\-[89ab][0-9a-f]{3}\-[0-9a-f]{12}/i);
}

const standardizeUID = (uid: string) => {
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
  // Poly-filled Buffer does not support url-safe b64 encoding, so we need to manually format this
  // as per https://datatracker.ietf.org/doc/html/rfc4648#section-5
  return asBase64.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export interface ActiveFlight extends Omit<ActiveFlightRecord, 'datetime' | 'startDate'>{
  datetime: dayjs.Dayjs;
  startDate: dayjs.Dayjs;
  compressedUid: string;
  callback: () => Promise<void>;
}

export interface FlightsByDate extends SearchRecord {
  callback: () => Promise<void>;
}

interface TrackingProps {
  darkModeEnabled: boolean;
  pagePreferences: PagePreferences;
}

// Per https://stackoverflow.com/a/62975048
function useEffectAllDepsChange(fn: EffectCallback, deps: Array<any>) {
  const [changeTarget, setChangeTarget] = useState(deps);

  React.useEffect(() => {
    setChangeTarget(prev => {
      if (prev.every((dep, i) => dep !== deps[i])) {
        return deps;
      }

      return prev;
    });
  }, [deps]);

  React.useEffect(fn, changeTarget);
}

const Tracking = (props: TrackingProps) => {

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  let activeInterval: Timer | null = null;

  const [updateInterval, setUpdateInterval] = useState<Timer | null>(null);

  // List of modem objects fetched from '/api/meta/modems'
  const [modemList, setModemList] = React.useState<Array<RedactedModem>>([]);

  // List of flights under one modem, returned by '/api/meta/flights'
  const [flightList, setFlightList] = React.useState<Array<FlightsResponse>>([]);

  // List of flight search records for a specific date, returned by '/api/meta/search'
  // TODO: rename this, please
  const [modemsByDateList, setModemsByDateList] = React.useState<Array<FlightsByDate>>([]);

  // Current flight selected by dropdowns
  const [selectedFlight, setSelectedFlight] = React.useState<Flight | null>(null);

  // Current flight landing prediction model
  const [landingPrediction, setLandingPrediction] = React.useState<LandingPrediction  | null>(null);

  // Predicted zone
  const [landingZone, setLandingZone] = React.useState<Position | null>(null);

  // Altitude chart dataset
  const [altitudes, setAltitudes] =  React.useState<Array<Vector>>([]);

  // Active flights tab data
  const [activeFlights, setActiveFlights] = React.useState<Array<ActiveFlight>>([]);

  // Selected point in a flight, represented by a balloon icon when in flight view
  const [selectedPoint, setSelectedPoint] = React.useState<FlightPoint | null>(null);

  // Change this to anything to redraw the altitude chart
  // TODO: is this even needed??
  const [chartRedrawKey, setChartRedrawKey] = React.useState<number | null>(null);

  // Selected modem info (partial imei, org, name)
  const [selectedModem, setSelectedModem] = React.useState<RedactedModem | null>(null);

  // Indicates state of landing prediction, controlled by checkbox
  const [calcLandingPrediction, setCalcLandingPrediction] = React.useState<boolean>(false);

  // Choice from landing prediction radio buttons
  const [chosenVelocityRadio, setChosenVelocityRadio] = React.useState<string>('custom');

  // Landing prediction mass via form control
  const [payloadMass, setPayloadMass] = React.useState<number>(NaN);

  // Landing prediction parachute diameter via form control
  const [parachuteDiameter, setParachuteDiameter] = React.useState<number>(NaN);

  // Landing prediction drag coefficient via form control
  const [dragCoefficient, setDragCoefficient] = React.useState<number>(NaN);

  // Indicates whether current flight is active
  const [selectedFlightIsActive, setSelectedFlightIsActive] = React.useState<boolean>(false);

  // Indicates whether the altitude chart animations are active
  const [animateAltitudeChart, setAnimateAltitudeChart] = React.useState<boolean>(true);

  // Selected flight's last point's ground elevation, if available
  const [groundElevation, setGroundElevation] = React.useState<number | null>(null);

  // Indicates whether new flight load steps should take place
  const [newFlightLoaded, setNewFlightLoaded] = React.useState<boolean>(false);

  // Indicates whether a new flight update interval should be created
  let enableUpdates: boolean = false;

  const calculateVelocity = (altitude: number) => {
    const mass = (!isNaN(payloadMass)) ? payloadMass : 0.001;
    const diameter = (!isNaN(parachuteDiameter)) ? parachuteDiameter : 0.001;
    const drag = (!isNaN(dragCoefficient)) ? dragCoefficient : 0.1;
    return getVelocity(altitude, mass, diameter, drag);
  };

  let pinLogPrint: LogPrintFunc | null = null;

  let pinLogClear: LogClearFunc | null = null;

  const registerControls = (printFunc: LogPrintFunc, clearFunc: LogClearFunc) => {
    pinLogPrint = printFunc;
    pinLogClear = clearFunc;
  };

  // Modem Select Dropdown Callback
  // Fetches all flights associated with a given modem.
  const fetchFlightsFrom = React.useCallback(async (modemName: string) => {
    try {
      const res = await fetch(`/api/meta/flights?modem_name=${modemName}`);
      const data: FlightsResponse[] = await res.json();
      if (res.status !== 200) {
        console.log(`Error fetching flight list: ${data}`);
      }
      setFlightList(data);
    } catch (e) {
      console.log(e);
    }
  }, []);

  const fetchUpdates = React.useCallback(async (flight: Flight | null) => {
    try {
      if (flight) {
        let mostRecent = flight.lastValidPoint();
        if (!mostRecent) {
          mostRecent = flight.lastPoint();
        }
        let result = await fetch('/api/update', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({uid: mostRecent.uid, datetime: mostRecent.timestamp})
        });
        let data: UpdateResponse = await result.json();
        if (result.status !== 200) {
          console.log(`Error fetching flight update: ${data}`);
          return;
        }

        if (data.update && data.result.length > 0) {
          // `Flight.add()` returns index added. Map the adds to an array and use the first
          // index as the entry for updating the altitude profile
          const updateFlight = flight.copy();
          const updateIndices = data.result.map(point => updateFlight.add(point));
          await landingPrediction?.updateAltitudeProfile(updateIndices[0], updateIndices[updateIndices.length - 1]);

          for (const point of data.result) {
            pinLogPrint!(point.inputPins, point.outputPins, point.timestamp, point.altitude);
          }

          let elevation: number | null = null;
          if (data.elevation) elevation = data.elevation;

          setSelectedFlight(updateFlight);
          setChartRedrawKey(Math.random());
          setAnimateAltitudeChart(false);
          setGroundElevation(elevation);
          setSelectedPoint(updateFlight.lastPoint());
        }
      }
    } catch (e) {
      console.log(e);
    }
  }, [pinLogPrint]);

  // Flight selection callback
  const fetchFlight = React.useCallback(async (uid: FlightUid) => {
    try {
      const compressedUid = compressUID(uid);
      console.log(`Requesting /api/flight?uid=${compressedUid} (uncompressed: ${uid})`);
      const res = await fetch(`/api/flight?uid=${compressedUid}`);
      const data: JsvFormat = await res.json();
      if (res.status !== 200) {
        console.log(`Failed to request flight: ${data}`);
        return;
      }

      const flight = new Flight(data);
      const prediction = new LandingPrediction(flight, calculateVelocity);
      await prediction.buildAltitudeProfile();

      const firstPoint = flight.firstPoint();
      const lastPoint = flight.lastPoint();

      const durationSince = dayjs.duration(dayjs.utc().diff(lastPoint.datetime));

      // start updates
      let active = false;
      let selected = firstPoint;
      if (updateInterval) {
        clearInterval(updateInterval);
        setUpdateInterval(null);
      }
      if (durationSince.asHours() < 5) {
        active = true;
        selected = lastPoint;
        setUpdateInterval(setInterval(() => fetchUpdates(flight), UPDATE_DELAY));
        console.log('Enabled updating');
      }

      pinLogClear!();

      // TODO: improve speed of this/place it elsewhere
      const pinStates = flight.pinStates();
      // Load pin states log
      for (const point of pinStates) {
        pinLogPrint!(point.input, point.output, point.timestamp, point.altitude);
      }

      // Needed to differentiate behavior from when fetchUpdates() updates the selected flight
      setNewFlightLoaded(true);
      setSelectedFlight(flight);
      setSelectedPoint(selected);
      setChartRedrawKey(Math.random());
      setLandingPrediction(prediction);
      setSelectedFlightIsActive(active);
      setAnimateAltitudeChart(true);
      setGroundElevation(null);
      setSelectedModem(data.modem);

      // Set browser url
      navigate(`/?uid=${compressedUid}`);
    } catch (e) {
      console.log(e);
    }
  }, [updateInterval, pinLogClear, pinLogPrint]);

  const fetchModemsByDate = React.useCallback(async (formattedDate: string) => {
    try {
      const res = await fetch(`/api/meta/search?date=${formattedDate}`);
      const data: SearchResponse = await res.json();
      if (res.status !== 200) {
        console.log(`Error modems by date: ${data}`);
      }
      if (data.found > 0) {
        // Set callbacks for map display
        const flightsByDate: Array<FlightsByDate> = data.results.map((result: SearchRecord) => {
          const flight: FlightsByDate = {...result, callback: async () => {
              await fetchFlight(result.uid);
            }};
          return flight;
        });
        setModemsByDateList(flightsByDate);
        return true;
      }
      return false;
    } catch (e) {
      console.log(e);
    }
    return false;
  }, [fetchFlight]);

  /**
   * Fetches IMEI list and loads response
   * into imei Select dropdown
   * @returns {Promise<void>}
   */
  const fetchIDList = React.useCallback(async () => {
    try {
      const res = await fetch('/api/meta/modems');
      const data: RedactedModem[] = await res.json();
      if (res.status !== 200) {
        console.log(`Error fetching modems: ${data}`);
        return;
      }
      setModemList(data);
    } catch (e) {
      console.log(e)
    }
  }, []);

  const fetchActive = React.useCallback(async () => {
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
            fetchFlight(partialPoint.uid);
          }
        } as ActiveFlight;
      });
      setActiveFlights(activeFlights);
    }
  }, []);

  const onVelocityProfileChange = React.useCallback((change: string) => {
    setChosenVelocityRadio(change);
    console.log(`Velocity Profile: ${change}`)
  }, []);

  const selectPointByIndex = React.useCallback((index: number) => {
    if (selectedFlight) {
      const point = selectedFlight.get(index);
      //console.log(`Velocity at ${point.altitude} m is ${this.calculateVelocity(point.altitude)}`);
      let zone = null;
      if (calcLandingPrediction && landingPrediction) {
        zone = landingPrediction.calculateLanding(point);
        // TODO: do something about this
        //zone['alt'] = 'TBD';
        //console.log(`Landing zone predicted:`);
        //console.log(zone);
      }
      setSelectedPoint(point);
      setLandingZone(zone);
    }
  }, [selectedFlight, calcLandingPrediction, landingPrediction]);

  const downloadFlight = React.useCallback(async (format: string) => {
    if (selectedFlight) {
      const uid = selectedFlight.firstPoint().uid;
      try {
        window.open(`/api/flight?uid=${uid}&format=${format}`)
      } catch (e) {
        alert(`File fetch failed: ${e}`)
      }
    }
  }, [selectedFlight]);

  const clearFlightDateList = React.useCallback(() => {
    setFlightList([]);
  }, [])

  const clearModemsByDateList = React.useCallback(() => {
    setModemsByDateList([]);
  }, [])

  const clearSelectedFlight = React.useCallback(() => {
    setSelectedFlight(null);
    setSelectedPoint(null);
  }, [])

  // TODO: move these into sub-component

  const toggleLandingPrediction = React.useCallback(() => {
    setCalcLandingPrediction(!calcLandingPrediction);
  }, [calcLandingPrediction])

  const setCustomVelocityProfile = React.useCallback(() => onVelocityProfileChange('custom'), []);

  const setCalculateVelocityProfile = React.useCallback(() => onVelocityProfileChange('calculate'), []);

  const handlePayloadMass = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setPayloadMass(parseFloat(event.target.value));
  }, []);

  const handleParachuteDiameter = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setParachuteDiameter(parseFloat(event.target.value));
  }, []);

  const handleDragCoefficient = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setDragCoefficient(parseFloat(event.target.value));
  }, []);

  // Propagate preferred tz
  React.useEffect(() => {
    dayjs.tz.setDefault(props.pagePreferences.timeZone);
  }, [props.pagePreferences])

  const initialSetup = React.useCallback(async () => {
    await fetchIDList();
    await fetchActive();
    if (activeInterval) {
      clearInterval(activeInterval);
    }
    activeInterval = setInterval(fetchActive, ACTIVE_DELAY);
    const uid = searchParams.get('uid');

    if (uid && uid.length > 0) {
      const standardUid = standardizeUID(uid);
      if (standardUid) {
        await fetchFlight(standardUid);
      }
    }
  }, [activeInterval])

  React.useEffect(() => {
    initialSetup();
    return () => {
      if (activeInterval) {
        clearInterval(activeInterval);
      }
    }
  }, []);

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
            {/* TODO: fix this nonsense (you should only need to pass selected flight & point) */}
            <TrackerMap
              selectedFlight={selectedFlight}
              coordinates={selectedFlight && selectedFlight.coords()}
              startPosition={selectedFlight && (selectedFlight.firstValidPoint()?.coords() || null)}
              endPosition={(selectedFlight && !selectedFlightIsActive && selectedFlight.lastValidPoint()?.coords() || null)}
              defaultCenter={selectedFlight && selectedPoint && selectedPoint.coords()}
              selectedPoint={selectedPoint}
              landingZone={landingZone}
              selectPoint={selectPointByIndex}
              activeFlights={activeFlights}
              modemsByDateList={modemsByDateList}
              pagePreferences={props.pagePreferences}
              darkModeEnabled={props.darkModeEnabled}
            />
          </div>
          {selectedFlight &&
            <>
              <Alert variant={'secondary'} className={'mt-1'}>
                Clicking a marker will show its position. Clicking a point on the line changes the selected point
              </Alert>
              <a href={'/'}
                 className={'text-secondary link-offset-2 link-underline-opacity-50 link-underline-opacity-100-hover'}>
                ← Return to active flights
              </a>
            </>}
        </Column>
        <Column className={'my-2'}>
          <Accordion defaultActiveKey={'flight-select'}>
            <Accordion.Item eventKey={'flight-select'}>
              <Accordion.Header>
                <i className="bi bi-clock-history me-2"></i>
                Past Flights
              </Accordion.Header>
              <Accordion.Body>
                <FlightSelect
                  modemList={modemList}
                  flightDateList={flightList}
                  modemsByDateList={modemsByDateList}
                  fetchFlightsFrom={fetchFlightsFrom}
                  fetchModemsByDate={fetchModemsByDate}
                  fetchFlight={fetchFlight}
                  clearFlightDateList={clearFlightDateList}
                  clearModemsByDateList={clearModemsByDateList}
                  clearSelectedFlight={clearSelectedFlight}
                  darkModeEnabled={props.darkModeEnabled}
                />
              </Accordion.Body>
            </Accordion.Item>
            <Accordion.Item eventKey={'payload-details'}>
              <Accordion.Header>
                <i className="bi bi-box-seam me-2"></i>
                Payload Details
              </Accordion.Header>
              <Accordion.Body className={'custom-curve-window'}>
                <Alert className={'pt-3'} variant={'warning'}>
                  This feature is a work-in-progress, but may be available in future updates
                </Alert>
                <Form>
                  <Form.Check disabled={true} label={'Landing prediction'} onClick={toggleLandingPrediction}/>
                </Form>
                <h6 className={'mt-2'}>Velocity Profile</h6>
                <Form>
                  <Form.Check label={'Custom Function'} type={'radio'}
                              id={'velocity-cust-radio'}
                              onClick={setCustomVelocityProfile}
                              checked={chosenVelocityRadio === 'custom'}
                              disabled={!calcLandingPrediction}
                  />

                  <Row>
                    <Column lg={'auto'} md={'auto'} sm={'auto'} xs={'auto'} xl={'auto'}
                            className={'mr-0 pr-0 my-3'}>
                      <p>y = </p>
                    </Column>
                    <Column className={'ml-0 pl-1 my-2'}>
                      <Form.Group>
                        <Form.Control type={'text'} placeholder={'sqrt(x)'}
                                      disabled={chosenVelocityRadio !== 'custom'}/>
                        <Form.Text className="text-muted">
                          Define a custom velocity function with variable "x"
                        </Form.Text>
                      </Form.Group>
                    </Column>
                  </Row>

                  <Form.Check label={'Descent Equation'} type={'radio'}
                              id={'velocity-calc-radio'}
                              onClick={setCalculateVelocityProfile}
                              checked={chosenVelocityRadio === 'calculate'}
                              disabled={!calcLandingPrediction}
                  />
                </Form>

                {/* Render Calculation Input Variables */}
                {chosenVelocityRadio === 'calculate' &&
                  <Form>
                    <Form.Group>
                      <Form.Label>Payload Mass</Form.Label>
                      <Form.Control type={'number'} placeholder={'kilograms'} min={'0'}
                                    max={'60'} step={'any'} disabled={!calcLandingPrediction}
                                    onChange={handlePayloadMass}
                      />
                    </Form.Group>
                    <Form.Group>
                      <Form.Label>Parachute Diameter</Form.Label>
                      <Form.Control type={'number'} placeholder={'meters'} min={'0.01'}
                                    max={'20'} step={'any'} disabled={!calcLandingPrediction}
                                    onChange={handleParachuteDiameter}
                      />
                    </Form.Group>
                    <Form.Group>
                      <Form.Label>Drag Coefficient</Form.Label>
                      <Form.Control type={'number'} placeholder={'unitless'} min={'0.01'}
                                    max={'2'} step={'any'} disabled={!calcLandingPrediction}
                                    onChange={handleDragCoefficient}
                      />
                    </Form.Group>
                  </Form>
                }
              </Accordion.Body>
            </Accordion.Item>
            <Accordion.Item eventKey={'active-flights'}>
              <Accordion.Header>
                <i className="bi bi-calendar2-check me-2"></i>
                Active Flights
              </Accordion.Header>
              <Accordion.Body style={{overflowY: 'auto', maxHeight: '20rem'}}>
                {activeFlights.length > 0 &&
                  activeFlights.map(partialPoint => (
                    <ActiveFlightCard
                      uid={partialPoint.uid}
                      compressedUid={partialPoint.compressedUid}
                      startDate={partialPoint.startDate}
                      modem={partialPoint.modem}
                      lastDatetime={partialPoint.datetime}
                      callback={partialPoint.callback}
                    />
                  ))
                }
                {activeFlights.length === 0 &&
                  <p className={'text-secondary'}>There are no active flights.</p>
                }
              </Accordion.Body>
            </Accordion.Item>
            <Accordion.Item eventKey={'flight-data'}>
              <Accordion.Header>
                <i className="bi bi-graph-up-arrow me-2"></i>
                Flight Data
              </Accordion.Header>
              <Accordion.Body style={{overflowY: 'auto', height: '45vh', maxHeight: '280px'}}>
                <h2 className={'mb-1'}>Selected Flight</h2>
                {selectedFlight === null && <Card.Text>Please select a flight.</Card.Text>}
                {(selectedFlight && selectedPoint) &&
                  <SelectedFlightData
                    modem={selectedModem!}
                    formattedDate={selectedFlight.startDate!.format('MMMM D, YYYY')}
                    formattedDatetime={selectedPoint.datetime!.format('YYYY-MM-DD HH:mm:ss')}
                    duration={dayjs.duration(selectedPoint.datetime!.utc().diff(selectedFlight.firstPoint().datetime!.utc())).humanize()}
                    maxAltitude={selectedFlight.stats?.maxAltitude || 0}
                    minAltitude={selectedFlight.stats?.minAltitude || 0}
                    avgGroundSpeed={selectedFlight.stats?.avgGroundSpeed || 0}
                    maxGroundSpeed={selectedFlight.stats?.maxGroundSpeed || 0}
                    maxVerticalVelocity={selectedFlight.stats?.maxVerticalVel || 0}
                    latitude={selectedPoint.latitude}
                    longitude={selectedPoint.longitude}
                    altitude={selectedPoint.altitude}
                    verticalVelocity={selectedPoint.verticalVelocity}
                    groundSpeed={selectedPoint.groundSpeed}
                    elevation={groundElevation || undefined}
                    downloadFlight={downloadFlight}
                    isActive={selectedFlightIsActive}
                    pagePreferences={props.pagePreferences}
                  />
                }
              </Accordion.Body>
            </Accordion.Item>
          </Accordion>
        </Column>
      </Row>
      <Row>
        <Column lg={12} xl={12} md={12} sm={12} xs={12}>
          <Card className={'my-3'} style={{height: '36rem'}}>
            <Card.Body style={{maxHeight: '530px'}}>
              <Tabs defaultActiveKey={'altitude'} id={'data-tabs'} variant={'pills'} fill>
                <Tab eventKey={'altitude'} title={'Altitude'}>
                  <Card.Title className={'mt-3'}>Altitude over Time</Card.Title>
                  {selectedPoint &&
                    <Card.Subtitle className={'mb-2'}>
                      Selected Point: <Badge bg={'success'}>
                        {selectedPoint.datetime.local().format('YYYY-MM-DD HH:mm:ss (Z)')}
                      </Badge>
                    </Card.Subtitle>}
                  <AltitudeChart
                    dataTitle={'Balloon Altitude'}
                    data={(selectedFlight && (
                      props.pagePreferences.useMetric ? selectedFlight.altitudes() : selectedFlight.altitudes().map(metersToFeet)
                    )) || []}
                    labels={(selectedFlight && selectedFlight.formattedDatetimes()) || []}
                    selectPoint={selectPointByIndex}
                    useAnimation={animateAltitudeChart}
                    pagePreferences={props.pagePreferences}
                  />
                </Tab>
                <Tab eventKey={'wind-layers'} title={'Wind Layers'}>
                  <Alert className={'pt-3'} variant={'info'}>
                    Wind layer graph: coming soon! 🕝
                  </Alert>
                </Tab>
              </Tabs>
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
                {(selectedFlight && selectedFlight.startDate?.isBefore(dayjs('2024-04-04'))) &&
                  <Alert variant={'info'}>
                    <em>Note:</em> Flights before April 2024 do not have recorded pin states due to a storage error,
                    but this may be fixed in future updates
                  </Alert>
                }
              </Card.Text>
              <LogWindow
                registerControls={registerControls}
                title={'Pin States Log'}
                autoscroll={true}
                selectedPoint={selectedPoint}
                isDisabled={!selectedFlight}
                darkModeEnabled={props.darkModeEnabled}
                pagePreferences={props.pagePreferences}
              />
            </Card.Body>
          </Card>
        </Column>
      </Row>
    </Container>
  )
}

export default Tracking;