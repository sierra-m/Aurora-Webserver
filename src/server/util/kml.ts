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

import type {Modem} from "./modems.ts";
import type {FlightsQuery} from "../types/db.ts";

const fs = require('fs').promises;

export default class KmlEncoder {
  /**
   * Generates a KML file from flight db query
   * @param modem The selected modem
   * @param date The selected date
   * @param data A database query result
   * @param maxAltitude
   * @returns {Promise<String>}
   */
  static async generate (modem: Modem, date: string, data: Array<FlightsQuery>, maxAltitude: number) {
    let file: string = await fs.readFile('./src/res/balloon_flight.kml.tmpt', "utf8");

    let ascendingData: string = '';
    let descendingData: string = '';
    let maxPoint;
    let isAscending = true;
    for (let point of data) {
      let coord = `${point.longitude},${point.latitude},${point.altitude}\n`;
      if (isAscending) {
        ascendingData += coord;
      } else {
        descendingData += coord;
      }
      if (point.altitude === maxAltitude) {
        maxPoint = point;
        isAscending = false;
      }
    }

    let firstPoint = data[0];
    let lastPoint = data[data.length - 1];
    const fileData = {
      uid: firstPoint.uid,
      modemName: modem.name,
      date: date,
      ascentCoords: ascendingData,
      descentCoords: descendingData,

      startLong: firstPoint.longitude,
      startLat: firstPoint.latitude,
      startAlt: firstPoint.altitude,

      midLong: maxPoint!.longitude,
      midLat: maxPoint!.latitude,
      midAlt: maxPoint!.altitude,

      endLong: lastPoint.longitude,
      endLat: lastPoint.latitude,
      endAlt: lastPoint.altitude
    };

    for (const key in fileData) {
      const val = `${(fileData as Record<string, string | number>)[key]}`;
      file = file.replaceAll(`{${key}}`, val);
    }

    return file;
  }
}