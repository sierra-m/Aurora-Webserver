CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Authentication Tokens
CREATE TABLE IF NOT EXISTS public.auth (
    id serial,
    client character varying(10) NOT NULL,
    token character varying(32) NOT NULL
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public.auth
    OWNER to "postgres";
COMMENT ON TABLE public.auth
    IS 'List of valid client/token pairs for authentication';


-- Modem information
CREATE TABLE IF NOT EXISTS public.modems (
    imei bigint NOT NULL,
    organization text,
    name text NOT NULL,
    CONSTRAINT imei_pkey PRIMARY KEY (imei),
    UNIQUE (name)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public.modems
    OWNER to "postgres";
COMMENT ON TABLE public.modems
    IS 'List of valid modems for allowable flight point insertions, for whitelisting and IMEI searching';


-- Flight registry
CREATE TABLE IF NOT EXISTS public."flight-registry"
(
    start_date date NOT NULL,
    imei bigint NOT NULL,
    uid uuid NOT NULL DEFAULT gen_random_uuid(),
    CONSTRAINT "flight-registry_pkey" PRIMARY KEY (start_date, imei),
    CONSTRAINT "Date Valid" CHECK (start_date > '2013-01-01'::date),
    CONSTRAINT "IMEI Valid" CHECK (imei > '0'::bigint)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public."flight-registry"
    OWNER to "postgres";
COMMENT ON TABLE public."flight-registry"
    IS 'Central flight data repository. Rows represent physical flights, where a flight is a collection of data points. The flight''s Unique Identifier (UID) is calculated using the v4 UUID standard.';


-- Flight points
CREATE TABLE IF NOT EXISTS public.flights
(
    uid uuid NOT NULL,
    datetime timestamp without time zone NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    altitude real NOT NULL,
    vertical_velocity real NOT NULL,
    ground_speed real NOT NULL,
    satellites smallint,
    input_pins smallint,
    output_pins smallint,
    CONSTRAINT flights_pkey PRIMARY KEY (uid, datetime),
    CONSTRAINT "Datetime Valid" CHECK (datetime > '2013-01-01 00:00:00'::timestamp without time zone),
    CONSTRAINT "Altitude Positive" CHECK (altitude > -282::double precision),
    CONSTRAINT "Ground Speed Positive" CHECK (ground_speed >= 0::double precision),
    CONSTRAINT "Satellites Positive" CHECK (satellites >= 0)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public.flights
    OWNER to "postgres";
COMMENT ON TABLE public.flights
    IS 'Flight points repository. Flights are grouped entirely by UID and as such should be queried that way';