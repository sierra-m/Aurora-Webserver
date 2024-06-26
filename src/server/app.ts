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
import * as express from 'express'
//import path from 'path'
//import cookieParser from 'cookie-parser'
import {query} from './util/pg'
import * as logger from 'morgan'
import helmet from 'helmet'
//import parseUrl from 'parseurl'
import ModemList from "./util/modems";

// Routes for various endpoints
import metaRouter from './routes/meta'
import flightRouter from './routes/flight'
import assignRouter from './routes/assign'
import updateRouter from './routes/update'
import lastRouter from './routes/last'

async function buildApp (){

    const modemsFilepath = process.env.MODEMS_ALLOWLIST;
    const useProduction = process.env.NODE_ENV === 'production';

    const modemList = new ModemList();
    await modemList.loadModems(modemsFilepath);
    assignRouter.modemList = modemList;
    metaRouter.modemList = modemList;
    flightRouter.modemList = modemList;

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
     * @param req
     * @param res
     * @param next
     * @returns {Promise<void>}
     */
    const authRouter = async (req, res, next) => {
        if (req.query.key) {
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

    app.use('/api/meta', metaRouter);
    app.use('/api/flight', flightRouter);
    app.use('/api/assign', authRouter, assignRouter);
    app.use('/api/update', updateRouter);
    app.use('/api/last', authRouter, lastRouter);

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
            // TODO: figure out this nonsense (probably use react)
            //next(createError(404));
        }
    });

    return app;
}

export default buildApp;

