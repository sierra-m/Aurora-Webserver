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
import utc from "dayjs/plugin/utc";
import ElevationAPI from '../util/elevation'
import {standardizeUID} from '../util/uid';


dayjs.extend(utc);

const elevationAPI = new ElevationAPI();

export default class UpdateRoute {
  router: express.Router;

  constructor () {
    this.router = express.Router();

    this.router.post('/', this.handleUpdate)
  }

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
  async handleUpdate (req: express.Request, res: express.Response, next: express.NextFunction) {
    try {
      if (req.body?.uid != null && req.body?.datetime != null) {
        let uid = standardizeUID(req.body.uid);
        if (!uid) {
          res.status(400).json({err: `UID improperly formatted`});
          return;
        }
        if (!Number.isInteger(req.body.datetime)) {
          res.status(400).json({err: `Datetime must be in UNIX format`});
          return;
        }
        // Convert Unix to String
        let lastTime = dayjs.utc(req.body.datetime, 'X').format('YYYY-MM-DD HH:mm:ss');

        let result = await query<FlightsQuery>(
            `SELECT * FROM public."flights" WHERE uid=$1 AND datetime>$2`,
            [uid, lastTime]
        );

        const formattedResult = result.map(row => ({
          datetime: dayjs.utc(row.datetime, 'YYYY-MM-DD HH:mm:ss').unix(),
          uid: row.uid,
          latitude: row.latitude,
          longitude: row.longitude,
          altitude: row.altitude,
          vertical_velocity: row.vertical_velocity,
          ground_speed: row.ground_speed,
          satellites: row.satellites,
          input_pins: row.input_pins,
          output_pins: row.output_pins
        }));

        // Create partial return packet
        let content = {
          update: formattedResult.length > 0,
          result: formattedResult
        };

        try {
          if (formattedResult.length > 0) {
            const point = formattedResult[formattedResult.length - 1];
            // TODO: enable when website is stable
            // if (point.altitude < 3000 && point.vertical_velocity < 0) {
            //   content.ground_elevation = await elevationAPI.request(point.latitude, point.longitude);
            // }
          }
        } catch (e) {
          console.log(`Update endpoint error: ${e}`);
        }

        res.json(content);
      } else {
        res.status(400).json({err: "Bad request"});
      }
    } catch (e) {
      console.log(e);
      next(e);
    }
  }
}
