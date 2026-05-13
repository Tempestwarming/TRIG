const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const ratios = {
  sin: { key: "sin", word: "SOH", mountain: "S", numerator: "O", denominator: "H", label: "Sine" },
  cos: { key: "cos", word: "CAH", mountain: "C", numerator: "A", denominator: "H", label: "Cosine" },
  tan: { key: "tan", word: "TOA", mountain: "T", numerator: "O", denominator: "A", label: "Tangent" },
};

const triangleViewBox = {
  width: 620,
  height: 420,
};

const state = {
  mode: "side",
  question: null,
  labelsChecked: false,
  selectedRatio: null,
  selectedChip: null,
  drops: {},
  ratioQueue: [],
  lastRatioKey: null,
  solutionSteps: [],
  visibleStepCount: 0,
};

const pickerSides = {
  a: "base",
  b: "vertical",
  c: "hypotenuse",
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(items) {
  return items[randomInt(0, items.length - 1)];
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function nextRatioKey() {
  if (!state.ratioQueue.length) {
    state.ratioQueue = shuffle(Object.keys(ratios));
    if (state.ratioQueue.length > 1 && state.ratioQueue[0] === state.lastRatioKey) {
      state.ratioQueue.push(state.ratioQueue.shift());
    }
  }

  const ratioKey = state.ratioQueue.shift();
  state.lastRatioKey = ratioKey;
  return ratioKey;
}

function degreesToRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function radiansToDegrees(radians) {
  return (radians * 180) / Math.PI;
}

function formatValue(value, places = 1) {
  return Number(value)
    .toFixed(places)
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "");
}

function sideDisplay(value) {
  return `${formatValue(value)} cm`;
}

function generateQuestion() {
  state.labelsChecked = false;
  state.selectedRatio = null;
  state.selectedChip = null;
  state.drops = {};
  state.solutionSteps = [];
  state.visibleStepCount = 0;

  const ratioKey = nextRatioKey();
  const orientation = pick(["low", "high"]);
  state.question = state.mode === "side" ? generateSideQuestion(ratioKey, orientation) : generateAngleQuestion(ratioKey, orientation);

  renderQuestion();
}

function generateSideQuestion(ratioKey, orientation) {
  const ratio = ratios[ratioKey];
  const angle = pick([24, 28, 32, 36, 41, 47, 53, 58, 63]);
  const unknownRole = pick([ratio.numerator, ratio.denominator]);
  const knownRole = unknownRole === ratio.numerator ? ratio.denominator : ratio.numerator;
  const knownValue = pick([5, 6, 7, 8, 9, 10, 12, 14]);
  const sides = sidesFromKnown(angle, knownRole, knownValue);

  return {
    type: "side",
    ratio: ratioKey,
    orientation,
    angle,
    answer: sides[unknownRole],
    unknownRole,
    knownRole,
    sides,
    prompt: `Find x. The angle is ${angle}° and one side is ${sideDisplay(knownValue)}.`,
  };
}

function generateAngleQuestion(ratioKey, orientation) {
  const triples = [
    { O: 3, A: 4, H: 5 },
    { O: 5, A: 12, H: 13 },
    { O: 8, A: 15, H: 17 },
    { O: 7, A: 24, H: 25 },
    { O: 9, A: 12, H: 15 },
    { O: 12, A: 16, H: 20 },
  ];
  const sides = { ...pick(triples) };
  const angle = radiansToDegrees(Math.atan2(sides.O, sides.A));
  const ratio = ratios[ratioKey];

  return {
    type: "angle",
    ratio: ratioKey,
    orientation,
    angle,
    answer: angle,
    sides,
    knownRoles: [ratio.numerator, ratio.denominator],
    prompt: `Find angle x. Two sides are labelled on the triangle.`,
  };
}

function sidesFromKnown(angle, knownRole, knownValue) {
  const theta = degreesToRadians(angle);
  if (knownRole === "H") {
    return {
      H: knownValue,
      O: knownValue * Math.sin(theta),
      A: knownValue * Math.cos(theta),
    };
  }

  if (knownRole === "O") {
    return {
      O: knownValue,
      H: knownValue / Math.sin(theta),
      A: knownValue / Math.tan(theta),
    };
  }

  return {
    A: knownValue,
    H: knownValue / Math.cos(theta),
    O: knownValue * Math.tan(theta),
  };
}

function renderQuestion() {
  $("#trig-prompt").textContent = state.question.prompt;
  $("#triangle-diagram").innerHTML = triangleSvg(state.question);
  positionLabelControls(state.question);
  resetLabelControls();
  renderRatioButtons();
  hideWorking();
  setFeedback("Label the three sides first.", null);
}

function renderRatioButtons() {
  const container = $("#ratio-buttons");
  container.innerHTML = Object.values(ratios)
    .map((ratio) => {
      const selected = state.selectedRatio === ratio.key ? " is-selected" : "";
      const disabled = state.labelsChecked ? "" : " disabled";
      const wrong = state.selectedRatio === ratio.key && state.selectedRatio !== state.question.ratio ? " is-wrong" : "";
      return `
        <button class="mountain-card${selected}${wrong}" type="button" data-ratio="${ratio.key}"${disabled}>
          ${mountainSvg(ratio, "mini-mountain")}
          <span class="ratio-word">${ratio.word}</span>
        </button>
      `;
    })
    .join("");

  $$(".mountain-card").forEach((button) => {
    button.addEventListener("click", () => chooseRatio(button.dataset.ratio));
  });
}

function mountainSvg(ratio, className) {
  return `
    <svg class="${className}" viewBox="0 0 180 128" aria-hidden="true">
      <path class="mountain-outline" d="M90 12 L24 112 H156 Z"></path>
      <path class="mountain-divider" d="M58 75 H122 M90 75 V103"></path>
      <text class="mountain-letter mountain-top-letter" x="90" y="52" text-anchor="middle" dominant-baseline="middle">${ratio.numerator}</text>
      <text class="mountain-letter" x="64" y="96" text-anchor="middle" dominant-baseline="middle">${ratio.mountain}</text>
      <text class="mountain-letter" x="116" y="96" text-anchor="middle" dominant-baseline="middle">${ratio.denominator}</text>
    </svg>
  `;
}

function roleToSideMap(question) {
  if (question.orientation === "low") {
    return { A: "base", O: "vertical", H: "hypotenuse" };
  }

  return { O: "base", A: "vertical", H: "hypotenuse" };
}

function sideToRoleMap(question) {
  const roleMap = roleToSideMap(question);
  return Object.fromEntries(Object.entries(roleMap).map(([role, side]) => [side, role]));
}

function getTriangleLayout(question) {
  const rightX = 475;
  const bottomY = 292;
  const leftX = 145;
  const topY = 92;

  const layout = {
    bottomY,
    left: { x: leftX, y: bottomY },
    right: { x: rightX, y: bottomY },
    top: { x: rightX, y: topY },
  };
  const sidePositions = getSidePositions(layout);
  return {
    ...layout,
    labels: sidePositions.labels,
    controls: sidePositions.controls,
  };
}

function getSidePositions(layout) {
  const hypotenuseLabel = outsideHypotenusePoint(layout.left, layout.top, 44);

  return {
    labels: {
      base: { x: midpoint(layout.left, layout.right).x, y: layout.bottomY + 84 },
      vertical: { x: layout.right.x + 78, y: midpoint(layout.top, layout.right).y + 34 },
      hypotenuse: hypotenuseLabel,
    },
    controls: {
      base: { className: "label-picker-a", x: midpoint(layout.left, layout.right).x, y: layout.bottomY + 38 },
      vertical: { className: "label-picker-b", x: layout.right.x + 78, y: midpoint(layout.top, layout.right).y - 14 },
      hypotenuse: {
        className: "label-picker-c",
        x: hypotenuseLabel.x,
        y: hypotenuseLabel.y - 50,
      },
    },
  };
}

function outsideHypotenusePoint(left, top, offset) {
  const mid = midpoint(left, top);
  const direction = normaliseVector({ x: top.x - left.x, y: top.y - left.y });
  const normal = { x: direction.y, y: -direction.x };

  return {
    x: mid.x + normal.x * offset,
    y: mid.y + normal.y * offset,
  };
}

function triangleSvg(question) {
  const layout = getTriangleLayout(question);
  const sideLabels = buildVisibleSideLabels(question, layout);

  return `
    <svg class="trig-svg" viewBox="0 0 ${triangleViewBox.width} ${triangleViewBox.height}" role="img">
      <path class="triangle-side" d="M${layout.left.x} ${layout.left.y} L${layout.right.x} ${layout.right.y} L${layout.top.x} ${layout.top.y} Z"></path>
      <path class="right-mark" d="M${layout.right.x - 34} ${layout.right.y} V${layout.right.y - 34} H${layout.right.x}"></path>
      ${angleMarkup(question, layout)}
      ${sideLabels}
    </svg>
  `;
}

function angleMarkup(question, layout) {
  const label = question.type === "angle" ? "x°" : `${question.angle}°`;
  const vertex = question.orientation === "low" ? layout.left : layout.top;
  const adjacentEnd = question.orientation === "low" ? layout.right : layout.right;
  const hypotenuseEnd = question.orientation === "low" ? layout.top : layout.left;
  const adjacentVector = normaliseVector({ x: adjacentEnd.x - vertex.x, y: adjacentEnd.y - vertex.y });
  const hypotenuseVector = normaliseVector({ x: hypotenuseEnd.x - vertex.x, y: hypotenuseEnd.y - vertex.y });
  const shortestSide = Math.min(distance(vertex, adjacentEnd), distance(vertex, hypotenuseEnd));
  const radius = clamp(shortestSide * 0.18, 28, 48);
  const start = pointFromVector(vertex, adjacentVector, radius);
  const end = pointFromVector(vertex, hypotenuseVector, radius);
  const bisector = normaliseVector({
    x: adjacentVector.x + hypotenuseVector.x,
    y: adjacentVector.y + hypotenuseVector.y,
  });
  const control = pointFromVector(vertex, bisector, radius * 0.42);
  const labelPoint = pointFromVector(vertex, bisector, Math.min(shortestSide * 0.33, radius + 26));

  return `
    <path class="angle-arc-trig" d="M${start.x} ${start.y} Q${control.x} ${control.y} ${end.x} ${end.y}"></path>
    <text class="angle-measure" x="${labelPoint.x}" y="${labelPoint.y}" text-anchor="middle" dominant-baseline="middle">${label}</text>
  `;
}

function distance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function pointFromVector(point, vector, length) {
  return {
    x: point.x + vector.x * length,
    y: point.y + vector.y * length,
  };
}

function midpoint(first, second) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

function normaliseVector(vector) {
  const length = Math.hypot(vector.x, vector.y);
  if (!length) return { x: 0, y: 0 };
  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildVisibleSideLabels(question, layout) {
  const roleMap = roleToSideMap(question);
  const labels = [];

  Object.entries(roleMap).forEach(([role, side]) => {
    const text = visibleTextForRole(question, role);
    if (!text) return;
    const position = labelPositionForSide(side, layout);
    labels.push(`<text class="trig-measure" x="${position.x}" y="${position.y}" text-anchor="middle">${text}</text>`);
  });

  return labels.join("");
}

function visibleTextForRole(question, role) {
  if (question.type === "side") {
    if (role === question.unknownRole) return "x";
    if (role === question.knownRole) return sideDisplay(question.sides[role]);
    return "";
  }

  return question.knownRoles.includes(role) ? sideDisplay(question.sides[role]) : "";
}

function labelPositionForSide(side, layout) {
  return layout.labels[side];
}

function positionLabelControls(question) {
  const layout = getTriangleLayout(question);
  Object.entries(layout.controls).forEach(([side, point]) => {
    const control = $(`.${point.className}`);
    control.style.left = `${(point.x / triangleViewBox.width) * 100}%`;
    control.style.top = `${(point.y / triangleViewBox.height) * 100}%`;
  });
}

function resetLabelControls() {
  $$("[data-picker]").forEach((select) => {
    select.value = "";
    select.closest(".side-label-control").classList.remove("is-correct", "is-wrong");
  });
}

function checkLabels() {
  const expected = sideToRoleMap(state.question);
  let allComplete = true;
  let allCorrect = true;

  $$("[data-picker]").forEach((select) => {
    const control = select.closest(".side-label-control");
    const chosen = select.value;
    const correct = expected[pickerSides[select.dataset.picker]];
    control.classList.remove("is-correct", "is-wrong");

    if (!chosen) {
      allComplete = false;
      allCorrect = false;
      return;
    }

    const isCorrect = chosen === correct;
    allCorrect = allCorrect && isCorrect;
    control.classList.add(isCorrect ? "is-correct" : "is-wrong");
  });

  if (!allComplete) {
    state.labelsChecked = false;
    renderRatioButtons();
    setFeedback("Choose O, A, and H for all three sides.", "is-wrong");
    return;
  }

  if (!allCorrect) {
    state.labelsChecked = false;
    renderRatioButtons();
    setFeedback("One label needs moving. Hypotenuse is always the side opposite the right angle.", "is-wrong");
    return;
  }

  state.labelsChecked = true;
  renderRatioButtons();
  setFeedback(`Good. Use the two labelled sides to choose ${ratios[state.question.ratio].word}.`, "is-correct");
}

function chooseRatio(ratioKey) {
  if (!state.labelsChecked) {
    setFeedback("Check the side labels before choosing a mountain.", "is-wrong");
    return;
  }

  state.selectedRatio = ratioKey;
  state.drops = {};
  state.selectedChip = null;
  renderRatioButtons();

  if (ratioKey !== state.question.ratio) {
    hideWorking();
    const ratio = ratios[state.question.ratio];
    setFeedback(`That mountain does not use the two sides in the question. Look for ${ratio.numerator} and ${ratio.denominator}.`, "is-wrong");
    return;
  }

  showWorking();
  setFeedback(`${ratios[ratioKey].word} is selected. Put each value into the mountain.`, "is-correct");
}

function showWorking() {
  $("#working-placeholder").hidden = true;
  $("#working-area").hidden = false;
  $("#selected-ratio-title").textContent = `${ratios[state.selectedRatio].word} mountain`;
  renderChipBank();
  renderLargeMountain();
  updateFormula();
}

function hideWorking() {
  $("#working-placeholder").hidden = false;
  $("#working-area").hidden = true;
  $("#chip-bank").innerHTML = "";
  $("#large-mountain").innerHTML = "";
  $("#formula-line").textContent = "Place all three values.";
  $("#solve-line").textContent = "";
  $("#reveal-step").hidden = true;
  state.solutionSteps = [];
  state.visibleStepCount = 0;
}

function getChips() {
  const question = state.question;
  const ratio = ratios[question.ratio];
  const angleText = question.type === "angle" ? "x°" : `${question.angle}°`;
  return [
    { id: "angle", text: angleText, role: ratio.mountain },
    { id: ratio.numerator, text: chipTextForRole(question, ratio.numerator), role: ratio.numerator },
    { id: ratio.denominator, text: chipTextForRole(question, ratio.denominator), role: ratio.denominator },
  ];
}

function chipTextForRole(question, role) {
  if (question.type === "side" && role === question.unknownRole) return "x cm";
  return sideDisplay(question.sides[role]);
}

function renderChipBank() {
  const chips = getChips();
  $("#chip-bank").innerHTML = chips
    .map((chip) => {
      const placed = Object.values(state.drops).includes(chip.id) ? " is-placed" : "";
      const picked = state.selectedChip === chip.id ? " is-picked" : "";
      return `<button class="value-chip${placed}${picked}" type="button" draggable="true" data-chip="${chip.id}">${chip.text}</button>`;
    })
    .join("");

  $$(".value-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      state.selectedChip = chip.dataset.chip;
      renderChipBank();
    });
    chip.addEventListener("dragstart", (event) => {
      state.selectedChip = chip.dataset.chip;
      event.dataTransfer.setData("text/plain", chip.dataset.chip);
    });
  });
}

function renderLargeMountain() {
  const ratio = ratios[state.selectedRatio];
  $("#large-mountain").innerHTML = `
    <div class="mountain-workspace">
      ${mountainSvg(ratio, "")}
      ${dropZone("ratio")}
      ${dropZone("numerator")}
      ${dropZone("denominator")}
    </div>
  `;

  $$(".drop-zone").forEach((zone) => {
    zone.addEventListener("dragover", (event) => event.preventDefault());
    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      const chipId = event.dataTransfer.getData("text/plain") || state.selectedChip;
      placeChip(zone.dataset.slot, chipId);
    });
    zone.addEventListener("click", () => placeChip(zone.dataset.slot, state.selectedChip));
  });
}

function dropZone(slot) {
  const chip = getChips().find((item) => item.id === state.drops[slot]);
  const expected = expectedRoleForSlot(slot);
  const filled = chip ? " is-filled" : "";
  const correctness = chip ? (chip.role === expected ? " is-right" : " is-wrong") : "";
  return `<button class="drop-zone drop-${slot}${filled}${correctness}" type="button" data-slot="${slot}">${chip ? chip.text : "Place"}</button>`;
}

function expectedRoleForSlot(slot) {
  const ratio = ratios[state.selectedRatio];
  if (slot === "ratio") return ratio.mountain;
  if (slot === "numerator") return ratio.numerator;
  return ratio.denominator;
}

function placeChip(slot, chipId) {
  if (!chipId) return;

  const chips = getChips();
  if (!chips.some((chip) => chip.id === chipId)) return;

  Object.keys(state.drops).forEach((key) => {
    if (state.drops[key] === chipId) delete state.drops[key];
  });

  state.drops[slot] = chipId;
  state.selectedChip = null;
  renderChipBank();
  renderLargeMountain();
  updateFormula();
}

function clearMountain() {
  state.drops = {};
  state.selectedChip = null;
  renderChipBank();
  renderLargeMountain();
  updateFormula();
}

function updateFormula() {
  const ratio = ratios[state.selectedRatio];
  const slots = ["ratio", "numerator", "denominator"];
  const chips = getChips();
  const allFilled = slots.every((slot) => state.drops[slot]);

  if (!allFilled) {
    $("#formula-line").textContent = "Place all three values.";
    $("#solve-line").textContent = "";
    $("#reveal-step").hidden = true;
    state.solutionSteps = [];
    state.visibleStepCount = 0;
    return;
  }

  const allCorrect = slots.every((slot) => {
    const chip = chips.find((item) => item.id === state.drops[slot]);
    return chip && chip.role === expectedRoleForSlot(slot);
  });

  if (!allCorrect) {
    $("#formula-line").textContent = "Check the mountain placements.";
    $("#solve-line").textContent = "";
    $("#reveal-step").hidden = true;
    state.solutionSteps = [];
    state.visibleStepCount = 0;
    setFeedback("One value is in the wrong part of the mountain.", "is-wrong");
    return;
  }

  state.solutionSteps = buildSolutionSteps();
  state.visibleStepCount = 0;
  renderSolutionSteps();
  setFeedback("The mountain is complete. Reveal the working when students are ready to check.", "is-correct");
}

function buildSolutionSteps() {
  const ratio = ratios[state.selectedRatio];

  if (state.question.type === "angle") {
    const numerator = formatValue(state.question.sides[ratio.numerator]);
    const denominator = formatValue(state.question.sides[ratio.denominator]);
    const quotient = formatValue(state.question.sides[ratio.numerator] / state.question.sides[ratio.denominator], 3);
    return [
      `x = ${ratio.key}^-1(${numerator} ÷ ${denominator})`,
      `x = ${ratio.key}^-1(${quotient})`,
      `x = ${formatValue(state.question.answer)}°`,
    ];
  }

  const angle = state.question.angle;
  const knownRole = state.question.knownRole;
  const known = formatValue(state.question.sides[knownRole]);
  const answer = formatValue(state.question.answer);
  const trigValue = formatValue(Math[ratio.key](degreesToRadians(angle)), 3);

  if (state.question.unknownRole === ratio.numerator) {
    return [
      `x = ${ratio.key}(${angle}°) × ${known}`,
      `x = ${trigValue} × ${known}`,
      `x = ${answer} cm`,
    ];
  }

  return [
    `x = ${known} ÷ ${ratio.key}(${angle}°)`,
    `x = ${known} ÷ ${trigValue}`,
    `x = ${answer} cm`,
  ];
}

function renderSolutionSteps() {
  const visibleSteps = state.solutionSteps.slice(0, state.visibleStepCount);
  $("#formula-line").textContent = state.visibleStepCount
    ? "Working"
    : "Values placed. Reveal the working one step at a time.";
  $("#solve-line").innerHTML = visibleSteps.map((step) => `<div class="solution-step">${step}</div>`).join("");
  const revealButton = $("#reveal-step");
  revealButton.hidden = state.visibleStepCount >= state.solutionSteps.length;
  revealButton.textContent = state.visibleStepCount ? "Reveal next step" : "Reveal first step";
}

function revealNextStep() {
  if (!state.solutionSteps.length) return;
  state.visibleStepCount = Math.min(state.visibleStepCount + 1, state.solutionSteps.length);
  renderSolutionSteps();

  if (state.visibleStepCount === state.solutionSteps.length) {
    setFeedback("Answer revealed. Students can compare this with their own calculation.", "is-correct");
  }
}

function setFeedback(message, feedbackState) {
  const feedback = $("#trig-feedback");
  feedback.textContent = message;
  feedback.classList.remove("is-correct", "is-wrong");
  if (feedbackState) feedback.classList.add(feedbackState);
}

function resetAfterLabelChange() {
  if (!state.labelsChecked) return;
  state.labelsChecked = false;
  state.selectedRatio = null;
  state.drops = {};
  renderRatioButtons();
  hideWorking();
  setFeedback("Check the labels again before choosing a mountain.", null);
}

function setupEvents() {
  $("#new-trig-question").addEventListener("click", generateQuestion);
  $("#check-labels").addEventListener("click", checkLabels);
  $("#clear-mountain").addEventListener("click", clearMountain);
  $("#reveal-step").addEventListener("click", revealNextStep);

  $$("[data-question-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.questionMode;
      $$("[data-question-mode]").forEach((item) => item.classList.toggle("is-active", item === button));
      generateQuestion();
    });
  });

  $$("[data-picker]").forEach((select) => {
    select.addEventListener("change", () => {
      select.closest(".side-label-control").classList.remove("is-correct", "is-wrong");
      resetAfterLabelChange();
    });
  });
}

setupEvents();
generateQuestion();
