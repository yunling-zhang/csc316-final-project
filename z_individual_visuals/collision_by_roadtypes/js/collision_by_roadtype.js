fetch('data/collisions_by_division_cleaned.csv')
    .then(response => response.text())
    .then(text => {
        const parsed = Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true });
        initCollisionChart(parsed.data);
    })
    .catch(error => {
        console.error('Failed to load collision data:', error);
    });

function initCollisionChart(rawData) {

let width = 700;
let height = 700;
const innerRadius = 100;
const outerRadius = Math.min(width, height) / 2 - 80;

let currentStartYear = 1999;
let currentEndYear = 2021;
let currentView = 'detailed';
let enabledTypes = new Set(rawData.map(d => d['Roadway Type']));
let enabledCombinedTypes = new Set(['Undivided', 'Divided']);

const detailedColors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'];
const combinedColors = ['#3498db', '#e74c3c'];

const detailedColorScale = d3.scaleOrdinal()
    .domain(rawData.map(d => d['Roadway Type']))
    .range(detailedColors);

const combinedColorScale = d3.scaleOrdinal()
    .domain(['Undivided', 'Divided'])
    .range(combinedColors);

const svgContainer = d3.select('#chart')
    .append('svg')
    .attr('width', width)
    .attr('height', height);

const defs = svgContainer.append('defs');

const svg = svgContainer.append('g')
    .attr('transform', `translate(${width / 2}, ${height / 2})`);

const tooltip = d3.select('.tooltip');

let scaleRaf = null;
let baseContainerWidth = null;
let baseContainerHeight = null;

function isMacBookAir13() {
    const isMac = navigator.platform && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const width = window.innerWidth;
    const height = window.innerHeight;
    return isMac && width >= 1300 && width <= 1500 && height >= 800 && height <= 950;
}

function updateContainerScale() {
    const containerEl = document.querySelector('.container');
    if (!containerEl) return;

    if (baseContainerWidth === null || baseContainerHeight === null) {
        const rect = containerEl.getBoundingClientRect();
        baseContainerWidth = rect.width;
        baseContainerHeight = rect.height;
    }

    const viewportPadding = 40;
    const availableWidth = Math.max(window.innerWidth - viewportPadding, 320);
    const availableHeight = Math.max(window.innerHeight - viewportPadding, 320);

    const baseScale = Math.min(
        availableWidth / baseContainerWidth,
        availableHeight / baseContainerHeight,
        1
    );

    const deviceScale = isMacBookAir13() ? 0.8 : 1;
    const scale = Math.min(baseScale, deviceScale);

    containerEl.style.transform = `scale(${scale})`;
}

function scheduleContainerScale() {
    if (scaleRaf) {
        cancelAnimationFrame(scaleRaf);
    }
    scaleRaf = requestAnimationFrame(() => {
        scaleRaf = null;
        updateContainerScale();
    });
}

window.addEventListener('resize', scheduleContainerScale);

const imageUrls = {
    'Undivided (Two-way, two-lane)': 'data/road_type_img/undivided_2w2l.png',
    'Undivided (Two-way, multi-lane)': 'data/road_type_img/undivided_2wml.png',
    'Divided (Barrier median)': 'data/road_type_img/divided_with_barrier.png',
    'Divided (Median, no barrier)': 'data/road_type_img/divided_no_barrier.png',
    'Divided (Type not specified)': 'data/road_type_img/divided_not_specified.png',
    'Undivided': 'data/road_type_img/undivided_2w2l.png',
    'Divided': 'data/road_type_img/divided_no_barrier.png'
};

const legend = d3.select('#legend');

function updateLegend() {
    legend.html('');

    if (currentView === 'detailed') {
        rawData.forEach(d => {
            const item = legend.append('div')
                .attr('class', 'legend-item')
                .classed('disabled', !enabledTypes.has(d['Roadway Type']))
                .on('click', () => {
                    if (enabledTypes.has(d['Roadway Type'])) {
                        enabledTypes.delete(d['Roadway Type']);
                    } else {
                        enabledTypes.add(d['Roadway Type']);
                    }
                    updateLegend();
                    updateChart(currentStartYear, currentEndYear);
                });

            item.append('div')
                .attr('class', 'legend-color')
                .style('background-color', detailedColorScale(d['Roadway Type']));
            item.append('span').text(d['Roadway Type']);
        });
    } else {
        ['Undivided', 'Divided'].forEach(type => {
            const item = legend.append('div')
                .attr('class', 'legend-item')
                .classed('disabled', !enabledCombinedTypes.has(type))
                .on('click', () => {
                    if (enabledCombinedTypes.has(type)) {
                        enabledCombinedTypes.delete(type);
                    } else {
                        enabledCombinedTypes.add(type);
                    }
                    updateLegend();
                    updateChart(currentStartYear, currentEndYear);
                });

            item.append('div')
                .attr('class', 'legend-color')
                .style('background-color', combinedColorScale(type));
            item.append('span').text(type);
        });
    }
}

document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentView = btn.dataset.view;

        if (currentView === 'combined') {
            enabledCombinedTypes = new Set(['Undivided', 'Divided']);
        } else {
            enabledTypes = new Set(rawData.map(d => d['Roadway Type']));
        }

        updateLegend();
        updateChart(currentStartYear, currentEndYear);
    });
});

const yearRangeDisplay = document.getElementById('yearRangeDisplay');

function createBrush(containerId, min, max, defaultMin, defaultMax, onBrush) {
    const container = d3.select(`#${containerId}`);
    container.html('');

    const width = container.node().getBoundingClientRect().width || 600;
    const height = 70;
    const margin = { top: 5, right: 20, bottom: 25, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const brushSvg = container.append('svg')
        .attr('width', width)
        .attr('height', height);

    const g = brushSvg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain([min, max])
        .range([0, innerWidth]);

    const tickYears = [2000, 2005, 2010, 2015, 2020];

    const axis = d3.axisBottom(x)
        .tickValues(tickYears)
        .tickFormat(d3.format('d'));

    g.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(axis);

    const brush = d3.brushX()
        .extent([[0, 0], [innerWidth, innerHeight]])
        .on('brush end', brushed);

    const brushG = g.append('g')
        .attr('class', 'brush')
        .call(brush);

    brushG.call(brush.move, [x(defaultMin), x(defaultMax)]);

    function brushed(event) {
        if (!event.selection) return;
        const [x0, x1] = event.selection.map(x.invert);
        const minYear = Math.round(x0);
        const maxYear = Math.round(x1);
        onBrush(minYear, maxYear);
    }

    return { brush, brushG, x };
}

function getCombinedData(startYear, endYear) {
    const undividedData = [];
    const dividedData = [];

    rawData.forEach(row => {
        const label = row['Roadway Type'];
        if (label.includes('Undivided')) {
            undividedData.push(row);
        } else if (label.includes('Divided')) {
            dividedData.push(row);
        }
    });

    const combined = [];

    if (enabledCombinedTypes.has('Undivided')) {
        let undividedSum = 0;
        undividedData.forEach(row => {
            for (let year = startYear; year <= endYear; year++) {
                undividedSum += parseFloat(row[year.toString()]) || 0;
            }
        });
        combined.push({
            label: 'Undivided',
            value: undividedSum,
            avgPerYear: undividedSum / (endYear - startYear + 1)
        });
    }

    if (enabledCombinedTypes.has('Divided')) {
        let dividedSum = 0;
        dividedData.forEach(row => {
            for (let year = startYear; year <= endYear; year++) {
                dividedSum += parseFloat(row[year.toString()]) || 0;
            }
        });
        combined.push({
            label: 'Divided',
            value: dividedSum,
            avgPerYear: dividedSum / (endYear - startYear + 1)
        });
    }

    return combined;
}

function updateChart(startYear, endYear) {
    currentStartYear = startYear;
    currentEndYear = endYear;

    const avgYear = Math.round((startYear + endYear) / 2);
    yearRangeDisplay.textContent = `${startYear} - ${endYear} (avg: ${avgYear})`;

    let chartData;

    if (currentView === 'combined') {
        chartData = getCombinedData(startYear, endYear);
    } else {
        chartData = rawData
            .filter(row => enabledTypes.has(row['Roadway Type']))
            .map(row => {
                let sum = 0;
                for (let year = startYear; year <= endYear; year++) {
                    sum += parseFloat(row[year.toString()]) || 0;
                }
                return {
                    label: row['Roadway Type'],
                    value: sum,
                    avgPerYear: sum / (endYear - startYear + 1)
                };
            });
    }

    svg.selectAll('.center-circle').remove();
    svg.selectAll('.center-text').remove();

    const xScale = d3.scaleBand()
        .domain(chartData.map(d => d.label))
        .range([0, 2 * Math.PI])
        .padding(0.15);

    const maxValue = d3.max(chartData, d => d.value);
    const yScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([innerRadius, outerRadius]);

    const numBars = chartData.length;

    let chartWidth = 700;
    let chartHeight = 700;
    let centerX = chartWidth / 2;
    let centerY = chartHeight / 2;

    if (numBars === 1) {
        chartHeight = 500;
        centerY = 350;
    } else if (numBars === 2) {
        chartHeight = 360;
        centerY = chartHeight / 2;
    } else if (numBars === 3) {
        chartHeight = 580;
        centerY = 320;
    } else if (numBars === 4) {
        chartHeight = 600;
        centerY = chartHeight / 2;
    } else {
        chartHeight = 500;
        centerY = chartHeight / 2 + 20;
    }

    svgContainer
        .attr('width', chartWidth)
        .attr('height', chartHeight);

    svg.attr('transform', `translate(${centerX}, ${centerY})`);

    const maxBarScale = d3.scaleBand()
        .domain([1, 2, 3])
        .range([0, 2 * Math.PI])
        .padding(0.15);

    const maxBarWidth = maxBarScale.bandwidth() * innerRadius * 0.9;
    const calculatedBarWidth = xScale.bandwidth() * innerRadius * 0.9;
    const barWidth = Math.min(calculatedBarWidth, maxBarWidth);

    let barExtension;
    if (numBars <= 2) {
        barExtension = 60;
    } else if (numBars === 3) {
        barExtension = 45;
    } else if (numBars === 4) {
        barExtension = 35;
    } else {
        barExtension = 20;
    }

    function getBarAngle(d) {
        const index = chartData.indexOf(d);
        if (numBars === 1) {
            return Math.PI / 2;
        } else if (numBars === 2) {
            return index === 0 ? Math.PI : 0;
        } else if (numBars === 3) {
            if (index === 0) return Math.PI / 2;
            if (index === 1) return Math.PI * 7 / 6;
            return Math.PI * 11 / 6;
        } else if (numBars === 4) {
            if (index === 0) return Math.PI / 4;
            if (index === 1) return Math.PI * 3 / 4;
            if (index === 2) return Math.PI * 5 / 4;
            return Math.PI * 7 / 4;
        } else {
            return xScale(d.label) + xScale.bandwidth() / 2;
        }
    }

    function labelY(d) {
        const extraOffset = (d.label === 'Divided (Median, no barrier)' || d.label === 'Divided (Type not specified)') ? 15 : 10;
        return -yScale(d.value) - 55 - extraOffset;
    }

    const barGroups = svg.selectAll('.bar-group')
        .data(chartData, d => d.label);

    const barGroupsExit = barGroups.exit();

    barGroupsExit.selectAll('.bar-image')
        .transition()
        .duration(400)
        .attr('y', -innerRadius)
        .attr('height', 0)
        .style('opacity', 0);

    barGroupsExit.selectAll('.bar')
        .transition()
        .duration(400)
        .attr('y', -innerRadius)
        .attr('height', 0)
        .style('opacity', 0);

    barGroupsExit.selectAll('.label-container')
        .transition()
        .duration(300)
        .style('opacity', 0);

    barGroupsExit
        .transition()
        .delay(420)
        .remove();

    const barGroupsEnter = barGroups.enter()
        .append('g')
        .attr('class', 'bar-group')
        .attr('transform', d => {
            const angle = getBarAngle(d);
            const angleDeg = angle * 180 / Math.PI;
            return `rotate(${angleDeg - 90})`;
        });

    barGroupsEnter.append('image')
        .attr('class', 'bar-image')
        .attr('href', d => imageUrls[d.label])
        .attr('x', -barWidth / 2)
        .attr('y', -innerRadius)
        .attr('width', barWidth)
        .attr('height', 0)
        .attr('preserveAspectRatio', 'none');

    barGroupsEnter.append('rect')
        .attr('class', 'bar')
        .attr('x', -barWidth / 2)
        .attr('y', -innerRadius)
        .attr('width', barWidth)
        .attr('height', 0)
        .attr('rx', 4)
        .attr('ry', 4)
        .style('fill', 'rgba(255,255,255,0.001)')
        .style('stroke-width', 2)
        .style('pointer-events', 'all');

    const labelWidth = barWidth * 3.5;
    barGroupsEnter.append('foreignObject')
        .attr('class', 'label-container')
        .attr('x', -labelWidth / 2)
        .attr('y', -innerRadius - 40)
        .attr('width', labelWidth)
        .attr('height', 70)
        .style('opacity', 0)
        .append('xhtml:div')
        .style('width', '100%')
        .style('height', '100%')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('justify-content', 'center')
        .style('text-align', 'center')
        .style('font-size', '11px')
        .style('font-weight', '600')
        .style('color', '#2c3e50')
        .style('line-height', '1.2')
        .style('padding', '2px')
        .html(d => d.label.replace(/\s+/g, '<br>'));

    const barGroupsMerged = barGroupsEnter.merge(barGroups);

    barGroupsMerged.transition()
        .duration(600)
        .attr('transform', d => {
            const angle = getBarAngle(d);
            const angleDeg = angle * 180 / Math.PI;
            return `rotate(${angleDeg - 90})`;
        });

    barGroupsMerged.select('.bar-image')
        .attr('href', d => imageUrls[d.label])
        .attr('x', -barWidth / 2)
        .attr('width', barWidth)
        .transition()
        .duration(600)
        .attr('y', d => -yScale(d.value))
        .attr('height', d => yScale(d.value) - innerRadius + barExtension);

    const bars = barGroupsMerged.select('.bar')
        .attr('x', -barWidth / 2)
        .attr('width', barWidth)
        .attr('rx', 4)
        .attr('ry', 4)
        .style('fill', 'rgba(255,255,255,0.001)')
        .style('stroke', d => {
            if (currentView === 'combined') {
                return combinedColorScale(d.label);
            } else {
                return detailedColorScale(d.label);
            }
        })
        .style('stroke-width', 2)
        .style('pointer-events', 'all')
        .on('mousemove', function (event, d) {
            tooltip
                .style('left', (event.clientX + 6) + 'px')
                .style('top', (event.clientY + 6) + 'px');
        })
        .on('mouseover', function (event, d) {
            d3.select(this).style('opacity', 0.7);
            tooltip
                .style('opacity', 1)
                .html(`<strong>${d.label}</strong><br/>
               Total Collisions: ${d.value.toLocaleString()}<br/>
               Avg per Year: ${Math.round(d.avgPerYear).toLocaleString()}<br/>
               Period: ${currentStartYear} - ${currentEndYear}`);
        })
        .on('mouseout', function () {
            d3.select(this).style('opacity', 1);
            tooltip.style('opacity', 0);
        });

    bars.transition()
        .duration(600)
        .attr('y', d => -yScale(d.value))
        .attr('height', d => yScale(d.value) - innerRadius + barExtension);

    barGroupsMerged.select('.label-container')
        .attr('x', -labelWidth / 2)
        .attr('width', labelWidth)
        .transition()
        .duration(600)
        .attr('y', d => labelY(d))
        .style('opacity', 1);

    svg.selectAll('.center-circle').remove();
    svg.selectAll('.center-text').remove();

    svg.append('circle')
        .attr('class', 'center-circle')
        .attr('r', innerRadius)
        .style('fill', '#ecf0f1')
        .style('stroke', '#bdc3c7')
        .style('stroke-width', 2);

    const totalCollisions = d3.sum(chartData, d => d.value);
    const meanCollisions = totalCollisions / chartData.length;

    svg.append('text')
        .attr('class', 'center-text')
        .attr('dy', '-1.5em')
        .style('font-size', '14px')
        .text('Mean Collisions');

    svg.append('text')
        .attr('class', 'center-text')
        .attr('dy', '0em')
        .style('font-size', '24px')
        .style('font-weight', 'bold')
        .style('fill', '#2c3e50')
        .text(Math.round(meanCollisions).toLocaleString());

    svg.append('text')
        .attr('class', 'center-text')
        .attr('dy', '1.5em')
        .style('font-size', '12px')
        .text(`${startYear} - ${endYear}`);

    scheduleContainerScale();
}

setTimeout(() => {
    createBrush(
        'year-range',
        1999,
        2021,
        currentStartYear,
        currentEndYear,
        (minYear, maxYear) => {
            updateChart(minYear, maxYear);
        }
    );

    updateLegend();
    updateChart(currentStartYear, currentEndYear);
    scheduleContainerScale();
}, 100);
}
