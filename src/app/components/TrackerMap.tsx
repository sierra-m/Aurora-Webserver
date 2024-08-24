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

import React from 'react'
import {GoogleMap, Marker, InfoWindow, Polyline, Circle, useJsApiLoader} from "@react-google-maps/api"
import {GOOGLE_MAPS_KEY} from '../config'

import greenBalloon from '../images/greenBalloon.png'
import parachuteIcon from '../images/parachuteIcon45.png'
import greenIcon from '../images/greenIcon.png'
import orangeIcon from '../images/orangeIcon.png'

import {chooseRandomIcon} from "../util/balloonIcons";
import type {Position, FlightPointCoords} from "../util/flight.ts";
import {FlightPoint} from "../util/flight.ts";
import {displayMetersFeet} from "../util/helpers.ts";
import type {ActiveFlight, FlightsByDate} from "./Tracking.tsx";
import type {PagePreferences} from "./Navigation.tsx";
import {mapDarkTheme} from "../util/themes.ts";


const balloonColors = [
  '#0000FF',
  '#9932CC',
  '#228B22',
  '#DC143C',
  '#1E90FF',
  '#FFA500',
  '#FF4500',
  '#FA8072',
  '#C71585',
  '#4B0082'
];

// Insert imported API key for security
const googleMapsAPI_URL = `https://maps.googleapis.com/maps/api/js?v=3&key=${GOOGLE_MAPS_KEY}&libraries=geometry,drawing,places`;

const calcGroupSelect = (uid: string, digits: number, groupSize: number) => (parseInt(uid.slice(-digits), 16) % groupSize);

const chooseRandomColor = (uid: string) => (balloonColors[calcGroupSelect(uid, 1, balloonColors.length)]);

type CloseMarkerFunc = () => void;


const coordAngle = (from: Position, to: Position) => {
  return Math.atan2(to.lat - from.lat, to.lng - from.lng)
};

const coordDistance = (a: Position, b: Position) => {
  return Math.sqrt((a.lat - b.lat)**2 + (a.lng - b.lng)**2)
};


interface InfoMarkerProps {
  updateLastWindowClose: (closer: CloseMarkerFunc) => void;
  position: Position;
  altitude: string; // this is pre-formatted
  icon: string | google.maps.Icon | google.maps.Symbol;
  zIndex: number;
}

const InfoMarker = React.memo((props: InfoMarkerProps) => {
  /*
  *   `Marker` with integrated `InfoWindow` displaying
  *   geospatial position.
  *   Each info window visibility is managed by `isInfoShown`. To
  *   implement behaviour allowing only one window open at a time,
  *   the parent passes function `updateLastWindowClose()` to the InfoMarker
  *   via props. Upon opening info window, this function should be called
  *   with the marker's window close function. The parent then closes any
  *   currently open window and stores the new close function.
  */

  const [isInfoShown, setIsInfoShown] = React.useState(false);

  /*
  *   [ Info Window Closer ]
  *   Used by both info window onCloseClick() and parent
  */
  const closeInfoWindow = React.useCallback(() => {
    setIsInfoShown(false);
  }, [])

  /*
  *   [ Marker Click Callback ]
  *   When marker is clicked, opens the info window and
  *   updates parent with close function to close last info window
  */
  const onMarkerClicked = React.useCallback(() => {
    // Only close last window if opening a new one
    if (!isInfoShown) {
      props.updateLastWindowClose(closeInfoWindow);
    }
    setIsInfoShown(!isInfoShown);
  }, [props.updateLastWindowClose, isInfoShown]);

  /*
  *   [ Info Window Close Callback ]
  *   Closes the info window when "X" is clicked
  */
  const handleWindowClose = React.useCallback(() => {
    closeInfoWindow();
  }, []);

  return (
    <Marker position={props.position} onClick={onMarkerClicked} icon={props.icon} zIndex={props.zIndex}>
      {isInfoShown && <InfoWindow onCloseClick={handleWindowClose}>
        <p style={{color: '#181920'}}>
          <strong>Latitude:</strong> {props.position.lat}<br/>
          <strong>Longitude:</strong> {props.position.lng}<br/>
          <strong>Altitude:</strong> {props.altitude}
        </p>
      </InfoWindow>}
    </Marker>
  );
})

interface TrackerMapProps {
  defaultCenter: Position | null;
  coordinates: Array<Position> | null;
  startPosition: FlightPointCoords | null;
  endPosition: FlightPointCoords | null;
  selectedPoint: FlightPoint | null;
  landingZone: Position | null;
  selectPoint: (index: number) => void;
  activeFlights: Array<ActiveFlight>;
  modemsByDateList: Array<FlightsByDate>;
  darkModeEnabled: boolean;
  pagePreferences: PagePreferences;
}

function TrackerMap (props: TrackerMapProps) {

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_KEY as string
  })

  // local map object created in render
  const [map, setMap] = React.useState<google.maps.Map | null>(null);

  // holds close function for last opened info window
  const [lastWindowCloser, setLastWindowCloser] = React.useState<CloseMarkerFunc | null>(null);

  // Map load callback
  const onLoad = React.useCallback(function callback(map: google.maps.Map) {
    map.panTo({lat: 39.833333, lng: -98.583333});

    setMap(map); // save created map in local hook object
  }, [])

  React.useEffect(() => {
    if (props.startPosition) {
      map?.panTo(props.startPosition);
    }
  }, [props.startPosition])

  // Map unmount callback
  const onUnmount = React.useCallback(function callback(map: google.maps.Map) {
    setMap(null)
  }, [])

  /*
  *   [ Closes Last Opened InfoWindow ]
  *   Calls last InfoWindow closing function if
  *   present and updates state variable to new one
  */
  const handleLastWindowClose = React.useCallback((closer: CloseMarkerFunc) => {
    if (lastWindowCloser !== null) {
      console.log(`last window closer: ${lastWindowCloser}`);
      lastWindowCloser();
    }
    setLastWindowCloser(closer);
  }, [lastWindowCloser]);

  // Handles translating a selection of the polyline to a selection of a flight point
  const selectPoint = React.useCallback((event: google.maps.MapMouseEvent) => {
    if (event.latLng == null) {
      return;
    }
    if (props.coordinates == null) {
      console.error(`Tracker Map: selectPoint - coordinates do not exist`)
      return;
    }
    let selected = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng()
    };
    let minDist = 10;  // 10 degrees is like 1000km
    let minIndex = 0;
    for (let i = 0; i < props.coordinates.length; i++) {
      let dist = coordDistance(props.coordinates[i], selected);
      if (dist < minDist) {
        minDist = dist;
        minIndex = i;
      }
    }
    props.selectPoint(minIndex);
  }, [props.coordinates, props.selectPoint]);

  return isLoaded ? (
    <GoogleMap
      zoom={(props.defaultCenter && 11) || 4}
      onLoad={onLoad}
      onUnmount={onUnmount}
      mapContainerStyle={{height: '85vh', maxHeight: '530px'}}
      options={props.darkModeEnabled ? {
        styles: mapDarkTheme
      } : {
        styles: []
      }}
    >
      {props.startPosition &&
      <InfoMarker
        position={props.startPosition}
        altitude={displayMetersFeet(props.startPosition.alt, props.pagePreferences.useMetric)}
        icon={greenIcon}
        updateLastWindowClose={handleLastWindowClose}
        zIndex={2}
      />
      }

      {props.coordinates &&
      <Polyline
        path={props.coordinates}
        options={{
          strokeColor: "#3cb2e2",
          strokeOpacity: 1.0,
          strokeWeight: 4,
          // TODO: review what exactly this does to the line
          geodesic: true
        }}
        onClick={selectPoint}
      />
      }

      {props.endPosition &&
      <InfoMarker
        position={props.endPosition}
        altitude={displayMetersFeet(props.endPosition.alt, props.pagePreferences.useMetric)}
        icon={orangeIcon}
        updateLastWindowClose={handleLastWindowClose}
        zIndex={1}
      />
      }
      {props.selectedPoint &&
        <InfoMarker
          position={props.selectedPoint.coords()}
          altitude={displayMetersFeet(props.selectedPoint.altitude, props.pagePreferences.useMetric)}
          icon={{
            url: chooseRandomIcon(props.selectedPoint.uid),
            scaledSize: new google.maps.Size(34, 48)
          }}
          updateLastWindowClose={handleLastWindowClose}
          zIndex={3}
        />
      }
      {(props.activeFlights.length > 0 && !props.selectedPoint && props.modemsByDateList.length === 0) &&
        props.activeFlights.map(partial => (
        <Marker
          position={{lat: partial.latitude, lng: partial.longitude}}
          icon={{
            url: chooseRandomIcon(partial.uid),
            scaledSize: new google.maps.Size(34, 48)
          }}
          onClick={partial.callback}
        />
      ))}
      {
        (props.modemsByDateList.length > 0 && !props.selectedPoint) &&
        props.modemsByDateList.map((flight) => (
          <Marker
            position={{lat: flight.startPoint.lat, lng: flight.startPoint.lng}}
            icon={{
              url: chooseRandomIcon(flight.uid),
              scaledSize: new google.maps.Size(34, 48)
            }}
            onClick={flight.callback}
          />
        ))
      }
      {props.landingZone &&
      <Circle
        center={new google.maps.LatLng(props.landingZone.lat, props.landingZone.lng)}
        radius={4025 /* meters = 5 miles */}
        options={{
          strokeColor: "#ff42b1"
        }}
      />
      }
      {props.landingZone &&  // TODO: fix altitude
      <InfoMarker
        position={props.landingZone}
        altitude={'---'}
        icon={parachuteIcon}
        updateLastWindowClose={handleLastWindowClose}
        zIndex={1}
      />
      }
    </GoogleMap>
  ) : (
    <></>
  )
}

export default React.memo(TrackerMap);