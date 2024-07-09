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
import Card from 'react-bootstrap/Card'
import '../style/logwindow.css'
import Container from 'react-bootstrap/Container'
import Badge from 'react-bootstrap/Badge'
import Form from 'react-bootstrap/Form'
import InputGroup from 'react-bootstrap/InputGroup'
import moment from 'moment'
import Select from 'react-select'
import "bootstrap-icons/font/bootstrap-icons.css";
import Dropdown from "react-bootstrap/Dropdown";
import {createPortal} from "react-dom";
import Column from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";


class LogItem {
  constructor (datetime, status, inputPins, outputPins, altitude) {
    this.datetime = datetime;
    this.status = status;
    this.changed = status === 'changed';
    this.inputPins = inputPins;
    this.outputPins = outputPins;
    this.altitude = altitude;
  }

  // For searching/comparing
  toString () {
    return `[${this.datetime}] ${this.status} ${this.changed && '  '} | input: ${this.inputPins}, output: ${this.outputPins}`
  }

  toComponent (selected) {
    // Determine Bootstrap Badge color from status
    const statusVariant = this.changed ? 'success' : 'primary';

    return (
      <div style={{backgroundColor: selected ? '#f8e8fd' : '#FFFFFF'}}>
        <samp>[</samp>
        <ColorSamp color={'#d300a4'}>{moment.utc(this.datetime, 'X').format('YYYY-MM-DD HH:mm:ss')}</ColorSamp>
        <samp>]</samp>
        <ColorSamp color={'#b03e00'} keepWhitespace={true}>{`${this.altitude}`.padStart(6, ' ')} meters</ColorSamp>
        <samp> | Input: </samp>
        <ColorSamp color={(this.inputPins === null) ? '#7c5100' : '#006dbd'}>{`${this.inputPins}`}</ColorSamp>
        <samp>, Output: </samp>
        <ColorSamp color={(this.outputPins === null) ? '#7c5100' : '#006dbd'}>{`${this.outputPins} `}</ColorSamp>
        {/* First letter caps */}
        <Badge variant={statusVariant}>{this.status.charAt(0).toUpperCase() + this.status.slice(1)}</Badge>
        {'\n'}
      </div>
    )
  }
}

export default class LogWindow extends Component {
  // Defined outside of state as these need to update immediately
  lastInputPins = null;
  lastOutputPins = null;

  constructor(props) {
    super(props);
    this.statusOptions = ['Any', 'Changed', 'Unchanged'].map((item) => ({
      label: item,
      value: item.toLowerCase()
    }));

    this.inputPinOptions = [...Array(16).keys()].map(item => ({
      label: item,
      value: item
    }))
    this.outputPinOptions = [...Array(8).keys()].map(item => ({
      label: item,
      value: item
    }))

    this.state = {
      items: [],
      autoscroll: true,
      filterText: '',
      filterStatusOption: this.statusOptions[0],
      filterInputOptions: null,
      filterOutputOptions: null
    };
  }

  defaultProps = {
    autoscroll: true
  };

  scrollToBottom () {
    this.el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
  }

  print = (inputPins, outputPins, datetime, altitude) => {
    let newIn = null;
    let newOut = null;
    let inChanged = false;
    let outChanged = false;
    if (typeof inputPins === "number") {
      newIn = inputPins % 16;
      inChanged = (this.lastInputPins !== newIn);
      this.lastInputPins = newIn;
    }
    if (typeof outputPins === "number") {
      newOut = outputPins % 8;
      outChanged = (this.lastOutputPins !== newOut);
      this.lastOutputPins = newOut;
    }
    const logItem = new LogItem(
      datetime,
      (inChanged || outChanged) ? 'changed' : 'unchanged',
      newIn,
      newOut,
      altitude
    );
    this.state.items.push(logItem);
    this.setState({items: this.state.items});
  };

  clear () {
    this.lastInputPins = null;
    this.lastOutputPins = null;
    this.setState({items: []});
  }

  handleFilterChange (event) {
    this.setState({filterText: event.target.value});
  }

  handleStatusFilterChange = async (change) => {
    this.setState({filterStatusOption: change});
  }

  handleInputPinsFilterChange = async (change) => {
    this.setState({filterInputOptions: change})
  }

  handleOutputPinsFilterChange = async (change) => {
    this.setState({filterOutputOptions: change})
  }

  statusFilterActive () {
    return this.state.filterStatusOption && this.state.filterStatusOption.value !== 'any';
  }

  inputFilterActive () {
    return this.state.filterInputOptions && this.state.filterInputOptions.length > 0;
  }

  outputFilterActive () {
    return this.state.filterOutputOptions && this.state.filterOutputOptions.length > 0;
  }

  applyFilters (items) {
    if (this.statusFilterActive()) {
      items = items.filter(item => item.status === this.state.filterStatusOption.value);
    }
    if (this.inputFilterActive()) {
      items = items.filter(item => this.state.filterInputOptions.find(option => option.value === item.inputPins));
    }
    if (this.outputFilterActive()) {
      items = items.filter(item => this.state.filterOutputOptions.find(option => option.value === item.outputPins));
    }
    return items;
  }

  componentDidMount () {
    if (this.props.registerControls !== null) {
      this.props.registerControls(this.print, this.clear);
    }
    if (this.props.autoscroll) this.scrollToBottom();
    this.setState({autoscroll: this.props.autoscroll});
  }

  componentDidUpdate () {
    if (this.state.autoscroll) {
      if (this.props.selectedPosition) {
        if (this.selectedItemEl != null) {
          this.selectedItemEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
        }
      } else {
        this.scrollToBottom();
      }
    }
  }

  render () {
    return (
      <Card className={'bg-light'}>
        <Card.Header>{this.props.title}</Card.Header>
        <Card.Text>
          <Container className={'log-container'}>

            <Card className={'log-card'}>
              <Card.Text>
                <Container className={'log-container'}>
                  {((this.statusFilterActive() || this.inputFilterActive() || this.outputFilterActive())
                    ? this.applyFilters(this.state.items)
                    : this.state.items).map(item => {
                    const selected = this.props.selectedPosition
                      ? this.props.selectedPosition.datetime.unix() === item.datetime
                      : false;
                    if (typeof item === 'string') return (
                      <div>
                        <samp>
                          {item}
                        </samp>
                        {'\n'}
                      </div>
                    );
                    else return (
                      <div ref={el => {
                        if (selected) {
                          this.selectedItemEl = el;
                        }
                      }}>
                        {item.toComponent(selected)}
                      </div>
                    )
                  })}
                  <div ref={el => {
                    this.el = el;
                  }}/>
                </Container>
              </Card.Text>
            </Card>
          </Container>
        </Card.Text>
        <Card.Footer>
          <Row>
            <Column xs={"auto"}>
              <Dropdown drop={'up'}>
                <Dropdown.Toggle
                  disabled={this.props.isDisabled}
                  variant="outline-primary"
                  id="log-window-filter-dropdown"
                  size={'sm'}
                  className={'pr-1'}
                >
                  Filter
                  <i className="bi bi-filter pl-1"></i>
                </Dropdown.Toggle>

                {createPortal(
                  <Dropdown.Menu style={{
                    width: '24rem',
                    border: `1px solid rgb(61, 139, 253)`,
                    backgroundColor: 'rgba(255, 255, 255, 0.8)'
                  }}>
                    <Form>
                      <InputGroup className={'mb-3 ml-3'} style={{width: '22rem'}}>
                        <InputGroup.Prepend>
                          <InputGroup.Text>Status:</InputGroup.Text>
                        </InputGroup.Prepend>
                        <div className={'react-select form-control p-0'}>
                          <Select
                            value={this.state.filterStatusOption}
                            onChange={this.handleStatusFilterChange}
                            options={this.statusOptions}
                            defaultValue={this.statusOptions[0]}
                          />
                        </div>
                      </InputGroup>
                      <InputGroup className={'mb-3 ml-3'} style={{width: '22rem'}}>
                        <InputGroup.Prepend>
                          <InputGroup.Text>Input Pins:</InputGroup.Text>
                        </InputGroup.Prepend>
                        <div className={'react-select form-control p-0'}>
                          <Select
                            value={this.state.filterInputOptions}
                            onChange={this.handleInputPinsFilterChange}
                            isMulti
                            options={this.inputPinOptions}
                          />
                        </div>
                      </InputGroup>
                      <InputGroup className={'ml-3'} style={{width: '22rem'}}>
                        <InputGroup.Prepend>
                          <InputGroup.Text>Output Pins:</InputGroup.Text>
                        </InputGroup.Prepend>
                        <div className={'react-select form-control p-0'}>
                          <Select
                            value={this.state.filterOutputOptions}
                            onChange={this.handleOutputPinsFilterChange}
                            isMulti
                            options={this.outputPinOptions}
                          />
                        </div>
                      </InputGroup>
                    </Form>
                  </Dropdown.Menu>,
                  document.body
                )}
              </Dropdown>
            </Column>
            <Column>
              <Form className={'align-middle'}>
                <Form.Check
                  type={"checkbox"}
                  id={"autoscroll-check"}
                  label={`Autoscroll: ${this.state.autoscroll ? 'On' : 'Off'}`}
                  onClick={() => this.setState({autoscroll: !this.state.autoscroll})}
                  checked={this.state.autoscroll}
                />
              </Form>
            </Column>
          </Row>
        </Card.Footer>
      </Card>
    )
  }
}

const ColorSamp = (props) => (
  <samp style={{color: props.color, whiteSpace: props.keepWhitespace ? 'pre': 'normal'}}>{props.children}</samp>
);

export {LogItem}