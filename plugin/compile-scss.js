import sass from 'node-sass';
import { promisify } from 'util';
const path = Plugin.path;
const fs = Plugin.fs;

const compileSass = promisify(sass.render);
let _includePaths;
const rootDir = (process.env.PWD || process.cwd()) + "/";

Plugin.registerCompiler({
  extensions: ['scss', 'sass'],
  archMatching: 'web'
}, () => new SassCompiler());

const toPosixPath = function toPosixPath(p, partialPath) {
  // Sometimes, you can have a path like \Users\IEUser on windows, and this
  // actually means you want C:\Users\IEUser
  if (p[0] === "\\" && (!partialPath)) {
    p = process.env.SystemDrive + p;
  }

  p = p.replace(/\\/g, '/');
  if (p[1] === ':' && !partialPath) {
    // transform "C:/bla/bla" to "/c/bla/bla"
    p = `/${p[0]}${p.slice(2)}`;
  }

  return p;
};

const convertToStandardPath = function convertToStandardPath(osPath, partialPath) {
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

  hasUnderscore(file) {
    return path.basename(file).startsWith('_');
  }

  compileOneFileLater(inputFile, getResult) {
    inputFile.addStylesheet({
      path: inputFile.getPathInPackage(),
    }, async () => {
      const result = await getResult();
      return result && {
        data: result.css,
        sourceMap: result.sourceMap,
        };
    });
  }

  async compileOneFile(inputFile, allFiles) {
    const referencedImportPaths = [];

    var totalImportPath = [];
    var sourceMapPaths = [`.${inputFile.getDisplayPath()}`];

    const addUnderscore = (file) => {
      if (!this.hasUnderscore(file)) {
        file = path.join(path.dirname(file), `_${path.basename(file)}`);
      }
      return file;
    }

    const getRealImportPath = (importPath) => {
      const isAbsolute = importPath.startsWith('/');

      //SASS has a whole range of possible import files from one import statement, try each of them
      const possibleFiles = [];

      //If the referenced file has no extension, try possible extensions, starting with extension of the parent file.
      let possibleExtensions = ['scss','sass','css'];

      if(! importPath.match(/\.s?(a|c)ss$/)){
        possibleExtensions = [
          inputFile.getExtension(),
          ...possibleExtensions.filter(e => e !== inputFile.getExtension())
          ]
        for (const extension of possibleExtensions){
          possibleFiles.push(`${importPath}.${extension}`);
        }
      }else{
        possibleFiles.push(importPath);
      }

      //Try files prefixed with underscore
      for (const possibleFile of possibleFiles) {
        if (! this.hasUnderscore(possibleFile)) {
          possibleFiles.push(addUnderscore(possibleFile));
        }
      }

      //Try if one of the possible files exists
      for (const possibleFile of possibleFiles) {
        if ((isAbsolute && fileExists(possibleFile)) || (!isAbsolute && allFiles.has(possibleFile))) {
            return { absolute: isAbsolute, path: possibleFile };
        }
      }
      //Nothing found...
      return null;

    };


    const fixTilde = function(thePath) {
      let newPath = thePath;
      // replace ~ with {}/....
      if (newPath.startsWith('~')) {
        newPath = newPath.replace('~', '{}/node_modules/');
      }

      // add {}/ if starts with node_modules
      if (!newPath.startsWith('{')) {
        if (newPath.startsWith('node_modules')) {
          newPath = '{}/' + newPath;
        }
        if (newPath.startsWith('/node_modules')) {
          newPath = '{}' + newPath;
        }
      }

      return newPath;
    }

    //Handle import statements found by the sass compiler, used to handle cross-package imports
    const importer = function(url, prev, done) {

      prev = fixTilde(prev);
      if (!totalImportPath.length) {
        totalImportPath.push(prev);
      }

      if (prev !== undefined) {

        // iterate backwards over totalImportPath and remove paths that don't equal the prev url
        for (let i = totalImportPath.length - 1; i >= 0; i--) {

          // check if importPath contains prev, if it doesn't, remove it. Up until we find a path that does contain it
          if (totalImportPath[i] == prev) {
            break
          } else {
            // remove last item (which has to be item i because we are iterating backwards)
            totalImportPath.splice(i,1)
          }
        }

      }

      let importPath = fixTilde(url);
      for (let i = totalImportPath.length - 1; i >= 0; i--) {
        if (importPath.startsWith('/') || importPath.startsWith('{')) {
          break;
        }
        // 'path' is the nodejs path module
        importPath = path.join(path.dirname(totalImportPath[i]),importPath);
      }

      let accPosition = importPath.indexOf('{');
      if (accPosition > -1) {
        importPath = importPath.substr(accPosition,importPath.length);
      }

      // TODO: This fix works.. BUT if you edit the scss/css file it doesn't recompile! Probably because of the absolute path problem
      if (importPath.startsWith('{')) {
        // replace {}/node_modules/ for rootDir + "node_modules/"
        importPath = importPath.replace(/^(\{\}\/node_modules\/)/, rootDir + "node_modules/");
        // importPath = importPath.replace('{}/node_modules/', rootDir + "node_modules/");
        if (importPath.endsWith('.css')) {
          // .css files aren't in allFiles. Replace {}/ for absolute path.
          importPath = importPath.replace(/^(\{\}\/)/, rootDir)
        }
      }
      
      try {
        const isAbsolute = importPath.startsWith('/');
        let parsed = getRealImportPath(importPath, isAbsolute);

        if (!parsed) {
          parsed = _getRealImportPathFromIncludes(url, getRealImportPath);
        }
        if (!parsed) {
          //Nothing found...
          throw new Error(`File to import: ${url} not found in file: ${totalImportPath[totalImportPath.length - 2]}`);
        }
        totalImportPath.push(parsed.path);

        if (parsed.absolute) {
          sourceMapPaths.push(parsed.path);
          done({ contents: fs.readFileSync(parsed.path, 'utf8'), file: parsed.path});

        } else {
          referencedImportPaths.push(parsed.path);
          sourceMapPaths.push(decodeFilePath(parsed.path));
          done({ contents: allFiles.get(parsed.path).getContentsAsString(), file: parsed.path});
        }
      } catch (e) {
        return done(e);
      }

    }

    //Start compile sass (async)
    const options = {
      sourceMap: true,
      sourceMapContents: true,
      sourceMapEmbed: false,
      sourceComments: false,
      omitSourceMapUrl: true,
      sourceMapRoot: '.',
      indentedSyntax : inputFile.getExtension() === 'sass',
      outFile: `.${inputFile.getBasename()}`,
      importer,
      includePaths: [],
      precision: 10,
    };

    options.file = this.getAbsoluteImportPath(inputFile);

    options.data = inputFile.getContentsAsBuffer().toString('utf8');

    //If the file is empty, options.data is an empty string
    // In that case options.file will be used by node-sass,
    // which it can not read since it will contain a meteor package or app reference '{}'
    // This is one workaround, another one would be to not set options.file, in which case the importer 'prev' will be 'stdin'
    // However, this would result in problems if a file named stdín.scss would exist.
    // Not the most elegant of solutions, but it works.
    if (!options.data.trim()) {
      options.data = '$fakevariable_ae7bslvbp2yqlfba : blue;';
    }

    let output;
    try {
      output = await compileSass(options);
    } catch (e) {
      inputFile.error({
        message: `Scss compiler error: ${e.formatted}\n`,
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

    const compileResult = { css: output.css.toString('utf-8'), sourceMap: output.map };
    return { compileResult, referencedImportPaths };
  }

  addCompileResult(inputFile, compileResult) {
    inputFile.addStylesheet({
      data: compileResult.css,
      path: `${inputFile.getPathInPackage()}.css`,
      sourceMap: compileResult.sourceMap,
    });
  }
}


function _getRealImportPathFromIncludes(importPath, getRealImportPathFn){

  _prepareNodeSassOptions();

  let possibleFilePath, foundFile;

  for (let includePath of _includePaths) {
    possibleFilePath = path.join(includePath, importPath);
    foundFile = getRealImportPathFn(possibleFilePath);

    if (foundFile) {
      return foundFile;
    }
  }

  return null;
}

/**
 * If not loaded yet, load configuration and includePaths.
 * @private
 */
function _prepareNodeSassOptions() {
  const config = _loadConfigurationFile();
  if (typeof _includePaths === 'undefined' && config.includePaths) {
    _loadIncludePaths(config);
  }
}

/**
 * Extract the 'includePaths' key from specified configuration, if any, and
 * store it into _includePaths.
 * @param config
 * @private
 */
function _loadIncludePaths(config) {
  // Extract includePaths, if any
  const includePaths = config['includePaths'];

  if (includePaths && Array.isArray(includePaths)) {
    _includePaths = includePaths;
  } else {
    _includePaths = [];
  }
}

/**
 * Read the content of 'scss-config.json' file (if any)
 * @returns {{}}
 * @private
 */
function _loadConfigurationFile() {
  return _getConfig('scss-config.json') || {};
}

/**
 * Build a path from current process working directory (i.e. meteor project
 * root) and specified file name, try to get the file and parse its content.
 * @param configFileName
 * @returns {{}}
 * @private
 */
function _getConfig(configFileName) {
  const appdir = process.env.PWD || process.cwd();
  const custom_config_filename = path.join(appdir, configFileName);
  let userConfig = {};

  if (fileExists(custom_config_filename)) {
    userConfig = fs.readFileSync(custom_config_filename, {
      encoding: 'utf8'
    });
    userConfig = JSON.parse(userConfig);
  } else {
    //console.warn('Could not find configuration file at ' + custom_config_filename);
  }
  return userConfig;
}

function decodeFilePath (filePath) {
  const match = filePath.match(/{(.*)}\/(.*)$/);
  if (!match) {
    throw new Error(`Failed to decode sass path: ${filePath}`);
  }

  if (match[1] === '') {
    // app
    return match[2];
  }

  return `packages/${match[1]}/${match[2]}`;
}

function fileExists(file) {
  if (fs.statSync){
    try {
      fs.statSync(file);
    } catch (e) {
      return false;
    }
    return true;
  } else if (fs.existsSync) {
    return fs.existsSync(file);
  }
}