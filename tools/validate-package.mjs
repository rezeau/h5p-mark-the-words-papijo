import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEPENDENCY_SECTIONS = [
  'preloadedDependencies',
  'editorDependencies',
  'dynamicDependencies'
];
const LANGUAGE_FILE_PATTERN = /^[a-z]{2}(?:-[A-Z]{2})?\.json$/;

const assertValid = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const normalizePath = (filePath) => filePath.split(path.sep).join('/');

const readJson = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  catch (error) {
    throw new Error(`Cannot parse ${filePath}: ${error.message}`);
  }
};

const assertRelativePath = (relativePath, label) => {
  assertValid(typeof relativePath === 'string' && relativePath.length > 0, `${label} must be a non-empty path`);
  assertValid(!path.isAbsolute(relativePath), `${label} must be relative: ${relativePath}`);
  assertValid(!relativePath.includes('\\'), `${label} must use forward slashes: ${relativePath}`);
  assertValid(!relativePath.split('/').includes('..'), `${label} must not traverse directories: ${relativePath}`);
};

const assertPathExistsExactly = (root, relativePath, label) => {
  assertRelativePath(relativePath, label);
  let current = root;

  for (const segment of relativePath.split('/')) {
    assertValid(fs.existsSync(current), `${label} parent does not exist: ${current}`);
    const entries = fs.readdirSync(current);
    assertValid(entries.includes(segment), `${label} is missing or has incorrect case: ${relativePath}`);
    current = path.join(current, segment);
  }

  assertValid(fs.statSync(current).isFile(), `${label} is not a file: ${relativePath}`);
  return current;
};

const collectFiles = (root, current = root) => {
  const files = [];
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const entryPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(root, entryPath));
    }
    else {
      files.push(normalizePath(path.relative(root, entryPath)));
    }
  }
  return files;
};

const dependencyKey = (dependency) =>
  `${dependency.machineName}-${dependency.majorVersion}.${dependency.minorVersion}`;

const validateDependencies = (library) => {
  const versions = new Map();
  const dependencies = [];

  for (const section of DEPENDENCY_SECTIONS) {
    const seen = new Set();
    for (const dependency of library[section] || []) {
      assertValid(typeof dependency.machineName === 'string' && dependency.machineName.length > 0,
        `${section} contains a dependency without a machineName`);
      assertValid(Number.isInteger(dependency.majorVersion) && Number.isInteger(dependency.minorVersion),
        `${section} contains an invalid version for ${dependency.machineName}`);

      const key = dependencyKey(dependency);
      assertValid(!seen.has(key), `${section} contains duplicate dependency ${key}`);
      seen.add(key);

      const version = `${dependency.majorVersion}.${dependency.minorVersion}`;
      assertValid(!versions.has(dependency.machineName) || versions.get(dependency.machineName) === version,
        `Conflicting versions declared for ${dependency.machineName}`);
      versions.set(dependency.machineName, version);
      dependencies.push({ ...dependency, section, key });
    }
  }

  return dependencies;
};

const findCssAssets = (root, cssPath) => {
  const fullCssPath = assertPathExistsExactly(root, cssPath, 'CSS asset');
  const css = fs.readFileSync(fullCssPath, 'utf8');
  const assets = [];
  const pattern = /url\(\s*(['"]?)([^'"\)]+)\1\s*\)/g;
  let match;

  while ((match = pattern.exec(css)) !== null) {
    const reference = match[2].trim();
    if (/^(?:data:|https?:|#)/i.test(reference)) {
      continue;
    }
    const absoluteAsset = path.resolve(path.dirname(fullCssPath), reference);
    const relativeAsset = normalizePath(path.relative(root, absoluteAsset));
    assertValid(!relativeAsset.startsWith('../'), `CSS reference leaves the library root: ${reference}`);
    assertPathExistsExactly(root, relativeAsset, `Asset referenced by ${cssPath}`);
    assets.push(relativeAsset);
  }

  return assets;
};

export const validateLibrarySource = (libraryRoot) => {
  const root = path.resolve(libraryRoot);
  const library = readJson(assertPathExistsExactly(root, 'library.json', 'Library metadata'));
  const semantics = readJson(assertPathExistsExactly(root, 'semantics.json', 'Semantics'));

  assertValid(Array.isArray(semantics), 'semantics.json must contain an array');
  assertValid(typeof library.machineName === 'string' && library.machineName.length > 0,
    'library.json must contain machineName');
  for (const field of ['majorVersion', 'minorVersion', 'patchVersion']) {
    assertValid(Number.isInteger(library[field]) && library[field] >= 0,
      `library.json ${field} must be a non-negative integer`);
  }

  const allowedPayload = new Set(['library.json', 'semantics.json']);
  for (const optionalFile of ['icon.svg', 'upgrades.js']) {
    if (fs.existsSync(path.join(root, optionalFile))) {
      assertPathExistsExactly(root, optionalFile, optionalFile);
      allowedPayload.add(optionalFile);
    }
  }

  const preloadedAssets = [
    ...(library.preloadedJs || []).map((entry) => ({ ...entry, type: 'JavaScript' })),
    ...(library.preloadedCss || []).map((entry) => ({ ...entry, type: 'CSS' }))
  ];
  for (const asset of preloadedAssets) {
    assertPathExistsExactly(root, asset.path, `Preloaded ${asset.type}`);
    allowedPayload.add(asset.path);
    if (asset.type === 'CSS') {
      for (const referencedAsset of findCssAssets(root, asset.path)) {
        allowedPayload.add(referencedAsset);
      }
    }
  }

  const languageRoot = path.join(root, 'language');
  if (fs.existsSync(languageRoot)) {
    for (const entry of fs.readdirSync(languageRoot, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        readJson(path.join(languageRoot, entry.name));
        if (LANGUAGE_FILE_PATTERN.test(entry.name)) {
          allowedPayload.add(`language/${entry.name}`);
        }
      }
    }
  }

  const dependencies = validateDependencies(library);
  return {
    root,
    library,
    dependencies,
    allowedPayload,
    expectedFolder: `${library.machineName}-${library.majorVersion}.${library.minorVersion}`
  };
};

const validatePayloadFiles = (libraryRoot, allowedPayload) => {
  const forbiddenNames = new Set([
    '.gitignore',
    'eslint.config.js',
    'package.json',
    'README.md'
  ]);

  for (const file of collectFiles(libraryRoot)) {
    const segments = file.split('/');
    assertValid(!segments.includes('.git') && !segments.includes('node_modules') && !segments.includes('tests'),
      `Development directory included in library payload: ${file}`);
    assertValid(!forbiddenNames.has(path.posix.basename(file)),
      `Development file included in library payload: ${file}`);
    assertValid(allowedPayload.has(file), `Undeclared or unsupported library payload file: ${file}`);
  }
};

export const validatePackageDirectory = (packageRoot, sourceLibraryRoot) => {
  const root = path.resolve(packageRoot);
  const source = validateLibrarySource(sourceLibraryRoot);
  const h5p = readJson(assertPathExistsExactly(root, 'h5p.json', 'Package metadata'));
  readJson(assertPathExistsExactly(root, 'content/content.json', 'Package content'));

  assertValid(h5p.mainLibrary === source.library.machineName,
    `h5p.json mainLibrary must be ${source.library.machineName}`);

  const mainLibraryRoot = path.join(root, source.expectedFolder);
  assertValid(fs.existsSync(mainLibraryRoot), `Package is missing ${source.expectedFolder}`);
  const packagedMain = validateLibrarySource(mainLibraryRoot);
  assertValid(
    packagedMain.library.machineName === source.library.machineName &&
    packagedMain.library.majorVersion === source.library.majorVersion &&
    packagedMain.library.minorVersion === source.library.minorVersion &&
    packagedMain.library.patchVersion === source.library.patchVersion,
    'Packaged main library metadata does not match the release source'
  );
  validatePayloadFiles(mainLibraryRoot, packagedMain.allowedPayload);

  const libraries = new Map();
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'content') {
      continue;
    }
    const libraryJson = path.join(root, entry.name, 'library.json');
    assertValid(fs.existsSync(libraryJson), `Package directory is not an H5P library: ${entry.name}`);
    const metadata = readJson(libraryJson);
    const expectedName = `${metadata.machineName}-${metadata.majorVersion}.${metadata.minorVersion}`;
    assertValid(entry.name === expectedName,
      `Library folder ${entry.name} must be named ${expectedName}`);
    assertValid(!libraries.has(expectedName), `Duplicate library folder ${expectedName}`);
    libraries.set(expectedName, { metadata, root: path.join(root, entry.name) });
  }

  for (const [folderName, includedLibrary] of libraries) {
    for (const dependency of validateDependencies(includedLibrary.metadata)) {
      assertValid(libraries.has(dependency.key), `${folderName} is missing dependency ${dependency.key}`);
    }
  }

  const declaredPackageDependencies = [];
  for (const section of DEPENDENCY_SECTIONS) {
    for (const dependency of h5p[section] || []) {
      declaredPackageDependencies.push(dependencyKey(dependency));
    }
  }
  assertValid(declaredPackageDependencies.includes(source.expectedFolder),
    `h5p.json must declare main dependency ${source.expectedFolder}`);
  for (const folderName of libraries.keys()) {
    assertValid(declaredPackageDependencies.includes(folderName),
      `h5p.json does not declare included library ${folderName}`);
  }
  for (const dependency of declaredPackageDependencies) {
    assertValid(libraries.has(dependency), `h5p.json declares missing library ${dependency}`);
  }

  return {
    mainLibrary: source.expectedFolder,
    libraryCount: libraries.size
  };
};

const parseArguments = (argumentsList) => {
  const options = { libraryRoot: process.cwd() };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--library-root' || argument === '--package-root') {
      assertValid(argumentsList[index + 1], `${argument} requires a path`);
      options[argument === '--library-root' ? 'libraryRoot' : 'packageRoot'] = argumentsList[index + 1];
      index += 1;
    }
    else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
};

const isMainModule = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const source = validateLibrarySource(options.libraryRoot);
    console.log(`Validated ${source.library.machineName} ${source.library.majorVersion}.${source.library.minorVersion}.${source.library.patchVersion}`);
    console.log(`Expected package folder: ${source.expectedFolder}`);
    console.log(`Declared external dependencies: ${source.dependencies.map((item) => item.key).join(', ')}`);

    if (options.packageRoot) {
      const result = validatePackageDirectory(options.packageRoot, options.libraryRoot);
      console.log(`Validated unpacked package with ${result.libraryCount} libraries`);
    }
    else {
      console.log('Source validation passed; use --package-root <directory> to validate an unpacked .h5p package.');
    }
  }
  catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
