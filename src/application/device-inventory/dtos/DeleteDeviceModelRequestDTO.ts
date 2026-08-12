export interface DeleteDeviceModelRequestDTO {
  id: string;
  // Opt-in confirmation. Absent, a model whose only remaining devices sit in
  // the recycle bin is refused rather than silently emptying the bin.
  purgeBinnedDevices?: boolean;
}
