import { WirelessMetrics, WirelessAlertRecord } from 'domain/wireless-monitoring';
import { AlertDecision, EvaluationContext } from '../services/WirelessAlertEvaluator';

/**
 * Application-layer abstraction for the wireless alert evaluation service.
 *
 * Decouples use cases from the concrete WirelessAlertEvaluator class,
 * satisfying the Dependency Inversion Principle.
 */
export interface IWirelessAlertEvaluator {
  evaluate(
    metrics: WirelessMetrics,
    activeAlerts: Map<string, WirelessAlertRecord>,
    context: EvaluationContext
  ): AlertDecision[];
}
