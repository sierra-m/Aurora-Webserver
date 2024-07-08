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
import {query, type FlightRegistryQuery} from './pg'
import * as dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";


dayjs.extend(utc);

const validateUID = (uid: string) => {
    return uid.match(/[0-9a-f]{8}\-[0-9a-f]{4}\-4[0-9a-f]{3}\-[89ab][0-9a-f]{3}\-[0-9a-f]{12}/i);
}


const standardizeUID = (uid: string) => {
    let standardUid;
    if (uid.length === 22) {
        const asHex = Buffer.from(uid, 'base64url').toString('hex');
        standardUid = `${asHex.slice(0,8)}-${asHex.slice(8,12)}-${asHex.slice(12,16)}-${asHex.slice(16,20)}-${asHex.slice(20)}`;
    } else {
        standardUid = uid;
    }
    if (typeof standardUid === 'string' && validateUID(standardUid)) {
        return standardUid;
    }
}


const compressUID = (uid: string) => {
    return Buffer.from(uid.replaceAll('-', ''), 'hex').toString('base64url');
}

const getFlightByUID = async (uid: string): Promise<FlightRegistryQuery | undefined> => {
    if (uid) {
        let result = await query<FlightRegistryQuery>(
            'SELECT * FROM public."flight-registry" WHERE uid=$1',
            [uid]
        );
        if (result.length > 0) {
            return result[0];
        }
    }
}


const getUIDByFlight = async (imei: number, startDate: dayjs.Dayjs): Promise<string | undefined> => {
    const isoDate = startDate.format('YYYY-MM-DD HH:mm:ss');
    let result = await query<{uid: string}>(
        'SELECT uid FROM public."flight-registry" WHERE imei=$1 AND start_date=$2',
        [imei, isoDate]
    );
    if (result.length > 0) {
        return result[0].uid;
    }
}

export {standardizeUID, compressUID, getFlightByUID, getUIDByFlight};