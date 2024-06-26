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
import {query} from '../util/pg'
import {extractIMEI} from '../snowflake'
import moment from 'moment'
import ElevationAPI from '../util/elevation'
import {standardizeUID} from '../util/uid';

const router = express.Router();

format.extend(String.prototype, {});

const elevationAPI = new ElevationAPI();

/**
 * Aurora client update method
 * ===========================
 * Motivation: The client needs a way to request
 * new data points from the server to stay up-to-date.
 *
 * Process: Client posts to `/update` endpoint with
 * the most recent uid and datetime it has. Server
 * selects any data points later than this and
 * sends them back via json as a list. Server also
 * attaches current pin states and queries Google
 * elevation API for elevation of most recent point
 * if < 3000m.
 *
 * Request
 * -------
 * POST :: JSON {
 *   "uid": {{ string }},  // UUIDv4
 *   "datetime": {{ number }}  // Unix
 * }
 *
 * Response
 * --------
 * JSON {
 *   "update": {{ bool }},  // indicates success
 *   "result": {{ list[FlightPoint] }},
 *   "ground_elevation": {{ number }}
 * }
 */
router.post('/', async (req, res, next) => {
  try {
    if ('uid' in req.body && 'datetime' in req.body) {
      let uid = standardizeUID(req.body.uid);
      if (!uid) {
        await res.status(400).json({err: `UID improperly formatted`});
        return;
      }
      if (!Number.isInteger(req.body.datetime)) {
        await res.status(400).json({err: `Datetime must be in UNIX format`});
        return;
      }
      // Convert Unix to String
      let lastTime = moment.utc(req.body.datetime, 'X').format('YYYY-MM-DD HH:mm:ss');

      let result = await query(
          `SELECT * FROM public."flights" WHERE uid=$1 AND datetime>$2`,
          [uid, lastTime]
      );

      // Convert timestamps from String to Unix
      for (let row of result) {
        row.datetime = moment.utc(row.datetime, 'YYYY-MM-DD HH:mm:ss').unix();
      }

      // Create partial return packet
      let content = {
        update: result.length > 0,
        result: result
      };

      try {
        if (result.length > 0) {
          const point = result[result.length - 1];
          // TODO: enable when website is stable
          // if (point.altitude < 3000 && point.vertical_velocity < 0) {
          //   content.ground_elevation = await elevationAPI.request(point.latitude, point.longitude);
          // }
        }
      } catch (e) {
        console.log(`Update endpoint error: ${e}`);
      }

      await res.json(content);
    } else {
      await res.status(400).json({err: "Bad request"});
    }
  } catch (e) {
    console.log(e);
    next(e);
  }
});

export default router