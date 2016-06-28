const path = Plugin.path;
const fs = Plugin.fs;
const sass = Npm.require('node-sass');
const Future = Npm.require('fibers/future');
const files = Plugin.files;

var includePaths;


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

    const pathInPackage = inputFile.getPathInPackage();
    return !this.hasUnderscore(pathInPackage);
  }

  hasUnderscore(file){
    return path.basename(file)[0] === '_';
  }

  compileOneFile(inputFile, allFiles) {

    const referencedImportPaths = [];

    const self = this;

    var totalImportPath = [];
    var sourceMapPaths = ['.'+inputFile.getDisplayPath()];

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
        if (fs.existsSync) {
          return fs.existsSync(file);
        } else {
          if (fs.statSync) {
            var stats = fs.statSync(file);
            if (!stats)
              return false;
            if (stats.isFile()) {
              return true;
            } else {
              return false;
            }
          } else {
            console.error('fs invalid');
            console.log(fs);
            throw "fs invalid";
          }
        }
      }
    }

    function addUnderscore(file){
      if(!self.hasUnderscore(file)){
        file = path.join(path.dirname(file),'_'+path.basename(file));
      }
      return file;
    }

    const getRealImportPathForOnePath = function(importPath) {
      const rawImportPath = importPath;
      var isAbsolute = false;

      if (importPath[0] === '/') {
        isAbsolute = true;
      }

      //SASS has a whole range of possible import files from one import statement, try each of them
      const possibleFiles = [];

      //If the referenced file has no extension, try possible extensions, starting with extension of the parent file.
      let possibleExtensions = ['scss', 'sass', 'css'];

      if (!importPath.match(/\.s?(a|c)ss$/)) {
        possibleExtensions = [inputFile.getExtension()].concat(_.without(possibleExtensions, inputFile.getExtension()));
        for (const extension of possibleExtensions) {
          possibleFiles.push(importPath + '.' + extension);
        }
      } else {
        possibleFiles.push(importPath);
      }

      //Try files prefixed with underscore
      for (const possibleFile of possibleFiles) {
        if (!self.hasUnderscore(possibleFile)) {
          possibleFiles.push(addUnderscore(possibleFile));
        }
      }

      //Try if one of the possible files exists
      for (const possibleFile of possibleFiles) {
        if ((isAbsolute && fileExists(possibleFile)) || (!isAbsolute && allFiles.has(possibleFile))) {
          return {absolute: isAbsolute, path: possibleFile};
        }
      }
      return null;
    };

    const getRealImportPathFromIncludes = function(importPath){

      // Check for scssIncludePaths.json, load contents in includePaths if it is there
      if (!includePaths) {
        
        // Get the root dir of the app.  (Seems to be mass confusion on how to do this: http://stackoverflow.com/questions/16762983/reading-files-from-a-directory-inside-a-meteor-app)
        var configPath = process.cwd().split('.meteor')[0]; // process.env.PWD;
        var configFile = path.join(configPath, 'scssIncludePaths.json');
        console.log('checking ' + configFile);

        if (fileExists(configFile)) {
          console.log('found scssIncludePaths.json...' + configFile);
          var contents = fs.readFileSync(configFile, 'utf8');
          console.log(contents);
          try {
            var obj = JSON.parse(contents);
            console.log('parsed ok');
            console.log(obj)
            if (obj.includePaths) {
              if (_.isArray(obj.includePaths)) {
                includePaths = obj.includePaths;
              } else {
                obj.includePaths = [obj.includePaths];
              }
            } else {
              includePaths = [];
            }
          } catch (e) {
            var err = 'Error parsing "' + configFile + '", :' + e;
            console.error(e);
            throw (err);
          }
        } else {
          console.log('could not find "' + configFile + '" to look for includes');
        }
      }

      for (var i=0; i<includePaths.length; i++) {
        var possiblePath = includePaths[i];
        var possibleFile = path.join(possiblePath, importPath);
        console.log('checking: ' + possibleFile)
        var found = getRealImportPathForOnePath(possibleFile);
        if (found)
          return found;
      }

      return null;
    };

    //Handle import statements found by the sass compiler, used to handle cross-package imports
    const importer = function(url,prev,done) {
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
        var parsed = getRealImportPathForOnePath(importPath);
        if (!parsed) {
          parsed = getRealImportPathFromIncludes(url);
          if (!parsed) {
            //Nothing found...
            throw new Error(`File to import: ${url} not found in file: ${totalImportPath[totalImportPath.length-2]}`);
          }
        }
        if (parsed.absolute) {
          sourceMapPaths.push(parsed.path);
          done({ contents: fs.readFileSync(parsed.path, 'utf8')});
        }else{
          referencedImportPaths.push(parsed.path);
          sourceMapPaths.push(decodeFilePath(parsed.path));
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

    //If the file is empty, options.data is an empty string
    // In that case options.file will be used by node-sass,
    // which it can not read since it will contain a meteor package or app reference '{}'
    // This is one workaround, another one would be to not set options.file, in which case the importer 'prev' will be 'stdin'
    // However, this would result in problems if a file named std�n.scss would exist.
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
