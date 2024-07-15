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

import moment from 'moment'
import { weightedAverage, roundToTwo } from "./helpers"
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import {MINIMUM_SATELLITES} from "../config.ts";
import {type JsvFormat, type Vector, type JsvFieldTypes, jsvFields} from "../../server/routes/flight.ts";
import type {FlightStats} from "../../server/util/stats.ts";


dayjs.extend(utc);

interface FlightPointCoords {
  lat: number,
  lng: number,
  alt: number
}

const getSafe = (key: string, data: JsvFieldTypes, fieldType: string, def: any) => {
  const item = data[jsvFields.indexOf(key)];
  return (typeof item === fieldType) ? item : def;
}

class FlightPoint {
  uid: string;
  timestamp: number;
  datetime: dayjs.Dayjs | undefined;
  latitude: number;
  longitude: number;
  altitude: number;
  verticalVelocity: number;
  groundSpeed: number;
  satellites: number;
  inputPins: number;
  outputPins: number;
  velocityVector: Vector;
  /*
  * Represents one frame in time/space from a flight
  *
  */
  constructor (uid: string, fields: Array<string>, data: JsvFieldTypes) {
    this.uid = uid;
    this.timestamp = getSafe('timestamp', data, 'number', 0);
    this.latitude = getSafe('latitude', data, 'number', 0.0);
    this.longitude = getSafe('longitude', data, 'number', 0.0);
    this.altitude = getSafe('altitude', data, 'number', 0.0);
    this.verticalVelocity = getSafe('verticalVelocity', data, 'number', 0.0);
    this.groundSpeed = getSafe('groundSpeed', data, 'number', 0.0);
    this.satellites = getSafe('satellites', data, 'number', 0.0);
    this.inputPins = getSafe('inputPins', data, 'number', 0);
    this.outputPins = getSafe('outputPins', data, 'number', 0);
    this.velocityVector = getSafe('velocityVector', data, 'object', [0, 0]);

    if (this.timestamp) {
      this.datetime = dayjs.utc(this.datetime, 'X')
    }
  }

  /**
   * Exports coordinates in an object readable
   * by react-google-maps
   * Altitude is added for compatibility with :class:`InfoWindow`
   */
  coords (): FlightPointCoords {
    return {
      lat: this.latitude,
      lng: this.longitude,
      alt: this.altitude
    }
  }
}

interface PinStatesData {
  input: number;
  output: number;
  timestamp: number;
  altitude: number;
}

class Flight {
  fields: Array<string>;
  data: Array<JsvFieldTypes>;

  satsCol: number;
  timestampCol: number;

  startDate: dayjs.Dayjs | undefined;
  stats: FlightStats;
  uid: string;
  /**
   * Represents a selected flight
   *
   * Packets are sent like:
   *    {
   *      fields: ['altitude', 'latitude', ...],
   *      data: [
   *        [1000, 52, ...],
   *        [1001, 53, ...]
   *      ]
   *    }
   * Data is kept in this unzipped form for easy sorting and
   * then zipped upon an object request
   *
   * @param {Object} packet The data packet
   */
  constructor (packet: JsvFormat) {
    this.fields = packet.fields;
    this.data = packet.data;

    this.satsCol = this.fields.indexOf('satellites');
    this.timestampCol = this.fields.indexOf('timestamp');

    this.data.sort((a, b) => {
      if (a[this.timestampCol] < b[this.timestampCol]) return -1;
      if (a[this.timestampCol] > b[this.timestampCol]) return 1;
      return 0;
    });

    this.stats = packet.stats;
    this.uid = packet.uid;
    if (this.data.length > 0 && this.data[0] != null) {
      let firstPoint = new FlightPoint(this.uid, this.fields, this.data[0]);
      this.startDate = firstPoint.datetime;
    }
  }

  get (index: number) {
    return new FlightPoint(this.uid, this.fields, this.data[index])
  }

  /**
   * Takes a generic Object data point, assumes same fields
   * @param point
   */
  add (point: {[key: string]: number | Vector}) {
    let toAdd = [];
    for (let field of jsvFields) {
      if (field in point) {
        toAdd.push(point[field]);
      }
    }
    if (toAdd.length < jsvFields.length) {
      return;
    }
    const thisPoint = new FlightPoint(this.uid, this.fields, toAdd as JsvFieldTypes);
    const lastPoint = this.lastPoint();
    const offsetLat = thisPoint.latitude - lastPoint.latitude;
    const offsetLong = thisPoint.longitude - lastPoint.longitude;
    const offsetSecs = thisPoint.timestamp - lastPoint.timestamp;
    // build the vector in degrees per second

    // velocityVector is always last. Vector between the new point and the last
    // point is stored in the last point, and a new empty vector is set in the
    // inserted point
    const vector: Vector = [offsetLat / offsetSecs, offsetLong / offsetSecs];
    this.updateRaw(this.data.length - 1, 'velocityVector', vector);
    toAdd.push([0, 0] as Vector);
    this.data.push(toAdd as JsvFieldTypes);

    // update statistics
    this.updateStats(thisPoint);

    return this.data.length - 1
  }

  updateStats (point: FlightPoint) {
    if (point.altitude > this.stats.maxAltitude) this.stats.maxAltitude = point.altitude;
    if (point.altitude < this.stats.minAltitude) this.stats.minAltitude = point.altitude;
    if (Math.abs(point.verticalVelocity) > Math.abs(this.stats.maxVerticalVel)) this.stats.maxVerticalVel = point.verticalVelocity;
    if (point.groundSpeed > this.stats.maxGroundSpeed) this.stats.maxGroundSpeed = point.groundSpeed;
    this.stats.avgGroundSpeed = roundToTwo(weightedAverage(this.stats.avgGroundSpeed, this.data.length, point.groundSpeed));
  }

  updateRaw (index: number, field: string, value: number | Vector) {
    if (!this.fields.includes(field)) throw new TypeError(`${field} is not a field of Flight`);
    const fieldCol = this.fields.indexOf(field);
    this.data[index][fieldCol] = value;
  }

  /**
   * Search by unix timestamp
   */
  getByUnix (timestamp: number): FlightPoint | undefined {
    let datapoint = this.data.find(x => x[this.timestampCol] === timestamp);
    if (datapoint) {
      return new FlightPoint(this.uid, this.fields, datapoint);
    }
  }

  pointValid = (point: JsvFieldTypes) => (point[this.satsCol] as number) > MINIMUM_SATELLITES;

  lastPoint () {
    return this.get(this.data.length - 1);
  }

  firstPoint () {
    return this.get(0);
  }

  lastValidPoint () {
    const found = this.data.findLast(x => this.pointValid(x));
    if (found) {
      return new FlightPoint(this.uid, this.fields, found);
    }
  }

  firstValidPoint () {
    const found = this.data.find(x => this.pointValid(x));
    if (found) {
      return new FlightPoint(this.uid, this.fields, found);
    }
  }

  toString () {
    return `Flight:[date=${this.startDate},uid=${this.uid}]`
  }

  coords () {
    const lat_col = this.fields.indexOf('latitude');
    const lng_col = this.fields.indexOf('longitude');
    return this.data.reduce((filtered: Array<{lat: number, lng: number}>, row) => {
      if (this.pointValid(row)) {
        filtered.push({
          lat: row[lat_col] as number,
          lng: row[lng_col] as number
        })
      }
      return filtered;
    }, [])
  }

  altitudes () {
    const alt_col = this.fields.indexOf('altitude');
    return this.data.reduce((filtered: Array<number>, row) => {
      if (this.pointValid(row)) {
        filtered.push(row[alt_col] as number);
      }
      return filtered;
    }, [])
  }

  indexOf (flightPoint: FlightPoint) {
    const foundIndex = this.data.findIndex((row) => row[this.timestampCol] === flightPoint.timestamp);
    if (foundIndex > -1) {
      return foundIndex;
    }
  }

  formattedDatetimes () {
    return this.data.reduce((filtered: Array<string>, row) => {
      if (this.pointValid(row)) {
        filtered.push(dayjs.unix(row[this.timestampCol] as number).format('YYYY-MM-DD HH:mm:ss'))
      }
      return filtered
    }, []);
  }

  pinStates () {
    const inputCol = this.fields.indexOf('input_pins');
    const outputCol = this.fields.indexOf('output_pins');
    const altitudeCol = this.fields.indexOf('altitude');
    return this.data.reduce((filtered: Array<PinStatesData>, row) => {
      if (this.pointValid(row)) {
        filtered.push({
          input: row[inputCol] as number,
          output: row[outputCol] as number,
          timestamp: row[this.timestampCol] as number,
          altitude: row[altitudeCol] as number
        })
      }
      return filtered
    }, []);
  }

  * [Symbol.iterator] () {
    for (let i = 0; i < this.data.length; i++) {
      if (this.pointValid(this.data[i])) {
        yield new FlightPoint(this.uid, this.fields, this.data[i])
      }
    }
  }

  /**
   * Inclusive-exclusive format iterator ending at a point
   */
  * iterateTo (flightPoint: FlightPoint) {
    const end = this.indexOf(flightPoint);
    if (end != null) {
      for (let i = 0; i < end; i++) {
        if (this.pointValid(this.data[i]))
          yield new FlightPoint(this.uid, this.fields, this.data[i]);
      }
    }
  }

  /**
   * Inclusive-exclusive format index iterator
   */
  * iterateOn (low: number, high: number) {
    if (low < 0 || low > high || high > this.data.length) throw new RangeError(`Index limits out of range [0,${this.data.length})`);
    for (let i = low; i < high; i++) {
      yield new FlightPoint(this.uid, this.fields, this.data[i]);
    }
  }
}

export { Flight, FlightPoint };