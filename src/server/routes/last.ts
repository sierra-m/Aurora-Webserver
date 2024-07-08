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
import {type FlightRegistryQuery, query} from '../util/pg'
import dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";

dayjs.extend(utc);

const router = express.Router();

interface LastParameters {
  imei?: string
}

export default class LastRoute {
  router: express.Router;

  constructor () {
    this.router = express.Router();

    this.router.get('/', this.handleLast);
  }

  async handleLast (req: express.Request, res: express.Response, next: express.NextFunction) {
    const lastQuery: LastParameters = req.query;
    if (lastQuery?.imei != null) {
      const hoursAgo = dayjs.utc().subtract(2, 'hours').format('YYYY-MM-DD HH:mm:ss');
      const partial = lastQuery.imei.toString().substring(8);
      const result = await query<FlightRegistryQuery>(
          `SELECT * FROM public."flight-registry" WHERE (uid::bit(64) & x'0000000007ffffff')::bigint=$1::bigint, datetime>$2 ORDER BY datetime DESC`,
          [partial, hoursAgo]
      );
      if (result.length > 0) {
        res.json(result[0]);
      } else {
        res.status(404);
        res.send(`No recent points found for IMEI ${req.query.imei}`);
      }
    } else {
      res.status(400);
      res.send('Please supply an imei')
    }
  }
}

router.get('/', async (req, res, next) => {

});
