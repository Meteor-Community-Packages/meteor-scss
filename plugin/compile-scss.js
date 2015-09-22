const path = Plugin.path;
const fs = Plugin.fs;
const sass = Npm.require('node-sass');
const Future = Npm.require('fibers/future');

Plugin.registerCompiler({
  extensions: ['scss', 'sass'],
  archMatching: 'web'
}, () => new SassCompiler());


// CompileResult is {css, sourceMap}.
class SassCompiler extends MultiFileCachingCompiler {
  constructor() {
    super({
      compilerName: 'sass',
      defaultCacheSize: 1024*1024*10
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
    /(?:^|\/)imports\//.test(pathInPackage) ||
    /^_/.test(inputFile.getBasename()));
  }

  compileOneFile(inputFile, allFiles) {


    const referencedImportPaths = [];

    const self = this;

    //Given an imported sass path, return package name and path in the package
    //Can handle package references like {packagename}/pathInPackage, local paths and absolute paths
    function parseImportPath(filePath, importerDir) {
      if (! filePath) {
        throw new Error('filePath is undefined');
      }

      //If the referenced file has no extension, add the extension of the parent file.
      if(! filePath.match(/.s(a|c)ss$/)){
        filePath += '.'+inputFile.getExtension();
      }

      if (filePath === inputFile.getPathInPackage()) {
        return {
          packageName: inputFile.getPackageName() || '',
          pathInPackage: inputFile.getPathInPackage()
        };
      }

      //Relative (to package) file reference
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

      //Handle (cross-)package reference (e.g. {packagename}/file)
      const match = /^\{(.*)\}\/(.*)$/.exec(filePath);
      if (! match) { return null; }

      const [ignored, packageName, pathInPackage] = match;
      return {packageName, pathInPackage};
    }

    //Inverse of 'parseImportPath'
    //Given a package name and the path in the package, return the import path as {packagename}/pathInPackage
    function absoluteImportPath(parsed) {
      return '{' + parsed.packageName + '}/' + parsed.pathInPackage;
    }

    //Handle import statements found by the sass compiler, used to handle cross-package imports
    const importer = function(importPath,prev,done){

      const isAbsolute = importPath[0] === '/';
      if (isAbsolute) {
        referencedImportPaths.push(importPath);
        done({ contents: fs.readFileSync(importPath, 'utf8')});
        return ;
      }

      const parsed = parseImportPath(importPath, null);
      if (! parsed) { return null; }

      const absolutePath = absoluteImportPath(parsed);

      referencedImportPaths.push(absolutePath);

      if (! allFiles.has(absolutePath)) {
        done(new Error(
          `Cannot read file ${absolutePath} for ${inputFile.getDisplayPath()}`
        ));
      } else {
        done({ contents: allFiles.get(absolutePath).getContentsAsString()});
      }
    }

    //Start compile sass (async)
    const f = new Future;

    const options = {
      sourceMap:         true,
      sourceMapContents: true,
      sourceMapEmbed:    false,
      sourceComments:    false,
      sourceMapRoot: '.',
      outFile: '.'+inputFile.getBasename(),
      importer: importer,
      includePaths:      []
    };

    options.file  =  this.getAbsoluteImportPath(inputFile);

    options.data = inputFile.getContentsAsBuffer().toString('utf8');

    let output;
    try {
      sass.render(options,f.resolver());
      output = f.wait();
    } catch (e) {
      inputFile.error({
        message: `Scss compiler error: ${e.message}\n`,
        sourcePath: decodeFilePath(e.filename || ''),
        line: e.line,
        column: e.column
      });
      return null;
    }
    //End compile sass

    //Start fix sourcemap references
    if (output.map) {
      const map = JSON.parse(output.map.toString('utf-8'));
      const packageName = inputFile.getPackageName();
      map.sources = map.sources.map(function(filePath){return decodeFilePath(filePath,packageName)});
      output.map = map;
    }
    //End fix sourcemap references

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

function decodeFilePath (filePath,packageName) {
  if (! filePath.match(/{.*}/)) {
    if(packageName){
      return 'packages/' + packageName + '/' + filePath;
    }else{
      return filePath;
    }
  }else{
    const match = filePath.match(/{(.*)}\/(.*)$/);
    if (! match){
      throw new Error(`Failed to decode Sass path: ${filePath}`);
    }
    if (match[1] === '') {
      // app
      return match[2];
    }
    return 'packages/' + match[1] + '/' + match[2];
  }
}
