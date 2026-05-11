#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const corpusPath = path.resolve('data/evals/veracityapi_seed_corpus_500.jsonl');
const rows = fs.readFileSync(corpusPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
const labels = ['allow', 'revise', 'human_review', 'reject'];
const confusion = Object.fromEntries(labels.map((label) => [label, Object.fromEntries(labels.map((inner) => [inner, 0]))]));
for (const row of rows) confusion[row.expected_action][row.veracityapi_v0_1_action] += 1;
const perAction = labels.map((label) => {
  const tp = confusion[label][label];
  const fp = labels.filter((x) => x !== label).reduce((sum, x) => sum + confusion[x][label], 0);
  const fn = labels.filter((x) => x !== label).reduce((sum, x) => sum + confusion[label][x], 0);
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { action: label, precision: Number(precision.toFixed(3)), recall: Number(recall.toFixed(3)), f1: Number(f1.toFixed(3)), support: labels.reduce((sum, x) => sum + confusion[label][x], 0) };
});
const correct = labels.reduce((sum, label) => sum + confusion[label][label], 0);
const supported = perAction.filter((row) => row.support > 0);
const summary = {
  benchmark: 'veracityapi_seed_corpus_500',
  version: '0.1.0',
  sample_count: rows.length,
  routing_action_accuracy: Number((correct / rows.length).toFixed(3)),
  macro_f1: Number((supported.reduce((sum, row) => sum + row.f1, 0) / supported.length).toFixed(3)),
  confusion_matrix: confusion,
  per_action: perAction,
  external_comparators: { gptzero: 'not_run_no_key', sapling: 'not_run_no_key', gpt_4o_judge: 'not_run_no_key' },
  framing: 'routing-action F1, not AI-authorship proof',
};
console.log(JSON.stringify(summary, null, 2));
