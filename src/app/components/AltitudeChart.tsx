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
import Chart, {
  type PluginOptionsByType
} from "chart.js/auto";
import {CategoryScale, type ChartData, type TooltipItem, type ChartOptions} from "chart.js";
import type {PagePreferences} from "./Navigation.tsx";
import Alert from "react-bootstrap/Alert";

// DeepPartial implementation taken from the utility-types NPM package, which is
// Copyright (c) 2016 Piotr Witek <piotrek.witek@gmail.com> (http://piotrwitek.github.io)
// and used under the terms of the MIT license
export type DeepPartial<T> = T extends Function
  ? T
  : T extends Array<infer U>
    ? _DeepPartialArray<U>
    : T extends object
      ? _DeepPartialObject<T>
      : T | undefined;

type _DeepPartialArray<T> = Array<DeepPartial<T>>
type _DeepPartialObject<T> = { [P in keyof T]?: DeepPartial<T[P]> };

Chart.register(CategoryScale);


interface AltitudeChartProps {
  dataTitle: string;
  data: Array<number>;
  labels: Array<string>;
  selectPoint: (index: number) => void;
  useAnimation: boolean;
  pagePreferences: PagePreferences;
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

  const chartPlugins: _DeepPartialObject<PluginOptionsByType<"line">> = {
    legend: {
      display: false
    },
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
          modifierKey: 'shift'
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
  };

  const chartRef = React.useRef<Chart<"line"> | null>(null);

  const setChartRef = React.useCallback((chart: any | null) => {
    chartRef.current = chart;
  }, [])

  const handleClick = React.useCallback((event: any) => {
    if (chartRef.current) {
      const points = chartRef.current.getElementsAtEventForMode(event, 'nearest', {intersect: true}, false);
      if (points.length > 0 && points[0]) {
        props.selectPoint(points[0].index);
      }
    }
  }, [props.selectPoint]);

  const [options, setOptions] = React.useState<ChartOptions<'line'>>({
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
      x: {
        //type: 'linear',
        ticks: {
          autoSkip: true,
          maxTicksLimit: 3,
          maxRotation: 0,
          minRotation: 0
        }
      },
      y: {
        title: {
          display: true,
          text: 'Altitude (meters)'
        }
      }
    },
    plugins: chartPlugins,
    onClick: handleClick
  });

  const resetZoom = React.useCallback(() => {
    if (chartRef.current) {
      chartRef.current.resetZoom();
    }
  }, []);

  // Update data
  React.useEffect(() => {
    setLineData({
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
  }, [props.labels, props.dataTitle, props.data])

  // Update Y axis with preferred units
  React.useEffect(() => {
    setOptions({
      ...options,
      animation: {
        ...options.animation
      },
      scales: {
        x: {
          //type: 'linear',
          ticks: {
            autoSkip: true,
            maxTicksLimit: 3,
            maxRotation: 0,
            minRotation: 0
          }
        },
        y: {
          title: {
            display: true,
            text: `Altitude (${props.pagePreferences.useMetric ? 'meters' : 'feet'})`
          }
        }
      },
      plugins: chartPlugins,
      onClick: handleClick
    })
    // selectPoint included in dep list as onClick function will need to be updated
    // with new handleClick function
  }, [props.pagePreferences, props.selectPoint])

  return (
    <div className="chart-container px-0" style={{height: '18rem', maxHeight: '18rem'}}>
      <Line
        data={lineData}
        options={options}
        ref={setChartRef}
      />
      <Alert variant={'light'} className={'pt-2'}>
        Click a point on the chart to view its position on the map. <strong>Shift + Zoom</strong> to zoom 🔎
      </Alert>
      <Button onClick={resetZoom}>Reset Zoom</Button>
    </div>
  );
}

export default React.memo(AltitudeChart);