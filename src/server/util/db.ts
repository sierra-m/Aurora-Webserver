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

import {query} from './pg'
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import type {FlightRegistryQuery} from "../types/db.ts";

/**
 *  Contains helper functions for working with common database queries
 */

// Returns flight registry query for uid. Note: start_date is a string in UTC format (YYYY-MM-DDTHH:MM:SSZ)
export const getFlightByUID = async (uid: string): Promise<FlightRegistryQuery | undefined> => {
  if (uid) {
    let result = await query<FlightRegistryQuery>(
      'SELECT * FROM public."flight-registry" WHERE uid=$1',
      [uid]
    );
    if (result.length > 0) {
      return result[0];
    }
  }
}


export const getUIDByFlight = async (imei: number, startDate: dayjs.Dayjs): Promise<string | undefined> => {
  const isoDate = startDate.format('YYYY-MM-DD HH:mm:ss');
  let result = await query<{uid: string}>(
    'SELECT uid FROM public."flight-registry" WHERE imei=$1 AND start_date=$2',
    [imei, isoDate]
  );
  if (result.length > 0) {
    return result[0].uid;
  }
}
