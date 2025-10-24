const clockMargin = { top: 50, right: 40, bottom: 40, left: 80 };
const clockWidth = 800;
const clockHeight = 800;
const outerRadius = Math.min(clockWidth, clockHeight) / 2 - 40;
const innerRadius = outerRadius - 100;
const hourLabelRadius = outerRadius + 20;
const innerHourLabelRadius = innerRadius - 30;

function getRotation(hour, minutes) {
    return ((hour % 12) * 30) + minutes / 2;
}

function updateClockHands() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    console.log("Current hour:", hours);
    // Update hour hand
    d3.select(".hour-hand")
        .attr("transform", `rotate(${getRotation(hours, minutes)})`)
        .attr("y2", - (hours < 12 ? outerRadius * 0.9 : innerRadius * 0.8));

    // Call again in 1 minute 
    setTimeout(updateClockHands, 60000);
}

function initializeClockVisualization(rawData) {
    const cols = Object.keys(rawData[0]);
    const data = Object.fromEntries(cols.map(k => [k, d3.mean(rawData.slice(1,), d => +d[k])]));


    // Process data into 8 time segments (3 hours each)
    const timeSegments = [
        { start: 0, end: 3, value: 0, isOuter: true },
        { start: 3, end: 6, value: 0, isOuter: true },
        { start: 6, end: 9, value: 0, isOuter: true },
        { start: 9, end: 12, value: 0, isOuter: true },
        { start: 12, end: 15, value: 0, isOuter: false },
        { start: 15, end: 18, value: 0, isOuter: false },
        { start: 18, end: 21, value: 0, isOuter: false },
        { start: 21, end: 24, value: 0, isOuter: false }
    ];
    timeSegments.forEach((segment, i) => {
        segment.value = Object.values(data)[i];
    });
    console.log("Time Segments:", timeSegments);

    // Create color scale from yellow to red based on data values
    const colorScale = d3.scaleSequential()
        .domain([0, d3.max(timeSegments, d => d.value)])
        .interpolator(d3.interpolateYlOrRd);

    const svg = d3.select("#clock-visualization")
        .append("svg")
        .attr("width", clockWidth)
        .attr("height", clockHeight)
        .append("g")
        .attr("transform", `translate(${clockWidth / 2},${clockHeight / 2})`);

    const angle = d3.scaleLinear()
        .domain([0, 12])
        .range([0, 2 * Math.PI]);

    // Create outer circle (daytime: 0-12)
    svg.append("circle")
        .attr("class", "outer-circle")
        .attr("r", outerRadius)
        .attr("fill", "#f8f9fa")
        .attr("stroke", "#333")
        .attr("stroke-width", 2);

    // Create inner circle (nighttime: 12-24)
    svg.append("circle")
        .attr("class", "inner-circle")
        .attr("r", innerRadius)
        .attr("fill", "#e9ecef")
        .attr("stroke", "#333")
        .attr("stroke-width", 2);


    // Create arc generators for inner and outer segments
    const outerArc = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius)
        .startAngle(d => (d.start / 12) * 2 * Math.PI)
        .endAngle(d => (d.end / 12) * 2 * Math.PI);

    const innerArc = d3.arc()
        .innerRadius(innerRadius * 0.6)
        .outerRadius(innerRadius)
        .startAngle(d => ((d.start - 12) / 12) * 2 * Math.PI)
        .endAngle(d => ((d.end - 12) / 12) * 2 * Math.PI);

    // Add outer segments
    svg.selectAll(".outer-segment")
        .data(timeSegments.filter(d => d.isOuter))
        .enter()
        .append("path")
        .attr("class", "time-segment")
        .attr("d", outerArc)
        .attr("fill", d => colorScale(d.value))
        .attr("stroke", "#fff")
        .attr("stroke-width", 1);

    // Add inner segments
    svg.selectAll(".inner-segment")
        .data(timeSegments.filter(d => !d.isOuter))
        .enter()
        .append("path")
        .attr("class", "time-segment")
        .attr("d", innerArc)
        .attr("fill", d => colorScale(d.value))
        .attr("stroke", "#fff")
        .attr("stroke-width", 1);

    // Add daytime hour labels (0-12)
    const dayHours = d3.range(13);
    svg.selectAll(".day-hour-label")
        .data(dayHours)
        .enter()
        .append("text")
        .attr("class", "hour-label")
        .attr("x", d => hourLabelRadius * Math.sin(angle(d)))
        .attr("y", d => -hourLabelRadius * Math.cos(angle(d)))
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .text(d => d);

    // Add nighttime hour labels (12-24)
    const nightHours = d3.range(13, 25);
    svg.selectAll(".night-hour-label")
        .data(nightHours)
        .enter()
        .append("text")
        .attr("class", "hour-label night")
        .attr("x", d => innerHourLabelRadius * Math.sin(angle(d - 12)))
        .attr("y", d => -innerHourLabelRadius * Math.cos(angle(d - 12)))
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .text(d => d);

    // Add hour ticks for both circles
    const allHours = d3.range(12);

    // Outer ticks (daytime)
    svg.selectAll(".outer-hour-tick")
        .data(allHours)
        .enter()
        .append("line")
        .attr("class", "hour-tick")
        .attr("x1", d => outerRadius * Math.sin(angle(d)))
        .attr("y1", d => -outerRadius * Math.cos(angle(d)))
        .attr("x2", d => (outerRadius - 10) * Math.sin(angle(d)))
        .attr("y2", d => -(outerRadius - 10) * Math.cos(angle(d)))
        .attr("stroke", "#333")
        .attr("stroke-width", 2);

    // Inner ticks (nighttime)
    svg.selectAll(".inner-hour-tick")
        .data(allHours)
        .enter()
        .append("line")
        .attr("class", "inner-hour-tick")
        .attr("x1", d => innerRadius * Math.sin(angle(d)))
        .attr("y1", d => -innerRadius * Math.cos(angle(d)))
        .attr("x2", d => (innerRadius - 10) * Math.sin(angle(d)))
        .attr("y2", d => -(innerRadius - 10) * Math.cos(angle(d)))
        .attr("stroke", "#333")
        .attr("stroke-width", 2);

    // Add clock hands
    // Hour hand
    svg.append("line")
        .attr("class", "hour-hand")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 0)
        .attr("y2", -outerRadius * 0.5)
        .attr("stroke", "#2c3e50")
        .attr("stroke-width", 4)
        .attr("stroke-linecap", "butt");

    // Center dot
    svg.append("circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", 5)
        .attr("fill", "#2c3e50");

    // Start the clock
    updateClockHands();
}
