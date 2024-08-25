/*
* The MIT License (MIT)
*
* Copyright (c) 2019 Sierra MacLeod
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

import * as express from "express";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

import {query} from "../util/pg";
import * as config from "../config";
import {getFlightByUID} from "../util/db";
import ModemList from "../util/modems.ts";

import type {
    FlightsResponse, SearchRecord, SearchResponse,
    ActiveFlightsQuery, ActiveFlightRecord, RecentActiveFlightsResponse
} from "../types/routes.ts";
import type {FlightRegistryQuery} from "../types/db.ts";

dayjs.extend(utc);

export default class MetaRoute {
    router: express.Router;
    modemList: ModemList;

    constructor (modemList: ModemList) {
        this.router = express.Router();
        this.modemList = modemList;

        this.router.get('/modems', this.handleModems.bind(this));
        this.router.get('/flights', this.handleFlights.bind(this));
        this.router.get('/search', this.handleSearch.bind(this));
        this.router.get('/active', this.handleActive.bind(this));
    }

    async handleModems (req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const modems = this.modemList.getRedactedSet();
            res.json(modems);
        } catch (e) {
            console.log(e);
            next(e);
        }
    }

    async handleFlights (req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            if ('modem_name' in req.query && req.query.modem_name !== null && typeof req.query.modem_name === 'string') {
                const modem = this.modemList.getByName(req.query.modem_name);

                if (!modem) {
                    res.status(404).json({err: `Invalid modem name '${req.query.modem_name}'`});
                    return;
                }

                let result = await query<FlightRegistryQuery>(
                    'SELECT * FROM public."flight-registry" WHERE imei=$1',
                    [modem.imei]
                );

                let flights = result.map(x => ({date: x.start_date, uid: x.uid}) as FlightsResponse);
                res.json(flights);
            } else {
                res.sendStatus(400);
            }
        } catch (e) {
            console.log(e);
            next(e);
        }
    }

    async handleSearch (req: express.Request, res: express.Response, next: express.NextFunction) {
        interface SearchParameters {
            modem_name?: string,
            org?: string,
            date?: string,
            end_date?: string,
        }
        try {
            const searchQuery: SearchParameters = req.query;
            const conditions: Array<{stmt: string, value: string | number | Array<number>}> = [];
            const has_modem_name = searchQuery?.modem_name != null;
            // Only search by org if modem name not provided
            const has_org = searchQuery?.org != null && !has_modem_name;
            const has_date = searchQuery?.date != null ;
            const has_end_date = searchQuery?.end_date != null;
            if (has_modem_name) {
                const modem = this.modemList.getByName(searchQuery.modem_name!);

                if (!modem) {
                    res.status(404).json({err: `Invalid modem name '${searchQuery.modem_name}'`});
                    return;
                }
                conditions.push({
                    stmt: `{table}.imei = {param}`,
                    value: modem.imei
                });
            }
            if (has_org) {
                const modems = this.modemList.getByOrg(searchQuery.org!);
                if (modems.length === 0) {
                    res.status(404).json({err: `No modems found for org '${searchQuery.org}'`});
                    return;
                }
                conditions.push({
                    stmt: `{table}.imei = ANY({param}::int[])`,
                    value: modems.map(x => x.imei)
                });
            }
            if (has_date) {
                if (!dayjs(searchQuery.date!, "YYYY-MM-DD", true).isValid()) {
                    res.status(400).json({err: `Date not in form 'YYYY-MM-DD'`});
                    return;
                }
                if (has_end_date) {
                    if (!dayjs(searchQuery.end_date!, "YYYY-MM-DD", true).isValid()) {
                        res.status(400).json({err: `End date not in form 'YYYY-MM-DD'`});
                        return;
                    }
                    conditions.push({
                        stmt: `{table}.start_date >= {param}`,
                        value: searchQuery.date!
                    });
                    conditions.push({
                        stmt: `{table}.start_date <= {param}`,
                        value: searchQuery.end_date!
                    });
                } else {
                    conditions.push({
                        stmt: `{table}.start_date = {param}`,
                        value: searchQuery.date!
                    });
                }
            }
            if (conditions.length === 0) {
                res.status(400).json({err: `Must give at least one condition`});
                return;
            }
            const formatted = conditions.map((value, index) => {
                const param = `$${index+1}`;
                return value.stmt.replace('{param}', param).replace('{table}', `r`);
            });
            const condition_set = formatted.join(' AND ');
            const values =  conditions.map((cond) => (cond.value));

            interface FlightSearchQuery {
                uid: string,
                datetime: string,
                latitude: number,
                longitude: number,
                imei: number
            }
            const result = await query<FlightSearchQuery>(
                `SELECT DISTINCT ON (f.uid) f.uid, f.datetime, f.latitude, f.longitude, r.imei ` +
                `FROM public."flights" f INNER JOIN public."flight-registry" r ON f.uid = r.uid ` +
                `WHERE ${condition_set} ORDER BY f.uid, f.datetime ASC`,
                values
            );

            const redactedResult: Array<SearchRecord> = result.map((item) => ({
                uid: item.uid,
                modem: this.modemList.get(item.imei)!.getRedacted(),
                startPoint: {
                    dt: item.datetime,
                    lat: item.latitude,
                    lng: item.longitude,
                }
            }));

            for (const result of redactedResult) {
                if (result.modem == null) {
                    res.status(500).json({err: `Internal server error`});
                    console.log(`Error: modem for uid ${result.uid}, datetime ${result.startPoint.dt} does not exist in modem list!`);
                    return;
                }
            }

            redactedResult.sort((a, b) => {
                if (a.modem!.name < b.modem!.name) {
                    return -1;
                }
                if (a.modem!.name > b.modem!.name) {
                    return 1;
                }
                return 0;
            });

            res.status(200).json({
                found: redactedResult.length,
                results: redactedResult
            } as SearchResponse);
        } catch (e) {
            console.log(e);
            next(e);
        }
    }

    async handleActive (req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            // Construct time delta of 12 hours ago, format for db query
            const hoursAgo = dayjs.utc().subtract(config.ACTIVE_FLIGHT_DELTA_HRS, 'hours').format('YYYY-MM-DD HH:mm:ss');
            // Selects distinct UIDs but picks the latest datetime of each UID
            // NOTE: This endpoint takes no user input, so direct query substitution is permitted
            let result = await query<{uid: string, datetime: string}>(
                `SELECT DISTINCT ON (uid) uid, datetime FROM public."flights" WHERE datetime>='${hoursAgo}' ORDER BY uid ASC, datetime DESC`
            );

            if (result.length > 0) {
                //console.log(`Active flight tuples: ${result.length}`);

                // Order uids into '1, 2, 3' string format
                const point_identifiers = result.map(point => `('${point.uid}', '${point.datetime}')`).join(', ');

                // Search for partial points from the list of uids
                // NOTE: This endpoint takes no user input, so direct query substitution is permitted

                const recentResult = await query<ActiveFlightsQuery>(
                    `SELECT uid, datetime, latitude, longitude, altitude FROM public."flights" ` +
                    `WHERE (uid, datetime) in (${point_identifiers}) AND satellites>=${config.MIN_SATELLITES} ORDER BY datetime DESC`
                );

                const activeFlights: Array<ActiveFlightRecord> = await Promise.all(recentResult.map(async (partial): Promise<ActiveFlightRecord> => {
                    const found = await getFlightByUID(partial.uid);
                    if (!found) {
                        throw new Error(`No {start_date, imei} pair found for uid ${partial.uid}`);
                    }
                    const {imei, start_date} = found;
                    return {
                        uid: partial.uid,
                        datetime: partial.datetime,
                        latitude: partial.latitude,
                        longitude: partial.longitude,
                        altitude: partial.altitude,
                        modem: this.modemList.get(imei)!.getRedacted(),
                        startDate: start_date
                    }
                }));

                res.json({
                    status: 'active',
                    points: activeFlights
                } as RecentActiveFlightsResponse)
            } else {
                res.json({status: 'none'} as RecentActiveFlightsResponse)
            }
        } catch (e) {
            console.log(e);
            next(e);
        }
    }
}