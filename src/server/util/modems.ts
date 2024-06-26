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

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import {query, ModemQuery} from './pg';
import * as config from '../config'
import {M} from "vite/dist/node/types.d-aGj9QkWt";

class ModemValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "ModemValidationError";
    }
}

class ModemLoadError extends Error {
    constructor(message) {
        super(message);
        this.name = "ModemLoadError";
    }
}

const processCsvFile = (filepath: string): Array<Array<string>> => {
    const content = fs.readFileSync(filepath);
    return parse(content);
};

interface Modem {
    imei: number,
    org: string,
    name: string
}

interface RedactedModem {
    partialImei: string,
    org: string,
    name: string
}


const formatRecord = (record: Array<string>, index: number): Modem => {
    const imei: number = parseInt(record[0]);
    if (isNaN(imei)) {
        throw new ModemValidationError(`IMEI incorrect for row index ${index}, must be a number`);
    }
    const org: string = record[1].trim().replaceAll(" ", "-");
    const name: string = record[2].trim().replaceAll(" ", "_");
    if (name === "") {
        throw new ModemValidationError(`Modem name cannot be blank for row index ${index}`);
    }
    return {imei, org, name};
}


const checkUniqueNames = (names: Array<string>) => {
    const uniq = names
        .map((name) => {
            return {
                count: 1,
                name: name
            };
        })
        .reduce((result, b) => {
            result[b.name] = (result[b.name] || 0) + b.count;

            return result;
        }, {});
    const duplicates = Object.keys(uniq).filter((a) => uniq[a] > 1);

    if (duplicates.length > 0) {
        throw new ModemValidationError(`Duplicate modem names are not allowed, detected: ${duplicates}`);
    }
}


const storeModems = async (modems: Array<Modem>) => {
    await query(`DELETE FROM public.modems`);
    for (let modem of modems) {
        await query(
            "INSERT INTO public.modems (imei, organization, name) VALUES ($1, $2, $3)",
            [modem.imei, modem.org, modem.name]
        );
    }
}

const loadModemsFromDb = async () => {
    const result = await query<ModemQuery>(`SELECT * FROM public.modems`);
    if (result.length < 1) {
        throw new ModemLoadError('No data loaded from database');
    }
    return result;
}


export default class ModemList {
    modems: Map<number,any> = new Map();

    async loadModems (filepath) {
        try {
            // Pull csv as array of records
            const records = processCsvFile(filepath);
            if (records.length === 0) {
                throw new ModemValidationError("No records loaded from CSV");
            }
            const first = records.shift()!;
            // Validate column names
            if (first[0].toLowerCase() !== 'imei' || first[1].toLowerCase() !== 'organization' || first[2].toLowerCase() !== 'modem name') {
                throw new ModemValidationError('First row must match [IMEI, Organization, Modem Name] format');
            }
            // Build array of formatted modem fields
            const formattedModems = records.map(formatRecord);
            // Ensure modem names are all unique
            const names = formattedModems.map((modem) => (modem.name));
            checkUniqueNames(names);
            // Note: called without 'await' as this class is sync, while pg is async. Should not
            // affect operations
            await storeModems(formattedModems);
            console.log(`Stored modem records in database`);

            // Load modem objects into map for easy searching
            for (let modem of formattedModems) {
                this.modems.set(modem.imei, modem);
            }
            console.log(`Loaded modems from CSV`);
        } catch (e) {
            console.error(`Caught error while loading from CSV:\n${e}`);
            console.warn('Attempting to load modems from the database...')
            const loaded = await loadModemsFromDb();
            // Load modem objects into map for easy searching
            for (let modem of loaded) {
                this.modems.set(modem.imei, {imei: modem.imei, org: modem.organization, name: modem.name});
            }
        }
    }

    has (imei) {
        return this.modems.has(imei);
    }

    get (imei): Modem {
        return this.modems.get(imei);
    }

    getByName (name: string): Modem {
        for (let modem of this.modems.values()) {
            if (modem.name === name) {
                return modem;
            }
        }
    }

    getByOrg (org): Array<Modem> {
        return [...this.modems.values()].filter((modem) => (modem.org === org));
    }

    getRedacted (imei): RedactedModem {
        const modem = this.get(imei);
        return {
            partialImei: modem.imei.toString().slice(-config.EXPOSED_IMEI_DIGITS),
            org: modem.org,
            name: modem.name
        }
    }

    getRedactedSet (): Array<RedactedModem> {
        return [...this.modems.keys()].map(this.getRedacted);
    }

    toString () {
        let out = [];
        for (let [key, value] of this.modems) {
            out.push(`imei ${key}: {org: ${value.org}, name: ${value.name}}\n`);
        }
        return out.join('\n');
    }
}

export {Modem, RedactedModem};