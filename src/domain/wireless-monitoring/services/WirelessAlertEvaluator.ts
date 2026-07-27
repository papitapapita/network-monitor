import { WirelessMetrics } from '../value-objects';
import { WirelessAlertRecord } from '../aggregates';
import {
  AlertDecision,
  EvaluationContext,
  IWirelessAlertEvaluator
} from './IWirelessAlertEvaluator';
import { IAlertRule } from './rules/IAlertRule';

export type { AlertDecision, EvaluationContext };

export class WirelessAlertEvaluator
  implements IWirelessAlertEvaluator
{
  constructor(private readonly rules: IAlertRule[]) {}

  evaluate(
    metrics: WirelessMetrics,
    activeAlerts: Map<string, WirelessAlertRecord>,
    context: EvaluationContext
  ): AlertDecision[] {
    return this.rules.flatMap((rule) =>
      rule.evaluate(metrics, context, activeAlerts)
    );
  }
}
