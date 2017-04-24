'use strict';

import React, { PropTypes } from 'react';
import ReactDOM from 'react-dom';
import d3 from 'd3';
import Axis from '../utilities/axis';
import AxisLabel from '../utilities/axisLabel';
import Grid from '../utilities/grid';
import Dots from '../utilities/dataPoints';
import ToolTip from '../utilities/tooltip';
import Legend from '../utilities/legend';

class AreaGraph extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      tooltip: {
        display: false,
        data: {
          key: '',
          value: ''
        },
        pos:{
          x: 0,
          y: 0
        }
      },
      dataPointColor: '',
      width: this.props.width,
      data: []
    };
  }

  componentWillMount() {
    window.addEventListener('resize', this.updateSize, false);
    this.setState({width: this.props.width});
  }

  componentDidMount() {
    this.reloadBarData();
    this.repaintComponent();
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.updateSize, false);
  }

  updateSize = () => {
    const node = ReactDOM.findDOMNode(this);
    const parentWidth = node.offsetWidth;
    (parentWidth < this.props.width) ?
      this.setState({width:parentWidth}) :
      this.setState({width:this.props.width});
  };

  repaintComponent() {
    const forceResize = this.updateSize;
    function onRepaint(callback){
      setTimeout(function(){
        window.requestAnimationFrame(callback);
      }, 0);
    }
    onRepaint(forceResize);
  }

  createChart(_self) {
    if (this.props.colors) {
      this.color = d3.scale.ordinal()
      .range(this.props.colors);
    } else {
      this.color = d3.scale.category10();
    }

    let xLabelHeightOffset = 0;
    let yLabelWidthOffset = 0;

    {this.props.xAxisLabel ? xLabelHeightOffset = 30 : null;}
    {this.props.yAxisLabel ? yLabelWidthOffset = 20 : null;}

    // Width of graph
    this.w = this.state.width - (this.props.margin.left + this.props.margin.right + yLabelWidthOffset);

    // Height of graph
    this.h = this.props.height - (this.props.margin.top + this.props.margin.bottom + xLabelHeightOffset);

    // X axis scale
    if(this.props.dataType !== 'date') {
      this.xScale= d3.scale.linear()
        .domain([
          d3.min(this.state.data,function(d){
            return d[_self.props.xDataKey];
          }),
          d3.max(this.state.data,function(d){
            return d[_self.props.xDataKey];
          })
        ])
        .range([0, this.w]);

      if(this.props.dataPercent === 'x') {
        this.xAxis = d3.svg.axis()
          .scale(this.xScale)
          .orient('bottom')
          .tickFormat( function(x) {
            return x + '%';
          });
      } else {
        this.xAxis = d3.svg.axis()
          .scale(this.xScale)
          .orient('bottom')
          .ticks(Math.floor(this.w/100));
      }
    } else {
      this.xScale = d3.time.scale()
        .domain(
          // Find min and max axis value
          d3.extent(this.state.data, function (d) {
            return d[_self.props.xDataKey];
          })
        )
        // Set range from 0 to width of container
        .rangeRound([0, this.w]);

      this.xAxis = d3.svg.axis()
        .scale(this.xScale)
        .orient('bottom')
        .ticks(Math.floor(this.w/100))
        .tickFormat(d3.time.format(this.props.xFormat));
    }

    // Y axis scale
    this.yScale = d3.scale.linear()
      .domain([
        // Find min axis value and subtract buffer
        d3.min(this.state.data,function(d){
          if (typeof _self.props.yMin === "number") {
            return _self.props.yMin;
          } else {
            return d[_self.props.yDataKey]-_self.props.yMaxBuffer;
          }
        }),
        // Find max axis value and add buffer
        d3.max(this.state.data,function(d){
          if (typeof _self.props.yMax === "number") {
            return _self.props.yMax;
          } else {
            return d[_self.props.yDataKey]+_self.props.yMaxBuffer;
          }
        })
      ])
      // Set range from height of container to 0
      .range([this.h, 0]);

    // Create area
    this.area = d3.svg.area()
      .x(function (d) {
        return this.xScale(d[_self.props.xDataKey]);
      })
      .y0(this.h)
      .y1(function (d) {
        return this.yScale(d[_self.props.yDataKey]);
      })
      .interpolate(this.props.lineType);

    this.dataNest = d3.nest()
        .key(function(d) { return d[_self.props.labelKey]; })
        .entries(this.state.data);

    if(this.props.dataPercent === 'y') {
      this.yAxis = d3.svg.axis()
        .scale(this.yScale)
        .orient('left')
        .ticks(5)
        .tickFormat( function(x) {
          return x + '%';
        });
    } else {
      this.yAxis = d3.svg.axis()
        .scale(this.yScale)
        .orient('left')
        .ticks(5);
    }

    this.yGrid = d3.svg.axis()
      .scale(this.yScale)
      .orient('left')
      .ticks(5)
      .tickSize(-this.w, 0, 0)
      .tickFormat("");

    this.transform = 'translate(' + (this.props.margin.left + yLabelWidthOffset) + ',' + this.props.margin.top + ')';
  }

  reloadBarData() {
    const data = this.props.data;

    // Format date for d3 to use
    const parseDate = d3.time.format(this.props.dateFormat).parse;

    data.forEach((value, i) => {
      const d = data[i];
      if(this.props.dataType === 'date') {
        if (typeof d[this.props.xDataKey] === "string") {
          d[this.props.xDataKey] = parseDate(d[this.props.xDataKey]);
        }
        data[i] = d;
      }
    });

    this.setState({data:data});
  }

  showToolTip = (e) => {
    const pointColor = e.target.getAttribute('fill');
    e.target.setAttribute('fill', '#6f8679');
    this.setState({
      tooltip: {
        display: true,
        data: {
          key: e.target.getAttribute('data-key'),
          value: e.target.getAttribute('data-value')
        },
        pos:{
          x: e.target.getAttribute('cx'),
          y: e.target.getAttribute('cy')
        }
      },
      dataPointColor: pointColor
    });
  };

  hideToolTip = (e) => {
    e.target.setAttribute('fill', this.state.dataPointColor);
    this.setState({
      tooltip: {
        display: false,
        data: {
          key: '',
          value: ''
        },
        pos:{
          x: 0,
          y: 0
        },
      },
      dataPointColor: ''
    });
  };

  render(){
    this.createChart(this);

    const _self = this;

    const lines = this.dataNest.map(function (d,i) {
      return (
        <g key={i}>
          <path
            d={_self.area(d.values)}
            fill={_self.color(i)}
            stroke={_self.props.strokeColor}
            opacity=".9"
            strokeWidth={3} />
          <Dots
            data={d.values}
            x={_self.xScale}
            y={_self.yScale}
            stroke="#ffffff"
            fill={_self.color(i)}
            showToolTip={_self.showToolTip}
            hideToolTip={_self.hideToolTip}
            removeFirstAndLast={true}
            dateFormat={_self.props.dataPointDateFormat}
            xDataKey={_self.props.xDataKey}
            yDataKey={_self.props.yDataKey} />
          <ToolTip
            tooltip={_self.state.tooltip}
            bgStyle={_self.props.tooltipBgStyle}
            xValue={_self.props.xToolTipLabel}
            yValue={_self.props.yToolTipLabel} />
        </g>
      );
    });

    let customClassName = "";

    if(this.props.chartClassName){
      customClassName = " " + this.props.chartClassName;
    }

    return (
      <div>
        {this.props.title && <h3>{this.props.title}</h3>}
        <svg className={"rd3r-chart rd3r-area-graph" + customClassName} id={this.props.chartId} width={this.state.width} height={this.props.height}>
          <g transform={this.transform}>
            <Grid h={this.h} grid={this.yGrid} gridType="y" />
            <Axis h={this.h} axis={this.yAxis} axisType="y" />
            <Axis h={this.h} axis={this.xAxis} axisType="x" />
            {this.props.xAxisLabel && <AxisLabel key={0} h={this.h} w={this.w} axisLabel={this.props.xAxisLabel} axisType="x" />}
            {this.props.yAxisLabel && <AxisLabel key={1} h={this.h} w={this.w} axisLabel={this.props.yAxisLabel} axisType="y" />}
            {lines}
          </g>
        </svg>
        {this.props.legend && <Legend data={this.state.data} labelKey={this.props.labelKey} colors={this.color} />}
      </div>
    );
  }

}

AreaGraph.propTypes = {
  /** Graph title */
  title: PropTypes.string,

  /** Graph max-width */
  width: PropTypes.number,

  /** Graph height */
  height: PropTypes.number,

  /** Chart ID */
  chartId: PropTypes.string,

  /** Class name for chart */
  chartClassName: PropTypes.string,

  /** Fill colors */
  colors: PropTypes.array,

  /** Data to be graphed */
  data: PropTypes.array.isRequired,

  /** Data date format (d3.js v3 time api) */
  dateFormat: PropTypes.string,

  /** Tooltip date format (d3.js v3 time api) */
  dataPointDateFormat: PropTypes.string,

  /** Data type date, percent, or number */
  dataType: PropTypes.string,

  /** Axis to be percentage */
  dataPercent: PropTypes.string,

  /** X Axis date label format */
  xFormat: PropTypes.string,

  /** Label key */
  labelKey: PropTypes.string,

  /** X Axis data key */
  xDataKey: PropTypes.string.isRequired,

  /** Y Axis data key */
  yDataKey: PropTypes.string.isRequired,

  /** X Axis label */
  xAxisLabel: PropTypes.string,

  /** Y Axis label */
  yAxisLabel: PropTypes.string,

  /** X Axis tooltip label */
  xToolTipLabel: PropTypes.string,

  /** Y Axis tooltip label */
  yToolTipLabel: PropTypes.string,

  /** Tooltip background color */
  tooltipBgStyle: PropTypes.string,

  /** Display legend */
  legend: PropTypes.bool,

  /** Line type (d3.js v3 time api) */
  lineType: PropTypes.string,

  /** Stroke color */
  strokeColor: PropTypes.string,

  /** Margin for graph */
  margin: PropTypes.object,

  /** Set Y maximum value */
  yMax: PropTypes.number,

  /** Set Y minimum value */
  yMin: PropTypes.number,

  /** Set Y padding for min and max value */
  yMaxBuffer: PropTypes.number
};

AreaGraph.defaultProps = {
  width: 1920,
  height: 400,
  labelKey: "label",
  dateFormat:'%m-%d-%Y',
  dataType:'date',
  xFormat:'%a %e',
  xToolTipLabel: 'x',
  yToolTipLabel: 'y',
  legend: true,
  lineType:'linear',
  strokeColor: '#ffffff',
  margin: {
    top: 10,
    right: 40,
    bottom: 30,
    left: 40
  },
  yMaxBuffer: 100
};

export default AreaGraph;
