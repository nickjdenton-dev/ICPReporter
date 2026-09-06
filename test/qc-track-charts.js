#!/usr/bin/env node
/* Regression: QC-tracking flags must reach QcCharts. Qualification (and any
   unticked table) still commits to All Data but must not plot. */
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

const pointsSrc=extract('pointsFor');
const kindSrc=extract('trkTableKind');
const chartedSrc=extract('trkRowIsCharted');

assert(html.includes('.trkRowIsCharted=trkRowIsCharted'),
  'trkRowIsCharted is installed on the global for QcCharts');
assert(pointsSrc.includes('global.trkRowIsCharted'),
  'pointsFor reads the QC-tracking hook');
assert(/chartedFn && cols\.Table !== undefined && !chartedFn\(product, r\[cols\.Table\]\)/.test(pointsSrc),
  'pointsFor skips a row whose table is not QC-tracked');
assert(html.includes("'icpQcTracked'") && /BACKUP_KEYS=\[/.test(html) && html.includes("'icpQcTracked'"),
  'backup includes icpQcTracked so a restore does not drop the flags');

eval(kindSrc);
assert(trkTableKind('Macro')==='macro', 'Macro -> macro');
assert(trkTableKind('Micro')==='micro', 'Micro -> micro');
assert(trkTableKind('Qualification')==='qual', 'Qualification -> qual');
assert(trkTableKind('Heavy Metal')==='qual', 'legacy Heavy Metal -> qual');
assert(trkTableKind('unknown')==='macro', 'unrecognised table stays tracked');

function qcTrackFor(product){
  if(product==='OffQual') return {macro:true, micro:true, qual:false};
  if(product==='NoMacro') return {macro:false, micro:true, qual:true};
  return {macro:true, micro:true, qual:false};
}
eval(chartedSrc);
assert(trkRowIsCharted('OffQual','Macro')===true, 'default-on Macro is charted');
assert(trkRowIsCharted('OffQual','Qualification')===false, 'Qualification is not charted by default');
assert(trkRowIsCharted('OffQual','Heavy Metal')===false, 'legacy Heavy Metal follows qual flag');
assert(trkRowIsCharted('NoMacro','Macro')===false, 'unticked Macro is not charted');
assert(trkRowIsCharted('NoMacro','Qualification')===true, 'ticked Qualification is charted');

// Behavioral: pointsFor must omit Qualification measured values when the hook says no.
const global={
  trkRowIsCharted,
  trkElSymbol: function(el){
    const m=/\(([A-Za-z]{1,2})\)/.exec(String(el||''));
    return m?m[1]:'';
  },
  trkCanonElementForType: function(_p, el){ return el; },
  trkCatalogKeyForType: function(t){ return String(t||'').toLowerCase(); },
  trkClaimNum: function(){ return null; },
  trkUnifiedClaimForElement: function(){ return null; }
};
eval(extract('num')+extract('dateKey')+pointsSrc);

const cols={Date:0, SampleType:1, Element:2, Measured:3, LabelClaim:4, Table:5};
const rows=[
  ['2026-09-01','OffQual','Phosphorus (P2O5)',12.4,10,'Macro'],
  ['2026-09-01','OffQual','Arsenic (As)',0.002,'','Qualification'],
  ['2026-09-01','NoMacro','Phosphorus (P2O5)',11.1,10,'Macro'],
  ['2026-09-01','NoMacro','Arsenic (As)',0.003,'','Qualification']
];
const off=pointsFor(rows, cols, 'OffQual', ['Phosphorus (P2O5)','Arsenic (As)'], ['OffQual']);
assert((off['phosphorus (p2o5)']||[]).length===1, 'OffQual still plots Macro P');
assert((off['arsenic (as)']||[]).length===0, 'OffQual does not plot Qualification As');

const on=pointsFor(rows, cols, 'NoMacro', ['Phosphorus (P2O5)','Arsenic (As)'], ['NoMacro']);
assert((on['phosphorus (p2o5)']||[]).length===0, 'NoMacro does not plot unticked Macro P');
assert((on['arsenic (as)']||[]).length===1, 'NoMacro plots ticked Qualification As');

const noTable={Date:0, SampleType:1, Element:2, Measured:3, LabelClaim:4};
const legacy=pointsFor(rows, noTable, 'OffQual', ['Arsenic (As)'], ['OffQual']);
assert((legacy['arsenic (as)']||[]).length===1,
  'a tracker without a Table column still plots (cannot classify)');

if(failed){ console.error('\n'+failed+' assertion(s) failed'); process.exit(1); }
console.log('\nall assertions passed');
