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

import type {RedactedModem, FlightStats} from "./util.ts";

// Flight endpoint
//-----------------------------------------------------
export type Vector = [lat: number, lng: number];

export type JsvFieldTypes = [
  timestamp: number,
  latitude: number,
  longitude: number,
  altitude: number,
  verticalVelocity: number,
  groundSpeed: number,
  satellites: number,
  inputPins: number,
  outputPins: number,
  velocityVector: Vector
];

export interface JsvFormat {
  uid: string;
  fields: Array<string>;
  data: Array<JsvFieldTypes>;
  modem: RedactedModem;
  stats: FlightStats;
}

export type JsvDataFormat = Pick<JsvFormat, 'data'>

export const jsvFields = [
  'timestamp',
  'latitude',
  'longitude',
  'altitude',
  'verticalVelocity',
  'groundSpeed',
  'satellites',
  'inputPins',
  'outputPins',
  'velocityVector'
];

// Meta endpoints
//-----------------------------------------------------
export interface FlightsResponse {
  date: string;
  uid: string;
}

export interface SearchRecord {
  uid: string;
  modem: RedactedModem;
  startPoint: {
    dt: string;
    lat: number;
    lng: number;
  }
}

export interface SearchResponse {
  found: number;
  results: Array<SearchRecord>;
}

// Type returned by the database query
export interface ActiveFlightsQuery {
  uid: string;
  datetime: string;
  latitude: number;
  longitude:  number;
  altitude: number;
}

// Type with extra context that we will return
export interface ActiveFlightRecord {
  uid: string;
  datetime: string;
  latitude: number;
  longitude: number;
  altitude: number;
  modem: RedactedModem;
  startDate: string;
}

// Full response
export interface RecentActiveFlightsResponse {
  status: string;
  points?: Array<ActiveFlightRecord>;
}

// Update endpoint
//-----------------------------------------------------
export interface UpdatePoint {
  timestamp: number;
  latitude: number;
  longitude: number;
  altitude: number;
  verticalVelocity: number;
  groundSpeed: number;
  satellites: number;
  inputPins: number;
  outputPins: number;
}

export interface UpdateResponse {
  update: boolean;
  result: UpdatePoint[];
  elevation?: number;
}