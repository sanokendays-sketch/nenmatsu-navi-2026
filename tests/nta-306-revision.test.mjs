import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateSalaryIncome} from '../src/calculations.js';

// Transcribed from 306.pdf p.2, fetched 2026-10-14 (HTTP Last-Modified: 2026-10-05).
// SHA-256: 8d3e7b6a7f4bb0c5fec36f2706973854bb434e11a6e484787f8e50f107819bd6
for(const [revenue,income] of [[2195999,1453000],[2196000,1456000],[2199999,1456000],[2200000,1460000]]){
 test(`NTA revised 306 salary table: ${revenue} -> ${income}`,()=>{
  assert.equal(calculateSalaryIncome(revenue),income);
 });
}
