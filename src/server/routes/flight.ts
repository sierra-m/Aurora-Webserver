/*
* The MIT License (MIT)
*
* Copyright (c) 2019 Sierra MacLeod
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

import express from 'express'
import format from 'string-format'
import { query } from '../util/pg'
import moment from 'moment'
import { encodeUID, extractIMEI, extractDate } from "../snowflake"
import Stats from '../stats'
import json2csv from 'json2csv'
import KMLEncoder from '../util/kml'
import * as config from '../config'
import {standardizeUID, getFlightByUID, getUIDByFlight} from '../util/uid';

const router = express.Router();
router.modemList = undefined;

format.extend(String.prototype, {});

const exists = (thing) => thing !== null;

/**
 * Data is retrieved from postgres as an array of
 * full javascript objects. Sending these via json results
 * in many repetitive, unnecessary field names.
 *
 * Before sending flight data, we use this function to turn
 * a list of objects:
 *    [ {altitude=1000, latitude=52, ...}, {altitude=1001, latitude=53, ...} ]
 *
 * to a CSV-like object optimized for json transmission:
 *    {
 *      fields: ['altitude', 'latitude', ...],
 *      data: [
 *        [1000, 52, ...],
 *        [1001, 53, ...]
 *      ],
 *      modem: {
 *        partialImei: '04940',
 *        org: 'Some-Uni',
 *        name: 'MDM001'
 *      }
 *    }
 *
 * The `datetime` property is also converted to a unix integer
 *
 * @param {Array} data
 * @returns {Promise<Object>}
 */
const reformatData = async (data) => {
  const output = {
    fields: [],
    data: []
  };
  // Data must have at least one point
  if (data[0] === null || data[0] === undefined) return output;

  // Reformat datetime as unix
  for (let point of data) {
    point.datetime = moment.utc(point.datetime, 'YYYY-MM-DD HH:mm:ss').unix();
  }

  // Build point-to-point velocities
  for (let i = 0; i < data.length - 1; i++) {
    const nextPoint = data[i + 1];
    const thisPoint = data[i];
    const offsetLat = nextPoint.latitude - thisPoint.latitude;
    const offsetLong = nextPoint.longitude - thisPoint.longitude;
    const offsetSecs = nextPoint.datetime - thisPoint.datetime;
    // build the vector in degrees per second
    data[i].velocity_vector = [offsetLat / offsetSecs, offsetLong / offsetSecs];
  }
  data[data.length - 1].velocity_vector = [0, 0];

  // Unzip keys from values
  output.fields = Object.keys(data[0]);
  output.data = data.map(point => Object.values(point));

  return output;
};

/**
 * Takes a database result and returns a JSON packet optimized for
 * transmission to client website
 * @param data
 * @returns {Promise<Object>}
 */
const jsvFormatter = async (data) => {
  const stats = await Stats.build(data);
  const jsv = await reformatData(data);
  jsv.stats = stats;
  return jsv;
};

const csvFormatter = async (data) => {
  const fields = ['uid', 'datetime', 'latitude', 'longitude', 'altitude', 'vertical_velocity', 'ground_speed', 'satellites', 'input_pins', 'output_pins'];
  const opts = { fields };

  return await json2csv.parseAsync(data, opts);
};

router.get('/', async (req, res, next) => {
  try {
    let uid = null;
    let modem;
    // For filenames
    let modem_name, date;
    if (req.query.uid) {
      uid = standardizeUID(req.query.uid);
      if (!uid) {
        await res.status(400).json({err: `UID improperly formatted`});
        return;
      }
      const flight = await getFlightByUID(uid);
      if (!flight) {
        await res.status(404).json({err: `No flight found for UID ${uid}`});
        return;
      }
      modem = router.modemList.get(flight.imei);

      modem_name = modem.name;
      date = flight.start_date.format('YYYY-MM-DD');
    } else if (req.query.modem_name && req.query.date) {
      // Validate params
      if (req.query.modem_name.length > 20 || !req.query.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        await res.status(400).json({err: `Modem name too long or date not in form YYYY-MM-DD`});
        return;
      }
      // Pull modem info from modem name
      modem = router.modemList.getByName(req.query.modem_name);
      if (!modem) {
        await res.status(404).json({err: `No modem found for name '${req.query.modem_name}'`})
        return;
      }
      // Find corresponding uid
      uid = await getUIDByFlight(modem.imei, moment.utc(req.query.date, 'YYYY-MM-DD'));
      if (!uid) {
        await res.status(404).json({err: `No uid found for combo ('${req.query.modem_name}', ${req.query.date})`})
        return;
      }

      modem_name = modem.name;
      date = req.query.date;
    }
    let result = await query(
        'SELECT * FROM public."flights" WHERE uid=$1 AND satellites>=$2 ORDER BY datetime ASC',
        [uid, config.MIN_SATELLITES]
    );

    if (req.query.format === 'csv') {
      const csv = await csvFormatter(result);

      res.type('csv');
      res.setHeader('Content-Disposition', `attachment; filename=flight-${modem_name}-${date}.csv`);
      res.setHeader('Content-Transfer-Encoding', 'binary');
      await res.send(csv)
    } else if (req.query.format === 'kml') {
      const stats = await Stats.build(result);
      const kml = await KMLEncoder.generate(modem, date, result, stats.max_altitude);

      res.setHeader('Content-Type', `application/kml`);
      res.setHeader('Content-Disposition', `attachment; filename=flight-${modem_name}-${date}.kml`);
      res.setHeader('Content-Transfer-Encoding', 'binary');
      await res.send(kml);
    } else {
      const jsv = await jsvFormatter(result);
      // Attach modem info for clarity
      jsv.modem = router.modemList.getRedacted(modem.imei);
      await res.json(jsv);
    }
  } catch (e) {
    console.log(e);
    next(e)
  }
});

export default router;