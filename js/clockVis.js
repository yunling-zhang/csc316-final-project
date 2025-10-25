const clockMargin = { top: 50, right: 40, bottom: 40, left: 80 };
const clockWidth = 800;
const clockHeight = 800;
const outerRadius = Math.min(clockWidth, clockHeight) / 2 - 40;
const innerRadius = outerRadius - 100;
const hourLabelRadius = outerRadius + 20;
const innerHourLabelRadius = innerRadius - 30;
const TICK = 1000;                   // update every second
const segmentDurationHours = 3;      // 8 segments * 3h = 24h

// ---------- Helpers ----------
function fmtHour24(h) { return (`0${h}`).slice(-2) + ":00"; }
function segmentForHour(h) { return Math.floor((h % 24) / segmentDurationHours); } // 0..7
function riskLabel(v, max) {
    const r = v / (max || 1);
    if (r >= 0.75) return "Very High";
    if (r >= 0.5)  return "High";
    if (r >= 0.25) return "Moderate";
    return "Low";
}

// Rotation calculators (deg)
function getRotation(hour, minutes, seconds) {
    // hour hand: 30°/h + 0.5°/min + (0.5/60)°/sec
    const hAngle = (hour % 12) * 30 + minutes * 0.5 + seconds * (0.5 / 60);
    // minute hand: 6°/min + 0.1°/sec
    const mAngle = minutes * 6 + seconds * 0.1;
    return { hAngle, mAngle };
}

// Legend
function addLegend(rootSvg, colorScale, maxValue) {
    const legendW = 280, legendH = 12;
    const legendX = -clockWidth/2 + 40;  // left bottom corner inside SVG coord
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
        .text("Collisions per 3-hour segment");
}

// Main updater
function updateClockHands(colorScale, timeSegments) {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    const { hAngle, mAngle } = getRotation(hours, minutes, seconds);

    // hour hand length: outer on day, inner on night
    const hourLen = hours < 12 ? outerRadius * 0.6 : innerRadius * 0.55;

    d3.select(".hour-hand")
        .transition().duration(250).ease(d3.easeCubicOut)
        .attr("transform", `rotate(${hAngle})`)
        .attr("y2", -hourLen);

    d3.select(".minute-hand")
        .transition().duration(250).ease(d3.easeCubicOut)
        .attr("transform", `rotate(${mAngle})`)
        .attr("y2", -(outerRadius * 0.9));

    // highlight current segment
    const segIdx = segmentForHour(hours);
    d3.selectAll(".time-segment")
        .classed("highlight", (d, i) => i === segIdx || d._pinned === true);

    // bold the current outer label (12..11)
    const currentHour12 = hours % 12 === 0 ? 12 : hours % 12;
    d3.selectAll(".hour-label")
        .classed("current", function () {
            const isNight = d3.select(this).classed("night");
            const labelVal = +d3.select(this).text();
            return !isNight && labelVal === currentHour12;
        });

    // update risk banner
    const maxV = d3.max(timeSegments, d => d.value);
    const v = timeSegments[segIdx].value;
    d3.select("#risk-banner")
        .text(`Current risk: ${riskLabel(v, maxV)}  (${fmtHour24(timeSegments[segIdx].start)}–${fmtHour24(timeSegments[segIdx].end)})`)
        .style("background", colorScale(v))
        .style("padding", "6px 10px")
        .style("border-radius", "8px")
        .style("color", "#111")
        .style("font-weight", "600")
        .style("display", "inline-block");

    setTimeout(() => updateClockHands(colorScale, timeSegments), TICK);
}

// ---------- Entry point ----------
function initializeClockVisualization(rawData) {
    // Aggregate your CSV into 8 values (same logic you had)
    const cols = Object.keys(rawData[0]);
    const dataMeans = Object.fromEntries(cols.map(k => [k, d3.mean(rawData.slice(1), d => +d[k])]));

    // Build 8 segments (3h each)
    const timeSegments = [
        { start: 0,  end: 3,  value: 0, isOuter: true  },
        { start: 3,  end: 6,  value: 0, isOuter: true  },
        { start: 6,  end: 9,  value: 0, isOuter: true  },
        { start: 9,  end: 12, value: 0, isOuter: true  },
        { start: 12, end: 15, value: 0, isOuter: false },
        { start: 15, end: 18, value: 0, isOuter: false },
        { start: 18, end: 21, value: 0, isOuter: false },
        { start: 21, end: 24, value: 0, isOuter: false }
    ];
    timeSegments.forEach((seg, i) => { seg.value = Object.values(dataMeans)[i]; });

    // Color scale
    const maxVal = d3.max(timeSegments, d => d.value) || 1;
    const colorScale = d3.scaleSequential()
        .domain([0, maxVal])
        .interpolator(d3.interpolateYlOrRd);

    // SVG root
    const svg = d3.select("#clock-visualization")
        .append("svg")
        .attr("width", clockWidth)
        .attr("height", clockHeight)
        .append("g")
        .attr("transform", `translate(${clockWidth / 2},${clockHeight / 2})`);

    const angle = d3.scaleLinear().domain([0, 12]).range([0, 2 * Math.PI]);

    // Background rings
    svg.append("circle")
        .attr("class", "outer-circle")
        .attr("r", outerRadius)
        .attr("fill", "#f8f9fa")
        .attr("stroke", "#333")
        .attr("stroke-width", 2);

    svg.append("circle")
        .attr("class", "inner-circle")
        .attr("r", innerRadius)
        .attr("fill", "#e9ecef")
        .attr("stroke", "#333")
        .attr("stroke-width", 2);

    // Glow filter for highlight
    const defs = svg.append("defs");
    const glow = defs.append("filter").attr("id", "glow");
    glow.append("feGaussianBlur").attr("stdDeviation", 4).attr("result", "coloredBlur");
    const feMerge = glow.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Arcs
    const outerArc = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius)
        .startAngle(d => (d.start / 12) * 2 * Math.PI)
        .endAngle(d => (d.end   / 12) * 2 * Math.PI);

    const innerArc = d3.arc()
        .innerRadius(innerRadius * 0.6)
        .outerRadius(innerRadius)
        .startAngle(d => ((d.start - 12) / 12) * 2 * Math.PI)
        .endAngle(d => ((d.end   - 12) / 12) * 2 * Math.PI);

    // Segments (outer)
    const outerSegs = svg.selectAll(".outer-segment")
        .data(timeSegments.filter(d => d.isOuter))
        .enter()
        .append("path")
        .attr("class", "time-segment")
        .attr("d", outerArc)
        .attr("fill", d => colorScale(d.value))
        .attr("stroke", "#fff")
        .attr("stroke-width", 1);

    // Segments (inner)
    const innerSegs = svg.selectAll(".inner-segment")
        .data(timeSegments.filter(d => !d.isOuter))
        .enter()
        .append("path")
        .attr("class", "time-segment")
        .attr("d", innerArc)
        .attr("fill", d => colorScale(d.value))
        .attr("stroke", "#fff")
        .attr("stroke-width", 1);

    // Hour labels (fixed "12")
    const dayHours12h = d3.range(12).map(d => (d === 0 ? 12 : d)); // [12,1,2,...,11]
    svg.selectAll(".day-hour-label")
        .data(dayHours12h)
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

    const nightHours = d3.range(13, 25); // 13..24
    svg.selectAll(".night-hour-label")
        .data(nightHours)
        .enter()
        .append("text")
        .attr("class", "hour-label night")
        .attr("x", d => innerHourLabelRadius * Math.sin(angle((d - 12) % 12)))
        .attr("y", d => -innerHourLabelRadius * Math.cos(angle((d - 12) % 12)))
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .text(d => d);

    // Ticks
    const allHours = d3.range(12);
    svg.selectAll(".outer-hour-tick")
        .data(allHours).enter()
        .append("line")
        .attr("class", "hour-tick")
        .attr("x1", d => outerRadius * Math.sin(angle(d)))
        .attr("y1", d => -outerRadius * Math.cos(angle(d)))
        .attr("x2", d => (outerRadius - 10) * Math.sin(angle(d)))
        .attr("y2", d => -(outerRadius - 10) * Math.cos(angle(d)))
        .attr("stroke", "#333")
        .attr("stroke-width", 2);

    svg.selectAll(".inner-hour-tick")
        .data(allHours).enter()
        .append("line")
        .attr("class", "inner-hour-tick")
        .attr("x1", d => innerRadius * Math.sin(angle(d)))
        .attr("y1", d => -innerRadius * Math.cos(angle(d)))
        .attr("x2", d => (innerRadius - 10) * Math.sin(angle(d)))
        .attr("y2", d => -(innerRadius - 10) * Math.cos(angle(d)))
        .attr("stroke", "#333")
        .attr("stroke-width", 2);

    // Hands
    svg.append("line")
        .attr("class", "hour-hand")
        .attr("x1", 0).attr("y1", 0)
        .attr("x2", 0).attr("y2", -outerRadius * 0.5)
        .attr("stroke", "#2c3e50")
        .attr("stroke-width", 4)
        .attr("stroke-linecap", "butt");

    svg.append("line")
        .attr("class", "minute-hand")
        .attr("x1", 0).attr("y1", 0)
        .attr("x2", 0).attr("y2", -outerRadius * 0.9)
        .attr("stroke", "#2c3e50")
        .attr("stroke-width", 2)
        .attr("stroke-linecap", "round");

    svg.append("circle")
        .attr("cx", 0).attr("cy", 0).attr("r", 5)
        .attr("fill", "#2c3e50");

    // Legend
    addLegend(svg, colorScale, maxVal);

    // Tooltip + pin interactions (bind AFTER both inner/outer segments exist)
    const tip = d3.select("#tooltip");
    function segmentLabel(d) { return `${fmtHour24(d.start)} – ${fmtHour24(d.end)}`; }

    svg.selectAll(".time-segment")
        .each(function(d, i) { d._index = i; }) // remember index
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
            if (!d._pinned) d3.select(this).classed("highlight", false);
        })
        .on("click", function (_event, d) {
            // toggle pin; only one pinned at a time
            const nowPinned = !d._pinned;
            timeSegments.forEach(s => { s._pinned = false; });
            d._pinned = nowPinned;
            d3.selectAll(".time-segment")
                .classed("highlight", s => s._pinned)
                .each(function(s){ if(!s._pinned) this.blur; });
        });

    // Kick off live clock
    updateClockHands(colorScale, timeSegments);
}

// ----- Recommended CSS to add somewhere -----
// .time-segment.highlight { stroke: #222 !important; stroke-width: 2.5px !important; filter: url(#glow); }
// .hour-label.current { font-weight: 900; text-decoration: underline; }
