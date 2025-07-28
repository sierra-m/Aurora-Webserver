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

export const GOOGLE_MAPS_KEY = import.meta.env.VITE_REACT_APP_GOOGLE_MAPS_API_KEY;

export const GOOGLE_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;
export const GOOGLE_MAP_NIGHT_ID = import.meta.env.VITE_GOOGLE_MAPS_NIGHT_ID;

export const MINIMUM_SATELLITES = 5;

export const UPDATE_DELAY = 5000;

export const ACTIVE_DELAY = 30000;

// Center over middle of U.S.
export const DEFAULT_MAP_CENTER = {lat: 39.833333, lng: -98.583333};