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

export default class Stats {

  static build (data) {
    let avg_lat = 0;
    let avg_long = 0;
    let avg_ground = 0;
    let max_alt = 0;
    let min_alt = 100000;
    let fastest_ground = 0;
    let fastest_vertical = 0;

    for (let row of data) {
      avg_lat += row.latitude;
      avg_long += row.longitude;
      avg_ground += row.ground_speed;

      if (row.altitude > max_alt) max_alt = row.altitude;
      if (row.altitude < min_alt) min_alt = row.altitude;
      if (row.ground_speed > fastest_ground) fastest_ground = row.ground_speed;
      if (Math.abs(row.vertical_velocity) > fastest_vertical) fastest_vertical = row.vertical_velocity;
    }

    return {
      avg_coords: {
        lat: avg_lat / data.length,
        long: avg_long / data.length
      },
      avg_ground: (avg_ground / data.length).toFixed(2),
      max_ground: fastest_ground,
      max_vertical: fastest_vertical,
      max_altitude: max_alt,
      min_altitude: min_alt
    }
  }
}