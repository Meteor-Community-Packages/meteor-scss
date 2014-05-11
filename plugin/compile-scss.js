var path = Npm.require('path');
var sass = Npm.require('node-sass');
var fs = Npm.require('fs');
var _ = Npm.require('lodash');

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

Plugin.registerSourceHandler("scss", function (compileStep) {
  // Return if it's a partial, we don't want to output those as css files.
  if (path.basename(compileStep.inputPath)[0] === '_') return;
  // XXX annoying that this is replicated in .css, .less, and .styl
  if (! compileStep.archMatches('browser')) {
    // XXX in the future, might be better to emit some kind of a
    // warning if a stylesheet is included on the server, rather than
    // silently ignoring it. but that would mean you can't stick .css
    // at the top level of your app, which is kind of silly.
    return;
  }

  var optionsFile = path.join(process.cwd(), 'scss.json');
  var scssOptions = {};

  if (fs.existsSync(optionsFile)) {
    scssOptions = loadJSONFile(optionsFile);
  }

  var options = _.extend({}, scssOptions, {
    sourceComments: 'map'
  });

  options.file = compileStep._fullInputPath;

  if (!_.isArray(options.includePaths)) {
    options.includePaths = [options.includePaths];
  }

  options.includePaths = options.includePaths.concat(path.dirname(compileStep._fullInputPath));

  var css;
  try {
    css = sass.renderSync(options);
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
  compileStep.addStylesheet({
    path: compileStep.inputPath + ".css",
    data: css
  });
});

Plugin.registerSourceHandler("scssimport", function () {
  // Do nothing
});
