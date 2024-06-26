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

import * as axios from "axios";

import {GOOGLE_MAPS_KEY} from '../config.ts'

const fiveHours = 5 * 60 * 60;
const cacheSize = 100;

/**
 * A simple wrapper around the Google elevation API that
 * caches elevations to reduce calls on the endpoint
 *
 * The `cache` is an array of objects
 * {
 *   coord: [latitude, longitude],
 *   elv: elevation
 * }
 * Once the cache reaches the specified limit, it begins shifting old
 * entries out.
 */
export default class ElevationAPI {
  cache = [];

  async request (latitude: number, longitude: number) {
    // Check for coords in cache
    for (let packet of this.cache) {
      if (packet.coord.lat === latitude && packet.coord.lng === longitude) {
        return packet.elv;
      }
    }

    // Fetch new elevation
    const res = await axios.get(`https://maps.googleapis.com/maps/api/elevation/json?locations=${latitude},${longitude}&key=${GOOGLE_MAPS_KEY}`);

    if (res.data.results.length > 0) {
      const newPacket = {
        coord: {lat: latitude, lng: longitude},
        elv: data.results[0].elevation
      };
      this.cache.push(newPacket);
      if (this.cache.length > cacheSize) this.cache.shift();
      return newPacket.elv;
    }
  }
}