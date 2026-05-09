#!/usr/bin/env node
// Stage 1D-B · Verifies that canonical DB stage files in db/<stage>/ are
// byte-identical to their install copies under supabase/. Fails non-zero on
// any mismatch.

import { readFileSync, existsSync } from "node:fs";
import { resolve, relative } from "node:path";
import { STAGE1C_BYTE_IDENTITY_PAIRS } from "./forbidden-patterns.mjs";

const ROOT = process.cwd();
let bad = 0;

for (const [a, b] of STAGE1C_BYTE_IDENTITY_PAIRS) {
  const ap = resolve(ROOT, a);
  const bp = resolve(ROOT, b);
  if (!existsSync(ap)) {
    console.error(`MISSING canonical: ${a}`);
    bad++; continue;
  }
  if (!existsSync(bp)) {
    console.error(`MISSING install:   ${b}`);
    bad++; continue;
  }
  const av = readFileSync(ap);
  const bv = readFileSync(bp);
  if (!av.equals(bv)) {
    console.error(`DIFFER: ${relative(ROOT, ap)}  vs  ${relative(ROOT, bp)}`);
    bad++;
  }
}

if (bad > 0) {
  console.error(`\n[check-canonical-install-identity] ${bad} mismatch(es).`);
  process.exit(1);
}
console.log(`[check-canonical-install-identity] ${STAGE1C_BYTE_IDENTITY_PAIRS.length} pair(s) OK.`);
