(function exposeAccountingDecimal(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.AccountingHelperDecimal = api;
  }
})(typeof globalThis === "object" ? globalThis : this, function createDecimalApi() {
  "use strict";

  const ZERO = Object.freeze({ coefficient: 0n, scale: 0 });

  function normalize(decimal) {
    let coefficient = decimal.coefficient;
    let scale = decimal.scale;

    if (coefficient === 0n) {
      return ZERO;
    }

    while (scale > 0 && coefficient % 10n === 0n) {
      coefficient /= 10n;
      scale -= 1;
    }

    return { coefficient, scale };
  }

  function parseAccountingDecimal(value) {
    let text = String(value ?? "").trim();

    if (!text) {
      return ZERO;
    }

    let parenthesizedNegative = false;
    const startsWithParenthesis = text.startsWith("(");
    const endsWithParenthesis = text.endsWith(")");

    if (startsWithParenthesis || endsWithParenthesis) {
      if (!(startsWithParenthesis && endsWithParenthesis)) {
        return ZERO;
      }

      parenthesizedNegative = true;
      text = text.slice(1, -1);
    }

    text = text.replace(/\s+/gu, "").replace(/\p{Sc}/gu, "");

    if (!text || (parenthesizedNegative && /^[+-]/u.test(text))) {
      return ZERO;
    }

    const validNumber = /^[+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)$/u;

    if (!validNumber.test(text)) {
      return ZERO;
    }

    let negative = parenthesizedNegative;

    if (!parenthesizedNegative && (text.startsWith("-") || text.startsWith("+"))) {
      negative = text.startsWith("-");
      text = text.slice(1);
    }

    text = text.replace(/,/gu, "");

    const [whole = "0", fraction = ""] = text.split(".");
    const digits = `${whole || "0"}${fraction}`;
    let coefficient = BigInt(digits);

    if (negative && coefficient !== 0n) {
      coefficient = -coefficient;
    }

    return normalize({ coefficient, scale: fraction.length });
  }

  function sumDecimals(decimals) {
    const values = Array.from(decimals);

    if (values.length === 0) {
      return ZERO;
    }

    const scale = values.reduce(
      (largest, decimal) => Math.max(largest, decimal.scale),
      0,
    );

    const coefficient = values.reduce((total, decimal) => {
      const scaleDifference = scale - decimal.scale;
      return total + decimal.coefficient * 10n ** BigInt(scaleDifference);
    }, 0n);

    return normalize({ coefficient, scale });
  }

  function formatDecimal(decimal) {
    const normalized = normalize(decimal);
    const negative = normalized.coefficient < 0n;
    let digits = (negative ? -normalized.coefficient : normalized.coefficient).toString();

    if (normalized.scale === 0) {
      return `${negative ? "-" : ""}${digits}`;
    }

    digits = digits.padStart(normalized.scale + 1, "0");
    const decimalPoint = digits.length - normalized.scale;
    const formatted = `${digits.slice(0, decimalPoint)}.${digits.slice(decimalPoint)}`;

    return `${negative ? "-" : ""}${formatted}`;
  }

  return {
    formatDecimal,
    parseAccountingDecimal,
    sumDecimals,
  };
});
