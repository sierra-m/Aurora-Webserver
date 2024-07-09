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
import Column from 'react-bootstrap/Col'
import Row from 'react-bootstrap/Row'
import Card from 'react-bootstrap/Card'
import Select from 'react-select'
import Form from 'react-bootstrap/Form'
import Tab from 'react-bootstrap/Tab'
import Nav from 'react-bootstrap/Nav'
import Dropdown from 'react-bootstrap/Dropdown';
import Button from "react-bootstrap/Button";
import moment from 'moment'
import "bootstrap-icons/font/bootstrap-icons.css";
import {createPortal} from "react-dom";



class ModemSelect extends Component {
  /** Props:
   *  - modemList: list of modems
   *  - handleModemSelected: function to call when modem is selected
   *  - handleModemCleared: function to call when modem is cleared
   */

  state = {
    selectedModemOption: null,
    selectedOrgOption: null,
    selectedOrgFilter: null
  }

  orgSelectChange = async (change) => {
    this.setState({selectedOrgOption: change, selectedOrgFilter: change.value});
  }

  /**
   * Change handler for IMEIs dropdown
   * @param {Object} change The new change
   */
  modemSelectChange = async (change) => {
    if (change) {
      const modem = this.props.modemList.find((m) => (m.name === change.value));
      this.setState({selectedModemOption: change});
      this.props.handleModemSelected(modem);
    } else {
      this.setState({selectedModemOption: null})
      this.props.handleModemCleared();
    }
  };

  render() {
    return (
      <div>
        <Row>
          <Column>
            <h6>Select Modem</h6>
          </Column>
        </Row>
        <Row>
          <Column xs={9} className={'pr-0'}>
            <Select
              value={this.state.selectedModemOption}
              onChange={this.modemSelectChange}
              options={this.props.modemList.filter((modem) => {
                if (this.state.selectedOrgFilter !== null) {
                  return modem.org === this.state.selectedOrgFilter;
                } else {
                  return true;
                }
              }).map((modem) => ({
                value: modem.name,
                label: `(${modem.partialImei}) ${modem.name}`
              }))}
              menuPortalTarget={document.querySelector('body')}
              isSearchable={true}
              isClearable={true}
              autoFocus={true}
              isDisabled={this.props.isDisabled}
            />
          </Column>
          {/* Button for filter by organization */}
          <Column xs={3} className={'px-0 mx-0'}>
            <Dropdown alignRight={true}>
              <Dropdown.Toggle disabled={this.props.isDisabled} variant="outline-primary" id="dropdown-basic">
                <i className="bi bi-funnel"></i>
              </Dropdown.Toggle>

              {createPortal(
                <Dropdown.Menu style={{width: '15rem'}}>
                  <h6 className={'mx-1'}>Filter by organization</h6>
                  <Select
                    className={'mx-1'}
                    value={this.state.selectedOrgOption}
                    onChange={this.orgSelectChange}
                    options={[...new Set(this.props.modemList.map((modem) => (modem.org)))].map((org) => ({
                      value: org,
                      label: org
                    }))}
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
            {this.state.selectedOrgFilter &&
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
                        this.setState({selectedOrgFilter: null, selectedOrgOption: null})
                      }}
                    >
                      {this.state.selectedOrgFilter}
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
  }
}

export default class FlightSelect extends Component {
  /** Props:
   *  - modemList: list of modems
   *  - flightDateList: list of flight dates
   *  - modemsByDateList: list of modems by a specific date
   *  - fetchFlightsFrom: function to pull dates for a modem name
   *  - fetchFlight: function to pull a flight based on modem name and date
   *  - fetchModemsByDate: function to pull list of modems from a particular date
   */

  state = {
    // Select variables (option objects for select components)
    selectedModem: null,
    selectedModemOption: null,
    selectedFlightDateOption: null,
    selectedOrgOption: null,
    selectedOrgFilter: null,
    selectedDate: null,
    selectedDateInvalid: false
  };

  orgSelectChange = async (change) => {
    this.setState({selectedOrgOption: change, selectedOrgFilter: change.value});
  }

  /**
   * Change handler for IMEIs dropdown
   * @param {Object} change The new change
   */
  modemSelectChange = async (change) => {
    if (change) {
      const modem = this.props.modemList.find((m) => (m.name === change.value));
      this.setState({selectedModemOption: change, selectedFlightDateOption: null});
      if (modem !== undefined) {
        console.log('Selection chosen:');
        console.log(`(${modem.partialImei}) ${modem.name}`);
        await this.props.fetchFlightsFrom(modem.name);
      }
    } else {
      this.setState({selectedModem: null, selectedModemOption: null, selectedFlightDateOption: null})
      this.props.clearFlightDateList();
    }
  };

  handleModemSelected = async (modem, narrowByModem) => {
    if (modem !== undefined) {
      console.log('Selection chosen:');
      console.log(`(${modem.partialImei}) ${modem.name}`);
      if (narrowByModem) {
        // Handle "choose by modem" case
        await this.props.fetchFlightsFrom(modem.name);
        this.setState({selectedModem: modem});
      } else {
        // Handle "choose by date" case
        for (const flight of this.props.modemsByDateList) {
          if (flight.modem.name === modem.name) {
            await this.props.fetchFlight(flight.uid);
            return;
          }
        }
      }
    }
  };

  handleModemCleared = async (narrowByModem) => {
    if (narrowByModem) {
      // Handle "choose by modem" case
      this.setState({selectedFlightDateOption: null})
      this.props.clearFlightDateList();
    } else {
      // Handle "choose by date" case
      // Clearing selected flight causes map to refocus on search results
      this.props.clearSelectedFlight();
    }
  };

  handleDateFormChange = async (event) => {
    const selectedDate = event.target.value;
    const success = await this.props.fetchModemsByDate(selectedDate);
    this.setState({selectedDate: selectedDate, selectedDateInvalid: !success});
    this.props.clearSelectedFlight();
  };

  /**
   * Change handler for Flights dropdown
   * @param {Object} change The new change
   */
  flightDateSelectChange = async (change) => {
    await this.setState({selectedFlightDateOption: change});
    if (change !== null) {
      await console.log('Flight chosen:');
      await console.log(change.label);
      if (this.state.selectedFlightDateOption !== null && this.state.selectedModem !== null) {
        await this.props.fetchFlight(change.value);
      }
    }
  };

  render() {
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
                  modemList={this.props.modemList}
                  handleModemSelected={(modem) => this.handleModemSelected(modem, true)}
                  handleModemCleared={() => this.handleModemCleared(true)}
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
                <Select
                  value={this.state.selectedFlightDateOption}
                  onChange={this.flightDateSelectChange}
                  options={this.props.flightDateList.map((x, index) => ({
                    value: x.uid,
                    label: `${index + 1}: ${x.date}`
                  })).reverse()}
                  menuPortalTarget={document.querySelector('body')}
                  isSearchable={true}
                  isDisabled={this.props.flightDateList.length < 1}
                  isLoading={this.state.selectedModem !== null && this.props.flightDateList.length === 0}
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
                      placeholder={moment().format('YYYY-MM-DD')}
                      value={this.state.selectedDate}
                      onChange={this.handleDateFormChange}
                    />
                    {
                      this.state.selectedDateInvalid &&
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
                  modemList={this.props.modemsByDateList.map((flight) => (flight.modem))}
                  handleModemSelected={(modem) => this.handleModemSelected(modem, false)}
                  handleModemCleared={() => this.handleModemCleared(false)}
                  isDisabled={!this.state.selectedDate}
                />
              </Column>
            </Row>
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>
    )
  }
}