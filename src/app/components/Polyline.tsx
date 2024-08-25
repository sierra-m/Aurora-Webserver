/**
 * MIT License
 *
 * Copyright (c) 2023 Vis.gl contributors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software
 * and associated documentation files (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge, publish, distribute,
 * sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial
 * portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
 * NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES
 * OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * Pulled from https://github.com/visgl/react-google-maps/blob/main/examples/geometry/src/components/polyline.tsx
 */

import {
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef
} from 'react';

import {GoogleMapsContext, useMapsLibrary} from '@vis.gl/react-google-maps';

import type {Ref} from 'react';

type PolylineEventProps = {
  onClick?: (e: google.maps.MapMouseEvent) => void;
  onDrag?: (e: google.maps.MapMouseEvent) => void;
  onDragStart?: (e: google.maps.MapMouseEvent) => void;
  onDragEnd?: (e: google.maps.MapMouseEvent) => void;
  onMouseOver?: (e: google.maps.MapMouseEvent) => void;
  onMouseOut?: (e: google.maps.MapMouseEvent) => void;
};

type PolylineCustomProps = {
  /**
   * this is an encoded string for the path, will be decoded and used as a path
   */
  encodedPath?: string;
};

export type PolylineProps = google.maps.PolylineOptions &
  PolylineEventProps &
  PolylineCustomProps;

export type PolylineRef = Ref<google.maps.Polyline | null>;

function usePolyline(props: PolylineProps) {
  const {
    onClick,
    onDrag,
    onDragStart,
    onDragEnd,
    onMouseOver,
    onMouseOut,
    encodedPath,
    ...polylineOptions
  } = props;
  // This is here to avoid triggering the useEffect below when the callbacks change (which happen if the user didn't memoize them)
  const callbacks = useRef<Record<string, (e: unknown) => void>>({});
  Object.assign(callbacks.current, {
    onClick,
    onDrag,
    onDragStart,
    onDragEnd,
    onMouseOver,
    onMouseOut
  });

  const geometryLibrary = useMapsLibrary('geometry');

  const polyline = useRef(new google.maps.Polyline()).current;
  // update PolylineOptions (note the dependencies aren't properly checked
  // here, we just assume that setOptions is smart enough to not waste a
  // lot of time updating values that didn't change)
  useMemo(() => {
    polyline.setOptions(polylineOptions);
  }, [polyline, polylineOptions]);

  const map = useContext(GoogleMapsContext)?.map;

  // update the path with the encodedPath
  useMemo(() => {
    if (!encodedPath || !geometryLibrary) return;
    const path = geometryLibrary.encoding.decodePath(encodedPath);
    polyline.setPath(path);
  }, [polyline, encodedPath, geometryLibrary]);

  // create polyline instance and add to the map once the map is available
  useEffect(() => {
    if (!map) {
      if (map === undefined)
        console.error('<Polyline> has to be inside a Map component.');

      return;
    }

    polyline.setMap(map);

    return () => {
      polyline.setMap(null);
    };
  }, [map]);

  // attach and re-attach event-handlers when any of the properties change
  useEffect(() => {
    if (!polyline) return;

    // Add event listeners
    const gme = google.maps.event;
    [
      ['click', 'onClick'],
      ['drag', 'onDrag'],
      ['dragstart', 'onDragStart'],
      ['dragend', 'onDragEnd'],
      ['mouseover', 'onMouseOver'],
      ['mouseout', 'onMouseOut']
    ].forEach(([eventName, eventCallback]) => {
      gme.addListener(polyline, eventName, (e: google.maps.MapMouseEvent) => {
        const callback = callbacks.current[eventCallback];
        if (callback) callback(e);
      });
    });

    return () => {
      gme.clearInstanceListeners(polyline);
    };
  }, [polyline]);

  return polyline;
}

/**
 * Component to render a polyline on a map
 */
export const Polyline = forwardRef((props: PolylineProps, ref: PolylineRef) => {
  const polyline = usePolyline(props);

  useImperativeHandle(ref, () => polyline, []);

  return null;
});