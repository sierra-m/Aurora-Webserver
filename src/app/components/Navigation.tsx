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

import React, {type ChangeEvent} from 'react';
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import '../custom.scss';
import { Link } from "react-router-dom";
import {Navbar, Nav, Modal} from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";
import Container from 'react-bootstrap/Container'
import Form from "react-bootstrap/Form";
import "bootstrap-icons/font/bootstrap-icons.css";
import Button from "react-bootstrap/Button";
import Toggle from "./Toggle.tsx";
import Column from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import Select, {type ActionMeta, type Theme, type ThemeConfig} from "react-select";
import {selectDarkTheme} from "../util/themes.ts";

dayjs.extend(utc);
dayjs.extend(timezone);

export interface PagePreferences {
  useMetric: boolean;
  timeZone: string;
}

interface NavigationProps {
  handleDarkModeEnabled: (darkMode: boolean) => void;
  handlePagePrefChange: (preferences: PagePreferences) => void;
}

interface TimezoneSelectOption {
  value: string;
  label: string;
}

const guessedTz = dayjs.tz.guess();

const defaultTimeZone: TimezoneSelectOption = {
  value: guessedTz,
  label: guessedTz
}

export const defaultPreferences: PagePreferences = {
  useMetric: true,
  timeZone: guessedTz
}

const Navigation = (props: NavigationProps) => {
  const [navExpanded, setNavExpanded] = React.useState<boolean>(false);

  const [darkModeEnabled, setDarkMode] = React.useState(false);

  const [showPreferences, setShowPreferences] = React.useState<boolean>(false);

  const [pagePreferences, setPagePreferences] = React.useState<PagePreferences>(defaultPreferences);

  const [timeZoneOption, setTimeZoneOption] = React.useState<TimezoneSelectOption | null>(defaultTimeZone);

  const navExpandedToggle = React.useCallback((expanded: boolean) => {
    setNavExpanded(expanded);
  }, []);

  const closeNav = React.useCallback(() => {
    setNavExpanded(false);
  }, []);

  const toggleDarkMode = React.useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setDarkMode(event.target.checked);
    // Preference only saved when switch changes
    localStorage.setItem('preferColorMode', event.target.checked ? 'dark' : 'light');
  }, []);

  React.useEffect(() => {
    const color = darkModeEnabled ? 'dark' : 'light';
    document.documentElement.setAttribute('data-bs-theme', color);
    props.handleDarkModeEnabled(darkModeEnabled);
  }, [darkModeEnabled]);

  React.useEffect(() => {
    const preferColorMode = localStorage.getItem('preferColorMode');
    if (preferColorMode !== null) {
      setDarkMode(preferColorMode === 'dark');
    }
    const storedPagePreferences = localStorage.getItem('pagePreferences');
    if (storedPagePreferences !== null) {
      const newPagePreferences: PagePreferences = JSON.parse(storedPagePreferences);
      setPagePreferences(newPagePreferences);
      setTimeZoneOption({
        value: newPagePreferences.timeZone,
        label: newPagePreferences.timeZone
      });
    }
  }, []);

  const handleShowPreferences = React.useCallback(() => {
    setShowPreferences(true);
  }, [])

  const handleClosePreferences = React.useCallback(() => {
    setShowPreferences(false);
  }, [])

  // Propagate page pref changes up
  React.useEffect(() => {
    props.handlePagePrefChange(pagePreferences)
  }, [pagePreferences]);

  const togglePrefUnits = React.useCallback((toggled: boolean, event: React.MouseEvent<HTMLDivElement>) => {
    const newPreferences = {
      ...pagePreferences,
      useMetric: toggled
    }
    setPagePreferences(newPreferences);
    localStorage.setItem('pagePreferences', JSON.stringify(newPreferences));
    console.log(`Wrote new pref: ${JSON.stringify(newPreferences)}`);
  }, [pagePreferences]);

  const timeZonePrefChange = React.useCallback((option: TimezoneSelectOption | null, actionMeta: ActionMeta<TimezoneSelectOption>) => {
    let newPreferences;
    if (option) {
      newPreferences = {
        ...pagePreferences,
        timeZone: option.value
      }
      setTimeZoneOption(option);
      setPagePreferences(newPreferences);
      dayjs.tz.setDefault(option.value);
    } else {
      newPreferences = {
        ...pagePreferences,
        timeZone: guessedTz
      }
      setTimeZoneOption(defaultTimeZone);
      setPagePreferences(newPreferences);
    }
    localStorage.setItem('pagePreferences', JSON.stringify(newPreferences));
  }, [pagePreferences]);

  const selectThemeChanger = React.useCallback((theme: Theme) => (darkModeEnabled ? {
    ...theme,
    colors: {
      ...theme.colors,
      ...selectDarkTheme
    },
  } : theme), [darkModeEnabled])

  return (
    <>
      <Navbar expand="lg" sticky="top" onToggle={navExpandedToggle} expanded={navExpanded} className={"bg-body-secondary"}>
        <Container className={'page-width'}>
          <Navbar.Brand>
            <Link to={'/'}>MSU Borealis</Link>
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav"/>
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="mr-auto" onSelect={closeNav}>
              <LinkContainer to={'/'}>
                <Nav.Link>Flight Tracking</Nav.Link>
              </LinkContainer>
              <Nav.Link href={'#'}>About</Nav.Link>
              <Nav.Link href={'#'}>Contact</Nav.Link>
            </Nav>
            <Form className="d-flex pe-4 ms-auto">
              <Form.Check
                type="switch"
                id="dark-mode-switch"
                label="Dark Mode"
                onChange={toggleDarkMode}
                checked={darkModeEnabled}
              />
            </Form>
            <Nav.Link>
              <Button variant={darkModeEnabled ? 'outline-light' : 'outline-dark'} onClick={handleShowPreferences}>
                <i className="bi bi-gear"></i>
              </Button>
            </Nav.Link>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Modal show={showPreferences} onHide={handleClosePreferences} centered>
        <Modal.Header>
          Preferences
        </Modal.Header>
        <Modal.Body>
          <h3>General</h3>
          <Row>
            <Column xs={5}>
              Units
            </Column>
            <Column style={{display: 'flex', justifyContent: 'right'}}>
              <Toggle
                onClick={togglePrefUnits}
                active={pagePreferences.useMetric}
                onElement={<span>Metric</span>}
                offElement={<span>Imperial</span>}
                size={'sm'}
              />
            </Column>
          </Row>
          <Row className={'pt-2'}>
            <Column xs={5}>
              Time Zone
            </Column>
            <Column>
              <Select<TimezoneSelectOption>
                value={timeZoneOption}
                onChange={timeZonePrefChange}
                options={Intl.supportedValuesOf('timeZone').map((timeZone) => ({
                  value: timeZone,
                  label: timeZone
                }) as TimezoneSelectOption)}
                menuPosition="fixed"
                isSearchable={true}
                isClearable={true}
                theme={selectThemeChanger}
              />
            </Column>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant={'secondary'} onClick={handleClosePreferences}>Close</Button>
        </Modal.Footer>
      </Modal>
    </>
  )
}

export default React.memo(Navigation);