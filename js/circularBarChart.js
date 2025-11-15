// js/circularBarChart.js

/**
 * Parse CSV text with complex multi-row header structure
 */
function parseMonthlyCSVText(csvText) {
    const lines = csvText.trim().split('\n');
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];

    if (lines.length < 4) {
        console.error('Not enough lines in CSV');
        return [];
    }

    // Parse CSV lines manually
    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        return result;
    }

    // Parse the header rows
    const yearRow = parseCSVLine(lines[0]); // Years
    const measureRow = parseCSVLine(lines[1]); // Measures
    const headerRow = parseCSVLine(lines[2]); // Month, Collision Sev, Injury Severity

    console.log('Year row:', yearRow);
    console.log('Measure row:', measureRow);
    console.log('Header row:', headerRow);

    // Build column index mapping
    // Each year has 3 columns: persons, injured, fatalities
    const yearColumnMap = {};

    for (let i = 3; i < yearRow.length; i++) {
        const year = yearRow[i];
        const measure = measureRow[i];

        if (year && year.match(/^\d{4}$/)) {
            if (!yearColumnMap[year]) {
                yearColumnMap[year] = {};
            }

            if (measure === 'Number of persons') {
                yearColumnMap[year].personsCol = i;
            } else if (measure === 'Number of injured') {
                yearColumnMap[year].injuredCol = i;
            } else if (measure === 'Number of fatalities') {
                yearColumnMap[year].fatalitiesCol = i;
            }
        }
    }

    console.log('Year column mapping:', yearColumnMap);

    // Parse data rows
    const monthlyData = [];

    months.forEach((month, monthIndex) => {
        // Find the row for this month with Total/Total/Total
        let monthRow = null;

        for (let i = 3; i < lines.length; i++) {
            const row = parseCSVLine(lines[i]);

            if (row[0] === month && row[1] === 'Total' && row[2] === 'Total') {
                monthRow = row;
                break;
            }
        }

        if (!monthRow) {
            console.warn(`No data found for month: ${month}`);
            return;
        }

        const yearData = {};

        // Extract data for each year
        Object.keys(yearColumnMap).forEach(year => {
            const cols = yearColumnMap[year];

            const persons = +(monthRow[cols.personsCol]) || 0;
            const injured = +(monthRow[cols.injuredCol]) || 0;
            const fatalities = +(monthRow[cols.fatalitiesCol]) || 0;

            yearData[year] = { persons, injured, fatalities };
        });

        monthlyData.push({
            month: month,
            monthIndex: monthIndex,
            yearData: yearData
        });
    });

    return monthlyData;
}

/**
 * Parse monthly collision data from the CSV
 * Extracts Total collisions by month for each year
 */
function parseMonthlyData(rawData) {
    const monthlyData = [];
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];

    // Skip first 3 rows (headers), filter for Total collisions with Total injury severity
    const dataRows = rawData.slice(3).filter(row => {
        return row[''] === '' &&
               row['Month'] &&
               months.includes(row['Month']) &&
               row['Collision Sev'] === 'Total' &&
               row['Injury Severity'] === 'Total';
    });

    // Process each month
    months.forEach((month, index) => {
        const monthRow = dataRows.find(row => row['Month'] === month);

        if (monthRow) {
            const yearData = {};

            // Extract data for each year
            // The CSV has Year headers in row 2, and triplets of columns (persons, injured, fatalities)
            const yearKeys = Object.keys(monthRow).filter(key => {
                return key.match(/^\d{4}$/) || key === 'Total';
            });

            // Group by year (every 3rd column is persons, injured, fatalities)
            const uniqueYears = [...new Set(yearKeys)];

            uniqueYears.forEach(year => {
                if (year !== 'Total') {
                    // Find the persons column for this year
                    const personValue = monthRow[year];
                    if (personValue) {
                        yearData[year] = {
                            persons: +personValue || 0,
                            injured: 0,
                            fatalities: 0
                        };
                    }
                }
            });

            monthlyData.push({
                month: month,
                monthIndex: index,
                yearData: yearData
            });
        }
    });

    // Now get injured and fatalities data from the raw CSV
    // We need to parse the actual CSV structure with year columns
    // Let's use a different approach - parse the header row to map columns

    return parseMonthlyDataFromRaw(rawData);
}

/**
 * Alternative parser that handles the complex multi-row header structure
 */
function parseMonthlyDataFromRaw(rawData) {
    const monthlyData = [];
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];

    if (rawData.length < 3) {
        console.error('Not enough rows in data');
        return monthlyData;
    }

    // D3 uses first row as column names
    // Our CSV structure:
    // Row 1 (becomes column names): ,,Year,"Total","Total","Total","1999","1999","1999","2000",...
    // Row 2 (rawData[0]): ,,Measures,"Number of persons","Number of injured","Number of fatalities",...
    // Row 3 (rawData[1]): "Month","Collision Sev","Injury Severity",
    // Row 4+ (rawData[2+]): actual data

    const measureRow = rawData[0];

    // Get all column keys from the first data row
    const allKeys = Object.keys(rawData[2] || rawData[0]);
    console.log('All column keys:', allKeys);

    // Build column mapping
    // The column names are the years from row 1, which D3 uses as keys
    const columns = [];
    allKeys.forEach(key => {
        // Check if the key is a 4-digit year
        if (key.match && key.match(/^\d{4}$/)) {
            // Find the corresponding measure for this column
            const measure = measureRow[key];
            columns.push({
                key: key,
                year: key,
                measure: measure
            });
        }
    });

    console.log('Column mapping:', columns);

    // Group columns by year
    const yearColumns = {};
    columns.forEach(col => {
        if (!yearColumns[col.year]) {
            yearColumns[col.year] = {};
        }
        if (col.measure === 'Number of persons') {
            yearColumns[col.year].personsKey = col.key;
        } else if (col.measure === 'Number of injured') {
            yearColumns[col.year].injuredKey = col.key;
        } else if (col.measure === 'Number of fatalities') {
            yearColumns[col.year].fatalitiesKey = col.key;
        }
    });

    console.log('Year columns mapping:', yearColumns);

    // Process each month - data starts from rawData[2] onwards (after measure row and header row)
    months.forEach((month, monthIndex) => {
        // Find the row for this month with Total collision severity and Total injury severity
        const monthRows = rawData.slice(2).filter(row => {
            // Check the Month column (first column in data)
            const monthCol = row['Month'] || row[''];
            return monthCol === month;
        });

        // Find the Total/Total/Total row for this month
        const monthRow = monthRows.find(row => {
            const collisionSev = row['Collision Sev'] || row[''];
            const injurySev = row['Injury Severity'] || row[''];
            return collisionSev === 'Total' && injurySev === 'Total';
        });

        if (!monthRow) {
            console.warn(`No data found for month: ${month}`);
            return;
        }

        const yearData = {};

        // Extract data for each year
        Object.keys(yearColumns).forEach(year => {
            const cols = yearColumns[year];

            // Since there are multiple columns with the same year, we need to find the right ones
            // by matching the measure type from the second row
            let persons = 0, injured = 0, fatalities = 0;

            // Find all columns for this year
            columns.filter(c => c.year === year).forEach(col => {
                const value = +monthRow[col.key] || 0;
                if (col.measure === 'Number of persons') {
                    persons = value;
                } else if (col.measure === 'Number of injured') {
                    injured = value;
                } else if (col.measure === 'Number of fatalities') {
                    fatalities = value;
                }
            });

            yearData[year] = { persons, injured, fatalities };
        });

        monthlyData.push({
            month: month,
            monthIndex: monthIndex,
            yearData: yearData
        });
    });

    console.log('Parsed monthly data:', monthlyData);
    return monthlyData;
}

/**
 * Get list of available years from the data
 */
function getAvailableYears(monthlyData) {
    if (monthlyData.length === 0) return [];
    return Object.keys(monthlyData[0].yearData).sort();
}

/**
 * Initialize the circular bar chart visualization
 */
function initializeCircularChart(data) {
    const container = d3.select('#circular-bar-chart');

    if (container.empty()) {
        console.error('Container #circular-bar-chart not found');
        return;
    }
    // Ensure container has minimum dimensions
    const containerNode = container.node();
    const containerRect = containerNode.getBoundingClientRect();
    
    // If container has no size (hidden or zero dimensions), set a minimum
    if (containerRect.width === 0 || containerRect.height === 0) {
        console.warn('Container has no dimensions, setting defaults');
        containerNode.style.minWidth = '800px';
        containerNode.style.minHeight = '800px';
    }

    // Configuration
    const width = 800;
    const height = 800;
    const margin = { top: 40, right: 40, bottom: 40, left: 40 };
    const innerRadius = 120;
    const outerRadius = Math.min(width, height) / 2 - 60;

    // Clear any existing content
    container.html('');

    // Create SVG
    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${width / 2}, ${height / 2})`);

    // Get available years and set initial year
    const years = getAvailableYears(data);
    const currentYear = years[years.length - 1]; // Most recent year

    // Create year selector
    createYearSelector(years, currentYear, data, svg, innerRadius, outerRadius);

    // Create scales
    const scales = createScales(data, currentYear, innerRadius, outerRadius);

    // Draw the chart
    drawCircularBars(svg, data, currentYear, scales);

    // Add month labels
    addMonthLabels(svg, data, scales, outerRadius);

    // Add center label
    addCenterLabel(svg, currentYear);

    // Create legend
    createLegend(scales.color, outerRadius);

    // Create tooltip
    const tooltip = createTooltip();

    // Add hover effects
    addHoverEffects(svg, tooltip, currentYear);
}

/**
 * Create D3 scales for the visualization
 */
function createScales(data, year, innerRadius, outerRadius) {
    // Angular scale - one band per month
    const angleScale = d3.scaleBand()
        .domain(data.map(d => d.month))
        .range([0, 2 * Math.PI])
        .paddingInner(0.05);

    // Find max value for radial scale
    let maxValue = 0;
    data.forEach(d => {
        const yearData = d.yearData[year];
        if (yearData) {
            maxValue = Math.max(maxValue, yearData.persons);
        }
    });

    // Radial scale - from inner to outer radius
    const radiusScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([innerRadius, outerRadius]);

    // Color scale - sequential from light to dark red
    const colorScale = d3.scaleSequential()
        .domain([0, maxValue])
        .interpolator(d3.interpolateReds);

    return {
        angle: angleScale,
        radius: radiusScale,
        color: colorScale
    };
}

/**
 * Draw circular bars
 */
function drawCircularBars(svg, data, year, scales) {
    // Arc generator
    const arc = d3.arc()
        .innerRadius(scales.radius(0))
        .outerRadius(d => scales.radius(d.value))
        .startAngle(d => scales.angle(d.month))
        .endAngle(d => scales.angle(d.month) + scales.angle.bandwidth())
        .padAngle(0.01)
        .padRadius(scales.radius(0));

    // Prepare data with values
    const barsData = data.map(d => ({
        month: d.month,
        monthIndex: d.monthIndex,
        value: d.yearData[year] ? d.yearData[year].persons : 0,
        injured: d.yearData[year] ? d.yearData[year].injured : 0,
        fatalities: d.yearData[year] ? d.yearData[year].fatalities : 0
    }));

    // Draw bars
    const bars = svg.selectAll('.month-bar')
        .data(barsData, d => d.month)
        .join('path')
        .attr('class', 'month-bar')
        .attr('d', arc)
        .attr('fill', d => scales.color(d.value))
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .attr('data-month', d => d.month)
        .attr('data-value', d => d.value)
        .attr('data-injured', d => d.injured)
        .attr('data-fatalities', d => d.fatalities);

    // Animate on initial load
    bars.transition()
        .duration(500)
        .delay((d, i) => i * 50)
        .attrTween('d', function(d) {
            const i = d3.interpolate(0, d.value);
            return function(t) {
                const tempD = { ...d, value: i(t) };
                return arc(tempD);
            };
        });
}

/**
 * Add month labels around the circle
 */
function addMonthLabels(svg, data, scales, outerRadius) {
    const labelRadius = outerRadius + 30;

    const labels = svg.selectAll('.month-label')
        .data(data)
        .join('text')
        .attr('class', 'month-label')
        .attr('text-anchor', 'middle')
        .attr('transform', d => {
            const angle = scales.angle(d.month) + scales.angle.bandwidth() / 2;
            const x = labelRadius * Math.sin(angle);
            const y = -labelRadius * Math.cos(angle);
            const rotate = (angle * 180 / Math.PI);
            return `translate(${x}, ${y}) rotate(${rotate > 90 && rotate < 270 ? rotate + 180 : rotate})`;
        })
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .style('fill', '#333')
        .text(d => d.month.substring(0, 3));
}

/**
 * Add center label showing selected year
 */
function addCenterLabel(svg, year) {
    svg.selectAll('.center-label').remove();

    const centerGroup = svg.append('g')
        .attr('class', 'center-label');

    centerGroup.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', -10)
        .style('font-size', '24px')
        .style('font-weight', 'bold')
        .style('fill', '#333')
        .text(year);

    centerGroup.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', 15)
        .style('font-size', '14px')
        .style('fill', '#666')
        .text('Collisions by Month');
}

/**
 * Create year selector dropdown
 */
function createYearSelector(years, initialYear, data, svg, innerRadius, outerRadius) {
    const selector = d3.select('#year-selector');

    if (selector.empty()) {
        console.warn('Year selector not found');
        return;
    }

    // Populate options
    selector.selectAll('option')
        .data(years)
        .join('option')
        .attr('value', d => d)
        .text(d => d)
        .property('selected', d => d === initialYear);

    // Add change listener
    selector.on('change', function() {
        const selectedYear = this.value;
        updateChart(data, selectedYear, svg, innerRadius, outerRadius);
    });
}

/**
 * Update chart when year changes
 */
function updateChart(data, year, svg, innerRadius, outerRadius) {
    // Update center label
    addCenterLabel(svg, year);

    // Update scales
    const scales = createScales(data, year, innerRadius, outerRadius);

    // Arc generator
    const arc = d3.arc()
        .innerRadius(scales.radius(0))
        .outerRadius(d => scales.radius(d.value))
        .startAngle(d => scales.angle(d.month))
        .endAngle(d => scales.angle(d.month) + scales.angle.bandwidth())
        .padAngle(0.01)
        .padRadius(scales.radius(0));

    // Prepare updated data
    const barsData = data.map(d => ({
        month: d.month,
        monthIndex: d.monthIndex,
        value: d.yearData[year] ? d.yearData[year].persons : 0,
        injured: d.yearData[year] ? d.yearData[year].injured : 0,
        fatalities: d.yearData[year] ? d.yearData[year].fatalities : 0
    }));

    // Update bars with transition
    svg.selectAll('.month-bar')
        .data(barsData, d => d.month)
        .transition()
        .duration(750)
        .attr('d', arc)
        .attr('fill', d => scales.color(d.value))
        .attr('data-value', d => d.value)
        .attr('data-injured', d => d.injured)
        .attr('data-fatalities', d => d.fatalities);

    // Update legend
    createLegend(scales.color, outerRadius);
}

/**
 * Create tooltip element
 */
function createTooltip() {
    let tooltip = d3.select('#circular-tooltip');

    if (tooltip.empty()) {
        tooltip = d3.select('body').append('div')
            .attr('id', 'circular-tooltip')
            .style('position', 'fixed')
            .style('background', 'rgba(30, 30, 30, 0.95)')
            .style('color', '#fff')
            .style('padding', '14px 18px')
            .style('border-radius', '8px')
            .style('font-size', '14px')
            .style('font-family', 'Inter, sans-serif')
            .style('pointer-events', 'none')
            .style('opacity', 0)
            .style('z-index', 10000)
            .style('box-shadow', '0 6px 16px rgba(0,0,0,0.4)')
            .style('border', '1px solid rgba(255,255,255,0.1)')
            .style('transition', 'opacity 0.2s ease');
    }

    return tooltip;
}

/**
 * Add hover effects to bars
 */
function addHoverEffects(svg, tooltip, currentYear) {
    svg.selectAll('.month-bar')
        .on('mouseenter', function(event) {
            // Scale up the bar
            d3.select(this)
                .transition()
                .duration(200)
                .style('filter', 'brightness(1.2) saturate(1.2)')
                .style('stroke-width', '3px');

            // Show tooltip
            const month = this.getAttribute('data-month');
            const value = +this.getAttribute('data-value');
            const injured = +this.getAttribute('data-injured');
            const fatalities = +this.getAttribute('data-fatalities');

            const year = d3.select('#year-selector').property('value') || currentYear;

            // Calculate percentage injured and fatalities
            const injuredPct = value > 0 ? ((injured / value) * 100).toFixed(1) : 0;
            const fatalityPct = value > 0 ? ((fatalities / value) * 100).toFixed(2) : 0;

            tooltip.html(`
                <div style="margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 6px;">
                    <strong style="font-size: 16px; color: #fbbf24;">${month} ${year}</strong>
                </div>
                <div style="line-height: 1.6;">
                    <div style="margin-bottom: 4px;">
                        <strong>Total Persons:</strong> ${value.toLocaleString()}
                    </div>
                    <div style="margin-bottom: 4px; color: #fca5a5;">
                        <strong>Injured:</strong> ${injured.toLocaleString()} <span style="color: #d1d5db;">(${injuredPct}%)</span>
                    </div>
                    <div style="color: #ef4444;">
                        <strong>Fatalities:</strong> ${fatalities.toLocaleString()} <span style="color: #d1d5db;">(${fatalityPct}%)</span>
                    </div>
                </div>
            `)
            .style('opacity', 1);
        })
        .on('mousemove', function(event) {
            tooltip
                .style('left', (event.clientX + 20) + 'px')
                .style('top', (event.clientY - 20) + 'px');
        })
        .on('mouseleave', function() {
            // Reset scale
            d3.select(this)
                .transition()
                .duration(200)
                .style('filter', 'brightness(1)')
                .style('stroke-width', '2px');

            // Hide tooltip
            tooltip.style('opacity', 0);
        });
}

/**
 * Create color scale legend
 */
function createLegend(colorScale, outerRadius) {
    const legendContainer = d3.select('#circular-legend');

    if (legendContainer.empty()) {
        console.warn('Legend container not found');
        return;
    }

    legendContainer.html('');

    const legendWidth = 300;
    const legendHeight = 20;

    const legendSvg = legendContainer.append('svg')
        .attr('width', legendWidth + 100)
        .attr('height', legendHeight + 60);

    const legendGroup = legendSvg.append('g')
        .attr('transform', 'translate(20, 25)');

    // Create gradient
    const defs = legendSvg.append('defs');
    const gradient = defs.append('linearGradient')
        .attr('id', 'legend-gradient');

    const stops = d3.range(0, 1.1, 0.1);
    gradient.selectAll('stop')
        .data(stops)
        .join('stop')
        .attr('offset', d => `${d * 100}%`)
        .attr('stop-color', d => colorScale(colorScale.domain()[0] + d * (colorScale.domain()[1] - colorScale.domain()[0])));

    // Draw rectangle
    legendGroup.append('rect')
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .style('fill', 'url(#legend-gradient)')
        .style('stroke', '#ccc')
        .style('stroke-width', 1);

    // Add labels
    const [minVal, maxVal] = colorScale.domain();

    legendGroup.append('text')
        .attr('x', 0)
        .attr('y', legendHeight + 15)
        .style('font-size', '12px')
        .style('text-anchor', 'start')
        .text(Math.round(minVal).toLocaleString());

    legendGroup.append('text')
        .attr('x', legendWidth)
        .attr('y', legendHeight + 15)
        .style('font-size', '12px')
        .style('text-anchor', 'end')
        .text(Math.round(maxVal).toLocaleString());

    legendGroup.append('text')
        .attr('x', legendWidth / 2)
        .attr('y', -8)
        .style('font-size', '12px')
        .style('text-anchor', 'middle')
        .style('font-weight', 'bold')
        .text('Number of Persons Involved');
}
