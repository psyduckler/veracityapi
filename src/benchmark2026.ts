export const BENCHMARK_2026 = {
  status: "gated_pending_run",
  runId: "2026-05-benchmark-v1",
  publishedAt: "pending",
  textSampleCount: 1000,
  imageSampleCount: 120,
  audioSampleCount: 80,
  methodologyUrl: "https://github.com/psyduckler/veracity-bench",
  localRepoPath: "/Users/psy/projects/veracity-bench",
  gates: ["Vendor ToS/legal review", "Corpus licensing validation", "Budget + credentials", "Frozen metrics artifacts"],
  weaknesses: ["English-first text calibration is stronger than non-English coverage.", "Image/audio scoring is workflow triage, not forensic provenance verification."],
  caveat: "No benchmark numbers are published until the run is complete, frozen, cited, and legally cleared.",
} as const;
