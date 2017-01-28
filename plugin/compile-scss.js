const path = Plugin.path;
const fs = Plugin.fs;
const sass = Npm.require('node-sass');
const Future = Npm.require('fibers/future');
const files = Plugin.files;


Plugin.registerCompiler({
  extensions: ['scss', 'sass', 'scss.js', 'sass.js'],
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
    this.customFunctionObject = {}
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

    const pathInPackage = inputFile.getPathInPackage();
    return !this.hasUnderscore(pathInPackage);
  }

  hasUnderscore(file){
    return path.basename(file)[0] === '_';
  }

  compileOneFile(inputFile, allFiles) {
    // greedily evaluate custom scss.js and sass.js files.
    // the custom functions have to be evaluated and ready by the time node-sass is called
    // so without a way to asynchronously change the custom functions object that was passed to node-sass
    // there isn't any way to leverage the importer for the custom functions
    // there's also a problem where if any custom functions files are changed, the sass files they relate to aren't recompiled.
    if(inputFile.getExtension().match(/^(sass|scss)\.js$/)) {
      // TODO there has to be a better way to pass these functions than calling eval
      var customFunctions = eval(inputFile.getContentsAsString())
      // use this.customFunctionObject and this.alreadyEvaluatedJs to hold those values
      _.extend(this.customFunctionObject, customFunctions)
      return null;
    }


    const referencedImportPaths = [];

    const self = this;

    var totalImportPath = [];
    var sourceMapPaths = ['.'+inputFile.getDisplayPath()];

    //Handle deprecation of fs.existsSYnc
    //XXX: remove when meteor is fully on node 4+
    function fileExists(file){
      if(fs.statSync){
        try{
          fs.statSync(file);
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

    const getRealImportPath = function(importPath){

      const rawImportPath = importPath;
      var isAbsolute = false;
      // var isJavascript = false

      if(importPath[0] === '/'){
        isAbsolute = true;
      }


      //SASS has a whole range of possible import files from one import statement, try each of them
      const possibleFiles = [];

      //If the referenced file has no extension, try possible extensions, starting with extension of the parent file.
      // let possibleExtensions = ['scss','sass','css', 'sass.js', 'scss.js'];
      let possibleExtensions = ['scss','sass','css'];

      // if(! importPath.match(/\.(s?(a|c)ss)|((sass|scss)\.js)$/)){
      if(! importPath.match(/\.(s?(a|c)ss)$/)) {
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
            // if(possibleFile.match(/\.(sass|scss)\.js$/)){
            //   isJavascript = true
            // }
            // return {absolute:isAbsolute,path:possibleFile, isJavascript: isJavascript};
            return {absolute:isAbsolute,path:possibleFile};
        }
      }

      //Nothing found...
      throw new Error(`File to import: ${rawImportPath} not found in file: ${totalImportPath[totalImportPath.length-2]}`);

    }

    //Handle import statements found by the sass compiler, used to handle cross-package imports
    const importer = function(url,prev,done){
      if(!totalImportPath.length){
        totalImportPath.push(prev);
      }

      if(totalImportPath[totalImportPath.length] !== prev){
        //backtracked, splice of part we don't need anymore
        // (XXX: this might give problems when multiple parts of the path have the same name)
        totalImportPath.splice(totalImportPath.indexOf(prev)+1,totalImportPath.length);
      }

      var importPath = url;
      for(var i = totalImportPath.length-1; i >= 0; i--){
        if(importPath[0] === '/' || importPath[0] === '{'){
          break;
        }
        importPath = path.join(path.dirname(totalImportPath[i]),importPath);
      }
      totalImportPath.push(url);

      let accPosition = importPath.indexOf('{');
      if(accPosition > -1){
        importPath = importPath.substr(accPosition,importPath.length);
      }

      try{
        const parsed = getRealImportPath(importPath);

        var contents = ''
        if (parsed.absolute) {
          sourceMapPaths.push(parsed.path);
          contents = fs.readFileSync(parsed.path, 'utf8')
        }
        else {
          referencedImportPaths.push(parsed.path);
          sourceMapPaths.push(decodeFilePath(parsed.path));

          contents = allFiles.get(parsed.path).getContentsAsString()
        }


        // if (parsed.isJavascript) {
        //   var customFunctions = eval(contents)
        //   // _.extend(self.customFunctionObject, customFunctions)
        //   // _.extend(globalCustomFunctionObject, customFunctions)
        //   for (var k of _.keys(customFunctions)) {
        //     globalCustomFunctionObject[k] = customFunctions[k]
        //   }
        //   done({contents: ''})
        // }
        // else {
        //   done({contents: contents})
        // }

        done({contents: contents})

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
      omitSourceMapUrl:  true,
      sourceMapRoot: '.',
      indentedSyntax : inputFile.getExtension() === 'sass',
      outFile: '.'+inputFile.getBasename(),
      importer: importer,
      includePaths:      []
    };

    options.file  =  this.getAbsoluteImportPath(inputFile);

    options.data = inputFile.getContentsAsBuffer().toString('utf8');

    options.functions = this.customFunctionObject;


    //If the file is empty, options.data is an empty string
    // In that case options.file will be used by node-sass,
    // which it can not read since it will contain a meteor package or app reference '{}'
    // This is one workaround, another one would be to not set options.file, in which case the importer 'prev' will be 'stdin'
    // However, this would result in problems if a file named stdín.scss would exist.
    // Not the most elegant of solutions, but it works.
    if(!options.data.trim()){
      options.data = "$fakevariable : blue;"
    }

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
      map.sources = sourceMapPaths;
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

function decodeFilePath (filePath) {
  const match = filePath.match(/{(.*)}\/(.*)$/);
  if (! match)
    throw new Error('Failed to decode Less path: ' + filePath);

  if (match[1] === '') {
    // app
    return match[2];
  }

  return 'packages/' + match[1] + '/' + match[2];
}
