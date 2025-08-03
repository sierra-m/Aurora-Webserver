import React from 'react';
import Column from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import Accordion from "react-bootstrap/Accordion";
import Table from "react-bootstrap/Table";

const Help = () => {

  return (
    <div>
      The Aurora Flight Tracker is a tool hosted by MSU Borealis that provides real-time tracking and past flight
      display of high-altitude research balloons launched by Space-Grant-affiliated schools and organizations
      across the country.<br/><br/>

      Data from active balloon modems is streamed into the underlying Aurora Webserver,
      processed and catalogued in a database. It is then publicly available to view and download through this user
      interface and the webserver API.<br/><br/>

      Below, you'll find several helpful tips and tricks for using this app.<br/><br/>

      <Accordion>
        <Accordion.Item eventKey={'definitions'}>
          <Accordion.Header>
            Definitions
          </Accordion.Header>
          <Accordion.Body>
            Below are common terms you will see across the app:<br/><br/>
            <Table>
              <thead>
                <tr>
                  <th>Term</th>
                  <th>Definition</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Flight Point</td>
                  <td>
                    A single data point received from a balloon modem via the Iridium network, containing the modem's
                    timestamp, latitude, longitude, altitude, vertical velocity, ground speed, satellite receiver
                    count, and pin states
                  </td>
                </tr>
                <tr>
                  <td>Flight</td>
                  <td>
                    A collection of flight points from a single balloon modem (identified by IMEI), each either
                    recorded during the same day (in UTC) as the initial point, or separated by a time delta of
                    no more than 2 hours. A single flight may span multiple days, so long as the length of time
                    between each point after the start date stays under the 2-hour mark.
                  </td>
                </tr>
                <tr>
                  <td>Start Date</td>
                  <td>
                    The date a flight was started, according to Universal Coordinated Time (UTC). Each flight stored
                    in the database has a unique identifying Start Date and IMEI, and these together are represented
                    by the flight's UID.
                  </td>
                </tr>
                <tr>
                  <td>IMEI</td>
                  <td>
                    The <a href={'https://en.wikipedia.org/wiki/International_Mobile_Equipment_Identity'} target={"_blank"}>
                    International Mobile Equipment Identity</a> is a unique modem identifier that is used by the
                    webserver to differentiate and categorize each connected modem. Each participating
                    organization will have at least one modem, but often several. For security, the full IMEIs
                    are hidden to clients, with only the lower 4 digits provided for identification. Combined with
                    assigned Modem Names, schools can easily identify connected modems securely.
                  </td>
                </tr>
                <tr>
                  <td>UID</td>
                  <td>
                    The Unique Identifier of a flight, used by the application to easily categorize and fetch flights
                    from the database. Each flight has a unique UID, and in fact, this field is actually
                    a <a href={'https://en.wikipedia.org/wiki/Universally_unique_identifier'} target={"_blank"}>
                      Universally Unique Identifier
                    </a> (UUID). Using UUID algorithms, each new flight is guaranteed a unique identifier, which will be
                    permanently associated with the dataset.
                  </td>
                </tr>
                <tr>
                  <td>Active Flight</td>
                  <td>
                    A flight in which the most recent data point was received within the last 12 hours. Active flights
                    will appear both on the <strong>Map</strong> and in the <strong>Active Flights</strong> panel
                    when first opening the app.
                  </td>
                </tr>
                <tr>
                  <td>Selected Flight</td>
                  <td>
                    The currently selected flight.
                  </td>
                </tr>
                <tr>
                  <td>Selected Flight Point</td>
                  <td>
                    The currently selected flight point. When the current flight is Active, the latest data point
                    available will be selected by default, allowing real-time tracking of the modem. When a past
                    flight is selected, the current point will be the flight start point by default, but can be
                    changed by selecting different points on the <strong>Map</strong>,
                    the <strong>Altitude Chart</strong>, or the <strong>Pin States Log</strong>.
                  </td>
                </tr>
                <tr>
                  <td>Pin States</td>
                  <td>
                    Each NAL modem provides a set of input and output hardware pins for a custom (yet fairly limited)
                    telemetry scheme between any third party devices also present on the balloon and the ground station
                    teams. <br/><br/>

                    There are 4 input pins and 3 output pins, allowing for 16 unique input codes (from third
                    party controllers on the balloon) and 8 unique output codes (from ground station teams). The
                    direction of the pins is relative to the modem, so input pins are used to convey balloon status
                    to ground teams, while output pins are driven by commands sent from ground teams to provide
                    control over the balloon systems. <br/><br/>

                    Each arriving flight data point will contain the binary state of both sets of pins, recorded
                    as decimal numbers. These are displayed in the <strong>Pin States Log</strong>.
                  </td>
                </tr>
              </tbody>
            </Table>
          </Accordion.Body>
        </Accordion.Item>
        <Accordion.Item eventKey={'basic-usage'}>
          <Accordion.Header>
            Basic Usage
          </Accordion.Header>
          <Accordion.Body>
            This app is divided into several key views:
            <ul>
              <li>
                the <strong>Map</strong>, which displays active flights (by default), search results, and
                selected flights
              </li>
              <li>
                the <strong>Active Flights</strong> panel, which lists identifying info about modems that have
                actively pinged the server in the last 24 hours
              </li>
              <li>
                the <strong>Past Flights</strong> panel, which allows the selection of flights either by modem or
                by flight date
              </li>
              <li>
                the <strong>Flight Data</strong> panel, which provides statistics about the current flight
                and selected flight point
              </li>
              <li>
                the <strong>Altitude Chart</strong>, which provides an altitude-vs-time chart of all data points
              </li>
              <li>
                the <strong>Pin States Log</strong>, which provides Pin State data for each flight point received
              </li>
            </ul>
            When a flight has been selected, its flight path will be displayed in the Map with
            a balloon icon marking the selected point. This point is synced across the
            Altitude Chart and Pin States Log as well, with the selected altitude
            point marked by a pink circle, and selected log line highlighted in pink. Changing the selected point on
            the Map will also change it on the other two views, making it simple to see how
            Pin State telemetry affected the balloon's altitude and flight path at key points.<br/><br/>

            The Pin States Log can also be filtered to display only the times at least one pin set changed, highlighting
            key transition periods in the flight.
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>
    </div>
  )
};

export default React.memo(Help);