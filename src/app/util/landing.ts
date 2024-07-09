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

// eslint-disable-next-line
import { Flight, FlightPoint } from './flight'
import { weightedAverage } from "./helpers"

const ALTITUDE_BLOCK = 150;
const MAX_SPEED = 6.0386e-4;  // degrees/s, close to 150 mph


class Vector {
  constructor (vector) {
    this.data = vector;
  }

  get xPos () {
    return this.data[0];
  }

  get yPos () {
    return this.data[1];
  }

  add = (vector) => {
    return new Vector([this.data[0] + vector.xPos, this.data[1] + vector.yPos])
  };

  map = (func) => {
    return new Vector(this.data.map(func))
  };

  dot = (vector) => {
    return this.xPos * vector.xPos + this.yPos + vector.yPos;
  };

  avg = (vector) => {
    return new Vector([(this.xPos + vector.xPos) / 2, (this.yPos + vector.yPos) / 2])
  };

  weightedAvg = (toAdd, count) => {
    return new Vector([weightedAverage(this.xPos, count, toAdd.xPos), weightedAverage(this.yPos, count, toAdd.yPos)])
  };

  toString () {
    return `Vector:[${this.xPos},${this.yPos}]`
  }

  toList () {
    return this.data;
  }
}

const getBlock = (altitude) => altitude - (altitude % ALTITUDE_BLOCK);
const velocitiesValid = (flightPoint) => (
  Math.abs(flightPoint.velocity_vector[0]) <= MAX_SPEED && Math.abs(flightPoint.velocity_vector[1] <= MAX_SPEED)
);

export default class LandingPrediction {
  constructor (flight, func) {
    /** @type Flight */
    this.flight = flight;
    this.altitudes = {};
    this.velocityFunc = func;

    this.lastVelocityCount = 0;
  }

  load = (flight) => {
    this.flight = flight
  };

  setVelocityFunc = (func) => {
    this.velocityFunc = func
  };

  /**
   * Builds a wind layer vector modal in blocks of, say, 200 meters.
   * A layer block is considered to belong to its lowest value, so
   * for example, the 5000 block on a 200 meter scale would represent
   * the altitudes 5000m to 5199m.
   * @returns {Promise<void>}
   */
  buildAltitudeProfile = async () => {
    const firstPoint = this.flight.firstPoint();
    await this.buildProfile(0, this.flight.data.length);
    await this.fixBlocks(firstPoint.altitude, null, true);
  };

  buildProfile = async (lowIndex, highIndex) => {
    let currentBlock = getBlock(this.flight.get(lowIndex).altitude);
    let velocityCount = this.lastVelocityCount;

    /** @type FlightPoint */
    for await (let flightPoint of this.flight.iterateOn(lowIndex, highIndex)) {
      // Use only flight points with reasonable velocities
      if (velocitiesValid(flightPoint)) {
        const block = getBlock(flightPoint.altitude);
        if (currentBlock !== block) {
          currentBlock = block;
          velocityCount = 0;
        }

        // if there are is an average already here, average new flight point with this
        if (this.altitudes.hasOwnProperty(block)) {
          // Convert lists to `Vector`s for computation
          const existing = new Vector(this.altitudes[block]);
          const additional = new Vector(flightPoint.velocity_vector);

          this.altitudes[block] = existing.weightedAvg(additional, velocityCount).toList();
          velocityCount += 1;
        } else {
          // add first velocity
          this.altitudes[block] = flightPoint.velocity_vector;
          velocityCount = 1;
        }
      }
    }
    this.lastVelocityCount = velocityCount; // save this so it can pick up seamlessly when adding points
  };

  /**
   * Interpolate velocities for empty blocks
   * As block total is not tracked, pass `null` to `highAltitude` for the end of the blocks
   * @param altitudeStart
   * @param altitudeEnd
   * @param setLowest
   * @returns {Promise<void>}
   */
  fixBlocks = async (altitudeStart, altitudeEnd, setLowest) => {
    // Strip the keys of `this.altitudes` and sort them
    const blocks = Object.keys(this.altitudes).map(x => parseInt(x)).sort((a, b) => {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });

    let highestBlock;
    if (!altitudeEnd) {
      highestBlock = blocks[blocks.length - 1]
    } else {
      highestBlock = getBlock(altitudeEnd)
    }
    let lowestBlock = getBlock(altitudeStart);

    // there exists a chance `altitudeEnd` is actually lower
    if (highestBlock < lowestBlock) {
      [highestBlock, lowestBlock] = [lowestBlock, highestBlock];
    }

    if (setLowest) this.lowestBlock = lowestBlock;

    /*
    * There exists the possibility of multiple consecutive blocks not existing.
    * These helper functions find the next highest or lowest existing block to
    * account for this.
    **/
    const findNextHighest = (currentBlock) => {
      for (let i = currentBlock + ALTITUDE_BLOCK; i < highestBlock; i += ALTITUDE_BLOCK) {
        if (this.altitudes.hasOwnProperty(i)) return i;
      }
      return highestBlock;
    };

    const findNextLowest = (currentBlock) => {
      for (let i = currentBlock - ALTITUDE_BLOCK; i > lowestBlock; i -= ALTITUDE_BLOCK) {
        if (this.altitudes.hasOwnProperty(i)) return i;
      }
      return lowestBlock;
    };

    // Iterate on set (lowestBlock, highestBlock) as endpoints are assumed to exist
    for (let block = lowestBlock + ALTITUDE_BLOCK; block < highestBlock; block += ALTITUDE_BLOCK) {
      //if (block === 1800) console.log("We're on 1800 again");
      if (!(block in this.altitudes)) {
        //if (block === 1800) console.log("1800 is not in altitudes");
        const above = findNextHighest(block);
        const below = findNextLowest(block);
        /*console.log(`Above is ${above} and the altitudes value is ${this.altitudes[above]}`);
        console.log(`Below is ${below} and the altitudes value is ${this.altitudes[below]}`);*/

        const aboveVelocity = new Vector(this.altitudes[above]);
        const belowVelocity = new Vector(this.altitudes[below]);
        this.altitudes[block] = aboveVelocity.avg(belowVelocity).toList();
      }
    }

  };

  updateAltitudeProfile = async (indexA, indexB) => {
    await this.buildProfile(indexA, this.flight.data.length);

    // index a and b are not necessarily ordered but assumed ends of update range
    let lowPoint = this.flight.get(indexA);
    let highPoint = this.flight.get(indexB);
    await this.fixBlocks(lowPoint.altitude, highPoint.altitude);
  };

  /**
   *
   * @param {FlightPoint} flightPoint
   */
  calculateLanding = (flightPoint) => {
    let start = new Vector([flightPoint.latitude, flightPoint.longitude]);
    //let testCount = false;
    const maxBlock = getBlock(flightPoint.altitude);
    // Inclusive-Inclusive
    for (let block = this.lowestBlock; block <= maxBlock; block += ALTITUDE_BLOCK) {
      // Velocity direction not important, assumed negative
      let terminalSpeed = Math.abs(this.velocityFunc(block));
      if (terminalSpeed === 0) terminalSpeed = 0.0000001;

      // seconds == (s/m) * m == (m/s)^-1 * m
      const blockDuration = Math.pow(terminalSpeed, -1) * ALTITUDE_BLOCK;

      const blockVelocity = new Vector(this.altitudes[block]);
      /*if (blockVelocity['data'] === undefined) {
        console.log(`blockVelocity data is undefined. Block vector for block ${block} is ${this.altitudes[block]}`)
        console.log(`(block in this.altitudes): ${block in this.altitudes}`)
      }*/
      const displacement = blockVelocity.map(x => x * blockDuration);
      /*if (isNaN(displacement.data[0]) && !testCount) {
        testCount = true;
        console.log(`NaN detected. Terminal Velocity: ${terminalSpeed}`);
        console.log('Displacement:');
        console.log(displacement);
        console.log('Block Velocity:');
        console.log(blockVelocity);
        console.log('Block Duration:');
        console.log(blockDuration);
        console.log(`BLOCK: ${block}`);
      }*/
      start = start.add(displacement);
    }
    //console.log(start);
    // Return an object conforming with react-google-maps framework
    const raw = start.toList();
    return {
      lat: raw[0],
      lng: raw[1]
    }
  }
}

export { Vector }