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