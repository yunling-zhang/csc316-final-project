// js/circularBarChart.js

const seasonConfig = {
    Winter: { months: ['December', 'January', 'February'], color: '#60a5fa', icon: '', gradient: ['#93c5fd', '#3b82f6'] },
    Spring: { months: ['March', 'April', 'May'], color: '#4ade80', icon: '', gradient: ['#86efac', '#22c55e'] },
    Summer: { months: ['June', 'July', 'August'], color: '#fbbf24', icon: '', gradient: ['#fde047', '#f59e0b'] },
    Fall: { months: ['September', 'October', 'November'], color: '#f97316', icon: '', gradient: ['#fdba74', '#ea580c'] }
};

function getSeasonForMonth(month) {
    for (const [season, config] of Object.entries(seasonConfig)) {
        if (config.months.includes(month)) {
            return { name: season, ...config };
        }
    }
    return { name: 'Unknown', color: '#888', icon: '', gradient: ['#ccc', '#888'] };
}

function parseMonthlyCSVText(csvText) {
    const lines = csvText.trim().split('\n');
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];

    if (lines.length < 4) {
        console.error('Not enough lines in CSV');
        return [];
    }

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

    const yearRow = parseCSVLine(lines[0]);
    const measureRow = parseCSVLine(lines[1]);
    const headerRow = parseCSVLine(lines[2]);

    console.log('Year row:', yearRow);
    console.log('Measure row:', measureRow);
    console.log('Header row:', headerRow);

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

    const monthlyData = [];

    months.forEach((month, monthIndex) => {
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

function parseMonthlyData(rawData) {
    const monthlyData = [];
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];

    const dataRows = rawData.slice(3).filter(row => {
        return row[''] === '' &&
               row['Month'] &&
               months.includes(row['Month']) &&
               row['Collision Sev'] === 'Total' &&
               row['Injury Severity'] === 'Total';
    });

    months.forEach((month, index) => {
        const monthRow = dataRows.find(row => row['Month'] === month);

        if (monthRow) {
            const yearData = {};

            const yearKeys = Object.keys(monthRow).filter(key => {
                return key.match(/^\d{4}$/) || key === 'Total';
            });

            const uniqueYears = [...new Set(yearKeys)];

            uniqueYears.forEach(year => {
                if (year !== 'Total') {
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

    return parseMonthlyDataFromRaw(rawData);
}

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

    const allKeys = Object.keys(rawData[2] || rawData[0]);
    console.log('All column keys:', allKeys);

    const columns = [];
    allKeys.forEach(key => {
        if (key.match && key.match(/^\d{4}$/)) {
            const measure = measureRow[key];
            columns.push({
                key: key,
                year: key,
                measure: measure
            });
        }
    });

    console.log('Column mapping:', columns);

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

    months.forEach((month, monthIndex) => {
        const monthRows = rawData.slice(2).filter(row => {
            const monthCol = row['Month'] || row[''];
            return monthCol === month;
        });

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

        Object.keys(yearColumns).forEach(year => {
            const cols = yearColumns[year];

            let persons = 0, injured = 0, fatalities = 0;

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

function getAvailableYears(monthlyData) {
    if (monthlyData.length === 0) return [];
    return Object.keys(monthlyData[0].yearData).sort();
}

function calculateAllYearsData(data) {
    return data.map(d => {
        const years = Object.keys(d.yearData);
        const totals = years.reduce((acc, year) => {
            acc.persons += d.yearData[year].persons || 0;
            acc.injured += d.yearData[year].injured || 0;
            acc.fatalities += d.yearData[year].fatalities || 0;
            return acc;
        }, { persons: 0, injured: 0, fatalities: 0 });

        return {
            month: d.month,
            monthIndex: d.monthIndex,
            yearData: { 'All Years': totals }
        };
    });
}

let circularChartState = {
    data: null,
    svg: null,
    innerRadius: 0,
    outerRadius: 0,
    showAllYears: false,
    selectedMonth: null,
    isPlaying: false,
    playInterval: null,
    currentYearIndex: 0
};

function initializeCircularChart(data) {
    const container = d3.select('#circular-bar-chart');

    if (container.empty()) {
        console.error('Container #circular-bar-chart not found');
        return;
    }

    const containerNode = container.node();
    const containerRect = containerNode.getBoundingClientRect();

    if (containerRect.width === 0 || containerRect.height === 0) {
        console.warn('Container has no dimensions, setting defaults');
        containerNode.style.minWidth = '600px';
        containerNode.style.minHeight = '600px';
    }

    const width = 600;
    const height = 600;
    const innerRadius = 100;
    const outerRadius = Math.min(width, height) / 2 - 80;

    container.html('');

    const svgRoot = container.append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('class', 'circular-chart-svg');

    const defs = svgRoot.append('defs');

    Object.entries(seasonConfig).forEach(([season, config]) => {
        const gradient = defs.append('radialGradient')
            .attr('id', `season-gradient-${season}`)
            .attr('cx', '50%')
            .attr('cy', '50%')
            .attr('r', '50%');
        gradient.append('stop').attr('offset', '0%').attr('stop-color', config.gradient[0]);
        gradient.append('stop').attr('offset', '100%').attr('stop-color', config.gradient[1]);
    });

    const glowFilter = defs.append('filter')
        .attr('id', 'glow-filter')
        .attr('x', '-50%')
        .attr('y', '-50%')
        .attr('width', '200%')
        .attr('height', '200%');
    glowFilter.append('feGaussianBlur')
        .attr('in', 'SourceGraphic')
        .attr('stdDeviation', '3')
        .attr('result', 'blur');
    glowFilter.append('feMerge')
        .selectAll('feMergeNode')
        .data(['blur', 'SourceGraphic'])
        .join('feMergeNode')
        .attr('in', d => d);

    const shadowFilter = defs.append('filter')
        .attr('id', 'bar-shadow')
        .attr('x', '-20%')
        .attr('y', '-20%')
        .attr('width', '140%')
        .attr('height', '140%');
    shadowFilter.append('feDropShadow')
        .attr('dx', '0')
        .attr('dy', '2')
        .attr('stdDeviation', '3')
        .attr('flood-color', 'rgba(0,0,0,0.3)');

    const svg = svgRoot.append('g')
        .attr('transform', `translate(${width / 2}, ${height / 2})`);

    circularChartState = {
        data: data,
        svg: svg,
        innerRadius: innerRadius,
        outerRadius: outerRadius,
        showAllYears: false
    };

    const years = getAvailableYears(data);
    const currentYear = years[years.length - 1];

    createEnhancedYearSelector(years, currentYear, data, svg, innerRadius, outerRadius);
    drawBackgroundElements(svg, innerRadius, outerRadius);
    drawSeasonRing(svg, data, outerRadius);

    const scales = createScales(data, currentYear, innerRadius, outerRadius);

    drawEnhancedCircularBars(svg, data, currentYear, scales, innerRadius, outerRadius);
    addEnhancedMonthLabels(svg, data, scales, outerRadius);
    addEnhancedCenterLabel(svg, currentYear, data);
    createEnhancedLegend(scales.color, outerRadius, data, currentYear);

    const tooltip = createTooltip();
    addHoverEffects(svg, tooltip, currentYear);
}

function drawBackgroundElements(svg, innerRadius, outerRadius) {
    svg.selectAll('.bg-element').remove();

    const gridRadii = d3.range(innerRadius, outerRadius, (outerRadius - innerRadius) / 4);

    svg.selectAll('.grid-circle')
        .data(gridRadii)
        .join('circle')
        .attr('class', 'bg-element grid-circle')
        .attr('r', d => d)
        .attr('fill', 'none')
        .attr('stroke', '#e5e7eb')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,4')
        .attr('opacity', 0.5);

    const angles = d3.range(0, 12).map(i => (i / 12) * 2 * Math.PI);

    svg.selectAll('.grid-line')
        .data(angles)
        .join('line')
        .attr('class', 'bg-element grid-line')
        .attr('x1', d => innerRadius * Math.sin(d))
        .attr('y1', d => -innerRadius * Math.cos(d))
        .attr('x2', d => outerRadius * Math.sin(d))
        .attr('y2', d => -outerRadius * Math.cos(d))
        .attr('stroke', '#e5e7eb')
        .attr('stroke-width', 1)
        .attr('opacity', 0.3);
}

function drawSeasonRing(svg, data, outerRadius) {
    svg.selectAll('.season-arc').remove();
    svg.selectAll('.season-label').remove();

    const seasonRadius = outerRadius + 25;
    const seasonWidth = 12;

    const seasonArc = d3.arc()
        .innerRadius(seasonRadius)
        .outerRadius(seasonRadius + seasonWidth);

    const seasons = Object.entries(seasonConfig).map(([name, config]) => {
        const startMonth = config.months[0];
        const endMonth = config.months[2];
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];
        const startIndex = monthNames.indexOf(startMonth);
        const endIndex = monthNames.indexOf(endMonth);

        return {
            name,
            config,
            startAngle: (startIndex / 12) * 2 * Math.PI,
            endAngle: ((endIndex + 1) / 12) * 2 * Math.PI
        };
    });

    svg.selectAll('.season-arc')
        .data(seasons)
        .join('path')
        .attr('class', 'season-arc')
        .attr('d', d => seasonArc({
            startAngle: d.startAngle,
            endAngle: d.endAngle
        }))
        .attr('fill', d => d.config.color)
        .attr('opacity', 0.7)
        .attr('stroke', '#fff')
        .attr('stroke-width', 2);

    svg.selectAll('.season-icon')
        .data(seasons)
        .join('text')
        .attr('class', 'season-icon')
        .attr('transform', d => {
            const midAngle = (d.startAngle + d.endAngle) / 2;
            const x = (seasonRadius + seasonWidth + 15) * Math.sin(midAngle);
            const y = -(seasonRadius + seasonWidth + 15) * Math.cos(midAngle);
            return `translate(${x}, ${y})`;
        })
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .style('font-size', '16px')
        .text(d => d.config.icon);
}

function addDynamicStyles() {
    if (document.getElementById('circular-chart-styles')) return;

    const style = document.createElement('style');
    style.id = 'circular-chart-styles';
    style.textContent = `
        @keyframes pulse-glow {
            0%, 100% { filter: url(#glow-filter) brightness(1); }
            50% { filter: url(#glow-filter) brightness(1.3); }
        }
        @keyframes rotate-highlight {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .month-bar.selected {
            stroke: #1e40af !important;
            stroke-width: 4px !important;
        }
        .month-bar.dimmed {
            opacity: 0.3;
        }
        .highest-month {
            animation: pulse-glow 2s ease-in-out infinite;
        }
        .play-btn {
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            border: none;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
        }
        .play-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }
        .play-btn.playing {
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
        }
        .comparison-card {
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            border-radius: 12px;
            padding: 16px;
            margin-top: 16px;
            border: 1px solid #cbd5e1;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .trend-up { color: #ef4444; }
        .trend-down { color: #22c55e; }
        .trend-same { color: #6b7280; }
    `;
    document.head.appendChild(style);
}

function createEnhancedYearSelector(years, initialYear, data, svg, innerRadius, outerRadius) {
    addDynamicStyles();

    const selector = d3.select('#year-selector');
    const controlsDiv = selector.node()?.parentNode;

    if (selector.empty() || !controlsDiv) {
        console.warn('Year selector not found');
        return;
    }

    const allOptions = ['All Years', ...years];

    selector.selectAll('option')
        .data(allOptions)
        .join('option')
        .attr('value', d => d)
        .text(d => d)
        .property('selected', d => d === initialYear);

    let btnContainer = d3.select('#chart-btn-container');
    if (btnContainer.empty()) {
        btnContainer = d3.select(controlsDiv)
            .append('div')
            .attr('id', 'chart-btn-container')
            .style('display', 'inline-flex')
            .style('gap', '8px')
            .style('margin-left', '12px');
    }

    let toggleBtn = d3.select('#all-years-toggle');
    if (toggleBtn.empty()) {
        toggleBtn = btnContainer
            .append('button')
            .attr('id', 'all-years-toggle')
            .attr('class', 'btn btn-outline-primary')
            .style('border-radius', '20px')
            .style('padding', '6px 16px')
            .style('font-weight', 'bold')
            .style('transition', 'all 0.3s ease')
            .text('All Years');
    }

    let playBtn = d3.select('#auto-play-btn');
    if (playBtn.empty()) {
        playBtn = btnContainer
            .append('button')
            .attr('id', 'auto-play-btn')
            .attr('class', 'play-btn')
            .text('Play Years');
    }

    circularChartState.currentYearIndex = years.indexOf(initialYear);

    playBtn.on('click', function() {
        if (circularChartState.isPlaying) {
            clearInterval(circularChartState.playInterval);
            circularChartState.isPlaying = false;
            d3.select(this).classed('playing', false).text('Play Years');
            selector.property('disabled', false).style('opacity', 1);
        } else {
            circularChartState.isPlaying = true;
            circularChartState.showAllYears = false;
            toggleBtn.classed('btn-primary', false).classed('btn-outline-primary', true).text('All Years');
            d3.select(this).classed('playing', true).text('Pause');
            selector.property('disabled', true).style('opacity', 0.5);

            circularChartState.playInterval = setInterval(() => {
                circularChartState.currentYearIndex = (circularChartState.currentYearIndex + 1) % years.length;
                const year = years[circularChartState.currentYearIndex];
                selector.property('value', year);
                updateChartEnhanced(data, year, svg, innerRadius, outerRadius, data);
            }, 1500);
        }
    });

    toggleBtn.on('click', function() {
        if (circularChartState.isPlaying) {
            clearInterval(circularChartState.playInterval);
            circularChartState.isPlaying = false;
            playBtn.classed('playing', false).text('Play Years');
        }

        circularChartState.showAllYears = !circularChartState.showAllYears;

        if (circularChartState.showAllYears) {
            d3.select(this)
                .classed('btn-outline-primary', false)
                .classed('btn-primary', true)
                .text('By Year');
            selector.property('disabled', true).style('opacity', 0.5);

            const allYearsData = calculateAllYearsData(data);
            updateChartEnhanced(allYearsData, 'All Years', svg, innerRadius, outerRadius, data);
        } else {
            d3.select(this)
                .classed('btn-primary', false)
                .classed('btn-outline-primary', true)
                .text('All Years');
            selector.property('disabled', false).style('opacity', 1);

            const selectedYear = selector.property('value');
            updateChartEnhanced(data, selectedYear, svg, innerRadius, outerRadius, data);
        }
    });

    selector.on('change', function() {
        if (circularChartState.isPlaying) {
            clearInterval(circularChartState.playInterval);
            circularChartState.isPlaying = false;
            playBtn.classed('playing', false).text('Play Years');
            selector.property('disabled', false).style('opacity', 1);
        }

        if (!circularChartState.showAllYears) {
            const selectedYear = this.value;
            if (selectedYear === 'All Years') {
                circularChartState.showAllYears = true;
                toggleBtn.classed('btn-outline-primary', false).classed('btn-primary', true)
                    .text('By Year');
                const allYearsData = calculateAllYearsData(data);
                updateChartEnhanced(allYearsData, 'All Years', svg, innerRadius, outerRadius, data);
            } else {
                circularChartState.currentYearIndex = years.indexOf(selectedYear);
                updateChartEnhanced(data, selectedYear, svg, innerRadius, outerRadius, data);
            }
        }
    });
}

function drawEnhancedCircularBars(svg, data, year, scales, innerRadius, outerRadius) {
    const arc = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(d => scales.radius(d.value))
        .startAngle(d => scales.angle(d.month))
        .endAngle(d => scales.angle(d.month) + scales.angle.bandwidth())
        .padAngle(0.02)
        .cornerRadius(4);

    const barsData = data.map(d => {
        const yearData = d.yearData[year] || { persons: 0, injured: 0, fatalities: 0 };
        const season = getSeasonForMonth(d.month);
        return {
            month: d.month,
            monthIndex: d.monthIndex,
            value: yearData.persons,
            injured: yearData.injured,
            fatalities: yearData.fatalities,
            season: season
        };
    });

    const bars = svg.selectAll('.month-bar')
        .data(barsData, d => d.month)
        .join('path')
        .attr('class', 'month-bar')
        .attr('d', arc)
        .attr('fill', d => d.season.color)
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .attr('filter', 'url(#bar-shadow)')
        .style('cursor', 'pointer')
        .attr('data-month', d => d.month)
        .attr('data-value', d => d.value)
        .attr('data-injured', d => d.injured)
        .attr('data-fatalities', d => d.fatalities);

    bars.transition()
        .duration(800)
        .delay((d, i) => i * 60)
        .attrTween('d', function(d) {
            const i = d3.interpolate(0, d.value);
            return function(t) {
                const tempD = { ...d, value: i(t) };
                return arc(tempD);
            };
        });
}

function addEnhancedMonthLabels(svg, data, scales, outerRadius) {
    svg.selectAll('.month-label').remove();

    const labelRadius = outerRadius + 55;

    const labels = svg.selectAll('.month-label')
        .data(data)
        .join('text')
        .attr('class', 'month-label')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('transform', d => {
            const angle = scales.angle(d.month) + scales.angle.bandwidth() / 2;
            const x = labelRadius * Math.sin(angle);
            const y = -labelRadius * Math.cos(angle);
            let rotate = (angle * 180 / Math.PI);
            if (rotate > 90 && rotate < 270) {
                rotate += 180;
            }
            return `translate(${x}, ${y}) rotate(${rotate})`;
        })
        .style('font-size', '11px')
        .style('font-weight', 'bold')
        .style('fill', d => getSeasonForMonth(d.month).color)
        .style('text-shadow', '0 0 3px white, 0 0 3px white')
        .text(d => d.month.substring(0, 3).toUpperCase());
}

function addEnhancedCenterLabel(svg, year, data) {
    svg.selectAll('.center-label').remove();

    const centerGroup = svg.append('g')
        .attr('class', 'center-label');

    centerGroup.append('circle')
        .attr('r', 85)
        .attr('fill', 'white')
        .attr('stroke', '#e5e7eb')
        .attr('stroke-width', 2);

    centerGroup.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', -25)
        .style('font-size', '28px')
        .style('font-weight', 'bold')
        .style('fill', '#1f2937')
        .text(year);

    let totalPersons = 0;
    let totalInjured = 0;
    let totalFatalities = 0;

    data.forEach(d => {
        const yearData = d.yearData[year];
        if (yearData) {
            totalPersons += yearData.persons;
            totalInjured += yearData.injured;
            totalFatalities += yearData.fatalities;
        }
    });

    centerGroup.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', 5)
        .style('font-size', '12px')
        .style('fill', '#6b7280')
        .text('Total Collisions');

    centerGroup.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', 30)
        .style('font-size', '20px')
        .style('font-weight', 'bold')
        .style('fill', '#dc2626')
        .text(totalPersons.toLocaleString());

    centerGroup.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', 55)
        .style('font-size', '10px')
        .style('fill', '#9ca3af')
        .text(`${totalInjured.toLocaleString()} injured · ${totalFatalities.toLocaleString()} fatal`);
}

function updateChartEnhanced(data, year, svg, innerRadius, outerRadius, originalData) {
    addEnhancedCenterLabel(svg, year, data);

    const scales = createScales(data, year, innerRadius, outerRadius);

    const arc = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(d => scales.radius(d.value))
        .startAngle(d => scales.angle(d.month))
        .endAngle(d => scales.angle(d.month) + scales.angle.bandwidth())
        .padAngle(0.02)
        .cornerRadius(4);

    const barsData = data.map(d => {
        const yearData = d.yearData[year] || { persons: 0, injured: 0, fatalities: 0 };
        const season = getSeasonForMonth(d.month);
        return {
            month: d.month,
            monthIndex: d.monthIndex,
            value: yearData.persons,
            injured: yearData.injured,
            fatalities: yearData.fatalities,
            season: season
        };
    });

    svg.selectAll('.month-bar')
        .data(barsData, d => d.month)
        .transition()
        .duration(750)
        .attr('d', arc)
        .attr('fill', d => d.season.color)
        .attr('filter', 'url(#bar-shadow)')
        .attr('data-value', d => d.value)
        .attr('data-injured', d => d.injured)
        .attr('data-fatalities', d => d.fatalities);

    createEnhancedLegend(scales.color, outerRadius, data, year);
}

function createEnhancedLegend(colorScale, outerRadius, data, year) {
    const legendContainer = d3.select('#circular-legend');

    if (legendContainer.empty()) {
        console.warn('Legend container not found');
        return;
    }

    legendContainer.html('');

    const legendWidth = 500;
    const legendHeight = 80;

    const legendSvg = legendContainer.append('svg')
        .attr('width', legendWidth)
        .attr('height', legendHeight);

    const seasonLegend = legendSvg.append('g')
        .attr('transform', 'translate(20, 30)');

    seasonLegend.append('text')
        .attr('x', 0)
        .attr('y', 0)
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .style('fill', '#374151')
        .text('Seasons:');

    const seasons = Object.entries(seasonConfig);
    seasons.forEach(([name, config], i) => {
        const g = seasonLegend.append('g')
            .attr('transform', `translate(${70 + i * 100}, -5)`);

        g.append('rect')
            .attr('width', 16)
            .attr('height', 16)
            .attr('rx', 3)
            .attr('fill', config.color);

        g.append('text')
            .attr('x', 22)
            .attr('y', 12)
            .style('font-size', '11px')
            .style('fill', '#4b5563')
            .text(name);
    });
}

function createScales(data, year, innerRadius, outerRadius) {
    const angleScale = d3.scaleBand()
        .domain(data.map(d => d.month))
        .range([0, 2 * Math.PI])
        .paddingInner(0.05);

    let maxValue = 0;
    data.forEach(d => {
        const yearData = d.yearData[year];
        if (yearData) {
            maxValue = Math.max(maxValue, yearData.persons);
        }
    });

    const radiusScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([innerRadius, outerRadius]);

    const colorScale = d3.scaleSequential()
        .domain([0, maxValue])
        .interpolator(d3.interpolateReds);

    return {
        angle: angleScale,
        radius: radiusScale,
        color: colorScale
    };
}

function createTooltip() {
    let tooltip = d3.select('#circular-tooltip');

    if (tooltip.empty()) {
        tooltip = d3.select('body').append('div')
            .attr('id', 'circular-tooltip')
            .style('position', 'fixed')
            .style('background', 'rgba(30, 30, 30, 0.95)')
            .style('color', '#fff')
            .style('padding', '14px 18px')
            .style('border-radius', '12px')
            .style('font-size', '14px')
            .style('font-family', 'Inter, sans-serif')
            .style('pointer-events', 'none')
            .style('opacity', 0)
            .style('z-index', 10000)
            .style('box-shadow', '0 8px 24px rgba(0,0,0,0.4)')
            .style('border', '1px solid rgba(255,255,255,0.15)')
            .style('transition', 'opacity 0.2s ease')
            .style('max-width', '280px');
    }

    return tooltip;
}

function addHoverEffects(svg, tooltip, currentYear) {
    svg.selectAll('.month-bar')
        .on('mouseenter', function(event) {
            const month = this.getAttribute('data-month');

            d3.select(this)
                .transition()
                .duration(200)
                .style('filter', 'brightness(1.2) saturate(1.3)')
                .attr('stroke-width', 4);

            if (!circularChartState.selectedMonth) {
                svg.selectAll('.month-bar')
                    .filter(function() { return this.getAttribute('data-month') !== month; })
                    .classed('dimmed', true);
            }

            const value = +this.getAttribute('data-value');
            const injured = +this.getAttribute('data-injured');
            const fatalities = +this.getAttribute('data-fatalities');
            const season = getSeasonForMonth(month);

            const year = d3.select('#year-selector').property('value') || currentYear;
            const injuredPct = value > 0 ? ((injured / value) * 100).toFixed(1) : 0;
            const fatalityPct = value > 0 ? ((fatalities / value) * 100).toFixed(2) : 0;

            const allValues = [];
            svg.selectAll('.month-bar').each(function() {
                allValues.push({ month: this.getAttribute('data-month'), value: +this.getAttribute('data-value') });
            });
            allValues.sort((a, b) => b.value - a.value);
            const rank = allValues.findIndex(d => d.month === month) + 1;
            const rankSuffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th';

            tooltip.html(`
                <div style="margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 8px;">
                    <div>
                        <strong style="font-size: 16px; color: ${season.color};">${month}</strong>
                        <span style="color: #9ca3af; font-size: 12px; display: block;">${year} · ${season.name}</span>
                    </div>
                </div>
                <div style="background: rgba(255,255,255,0.1); padding: 8px; border-radius: 6px; margin-bottom: 8px;">
                    <div style="font-size: 24px; font-weight: bold; color: #fbbf24;">${value.toLocaleString()}</div>
                    <div style="font-size: 11px; color: #9ca3af;">Total Persons Involved</div>
                    <div style="font-size: 12px; color: ${season.color}; margin-top: 4px;">${rank}${rankSuffix} highest month</div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
                    <div style="background: rgba(252,165,165,0.2); padding: 6px; border-radius: 4px;">
                        <div style="color: #fca5a5; font-weight: bold;">${injured.toLocaleString()}</div>
                        <div style="color: #9ca3af;">Injured (${injuredPct}%)</div>
                    </div>
                    <div style="background: rgba(239,68,68,0.2); padding: 6px; border-radius: 4px;">
                        <div style="color: #ef4444; font-weight: bold;">${fatalities.toLocaleString()}</div>
                        <div style="color: #9ca3af;">Fatal (${fatalityPct}%)</div>
                    </div>
                </div>
                <div style="margin-top: 8px; font-size: 11px; color: #6b7280; text-align: center;">
                    Click to select/compare
                </div>
            `)
            .style('opacity', 1);
        })
        .on('mousemove', function(event) {
            tooltip
                .style('left', Math.min(event.clientX + 15, window.innerWidth - 300) + 'px')
                .style('top', Math.min(event.clientY - 10, window.innerHeight - 200) + 'px');
        })
        .on('mouseleave', function() {
            const month = this.getAttribute('data-month');

            if (circularChartState.selectedMonth !== month) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .style('filter', null)
                    .attr('stroke-width', 2);
            }

            if (!circularChartState.selectedMonth) {
                svg.selectAll('.month-bar').classed('dimmed', false);
            }

            tooltip.style('opacity', 0);
        })
        .on('click', function(event) {
            event.stopPropagation();
            const month = this.getAttribute('data-month');

            if (circularChartState.selectedMonth === month) {
                circularChartState.selectedMonth = null;
                svg.selectAll('.month-bar')
                    .classed('selected', false)
                    .classed('dimmed', false);
                hideMonthComparison();
            } else {
                circularChartState.selectedMonth = month;
                svg.selectAll('.month-bar')
                    .classed('selected', function() { return this.getAttribute('data-month') === month; })
                    .classed('dimmed', function() { return this.getAttribute('data-month') !== month; });

                showMonthComparison(month, svg);
            }
        });

    // Click anywhere else to deselect
    d3.select('#circular-bar-chart').on('click', function(event) {
        if (event.target.tagName === 'svg' || event.target.classList.contains('circular-chart-svg')) {
            circularChartState.selectedMonth = null;
            svg.selectAll('.month-bar')
                .classed('selected', false)
                .classed('dimmed', false);
            hideMonthComparison();
        }
    });
}

function showMonthComparison(month, svg) {
    hideMonthComparison();

    const year = d3.select('#year-selector').property('value');
    const data = circularChartState.data;
    if (!data) return;

    const monthData = data.find(d => d.month === month);
    if (!monthData) return;

    const season = getSeasonForMonth(month);
    const years = Object.keys(monthData.yearData).filter(y => y !== 'All Years').sort();

    let currentValue = 0, prevValue = 0;
    if (year !== 'All Years') {
        currentValue = monthData.yearData[year]?.persons || 0;
        const prevYear = String(parseInt(year) - 1);
        prevValue = monthData.yearData[prevYear]?.persons || 0;
    }

    const change = prevValue > 0 ? ((currentValue - prevValue) / prevValue * 100).toFixed(1) : 0;
    const trendClass = change > 0 ? 'trend-up' : change < 0 ? 'trend-down' : 'trend-same';
    const trendIcon = change > 0 ? '↑' : change < 0 ? '↓' : '→';

    const allValues = years.map(y => monthData.yearData[y]?.persons || 0).filter(v => v > 0);
    const avgValue = allValues.length > 0 ? Math.round(allValues.reduce((a, b) => a + b, 0) / allValues.length) : 0;
    const maxYear = years.reduce((max, y) =>
        (monthData.yearData[y]?.persons || 0) > (monthData.yearData[max]?.persons || 0) ? y : max, years[0]);
    const minYear = years.reduce((min, y) =>
        (monthData.yearData[y]?.persons || 0) < (monthData.yearData[min]?.persons || 0) ? y : min, years[0]);

    const container = d3.select('#circular-legend');
    const compCard = container.append('div')
        .attr('class', 'comparison-card')
        .attr('id', 'month-comparison-card');

    compCard.html(`
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <div>
                <div style="font-size: 18px; font-weight: bold; color: ${season.color};">${month}</div>
                <div style="font-size: 12px; color: #6b7280;">${season.name} Season</div>
            </div>
            <button onclick="hideMonthComparison()" style="margin-left: auto; background: none; border: none; font-size: 18px; cursor: pointer; color: #9ca3af;">×</button>
        </div>
        ${year !== 'All Years' ? `
        <div style="display: flex; gap: 12px; margin-bottom: 12px;">
            <div style="flex: 1; background: white; padding: 10px; border-radius: 8px; text-align: center;">
                <div style="font-size: 11px; color: #6b7280;">Year-over-Year</div>
                <div class="${trendClass}" style="font-size: 18px; font-weight: bold;">${trendIcon} ${change > 0 ? '+' : ''}${change}%</div>
                <div style="font-size: 10px; color: #9ca3af;">vs ${parseInt(year) - 1}</div>
            </div>
            <div style="flex: 1; background: white; padding: 10px; border-radius: 8px; text-align: center;">
                <div style="font-size: 11px; color: #6b7280;">vs Average</div>
                <div style="font-size: 18px; font-weight: bold; color: ${currentValue > avgValue ? '#ef4444' : '#22c55e'};">
                    ${currentValue > avgValue ? '↑' : '↓'} ${Math.abs(currentValue - avgValue).toLocaleString()}
                </div>
                <div style="font-size: 10px; color: #9ca3af;">avg: ${avgValue.toLocaleString()}</div>
            </div>
        </div>
        ` : ''}
        <div style="font-size: 12px; color: #4b5563;">
            <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #e5e7eb;">
                <span>Worst Year:</span>
                <strong>${maxYear} (${(monthData.yearData[maxYear]?.persons || 0).toLocaleString()})</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 4px 0;">
                <span>Best Year:</span>
                <strong>${minYear} (${(monthData.yearData[minYear]?.persons || 0).toLocaleString()})</strong>
            </div>
        </div>
    `);
}

function hideMonthComparison() {
    d3.select('#month-comparison-card').remove();
}

window.hideMonthComparison = hideMonthComparison;

