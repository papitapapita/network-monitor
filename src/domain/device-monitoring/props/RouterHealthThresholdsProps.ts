// The limits a MikroTik's health is judged against (MON-172). minVoltage is
// null while the operator has not set one: boards differ too much (12, 24,
// 48 V) for a default.
export interface RouterHealthThresholdsProps {
  cpuPercent: number;
  minFreeMemoryPercent: number;
  minFreeDiskPercent: number;
  maxTemperatureC: number;
  minVoltage: number | null;
}
