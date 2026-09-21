(function initializeAccountingHelper() {
  "use strict";

  const decimal = globalThis.AccountingHelperDecimal;
  const ELIGIBLE_TYPES = new Set(["text", "search", "tel", "url", "email", "number"]);
  const CLASS_HOVER = "accounting-helper-input-hover";
  const CLASS_SELECTED = "accounting-helper-input-selected";
  const CLASS_SCOPE = "accounting-helper-scope-hover";

  let lastContextInput = null;
  let mode = null;
  let destination = null;
  let baseValue = null;
  let hoveredInput = null;
  let hoveredScope = null;
  let scopeOverlay = null;
  let instructionHost = null;
  let isApplyingExtensionValue = false;
  const selectedInputs = new Set();
  const undoStack = [];

  function isEligibleInput(element) {
    return (
      element instanceof HTMLInputElement &&
      ELIGIBLE_TYPES.has(element.type) &&
      !element.matches(":disabled") &&
      !element.readOnly
    );
  }

  function eligibleInputFromTarget(target) {
    if (!(target instanceof Element)) {
      return null;
    }

    const input = target.closest("input");
    return isEligibleInput(input) ? input : null;
  }

  function scopeFromTarget(target) {
    return target instanceof Element ? target.closest("div, section") : null;
  }

  function setHoveredInput(input) {
    if (hoveredInput === input) {
      return;
    }

    hoveredInput?.classList.remove(CLASS_HOVER);
    hoveredInput = input;
    hoveredInput?.classList.add(CLASS_HOVER);
  }

  function setHoveredScope(scope) {
    if (hoveredScope === scope) {
      positionScopeOverlay();
      return;
    }

    hoveredScope?.classList.remove(CLASS_SCOPE);
    hoveredScope = scope;
    hoveredScope?.classList.add(CLASS_SCOPE);

    if (!hoveredScope) {
      scopeOverlay?.remove();
      scopeOverlay = null;
      return;
    }

    if (!scopeOverlay) {
      scopeOverlay = document.createElement("accounting-helper-scope-overlay");
      (document.documentElement || document.body).append(scopeOverlay);
    }

    positionScopeOverlay();
  }

  function positionScopeOverlay() {
    if (!hoveredScope?.isConnected || !scopeOverlay) {
      return;
    }

    const bounds = hoveredScope.getBoundingClientRect();
    const overlayStyles = {
      top: `${bounds.top}px`,
      left: `${bounds.left}px`,
      width: `${bounds.width}px`,
      height: `${bounds.height}px`,
    };

    for (const [property, value] of Object.entries(overlayStyles)) {
      scopeOverlay.style.setProperty(property, value, "important");
    }
  }

  function showInstruction(message) {
    instructionHost?.remove();

    const host = document.createElement("accounting-helper-overlay");
    host.setAttribute("data-accounting-helper-ui", "");
    const hostStyles = {
      all: "initial",
      position: "fixed",
      left: "50%",
      bottom: "24px",
      transform: "translateX(-50%)",
      "z-index": "2147483647",
      "pointer-events": "none",
    };

    for (const [property, value] of Object.entries(hostStyles)) {
      host.style.setProperty(property, value, "important");
    }

    const messageElement = document.createElement("div");
    messageElement.className = "accounting-helper-message";
    messageElement.textContent = message;
    host.append(messageElement);

    (document.documentElement || document.body).append(host);
    instructionHost = host;
  }

  function setInputValue(input, value) {
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;

    if (valueSetter) {
      valueSetter.call(input, value);
    } else {
      input.value = value;
    }

    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  }

  function applyValueTransaction(changes) {
    const appliedChanges = [];
    isApplyingExtensionValue = true;

    try {
      for (const { input, value } of changes) {
        if (!input.isConnected || !isEligibleInput(input)) {
          continue;
        }

        const before = input.value;

        if (before === value) {
          continue;
        }

        setInputValue(input, value);
        const after = input.value;

        if (before !== after) {
          appliedChanges.push({ input, before, after });
        }
      }
    } finally {
      isApplyingExtensionValue = false;
    }

    if (appliedChanges.length > 0) {
      undoStack.push(appliedChanges);

      if (undoStack.length > 100) {
        undoStack.shift();
      }
    }
  }

  function handleInput() {
    if (!isApplyingExtensionValue) {
      undoStack.length = 0;
    }
  }

  function handleKeyDown(event) {
    const isUndo =
      event.key.toLowerCase() === "z" &&
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      !event.shiftKey;

    if (!isUndo || undoStack.length === 0) {
      return;
    }

    const transaction = undoStack[undoStack.length - 1];
    const canUndo = transaction.every(
      ({ input, after }) => input.isConnected && input.value === after,
    );

    if (!canUndo) {
      undoStack.length = 0;
      return;
    }

    interceptEvent(event);
    clearMode();
    undoStack.pop();
    isApplyingExtensionValue = true;

    try {
      for (const { input, before } of [...transaction].reverse()) {
        setInputValue(input, before);
      }
    } finally {
      isApplyingExtensionValue = false;
    }
  }

  function clearMode() {
    setHoveredInput(null);
    setHoveredScope(null);

    for (const input of selectedInputs) {
      input.classList.remove(CLASS_SELECTED);
    }

    selectedInputs.clear();
    instructionHost?.remove();
    instructionHost = null;
    mode = null;
    destination = null;
    baseValue = null;
  }

  function recalculateSum() {
    if (!isEligibleInput(destination) || !destination.isConnected) {
      clearMode();
      return;
    }

    const values = [baseValue];

    for (const input of selectedInputs) {
      if (!input.isConnected || !isEligibleInput(input)) {
        input.classList.remove(CLASS_SELECTED);
        selectedInputs.delete(input);
        continue;
      }

      values.push(decimal.parseAccountingDecimal(input.value));
    }

    applyValueTransaction([
      {
        input: destination,
        value: decimal.formatDecimal(decimal.sumDecimals(values)),
      },
    ]);
  }

  function startSum(input) {
    clearMode();
    mode = "sum";
    destination = input;
    baseValue = decimal.parseAccountingDecimal(input.value);
    showInstruction("Left click at an input to add to the sum. Right click to finish.");
  }

  function startFillZero() {
    clearMode();
    mode = "fill-zero";
    showInstruction("Left click to select scope. Right click to cancel.");
  }

  function handlePointerMove(event) {
    if (mode === "sum") {
      setHoveredInput(eligibleInputFromTarget(event.target));
    } else if (mode === "fill-zero") {
      setHoveredScope(scopeFromTarget(event.target));
    }
  }

  function handlePointerOut(event) {
    if (event.relatedTarget !== null) {
      return;
    }

    setHoveredInput(null);
    setHoveredScope(null);
  }

  function handleViewportChange() {
    if (mode === "fill-zero") {
      positionScopeOverlay();
    }
  }

  function interceptEvent(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function handleMouseDown(event) {
    if (mode === "sum") {
      const input = eligibleInputFromTarget(event.target);

      if (input && input !== destination) {
        interceptEvent(event);
      }

      return;
    }

    if (mode === "fill-zero" && scopeFromTarget(event.target)) {
      interceptEvent(event);
    }
  }

  function handleClick(event) {
    if (mode === "sum") {
      const input = eligibleInputFromTarget(event.target);

      if (!input || input === destination) {
        return;
      }

      interceptEvent(event);

      if (selectedInputs.has(input)) {
        selectedInputs.delete(input);
        input.classList.remove(CLASS_SELECTED);
      } else {
        selectedInputs.add(input);
        input.classList.add(CLASS_SELECTED);
      }

      recalculateSum();
      return;
    }

    if (mode === "fill-zero") {
      const scope = scopeFromTarget(event.target);

      if (!scope) {
        return;
      }

      interceptEvent(event);

      const changes = Array.from(scope.querySelectorAll("input"))
        .filter((input) => isEligibleInput(input) && input.value.trim() === "")
        .map((input) => ({ input, value: "0" }));

      applyValueTransaction(changes);

      clearMode();
    }
  }

  function handleContextMenu(event) {
    if (mode === "sum") {
      const inputToFocus = destination;
      interceptEvent(event);
      clearMode();

      if (inputToFocus?.isConnected) {
        inputToFocus.focus();

        try {
          inputToFocus.select();
        } catch {
        }
      }

      return;
    }

    if (mode === "fill-zero") {
      interceptEvent(event);
      clearMode();
      return;
    }

    lastContextInput = eligibleInputFromTarget(event.target);
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (!lastContextInput?.isConnected || !isEligibleInput(lastContextInput)) {
      lastContextInput = null;
      return;
    }

    const input = lastContextInput;
    lastContextInput = null;

    if (message?.command === "start-sum") {
      startSum(input);
    } else if (message?.command === "start-fill-zero") {
      startFillZero();
    }
  });

  document.addEventListener("pointermove", handlePointerMove, true);
  document.addEventListener("pointerout", handlePointerOut, true);
  document.addEventListener("mousedown", handleMouseDown, true);
  document.addEventListener("click", handleClick, true);
  document.addEventListener("contextmenu", handleContextMenu, true);
  document.addEventListener("input", handleInput, true);
  document.addEventListener("keydown", handleKeyDown, true);
  window.addEventListener("scroll", handleViewportChange, true);
  window.addEventListener("resize", handleViewportChange, true);
})();
