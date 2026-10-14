const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const outputDirectory = path.join(projectRoot, 'dist');
const fontDirectory = path.join(outputDirectory, 'assets', 'fonts');

fs.rmSync(outputDirectory, { recursive: true, force: true });
fs.mkdirSync(fontDirectory, { recursive: true });

fs.copyFileSync(
  path.join(projectRoot, 'index.html'),
  path.join(outputDirectory, 'index.html'),
);

for (const page of ['policy.html', 'support.html']) {
  fs.copyFileSync(
    path.join(projectRoot, page),
    path.join(outputDirectory, page),
  );
}

for (const font of ['OpenSans-Regular.ttf', 'OpenSans-Bold.ttf']) {
  fs.copyFileSync(
    path.join(projectRoot, 'assets', 'fonts', font),
    path.join(fontDirectory, font),
  );
}
