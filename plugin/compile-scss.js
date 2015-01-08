var path = Npm.require('path');
var sass = Npm.require('node-sass');
var fs = Npm.require('fs');
var _ = Npm.require('lodash');
var autoprefixer = Npm.require('autoprefixer-core');
var Future = Npm.require('fibers/future');

var loadJSONFile = function (filePath) {
  var content = fs.readFileSync(filePath);

  try {
    return JSON.parse(content);
  }
  catch (e) {
    console.log("Error: failed to parse ", filePath, " as JSON");

    return {};
  }
};

var sourceHandler = function(compileStep) {
  // Return if it's a partial, we don't want to output those as css files.
  if (path.basename(compileStep.inputPath)[0] === '_') return;
  // XXX annoying that this is replicated in .css, .less, and .styl

  var optionsFile = path.join(process.cwd(), 'scss.json');
  var scssOptions = {};
  var sourceMap   = null;
  var future = new Future;

  if (fs.existsSync(optionsFile)) {
    scssOptions = loadJSONFile(optionsFile);
  }

  var options = _.extend({}, scssOptions, {
    sourceMap:         false,
    outputStyle:       'compressed'
  });

  options.file  = compileStep._fullInputPath;

  if (!_.isArray(options.includePaths)) {
    options.includePaths = [options.includePaths];
  }

  options.includePaths = options.includePaths.concat(path.dirname(compileStep._fullInputPath));

  var success = function (css) {
    if (options.enableAutoprefixer
       || (compileStep.fileOptions && compileStep.fileOptions.isTest)) {
      var autoprefixerOptions = options.autoprefixerOptions || {};

      try {
        // Applying Autoprefixer to compiled css
        var processor = autoprefixer(autoprefixerOptions);
        css = processor.process(css).css;
      } catch (e) {
        compileStep.error({
          message: "Autoprefixer error: " + e,
          sourcePath: e.filename || compileStep.inputPath
        });
        return future.error(e);
      }
    }
    if (options.sourceComments !== 'none') {
      // The following is disabled until 2.0.0-beta2

      // sourceMap = JSON.parse(css.sourceMap);
      // delete sourceMap.file;
      // sourceMap.file = compileStep.pathForSourceMap;
      // sourceMap.sources = [compileStep.inputPath];
      // sourceMap.sourcesContent = [compileStep.read().toString('utf8')];
    }

    compileStep.addStylesheet({
      path: compileStep.inputPath + ".css",
      data: css.css
      // sourceMap: JSON.stringify(sourceMap)
    });
    return future.return(null);
  }
  var error = function (error) {
    return  future.error(error);
  }

  options.success = Meteor.wrapAsync(success);
  options.error = Meteor.wrapAsync(error);

  try {
    sass.render(options);
  } catch (e) {
    // less.render() is supposed to report any errors via its
    // callback. But sometimes, it throws them instead. This is
    // probably a bug in less. Be prepared for either behavior.
    compileStep.error({
      message: "Scss compiler error: " + e.message + "\n" + e,
      sourcePath: e.filename || compileStep.inputPath,
      line: e.line - 1,  // dunno why, but it matches
      column: e.column + 1
    });
    return;
  }
  return future.wait();
}

Plugin.registerSourceHandler("scss", {archMatching: 'web'}, sourceHandler);
Plugin.registerSourceHandler("sass", {archMatching: 'web'}, sourceHandler);

Plugin.registerSourceHandler("scssimport", function () {
  // Do nothing
});
