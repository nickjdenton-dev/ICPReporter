#!/usr/bin/env node
/* Regression: after appendRow started reusing blank template rows, callers
   still remembered seen[key] = doc.rowCount()-1. That index is the LAST blank
   template row, not the row just written. A second sample with the same
   SampleType+Batch+Date+Element (empty batch on a same-day run is the usual
   trigger) then updateRow()'d every colliding analyte onto that one last row. */
const fs=require('fs');
const path=require('path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');

let failed=0;
function assert(cond, msg){
  if(!cond){ failed++; console.error('FAIL:', msg); }
  else console.log('ok  ', msg);
}

const appendStart=html.indexOf('appendRow: function (values)');
assert(appendStart>=0, 'appendRow is present');
const appendEnd=html.indexOf('setHeaders: function', appendStart);
const appendSrc=html.slice(appendStart, appendEnd);
assert(appendSrc.includes('return dataRows.indexOf(r);'),
  'reusing a blank row returns its dataRows index, not the Excel row number');
assert(/return dataAt < 0 \? dataRows\.length - 1 : dataAt;/.test(appendSrc),
  'inserting a new row returns its spliced dataRows index');
assert(!/return r\.n;/.test(appendSrc),
  'appendRow no longer returns the Excel row number');

assert(!/seen\[rowKey\]=doc\.rowCount\(\)-1/.test(html),
  'commitToTracker does not remember rowCount()-1');
assert(!/seen\[key\]=doc\.rowCount\(\)-1/.test(html),
  'importTrackerHistory does not remember rowCount()-1');
assert(/const idx=doc\.appendRow\(cells\);\s*if\(rowKey\) seen\[rowKey\]=idx;/.test(html),
  'commitToTracker stores the index appendRow returns');
assert(/const idx=doc\.appendRow\(cells\); if\(key\) seen\[key\]=idx;/.test(html),
  'importTrackerHistory stores the index appendRow returns');

/* Behavioral model of the seen-map contract against a template with trailing
   blank rows. Mirrors commitToTracker: unique keys append, duplicate keys
   updateRow the remembered index. */
function cell(v){ return {v:v}; }
function applyValues(r, values){
  for(const k in values) r.cells[k]=cell(values[k]);
}
function runCommit(remember){
  const dataRows=[];
  for(let n=2;n<=12;n++){
    const cells = n<=3 ? {0:cell('Allure'), 1:cell(n===2?'N':'P'), 2:cell(n===2?1.1:2.2)} : {};
    dataRows.push({n, cells});
  }
  const hasValue=r=>Object.keys(r.cells).some(k=>String(r.cells[k].v==null?'':r.cells[k].v).trim()!=='');
  const seen={};
  function write(key, values){
    if(seen[key]!==undefined){
      applyValues(dataRows[seen[key]], values);
      return;
    }
    const r=dataRows.find(x=>!hasValue(x));
    applyValues(r, values);
    seen[key]=remember(dataRows, r);
  }
  write('allure||n', {0:'Allure',1:'N',2:3.3});
  write('allure||p', {0:'Allure',1:'P',2:4.4});
  write('allure||n', {0:'Allure',1:'N',2:5.5});
  write('allure||p', {0:'Allure',1:'P',2:6.6});
  return dataRows;
}

const buggy=runCommit((rows)=>rows.length-1);
const lastBuggy=buggy[buggy.length-1].cells;
assert(lastBuggy[1].v==='P' && lastBuggy[2].v===6.6,
  'buggy rowCount()-1 smashes colliding analytes onto the last template row');
assert(buggy[2].cells[2].v===3.3,
  'buggy path leaves the first new N un-updated (second sample never finds it)');

const fixed=runCommit((rows, r)=>rows.indexOf(r));
assert(fixed[2].cells[2].v===5.5, 'fixed path updates the first new N in place');
assert(fixed[3].cells[2].v===6.6, 'fixed path updates the first new P in place');
assert(Object.keys(fixed[fixed.length-1].cells).length===0,
  'fixed path leaves trailing template blanks empty');

if(failed){ console.error('\n'+failed+' assertion(s) failed'); process.exit(1); }
console.log('\nall assertions passed');
