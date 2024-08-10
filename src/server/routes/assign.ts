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

import * as express from "express";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

import {query} from "../util/pg";
import { FlightPoint } from "../util/flightpoint";
import * as config from "../config"
import {DatabaseError} from "pg";

import type ModemList from "../util/modems.ts";
import type {FlightRegistryQuery} from "../types/db.ts";


dayjs.extend(utc);

export default class AssignRoute {
  router: express.Router;
  modemList: ModemList;

  constructor(modemList: ModemList) {
    this.router = express.Router();
    this.modemList = modemList;

    this.router.post('/', this.handleAssign.bind(this));
    this.router.get('/', async (req, res, next) => {
      res.sendStatus(400);
    });
  }

  async insertPoint (flightPoint: FlightPoint, uid: string) {
    const formattedDatetime = flightPoint.datetime.format('YYYY-MM-DD HH:mm:ss');
    await query(
        ('INSERT INTO public."flights"' +
            '(uid, datetime, latitude, longitude, altitude, vertical_velocity, ground_speed, satellites, input_pins, output_pins) ' +
            'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)'),
        [
          uid,
          formattedDatetime,
          flightPoint.latitude,
          flightPoint.longitude,
          flightPoint.altitude,
          flightPoint.vertical_velocity,
          flightPoint.ground_speed,
          flightPoint.satellites,
          flightPoint.input_pins,
          flightPoint.output_pins
        ]
    );
  };

  async handleAssign (req: express.Request, res: express.Response) {
    if ('point' in req.body) {

      const flightPoint = new FlightPoint(req.body.point);

      if (flightPoint.altitude < config.MIN_ALTITUDE) {
        res.status(400).json({
          status: 'error',
          data: `Altitude invalid: below ${config.MIN_ALTITUDE}m, flight point rejected`
        });
        console.log(`Rejected point: altitude too low`);
        return;
      }
      if (flightPoint.altitude > config.MAX_ALTITUDE) {
        res.status(400).json({
          status: 'error',
          data: `Altitude invalid: above ${config.MAX_ALTITUDE}m, flight point rejected`
        });
        console.log(`Rejected point: altitude too high`);
        return;
      }

      // TODO: implement protocol buffer/refactor iris
      // const bad_fields = flightPoint.checkInvalidFields();
      // if (bad_fields.length > 0) {
      //   res.status(403).json({
      //     status: 'error',
      //     data: `Flight point fields are incorrectly formatted: ${bad_fields}`
      //   });
      //   console.log(`Rejected point: bad fields: ${bad_fields}`);
      //   return;
      // }

      // Check IMEI is in allow list
      if (!this.modemList.has(flightPoint.imei)) {
        res.status(403).json({
          status: 'error',
          data: `Modem IMEI ${flightPoint.imei} not in allowed list, datapoint rejected`
        });
        console.log(`Rejected point: bad imei: ${flightPoint.imei}`);
        return;
      }

      // Check if flight entry exists for this point from the last day (in UTC) specifically. This is
      // a variable time window starting from 00:00:00 and ending at the timestamp of the point.
      const startDate = flightPoint.datetime.startOf('day').format('YYYY-MM-DD HH:mm:ss');
      let result = await query<FlightRegistryQuery>(
          `SELECT * FROM public."flight-registry" WHERE imei=$1 AND start_date=$2`,
          [flightPoint.imei, startDate]);

      if (result.length > 0) {
        try {
          await this.insertPoint(flightPoint, result[0].uid);
          res.json({
            status: 'success',
            type: 'today',
            flight: result[0].uid
          });
        } catch (e) {
          if (e instanceof DatabaseError && e.code === "23505") {
            res.status(400).json({
              status: 'error',
              data: 'flight point violates unique constraint, rejected'
            });
          } else {
            res.status(500).json({
              status: 'error',
              data: `internal server error when inserting flight point for case 'today'`
            });
            console.log(e);
            console.log('Today error');
          }
        }
      } else {
        // If there are no points from today in the registry, we check if there are any points in the last X number
        // of hours, defined by `CONTIG_FLIGHT_DELTA_HRS`. This allows points spanning across the UTC 24-hour
        // wraparound to be appended to the end of a flight which started the previous day. Once the delta between
        // incoming flight points exceeds `CONTIG_FLIGHT_DELTA_HRS`, a new flight will be created, with the start date
        // recorded as 'today'

        const hoursAgo = dayjs.utc().subtract(config.CONTIG_FLIGHT_DELTA_HRS, 'hours').format('YYYY-MM-DD HH:mm:ss');
        let result = await query<{uid: string}>(
            `SELECT uid FROM public."flight-registry" WHERE imei=$1 AND uid IN ` +
            `(SELECT DISTINCT ON (uid) uid FROM public."flights" WHERE datetime>=$2)`,
            [flightPoint.imei, hoursAgo]
        );

        // If we find a matching flight, append this flight point to it
        if (result.length > 0) {
          try {
            await this.insertPoint(flightPoint, result[0].uid);
            res.json({
              status: 'success',
              type: 'recent',
              flight: result[0].uid
            });
          } catch (e) {
            if (e instanceof DatabaseError && e.code === "23505") {
              res.status(400).json({
                status: 'error',
                data: 'flight point violates unique constraint, rejected'
              });
            } else {
              res.status(500).json({
                status: 'error',
                data: `internal server error when inserting flight point for case 'recent' for uid ${result[0].uid}`
              });
              console.log(e);
              console.log('Recent error');
            }
          }
          return;  // Explicit return to avoid flight creation
        }
        // Recent not found for point. Program flow continues to create
        console.log(`IMEI ${flightPoint.imei} new flight creation.`);
        try {
          const result = await query<{uid: string}>(
              `INSERT INTO public."flight-registry" (start_date, imei) VALUES ($1, $2) RETURNING uid`,
              [flightPoint.datetime.format('YYYY-MM-DD'), flightPoint.imei]
          );
          await this.insertPoint(flightPoint, result[0].uid);
          // TODO: change this to 201 CREATED
          res.json({
            status: 'success',
            type: 'created',
            flight: result[0].uid
          });
        } catch (e) {
          if (e instanceof DatabaseError && e.code === "23505") {
            res.status(400).json({
              status: 'error',
              data: 'flight point violates unique constraint, rejected'
            });
          } else {
            res.status(500).json({
              status: 'error',
              data: `internal server error when inserting flight point for case 'created' for imei ${flightPoint.imei}`
            });
            console.log(e);
            console.log('Created error');
          }
        }
      }
    } else {
      res.sendStatus(400);
    }
  }
}