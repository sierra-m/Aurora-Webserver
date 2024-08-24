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

export const metersToFeet = (value: number) => value * 3.28084;

// Displays value in `M m/s (F ft/s)` format
export const mpsToFps = (value: number) => (
  `${value} m/s (${(value * 3.28084).toFixed(2)} ft/s)`
);

// Displays value in `K kph (M mph)` format
export const kphToMph = (value: number) => value * 0.621371;

export const displayMetersFeet = (value: number, useMetric: boolean) => useMetric ? `${value} m` : `${metersToFeet(value).toFixed(2)} ft`;

export const displayMpsFps = (value: number, useMetric: boolean) => useMetric ? `${value} m/s` : `${metersToFeet(value).toFixed(2)} f/s`;

export const displayKphMph = (value: number, useMetric: boolean) => useMetric ? `${value} kph` : `${kphToMph(value).toFixed(2)} mph`;

// Calculates the weighted average
export const weightedAverage = (current: number, count: number, toAdd: number) => {
  return current * count / (count + 1) + toAdd / (count + 1);
};

// Rounds value to two digits
export const roundToTwo = (value: number) => {
  return Math.round(value * 100) / 100;
};