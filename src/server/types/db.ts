export interface AuthQuery {
  client: string,
  token: string
}

export interface ModemQuery {
  imei: number, // pg returns bigint as string
  organization: string,
  name: string
}

export interface FlightRegistryQuery {
  start_date: string,
  imei: number,
  uid: string
}

export interface FlightsQuery {
  uid: string,
  datetime: string,
  latitude: number,
  longitude: number,
  altitude: number,
  vertical_velocity: number,
  ground_speed: number,
  satellites: number,
  input_pins: number,
  output_pins: number
}