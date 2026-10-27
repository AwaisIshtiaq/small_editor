// Extract Sejda's tool-search handler from the captured production bundle
const fs = require('fs');
const path = '/home/z/my-project/upload/extracted/server/site-re/sites/sejda-com/raw/libs-and-partials.real.js';
const src = fs.readFileSync(path, 'utf8');

function extract(needle, before, after, max, label) {
  let idx = 0, found = 0;
  console.log('\n########## ' + label + ' (' + needle + ') ##########');
  while (found < max && (idx = src.indexOf(needle, idx)) !== -1) {
    const start = Math.max(0, idx - before);
    const end = Math.min(src.length, idx + needle.length + after);
    console.log('\n--- occurrence @ char ' + idx + ' ---');
    console.log(src.slice(start, end));
    idx += needle.length;
    found++;
  }
  if (found === 0) console.log('(not found)');
}

// 1. The palette search input handler
extract('searchTools', 700, 1400, 3, 'TOOL SEARCH INPUT');

// 2. The dim-in-place opacity treatment
extract('0.1', 300, 500, 4, 'DIM OPACITY 0.1');
