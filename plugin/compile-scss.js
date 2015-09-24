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
  // root) if it matches _*.sass, _*.scss
  // This can be overridden in either direction via an explicit
  // `isImport` file option in api.addFiles.
  isRoot(inputFile) {
    const fileOptions = inputFile.getFileOptions();
    if (fileOptions.hasOwnProperty('isImport')) {
      return !fileOptions.isImport;
    }
    return !this.hasUnderscore(inputFile.getPathInPackage());
  }

  hasUnderscore(file){
    return path.basename(file)[0] === '_';
  }

  compileOneFile(inputFile, allFiles) {


    const referencedImportPaths = [];

    const self = this;

    //Handles omissions of the extension and underscore prefix
    function getRealImportPath(importPath){

      //If the referenced file has no extension, add the extension of the parent file.
      if(! importPath.match(/.s(a|c)ss$/)){
        importPath += '.'+inputFile.getExtension();
      }

      //Absolute file
      const isAbsolute = importPath[0] === '/';
      if (isAbsolute) {
        if(!fileExists(importPath)){
          importPath = addUnderscore(importPath);
          if(!fileExists(importPath)){
            throw new Error(`Cannot read file ${filePath} for ${inputFile.getDisplayPath()}`);
          }
        }
        return {absolute:true,packageName:true,pathInPackage:importPath};
      }

      //Relative file
      const parsed = parseImportPath(importPath, path.dirname(inputFile.getPathInPackage()));
      var absolutePath = meteorImportPath(parsed);
      if (! allFiles.has(absolutePath)) {
        parsed.pathInPackage = addUnderscore(parsed.pathInPackage);
        absolutePath = meteorImportPath(parsed);
        if(!allFiles.has(absolutePath)){
          throw new Error(`Cannot read file ${absolutePath} for ${inputFile.getDisplayPath()}`);
        }else{
          return parsed;
        }
      }else{
        return parsed;
      }
    }

    //Given an imported sass path, return package name and path in the package
    //Can handle package references like {packagename}/pathInPackage, local paths and absolute paths
    function parseImportPath(filePath, importerDir) {
      if (! filePath) {
        throw new Error('filePath is undefined');
      }

      //A. If this is not an imported file, we can get it directly from meteor build system
      if (filePath === inputFile.getPathInPackage()) {
        return {
          packageName: inputFile.getPackageName() || '',
          pathInPackage: inputFile.getPathInPackage()
        };
      }

      //B. Imported file: relative reference
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

      //C. Imported file: package reference (e.g. {packagename}/file)
      const match = /^\{(.*)\}\/(.*)$/.exec(filePath);
      if (! match) { return null; }

      const [ignored, packageName, pathInPackage] = match;
      return {packageName, pathInPackage};
    }

    //Inverse of 'parseImportPath'
    //Given a package name and the path in the package, return the import path as {packagename}/pathInPackage
    function meteorImportPath(parsed) {
      return '{' + parsed.packageName + '}/' + parsed.pathInPackage;
    }

    //Handle deprecation of fs.existsSYnc
    //XXX: remove when meteor is fully on node 4+
    function fileExists(file){
      if(fs.accessSync){
        try{
          fs.accessSync(file,fs.R_OK);
        }catch(e){
          return false;
        }
        return true;
      }else{
        return fs.existsSync(file);
      }
    }

    function addUnderscore(file){
      if(!self.hasUnderscore(file)){
        file = path.join(path.dirname(file),'_'+path.basename(file));
      }
      return file;
    }

    function absoluteImportPath (filePath) {
      const parsed = getRealImportPath(filePath);

      if (! parsed.packageName) {
        return parsed.pathInPackage;
      }else{
        return `packages/${parsed.packageName}/${parsed.pathInPackage}`;
      }
    }

    //Handle import statements found by the sass compiler, used to handle cross-package imports
    const importer = function(importPath,prev,done){

      try{
        const parsed = getRealImportPath(importPath);
        if (parsed.absolute) {
          referencedImportPaths.push(parsed.pathInPackage);
          done({ contents: fs.readFileSync(parsed.pathInPackage, 'utf8')});
          return ;
        }else{
          const path = meteorImportPath(parsed);
          referencedImportPaths.push(path);
          done({ contents: allFiles.get(path).getContentsAsString()});
        }
      }catch(e){
        return done({file:importPath});
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
        sourcePath: inputFile.getDisplayPath()
      });
      return null;
    }
    //End compile sass

    //Start fix sourcemap references
    if (output.map) {
      const map = JSON.parse(output.map.toString('utf-8'));
      const packageName = inputFile.getPackageName();
      map.sources = map.sources.map(function(filePath){return absoluteImportPath(filePath)});
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


