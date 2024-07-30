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

import React, {useState} from 'react'
import Column from 'react-bootstrap/Col'
import Row from 'react-bootstrap/Row'
import Card from 'react-bootstrap/Card'
import Select from 'react-select'
import Form from 'react-bootstrap/Form'
import Tab from 'react-bootstrap/Tab'
import Nav from 'react-bootstrap/Nav'
import Dropdown from 'react-bootstrap/Dropdown';
import Button from "react-bootstrap/Button";
import dayjs from "dayjs";
import "bootstrap-icons/font/bootstrap-icons.css";
import {createPortal} from "react-dom";
import type {ActionMeta} from "react-select";
import type {RedactedModem} from "../../server/util/modems.ts";
import type {FlightsByDate} from "./Tracking.tsx";
import type {FlightUid} from "../util/flight.ts";
import type {FlightsResponse} from "../../server/routes/meta.ts";


interface SelectOption {
  value: string,
  label: string
}

type ModemName = string;

interface ModemSelectOption {
  value: ModemName;
  label: string;
}

type OrgName = string;

interface OrgSelectOption {
  value: OrgName;
  label: OrgName;
}

interface ModemSelectProps {
  modemList: Array<RedactedModem>;
  handleModemSelected: (modem: RedactedModem) => Promise<void>;
  handleModemCleared: () => Promise<void>;
  isDisabled: boolean;
}

export const ModemSelect = React.memo((props: ModemSelectProps) => {
  /** Props:
   *  - modemList: list of modems
   *  - handleModemSelected: function to call when modem is selected
   *  - handleModemCleared: function to call when modem is cleared
   */

  const [selectedModemOption, setSelectedModemOption] = useState<ModemSelectOption | null>(null);

  const [selectedOrgOption, setSelectedOrgOption] = useState<OrgSelectOption | null>(null);

  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string | null>(null);

  const orgSelectChange = React.useCallback(async (option: OrgSelectOption | null, actionMeta: ActionMeta<OrgSelectOption>) => {
    if (option != null) {
      setSelectedOrgOption(option);
      setSelectedOrgFilter(option.value);
    }
  }, [])

  /**
   * Change handler for IMEIs dropdown
   * @param {Object} change The new change
   */
  const modemSelectChange = React.useCallback(async (option: ModemSelectOption | null, actionMeta: ActionMeta<ModemSelectOption>) => {
    if (option != null) {
      const modem = props.modemList.find((m) => (m.name === option.value));
      setSelectedModemOption(option);
      if (modem) {
        await props.handleModemSelected(modem);
      } else {
        console.error(`Option value ${option.value} is missing in modemList`);
      }
    } else {
      setSelectedModemOption(null);
      await props.handleModemCleared();
    }
  }, [props.handleModemSelected, props.handleModemCleared]);

  return (
    <div>
      <Row>
        <Column>
          <h6>Select Modem</h6>
        </Column>
      </Row>
      <Row>
        <Column xs={9} className={'pr-0'}>
          <Select<ModemSelectOption>
            value={selectedModemOption}
            onChange={modemSelectChange}
            options={props.modemList.filter((modem) => {
              if (selectedOrgFilter !== null) {
                return modem.org === selectedOrgFilter;
              } else {
                return true;
              }
            }).map((modem) => ({
              value: modem.name,
              label: `(${modem.partialImei}) ${modem.name}`
            }) as ModemSelectOption)}
            menuPortalTarget={document.querySelector('body')}
            isSearchable={true}
            isClearable={true}
            autoFocus={true}
            isDisabled={props.isDisabled}
          />
        </Column>
        {/* Button for filter by organization */}
        <Column xs={3} className={'px-0 mx-0'}>
          <Dropdown align={'start'}>
            <Dropdown.Toggle disabled={props.isDisabled} variant="outline-primary" id="dropdown-basic">
              <i className="bi bi-funnel"></i>
            </Dropdown.Toggle>

            {createPortal(
              <Dropdown.Menu style={{width: '15rem'}}>
                <h6 className={'mx-1'}>Filter by organization</h6>
                <Select<OrgSelectOption>
                  className={'mx-1'}
                  value={selectedOrgOption}
                  onChange={orgSelectChange}
                  options={[...new Set(props.modemList.map((modem) => (modem.org)))].map((org) => ({
                    value: org,
                    label: org
                  }) as OrgSelectOption)}
                  menuPortalTarget={document.querySelector('body')}
                  isSearchable={true}
                />
              </Dropdown.Menu>,
              document.body
            )}
          </Dropdown>
        </Column>
      </Row>
      <Row>
        <Column>
          {selectedOrgFilter &&
            <Row className={'pt-1'}>
              <Column className={'pr-0 mr-0'} xs={4}>
                <p>
                  <small><em>Filtered by: </em></small>
                </p>
              </Column>
              <Column className={'pl-0 ml-0'}>
                <p>
                  <small><a
                    className={'text-primary link-offset-2 link-underline-opacity-50 link-underline-opacity-100-hover'}
                    href={"#"}
                    onClick={() => {
                      setSelectedOrgFilter(null);
                      setSelectedOrgOption(null);
                    }}
                  >
                    {selectedOrgFilter}
                    <i className="bi bi-x-lg pl-1 mb-1"></i>
                  </a></small>
                </p>
              </Column>
            </Row>
          }
        </Column>
      </Row>
    </div>
  )
});

type FlightDateDesc = string;

interface FlightDateSelectOption {
  value: FlightUid;
  label: FlightDateDesc;
}

interface FlightSelectProps {
  modemList: Array<RedactedModem>;
  flightDateList: Array<FlightsResponse>;
  // TODO: rename this variable, as this is an array of slightly modified search records
  modemsByDateList: Array<FlightsByDate>;
  fetchFlightsFrom: (name: string) => Promise<void>;
  fetchFlight: (uid: string) => Promise<void>;
  fetchModemsByDate: (date: string) => Promise<boolean>;
  clearFlightDateList: () => void;
  clearModemsByDateList: () => void;
  clearSelectedFlight: () => void;
}

const FlightSelect = (props: FlightSelectProps) => {
  /** Props:
   *  - modemList: list of modems
   *  - flightDateList: list of flight dates
   *  - modemsByDateList: list of modems by a specific date
   *  - fetchFlightsFrom: function to pull dates for a modem name
   *  - fetchFlight: function to pull a flight based on modem name and date
   *  - fetchModemsByDate: function to pull list of modems from a particular date
   */

  // Holds the selected modem as set by one of the modem select menus
  const [selectedModem, setSelectedModem] = useState<RedactedModem | null>(null);

  // Holds the selected option for selecting a modem by flight date
  const [selectedFlightDateOption, setSelectedFlightDateOption] = useState<FlightDateSelectOption | null>(null);

  // Holds the selected date option chosen by form control
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);

  // Indicates whether to enable text displaying no flights were found for a date
  const [selectedDateInvalid, setSelectedDateInvalid] = useState<boolean>(false);

  const handleModemSelected = React.useCallback(async (modem: RedactedModem, narrowByModem: boolean) => {
    if (modem !== undefined) {
      console.log('Selection chosen:');
      console.log(`(${modem.partialImei}) ${modem.name}`);
      if (narrowByModem) {
        // Handle "choose by modem" case
        await props.fetchFlightsFrom(modem.name);
        setSelectedModem(modem);
      } else {
        // Handle "choose by date" case
        for (const flightRecord of props.modemsByDateList) {
          if (flightRecord.modem.name === modem.name) {
            await props.fetchFlight(flightRecord.uid);
            return;
          }
        }
      }
    }
  }, [props.fetchFlightsFrom, props.modemsByDateList, props.fetchFlight]);

  const handleModemCleared = React.useCallback(async (narrowByModem: boolean) => {
    if (narrowByModem) {
      // Handle "choose by modem" case
      setSelectedFlightDateOption(null);
      props.clearFlightDateList();
    } else {
      // Handle "choose by date" case
      // Clearing selected flight causes map to refocus on search results
      props.clearSelectedFlight();
    }
  }, [props.clearFlightDateList, props.clearSelectedFlight]);

  const handleDateFormChange = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosenDate = event.target.value;
    const success = await props.fetchModemsByDate(chosenDate);
    setSelectedDate(chosenDate);
    setSelectedDateInvalid(!success);
    // If selecting by new date, clear selected flight
    props.clearSelectedFlight();
  }, [props.fetchModemsByDate, props.clearSelectedFlight]);

  /**
   * Change handler for Flights dropdown
   */
  const flightDateSelectChange = React.useCallback(async (option: FlightDateSelectOption | null, actionMeta: ActionMeta<FlightDateSelectOption>) => {
    setSelectedFlightDateOption(option);
    if (option != null) {
      console.log(`Flight chosen: ${option.label}`);
      if (selectedModem != null) {
        // option.value is a flight uid here
        await props.fetchFlight(option.value);
      }
    }
  }, [selectedModem, props.fetchFlight]);

  const handleModemSelectByModem = React.useCallback(async (modem: RedactedModem) => {
    await handleModemSelected(modem, true);
  }, [handleModemSelected]);

  const handleModemSelectByDate = React.useCallback(async (modem: RedactedModem) => {
    await handleModemSelected(modem, false);
  }, [handleModemSelected]);

  const handleModemClearedByModem = React.useCallback(
    () => handleModemCleared(true),
    [handleModemCleared]
  );

  const handleModemClearedByDate = React.useCallback(
    () => handleModemCleared(false),
    [handleModemCleared]
  );

  return (
    <Tab.Container id={'flight-select-by'} defaultActiveKey={'by-modem'}>
      <Nav justify variant="pills">
        <Nav.Item>
          <Nav.Link eventKey="by-modem">By Modem</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="by-date">By Date</Nav.Link>
        </Nav.Item>
      </Nav>
      <Tab.Content>
        <Tab.Pane eventKey="by-modem">
          <Row className={'mt-3'}>
            <Column>
              <ModemSelect
                modemList={props.modemList}
                handleModemSelected={handleModemSelectByModem}
                handleModemCleared={handleModemClearedByModem}
                isDisabled={false}
              />
            </Column>
          </Row>
          <Row>
            <Column>
              <h6 className={'mt-2'}>Select Flight Date</h6>
            </Column>
          </Row>
          <Row>
            <Column>
              <Select<FlightDateSelectOption>
                value={selectedFlightDateOption}
                onChange={flightDateSelectChange}
                options={props.flightDateList.map((x, index) => ({
                  value: x.uid,
                  label: `${index + 1}: ${x.date}`
                })).reverse()}
                menuPortalTarget={document.querySelector('body')}
                isSearchable={true}
                isDisabled={props.flightDateList.length < 1}
                isLoading={selectedModem !== null && props.flightDateList.length === 0}
              />
            </Column>
          </Row>
        </Tab.Pane>
        <Tab.Pane eventKey="by-date">
          <Row className={'mt-3'}>
            <Column>
              <Form>
                <Form.Group className="mb-3" controlId="by-date-form.date-select">
                  <Form.Label>Select Start Date</Form.Label>
                  <Form.Control
                    type={'date'}
                    name={'from-date'}
                    placeholder={dayjs().format('YYYY-MM-DD')}
                    value={selectedDate}
                    onChange={handleDateFormChange}
                  />
                  {
                    selectedDateInvalid &&
                    <Form.Text className="text-danger">
                      No flights found for this date.
                    </Form.Text>
                  }
                </Form.Group>
              </Form>
            </Column>
          </Row>
          <Row>
            <Column>
              <ModemSelect
                modemList={props.modemsByDateList.map((flight) => (flight.modem))}
                handleModemSelected={handleModemSelectByDate}
                handleModemCleared={handleModemClearedByDate}
                isDisabled={!selectedDate}
              />
            </Column>
          </Row>
        </Tab.Pane>
      </Tab.Content>
    </Tab.Container>
  )
}

export default React.memo(FlightSelect);