// Layout constants for side-by-side display
const clockWidth = 500;  // Reduced from 800 to make room for line chart
const clockHeight = 500; // Reduced from 800
const lineChartWidth = 400;
const lineChartHeight = 300;
const clockRadius = Math.min(clockWidth, clockHeight) / 2 - 40;
const hourLabelRadius = clockRadius + 20;
const TICK = 1000;

let isDayMode = true;
let pinnedSegment = null;
let lineChartSvg = null;
let yearlyData = null;
function fmtHour24(h) { return (`0${h}`).slice(-2) + ":00"; }
function fmtHour12(h) { return h === 0 ? 12 : (h > 12 ? h - 12 : h); }
function isDayTime(hour) { return hour >= 0 && hour < 12; }
function riskLabel(v, max) {
    const r = v / (max || 1);
    if (r >= 0.75) return "Very High";
    if (r >= 0.5)  return "High";
    if (r >= 0.25) return "Moderate";
    return "Low";
}

function getRotation(hour, minutes, seconds) {
    const hAngle = (hour % 12) * 30 + minutes * 0.5 + seconds * (0.5 / 60);
    return { hAngle };
}

function addLegend(clockContainer, colorScale, maxValue) {
    const legendW = 280, legendH = 12;

    // Use existing legend container
    const legendContainer = clockContainer.select(".clock-legend");

    // Create SVG for the legend
    const legendSvg = legendContainer.append("svg")
        .attr("width", legendW)
        .attr("height", legendH + 40); // Extra height for axis and text

    const legend = legendSvg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(0, 20)`); // Small top margin

    const defs = legend.append("defs");
    const gradId = "legend-grad";
    const lg = defs.append("linearGradient").attr("id", gradId);
    lg.attr("x1", "0%").attr("x2", "100%").attr("y1", "0%").attr("y2", "0%");
    d3.range(0, 1.01, 0.1).forEach(t => {
        lg.append("stop")
            .attr("offset", `${t*100}%`)
            .attr("stop-color", colorScale(t * maxValue));
    });

    legend.append("rect")
        .attr("width", legendW)
        .attr("height", legendH)
        .attr("fill", `url(#${gradId})`)
        .attr("rx", 3);

    const x = d3.scaleLinear().domain([0, maxValue]).range([0, legendW]);
    const axis = d3.axisBottom(x).ticks(5).tickSize(4);
    legend.append("g")
        .attr("transform", `translate(0, ${legendH})`)
        .call(axis);

    legend.append("text")
        .attr("x", 0)
        .attr("y", -6)
        .attr("font-weight", "600")
        .text("Collisions per hour");
}

function updateClockHands(colorScale, allTimeSegments, svg) {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    const { hAngle } = getRotation(hours, minutes, seconds);
    const hourLen = clockRadius * 0.75;

    d3.select(".hour-hand")
        .transition().duration(250).ease(d3.easeCubicOut)
        .attr("transform", `rotate(${hAngle})`)
        .attr("y2", -hourLen);

    const currentSegment = allTimeSegments.find(seg => hours >= seg.start && hours < seg.end);

    if (currentSegment) {
        const isVisible = isDayMode 
            ? (currentSegment.start >= 0 && currentSegment.start < 12)
            : (currentSegment.start >= 12 && currentSegment.start < 24);

        if (isVisible) {
            d3.selectAll(".time-segment")
                .classed("highlight", (d) => d.start === currentSegment.start && d.end === currentSegment.end);

            const maxV = d3.max(allTimeSegments, d => d.value);
            const v = currentSegment.value;
            const endHour = currentSegment.end % 24;
            d3.select("#risk-banner")
                .text(`${isDayMode ? 'Day' : 'Night'} risk: ${riskLabel(v, maxV)}  (${fmtHour24(currentSegment.start)}–${fmtHour24(endHour)})`)
                .style("background", colorScale(v))
                .style("padding", "6px 10px")
                .style("border-radius", "8px")
                .style("color", "#111")
                .style("font-weight", "600")
                .style("display", "inline-block");
        }
    }

    const currentHour12 = fmtHour12(hours);
    d3.selectAll(".hour-label")
        .classed("current", function () {
            const labelVal = +d3.select(this).text();
            return labelVal === currentHour12;
        });

    setTimeout(() => updateClockHands(colorScale, allTimeSegments, svg), TICK);
}

function hourToClockPosition(hour) {
    return hour % 12;
}

function renderClockSegments(svg, timeSegments, colorScale, isDay, bindInteractions) {
    svg.selectAll(".time-segment").remove();
    svg.selectAll(".hour-label").remove();
    svg.selectAll(".hour-tick").remove();
    svg.selectAll(".hour-hand").remove();

    const angle = d3.scaleLinear().domain([0, 12]).range([0, 2 * Math.PI]);
    const innerRadius = clockRadius * 0.6;

    const currentSegments = isDay 
        ? timeSegments.filter(d => d.start >= 0 && d.start < 12)
        : timeSegments.filter(d => d.start >= 12 && d.start < 24);

    const arc = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(clockRadius)
        .startAngle(d => {
            const startPos = hourToClockPosition(d.start);
            return (startPos / 12) * 2 * Math.PI;
        })
        .endAngle(d => {
            let endPos = hourToClockPosition(d.end);
            const startPos = hourToClockPosition(d.start);
            if (endPos < startPos) {
                endPos += 12;
            }
            return (endPos / 12) * 2 * Math.PI;
        });

    svg.selectAll(".time-segment")
        .data(currentSegments)
        .enter()
        .append("path")
        .attr("class", "time-segment")
        .attr("d", arc)
        .attr("fill", d => colorScale(d.value))
        .attr("stroke", "#fff")
        .attr("stroke-width", 1);

    const hourLabels = d3.range(12).map(d => (d === 0 ? 12 : d));
    svg.selectAll(".hour-label")
        .data(hourLabels)
        .enter()
        .append("text")
        .attr("class", "hour-label")
        .attr("x", d => hourLabelRadius * Math.sin(angle(d % 12)))
        .attr("y", d => -hourLabelRadius * Math.cos(angle(d % 12)))
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .text(d => d);

    const allHours = d3.range(12);
    svg.selectAll(".hour-tick")
        .data(allHours)
        .enter()
        .append("line")
        .attr("class", "hour-tick")
        .attr("x1", d => clockRadius * Math.sin(angle(d)))
        .attr("y1", d => -clockRadius * Math.cos(angle(d)))
        .attr("x2", d => (clockRadius - 10) * Math.sin(angle(d)))
        .attr("y2", d => -(clockRadius - 10) * Math.cos(angle(d)))
        .attr("stroke", "#333")
        .attr("stroke-width", 2);
    
    svg.append("line")
        .attr("class", "hour-hand")
        .attr("x1", 0).attr("y1", 0)
        .attr("x2", 0).attr("y2", -clockRadius * 0.75)
        .attr("stroke", "#2c3e50")
        .attr("stroke-width", 4)
        .attr("stroke-linecap", "butt");

    if (bindInteractions) {
        bindInteractions();
    }
}

function setClockMode(dayMode, colorScale, timeSegments, svg, bindInteractions) {
    // Only update if mode is actually changing
    if (isDayMode === dayMode) return;
    
    isDayMode = dayMode;
    renderClockSegments(svg, timeSegments, colorScale, isDayMode, bindInteractions);
    
    // Update button styles
    const dayButton = d3.select("#day-mode-btn");
    const nightButton = d3.select("#night-mode-btn");
    
    if (isDayMode) {
        // Day mode active
        dayButton
            .style("background", "#0d6efd")
            .style("color", "white")
            .style("border", "2px solid #0d6efd");
        nightButton
            .style("background", "transparent")
            .style("color", "#0d6efd")
            .style("border", "2px solid #0d6efd");
    } else {
        // Night mode active
        dayButton
            .style("background", "transparent")
            .style("color", "#0d6efd")
            .style("border", "2px solid #0d6efd");
        nightButton
            .style("background", "#0d6efd")
            .style("color", "white")
            .style("border", "2px solid #0d6efd");
    }
}

/**
 * Create the line chart container and initial setup
 */
function createLineChart(container) {
    const margin = { top: 30, right: 30, bottom: 50, left: 60 };
    const width = lineChartWidth - margin.left - margin.right;
    const height = lineChartHeight - margin.top - margin.bottom;
    
    lineChartSvg = container.append("svg")
        .attr("width", lineChartWidth)
        .attr("height", lineChartHeight)
        .style("background", "#fff")
        .style("border-radius", "8px")
        .style("box-shadow", "0 2px 8px rgba(0,0,0,0.1)");
    
    const g = lineChartSvg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // Add title
    lineChartSvg.append("text")
        .attr("class", "line-chart-title")
        .attr("x", lineChartWidth / 2)
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("fill", "#333")
        .text("Collision Trends Over Years");
    
    // Add placeholder text
    g.append("text")
        .attr("class", "placeholder-text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .style("fill", "#666")
        .style("font-style", "italic")
        .style("font-size", "12px")
        .text("Click on a time segment to pin and view trends");
    
    return g;
}

/**
 * Calculate global Y-scale domain for consistent scaling across all line charts
 */
function getGlobalYDomain() {
    if (!yearlyData || yearlyData.length === 0) return [0, 1000];
    
    let globalMax = 0;
    
    // Find the maximum value across all hours and all years
    yearlyData.forEach(yearData => {
        yearData.hourlyValues.forEach(value => {
            if (value > globalMax) {
                globalMax = value;
            }
        });
    });
    
    // Add some padding to the max value (10% padding)
    const paddedMax = globalMax * 1.1;
    
    console.log(`Global Y domain: [0, ${paddedMax}] (max value: ${globalMax})`);
    return [0, paddedMax];
}

/**
 * Update the line chart with data for the selected time segment
 */
function updateLineChart(timeSegment) {
    if (!lineChartSvg || !yearlyData || !timeSegment) return;
    
    const margin = { top: 30, right: 30, bottom: 50, left: 60 };
    const width = lineChartWidth - margin.left - margin.right;
    const height = lineChartHeight - margin.top - margin.bottom;
    
    const g = lineChartSvg.select("g");
    
    // Clear previous content
    g.selectAll(".line-chart-content").remove();
    g.select(".placeholder-text").remove();
    
    // Prepare data for the selected hour
    const hour = timeSegment.start;
    const lineData = yearlyData.map(d => ({
        year: d.year,
        value: d.hourlyValues[hour] || 0
    }));
    
    console.log(`Line chart data for hour ${hour}:`, lineData);
    
    // Create scales with consistent Y domain
    const xScale = d3.scaleLinear()
        .domain(d3.extent(lineData, d => d.year))
        .range([0, width]);
    
    const globalYDomain = getGlobalYDomain();
    const yScale = d3.scaleLinear()
        .domain(globalYDomain)
        .nice()
        .range([height, 0]);
    
    // Create line generator
    const line = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d.value))
        .curve(d3.curveMonotoneX);
    
    const chartGroup = g.append("g").attr("class", "line-chart-content");
    
    // Add axes
    chartGroup.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale).tickFormat(d3.format("d")))
        .selectAll("text")
        .style("font-size", "11px");
    
    chartGroup.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(yScale))
        .selectAll("text")
        .style("font-size", "11px");
    
    // Add axis labels
    chartGroup.append("text")
        .attr("class", "y-label")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("font-size", "11px")
        .style("fill", "#666")
        .text("Number of Collisions");
    
    chartGroup.append("text")
        .attr("class", "x-label")
        .attr("transform", `translate(${width / 2}, ${height + margin.bottom - 10})`)
        .style("text-anchor", "middle")
        .style("font-size", "11px")
        .style("fill", "#666")
        .text("Year");
    
    // Add the line
    chartGroup.append("path")
        .datum(lineData)
        .attr("class", "trend-line")
        .attr("fill", "none")
        .attr("stroke", "#e63946")
        .attr("stroke-width", 2.5)
        .attr("d", line);
    
    // Add dots
    chartGroup.selectAll(".dot")
        .data(lineData)
        .enter().append("circle")
        .attr("class", "dot")
        .attr("cx", d => xScale(d.year))
        .attr("cy", d => yScale(d.value))
        .attr("r", 4)
        .attr("fill", "#e63946")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5);
    
    // Add hover effects for dots
    chartGroup.selectAll(".dot")
        .on("mouseover", function(event, d) {
            d3.select(this).attr("r", 6);
            
            // Show tooltip
            const tooltip = d3.select("body").append("div")
                .attr("class", "line-chart-tooltip")
                .style("position", "absolute")
                .style("background", "rgba(0,0,0,0.8)")
                .style("color", "white")
                .style("padding", "8px")
                .style("border-radius", "4px")
                .style("font-size", "12px")
                .style("pointer-events", "none")
                .style("opacity", 0);
            
            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(`Year: ${d.year}<br/>Collisions: ${d.value.toLocaleString()}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("r", 4);
            d3.selectAll(".line-chart-tooltip").remove();
        });
    
    // Update title with time range
    const endHour = timeSegment.end % 24;
    lineChartSvg.select(".line-chart-title")
        .text(`Collision Trends: ${fmtHour24(timeSegment.start)}–${fmtHour24(endHour)}`);
    
    // Calculate and display average collision value for this time segment
    const averageCollisions = d3.mean(lineData, d => d.value);
    
    // Get the line chart container
    const lineChartContainer = d3.select(".line-chart-container");
    
    // Remove existing average text
    lineChartContainer.selectAll(".average-text").remove();
    
    // Add average collision text below the chart as a div element
    lineChartContainer.append("div")
        .attr("class", "average-text")
        .style("text-align", "center")
        .style("margin-top", "10px")
        .style("font-size", "24px")
        .style("font-weight", "bold")
        .style("color", "#666")
        .text(`Average collisions over years: ${averageCollisions.toFixed(1)}`);
}

/**
 * Data wrangling function to parse hourly collision data from CSV
 * @param {Array} rawData - Array of objects from D3.csv parsing
 * @returns {Object} - Processed data with yearly and aggregated hourly data
 */
function wrangleClockData(rawData) {
    const yearlyData = [];
    
    // Skip if no data
    if (!rawData || rawData.length === 0) {
        console.warn('No raw data provided for clock visualization');
        return { yearlyData: [], aggregatedHourlyData: [] };
    }
    
    // Get column names - the first column might be "" or "Collision Hour"
    const columns = Object.keys(rawData[0]);
    console.log('Raw data length:', rawData.length);
    console.log('Raw data first few rows:', rawData.slice(0, 5));
    console.log('All columns:', columns);
    
    // Find the year column (first column, might be "" or "Collision Hour")
    const yearColumnKey = columns[0]; // This could be "" or "Collision Hour"
    
    // Hour columns are everything except the first two (year and total)
    const hourColumns = columns.slice(2); // Skip year column and "Total" column
    console.log('Year column key:', yearColumnKey);
    console.log('Hour columns:', hourColumns);
    console.log('Processing clock data with', hourColumns.length, 'hour columns');
    
    rawData.forEach((row, index) => {
        const yearValue = row[yearColumnKey]; // Use the actual key name
        
        // Skip header rows and total row
        if (index < 2 || yearValue === "Total" || yearValue === "Measures" || yearValue === "Year") return;
        
        // Process year rows (2012, 2013, etc.)
        if (yearValue && /^\d{4}$/.test(yearValue)) {
            const hourlyValues = [];
            
            // Extract values for each hour (24 columns)
            hourColumns.forEach(hourColumn => {
                const value = parseInt(row[hourColumn]) || 0;
                hourlyValues.push(value);
            });
            
            console.log(`Processing year ${yearValue} with ${hourlyValues.length} hourly values:`, hourlyValues.slice(0, 5), '...');
            
            yearlyData.push({
                year: parseInt(yearValue),
                hourlyValues: hourlyValues
            });
        }
    });
    
    // Sort by year
    yearlyData.sort((a, b) => a.year - b.year);
    
    // Calculate aggregated hourly data (average across all years)
    const aggregatedHourlyData = [];
    if (yearlyData.length > 0) {
        for (let hour = 0; hour < 24; hour++) {
            const totalForHour = yearlyData.reduce((sum, yearData) => {
                return sum + (yearData.hourlyValues[hour] || 0);
            }, 0);
            
            const averageForHour = totalForHour / yearlyData.length;
            
            aggregatedHourlyData.push({
                start: hour,
                end: hour + 1,
                value: averageForHour,
                total: totalForHour
            });
        }
    }
    
    console.log('Processed yearly data:', yearlyData.length, 'years');
    console.log('Aggregated hourly data:', aggregatedHourlyData.length, 'hours');
    
    return {
        yearlyData: yearlyData,
        aggregatedHourlyData: aggregatedHourlyData
    };
}

function initializeClockVisualization(rawData) {
    // Process the raw data using the wrangling function
    const processedData = wrangleClockData(rawData);
    const { yearlyData: processedYearlyData, aggregatedHourlyData } = processedData;
    
    // Store yearly data globally for line chart use
    yearlyData = processedYearlyData;
    window.clockYearlyData = yearlyData;
    
    // Use processed data instead of hardcoded values
    const allTimeSegments = aggregatedHourlyData.length > 0 
        ? aggregatedHourlyData 
        : []; // Fallback to empty array if no data

    const now = new Date();
    isDayMode = isDayTime(now.getHours());

    const allValues = allTimeSegments.map(d => d.value).filter(v => v > 0);
    const maxVal = allValues.length > 0 ? d3.max(allValues) : 1;
    const minVal = allValues.length > 0 ? d3.min(allValues) : 0;
    
    const colorScale = d3.scaleSequential()
        .domain([minVal, maxVal])
        .interpolator(d3.interpolateYlOrRd);

    // Use existing HTML structure
    const container = d3.select("#clock-visualization");
    const clockContainer = container.select(".clock-container");
    const lineChartContainer = container.select(".line-chart-container");
    
    // Use existing buttons and set up their styling and event handlers
    const dayButton = d3.select("#day-mode-btn")
        .attr("class", isDayMode ? "btn btn-primary" : "btn btn-outline-primary")
        .style("padding", "8px 16px")
        .style("font-size", "14px")
        .style("border-radius", "6px")
        .style("cursor", "pointer")
        .style("border", isDayMode ? "2px solid #0d6efd" : "2px solid #0d6efd")
        .style("background", isDayMode ? "#0d6efd" : "transparent")
        .style("color", isDayMode ? "white" : "#0d6efd")
        .on("click", () => setClockMode(true, colorScale, allTimeSegments, svg, bindInteractions));
    
    const nightButton = d3.select("#night-mode-btn")
        .attr("class", !isDayMode ? "btn btn-primary" : "btn btn-outline-primary")
        .style("padding", "8px 16px")
        .style("font-size", "14px")
        .style("border-radius", "6px")
        .style("cursor", "pointer")
        .style("border", !isDayMode ? "2px solid #0d6efd" : "2px solid #0d6efd")
        .style("background", !isDayMode ? "#0d6efd" : "transparent")
        .style("color", !isDayMode ? "white" : "#0d6efd")
        .on("click", () => setClockMode(false, colorScale, allTimeSegments, svg, bindInteractions));

    // Create clock SVG in clock container
    const svg = clockContainer
        .append("svg")
        .attr("width", clockWidth)
        .attr("height", clockHeight)
        .append("g")
        .attr("transform", `translate(${clockWidth / 2},${clockHeight / 2})`);
    
    // Create line chart
    const lineChartG = createLineChart(lineChartContainer);

    svg.append("circle")
        .attr("class", "clock-circle")
        .attr("r", clockRadius)
        .attr("fill", "#f8f9fa")
        .attr("stroke", "#333")
        .attr("stroke-width", 2);

    const defs = svg.append("defs");
    const glow = defs.append("filter").attr("id", "glow");
    glow.append("feGaussianBlur").attr("stdDeviation", 4).attr("result", "coloredBlur");
    const feMerge = glow.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    svg.append("circle")
        .attr("cx", 0).attr("cy", 0).attr("r", 5)
        .attr("fill", "#2c3e50");

    addLegend(clockContainer, colorScale, maxVal);

    const tip = d3.select("#tooltip");
    function segmentLabel(d) { 
        const endHour = d.end % 24;
        return `${fmtHour24(d.start)}–${fmtHour24(endHour)}`; 
    }

    function bindInteractions() {
        svg.selectAll(".time-segment")
            .on("mousemove", function (event, d) {
                // Only show tooltip if not pinned
                if (pinnedSegment !== d) {
                    const [mx, my] = d3.pointer(event, document.body);
                    tip
                        .style("left", (mx + 14) + "px")
                        .style("top", (my + 14) + "px")
                        .style("display", "block")
                        .style("background", "#fff")
                        .style("border", "1px solid #ccc")
                        .style("padding", "6px 8px")
                        .style("border-radius", "6px")
                        .style("box-shadow", "0 2px 6px rgba(0,0,0,.15)")
                        .style("font", "12px system-ui")
                        .html(`<b>${segmentLabel(d)}</b><br/>Collisions: ${Math.round(d.value).toLocaleString()}<br/><em>Click to pin and view trends</em>`);
                    d3.select(this).classed("highlight", true);
                }
            })
            .on("mouseleave", function (_event, d) {
                // Only hide tooltip and highlight if not pinned
                if (pinnedSegment !== d) {
                    tip.style("display", "none");
                    d3.select(this).classed("highlight", false);
                }
            })
            .on("click", function(event, d) {
                event.stopPropagation();
                
                // Remove previous pin styling
                svg.selectAll(".time-segment").classed("pinned", false);
                
                // Hide tooltip
                tip.style("display", "none");
                
                // Add pin styling to clicked segment
                d3.select(this).classed("pinned", true).classed("highlight", false);
                
                // Update pinned segment and line chart
                pinnedSegment = d;
                updateLineChart(d);
                
                console.log('Pinned segment:', d);
            });
    }
    
    renderClockSegments(svg, allTimeSegments, colorScale, isDayMode, bindInteractions);
    
    d3.select("#clock-mode-toggle")
        .on("click", () => toggleClockMode(colorScale, allTimeSegments, svg, bindInteractions));

    updateClockHands(colorScale, allTimeSegments, svg);
}
