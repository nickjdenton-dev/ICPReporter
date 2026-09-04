#!/usr/bin/env node
/* Regression: a failed file drop / paste must not commit RAW_BYTES or LAST_WB
   until processWorkbook has produced at least one sample. */
const fs=require('fs');
const path=require('path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');

function extract(fn){
  const start=html.indexOf('function '+fn+'(');
  if(start<0) throw new Error('missing function '+fn);
  const after=html.slice(start);
  const m=after.match(/^function[\s\S]*?\n\}\n/);
  if(!m) throw new Error('could not extract '+fn);
  return m[0];
}

let failed=0;
function assert(cond, msg){
  if(!cond){ failed++; console.error('FAIL:', msg); }
  else console.log('ok  ', msg);
}

const readFileSrc=extract('readFile');
const loadPastedSrc=extract('loadPasted');
const restoreImportSrc=extract('restoreImport');
const snapshotImportSrc=extract('snapshotImport');

function commitAfterParse(src, name){
  const parse=src.indexOf('processWorkbook(wb)');
  const commit=src.indexOf('RAW_BYTES=');
  assert(parse>=0, name+' calls processWorkbook');
  assert(commit>parse, name+' assigns RAW_BYTES only after processWorkbook');
  const clear=src.indexOf('clearReportBodies()');
  assert(clear>parse, name+' does not wipe report bodies until parse succeeds');
}

commitAfterParse(readFileSrc, 'readFile');
commitAfterParse(loadPastedSrc, 'loadPasted');

assert(readFileSrc.includes('snapshotImport()'), 'readFile snapshots before mutating');
assert(readFileSrc.includes('restoreImport(prev)'), 'readFile restores on failure');
assert(readFileSrc.includes('if(!SAMPLES.length)'), 'readFile rejects an empty parse');
assert(loadPastedSrc.includes('snapshotImport()'), 'loadPasted snapshots before mutating');
assert(loadPastedSrc.includes('restoreImport(prev)'), 'loadPasted restores on failure');
assert(restoreImportSrc.includes('preserveEdits:true'), 'restore keeps hand edits');

assert(!/lastFile\s*=\s*e\.target\.files/.test(html), 'file picker does not set lastFile before parse');
assert(!/lastFile\s*=\s*f;\s*readFile/.test(html), 'drop handlers do not set lastFile before parse');

// Behavioral: snapshot + restore put RAW_BYTES back after a parse that empties SAMPLES.
let RAW_BYTES='good-bytes', RAW_EXT='.xlsx', LAST_WB={good:1}, lastFile={name:'good.xlsx'};
let FINALIZED=true, USER_UNLOCKED=false, NOTICE_DISMISSED=true;
let SAMPLES=[{label:'run'}];
let processed=null, rendered=null;
function processWorkbook(wb){ processed=wb; SAMPLES=wb===LAST_WB?[{label:'run'}]:[]; }
function render(opts){ rendered=opts; }

eval(snapshotImportSrc+'\n'+restoreImportSrc);
const prev=snapshotImport();
processWorkbook({junk:1});
assert(!SAMPLES.length, 'bad parse emptied SAMPLES (the trigger)');
const restored=restoreImport(prev);
assert(restored===true, 'restoreImport reports success');
assert(RAW_BYTES==='good-bytes', 'RAW_BYTES restored');
assert(LAST_WB&&LAST_WB.good===1, 'LAST_WB restored');
assert(FINALIZED===true, 'FINALIZED restored');
assert(SAMPLES.length===1 && SAMPLES[0].label==='run', 'samples restored from previous workbook');
assert(rendered && rendered.preserveEdits===true, 'restore re-renders with preserved edits');

if(failed){ console.error('\n'+failed+' assertion(s) failed'); process.exit(1); }
console.log('\nall assertions passed');
