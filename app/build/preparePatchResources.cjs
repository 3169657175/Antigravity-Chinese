const fs = require('fs');
const path = require('path');

// electron-builder excludes extraResources' source files from app.asar.
// Generate a separate input so the Hub can still require its shared module.
module.exports = async context => {
  const root = context.packager.projectDir;
  const generated = path.join(root, 'build', 'generated');
  fs.mkdirSync(generated, { recursive: true });
  fs.copyFileSync(path.join(root, 'accountQuota.js'), path.join(generated, 'accountQuota.js'));
  fs.copyFileSync(path.join(root, 'argonEvidence.js'), path.join(generated, 'argonEvidence.js'));
  fs.copyFileSync(path.join(root, 'antigravityQuotaBridge.js'), path.join(generated, 'antigravityQuotaBridge.js'));
};
