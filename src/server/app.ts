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

//import createError from 'http-errors'
import express from 'express'
//import path from 'path'
//import cookieParser from 'cookie-parser'
import {query} from './util/pg'
import logger from 'morgan'
import helmet from 'helmet'
import ModemList from "./util/modems";

// Routes for various endpoints
import MetaRoute from './routes/meta'
import FlightRoute from './routes/flight'
import AssignRoute from './routes/assign'
import UpdateRoute from './routes/update'
import LastRoute from './routes/last'


const modemsFilepath = process.env.MODEMS_ALLOWLIST;
const useProduction = process.env.NODE_ENV === 'production';

const modemList = new ModemList();
await modemList.loadModems(modemsFilepath);
// Check we actually loaded the modems
if (modemList.size === 0) {
    console.error("No modems loaded! Cannot start webserver");
    process.exit(1);
}
const assignRoute = new AssignRoute(modemList);
const metaRoute = new MetaRoute(modemList);
const flightRoute = new FlightRoute(modemList);
const updateRoute = new UpdateRoute();
const lastRoute = new LastRoute();

const app = express();

// For security
app.use(helmet());

// This is a nice reassurance the modems loaded correctly
console.log(`Starting server with modem list:\n${modemList}`);

app.use(logger(useProduction ? 'common' : 'dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
// TODO: setup cookies/JWT
//app.use(cookieParser());

/**
 * Checks whether request contains a valid API key param
 */
const authRouter = async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
    if (req?.query?.key != null && typeof req.query.key === 'string') {
        const result = await query(`SELECT * FROM public."auth" WHERE token=$1`, [req.query.key]);
        if (result.length > 0) {
            next();
        } else {
            res.status(403);
            res.send('Invalid token.')
        }
    } else {
        res.status(400);
        res.send('Please supply a key');
    }
};

app.use('/api/meta', metaRoute.router);
app.use('/api/flight', flightRoute.router);
app.use('/api/assign', authRouter, assignRoute.router);
app.use('/api/update', updateRoute.router);
app.use('/api/last', authRouter, lastRoute.router);

// React App
if (useProduction) {
    // TODO: serve react app
    // app.use(express.static(path.join(__dirname, '/../../Aurora-React/build')));
    // app.use(['/tracking', '/404'], async (req, res) => {
    //     res.sendFile(path.join(__dirname, '/../../Aurora-React/build', 'index.html'));
    // });
    // app.use('/', function (req, res, next) {
    //     if (parseUrl.original(req).pathname !== req.baseUrl) return next(); // skip this for strictness
    //     res.sendFile(path.join(__dirname, '/../../Aurora-React/build', 'index.html'));
    // });
}

// catch 404 and forward to error handler
app.use(async (req, res, next) => {
    if (useProduction) {
        res.redirect('/404');
    } else {
        res.sendStatus(404);
    }
});

app.use(async (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (useProduction) {
        res.status(500).json({'error': 'Oops! Something went wrong. Try again?'});
    } else {
        res.status(500).json(err);
    }
})


const port = (process.env.PORT != null) ? parseInt(process.env.PORT) : 3000;
const host = process.env.HOST || 'localhost';

app.listen(port, host);
console.log(`Listening on port ${port}, host ${host}`);
