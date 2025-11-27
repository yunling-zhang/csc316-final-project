/**
 * Collision Anatomy Visualization - IMPROVED VERSION
 * Interactive car silhouette with better visual feedback and color coding
 */

class CollisionAnatomy {
  constructor(containerId, data) {
    this.container = d3.select(containerId);
    this.data = data;
    this.selectedZone = null;
    this.yearRange = [1999, 2023];
    this.viewMode = 'vehicles'; // 'vehicles', 'injured', 'fatalities'

    // Debug: log data summary
    console.log("CollisionAnatomy initialized with data:", data);
    this.logDataSummary();

    this.init();
  }

  logDataSummary() {
    console.log("=== DATA SUMMARY ===");
    Object.entries(this.data.zones).forEach(([zone, zoneData]) => {
      const value = this.calculateZoneValue(zoneData);
      if (value > 0) {
        console.log(`${zone}: ${value.toLocaleString()} ${this.viewMode}`);
      }
    });
    console.log("====================");
  }

  init() {
    this.setupLayout();
    this.setupSVG();
    this.setupColorScale();
    this.bindEvents();
    this.updateHeatmap();
    this.setupControls();
    this.playIntroAnimation();
  }

  setupLayout() {
    // Clear container first
    this.container.html('');
    this.container.classed('car-anatomy-container', true);

    // Create dashboard frame
    const dashboardFrame = this.container.append('div')
      .classed('dashboard-frame', true);

    const dashboardScreen = dashboardFrame.append('div')
      .classed('dashboard-screen', true);

    // Title
    dashboardScreen.append('h2')
      .classed('anatomy-title', true)
      .text('COLLISION ANATOMY');

    dashboardScreen.append('p')
      .classed('anatomy-subtitle', true)
      .text('Where do crashes hit your car? Click any zone to explore.');

    // Create two-column layout
    this.mainContent = dashboardScreen.append('div')
      .classed('anatomy-content', true);

    this.carContainer = this.mainContent.append('div')
      .classed('car-svg-container', true);

    this.detailPanel = this.mainContent.append('div')
      .classed('detail-panel', true);

    // Show initial instruction in detail panel
    this.detailPanel.html(`
      <div class="detail-placeholder">
        <div class="placeholder-icon">🚗</div>
        <h3>Select a Zone</h3>
        <p>Click on any part of the car to see crash statistics for that impact zone.</p>
        <p class="hint">Hover over zones to see quick stats.</p>
      </div>
    `);

    // Add controls container
    this.controlsContainer = dashboardScreen.append('div')
      .classed('controls-container', true);

    // Add legend
    this.legendContainer = dashboardScreen.append('div')
      .classed('legend-container', true);
  }

  setupSVG() {
    // Create the main SVG container
    this.svg = this.carContainer.append('svg')
      .attr('viewBox', '0 0 400 550')
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .classed('car-anatomy-svg', true);

    // Add car body and zones
    this.createCarSVG();

    // Create tooltip
    this.tooltip = d3.select('body').append('div')
      .classed('anatomy-tooltip', true)
      .style('opacity', 0);
  }

  createCarSVG() {
    const svg = this.svg;

    // Background glow effect
    const defs = svg.append('defs');
    
    // Glow filter for high-risk zones
    const glowFilter = defs.append('filter')
      .attr('id', 'glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');
    
    glowFilter.append('feGaussianBlur')
      .attr('stdDeviation', '4')
      .attr('result', 'coloredBlur');
    
    const feMerge = glowFilter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Car body group
    const carBody = svg.append('g').attr('id', 'car-body');

    // Main car outline (top-down view) - improved shape
    carBody.append('path')
      .attr('id', 'car-outline')
      .attr('d', `
        M 130,60
        C 130,35 200,30 200,30 
        C 200,30 270,35 270,60
        L 285,140
        L 290,400
        C 290,440 200,450 200,450
        C 200,450 110,440 110,400
        L 115,140
        Z
      `)
      .attr('fill', 'none')
      .attr('stroke', '#4a5568')
      .attr('stroke-width', 3);

    // Windshield
    carBody.append('path')
      .attr('id', 'windshield')
      .attr('d', 'M 140,75 L 260,75 L 275,130 L 125,130 Z')
      .attr('fill', '#63b3ed')
      .attr('opacity', 0.15)
      .attr('stroke', '#4a5568')
      .attr('stroke-width', 1);

    // Rear window
    carBody.append('path')
      .attr('id', 'rear-window')
      .attr('d', 'M 140,380 L 260,380 L 275,340 L 125,340 Z')
      .attr('fill', '#63b3ed')
      .attr('opacity', 0.15)
      .attr('stroke', '#4a5568')
      .attr('stroke-width', 1);

    // Side mirrors
    carBody.append('ellipse')
      .attr('cx', 95).attr('cy', 145)
      .attr('rx', 15).attr('ry', 8)
      .attr('fill', '#2d3748')
      .attr('stroke', '#4a5568');
    
    carBody.append('ellipse')
      .attr('cx', 305).attr('cy', 145)
      .attr('rx', 15).attr('ry', 8)
      .attr('fill', '#2d3748')
      .attr('stroke', '#4a5568');

    // Wheels (visual indicators)
    const wheelPositions = [
      { x: 115, y: 160 }, { x: 285, y: 160 },
      { x: 115, y: 360 }, { x: 285, y: 360 }
    ];
    wheelPositions.forEach(pos => {
      carBody.append('rect')
        .attr('x', pos.x - 8).attr('y', pos.y - 20)
        .attr('width', 16).attr('height', 40)
        .attr('rx', 4)
        .attr('fill', '#1a202c')
        .attr('stroke', '#2d3748');
    });

    // Create interactive zones group
    const zones = svg.append('g').attr('id', 'impact-zones');

    // Zone definitions with better shapes
    const zoneDefinitions = [
      {
        id: 'front',
        path: 'M 130,30 C 130,30 200,25 270,30 L 285,140 L 115,140 Z',
        label: 'FRONT',
        labelPos: { x: 200, y: 90 }
      },
      {
        id: 'roof',
        type: 'rect',
        x: 155, y: 40, width: 90, height: 30, rx: 8,
        label: 'ROOF',
        labelPos: { x: 200, y: 60 }
      },
      {
        id: 'left-front',
        type: 'rect',
        x: 90, y: 140, width: 45, height: 90,
        label: 'L-F',
        labelPos: { x: 112, y: 185 }
      },
      {
        id: 'left-middle',
        type: 'rect',
        x: 90, y: 230, width: 45, height: 90,
        label: 'L-M',
        labelPos: { x: 112, y: 275 }
      },
      {
        id: 'left-rear',
        type: 'rect',
        x: 90, y: 320, width: 45, height: 70,
        label: 'L-R',
        labelPos: { x: 112, y: 355 }
      },
      {
        id: 'right-front',
        type: 'rect',
        x: 265, y: 140, width: 45, height: 90,
        label: 'R-F',
        labelPos: { x: 287, y: 185 }
      },
      {
        id: 'right-middle',
        type: 'rect',
        x: 265, y: 230, width: 45, height: 90,
        label: 'R-M',
        labelPos: { x: 287, y: 275 }
      },
      {
        id: 'right-rear',
        type: 'rect',
        x: 265, y: 320, width: 45, height: 70,
        label: 'R-R',
        labelPos: { x: 287, y: 355 }
      },
      {
        id: 'rear',
        path: 'M 115,340 L 285,340 L 290,420 C 290,440 200,450 200,450 C 200,450 110,440 110,420 Z',
        label: 'REAR',
        labelPos: { x: 200, y: 395 }
      },
      {
        id: 'interior',
        type: 'rect',
        x: 155, y: 210, width: 90, height: 100, rx: 5,
        label: '🚘',
        labelPos: { x: 200, y: 265 },
        isSmall: true
      }
    ];

    // Create zones
    zoneDefinitions.forEach(zoneDef => {
      let zone;
      if (zoneDef.type === 'rect') {
        zone = zones.append('rect')
          .attr('x', zoneDef.x)
          .attr('y', zoneDef.y)
          .attr('width', zoneDef.width)
          .attr('height', zoneDef.height);
        if (zoneDef.rx) zone.attr('rx', zoneDef.rx);
      } else {
        zone = zones.append('path')
          .attr('d', zoneDef.path);
      }
      
      zone
        .attr('class', `impact-zone ${zoneDef.isSmall ? 'impact-zone-small' : ''}`)
        .attr('data-zone', zoneDef.id)
        .attr('fill', '#2d3748')
        .attr('fill-opacity', 0.5)
        .attr('stroke', '#4a5568')
        .attr('stroke-width', 1);
    });

    // Add zone labels
    const labels = svg.append('g').attr('id', 'zone-labels');
    zoneDefinitions.forEach(zoneDef => {
      labels.append('text')
        .attr('x', zoneDef.labelPos.x)
        .attr('y', zoneDef.labelPos.y)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('class', 'zone-label')
        .attr('data-zone', zoneDef.id)
        .text(zoneDef.label);
    });
  }

  setupColorScale() {
    // Severity Mode: Different scale for lethality percentage
    if (this.viewMode === 'severity') {
      // Lethality is usually between 0% and 3%
      this.colorScale = d3.scaleSequential()
        .domain([0, 3.5]) // Cap at 3.5% fatality rate
        .interpolator(d3.interpolateRdYlGn)
        .clamp(true);

      // Reverse the scale so red = high lethality
      const originalScale = this.colorScale;
      this.colorScale = (value) => originalScale(3.5 - value);

      console.log(`Color scale: Severity mode (0% - 3.5% lethality)`);
      return;
    }

    // Volume Mode: Calculate max value across all zones
    let maxValue = 0;
    let minValue = Infinity;

    Object.values(this.data.zones).forEach(zoneData => {
      const value = this.calculateZoneValue(zoneData);
      if (value > 0) {
        maxValue = Math.max(maxValue, value);
        minValue = Math.min(minValue, value);
      }
    });

    console.log(`Color scale range: ${minValue} - ${maxValue} (${this.viewMode})`);

    // If no data, use dummy values
    if (maxValue === 0) {
      maxValue = 1000000;
      minValue = 0;
    }

    // Create a more dramatic color scale
    // Use quantile for better distribution
    const values = Object.values(this.data.zones)
      .map(d => this.calculateZoneValue(d))
      .filter(v => v > 0)
      .sort((a, b) => a - b);

    if (values.length > 0) {
      // Use Sequential scale for smoother gradients
      this.colorScale = d3.scaleSequential()
        .domain([0, d3.max(values) || 1000])
        .interpolator(d3.interpolateBlues)
        .clamp(true);
    } else {
      // Fallback
      this.colorScale = d3.scaleThreshold()
        .domain([100000, 300000, 600000, 1000000])
        .range(['#38a169', '#ecc94b', '#ed8936', '#e53e3e', '#9b2c2c']);
    }
  }

  updateHeatmap() {
    const self = this;
    const zones = this.svg.selectAll('.impact-zone');

    // Recalculate color scale
    this.setupColorScale();

    zones.each(function() {
      const zone = d3.select(this);
      const zoneId = zone.attr('data-zone');
      const zoneData = self.data.zones[zoneId];

      if (zoneData) {
        const value = self.calculateZoneValue(zoneData);
        
        if (value > 0) {
          const color = self.colorScale(value);
          
          zone
            .transition()
            .duration(600)
            .attr('fill', color)
            .attr('fill-opacity', 0.85)
            .attr('stroke', d3.color(color).darker(0.5))
            .attr('stroke-width', 2);

          // Add glow to high-risk zones
          const maxValue = d3.max(Object.values(self.data.zones), d => self.calculateZoneValue(d));
          if (value > 0.7 * maxValue) {
            zone.style('filter', 'url(#glow)');
          } else {
            zone.style('filter', null);
          }
        } else {
          // No data - show as dark gray
          zone
            .transition()
            .duration(600)
            .attr('fill', '#2d3748')
            .attr('fill-opacity', 0.3)
            .attr('stroke', '#4a5568')
            .attr('stroke-width', 1);
        }
      }
    });

    // Update zone labels visibility
    this.svg.selectAll('.zone-label')
      .transition()
      .duration(600)
      .attr('opacity', 0.9)
      .attr('fill', '#ffffff');

    this.updateLegend();
  }

  calculateLethality(zoneData) {
    if (!zoneData || !zoneData.byYear) return 0;

    let vehicles = 0;
    let fatalities = 0;

    for (let year = this.yearRange[0]; year <= this.yearRange[1]; year++) {
      if (zoneData.byYear[year]) {
        vehicles += zoneData.byYear[year].vehicles || 0;
        fatalities += zoneData.byYear[year].fatalities || 0;
      }
    }

    // Return percentage, avoid divide by zero, require minimum sample size
    return vehicles > 50 ? (fatalities / vehicles) * 100 : 0;
  }

  calculateZoneValue(zoneData) {
    if (!zoneData || !zoneData.byYear) {
      return 0;
    }

    // Handle Severity Mode
    if (this.viewMode === 'severity') {
      return this.calculateLethality(zoneData);
    }

    // Existing Logic (Volume)
    let total = 0;
    const metric = this.viewMode === 'vehicles' ? 'vehicles' :
                   this.viewMode === 'injured' ? 'injured' :
                   this.viewMode === 'fatalities' ? 'fatalities' :
                   'vehicles';

    for (let year = this.yearRange[0]; year <= this.yearRange[1]; year++) {
      const yearData = zoneData.byYear[year];
      if (yearData && yearData[metric]) {
        total += yearData[metric];
      }
    }
    return total;
  }

  bindEvents() {
    const self = this;

    // Zone interactions
    this.svg.selectAll('.impact-zone')
      .on('mouseenter', function(event) {
        const zone = d3.select(this);
        const zoneId = zone.attr('data-zone');
        
        if (!zone.classed('selected')) {
          zone
            .transition()
            .duration(150)
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 3)
            .attr('fill-opacity', 1);
        }

        // Highlight label
        self.svg.select(`.zone-label[data-zone="${zoneId}"]`)
          .transition()
          .duration(150)
          .attr('font-weight', 'bold')
          .attr('font-size', '14px');

        self.showTooltip(event, zoneId);
      })
      .on('mousemove', function(event) {
        self.tooltip
          .style('left', (event.pageX + 15) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseleave', function() {
        const zone = d3.select(this);
        const zoneId = zone.attr('data-zone');
        
        if (!zone.classed('selected')) {
          const zoneData = self.data.zones[zoneId];
          const value = zoneData ? self.calculateZoneValue(zoneData) : 0;
          const color = value > 0 ? self.colorScale(value) : '#2d3748';
          
          zone
            .transition()
            .duration(150)
            .attr('stroke', value > 0 ? d3.color(color).darker(0.5) : '#4a5568')
            .attr('stroke-width', value > 0 ? 2 : 1)
            .attr('fill-opacity', value > 0 ? 0.85 : 0.3);
        }

        // Reset label
        self.svg.select(`.zone-label[data-zone="${zoneId}"]`)
          .transition()
          .duration(150)
          .attr('font-weight', 'normal')
          .attr('font-size', '11px');

        self.hideTooltip();
      })
      .on('click', function() {
        const zoneId = d3.select(this).attr('data-zone');
        self.selectZone(zoneId);
      });
  }

  showTooltip(event, zoneId) {
    const zoneData = this.data.zones[zoneId];
    const zoneName = this.getZoneDisplayName(zoneId);
    
    if (!zoneData) {
      this.tooltip.html(`<strong>${zoneName}</strong><br/>No data available`)
        .style('opacity', 0.95);
      return;
    }

    const vehicles = this.calculateZoneValueForMetric(zoneData, 'vehicles');
    const injured = this.calculateZoneValueForMetric(zoneData, 'injured');
    const fatalities = this.calculateZoneValueForMetric(zoneData, 'fatalities');
    const rate = vehicles > 0 ? ((fatalities / vehicles) * 100).toFixed(2) : '0.00';

    // Different tooltip for severity mode
    let tooltipContent;
    if (this.viewMode === 'severity') {
      tooltipContent = `
        <strong>${zoneName}</strong>
        <div class="tooltip-stats">
          <div>${rate}% lethality rate</div>
          <div>${this.formatNumber(vehicles)} crashes</div>
          <div>${this.formatNumber(fatalities)} fatal</div>
        </div>
        <em>Click to explore</em>
      `;
    } else {
      tooltipContent = `
        <strong>${zoneName}</strong>
        <div class="tooltip-stats">
          <div>${this.formatNumber(vehicles)} vehicles</div>
          <div>${this.formatNumber(injured)} injured</div>
          <div>${this.formatNumber(fatalities)} fatalities</div>
          <div>${rate}% fatality rate</div>
        </div>
        <em>Click to see details</em>
      `;
    }

    this.tooltip
      .html(tooltipContent)
      .style('left', (event.pageX + 15) + 'px')
      .style('top', (event.pageY - 10) + 'px')
      .transition()
      .duration(200)
      .style('opacity', 0.98);
  }

  calculateZoneValueForMetric(zoneData, metric) {
    if (!zoneData || !zoneData.byYear) return 0;
    let total = 0;
    for (let year = this.yearRange[0]; year <= this.yearRange[1]; year++) {
      if (zoneData.byYear[year] && zoneData.byYear[year][metric]) {
        total += zoneData.byYear[year][metric];
      }
    }
    return total;
  }

  hideTooltip() {
    this.tooltip
      .transition()
      .duration(200)
      .style('opacity', 0);
  }

  selectZone(zoneId) {
    const self = this;
    this.selectedZone = zoneId;

    // Update zone appearances
    this.svg.selectAll('.impact-zone').each(function() {
      const zone = d3.select(this);
      const thisZoneId = zone.attr('data-zone');
      const zoneData = self.data.zones[thisZoneId];
      const value = zoneData ? self.calculateZoneValue(zoneData) : 0;
      
      if (thisZoneId === zoneId) {
        zone.classed('selected', true)
          .transition()
          .duration(200)
          .attr('stroke', '#ffd700')
          .attr('stroke-width', 4)
          .attr('fill-opacity', 1);
      } else {
        zone.classed('selected', false)
          .transition()
          .duration(200)
          .attr('fill-opacity', 0.3)
          .attr('stroke', '#4a5568')
          .attr('stroke-width', 1);
      }
    });

    // Show detail panel
    this.showDetailPanel(zoneId);
  }

  showDetailPanel(zoneId) {
    const zoneData = this.data.zones[zoneId];
    const zoneName = this.getZoneDisplayName(zoneId);

    if (!zoneData) {
      this.detailPanel.html(`
        <h3>${zoneName}</h3>
        <p>No data available for this zone.</p>
      `);
      return;
    }

    // Calculate statistics
    const totalVehicles = this.calculateZoneValueForMetric(zoneData, 'vehicles');
    const totalInjured = this.calculateZoneValueForMetric(zoneData, 'injured');
    const totalFatalities = this.calculateZoneValueForMetric(zoneData, 'fatalities');
    const fatalityRate = totalVehicles > 0 ? ((totalFatalities / totalVehicles) * 100).toFixed(2) : '0.00';

    // Build HTML
    const html = `
      <h3>${zoneName}</h3>
      <div class="stats-grid">
        <div class="stat">
          <span class="stat-value">${this.formatNumber(totalVehicles)}</span>
          <span class="stat-label">Vehicles</span>
        </div>
        <div class="stat">
          <span class="stat-value">${this.formatNumber(totalInjured)}</span>
          <span class="stat-label">Injured</span>
        </div>
        <div class="stat">
          <span class="stat-value">${this.formatNumber(totalFatalities)}</span>
          <span class="stat-label">Fatalities</span>
        </div>
        <div class="stat highlight">
          <span class="stat-value">${fatalityRate}%</span>
          <span class="stat-label">Fatality Rate</span>
        </div>
      </div>

      <h4>Maneuver Profile</h4>
      <div id="radar-chart-${zoneId}" class="radar-chart-container"></div>

      <h4>Trend Over Time (${this.yearRange[0]} - ${this.yearRange[1]})</h4>
      <div class="trend-chart" id="trend-chart-${zoneId}"></div>

      <button class="reset-selection-btn" onclick="window.collisionAnatomy.resetSelection()">
        ← Back to Overview
      </button>
    `;

    this.detailPanel.html(html);

    // Draw radar chart for maneuvers
    this.drawRadarChart(`#radar-chart-${zoneId}`, zoneData.byManeuver);

    // Draw trend chart
    this.drawTrendChart(zoneId, zoneData.byYear);
  }

  resetSelection() {
    this.selectedZone = null;
    
    // Reset all zones
    this.updateHeatmap();

    // Show placeholder in detail panel
    this.detailPanel.html(`
      <div class="detail-placeholder">
        <div class="placeholder-icon">🚗</div>
        <h3>Select a Zone</h3>
        <p>Click on any part of the car to see crash statistics for that impact zone.</p>
        <p class="hint">Hover over zones to see quick stats.</p>
      </div>
    `);
  }

  getTopManeuvers(byManeuver, limit) {
    if (!byManeuver) return [];
    
    const skipList = ['Total', 'Unknown', 'Jurisdiction does not provide this data element', 
                      'Choice is other than the preceding values', 'Data element is not applicable'];
    
    const total = Object.entries(byManeuver)
      .filter(([name]) => !skipList.includes(name))
      .reduce((sum, [, d]) => sum + (d.vehicles || 0), 0);

    if (total === 0) return [];

    return Object.entries(byManeuver)
      .filter(([name]) => !skipList.includes(name))
      .map(([name, data]) => ({
        name: this.shortenManeuverName(name),
        count: data.vehicles || 0,
        percent: ((data.vehicles || 0) / total) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  shortenManeuverName(name) {
    const shortNames = {
      'Going straight ahead': 'Going Straight',
      'Turning left': 'Turning Left',
      'Turning right': 'Turning Right',
      'Making U-turn': 'U-Turn',
      'Changing lanes': 'Lane Change',
      'Merging into traffic': 'Merging',
      'Overtaking, passing': 'Passing',
      'Negotiating a curve': 'Curving',
      'Slowing or stopping': 'Slowing',
      'Stopped in traffic': 'Stopped',
      'Starting in traffic': 'Starting',
      'Parked': 'Parked',
      'Reversing': 'Reversing',
      'Leaving parking': 'Leaving Parking',
      'Entering parking': 'Entering Parking',
      'Properly parked': 'Parked (Proper)',
      'Improperly parked': 'Parked (Improper)',
      'Disabled or abandoned': 'Disabled'
    };
    return shortNames[name] || name;
  }

  drawTrendChart(zoneId, byYear) {
    const container = d3.select(`#trend-chart-${zoneId}`);
    if (container.empty()) return;

    const width = 280;
    const height = 120;
    const margin = { top: 15, right: 15, bottom: 30, left: 50 };

    const svg = container.append('svg')
      .attr('width', width)
      .attr('height', height);

    const years = this.data.years.filter(y => y >= this.yearRange[0] && y <= this.yearRange[1]);
    const values = years.map(y => byYear[y] ? (byYear[y][this.viewMode] || 0) : 0);

    if (values.every(v => v === 0)) {
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#718096')
        .text('No trend data available');
      return;
    }

    const xScale = d3.scaleLinear()
      .domain([d3.min(years), d3.max(years)])
      .range([margin.left, width - margin.right]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(values) * 1.1])
      .range([height - margin.bottom, margin.top]);

    const line = d3.line()
      .x((d, i) => xScale(years[i]))
      .y(d => yScale(d))
      .curve(d3.curveMonotoneX);

    const area = d3.area()
      .x((d, i) => xScale(years[i]))
      .y0(height - margin.bottom)
      .y1(d => yScale(d))
      .curve(d3.curveMonotoneX);

    // Area fill
    svg.append('path')
      .datum(values)
      .attr('fill', '#e53e3e')
      .attr('fill-opacity', 0.2)
      .attr('d', area);

    // Line
    svg.append('path')
      .datum(values)
      .attr('fill', 'none')
      .attr('stroke', '#e53e3e')
      .attr('stroke-width', 2.5)
      .attr('d', line);

    // Data points
    svg.selectAll('.data-point')
      .data(values)
      .enter()
      .append('circle')
      .attr('class', 'data-point')
      .attr('cx', (d, i) => xScale(years[i]))
      .attr('cy', d => yScale(d))
      .attr('r', 3)
      .attr('fill', '#e53e3e');

    // X axis
    svg.append('g')
      .attr('transform', `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(xScale)
        .ticks(5)
        .tickFormat(d3.format('d')))
      .selectAll('text')
      .style('font-size', '10px')
      .style('fill', '#a0aec0');

    // Y axis
    svg.append('g')
      .attr('transform', `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(yScale)
        .ticks(4)
        .tickFormat(d => d >= 1000 ? (d/1000).toFixed(0) + 'k' : d))
      .selectAll('text')
      .style('font-size', '10px')
      .style('fill', '#a0aec0');

    // Style axes
    svg.selectAll('.domain, .tick line')
      .style('stroke', '#4a5568');
  }

  drawRadarChart(containerId, zoneManeuvers) {
    // 1. Prepare Data - Focus on most relevant maneuvers
    const relevantManeuvers = [
      'Going straight ahead',
      'Turning left',
      'Turning right',
      'Slowing or stopping',
      'Stopped in traffic'
    ];

    // Calculate totals for percentages
    const total = Object.values(zoneManeuvers).reduce((acc, curr) => acc + (curr.vehicles || 0), 0);

    if (total === 0) {
      d3.select(containerId).html('<p style="text-align: center; color: #64748b;">No maneuver data available</p>');
      return;
    }

    const data = relevantManeuvers.map(m => {
      const val = zoneManeuvers[m] ? zoneManeuvers[m].vehicles : 0;
      return {
        axis: this.shortenManeuverName(m),
        value: (val / total) * 100
      };
    });

    // 2. Setup D3 Radar
    const width = 280;
    const height = 220;
    const radius = Math.min(width, height) / 2 - 40;

    const svg = d3.select(containerId).append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width/2},${height/2})`);

    const rScale = d3.scaleLinear()
      .range([0, radius])
      .domain([0, 50]); // Max 50%

    const angleSlice = Math.PI * 2 / data.length;

    // Draw Grid Circles
    const axisGrid = svg.append("g").attr("class", "axisWrapper");
    [10, 20, 30, 40, 50].forEach(level => {
      axisGrid.append("circle")
        .attr("r", rScale(level))
        .style("fill", "none")
        .style("stroke", "#cbd5e1")
        .style("stroke-dasharray", "4,4")
        .style("stroke-width", "1px");
    });

    // Draw Axes Lines
    const axes = axisGrid.selectAll(".axis")
      .data(data)
      .enter()
      .append("g")
      .attr("class", "axis");

    axes.append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", (d, i) => rScale(50) * Math.cos(angleSlice * i - Math.PI/2))
      .attr("y2", (d, i) => rScale(50) * Math.sin(angleSlice * i - Math.PI/2))
      .style("stroke", "#cbd5e1")
      .style("stroke-width", "1px");

    // Draw Axis Labels
    axes.append("text")
      .attr("x", (d, i) => rScale(62) * Math.cos(angleSlice * i - Math.PI/2))
      .attr("y", (d, i) => rScale(62) * Math.sin(angleSlice * i - Math.PI/2))
      .text(d => d.axis)
      .style("font-size", "11px")
      .style("font-weight", "600")
      .style("fill", "#334155")
      .style("text-anchor", "middle")
      .attr("dy", "0.35em");

    // Draw The Radar Shape
    const radarLine = d3.lineRadial()
      .curve(d3.curveLinearClosed)
      .radius(d => rScale(d.value))
      .angle((d, i) => i * angleSlice);

    // Area fill
    svg.append("path")
      .datum(data)
      .attr("d", radarLine)
      .style("fill", "rgba(59, 130, 246, 0.4)")
      .style("stroke", "#3b82f6")
      .style("stroke-width", 2);

    // Add dots at data points
    svg.selectAll(".radarCircle")
      .data(data)
      .enter()
      .append("circle")
      .attr("class", "radarCircle")
      .attr("r", 4)
      .attr("cx", (d, i) => rScale(d.value) * Math.cos(angleSlice * i - Math.PI/2))
      .attr("cy", (d, i) => rScale(d.value) * Math.sin(angleSlice * i - Math.PI/2))
      .style("fill", "#3b82f6")
      .style("stroke", "#ffffff")
      .style("stroke-width", 2);
  }

  setupControls() {
    const self = this;

    // Year range control
    const yearControl = this.controlsContainer.append('div')
      .classed('control-group', true);

    yearControl.append('label')
      .html('📅 Year Range:');

    const yearSlider = yearControl.append('div')
      .classed('year-slider-container', true);

    yearSlider.append('input')
      .attr('type', 'range')
      .attr('min', 1999)
      .attr('max', 2023)
      .attr('value', 2023)
      .classed('year-slider', true)
      .on('input', function() {
        const endYear = +this.value;
        self.setYearRange(1999, endYear);
        yearLabel.text(`1999 - ${endYear}`);
      });

    const yearLabel = yearSlider.append('span')
      .classed('year-label', true)
      .text('1999 - 2023');

    // Analysis Metric Mode Switcher
    const viewModeControl = this.controlsContainer.append('div')
      .classed('control-group', true);

    viewModeControl.append('label')
      .html('📊 Analysis Metric:');

    const modeContainer = viewModeControl.append('div')
      .classed('mode-switch-container', true);

    const modes = [
      { id: 'vehicles', label: 'Volume (Count)' },
      { id: 'severity', label: 'Lethality (Risk %)' }
    ];

    modes.forEach(mode => {
      modeContainer.append('button')
        .classed('mode-btn', true)
        .classed('active', mode.id === 'vehicles')
        .attr('data-mode', mode.id)
        .text(mode.label)
        .on('click', function() {
          modeContainer.selectAll('.mode-btn').classed('active', false);
          d3.select(this).classed('active', true);

          // If clicking Severity, suggest full year range for statistical significance
          if (mode.id === 'severity' && (self.yearRange[1] - self.yearRange[0] < 10)) {
            console.log("Severity mode works best with broader year ranges for statistical significance");
          }

          self.setViewMode(mode.id);
        });
    });
  }

  updateLegend() {
    this.legendContainer.html('');

    const legend = this.legendContainer.append('div')
      .classed('legend', true);

    // Different legend based on mode
    if (this.viewMode === 'severity') {
      legend.append('span')
        .classed('legend-title', true)
        .text('Lethality Level:');

      // Show gradient for severity
      const items = [
        { color: this.colorScale(0), label: '0% (Safest)' },
        { color: this.colorScale(0.875), label: '0.9%' },
        { color: this.colorScale(1.75), label: '1.8%' },
        { color: this.colorScale(2.625), label: '2.6%' },
        { color: this.colorScale(3.5), label: '3.5%+ (Deadliest)' }
      ];

      items.forEach(item => {
        const itemEl = legend.append('div')
          .classed('legend-item', true);

        itemEl.append('div')
          .classed('legend-color', true)
          .style('background-color', item.color);

        itemEl.append('span')
          .classed('legend-label', true)
          .text(item.label);
      });
    } else {
      legend.append('span')
        .classed('legend-title', true)
        .text('Collision Volume:');

      // Dynamic legend based on actual data
      const values = Object.values(this.data.zones)
        .map(d => this.calculateZoneValue(d))
        .filter(v => v > 0)
        .sort((a, b) => a - b);

      if (values.length > 0) {
        const max = d3.max(values);
        const items = [
          { value: 0, label: 'Low' },
          { value: max * 0.25, label: 'Medium' },
          { value: max * 0.5, label: 'High' },
          { value: max * 0.75, label: 'Very High' },
          { value: max, label: 'Highest' }
        ];

        items.forEach(item => {
          const itemEl = legend.append('div')
            .classed('legend-item', true);

          itemEl.append('div')
            .classed('legend-color', true)
            .style('background-color', this.colorScale(item.value));

          itemEl.append('span')
            .classed('legend-label', true)
            .text(item.label);
        });
      }
    }
  }

  playIntroAnimation() {
    // Fade in car
    this.svg.style('opacity', 0)
      .transition()
      .duration(400)
      .style('opacity', 1);

    // Stagger zone appearance
    this.svg.selectAll('.impact-zone')
      .style('opacity', 0)
      .transition()
      .delay((d, i) => 400 + i * 60)
      .duration(300)
      .style('opacity', 1);

    // Fade in labels
    this.svg.selectAll('.zone-label')
      .style('opacity', 0)
      .transition()
      .delay(800)
      .duration(400)
      .style('opacity', 0.9);
  }

  setYearRange(start, end) {
    this.yearRange = [start, end];
    this.updateHeatmap();
    if (this.selectedZone) {
      this.showDetailPanel(this.selectedZone);
    }
  }

  setViewMode(mode) {
    this.viewMode = mode;
    this.updateHeatmap();
    if (this.selectedZone) {
      this.showDetailPanel(this.selectedZone);
    }
  }

  getZoneDisplayName(zoneId) {
    const names = {
      'front': 'Front Impact Zone',
      'roof': 'Roof (Rollovers)',
      'rear': 'Rear Impact Zone',
      'left-front': 'Left Front',
      'left-middle': 'Left Side (Driver)',
      'left-rear': 'Left Rear',
      'right-front': 'Right Front',
      'right-middle': 'Right Side (Passenger)',
      'right-rear': 'Right Rear',
      'undercarriage': 'Undercarriage',
      'interior': 'Interior',
      'attachment': 'Trailer/Attachment'
    };
    return names[zoneId] || zoneId;
  }

  getManeuverColor(maneuver) {
    const colors = {
      'Going Straight': '#3182ce',
      'Turning Left': '#e53e3e',
      'Turning Right': '#38a169',
      'Lane Change': '#dd6b20',
      'Reversing': '#805ad5',
      'Parked': '#718096',
      'Stopped': '#718096',
      'Merging': '#319795',
      'Passing': '#d69e2e',
      'U-Turn': '#b83280',
      'Slowing': '#4a5568',
      'Curving': '#2b6cb0'
    };
    return colors[maneuver] || '#4299e1';
  }

  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(0) + 'K';
    }
    return num.toLocaleString();
  }
}

// Initialize when data is loaded
function initCollisionAnatomy(containerId, csvPath) {
  console.log("Initializing Collision Anatomy...");
  console.log("Container:", containerId);
  console.log("CSV Path:", csvPath);

  // Custom CSV loader - the CSV has a weird structure with incomplete header row
  d3.text(csvPath).then(text => {
    console.log("CSV text loaded, length:", text.length);

    // Split into lines
    const lines = text.split('\n');
    console.log("Total lines:", lines.length);

    // Build proper header by combining rows 1, 2, and 3
    // Row 1: years (empty, Year, Total×3, then 1999×3, 2000×3, etc.)
    // Row 2: measures (empty, Measures, then "Number of X" repeated)
    // Row 3: just "Vehicle Maneuver","1st Impact Loc", (incomplete!)

    // Parse row 1 to get years
    const yearRow = d3.csvParseRows(lines[0])[0];
    console.log("Year row length:", yearRow.length);

    // Parse row 2 to get measures
    const measureRow = d3.csvParseRows(lines[1])[0];
    console.log("Measure row length:", measureRow.length);

    // Build combined header
    const header = ['Vehicle Maneuver', '1st Impact Loc'];

    // Add year data columns (skip first 2 which are empty/labels)
    for (let i = 2; i < yearRow.length; i++) {
      const year = yearRow[i];
      const measure = measureRow[i];

      if (year === 'Total') {
        // These are the total columns
        if (measure === 'Number of vehicles') header.push('Total');
        else if (measure === 'Number of injured') header.push('Total.1');
        else if (measure === 'Number of fatalities') header.push('Total.2');
      } else if (year) {
        // Year columns - D3 will auto-rename duplicates with .1, .2
        if (measure === 'Number of vehicles') header.push(year);
        else if (measure === 'Number of injured') header.push(year + '.1');
        else if (measure === 'Number of fatalities') header.push(year + '.2');
      }
    }

    console.log("Built header with", header.length, "columns");
    console.log("First 10 columns:", header.slice(0, 10));
    console.log("Last 10 columns:", header.slice(-10));

    // Now combine header with data rows (skip rows 0, 1, 2)
    const dataLines = lines.slice(3);
    console.log("Data lines count:", dataLines.length);
    console.log("First data line sample:", dataLines[0].substring(0, 100));

    const csvText = [header.join(','), ...dataLines].join('\n');

    // Parse with D3
    const rawData = d3.csvParse(csvText);
    console.log("CSV parsed, rows:", rawData.length);

    if (rawData.length > 0) {
      console.log("First row has", Object.keys(rawData[0]).length, "columns");
      console.log("First row columns:", Object.keys(rawData[0]).slice(0, 10));
      console.log("First row sample:", {
        maneuver: rawData[0]['Vehicle Maneuver'],
        impact: rawData[0]['1st Impact Loc'],
        total: rawData[0]['Total'],
        total1: rawData[0]['Total.1'],
        total2: rawData[0]['Total.2'],
        year1999: rawData[0]['1999'],
        year1999_1: rawData[0]['1999.1'],
        year1999_2: rawData[0]['1999.2']
      });
    }

    // Process the data
    const processedData = processCSVData(rawData);

    // Create visualization and store reference globally for reset button
    window.collisionAnatomy = new CollisionAnatomy(containerId, processedData);
  }).catch(error => {
    console.error('Error loading data:', error);
    d3.select(containerId).html(`
      <div class="error-message">
        <h3>⚠️ Error Loading Data</h3>
        <p>Could not load collision data from: ${csvPath}</p>
        <p>Error: ${error.message}</p>
      </div>
    `);
  });
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CollisionAnatomy, initCollisionAnatomy };
}