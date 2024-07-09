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

class ObjectIterator {
  constructor (thing, sorter) {
    this.thing = thing;
    this.sorter = sorter;
  }

  *[Symbol.iterator]() {
    let sorted = null;
    if (this.sorter) {
      sorted = Object.keys(this.thing).sort(this.sorter);
    } else {
      sorted = Object.keys(this.thing).sort();
    }
    for (let key of sorted) {
      yield this.thing[key]
    }
  }
}


/**
 * Displays altitude in `M m (F ft)` format
 * @param number
 * @returns {*}
 */
const dispMetersFeetBr = (number) => (
  `${number} m\n(${(number * 3.28084).toFixed(2)} ft)`
);

/**
 * Displays altitude in `M m (F ft)` format
 * @param number
 * @returns {*}
 */
const dispMetersFeet = (number) => (
  `${number} m (${(number * 3.28084).toFixed(2)} ft)`
);

const mpsToFps = (number) => (
  `${number} m/s (${(number * 3.28084).toFixed(2)} ft/s)`
);

const kphToMph = (number) => (
  `${number} kph (${(number * 0.621371).toFixed(2)} mph)`
);

/**
 * Calculates the weighted average
 * @param current
 * @param count
 * @param toAdd
 * @returns {number}
 */
const weightedAverage = (current, count, toAdd) => {
  return current * count / (count + 1) + toAdd / (count + 1);
};

const roundToTwo = (num) => {
  return Math.round(num * 100) / 100;
};

export {ObjectIterator, dispMetersFeetBr, dispMetersFeet, weightedAverage, roundToTwo, mpsToFps, kphToMph}