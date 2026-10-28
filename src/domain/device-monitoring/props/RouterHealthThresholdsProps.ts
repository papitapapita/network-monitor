// The limits a MikroTik's health is judged against (MON-172). minVoltage is
// null while the operator has not set one: boards differ too much (12, 24,
// 48 V) for a default.
export interface RouterHealthThresholdsProps {
  cpuPercent: number;
  minFreeMemoryPercent: number;
  minFreeDiskPercent: number;
  maxTemperatureC: number;
  minVoltage: number | null;
  // MON-194: link-downs in one check that make a port flapping
  flapLinkDowns: number;
  // MON-195: null switches the fibre power alert off
  minSfpRxPowerDbm: number | null;
}
