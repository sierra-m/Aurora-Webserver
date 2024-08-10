
// modems
//-----------------------------------------------------
export interface RedactedModem {
  partialImei: string,
  org: string,
  name: string
}

// stats
//-----------------------------------------------------
export interface FlightStats {
  avgCoords: {
    lat: number;
    lng: number;
  }
  avgGroundSpeed: number;
  maxGroundSpeed: number;
  maxVerticalVel: number;
  maxAltitude: number;
  minAltitude: number;
}
