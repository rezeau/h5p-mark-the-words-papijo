'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const repositoryRoot = path.join(__dirname, '..');
const validatorUrl = pathToFileURL(path.join(repositoryRoot, 'tools', 'validate-package.mjs')).href;

const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const copyPayload = (source, target, files) => {
  for (const relativePath of files) {
    const destination = path.join(target, ...relativePath.split('/'));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(source, ...relativePath.split('/')), destination);
  }
};

test('release source metadata and referenced assets pass package validation', async () => {
  const { validateLibrarySource } = await import(validatorUrl);
  const result = validateLibrarySource(repositoryRoot);

  assert.equal(result.expectedFolder, 'H5P.MarkTheWordsPapiJo-1.2');
  assert.equal(result.library.patchVersion, 0);
  assert.equal(result.allowedPayload.has('upgrades.js'), true);
  assert.equal(result.allowedPayload.has('language/.en.json'), false);
  assert.deepEqual(
    result.dependencies.map((dependency) => dependency.key),
    [
      'FontAwesome-4.5',
      'H5P.JoubelUI-1.3',
      'H5P.Question-1.5',
      'H5PEditor.RangeList-1.0',
      'H5PEditor.ShowWhenpapijo-1.0'
    ]
  );
});

test('validates an allowlisted unpacked package and rejects development files', async (t) => {
  const { validateLibrarySource, validatePackageDirectory } = await import(validatorUrl);
  const source = validateLibrarySource(repositoryRoot);
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mark-the-words-package-'));
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));

  const packageRoot = path.join(temporaryRoot, 'package');
  const mainLibraryRoot = path.join(packageRoot, source.expectedFolder);
  copyPayload(repositoryRoot, mainLibraryRoot, [...source.allowedPayload]);
  writeJson(path.join(packageRoot, 'content', 'content.json'), {});

  const packageMetadata = {
    title: 'Mark the Words PapiJo release validation',
    mainLibrary: source.library.machineName,
    embedTypes: ['iframe'],
    preloadedDependencies: [
      {
        machineName: source.library.machineName,
        majorVersion: source.library.majorVersion,
        minorVersion: source.library.minorVersion
      }
    ],
    editorDependencies: []
  };

  for (const dependency of source.dependencies) {
    const dependencyRoot = path.join(packageRoot, dependency.key);
    writeJson(path.join(dependencyRoot, 'library.json'), {
      title: dependency.machineName,
      machineName: dependency.machineName,
      majorVersion: dependency.majorVersion,
      minorVersion: dependency.minorVersion,
      patchVersion: 0
    });
    packageMetadata[dependency.section].push({
      machineName: dependency.machineName,
      majorVersion: dependency.majorVersion,
      minorVersion: dependency.minorVersion
    });
  }
  writeJson(path.join(packageRoot, 'h5p.json'), packageMetadata);

  assert.deepEqual(validatePackageDirectory(packageRoot, repositoryRoot), {
    mainLibrary: 'H5P.MarkTheWordsPapiJo-1.2',
    libraryCount: 6
  });

  fs.copyFileSync(path.join(repositoryRoot, 'package.json'), path.join(mainLibraryRoot, 'package.json'));
  assert.throws(
    () => validatePackageDirectory(packageRoot, repositoryRoot),
    /Development file included in library payload: package\.json/
  );
});
