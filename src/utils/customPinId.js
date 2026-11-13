let customPinSequence = 0;

export function createCustomPinId(prefix, latitude, longitude) {
  customPinSequence += 1;
  return `${prefix}-${latitude.toFixed(7)}-${longitude.toFixed(7)}-${customPinSequence}`;
}
