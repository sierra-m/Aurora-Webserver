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

import React, { Component } from 'react'
import { Line } from 'react-chartjs-2'
import { MDBContainer } from 'mdbreact'
import Zoom from 'chartjs-plugin-zoom'
import Button from 'react-bootstrap/Button'


export default class AltitudeChart extends Component {
  state = {
    dataLine: {
      labels: this.props.labels,
      datasets: [
        {
          label: this.props.dataTitle,
          fill: true,
          lineTension: 0.3,
          backgroundColor: "rgba(225, 204,230, .3)",
          borderColor: "rgb(205, 130, 158)",
          borderCapStyle: "butt",
          borderDash: [],
          borderDashOffset: 0.0,
          borderJoinStyle: "miter",
          pointBorderColor: "rgb(205, 130,1 58)",
          pointBackgroundColor: "rgb(255,232,247)",
          pointBorderWidth: 4,
          pointHoverRadius: 2,
          pointHoverBackgroundColor: "rgb(53, 166, 232)",
          pointHoverBorderColor: "rgba(188, 216, 220, 1)",
          pointHoverBorderWidth: 1,
          pointRadius: 1,
          pointHitRadius: 10,
          data: this.props.data
        }
      ]
    },
    xMin: null,
    xMax: null,
    yMin: null,
    yMax: null
  };

  options = {
    legend: {
      display: false
    },
    animation: (this.props.animation && {
      easing: 'easeInOutQuart',
      duration: 1000
    }) || {
      easing: 'easeInOutQuart',
      duration: 1
    },
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      xAxes: [{
        //type: 'linear',
        ticks: {
          autoSkip: true,
          maxTicksLimit: 3,
          maxRotation: 0,
          minRotation: 0
        }
      }],
      yAxes: [
        {
          scaleLabel: {
            display: true,
            labelString: 'Altitude (meters)'
          }
        }
      ]
    },
    tooltips: {
      mode: 'label',
      callbacks: {
        label: function (tooltipItems, data) {
          return tooltipItems.yLabel + ' m';
        }
      }
    },
    plugins: {
      zoom: {
        // Container for pan options
        pan: {
          // Boolean to enable panning
          enabled: true,

          // Panning directions. Remove the appropriate direction to disable
          // Eg. 'y' would only allow panning in the y direction
          mode: 'xy',
        },

        // Container for zoom options
        zoom: {
          // Boolean to enable zooming
          enabled: true,
          mode: 'xy',

          rangeMin: {
            // Format of min zoom range depends on scale type
            x: this.state.xMin,
            y: this.state.yMin
          },
          rangeMax: {
            // Format of max zoom range depends on scale type
            x: this.state.xMax,
            y: this.state.yMax
          },
          // Speed of zoom via mouse wheel
          // (percentage of zoom on a wheel event)
          speed: 0.1,

          // Function called while the user is zooming
          //onZoom: function({chart}) { console.log(`I'm zooming!!!`); },
          // Function called once zooming is completed
          //onZoomComplete: function({chart}) { console.log(`I was zoomed!!!`); }
        }
      }
    }
  };

  chartRef = null;
  setRef = ref => {
    this.chartRef = ref;
    //console.log(ref);
  };

  resetZoom = () => {
    this.chartRef.chartInstance.resetZoom();
  };

  handleClick = (element) => {
    if (element && element[0]) {
      this.props.selectPosition(element[0]._index)
    }
  };

  render () {
    return (
      <MDBContainer className={'px-0'} key={this.props.key} style={{height: '18rem', maxHeight: '18rem'}}>
        {this.props.chartTitle !== null && <h3 className="mt-5 mb-0 pb-0">{this.props.chartTitle}</h3>}
        <Line
          className={'px-0'}
          data={this.state.dataLine}
          options={this.options}
          key={this.props.key}
          ref={this.setRef}
          getElementAtEvent={this.handleClick}
        />
        <p className={'text-secondary'}>Click a point to view it on the map</p>
        <Button onClick={this.resetZoom}>Reset Zoom</Button>
      </MDBContainer>
    );
  }
}