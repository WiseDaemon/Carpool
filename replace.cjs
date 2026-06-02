const fs = require('fs');
const path = require('path');

const srcDir = 'c:\\LLM\\carpool\\src';
const serverDir = 'c:\\LLM\\carpool\\server';

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace exact string literals
  content = content.replace(/'Driver'/g, "'Pool Host'");
  content = content.replace(/"Driver"/g, '"Pool Host"');
  
  // Replace UI texts
  content = content.replace(/>Driver</g, ">Pool Host<");
  content = content.replace(/>Driver /g, ">Pool Host ");
  content = content.replace(/ Driver</g, " Pool Host<");
  content = content.replace(/>Drivers</g, ">Pool Hosts<");
  content = content.replace(/Drivers /g, "Pool Hosts ");
  content = content.replace(/ Driver /g, " Pool Host ");
  content = content.replace(/Driver:/g, "Pool Host:");
  content = content.replace(/Driver Dashboard/g, "Pool Host Dashboard");
  content = content.replace(/Update Driver Profile/g, "Update Pool Host Profile");
  content = content.replace(/Female Drivers Only/g, "Female Pool Hosts Only");
  content = content.replace(/driver_name/g, "driver_name"); // unchanged
  
  // Update import for renamed component
  if (filePath.endsWith('App.jsx')) {
    content = content.replace(/DriverDashboard/g, "PoolHostDashboard");
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js') || fullPath.endsWith('.css')) {
      replaceInFile(fullPath);
    }
  }
}

walkDir(srcDir);
walkDir(serverDir);

// File rename
const oldPath = path.join(srcDir, 'DriverDashboard.jsx');
const newPath = path.join(srcDir, 'PoolHostDashboard.jsx');
if (fs.existsSync(oldPath)) {
  let content = fs.readFileSync(oldPath, 'utf8');
  content = content.replace(/const DriverDashboard = /g, "const PoolHostDashboard = ");
  content = content.replace(/export default DriverDashboard;/g, "export default PoolHostDashboard;");
  fs.writeFileSync(newPath, content, 'utf8');
  fs.unlinkSync(oldPath);
  console.log("Renamed DriverDashboard to PoolHostDashboard");
}

console.log("Replacement complete!");
