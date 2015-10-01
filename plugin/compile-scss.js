const path = Plugin.path;
const fs = Plugin.fs;
const sass = Npm.require('node-sass');
const Future = Npm.require('fibers/future');
const files = Plugin.files;


Plugin.registerCompiler({
  extensions: ['scss', 'sass'],
  archMatching: 'web'
}, () => new SassCompiler());

var toPosixPath = function (p, partialPath) {
  // Sometimes, you can have a path like \Users\IEUser on windows, and this
  // actually means you want C:\Users\IEUser
  if (p[0] === "\\" && (! partialPath)) {
    p = process.env.SystemDrive + p;
  }

  p = p.replace(/\\/g, '/');
  if (p[1] === ':' && ! partialPath) {
    // transform "C:/bla/bla" to "/c/bla/bla"
    p = '/' + p[0] + p.slice(2);
  }

  return p;
};

var convertToStandardPath = function (osPath, partialPath) {
  if (process.platform === "win32") {
    return toPosixPath(osPath, partialPath);
  }

  return osPath;
}

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


    console.log("---COMPILE",inputFile.getPackageName(),inputFile.getPathInPackage());

    const referencedImportPaths = [];

    const self = this;

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

    const getRealImportPath = function(importPath,prev){
      const rawImportPath = importPath;
      var isAbsolute = false;

      if(importPath[0] === '/'){
        isAbsolute = true;
      }else if (importPath[0] !== '{'){
        prev = path.dirname(prev);

        let accPosition = prev.indexOf('{');
        if(accPosition > -1){
          prev = prev.substr(accPosition,prev.length);
        }else{
          prev = path.join('{' + (inputFile.getPackageName() || '') + '}/' + path.dirname(inputFile.getPathInPackage()),prev);
        }

        importPath = path.join(prev,importPath);
      }

      console.log("----------------CALCULATED",importPath);

      //SASS has a whole range of possible import files from one import statement, try each of them
      const possibleFiles = [];

      //If the referenced file has no extension, try possible extensions, starting with extension of the parent file.
      let possibleExtensions = ['scss','sass','css'];

      if(! importPath.match(/\.s?(a|c)ss$/)){
        possibleExtensions = [inputFile.getExtension()].concat(_.without(possibleExtensions,inputFile.getExtension()));
        for(const extension of possibleExtensions){
          possibleFiles.push(importPath+'.'+extension);
        }
      }else{
        possibleFiles.push(importPath);
      }

      //Try files prefixed with underscore
      for(const possibleFile of possibleFiles){
        if(! self.hasUnderscore(possibleFile)){
          possibleFiles.push(addUnderscore(possibleFile));
        }
      }

      //Try if one of the possible files exists
      for(const possibleFile of possibleFiles){
        if((isAbsolute && fileExists(possibleFile)) || (!isAbsolute && allFiles.has(possibleFile))){
            return {absolute:isAbsolute,path:possibleFile};
        }
      }

      //Nothing found...
      throw new Error(`File to import: ${rawImportPath} not found. Import origin: ${prev}`);

    }

    //Handle import statements found by the sass compiler, used to handle cross-package imports
    const importer = function(importPath,prev,done){

      console.log("-----IMPORT CALLED");
      console.log("-------BASE",inputFile.getDisplayPath());
      console.log("----------PREV",prev,path.dirname(prev));
      console.log("-------------IMPORT PATH",importPath);


      try{
        const parsed = getRealImportPath(importPath,prev);
        console.log();
        if (parsed.absolute) {
          done({ contents: fs.readFileSync(parsed.path, 'utf8')});
        }else{
          referencedImportPaths.push(parsed.path);
          done({ contents: allFiles.get(parsed.path).getContentsAsString()});
        }
      }catch(e){
        return done(e);
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
      indentedSyntax : inputFile.getExtension() === 'sass',
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
      //console.log("SOURCEMAP FILES FOR"+inputFile.getPackageName()+"/"+inputFile.getPathInPackage());
      map.sources = map.sources.map(function(filePath){/*console.log(filePath);*/});
      //console.log();
      //console.log();
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