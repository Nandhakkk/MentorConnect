export const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

export const getAgeCategory = (dateOfBirth) => {
  const age = calculateAge(dateOfBirth);
  if (age === null || age >= 18) return 'ADULT';
  if (age >= 13) return 'MINOR_13_17';
  return 'MINOR_UNDER_13';
};
