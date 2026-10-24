const MINOR_AGE_THRESHOLD = 18;

const toValidDate = (dateVal) => {
  if (!dateVal) return null;
  const date = dateVal instanceof Date ? dateVal : new Date(dateVal);
  return isNaN(date.getTime()) ? null : date;
};

const calculateAge = (dateOfBirth) => {
  const dob = toValidDate(dateOfBirth);
  if (!dob) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
};

/**
 * Calculates whether a given date of birth makes the user a minor.
 * Considers whether the birthday has occurred this year.
 * Safely accepts Date instances or date/ISO strings.
 * @param {Date|string} dateOfBirth
 * @returns {boolean} true if minor, false if adult or invalid
 */
const isMinor = (dateOfBirth) => {
  const age = calculateAge(dateOfBirth);
  if (age === null) return false;
  return age < MINOR_AGE_THRESHOLD;
};

/**
 * Validates a date of birth.
 * Must be a valid date and not in the future.
 * @param {string|Date} dateString
 * @returns {Date|null} Date object if valid, null if invalid
 */
const validateDateOfBirth = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;

  if (date > new Date()) return null; // No future dates

  return date;
};

const getAgeCategory = (dateOfBirth) => {
  const age = calculateAge(dateOfBirth);
  if (age === null || age >= 18) return 'ADULT';
  if (age >= 13) return 'MINOR_13_17';
  return 'MINOR_UNDER_13';
};

module.exports = {
  calculateAge,
  isMinor,
  validateDateOfBirth,
  MINOR_AGE_THRESHOLD,
  getAgeCategory
};
