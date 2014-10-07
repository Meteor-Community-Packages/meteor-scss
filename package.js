Package.describe({
  summary: 'Style with attitude and autoprefixer.',
  version: "0.9.6",
  git: "https://github.com/fourseven/meteor-scss.git"
});

Package._transitional_registerBuildPlugin({
  name: 'meteor-scss',
  sources: [
    'plugin/compile-scss.js'
  ],
  npmDependencies: {
    'node-sass': '0.9.6',
    'lodash': '2.4.1',
    'autoprefixer-core': '3.1.0',
  }
});

Package.on_test(function (api) {
  api.use(['test-helpers',
           'tinytest',
           'jquery',
           'templating']);
  api.use(['meteor-scss']);
  api.add_files(['test/scss_tests.html', 'test/scss_tests.js'], 'client');
  api.add_files(['test/scss_tests.scss'], 'client',  {isTest:true});
});
