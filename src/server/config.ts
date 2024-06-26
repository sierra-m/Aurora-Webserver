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

// API keys

const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Constants

// Minimum satellites required for a flight point to be considered valid
const MIN_SATELLITES = 6;
// Number of IMEI digits to expose to a requesting client
const EXPOSED_IMEI_DIGITS = 5;
// Number of hours a flight will show up in active flights list
const ACTIVE_FLIGHT_DELTA_HRS = 12;
// Minimum required time delta between contiguous points in a flight
const CONTIG_FLIGHT_DELTA_HRS = 2;
 // Minimum allowed altitude for flight point assignment
const MIN_ALTITUDE = -86;
// Maximum allowed altitude for flight point assignment
const MAX_ALTITUDE = 60_000;

export {
    GOOGLE_MAPS_KEY,
    MIN_SATELLITES,
    EXPOSED_IMEI_DIGITS,
    ACTIVE_FLIGHT_DELTA_HRS,
    CONTIG_FLIGHT_DELTA_HRS,
    MIN_ALTITUDE,
    MAX_ALTITUDE
}