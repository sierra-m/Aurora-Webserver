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

import React from 'react'
import './App.css'
import './custom.scss'
import {BrowserRouter as Router, Link, Route, Routes} from "react-router-dom"
import Navigation, {defaultPreferences, type PagePreferences} from "./components/Navigation.jsx"
import Tracking from './components/Tracking.jsx'

import MainPage from './components/MainPage'
import Error404 from './components/Error404'


const App = () => {

  const [darkModeEnabled, setDarkModeEnabled] = React.useState<boolean>(false);

  const [pagePreferences, setPagePreferences] = React.useState<PagePreferences>(defaultPreferences)

  const handleDarkModeChange = React.useCallback((darkMode: boolean) => {
    setDarkModeEnabled(darkMode);
  }, []);

  const handlePagePrefChange = React.useCallback((preferences: PagePreferences) => {
    setPagePreferences(preferences);
  }, [])

  return (
    <Router>
      <Navigation handleDarkModeEnabled={handleDarkModeChange} handlePagePrefChange={handlePagePrefChange}/>
      <Routes>
        <Route path={'/'} element={<Tracking darkModeEnabled={darkModeEnabled} pagePreferences={pagePreferences}/>}/>
        <Route path={'/404'} element={<Error404/>}/>
      </Routes>
    </Router>
  );
}

export default App;
