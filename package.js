Package.describe({
  summary: "Style with attitude."
});

Npm.depends({'node-sass': '0.4.1'});

var scss_handler = function (bundle, source_path, serve_path, where) {
  var sass = Npm.require('node-sass');
  var fs = Npm.require('fs');
  var path = Npm.require('path');
  var Future = Npm.require(path.join('fibers', 'future'));

  serve_path = serve_path + '.css';

  var options = {
    sync: true,
    includePaths: [path.resolve(source_path, '..')] // for @import
  };
  var future = new Future();

  var render_callback = function (err, css) {
    if (err) {
      future.return();
      return bundle.error(source_path + ": Sass compiler error: " + err.message);
    }

    var buffered_css = new Buffer(css);
    bundle.add_resource({
      type: "css",
      path: serve_path,
      data: buffered_css,
      where: where
    });
    future.return();
  };

  var contents = fs.readFileSync(source_path, 'utf8');

  try {
    sass.render(contents.toString('utf8'), render_callback, options);
    return future.wait();
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
