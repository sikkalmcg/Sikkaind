/**
 * Validates a mobile number to ensure it contains exactly 10 digits.
 * @param mobileNumber The mobile number to validate.
 * @returns `true` if the mobile number is valid, `false` otherwise.
 */
export function isValidMobileNumber(mobileNumber: string): boolean {
  const mobileRegex = /^[0-9]{10}$/;
  return mobileRegex.test(mobileNumber);
}

/**
 * Validates an Indian vehicle registration number.
 * It supports standard formats like DL01LAC2190 and legacy formats like HP982145.
 * The function also cleans the input by converting it to uppercase and removing spaces/special characters.
 * @param vehicleNo The vehicle number to validate.
 * @returns The cleaned, valid vehicle number in uppercase, or `null` if the format is invalid.
 */
export function validateAndFormatVehicleNumber(vehicleNo: string): string | null {
  if (!vehicleNo) return null;

  // Convert to uppercase and remove spaces and special characters
  const cleanedVehicleNo = vehicleNo.toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Regex for Indian vehicle numbers: 2 letters, 2 digits, 1-3 letters, 4 digits
  // Or a legacy format with 2 letters, 2 digits, 4 digits.
  const vehicleRegex = /^[A-Z]{2}[0-9]{2}([A-Z]{1,3})?[0-9]{4}$/;

  return vehicleRegex.test(cleanedVehicleNo) ? cleanedVehicleNo : null;
}