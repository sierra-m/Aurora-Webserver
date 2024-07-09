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
import format from 'string-format'
import { weightedAverage, roundToTwo } from "./helpers"

format.extend(String.prototype, {});

const MINIMUM_SATELLITES = 5;

/**
 * Zip two arrays together as an object
 * @param {Array} keys
 * @param {Array} values
 */
const zip = (keys, values) => {
  return keys.reduce((result, current, index) => {
    result[current] = values[index];
    return result;
  }, {});
};

/**
 * Get but safe
 * @param {Object} thing The object to test
 * @param {String} field The field to look for
 * @param def A default return
 * @returns {*} A field if it exists
 */
const safe_get = (thing, field, def) => {
  return thing[field] || def
};

/**
 * Shorthand to check for defined
 * @param thing
 * @returns {boolean}
 */
const defined = (thing) => {
  return typeof thing !== 'undefined'
};

const rfind = (list, filter) => {
  for (let i = list.length - 1; i > -1; i--) {
    if (filter(list[i])) return list[i]
  }
  return null;
};

class FlightPoint {
  /*
  * Represents one frame in time/space from a flight
  *
  */
  constructor (fields, data) {
    let received = zip(fields, data);
    this.uid = safe_get(received, 'uid', "");
    this.datetime = safe_get(received, 'datetime', 0);
    this.latitude = safe_get(received, 'latitude', 0.00);
    this.longitude = safe_get(received, 'longitude', 0.00);
    this.altitude = safe_get(received, 'altitude', 0.0);
    this.vertical_velocity = safe_get(received, 'vertical_velocity', 0.0);
    this.ground_speed = safe_get(received, 'ground_speed', 0.0);
    this.satellites = safe_get(received, 'satellites', 0);
    this.velocity_vector = safe_get(received, 'velocity_vector', []);

    if (defined(this.datetime) && this.datetime !== null) {
      this.datetime = moment.utc(this.datetime, 'X')
    }

    // `velocity_vector` is stored [lat, long] for simplicity
    /*if (this.velocity_vector) {
      this.velocity_vector = {
        offLat: this.velocity_vector[0],
        offLong: this.velocity_vector[1]
      }
    }*/
  }

  /**
   * Exports coordinates in an object readable
   * by react-google-maps
   * Altitude is added for compatibility with :class:`InfoWindow`s
   * @returns {{lng: Number, lat: Number}}
   */
  coords () {
    return {
      lat: this.latitude,
      lng: this.longitude,
      alt: this.altitude
    }
  }
}

class Flight {
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
  constructor (packet) {
    this.fields = packet.fields;
    this.data = packet.data;

    this.sats_col = this.fields.indexOf('satellites');
    this.dt_col = this.fields.indexOf('datetime');

    this.data.sort((a, b) => {
      if (a[this.dt_col] < b[this.dt_col]) return -1;
      if (a[this.dt_col] > b[this.dt_col]) return 1;
      return 0;
    });

    this.start_date = null;
    this.stats = packet.stats;
    if (defined(this.data[0]) && this.data[0] !== null) {
      let firstPoint = new FlightPoint(this.fields, this.data[0]);
      this.start_date = firstPoint.datetime;
      this.uid = firstPoint.uid
    }
  }

  get (index) {
    return new FlightPoint(this.fields, this.data[index])
  }

  /**
   * Takes a generic Object data point, assumes same fields
   * @param point
   */
  add (point) {
    let toAdd = [];
    for (let field of this.fields) {
      if (field in point) {
        toAdd.push(point[field])
      }
    }
    const thisPoint = new FlightPoint(this.fields, toAdd);
    const lastPoint = this.lastPoint();
    const offsetLat = thisPoint.latitude - lastPoint.latitude;
    const offsetLong = thisPoint.longitude - lastPoint.longitude;
    const offsetSecs = thisPoint.datetime - lastPoint.datetime;
    // build the vector in degrees per second

    // velocity_vector is always last
    const vector = [offsetLat / offsetSecs, offsetLong / offsetSecs];
    this.updateRaw(this.data.length - 1, 'velocity_vector', vector);
    toAdd.push([0, 0]);
    this.data.push(toAdd);

    // update statistics
    this.updateStats(point);

    return this.data.length - 1
  }

  updateStats (point) {
    if (point.altitude > this.stats.max_altitude) this.stats.max_altitude = point.altitude;
    if (point.altitude < this.stats.min_altitude) this.stats.min_altitude = point.altitude;
    if (Math.abs(point.vertical_velocity) > Math.abs(this.stats.max_vertical)) this.stats.max_vertical = point.vertical_velocity;
    if (point.ground_speed > this.stats.max_ground) this.stats.max_ground = point.ground_speed;
    this.stats.avg_ground = roundToTwo(weightedAverage(this.stats.avg_ground, this.data.length, point.ground_speed));
  }

  updateRaw (index, field, value) {
    if (!this.fields.includes(field)) throw new TypeError(`${field} is not a field of Flight`);
    const fieldCol = this.fields.indexOf(field);
    this.data[index][fieldCol] = value;
  }

  /**
   * Search by unix timestamp
   * @param {Number} datetime
   */
  getByUnix (datetime) {
    let datapoint = this.data.find(x => x[this.dt_col] === datetime);
    if (defined(datapoint)) {
      return new FlightPoint(datapoint);
    }
  }

  pointValid = (point) => point[this.sats_col] > MINIMUM_SATELLITES;

  lastPoint () {
    return this.get(this.data.length - 1)
  }

  firstPoint () {
    return this.get(0)
  }

  lastValidPoint () {
    const found = rfind(this.data, x => this.pointValid(x));
    return new FlightPoint(this.fields, found);
  }

  firstValidPoint () {
    const found = this.data.find(x => this.pointValid(x));
    return new FlightPoint(this.fields, found)
  }

  toString () {
    return 'Flight:[date={},uid={}]'.format(this.start_date, this.uid)
  }

  coords () {
    const lat_col = this.fields.indexOf('latitude');
    const lng_col = this.fields.indexOf('longitude');
    const sats_col = this.fields.indexOf('satellites');
    return this.data.reduce((filtered, row) => {
      if (row[sats_col] > MINIMUM_SATELLITES) {
        filtered.push({
          lat: row[lat_col],
          lng: row[lng_col]
        })
      }
      return filtered
    }, [])
  }

  altitudes () {
    const alt_col = this.fields.indexOf('altitude');
    // const dt_col = this.fields.indexOf('datetime');
    const sats_col = this.fields.indexOf('satellites');

    return this.data.reduce((filtered, row) => {
      if (row[sats_col] > MINIMUM_SATELLITES) {
        filtered.push(row[alt_col])
      }
      return filtered
    }, [])
  }

  indexOf (flightPoint) {
    const unix = flightPoint.datetime.unix();
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[this.dt_col] === unix)
        return i;
    }
    return null;
  }

  datetimes () {

    return this.data.reduce((filtered, row) => {
      if (this.pointValid(row)) {
        filtered.push(moment.unix(row[this.dt_col]).format('YYYY-MM-DD HH:mm:ss'))
      }
      return filtered
    }, [])
  }

  pinStates () {
    const inputCol = this.fields.indexOf('input_pins');
    const outputCol = this.fields.indexOf('output_pins');
    const altitudeCol = this.fields.indexOf('altitude');
    return this.data.reduce((filtered, row) => {
      if (this.pointValid(row)) {
        filtered.push({
          input: row[inputCol],
          output: row[outputCol],
          timestamp: row[this.dt_col],
          altitude: row[altitudeCol]
        })
      }
      return filtered
    }, [])
  }

  * [Symbol.iterator] () {
    for (let i = 0; i < this.data.length; i++) {
      if (this.pointValid(this.data[i])) {
        yield new FlightPoint(this.fields, this.data[i])
      }
    }
  }

  /**
   * Inclusive-exclusive format iterator ending at a point
   * @param flightPoint
   * @returns {IterableIterator<FlightPoint>}
   */
  * iterateTo (flightPoint) {
    const end = this.indexOf(flightPoint);
    for (let i = 0; i < end; i++) {
      if (this.pointValid(this.data[i]))
        yield new FlightPoint(this.fields, this.data[i]);
    }
  }

  /**
   * Inclusive-exclusive format index iterator
   * @param low
   * @param high
   * @returns {IterableIterator<*>}
   */
  * iterateOn (low, high) {
    if (low < 0 || low > high || high > this.data.length) throw new RangeError(`Index limits out of range [0,${this.data.length})`);
    for (let i = low; i < high; i++) {
      yield new FlightPoint(this.fields, this.data[i]);
    }
  }
}

export { Flight, FlightPoint };