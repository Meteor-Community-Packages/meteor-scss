Package.describe({
  summary: "Style with attitude."
});

Npm.depends({'node-sass': '0.4.4'});
var sass = Npm.require('node-sass');
var fs = Npm.require('fs');
var path = Npm.require('path');

var scss_handler = function (bundle, source_path, serve_path, where) {

  serve_path = serve_path + '.css';

  var options = {
    sync: true,
    includePaths: [path.resolve(source_path, '..')] // for @import
  };

  var contents = fs.readFileSync(source_path, 'utf8');

  try {
    var css = sass.renderSync(contents.toString('utf8'), options);
    bundle.add_resource({
      type: "css",
      path: serve_path,
      data: new Buffer(css),
      where: where
    });
  } catch (e) {
    // sass.render() is supposed to report any errors via its
    // callback. But sometimes, it throws them instead. This is
    // probably a bug in sass. Be prepared for either behavior.
    return bundle.error(source_path + ": Sass compiler error: " + e.message);
  }
};


Package.register_extension("scss", scss_handler);

// Register sassimport files with the dependency watcher, without actually
// processing them.
Package.register_extension("scssimport", function () {});

Package.on_test(function (api) {
  api.use('test-helpers');
  api.add_files(['scss_tests.scss', 'scss_tests.js'], 'client');
});
