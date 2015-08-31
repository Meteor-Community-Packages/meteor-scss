const path = Plugin.path;
const sass = Npm.require('node-sass');
const Future = Npm.require('fibers/future');
const fs = Npm.require('fs');
const _ = Npm.require('lodash');

Plugin.registerCompiler({
  extensions: ['scss', 'sass'],
  archMatching: 'web'
}, () => new SassCompiler());


// CompileResult is {css, sourceMap}.
class SassCompiler extends MultiFileCachingCompiler {
  constructor() {
    super({
      compilerName: 'sass',
      defaultCacheSize: 1024*1024*10,
    });
  }

  getCacheKey(inputFile) {
    return inputFile.getSourceHash();
  }

  compileResultSize(compileResult) {
    return compileResult.css.length +
      this.sourceMapSize(compileResult.sourceMap);
  }

  // The heuristic is that a file is an import (ie, is not itself processed as a
  // root) if it is in a subdirectory named 'imports' or if it matches
  // *.import.sass or *.import.scss This can be overridden in either direction via an explicit
  // `isImport` file option in api.addFiles.
  isRoot(inputFile) {
    const fileOptions = inputFile.getFileOptions();
    if (fileOptions.hasOwnProperty('isImport')) {
      return !fileOptions.isImport;
    }

    const pathInPackage = inputFile.getPathInPackage();

    return !(/\.import\.s(a|c)ss$/.test(pathInPackage) ||
    /(?:^|\/)imports\//.test(pathInPackage));

  }

  compileOneFile(inputFile, allFiles) {

    const referencedImportPaths = [];

    const self = this;

    function parseImportPath(filePath, importerDir) {
      if (! filePath) {
        throw new Error('filePath is undefined');
      }
      if (filePath === inputFile.getPathInPackage()) {
        return {
          packageName: inputFile.getPackageName() || '',
          pathInPackage: inputFile.getPathInPackage()
        };
      }
      if (! filePath.match(/^\{.*\}\//)) {
        if (! importerDir) {
          return { packageName: inputFile.getPackageName() || '',
            pathInPackage: filePath };
        }

        // relative path in the same package
        const parsedImporter = parseImportPath(importerDir, null);

        // resolve path if it is absolute or relative
        const importPath =
          (filePath[0] === '/') ? filePath :
            path.join(parsedImporter.pathInPackage, filePath);

        return {
          packageName: parsedImporter.packageName,
          pathInPackage: importPath
        };
      }

      const match = /^\{(.*)\}\/(.*)$/.exec(filePath);
      if (! match) { return null; }

      const [ignored, packageName, pathInPackage] = match;
      return {packageName, pathInPackage};
    }

    function absoluteImportPath(parsed) {
      return '{' + parsed.packageName + '}/' + parsed.pathInPackage;
    }

    const importer = function(importPath,prev,done){

      const isAbsolute = importPath[0] === '/';
      if (isAbsolute) {
        referencedImportPaths.push(importPath);
        done({ /*file: importPath,*/ contents: fs.readFileSync(importPath, 'utf8')});
        return ;
      }

      const parsed = parseImportPath(importPath, null);
      if (! parsed) { return null; }

      const absolutePath = absoluteImportPath(parsed);

      referencedImportPaths.push(absolutePath);

      if (! allFiles.has(absolutePath)) {
        throw new Error(
          `Cannot read file ${absolutePath} for ${inputFile.getDisplayPath()}`
        );
      }

      done({ /*file: absolutePath,*/ contents: allFiles.get(absolutePath).getContentsAsString()});
    }

    const f = new Future;

    const options = _.extend({
      sourceMap:         true,
      sourceMapContents: true,
      sourceMapEmbed:    false,
      sourceComments:    false,
      outFile: inputFile.getDisplayPath(),
      importer: importer,
      includePaths:      []
    }, {}/*scssOptions*/);

    options.file  =  this.getAbsoluteImportPath(inputFile);

    options.data = inputFile.getContentsAsBuffer().toString('utf8');

    let output;
    try {
      sass.render(options,f.resolver());
      output = f.wait();
    } catch (e) {
      inputFile.error({
        message: `Scss compiler error: ${e.message}\n`,
        sourcePath: decodeFilePath(e.filename),
        line: e.line,
        column: e.column
      });
      return null;
    }

    if (output.map) {
      const map = JSON.parse(output.map.toString('utf-8'));
      map.sources = map.sources.map(decodeFilePath);
      output.map = map;
    }

    const compileResult = {css: output.css.toString('utf-8'), sourceMap: output.map};
    return {compileResult,referencedImportPaths};
  }

  addCompileResult(inputFile,  compileResult) {
    inputFile.addStylesheet({
      data:  compileResult.css,
      path: inputFile.getPathInPackage() + '.css',
      sourceMap:  compileResult.sourceMap
    });
  }
}


function decodeFilePath (filePath) {
  const match = filePath.match(/{(.*)}\/(.*)$/);
  if (! match)
    throw new Error(`Failed to decode Sass path: ${filePath}`);

  if (match[1] === '') {
    // app
    return match[2];
  }

  return 'packages/' + match[1] + '/' + match[2];
}
