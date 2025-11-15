const clockWidth = 800;
const clockHeight = 800;
const clockRadius = Math.min(clockWidth, clockHeight) / 2 - 40;
const hourLabelRadius = clockRadius + 20;
const TICK = 1000;

let isDayMode = true;
function fmtHour24(h) { return (`0${h}`).slice(-2) + ":00"; }
function fmtHour12(h) { return h === 0 ? 12 : (h > 12 ? h - 12 : h); }
function isDayTime(hour) { return hour >= 6 && hour < 18; }
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

function addLegend(rootSvg, colorScale, maxValue) {
    const legendW = 280, legendH = 12;
    const legendX = -clockWidth/2 - 20;
    const legendY = clockHeight/2 - 60;

    const legend = rootSvg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${legendX},${legendY})`);

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
            ? (currentSegment.start >= 6 && currentSegment.start < 18)
            : (currentSegment.start >= 18 || currentSegment.start < 6);

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
        ? timeSegments.filter(d => d.start >= 6 && d.start < 18)
        : timeSegments.filter(d => d.start >= 18 || d.start < 6);

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

function toggleClockMode(colorScale, timeSegments, svg, bindInteractions) {
    isDayMode = !isDayMode;
    renderClockSegments(svg, timeSegments, colorScale, isDayMode, bindInteractions);
    d3.select("#clock-mode-toggle")
        .text(isDayMode ? "Switch to Night (6pm-6am)" : "Switch to Day (6am-6pm)");
}

function initializeClockVisualization(rawData) {
    const totalValues = [15505, 12479, 11333, 10019, 8439, 12919, 28229, 47456, 60358, 47807, 49236, 56926, 67012, 66673, 72978, 88502, 94657, 91108, 67482, 50310, 39700, 35784, 28615, 22264];
    
    const hourData = totalValues.map((total, hour) => ({
        hour: hour,
        value: total / 10
    }));

    const allTimeSegments = [];
    for (let hour = 0; hour < 24; hour++) {
        const hourDataPoint = hourData.find(h => h.hour === hour);
        allTimeSegments.push({
            start: hour,
            end: hour + 1,
            value: hourDataPoint ? hourDataPoint.value : 0
        });
    }

    const now = new Date();
    isDayMode = isDayTime(now.getHours());

    const allValues = allTimeSegments.map(d => d.value).filter(v => v > 0);
    const maxVal = allValues.length > 0 ? d3.max(allValues) : 1;
    const minVal = allValues.length > 0 ? d3.min(allValues) : 0;
    
    const colorScale = d3.scaleSequential()
        .domain([minVal, maxVal])
        .interpolator(d3.interpolateYlOrRd);

    const container = d3.select("#clock-visualization");
    container.selectAll("button").remove();
    
    const buttonContainer = container.append("div")
        .style("text-align", "center")
        .style("margin-bottom", "10px");
    
    buttonContainer.append("button")
        .attr("id", "clock-mode-toggle")
        .attr("class", "btn btn-primary")
        .style("padding", "8px 16px")
        .style("font-size", "14px")
        .style("border-radius", "6px")
        .style("cursor", "pointer")
        .text(isDayMode ? "Switch to Night (6pm-6am)" : "Switch to Day (6am-6pm)")
        .on("click", () => toggleClockMode(colorScale, allTimeSegments, svg));

    const svg = container
        .append("svg")
        .attr("width", clockWidth)
        .attr("height", clockHeight)
        .append("g")
        .attr("transform", `translate(${clockWidth / 2},${clockHeight / 2})`);

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

    addLegend(svg, colorScale, maxVal);

    const tip = d3.select("#tooltip");
    function segmentLabel(d) { 
        const endHour = d.end % 24;
        return `${fmtHour24(d.start)}–${fmtHour24(endHour)}`; 
    }

    function bindInteractions() {
        svg.selectAll(".time-segment")
            .each(function(d, i) { d._index = i; })
            .on("mousemove", function (event, d) {
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
                    .html(`<b>${segmentLabel(d)}</b><br/>Collisions: ${d.value}`);
                d3.select(this).classed("highlight", true);
            })
            .on("mouseleave", function (_event, d) {
                tip.style("display", "none");
                d3.select(this).classed("highlight", false);
            });
    }
    
    renderClockSegments(svg, allTimeSegments, colorScale, isDayMode, bindInteractions);
    
    d3.select("#clock-mode-toggle")
        .on("click", () => toggleClockMode(colorScale, allTimeSegments, svg, bindInteractions));

    updateClockHands(colorScale, allTimeSegments, svg);
}
