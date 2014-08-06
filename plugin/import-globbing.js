var fs = Npm.require('fs');
var _ = Npm.require('lodash');
var glob = Npm.require('glob');
var chalk = Npm.require('chalk');


initializeTarget = function (parsedImport) {
  var fileExts = /\.(scssimport|scss|sass|css)/;
  var target = {
    line: parsedImport[0],
    start: parsedImport[1],
    path: parsedImport[2] || '',
    file:  parsedImport[3] || '*', //import all from path if no filename
    end: parsedImport[4],
  }
  target.quotemark = target.start.slice(-1); // ' or " 
  target.leadingUnderscore = (target.file[0] === '_'); // boolean
  target.fileExtension = fileExts.exec(target.file);
  target.fileExtension = target.fileExtension && target.fileExtension[1];

  return target;
}


//exclude certain import targets from globbing
shouldBeGlobbed = function (target) {
  var shouldGlob = true;
  if (/http:\/\//.test(target.file)) {
    shouldGlob = false;
  }
  else if (~(target.path + target.file).indexOf(target.quotemark)) {
    // for now, not globbing more than one export file per line.
    // e.g., @export "file a", "file path/*"; will fail
    shouldGlob = false;
  }
  else if (target.fileExtension === 'css') {
    shouldGlob = false;
  }
  return shouldGlob;
}

// Sass allows @imports to be specified without a leading
// underscore or a file extension. Node-glob doesn't know
// about these, so we have to search all the possibilities.
// meteor-scss also allows the .scssimport extension
var possiblePaths = function (target) {
  var paths;
  if (target.fileExtension === 'scssimport'){
    // e.g., @import "style.scssimport"
    paths = [target.path + target.file];
  }
  else if(target.fileExtension === 'scss' || target.fileExtension === 'sass') {
    // e.g., @import "style.sass" 
    // or    @import "_style.sass"
    var importFile = target.file;
    if (! target.leadingUnderscore)
      importFile = '_' + target.file;
    paths = [target.path + importFile];
  }
  else if(target.leadingUnderscore){
    // e.g., @import "_style"
    paths = [
      target.path + target.file + '.scss',
      target.path + target.file + '.sass'
    ];
  }
  else {
    // no filename cues, e.g., @import "style"
    paths = [
      target.path +'_' + target.file + '.scss',
      target.path + '_' + target.file + '.sass',
      target.path + target.file + '.scssimport'
    ];
  }
  return paths;
}


expandGlobs = function (target, cwd) {
  var globs = [];
  _.each(possiblePaths(target), function (path) {
    globs = globs.concat(glob.sync(path, {cwd: cwd}));
  });
  if (globs.length === 0){
    // No results found. If the target contains the `*` character,
    // silently drop the export but warn in the console.
    // Otherwise, pass through so sass can return an error
    // and mistyped names won't silently disappear.
    // XXX Targeting only `*` is a bit arbitrary. Should we
    // be targeting all glob characters?
    var asteriskPresentInPath = ~(target.path + target.file).indexOf('*');
    if (asteriskPresentInPath){
      console && console.log(chalk.yellow('\nSCSS: no files found to import for:', 
        target.path + target.file));
    }
    else {
      // Restore original path
      globs.push(target.path + target.file);
    }
  }
  return globs;
}


// coordinate globbing for a single @import line
performGlobbing = function (parsedImport, cwd) {
  var target = initializeTarget(parsedImport);
  if (shouldBeGlobbed(target)){
    // insert globbed @import statements in place of original
    var paths = expandGlobs(target, cwd);
    var importStatements = _.map(paths, function (path) {
      return  target.start + path + target.end;
    })
    return importStatements.join('\n');
  }
  else {
    // pass @import statement as-is w/o globbing
    return target.line;
  }
};


/************************
* Loads sass/scss file and expands any globbed @import paths.
* Each @import statement with globbing is replaced by
* multiple explicit @import statements.
* The resulting file is then fed back to node-sass.
*************************/
globImports = function (sourcePath) {
  var result = '';

  var sourceContents = fs.readFileSync(sourcePath, 'utf8');
  sourceContents = sourceContents || "\n"; // prevent empty string error

  var cwd = /(.*\/)?/.exec(sourcePath);
  cwd = (cwd && cwd[1]) || '';

  // importParser splits any import line into 4 parts. The 2nd and 3rd
  // parts contains the path/filename for globbing (bounded by quotation marks)
  // 1st and 4th parts contain the rest of the line to copy around globbed paths.
  importParser = /(.*?@import\s['"])(.*\/)?(.*)(['"].*)/;
  var lines = sourceContents.split('\n');
  _.each(lines, function (line) {
    var parsedImport = importParser.exec(line);
    if (parsedImport) {
      result = result + performGlobbing(parsedImport, cwd) + '\n';
    }
    else{
      // line is not @import; just copy to output
      result = result + line + '\n';
    }

  });
  
  return result;
}