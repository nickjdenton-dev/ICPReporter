#!/usr/bin/env node
/* Regression: render() used to call syncAllFieldOverrides() even when
   preserveEdits was false. The outgoing report DOM was still on screen, so a
   second file drop, a catalog-claim save, or a wavelength-mode switch copied
   the old measured/claim cells onto the incoming samples as fieldOverrides.
   The new numbers never appeared — and a later download exported the stale
   values. */
const fs=require('fs');
const path=require('path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');

let failed=0;
function assert(cond, msg){
  if(!cond){ failed++; console.error('FAIL:', msg); }
  else console.log('ok  ', msg);
}

const renderStart=html.indexOf('function render(opts)');
assert(renderStart>=0, 'render is present');
const renderEnd=html.indexOf('\nfunction ', renderStart+1);
const renderSrc=html.slice(renderStart, renderEnd);
assert(!/if\(SAMPLES\.length && reportEls\(\)\.length\) syncAllFieldOverrides\(\);/.test(renderSrc),
  'render does not sync field overrides from the outgoing DOM unconditionally');
assert(/if\(preserve && SAMPLES\.length && reportEls\(\)\.length\) captureReportBodies\(\);/.test(renderSrc),
  'live edits are still captured when preserveEdits is true');

const snapStart=html.indexOf('function snapshotReportState(');
assert(snapStart>=0, 'snapshotReportState is present');
const snapEnd=html.indexOf('\nfunction ', snapStart+1);
const snapSrc=html.slice(snapStart, snapEnd);
assert(/if\(opts\.fromDom!==false\) syncAllFieldOverrides\(\);/.test(snapSrc),
  'snapshotReportState can skip a DOM sync after claims were deliberately cleared');

const refreshStart=html.indexOf('function refreshCatalog(opts)');
assert(refreshStart>=0, 'refreshCatalog is present');
const refreshEnd=html.indexOf('\nfunction ', refreshStart+1);
const refreshSrc=html.slice(refreshStart, refreshEnd);
assert(/fromDom:opts\.catalogKey\?false:undefined/.test(refreshSrc),
  'catalog save reprocesses without reading stale claim cells back from the DOM');
assert(/syncAllFieldOverrides\(\);\s*clearSpecOverridesForCatalogKey/.test(refreshSrc),
  'catalog save captures other live edits before dropping claim overrides');

/* Behavioral model of setOverride (the helper inside syncFieldOverridesFromDom).
   Mirrors: new sample computed 8.10, outgoing report still showing 5.23. */
function setOverride(overrides, key, current, computed){
  const cur=String(current==null?'':current).trim();
  const base=String(computed==null?'':computed).trim();
  if(cur && cur!==base) overrides[key]=cur;
  else delete overrides[key];
}
function afterRender(syncFromOldDom){
  const overrides={};
  if(syncFromOldDom) setOverride(overrides, 'macro:P:measured', '5.23', '8.10');
  if(syncFromOldDom) setOverride(overrides, 'macro:P:claim', '5', '6');
  return overrides;
}

const buggy=afterRender(true);
assert(buggy['macro:P:measured']==='5.23',
  'stale DOM sync stamps the previous file\'s measured value onto the new sample');
assert(buggy['macro:P:claim']==='5',
  'stale DOM sync stamps the previous claim onto a catalog save / mode switch');

const fixed=afterRender(false);
assert(fixed['macro:P:measured']===undefined, 'skipping DOM sync keeps the new measured value');
assert(fixed['macro:P:claim']===undefined, 'skipping DOM sync keeps the new catalog claim');

if(failed){ console.error('\n'+failed+' assertion(s) failed'); process.exit(1); }
console.log('\nall assertions passed');
