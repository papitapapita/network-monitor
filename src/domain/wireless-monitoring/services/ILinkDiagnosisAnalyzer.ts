import { PingStatistics } from '../value-objects';
import { AlertDecision } from './IWirelessAlertEvaluator';

export type DiagnosisHop = 'TARGET' | 'PARENT' | 'RADIO';

export type DiagnosisSeverity = 'WARNING' | 'CRITICAL';

export type DiagnosisVerdict =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'FAILING'
  | 'INCONCLUSIVE';

// TARGET_LINK: the diagnosed radio or its own link; UPSTREAM: the parent AP
// or the backhaul behind it
export type FaultLocation =
  | 'NONE'
  | 'TARGET_LINK'
  | 'UPSTREAM'
  | 'UNDETERMINED';

export interface DiagnosisFinding {
  code: string;
  hop: DiagnosisHop;
  severity: DiagnosisSeverity;
  value: number | null;
  threshold: number | null;
  message: string;
}

export interface RadioDecisionTally {
  decision: AlertDecision;
  occurrences: number;
}

export interface LinkDiagnosisInput {
  deviceName: string;
  parentName: string | null;
  target: PingStatistics;
  parent: PingStatistics | null;
  radioSamples: number;
  radioFailures: number;
  radioDecisions: RadioDecisionTally[];
}

export interface LinkDiagnosisResult {
  verdict: DiagnosisVerdict;
  faultLocation: FaultLocation;
  summary: string;
  findings: DiagnosisFinding[];
}

export interface ILinkDiagnosisAnalyzer {
  analyze(input: LinkDiagnosisInput): LinkDiagnosisResult;
}
