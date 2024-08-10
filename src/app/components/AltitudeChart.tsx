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

import React, {type EventHandler, useState} from 'react'
import { Line } from 'react-chartjs-2'
import { MDBContainer } from 'mdbreact'
import Zoom from 'chartjs-plugin-zoom'
import Button from 'react-bootstrap/Button'
import Chart from "chart.js/auto";
import {CategoryScale, type ChartData, type ChartEvent, type TooltipItem, type ChartOptions} from "chart.js";

Chart.register(CategoryScale);


interface AltitudeChartProps {
  dataTitle: string;
  data: Array<number>;
  key: number | null;
  labels: Array<string>;
  selectPoint: (index: number) => void;
  useAnimation: boolean;
}

const AltitudeChart = (props: AltitudeChartProps) => {
  const [lineData, setLineData] = useState<ChartData<'line'>>({
    labels: props.labels,
    datasets: [
      {
        label: props.dataTitle,
        fill: true,
        tension: 0.3,
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
        data: props.data
      }
    ]
  });

  const [xMin, setXMin] = useState(0);
  const [xMax, setXMax] = useState(100);
  const [yMin, setYMin] = useState(0);
  const [yMax, setYMax] = useState(100);

  const options: ChartOptions<'line'> = {
    // TODO: check if this is needed anymore
    // legend: {
    //   display: false
    // },
    animation: (props.useAnimation && {
      easing: 'easeInOutQuart',
      duration: 1000
    }) || {
      easing: 'easeInOutQuart',
      duration: 1
    },
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      xAxes: {
        //type: 'linear',
        ticks: {
          autoSkip: true,
          maxTicksLimit: 3,
          maxRotation: 0,
          minRotation: 0
        }
      },
      yAxes: {
        title: {
          display: true,
          text: 'Altitude (meters)'
        }
      }
    },
    plugins: {
      tooltip: {
        mode: 'nearest',
        callbacks: {
          label: function (tooltipItem: TooltipItem<'line'>) {
            return tooltipItem.label + ' m';
          }
        }
      },
      zoom: {
        // Container for pan options
        pan: {
          // Boolean to enable panning
          enabled: true,

          mode: 'xy',
        },

        // Container for zoom options
        zoom: {
          wheel: {
            enabled: true,
            modifierKey: 'ctrl'
          },
          pinch: {
            enabled: true
          },
          mode: 'xy'
        },
        limits: {
          x: {
            min: xMin,
            max: xMax
          },
          y: {
            min: yMin,
            max: yMax
          }
        }
      }
    }
  };

  const chartRef = React.useRef<Chart<"line">>(null);

  const resetZoom = React.useCallback(() => {
    if (chartRef.current) {
      chartRef.current.resetZoom();
    }
  }, []);

  const handleClick = React.useCallback((event: any) => {
    if (chartRef.current) {
      const points = chartRef.current.getElementsAtEventForMode(event, 'nearest', {intersect: true}, false);
      if (points.length > 0 && points[0]) {
        props.selectPoint(points[0].index)
      }
    }
  }, []);

  return (
    <div className="chart-container px-0" style={{height: '18rem', maxHeight: '18rem'}}>
      <Line
        data={lineData}
        options={options}
        key={props.key}
        ref={chartRef}
        onClick={handleClick}
      />
      <p className={'text-secondary'}>Click a point to view it on the map</p>
      <Button onClick={resetZoom}>Reset Zoom</Button>
    </div>
  );
}

export default React.memo(AltitudeChart);