const MINOR_AGE_THRESHOLD = 18;

/**
 * Calculates whether a given date of birth makes the user a minor.
 * Considers whether the birthday has occurred this year.
 * @param {Date} dateOfBirth 
 * @returns {boolean} true if minor, false if adult
 */
const isMinor = (dateOfBirth) => {
  if (!dateOfBirth) return false;
  
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  
  const m = today.getMonth() - dateOfBirth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dateOfBirth.getDate())) {
    age--;
  }
  
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

module.exports = {
  isMinor,
  validateDateOfBirth,
  MINOR_AGE_THRESHOLD
};
