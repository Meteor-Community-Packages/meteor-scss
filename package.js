Package.describe({
  summary: 'Style with attitude and autoprefixer.',
  version: "1.0.0",
  git: "https://github.com/fourseven/meteor-scss.git"
});

Package._transitional_registerBuildPlugin({
  name: 'fourseven:scss',
  sources: [
    'plugin/compile-scss.js'
  ],
  npmDependencies: {
    'node-sass': '1.0.0',
    'lodash': '2.4.1',
    'autoprefixer-core': '3.1.0',
  }
});

Package.on_test(function (api) {
  api.use(['test-helpers',
           'tinytest',
           'jquery',
           'templating']);
  api.use(['fourseven:scss']);
  api.add_files(['test/scss_tests.html', 'test/scss_tests.js'], 'client');
  api.add_files(['test/scss_tests.scss'], 'client',  {isTest:true});
});
