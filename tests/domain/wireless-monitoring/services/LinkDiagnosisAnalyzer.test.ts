import { LinkDiagnosisAnalyzer } from '../../../../src/domain/wireless-monitoring/services/LinkDiagnosisAnalyzer';
import {
  LinkDiagnosisInput,
  RadioDecisionTally
} from '../../../../src/domain/wireless-monitoring/services/ILinkDiagnosisAnalyzer';
import { PingStatistics } from '../../../../src/domain/wireless-monitoring/value-objects/PingStatistics';

const healthy = (n = 10): PingStatistics =>
  PingStatistics.fromReplies(Array(n).fill(5));

function makeInput(
  overrides: Partial<LinkDiagnosisInput> = {}
): LinkDiagnosisInput {
  return {
    deviceName: 'CPE-Juan',
    parentName: 'AP-Norte',
    target: healthy(),
    parent: healthy(),
    radioSamples: 5,
    radioFailures: 0,
    radioDecisions: [],
    ...overrides
  };
}

function tally(
  metric: string,
  severity: 'WARNING' | 'CRITICAL',
  occurrences: number
): RadioDecisionTally {
  return {
    occurrences,
    decision: {
      metric,
      action: 'OPEN',
      severity,
      currentValue: -80,
      threshold: -75,
      message: `${metric} ${severity}`
    }
  };
}

describe('LinkDiagnosisAnalyzer', () => {
  const analyzer = new LinkDiagnosisAnalyzer();

  describe('[WLS-189] verdict', () => {
    it('should be HEALTHY with no findings and no fault', () => {
      const result = analyzer.analyze(makeInput());

      expect(result.verdict).toBe('HEALTHY');
      expect(result.faultLocation).toBe('NONE');
      expect(result.findings).toEqual([]);
      expect(result.summary).toContain('Sin anomalías');
    });

    it('should be INCONCLUSIVE with fewer than 3 probes and no radio sample', () => {
      const result = analyzer.analyze(
        makeInput({
          target: PingStatistics.fromReplies([null, null]),
          radioSamples: 0
        })
      );

      expect(result.verdict).toBe('INCONCLUSIVE');
      expect(result.findings).toEqual([]);
    });

    it('should be DEGRADED when only warnings are found', () => {
      const result = analyzer.analyze(
        makeInput({
          target: PingStatistics.fromReplies([
            ...Array(49).fill(5),
            null
          ])
        })
      );

      expect(result.verdict).toBe('DEGRADED');
    });

    it('should be FAILING when any finding is critical', () => {
      const result = analyzer.analyze(
        makeInput({
          target: PingStatistics.fromReplies([null, null, null])
        })
      );

      expect(result.verdict).toBe('FAILING');
    });
  });

  describe('[WLS-187] ping findings', () => {
    it('should report an unreachable target as a single critical finding', () => {
      const result = analyzer.analyze(
        makeInput({
          target: PingStatistics.fromReplies([null, null, null])
        })
      );

      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]).toMatchObject({
        code: 'unreachable',
        hop: 'TARGET',
        severity: 'CRITICAL'
      });
      expect(result.findings[0]!.message).toContain('CPE-Juan');
    });

    it.each([
      [1, null],
      [2, 'WARNING'],
      [9, 'WARNING'],
      [10, 'CRITICAL']
    ])('should grade %i%% packet loss as %s', (lost, severity) => {
      const replies = [
        ...Array(100 - lost).fill(5),
        ...Array(lost).fill(null)
      ];
      const result = analyzer.analyze(
        makeInput({ target: PingStatistics.fromReplies(replies) })
      );
      const loss = result.findings.find(
        (f) => f.code === 'packet_loss'
      );

      expect(loss?.severity ?? null).toBe(severity);
    });

    it.each([
      [50, null],
      [51, 'WARNING'],
      [151, 'CRITICAL']
    ])('should grade an average of %i ms as %s', (ms, severity) => {
      const result = analyzer.analyze(
        makeInput({
          target: PingStatistics.fromReplies(Array(10).fill(ms))
        })
      );
      const latency = result.findings.find(
        (f) => f.code === 'high_latency'
      );

      expect(latency?.severity ?? null).toBe(severity);
    });

    it('should report spikes when the average still looks fine', () => {
      // 1 spike in 20 replies = 5%; average (19*5 + 200) / 20 = 14.75 ms
      const result = analyzer.analyze(
        makeInput({
          target: PingStatistics.fromReplies([
            ...Array(19).fill(5),
            200
          ])
        })
      );

      expect(result.findings.map((f) => f.code)).toContain(
        'latency_spikes'
      );
      expect(result.findings.map((f) => f.code)).not.toContain(
        'high_latency'
      );
    });

    it('should not report spikes separately once the average is high', () => {
      const result = analyzer.analyze(
        makeInput({
          target: PingStatistics.fromReplies(Array(10).fill(200))
        })
      );

      expect(result.findings.map((f) => f.code)).toEqual([
        'high_latency'
      ]);
    });

    it('should warn on jitter above 30 ms', () => {
      const result = analyzer.analyze(
        makeInput({
          target: PingStatistics.fromReplies([5, 45, 5, 45, 5, 45])
        })
      );

      expect(
        result.findings.find((f) => f.code === 'jitter')
      ).toMatchObject({ severity: 'WARNING', value: 40 });
    });

    it('should ignore a parent hop with fewer than 3 probes', () => {
      const result = analyzer.analyze(
        makeInput({
          parent: PingStatistics.fromReplies([null, null])
        })
      );

      expect(result.findings).toEqual([]);
    });
  });

  describe('[WLS-188] radio findings', () => {
    it('should keep a rule that held for at least half the samples', () => {
      const result = analyzer.analyze(
        makeInput({
          radioSamples: 4,
          radioDecisions: [tally('signal_rx_dbm', 'WARNING', 2)]
        })
      );

      expect(result.findings).toEqual([
        expect.objectContaining({
          code: 'signal_rx_dbm',
          hop: 'RADIO',
          severity: 'WARNING'
        })
      ]);
    });

    it('should drop a rule that held for fewer than half the samples', () => {
      const result = analyzer.analyze(
        makeInput({
          radioSamples: 5,
          radioDecisions: [tally('signal_rx_dbm', 'WARNING', 2)]
        })
      );

      expect(result.findings).toEqual([]);
    });

    it('should report only the critical level when both levels held', () => {
      const result = analyzer.analyze(
        makeInput({
          radioSamples: 4,
          radioDecisions: [
            tally('snr_db', 'WARNING', 4),
            tally('snr_db', 'CRITICAL', 3)
          ]
        })
      );

      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]!.severity).toBe('CRITICAL');
    });

    it('should report an unreadable radio when every read failed', () => {
      const result = analyzer.analyze(
        makeInput({ radioSamples: 0, radioFailures: 3 })
      );

      expect(result.findings).toEqual([
        expect.objectContaining({
          code: 'radio_unreadable',
          severity: 'WARNING'
        })
      ]);
      expect(result.faultLocation).toBe('UNDETERMINED');
    });

    it('should not add radio_unreadable when the target is unreachable anyway', () => {
      const result = analyzer.analyze(
        makeInput({
          target: PingStatistics.fromReplies([null, null, null]),
          radioSamples: 0,
          radioFailures: 3
        })
      );

      expect(result.findings.map((f) => f.code)).toEqual([
        'unreachable'
      ]);
    });
  });

  describe('[WLS-189] fault location', () => {
    const lossy = PingStatistics.fromReplies([
      ...Array(8).fill(5),
      null,
      null
    ]);

    it('should blame upstream when the parent AP is also failing', () => {
      const result = analyzer.analyze(
        makeInput({ target: lossy, parent: lossy })
      );

      expect(result.faultLocation).toBe('UPSTREAM');
      expect(result.summary).toContain('AP-Norte');
      expect(
        result.findings.filter((f) => f.hop === 'PARENT')
      ).not.toHaveLength(0);
    });

    it('should blame the target link when the parent AP is healthy', () => {
      const result = analyzer.analyze(makeInput({ target: lossy }));

      expect(result.faultLocation).toBe('TARGET_LINK');
      expect(result.summary).toContain(
        'AP-Norte responde con normalidad'
      );
    });

    it('should blame the target link for a CPE down behind a healthy AP', () => {
      const result = analyzer.analyze(
        makeInput({
          target: PingStatistics.fromReplies([null, null, null]),
          radioSamples: 0,
          radioFailures: 2
        })
      );

      expect(result.faultLocation).toBe('TARGET_LINK');
    });

    it('should be UNDETERMINED for bad pings with no parent and no radio fault', () => {
      const result = analyzer.analyze(
        makeInput({ target: lossy, parent: null })
      );

      expect(result.faultLocation).toBe('UNDETERMINED');
    });

    it('should blame the target link for bad pings with no parent but a radio fault', () => {
      const result = analyzer.analyze(
        makeInput({
          target: lossy,
          parent: null,
          radioSamples: 2,
          radioDecisions: [tally('signal_rx_dbm', 'CRITICAL', 2)]
        })
      );

      expect(result.faultLocation).toBe('TARGET_LINK');
      expect(result.summary).not.toContain('responde con normalidad');
    });

    it('should blame the target link for radio-only findings', () => {
      const result = analyzer.analyze(
        makeInput({
          radioSamples: 2,
          radioDecisions: [tally('ccq_percent', 'WARNING', 2)]
        })
      );

      expect(result.faultLocation).toBe('TARGET_LINK');
    });

    it('should fall back to a generic AP label when the parent has no name', () => {
      const result = analyzer.analyze(
        makeInput({ target: lossy, parent: lossy, parentName: null })
      );

      expect(result.summary).toMatch(
        /^El AP también presenta fallas/
      );
    });
  });
});
