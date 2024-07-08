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

import pg from 'pg'
import dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";

dayjs.extend(utc);

// Create a new pg connection pool
const pgPool = new pg.Pool();

// Fix the date and datetime parsers to not auto-format local time
pg.types.setTypeParser(1082, (str: string) => str);
pg.types.setTypeParser(1114, (str: string) => dayjs.utc(str).format());
// fix bigint and bigserial converting to int
pg.types.setTypeParser(20, parseInt);

interface AuthQuery {
  client: string,
  token: string
}

interface ModemQuery {
  imei: number, // pg returns bigint as string
  organization: string,
  name: string
}

interface FlightRegistryQuery {
  start_date: string,
  imei: number,
  uid: string
}

interface FlightsQuery {
  uid: string,
  datetime: string,
  latitude: number,
  longitude: number,
  altitude: number,
  vertical_velocity: number,
  ground_speed: number,
  satellites: number,
  input_pins: number,
  output_pins: number
}

/**
 * Makes a database query
 * @param command The query to make
 * @param values Array of values to insert, for param insertion
 * @returns {Promise<array>} The resulting rows as an array
 */
const query = async <Type>(command: string, values?: Array<string | number | Array<number>>): Promise<Array<Type>> => {
  let client = await pgPool.connect();
  let result;

  try {
    await client.query('BEGIN');
    result = await client.query({
      text: command,
      values: values
    });
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return result.rows;
};

export {query, type AuthQuery, type ModemQuery, type FlightRegistryQuery, type FlightsQuery}