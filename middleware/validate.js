const AppError = require('../utils/AppError');

// A tiny, dependency-free validation engine. Each route defines a schema
// (see routes/*.js) describing required fields, types, and constraints;
// this middleware factory checks the request body against it *before* any
// controller or database code runs. This is the app's main defence against
// malformed input, type-confusion bugs, and basic injection attempts.
//
// schema example:
// { name: { type: 'string', required: true, maxLen: 120 },
//   value: { type: 'number', min: 0 },
//   stage: { type: 'string', enum: ['lead','qualified','won'] } }
function validateBody(schema) {
  return (req, res, next) => {
    const errors = [];
    const body = req.body || {};
    const clean = {};

    for (const [field, rules] of Object.entries(schema)) {
      let val = body[field];

      if (val === undefined || val === null || val === '') {
        if (rules.required) errors.push(`"${field}" is required.`);
        else if (rules.default !== undefined) clean[field] = rules.default;
        continue;
      }

      if (rules.type === 'string') {
        if (typeof val !== 'string') { errors.push(`"${field}" must be a string.`); continue; }
        val = val.trim();
        if (rules.maxLen && val.length > rules.maxLen) errors.push(`"${field}" must be under ${rules.maxLen} characters.`);
        if (rules.enum && !rules.enum.includes(val)) errors.push(`"${field}" must be one of: ${rules.enum.join(', ')}.`);
        if (rules.pattern && !rules.pattern.test(val)) errors.push(`"${field}" is not a valid format.`);
      } else if (rules.type === 'number') {
        val = Number(val);
        if (Number.isNaN(val)) { errors.push(`"${field}" must be a number.`); continue; }
        if (rules.min !== undefined && val < rules.min) errors.push(`"${field}" must be at least ${rules.min}.`);
        if (rules.max !== undefined && val > rules.max) errors.push(`"${field}" must be at most ${rules.max}.`);
      } else if (rules.type === 'boolean') {
        val = Boolean(val);
      }

      clean[field] = val;
    }

    if (errors.length) {
      return next(AppError.badRequest(errors.join(' '), 'VALIDATION_ERROR'));
    }
    req.validated = clean; // controllers read from here, never raw req.body
    next();
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = { validateBody, EMAIL_RE };
