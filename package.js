Package.describe({
  summary: 'Style with attitude. Sass and SCSS support for Meteor.js.',
  version: '4.12.0',
  git: 'https://github.com/fourseven/meteor-scss.git',
  name: 'fourseven:scss',
});

Package.registerBuildPlugin({
  name: 'compileScssBatch',
  use: ['caching-compiler@1.2.0', 'ecmascript@0.12.0'],
  sources: ['plugin/compile-scss.js'],
  npmDependencies: {
    'sass': '1.26.10',
  },
});

Package.onUse(function(api) {
  api.versionsFrom('1.8');
  api.use('isobuild:compiler-plugin@1.0.0');
});

Package.onTest(function(api) {
  api.use(['test-helpers', 'tinytest']);

  api.use(['fourseven:scss']);

  // Tests for .scss
  api.addFiles([
    'test/scss/_emptyimport.scss',
    'test/scss/_not-included.scss',
    'test/scss/_top.scss',
    'test/scss/_top3.scss',
    'test/scss/empty.scss',
    'test/scss/dir/_in-dir.scss',
    'test/scss/dir/_in-dir2.scss',
    'test/scss/dir/root.scss',
    'test/scss/dir/subdir/_in-subdir.scss',
  ]);

  api.addFiles('test/scss/top2.scss', 'client', { isImport: true });

  // Test for includePaths
  api.addFiles(['test/include-paths/include-paths.scss', 'test/include-paths/modules/module/_module.scss']);

  api.addFiles('tests.js', 'client');
});
