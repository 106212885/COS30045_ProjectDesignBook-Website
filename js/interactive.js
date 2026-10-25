/* ==========================================================================
   Handles Filters, 3-Color Rule, KPIs, and Tooltips.
   ========================================================================== */

function setupInteractivity(chartContext) {
  const { svgParent, svg, width, height, x, y, nested, groups, groupTotals, paths } = chartContext;

  // 1. State Persistence: Maintain active filters when window resizes
  if (!window.chartActiveGroups) {
      window.chartActiveGroups = new Set(groups);
  }
  const activeGroups = window.chartActiveGroups;
  
  let currentHighestGroup = "";
  let currentLowestGroup = "";

  // 2. Theme Logic: Strict 3-Color Rule
  function getDynamicColor(g) {
      if (!activeGroups.has(g)) return '#B0B0B0'; // Inactive: Grey
      if (g === currentHighestGroup) return '#D55E00'; // Highest: Vermillion Red
      if (g === currentLowestGroup) return '#009E73'; // Lowest: Emerald Green
      return '#222222'; // Default active: Black
  }

  // 3. KPI Update Logic: Recalculates metrics based on active filters
  function updateColorsAndKPIs() {
    if(activeGroups.size === 0) {
        d3.select("#kpi-total").text("0");
        d3.select("#kpi-highest-val").text("0");
        d3.select("#kpi-highest-name").text("-").style("color", "#5E5A66");
        d3.select("#kpi-lowest-val").text("0");
        d3.select("#kpi-lowest-name").text("-").style("color", "#5E5A66");
        return;
    }

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

    // Inject updated math into DOM
    d3.select("#kpi-total").text(d3.format(",")(filteredTotal));
    d3.select("#kpi-highest-val").text(d3.format(",")(highest.val));
    d3.select("#kpi-highest-name").text(highest.name).style("color", "#D55E00");
    d3.select("#kpi-lowest-val").text(d3.format(",")(lowest.val));
    d3.select("#kpi-lowest-name").text(lowest.name).style("color", "#009E73");

    // Apply colors to chart paths, labels, and filter buttons
    groups.forEach(g => {
       const color = getDynamicColor(g);
       paths[g].attr("stroke", color).style("opacity", activeGroups.has(g) ? 1 : 0.05);
       svg.selectAll(`.label-${g.replace(/\s+/g, '')} tspan`).style("fill", color).style("opacity", activeGroups.has(g) ? 1 : 0.05);
       svg.selectAll(`.label-${g.replace(/\s+/g, '')}`).style("fill", color).style("opacity", activeGroups.has(g) ? 1 : 0.05);
       
       d3.select(`#pill-${g.replace(/\s+/g, '')}`)
         .style("color", color)
         .style("border-color", activeGroups.has(g) ? color : "var(--glass-border)");
    });
  }

  // 4. Generate Filter Buttons
  groups.forEach(group => {
    d3.select("#filter-container").append("button")
      .attr("id", `pill-${group.replace(/\s+/g, '')}`)
      .attr("class", `filter-pill ${activeGroups.has(group) ? 'active' : ''}`)
      .text(group) 
      .on("click", function() {
        if (activeGroups.has(group)) {
          activeGroups.delete(group);
          d3.select(this).classed("active", false);
        } else {
          activeGroups.add(group);
          d3.select(this).classed("active", true);
        }
        updateColorsAndKPIs();
      });
  });

  updateColorsAndKPIs(); // Run once on load

  // ---------------------------------------------------------
  // 5. HYBRID TOOLTIP (Mouse + Keypad Support)
  // ---------------------------------------------------------
  d3.select(".a11y-tooltip").remove(); 
  
  const tooltip = d3.select("body").append("div")
    .attr("class", "a11y-tooltip")
    .attr("aria-live", "polite") // Screen reader announcement
    .style("opacity", 0);
    
  const crosshair = svg.append("line").attr("class", "crosshair").style("opacity", 0).attr("y1", 0).attr("y2", height).attr("stroke", "#C3B1E0").attr("stroke-dasharray", "4,4");
  const chartContainerNode = d3.select("#chart-container").node();

  // Core tooltip draw logic
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

     // Position tooltip: Static above chart for keyboard, follows cursor for mouse
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

  // Mouse Triggers
  svg.append("rect")
    .attr("width", width).attr("height", height).style("fill", "none").style("pointer-events", "all")
    .on("mousemove", (event) => {
       const [mouseX] = d3.pointer(event);
       const year = Math.round(x.invert(mouseX));
       drawTooltip(year, event.pageX, event.pageY, false);
    })
    .on("mouseout", () => { 
       crosshair.style("opacity", 0); 
       tooltip.style("opacity", 0); 
    });

  // Keypad Triggers (Tab to select chart, Arrows to navigate years)
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