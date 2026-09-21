/**
 * Custom Validation Utility for MentorConnect
 * Lightweight validation without external dependencies.
 */

class ValidationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ValidationError';
  }
}

const validators = {
  // Check if value is empty or whitespace only
  isEmpty: (value) => !value || (typeof value === 'string' && !value.trim()),

  // Validate email format
  isValidEmail: (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  },

  // Validate password strength (min 6 chars)
  isValidPassword: (password) => {
    return password && password.length >= 6;
  },

  // Validate date string (ISO or YYYY-MM-DD)
  isValidDate: (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  },

  // Validate time format (HH:MM)
  isValidTime: (timeString) => {
    const re = /^([01]\d|2[0-3]):([0-5]\d)$/;
    return re.test(timeString);
  },

  // Validate positive number
  isPositiveNumber: (value) => {
    const num = parseFloat(value);
    return !isNaN(num) && num > 0;
  },

  // Validate non-negative number
  isNonNegativeNumber: (value) => {
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0;
  },

  // Validate enum values
  isValidEnum: (value, allowedValues) => {
    return allowedValues.includes(value);
  },

  // Validate day of week
  isValidDayOfWeek: (day) => {
    const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    return days.includes(day.toUpperCase());
  }
};

/**
 * Middleware factory to validate request body against a schema
 * @param {Object} schema - Validation rules object
 * @returns {Function} Express middleware
 */
const validate = (schema) => {
  return (req, res, next) => {
    try {
      const errors = [];
      const data = req.body;

      Object.keys(schema).forEach((field) => {
        const rules = schema[field];
        const value = data[field];

        // Required check
        if (rules.required && validators.isEmpty(value)) {
          errors.push(`${field} is required.`);
          return;
        }

        // Skip further validation if optional and empty
        if (!rules.required && validators.isEmpty(value)) {
          return;
        }

        // Type/Format checks
        if (value) {
          if (rules.type === 'email' && !validators.isValidEmail(value)) {
            errors.push(`${field} must be a valid email address.`);
          }
          if (rules.type === 'password' && !validators.isValidPassword(value)) {
            errors.push(`${field} must be at least 6 characters long.`);
          }
          if (rules.type === 'date' && !validators.isValidDate(value)) {
            errors.push(`${field} must be a valid date.`);
          }
          if (rules.type === 'time' && !validators.isValidTime(value)) {
            errors.push(`${field} must be in HH:MM format.`);
          }
          if (rules.type === 'positiveNumber' && !validators.isPositiveNumber(value)) {
            errors.push(`${field} must be a positive number.`);
          }
          if (rules.type === 'nonNegativeNumber' && !validators.isNonNegativeNumber(value)) {
            errors.push(`${field} must be a non-negative number.`);
          }
          if (rules.enum && !validators.isValidEnum(value, rules.enum)) {
            errors.push(`${field} must be one of: ${rules.enum.join(', ')}.`);
          }
          if (rules.custom && typeof rules.custom === 'function') {
            const customError = rules.custom(value, data);
            if (customError) errors.push(customError);
          }
        }
      });

      if (errors.length > 0) {
        throw new ValidationError(errors.join(' '));
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = {
  ValidationError,
  validate,
  validators
};
