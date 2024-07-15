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

import type {FlightsQuery} from "./pg.ts";

interface FlightStats {
  avgCoords: {
    lat: number;
    lng: number;
  }
  avgGroundSpeed: number;
  maxGroundSpeed: number;
  maxVerticalVel: number;
  maxAltitude: number;
  minAltitude: number;
}

export default class Stats {

  static build (data: Array<FlightsQuery>): FlightStats {
    let avgLat = 0;
    let avgLng = 0;
    let avgGround = 0;
    let maxAlt = 0;
    let minAlt = 100000;
    let fastestGround = 0;
    let fastestVertical = 0;

    for (let row of data) {
      avgLat += row.latitude;
      avgLng += row.longitude;
      avgGround += row.ground_speed;

      if (row.altitude > maxAlt) maxAlt = row.altitude;
      if (row.altitude < minAlt) minAlt = row.altitude;
      if (row.ground_speed > fastestGround) fastestGround = row.ground_speed;
      if (Math.abs(row.vertical_velocity) > fastestVertical) fastestVertical = row.vertical_velocity;
    }

    return {
      avgCoords: {
        lat: avgLat / data.length,
        lng: avgLng / data.length
      },
      avgGroundSpeed: (avgGround / data.length),
      maxGroundSpeed: fastestGround,
      maxVerticalVel: fastestVertical,
      maxAltitude: maxAlt,
      minAltitude: minAlt
    }
  }
}

export {type FlightStats}