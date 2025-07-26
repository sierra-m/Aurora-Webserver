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
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import customParseFormat from 'dayjs/plugin/customParseFormat'
import Select, {type ActionMeta, type MultiValue, type Theme} from 'react-select'
import "bootstrap-icons/font/bootstrap-icons.css";
import Dropdown from "react-bootstrap/Dropdown";
import {createPortal} from "react-dom";
import Column from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import { useIntersectionObserver } from 'usehooks-ts';
import type {FlightPoint} from "../util/flight.ts";
import {selectDarkTheme} from "../util/themes.ts";


dayjs.extend(customParseFormat);
dayjs.extend(utc);

type UnixTimestamp = number;

class LogItem {
  timestamp: UnixTimestamp;
  status: string;
  changed: boolean;
  inputPins: number;
  outputPins: number;
  altitude: number;

  constructor (timestamp: UnixTimestamp, changed: boolean, inputPins: number, outputPins: number, altitude: number) {
    this.timestamp = timestamp;
    this.changed = changed;
    this.status = changed ? "changed" : "unchanged";
    this.inputPins = inputPins;
    this.outputPins = outputPins;
    this.altitude = altitude;
  }

  // For searching/comparing
  toString () {
    return `[${this.timestamp}] ${this.status} ${this.changed && '  '} | input: ${this.inputPins}, output: ${this.outputPins}`
  }

  toComponent (selected: boolean) {
    // Determine Bootstrap Badge color from status
    const statusVariant = this.changed ? 'success' : 'primary';

    return (
      <div style={{backgroundColor: selected ? '#f8e8fd' : '#FFFFFF'}}>
        <samp>[</samp>
        <ColorSamp color={'#d300a4'}>{dayjs.utc(this.timestamp, 'X').format('YYYY-MM-DD HH:mm:ss')}</ColorSamp>
        <samp>]</samp>
        <ColorSamp color={'#b03e00'} keepWhitespace={true}>{`${this.altitude}`.padStart(6, ' ')} meters</ColorSamp>
        <samp> | Input: </samp>
        <ColorSamp color={(this.inputPins === null) ? '#7c5100' : '#006dbd'}>{`${this.inputPins}`}</ColorSamp>
        <samp>, Output: </samp>
        <ColorSamp color={(this.outputPins === null) ? '#7c5100' : '#006dbd'}>{`${this.outputPins} `}</ColorSamp>
        {/* First letter caps */}
        <Badge bg={statusVariant}>{this.status.charAt(0).toUpperCase() + this.status.slice(1)}</Badge>
        {'\n'}
      </div>
    )
  }
}

interface LogItemComponentProps {
  item: LogItem;
  selected: boolean;
  useDarkTheme: boolean;
}

const LogItemComponent = (props: LogItemComponentProps) => {
  const statusFormatted = props.item.changed ? 'changed' : 'unchanged';
  const statusVariant = props.item.changed ? 'success' : 'primary';
  const selectedColor = props.useDarkTheme ? '#423c45' : '#f8e8fd';
  const selectedStyle = { backgroundColor: selectedColor };
  // Body color will take precedence, so remove this if selected, falling back to inline
  return (
    <div style={selectedStyle} className={props.selected ? '' : 'bg-body'}>
      <samp>[</samp>
      <ColorSamp color={'#d300a4'}>{dayjs.utc(props.item.timestamp, 'X').format('YYYY-MM-DD HH:mm:ss')}</ColorSamp>
      <samp>]</samp>
      <ColorSamp color={'#b03e00'} keepWhitespace={true}>{`${props.item.altitude}`.padStart(6, ' ')} meters</ColorSamp>
      <samp> | Input: </samp>
      <ColorSamp color={(props.item.inputPins === null) ? '#7c5100' : '#006dbd'}>{`${props.item.inputPins}`}</ColorSamp>
      <samp>, Output: </samp>
      <ColorSamp color={(props.item.outputPins === null) ? '#7c5100' : '#006dbd'}>{`${props.item.outputPins} `}</ColorSamp>
      {/* First letter caps */}
      <Badge bg={statusVariant}>{statusFormatted.charAt(0).toUpperCase() + statusFormatted.slice(1)}</Badge>
      {'\n'}
    </div>
  );
}

export type LogPrintFunc = (input: number, output: number, timestamp: UnixTimestamp, altitude: number) => void;

export type LogClearFunc = () => void;

interface LogWindowProps {
  registerControls: (printFunc: LogPrintFunc, clearFunc: LogClearFunc) => void;
  title: string;
  autoscroll: boolean;
  selectedPoint: FlightPoint | null;
  isDisabled: boolean;
  darkModeEnabled: boolean;
}

interface StatusSelectOption {
  label: string;
  value: string;
}

interface PinSelectOption {
  label: number;
  value: number;
}

const statusOptions = ['Any', 'Changed', 'Unchanged'].map((item) => ({
  label: item,
  value: item.toLowerCase()
}) as StatusSelectOption);

const inputPinOptions = [...Array(16).keys()].map(item => ({
  label: item,
  value: item
}) as PinSelectOption);

const outputPinOptions = [...Array(8).keys()].map(item => ({
  label: item,
  value: item
}) as PinSelectOption);

const LogWindow = (props: LogWindowProps) => {
  // Defined as non-state as these need to update immediately
  let lastInputPins: number | null = null;
  let lastOutputPins: number | null = null;

  const { isIntersecting, ref } = useIntersectionObserver({
    threshold: 0.5
  });

  // Array of log items
  const [items, setItems] = React.useState<Array<LogItem>>([]);

  // Indicates whether autoscroll behavior is enabled
  const [autoscroll, setAutoscroll] = React.useState<boolean>(true);

  // Holds the selected option for filter-by-status select
  const [filterStatusOption, setFilterStatusOption] = React.useState<StatusSelectOption | null>(statusOptions[0]);

  // Holds the selected options for filter-by-input-values select
  const [filterInputOptions, setFilterInputOptions] = React.useState<MultiValue<PinSelectOption> | null>(null);

  // Holds the selected options for filter-by-output-values select
  const [filterOutputOptions, setFilterOutputOptions] = React.useState<MultiValue<PinSelectOption> | null>(null);

  // Ref with element needed for scroll-to-bottom behavior
  const scrollToBottomRef = React.useRef<HTMLDivElement>(null);

  // Ref with element needed for scrolling to selection
  const selectedItemElementRef = React.useRef<HTMLDivElement | null>(null);

  const scrollToBottom = React.useCallback(() => {
    if (scrollToBottomRef.current != null) {
      scrollToBottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    }
  }, [])

  const print = (input: number, output: number, timestamp: UnixTimestamp, altitude: number) => {
    let newIn;
    let newOut;
    let inChanged = false;
    let outChanged = false;

    // Input pins are sent by NAL as > 16, so modding by 16 normalizes these
    newIn = input % 16;
    inChanged = (lastInputPins !== newIn);
    lastInputPins = newIn;

    // Output pins are modded as well to be sure
    newOut = output % 8;
    outChanged = (lastOutputPins !== newOut);
    lastOutputPins = newOut;

    const logItem = new LogItem(
      timestamp,
      (inChanged || outChanged),
      newIn,
      newOut,
      altitude
    );
    setItems((items) => ([...items, logItem]));
  };

  //[lastInputPins, lastOutputPins, items]

  const clear = () => {
    lastInputPins = null;
    lastOutputPins = null;
    setItems([]);
  };

  //[lastInputPins, lastInputPins]

  const handleStatusFilterChange = React.useCallback((option: StatusSelectOption | null, actionMeta: ActionMeta<StatusSelectOption>) => {
    setFilterStatusOption(option);
  }, []);

  const handleInputPinsFilterChange = React.useCallback((options: MultiValue<PinSelectOption>, actionMeta: ActionMeta<PinSelectOption>) => {
    setFilterInputOptions(options);
  }, []);

  const handleOutputPinsFilterChange = React.useCallback((options: MultiValue<PinSelectOption>, actionMeta: ActionMeta<PinSelectOption>) => {
    setFilterOutputOptions(options);
  }, []);

  const statusFilterActive = React.useCallback(() => {
    return (filterStatusOption !== null) && (filterStatusOption.value !== 'any');
  }, [filterStatusOption]);

  const inputFilterActive = React.useCallback(() => {
    return (filterInputOptions !== null) && (filterInputOptions.length > 0);
  }, [filterInputOptions]);

  const outputFilterActive = React.useCallback(() => {
    return (filterOutputOptions !== null) && (filterOutputOptions.length > 0);
  }, [filterOutputOptions]);

  const applyFilters = React.useCallback(() => {
    let filteredItems: Array<LogItem> = [...items];
    if (statusFilterActive()) {
      filteredItems = filteredItems.filter(item => item.status === filterStatusOption!.value);
    }
    if (inputFilterActive()) {
      filteredItems = filteredItems.filter(item => filterInputOptions!.find(option => option.value === item.inputPins));
    }
    if (outputFilterActive()) {
      filteredItems = filteredItems.filter(item => filterOutputOptions!.find(option => option.value === item.outputPins));
    }
    return filteredItems;
  }, [items])

  React.useEffect(() => {
    if (props.registerControls !== null) {
      props.registerControls(print, clear);
      console.log("pin log: registered controls")
    }
    setAutoscroll(props.autoscroll);
  }, []);

  const handleAutoScroll = React.useCallback(() => {
    if (autoscroll && isIntersecting) {
      if (props.selectedPoint) {
        if (selectedItemElementRef.current != null) {
          selectedItemElementRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
        }
      } else {
        scrollToBottom();
      }
    }
  }, [autoscroll, isIntersecting]);

  React.useEffect(() => {
    handleAutoScroll();
  }, [items, props.selectedPoint]);  // Scroll when items or selected point change

  const toggleAutoscroll = React.useCallback(
    () => setAutoscroll(!autoscroll),
      [autoscroll]
    );

  const selectThemeChanger = React.useCallback((theme: Theme) => (props.darkModeEnabled ? {
    ...theme,
    colors: {
      ...theme.colors,
      ...selectDarkTheme
    },
  } : theme), [props.darkModeEnabled])

  return (
    <Card className={'bg-body-secondary'}>
      <Card.Header>{props.title}</Card.Header>
      <Card.Text>
        <Container className={'log-container'}>

          <Card className={'log-card'}>
            <Card.Text>
              <Container className={'log-container'}>
                {((statusFilterActive() || inputFilterActive() || outputFilterActive())
                  ? applyFilters()
                  : items).map((item, index) => {
                  const selected = props.selectedPoint
                    ? props.selectedPoint.timestamp === item.timestamp
                    : false;
                  return (
                    <div ref={el => {
                      if (selected) {
                        selectedItemElementRef.current = el;
                      }
                    }} key={index}>
                      <LogItemComponent item={item} selected={selected} useDarkTheme={props.darkModeEnabled}/>
                    </div>
                  )
                })}
                <div ref={scrollToBottomRef}/>
              </Container>
            </Card.Text>
          </Card>
        </Container>
      </Card.Text>
      {/* Element used by intersection observer  */}
      <div ref={ref}/>
      <Card.Footer>
        <Row>
          <Column xs={"auto"}>
            <Dropdown drop={'up'}>
              <Dropdown.Toggle
                disabled={props.isDisabled}
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
                  backgroundColor: props.darkModeEnabled ? 'rgba(112,112,112,0.8)' : 'rgba(255, 255, 255, 0.8)'
                }}>
                  <Form>
                    <InputGroup className={'mb-3 ml-3'} style={{width: '22rem'}}>
                      <InputGroup.Text>Status:</InputGroup.Text>
                      <div className={'react-select form-control p-0'}>
                        <Select<StatusSelectOption>
                          value={filterStatusOption}
                          onChange={handleStatusFilterChange}
                          options={statusOptions}
                          defaultValue={statusOptions[0]}
                          theme={selectThemeChanger}
                        />
                      </div>
                    </InputGroup>
                    <InputGroup className={'mb-3 ml-3'} style={{width: '22rem'}}>
                      <InputGroup.Text>Input Pins:</InputGroup.Text>
                      <div className={'react-select form-control p-0'}>
                        <Select<PinSelectOption, true>
                          value={filterInputOptions}
                          onChange={handleInputPinsFilterChange}
                          isMulti
                          options={inputPinOptions}
                          theme={selectThemeChanger}
                        />
                      </div>
                    </InputGroup>
                    <InputGroup className={'ml-3'} style={{width: '22rem'}}>
                      <InputGroup.Text>Output Pins:</InputGroup.Text>
                      <div className={'react-select form-control p-0'}>
                        <Select<PinSelectOption, true>
                          value={filterOutputOptions}
                          onChange={handleOutputPinsFilterChange}
                          isMulti
                          options={outputPinOptions}
                          theme={selectThemeChanger}
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
                label={`Autoscroll: ${autoscroll ? 'On' : 'Off'}`}
                onClick={toggleAutoscroll}
                checked={autoscroll}
              />
            </Form>
          </Column>
        </Row>
      </Card.Footer>
    </Card>
  )
}

export default React.memo(LogWindow);

interface ColorSampProps {
  color: string;
  keepWhitespace?: boolean;
  children: React.ReactNode;
}

const ColorSamp = (props: ColorSampProps) => (
  <samp style={{color: props.color, whiteSpace: props.keepWhitespace ? 'pre': 'normal'}}>{props.children}</samp>
);

export {LogItem}