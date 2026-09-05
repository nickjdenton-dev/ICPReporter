#!/usr/bin/env node
/* Regression: hand-edited Sample Type / Batch must sync from plain cell text,
   and typing a still-unknown type must not clear the error or load claims. */
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

const syncSrc=extract('syncFieldOverridesFromDom');
const sampleTypeCellSrc=extract('sampleTypeCell');
const acceptSrc=extract('acceptTypeFromCellEdit');
const flushSrc=extract('flushPendingTypeReprocess');
const prepareSrc=extract('prepareReportsForExport');

assert(syncSrc.includes("T('lblSampleType')") && syncSrc.includes("T('lblBatch')"),
  'syncFieldOverridesFromDom matches T() plain labels, not te() HTML');
assert(!/const typeLbl=te\(/.test(syncSrc) && !/const batchLbl=te\(/.test(syncSrc),
  'syncFieldOverridesFromDom does not compare against te() HTML');
assert(sampleTypeCellSrc.includes("T('lblSampleType')"),
  'sampleTypeCell fallback matches T() plain label');
assert(!sampleTypeCellSrc.includes("te('lblSampleType')"),
  'sampleTypeCell does not use te()');

assert(acceptSrc.includes('{explicit:true}'),
  'acceptTypeFromCellEdit uses explicit catalog lookup (no fuzzy borrow)');
assert(acceptSrc.includes('return false'),
  'acceptTypeFromCellEdit refuses to resolve an unknown name');
assert(acceptSrc.includes('PENDING_TYPE_REPROCESS'),
  'acceptTypeFromCellEdit defers reprocess (does not rebuild mid-keystroke)');
assert(flushSrc.includes('rerenderResolvedType'),
  'flushPendingTypeReprocess reloads claims via rerenderResolvedType');
assert(prepareSrc.includes('flushPendingTypeReprocess()'),
  'export flushes a pending type resolve so the download has the new claims');
assert(html.includes('flushPendingTypeReprocess()'),
  'focusout / export path calls flushPendingTypeReprocess');

// Behavioral: unknown name keeps the error; exact catalog hit sets the override.
const DISPLAY_OVERRIDES={};
const TYPE_OVERRIDES={};
const DISMISSED_FUZZY=new Set();
let PENDING_TYPE_REPROCESS=null;
const CATALOG={
  'Best-K': {entry:{names:'Best-K'}, custom:null, metals:null, key:'best k', suggestion:null, disp:'Best-K'},
  'Evergreen Org from NaNO3': {entry:{names:'Evergreen Org'}, custom:null, metals:null, key:'evergreen org',
    suggestion:'Evergreen Org', disp:'Evergreen Org', prefix:true}
};
function resolveCatalogType(type, opts){
  const explicit=!!(opts&&opts.explicit);
  if(CATALOG[type]) return CATALOG[type];
  if(!explicit && type==='Vigorx')
    return {entry:{names:'Vigorex'}, custom:null, metals:null, key:'vigorex', suggestion:'Vigorex', disp:'Vigorex'};
  return {entry:null, custom:null, metals:null, key:null, suggestion:null, disp:type};
}
function reportEls(){ return [null]; }
function stripTypeErrorChrome(){}
const document={getElementById(){ return null; }};

eval(acceptSrc);

const unknown={label:'20436 Mystery', type:'Mystery', error:{code:'ERR-UNKNOWN-TYPE'}};
assert(acceptTypeFromCellEdit(unknown,0,'StillUnknown')===false,
  'unknown typed name is not accepted');
assert(unknown.error && unknown.error.code==='ERR-UNKNOWN-TYPE',
  'unknown typed name keeps the attention error');
assert(TYPE_OVERRIDES['20436 Mystery']===undefined,
  'unknown typed name does not set a catalog override');
assert(PENDING_TYPE_REPROCESS===null, 'unknown typed name does not queue a reprocess');

const typo={label:'20436 Vigorx', type:'Vigorx', error:{code:'ERR-UNKNOWN-TYPE'}};
assert(acceptTypeFromCellEdit(typo,0,'Vigorx')===false,
  'explicit lookup refuses a fuzzy typo (Vigorx must not become Vigorex)');
assert(typo.error && TYPE_OVERRIDES['20436 Vigorx']===undefined,
  'fuzzy typo does not load another product\'s claims');

const hit={label:'20436 Best-K', type:'Mystery', error:{code:'ERR-UNKNOWN-TYPE'}};
assert(acceptTypeFromCellEdit(hit,0,'Best-K')===true, 'exact catalog name is accepted');
assert(hit.error===null, 'exact catalog name clears the attention error');
assert(TYPE_OVERRIDES['20436 Best-K']==='Best-K', 'exact catalog name sets TYPE_OVERRIDES');
assert(PENDING_TYPE_REPROCESS==='20436 Best-K', 'exact catalog name queues a reprocess');

PENDING_TYPE_REPROCESS=null;
const prefix={label:'19600 Evergreen Org from NaNO3', type:'Evergreen Org from NaNO3',
  error:{code:'WARN-FUZZY-MATCH',soft:true}};
assert(acceptTypeFromCellEdit(prefix,0,'Evergreen Org from NaNO3')===true,
  'prefix-extended label is accepted');
assert(TYPE_OVERRIDES['19600 Evergreen Org from NaNO3']==='Evergreen Org',
  'prefix-extended label overrides to the catalog type, not the long instrument text');

if(failed){ console.error('\n'+failed+' assertion(s) failed'); process.exit(1); }
console.log('\nall assertions passed');
