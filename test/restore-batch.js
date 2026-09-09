#!/usr/bin/env node
/* Regression: restoreReportState must put a hand-edited batch number back
   after processWorkbook rebuilds SAMPLES from the instrument label.
   Changing wavelength mode, saving a catalog type, or confirming a sample
   type all call reprocessLast → snapshot → processWorkbook → restore.
   The snapshot stored batch but restore skipped it, so the next tracker
   commit wrote the original (wrong) batch. Type must still NOT be restored
   — that undid "change sample type" (Evergreen Org from NaNO3 → Evergreen Org). */
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

const restoreSrc=extract('restoreReportState');
assert(/saved\.batch!==undefined/.test(restoreSrc)
    || /saved\.batch !== undefined/.test(restoreSrc)
    || /s\.batch=saved\.batch/.test(restoreSrc),
  'restoreReportState assigns saved.batch onto the rebuilt sample');
assert(!/Do not restore type\/batch/.test(restoreSrc),
  'comment no longer lumps batch with the type-restore skip');

function syncAllFieldOverrides(){}
function recomputeSample(s){ s.recomputed=true; }
const TYPE_OVERRIDES={};

eval(extract('snapshotReportState')+'\n'+restoreSrc);

// 1) Hand-edited batch must survive a label rebuild (wavelength-mode change).
let SAMPLES=[{
  label:'20436 nutrozen',
  type:'nutrozen',
  batch:'20499',
  wlOverrides:{'macro:P':'213.618'},
  fieldOverrides:{'macro:P:measured':'12.4'},
  hiddenTables:{heavy:true},
  macroDefs:[], additional:[], metalSpecs:[], row:[]
}];
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
assert(SAMPLES[0].batch==='20499', 'hand-edited batch restored after label rebuild');
assert(SAMPLES[0].wlOverrides['macro:P']==='213.618', 'wavelength pick still restored');
assert(SAMPLES[0].fieldOverrides['macro:P:measured']==='12.4', 'field override still restored');
assert(SAMPLES[0].hiddenTables.heavy===true, 'hidden-table flags restored when type is unchanged');

// 2) Clearing the batch cell (empty string) must also survive.
SAMPLES=[{
  label:'20436 nutrozen', type:'nutrozen', batch:'',
  wlOverrides:{}, fieldOverrides:{}, hiddenTables:{},
  macroDefs:[], additional:[], metalSpecs:[], row:[]
}];
const snapEmpty=snapshotReportState();
SAMPLES=[{
  label:'20436 nutrozen', type:'nutrozen', batch:'20436',
  wlOverrides:{}, fieldOverrides:{}, hiddenTables:{},
  macroDefs:[], additional:[], metalSpecs:[], row:[]
}];
restoreReportState(snapEmpty);
assert(SAMPLES[0].batch==='', 'cleared batch stays cleared after rebuild');

// 3) Type must still come from the rebuilt sample, not the snapshot.
//    chooseType sets TYPE_OVERRIDES then reprocessLast; snapshot still has
//    the old display name from the DOM.
SAMPLES=[{
  label:'19700 Evergreen Org from NaNO3',
  type:'Evergreen Org from NaNO3',
  batch:'19700',
  wlOverrides:{}, fieldOverrides:{}, hiddenTables:{heavy:true},
  macroDefs:[], additional:[], metalSpecs:[], row:[]
}];
const snapType=snapshotReportState();
TYPE_OVERRIDES['19700 Evergreen Org from NaNO3']='Evergreen Org';
SAMPLES=[{
  label:'19700 Evergreen Org from NaNO3',
  type:'Evergreen Org from NaNO3',
  batch:'19700',
  wlOverrides:{}, fieldOverrides:{}, hiddenTables:{},
  macroDefs:[], additional:[], metalSpecs:[], row:[]
}];
restoreReportState(snapType);
assert(SAMPLES[0].type==='Evergreen Org from NaNO3',
  'display type is not overwritten by the snapshot');
assert(SAMPLES[0].hiddenTables.heavy!==true,
  'hidden tables are not restored when TYPE_OVERRIDES is set (type change)');

if(failed){ console.error('\n'+failed+' assertion(s) failed'); process.exit(1); }
console.log('\nall assertions passed');
