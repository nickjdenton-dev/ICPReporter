#!/usr/bin/env node
/* Regression: a failed paste must restore wavelength picks / field overrides
   of the import already on screen, not just RAW_BYTES / LAST_WB.
   v5.18.19 re-ran processWorkbook on the previous file, which rebuilds
   SAMPLES with empty override maps, so reports "came back" on default lines. */
const fs=require('fs');
const path=require('path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');

function extract(fn){
  const start=html.indexOf('function '+fn+'(');
  if(start<0) throw new Error('missing function '+fn);
  let i=start, depth=0, started=false;
  for(;i<html.length;i++){
    const c=html[i];
    if(c==='{'){ depth++; started=true; }
    else if(c==='}'){ depth--; if(started && depth===0) return html.slice(start, i+1)+'\n'; }
  }
  throw new Error('could not extract '+fn);
}

let failed=0;
function assert(cond, msg){
  if(!cond){ failed++; console.error('FAIL:', msg); }
  else console.log('ok  ', msg);
}

const loadPastedSrc=extract('loadPasted');
const snapSrc=extract('snapshotReportState');
const restoreSrc=extract('restoreReportState');

const parse=loadPastedSrc.indexOf('processWorkbook(wb)');
const snapCall=loadPastedSrc.indexOf('snapshotReportState()');
const restoreCall=loadPastedSrc.indexOf('restoreReportState(snap)');
const catchIdx=loadPastedSrc.indexOf('}catch');
const clear=loadPastedSrc.indexOf('clearReportBodies()');

assert(parse>=0, 'loadPasted calls processWorkbook');
assert(snapCall>=0 && snapCall<parse, 'loadPasted snapshots report state before processWorkbook');
assert(restoreCall>catchIdx, 'loadPasted restores report state in the failure path');
assert(clear>parse, 'loadPasted does not wipe report bodies until parse succeeds');

// Behavioral: snapshot + restore put wavelength picks back after a rebuild
// that empties the override maps (what processWorkbook does).
let SAMPLES=[{
  label:'20436 nutrozen',
  type:'nutrozen',
  batch:'20436',
  wlOverrides:{'macro:P':'213.618'},
  fieldOverrides:{'macro:P:measured':'12.4'},
  hiddenTables:{heavy:true},
  macroDefs:[], additional:[], metalSpecs:[], row:[]
}];
function syncAllFieldOverrides(){}
function recomputeSample(s){ s.recomputed=true; }
const TYPE_OVERRIDES={};

eval(snapSrc+'\n'+restoreSrc);
const snap=snapshotReportState();
SAMPLES=[{
  label:'20436 nutrozen',
  type:'nutrozen',
  batch:'20436',
  wlOverrides:{},
  fieldOverrides:{},
  hiddenTables:{},
  macroDefs:[], additional:[], metalSpecs:[], row:[]
}];
restoreReportState(snap);
assert(SAMPLES[0].wlOverrides['macro:P']==='213.618', 'wavelength pick restored after rebuild');
assert(SAMPLES[0].fieldOverrides['macro:P:measured']==='12.4', 'hand-edited measured value restored');
assert(SAMPLES[0].hiddenTables.heavy===true, 'hidden-table flags restored when type is unchanged');
assert(SAMPLES[0].recomputed===true, 'sample recomputed with restored overrides');

if(failed){ console.error('\n'+failed+' assertion(s) failed'); process.exit(1); }
console.log('\nall assertions passed');
