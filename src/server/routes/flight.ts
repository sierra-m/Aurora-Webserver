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
import {type FlightsQuery, query} from '../util/pg'
import * as dayjs from "dayjs";
import Stats, {type FlightStats} from '../util/stats'
import KMLEncoder from '../util/kml'
import * as config from '../config'
import {standardizeUID, getFlightByUID, getUIDByFlight} from '../util/uid';
import ModemList, {type RedactedModem} from "../util/modems.ts";


interface JsvDataFormat {
  fields: Array<string>;
  data: Array<Array<string | number>>;
}

interface JsvFormat {
  fields: Array<string>;
  data: Array<Array<string | number>>;
  modem: RedactedModem;
  stats: FlightStats;
}

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
 */
const reformatData = async (data: Array<FlightsQuery>): Promise<JsvDataFormat | undefined> => {
  const output = {
    fields: [],
    data: []
  };
  // Data must have at least one point
  if (data[0] === null || data[0] === undefined) return;

  const unixTimestamps = data.map(point => dayjs.utc(point.datetime, 'YYYY-MM-DD HH:mm:ss').unix());

  const jsvData = [];

  // Build point-to-point velocities
  for (let i = 0; i < data.length - 1; i++) {
    const nextPoint = data[i + 1];
    const thisPoint = data[i];
    const offsetLat = nextPoint.latitude - thisPoint.latitude;
    const offsetLong = nextPoint.longitude - thisPoint.longitude;
    const offsetSecs = unixTimestamps[i + 1] - unixTimestamps[i];
    // build the vector in degrees per second
    const velocity_vector = (i == 0) ? [0, 0] : [offsetLat / offsetSecs, offsetLong / offsetSecs];
    jsvData.push([...Object.values(data[i]), velocity_vector]);
  }
  const jsvFields = [...Object.keys(data[0]), 'velocity_vector'];

  return {
    fields: jsvFields,
    data: jsvData
  };
};

/**
 * Takes a database result and returns a JSON packet optimized for
 * transmission to client website
 */
const jsvFormatter = async (data: Array<FlightsQuery>, modem: RedactedModem): Promise<JsvFormat | undefined> => {
  const stats = Stats.build(data);
  const jsvData = await reformatData(data);
  if (jsvData) {
    return {
      fields: jsvData.fields,
      data: jsvData.data,
      modem: modem,
      stats: stats
    };
  }
};

const csvFormatter = async (data: Array<FlightsQuery>) => {
  let raw = Object.keys(data[0]).join(',') + '\r\n'
  raw += data.map(point => (
      Object.values(point).map( value => `${value}`).join(',')
  )).join('\r\n');

  return raw;
};

interface FlightParameters {
  uid?: string,
  modem_name?: string,
  date?: string,
  format?: string
}

export default class FlightRoute {
  router: express.Router;
  modemList: ModemList;

  constructor (modemList: ModemList) {
    this.router = express.Router();
    this.modemList = modemList;

    this.router.get('/', this.handleFlight)
  }

  async handleFlight (req: express.Request, res: express.Response, next: express.NextFunction) {
    try {
      const flightQuery: FlightParameters = req.query;
      let uid = null;
      let modem;
      // For filenames
      let modem_name: string, date: string;
      // Parse query args
      if (flightQuery.uid != null) {
        uid = standardizeUID(flightQuery.uid);
        if (!uid) {
          res.status(400).json({err: `UID improperly formatted`});
          return;
        }
        const flight = await getFlightByUID(uid);
        if (!flight) {
          res.status(404).json({err: `No flight found for UID ${uid}`});
          return;
        }
        modem = this.modemList.get(flight.imei);
        if (!modem) {
          res.status(500).json({err: `No modem found for UID ${uid}`});
          console.error(`No modem found for UID ${uid} (IMEI ${flight.imei})!`);
          return;
        }

        modem_name = modem.name;
        date = flight.start_date;
      } else if (flightQuery.modem_name && flightQuery.date) {
        // Validate params
        if (flightQuery.modem_name.length > 20 || !flightQuery.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          res.status(400).json({err: `Modem name too long or date not in form YYYY-MM-DD`});
          return;
        }
        // Pull modem info from modem name
        modem = this.modemList.getByName(flightQuery.modem_name);
        if (!modem) {
          res.status(404).json({err: `No modem found for name '${flightQuery.modem_name}'`})
          return;
        }
        // Find corresponding uid
        uid = await getUIDByFlight(modem.imei, dayjs.utc(flightQuery.date, 'YYYY-MM-DD'));
        if (!uid) {
          res.status(404).json({err: `No uid found for combo ('${flightQuery.modem_name}', ${flightQuery.date})`})
          return;
        }

        modem_name = modem.name;
        date = flightQuery.date;
      } else {
        res.status(400).json({err: `Bad request: missing required params`})
        return;
      }
      let result = await query<FlightsQuery>(
          'SELECT * FROM public."flights" WHERE uid=$1 AND satellites>=$2 ORDER BY datetime ASC',
          [uid!, config.MIN_SATELLITES]
      );

      if (flightQuery.format === 'csv') {
        const csv = await csvFormatter(result);

        res.type('csv');
        res.setHeader('Content-Disposition', `attachment; filename=flight-${modem_name}-${date}.csv`);
        res.setHeader('Content-Transfer-Encoding', 'binary');
        res.send(csv)
      } else if (flightQuery.format === 'kml') {
        const stats = Stats.build(result);
        const kml = await KMLEncoder.generate(modem, date, result, stats.maxAltitude);

        res.setHeader('Content-Type', `application/kml`);
        res.setHeader('Content-Disposition', `attachment; filename=flight-${modem_name}-${date}.kml`);
        res.setHeader('Content-Transfer-Encoding', 'binary');
        res.send(kml);
      } else {
        const jsv = await jsvFormatter(result, modem.getRedacted());
        if (jsv) {
          res.json(jsv);
        } else {
          res.status(404).json({'error': 'No data found for query'});
        }
      }
    } catch (e) {
      console.log(e);
      next(e)
    }
  }
}