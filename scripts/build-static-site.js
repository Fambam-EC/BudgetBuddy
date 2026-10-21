const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const outputDirectory = path.join(projectRoot, 'dist');
const fontDirectory = path.join(outputDirectory, 'assets', 'fonts');

const pages = ['policy.html', 'support.html', 'jsonvalidator.html', 'requestlab.html', 'crontab.html', 'learncss.html'];

fs.mkdirSync(fontDirectory, { recursive: true });

for (const page of pages) {
  fs.copyFileSync(
    path.join(projectRoot, page),
    path.join(outputDirectory, page),
  );
}

for (const page of ['policy', 'support']) {
  const pageDirectory = path.join(outputDirectory, page);
  fs.mkdirSync(pageDirectory, { recursive: true });
  fs.copyFileSync(
    path.join(projectRoot, `${page}.html`),
    path.join(pageDirectory, 'index.html'),
  );
}

for (const font of ['OpenSans-Regular.ttf', 'OpenSans-Bold.ttf']) {
  fs.copyFileSync(
    path.join(projectRoot, 'assets', 'fonts', font),
    path.join(fontDirectory, font),
  );
}
