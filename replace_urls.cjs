const fs = require('fs');
const path = require('path');
const dir = 'C:/LLM/carpool/src';

const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));
let totalReplaced = 0;

files.forEach(f => {
  const p = path.join(dir, f);
  let c = fs.readFileSync(p, 'utf8');
  
  // Replace http://${window.location.hostname}:3001/api with /api
  // We match the exact template literal string usage or regular string usage
  const targetPattern = /http:\/\/\$\{window\.location\.hostname\}:3001/g;
  
  if (targetPattern.test(c)) {
    c = c.replace(targetPattern, '');
    fs.writeFileSync(p, c);
    console.log('Updated ' + f);
    totalReplaced++;
  }
});

console.log('Total files updated: ' + totalReplaced);
