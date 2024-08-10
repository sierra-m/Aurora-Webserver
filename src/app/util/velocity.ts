
/*
*   [ Altitude vs Air Density Third-Order Curve Coefficients ]
*
*   To calculate air density at a given altitude, three range-specific
*   third-order equations are used as an approximation. For a profile `p`
*   and altitude `h`, the corresponding calculation may be found as:
*
*       Density = p[0]*h**3 + p[1]*h**2 + p[2]*h + p[3]
*
*   The following coefficients were calculated in ranges via data from
*   U.S. Standard Atmosphere 1976, a summary of which may be found here:
*   https://www.engineeringtoolbox.com/standard-atmosphere-d_604.html
*/

// Lower Atmosphere: less than 16000 meters
const lowerProfile = [-7.65207397e-14,  4.42990042e-09, -1.17903183e-04,  1.22505436e+00];

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

// Middle Atmosphere: between 16000 and 50000 meters
const middleProfile = [-8.50099123e-15,  1.06256818e-09, -4.41401853e-05,  6.14126066e-01];

// Upper Atmosphere: above 50000 meters
const upperProfile = [-1.99935300e-17,  5.00749995e-12, -4.19733974e-07,  1.17853260e-02];


const little_g = 9.80665;

/*
*   [ Calculate Air Density at Altitude ]
*
*   Given an altitude in meters, this function approximates
*   the resulting air density in kg/m^3
*/
const getDensity = (altitude: number) => {
  const third_order = (coef: number[], x: number) => coef[0]*x**3 + coef[1]*x**2 + coef[2]*x + coef[3];

  if (altitude <= 16000)
    return third_order(lowerProfile, altitude);
  else if (altitude > 16000 && altitude <= 50000)
    return third_order(middleProfile, altitude);
  else if (altitude > 50000)
    return third_order(upperProfile, altitude);
};

/*
*   [ Calculate Payload Velocity in Descent ]
*
*   Returns the velocity of a payload with mass `m`,
*   parachute diameter `D` and drag coefficient `C` at
*   altitude `h`. The formula for velocity of this falling
*   object is:
*
*             +-                  -+ ^ 0.5
*             |     8 * m * g      |
*       v = - |  ----------------  |
*             |  pi * C * p * D^2  |
*             +-                  -+
*   or
*
*       v = -sqrt( (8 * m * g) / (pi * C * p * D^2) )
*
*   where
*
*       g (gravity acceleration) = 9.80665
*
*       p (air density) = `getDensity(a)`
*
*   The negative sign indicates the payload is, in fact, falling.
*/
const getVelocity = (altitude: number, mass: number, paraDiameter: number, dragCoeff: number) => {
  let density = getDensity(altitude)!;

  // density might be negative for too high an altitude ¯\_(ツ)_/¯
  density = density > 0 ? density : 0.0000001;

  return -Math.sqrt((8 * mass * 9 * little_g) / (Math.PI * dragCoeff * density * paraDiameter**2));
};


export {getVelocity, getDensity}