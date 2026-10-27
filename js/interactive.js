/**
 * Initializes interaction handlers for the line chart.
 * @param {Object} chartContext - Context object containing D3 scales, selection elements, and groups.
 */
function setupInteractivity(chartContext) {
  const { svgParent, svg, width, height, x, y, nested, groups, groupTotals, paths } = chartContext;

  // ------------------------------------------------------------------------------------------------
  // BUNDLE 1: STATE PERSISTENCE & COLOR LOGIC
  // Preserves active filter selection across screen resizes and window redraws.
  // ------------------------------------------------------------------------------------------------
  if (!window.chartActiveGroups) {
      window.chartActiveGroups = new Set(groups);
  }
  const activeGroups = window.chartActiveGroups;
  
  let currentHighestGroup = "";
  let currentLowestGroup = "";

  /**
   * Applies the project's 3-Color Semiotic Rule:
   * - Vermillion (#D55E00): Dynamically denotes the highest active volume series.
   * - Emerald Green (#009E73): Dynamically denotes the lowest active volume series.
   * - Dark Charcoal (#222222): Baseline color for other active series.
   * - Light Grey (#B0B0B0): Inactive/deselected state.
   */
  function getDynamicColor(g) {
      if (!activeGroups.has(g)) return '#B0B0B0'; 
      if (g === currentHighestGroup) return '#D55E00'; 
      if (g === currentLowestGroup) return '#009E73'; 
      return '#222222'; 
  }

  // ------------------------------------------------------------------------------------------------
  // BUNDLE 2: INTERACTIVE FILTER CONTROLS & AFFORDANCE
  // Renders "Filter :" guide text and accessible filter pill buttons.
  // ------------------------------------------------------------------------------------------------
  const filterContainer = d3.select("#filter-container");
  filterContainer.append("span")
    .attr("class", "filter-guide-label")
    .text("Filter :");

  groups.forEach(group => {
    const safeId = group.replace(/\s+/g, '');
    const btn = filterContainer.append("button")
      .attr("id", `pill-${safeId}`)
      .attr("class", `filter-pill ${activeGroups.has(group) ? 'active' : ''}`)
      .attr("type", "button")
      // SPECIAL INDEX: aria-pressed informs assistive tech whether a toggle button is currently active
      .attr("aria-pressed", activeGroups.has(group))
      .on("click", function() {
        if (activeGroups.has(group)) {
          activeGroups.delete(group);
          d3.select(this).classed("active", false).attr("aria-pressed", "false");
        } else {
          activeGroups.add(group);
          d3.select(this).classed("active", true).attr("aria-pressed", "true");
        }
        updateColorsAndKPIs();
      });

    // Small color dot icon inside filter button
    btn.append("span")
      .attr("id", `pill-dot-${safeId}`)
      .attr("class", "pill-color-dot")
      .attr("aria-hidden", "true");

    btn.append("span")
      .text(group);
  });

  // ------------------------------------------------------------------------------------------------
  // BUNDLE 3: DYNAMIC KPI RECALCULATION & VISUAL ENCODING UPDATE
  // Recomputes aggregated statistics for the metric cards and updates stroke colors and opacity.
  // ------------------------------------------------------------------------------------------------
  function updateColorsAndKPIs() {
    if (activeGroups.size === 0) {
        d3.select("#kpi-total").text("0");
        d3.select("#kpi-highest-val").text("0");
        d3.select("#kpi-highest-name").text("-").style("color", "#5E5A66");
        d3.select("#kpi-lowest-val").text("0");
        d3.select("#kpi-lowest-name").text("-").style("color", "#5E5A66");
        currentHighestGroup = "";
        currentLowestGroup = "";
    } else {
        let filteredTotal = 0;
        let highest = { name: '', val: -Infinity };
        let lowest = { name: '', val: Infinity };

        activeGroups.forEach(g => {
           const gTotal = groupTotals.find(item => item.group === g).total;
           filteredTotal += gTotal;
           if (gTotal > highest.val) highest = { name: g, val: gTotal };
           if (gTotal < lowest.val) lowest = { name: g, val: gTotal };
        });

        currentHighestGroup = highest.name;
        currentLowestGroup = lowest.name;

        // Update KPI values in the DOM with thousands formatting
        d3.select("#kpi-total").text(d3.format(",")(filteredTotal));
        d3.select("#kpi-highest-val").text(d3.format(",")(highest.val));
        d3.select("#kpi-highest-name").text(highest.name).style("color", "#D55E00");
        d3.select("#kpi-lowest-val").text(d3.format(",")(lowest.val));
        d3.select("#kpi-lowest-name").text(lowest.name).style("color", "#009E73");
    }

    // Apply updated colors and opacity across paths, direct text labels, and pill controls
    groups.forEach(g => {
       const safeId = g.replace(/\s+/g, '');
       const isActive = activeGroups.has(g);
       const color = getDynamicColor(g);

       paths[g].attr("stroke", color).style("opacity", isActive ? 1 : 0.08);
       svg.selectAll(`.label-${safeId} tspan`).style("fill", color).style("opacity", isActive ? 1 : 0.15);
       svg.selectAll(`.label-${safeId}`).style("fill", color).style("opacity", isActive ? 1 : 0.15);
       
       d3.select(`#pill-${safeId}`)
         .style("color", isActive ? color : "#8E8A96")
         .style("border-color", isActive ? color : "var(--glass-border)");

       d3.select(`#pill-dot-${safeId}`)
         .style("background-color", color)
         .style("opacity", isActive ? 1 : 0.4);
    });
  }

  updateColorsAndKPIs(); // Initial synchronization run

  // ------------------------------------------------------------------------------------------------
  // BUNDLE 4: HYBRID ACCESSIBLE TOOLTIP (MOUSE + ARROW-KEYPAD NAVIGATION)
  // SPECIAL INDEX EXPLANATION:
  // - aria-live="polite": WCAG standard ensuring screen readers announce tooltip content changes 
  //   without interrupting other current speech.
  // - x.invert(mouseX): Mathematical inversion of linear scale. Converts pixel coordinate values
  //   back to the domain variable (calendar year: 2011 to 2021).
  // - stroke-dasharray="4,4": SVG stroke property creating dashed indicator lines for crosshairs.
  // ------------------------------------------------------------------------------------------------
  d3.select(".a11y-tooltip").remove(); 
  
  const tooltip = d3.select("body").append("div")
    .attr("class", "a11y-tooltip")
    .attr("aria-live", "polite") 
    .style("opacity", 0);
    
  const crosshair = svg.append("line")
    .attr("class", "crosshair")
    .style("opacity", 0)
    .attr("y1", 0)
    .attr("y2", height)
    .attr("stroke", "#C3B1E0")
    .attr("stroke-dasharray", "4,4");

  const chartContainerNode = d3.select("#chart-container").node();

  function drawTooltip(year, pointerX, pointerY, isKeypad = false) {
     crosshair.style("opacity", 1).attr("x1", x(year)).attr("x2", x(year));
     
     let html = `<div style="font-size:1.1rem; font-weight:700; border-bottom:1.5px solid #C3B1E0; padding-bottom:6px; margin-bottom:8px;">Year: ${year}</div>`;
     
     activeGroups.forEach(group => {
         const groupData = nested.get(group);
         const current = groupData.find(d => d.year === year);
         
         if (current) {
             const color = getDynamicColor(group);
             html += `<div style="margin-bottom:6px; font-size:1rem;">
                        <span style="color:${color}; font-size:1.2rem;">●</span> ${group}: 
                        <strong>${d3.format(",")(current.hospitalisations)}</strong>
                      </div>`;
         }
     });
     
     tooltip.html(html);

     // Tooltip placement: Follows mouse pointer during hover; docks above SVG during keyboard navigation
     if (isKeypad) {
         const rect = chartContainerNode.getBoundingClientRect();
         tooltip.style("left", (rect.left + window.scrollX + x(year) + 20) + "px")
                .style("top", (rect.top + window.scrollY + 100) + "px")
                .style("opacity", 1);
     } else {
         tooltip.style("left", (pointerX + 20) + "px")
                .style("top", (pointerY - 20) + "px")
                .style("opacity", 1);
     }
  }

  // Pointer Interaction Overlay (Transparent rect capturing all mouse coordinates)
  svg.append("rect")
    .attr("width", width).attr("height", height).style("fill", "none").style("pointer-events", "all")
    .on("mousemove", (event) => {
       const [mouseX] = d3.pointer(event);
       const year = Math.round(x.invert(mouseX)); // Map mouse X pixel back to discrete year
       drawTooltip(year, event.pageX, event.pageY, false);
    })
    .on("mouseout", () => { 
       crosshair.style("opacity", 0); 
       tooltip.style("opacity", 0); 
    });

  // Keyboard Interaction Listeners (Allows keyboard-only exploration via Left/Right arrows)
  let keypadYear = 2011;
  svgParent.on("keydown", (event) => {
      if (event.key === "ArrowRight") {
          keypadYear = Math.min(2021, keypadYear + 1);
          drawTooltip(keypadYear, 0, 0, true);
          event.preventDefault(); 
      } else if (event.key === "ArrowLeft") {
          keypadYear = Math.max(2011, keypadYear - 1);
          drawTooltip(keypadYear, 0, 0, true);
          event.preventDefault(); 
      } else if (event.key === "Escape") {
          crosshair.style("opacity", 0); 
          tooltip.style("opacity", 0); 
      }
  });

  svgParent.on("focus", () => drawTooltip(keypadYear, 0, 0, true));
  svgParent.on("focusout", () => { crosshair.style("opacity", 0); tooltip.style("opacity", 0); });
}
