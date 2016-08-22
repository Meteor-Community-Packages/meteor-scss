# Sass for Meteor
This is a Sass build plugin for Meteor. It compiles Sass files with node-sass and it has options to control the load order of Sass files and use Autoprefixer on the generated CSS.

## Installation

Install using Meteor's package management system:

```bash
> meteor add fourseven:scss
```

If you want to use it for your package, add it in your package control file's
`onUse` block:

```javascript
Package.onUse(function (api) {
  ...
  api.use('fourseven:scss');
  ...
});
```

## Compatibility
<table>
<thead>
<tr><th>Meteor Version</th><th>Recommended fourseven:scss version</th></tr>
</thead>
<tbody>
<tr><td>1.0 - 1.1</td><td>3.2.0</td></tr>
<tr><td>1.2 - 1.3.1</td><td>3.4.2</td></tr>
<tr><td>1.3.2+</td><td>3.8.0</td></tr>
<tr><td>1.4.0</td><td>3.8.1</td></tr>
<tr><td>1.4.1+</td><td>3.9.0</td></tr>
</tbody>
</table>

Since `meteor 1.4.1+` (`fourseven:scss 3.9.0+`), we do not have prebuild binaries anymore. You are required to set up the [required toolchain](https://github.com/nodejs/node-gyp) yourselves.

**Note that due to a bug in libsass, there is currently no support for the old, indented sass syntax**

## Usage
Without any additional configuration after installation, this package automatically finds all `.scss` and `.sass` files in your project, compiles them with [node-sass](https://github.com/sass/node-sass), and includes the resulting CSS in the application bundle that Meteor sends to the client. The files can be anywhere in your project.

### File types

There are two different types of files recognized by this package:

- Sass sources (all `*.scss` and `*.sass` files that are not imports)
- Sass imports/partials, which are:
  * files that are prefixed with an underscore `_`
  * marked as `isImport: true` in the package's `package.js` file:
    `api.addFiles('x.scss', 'client', {isImport: true})`
  * Starting from Meteor 1.3, all files in a directory named `imports/`

The source files are compiled automatically (eagerly loaded). The imports are not loaded by
themselves; you need to import them from one of the source files to use them.

The imports are intended to keep shared mixins and variables for your project,
or to allow your package to provide several components which your package's
users can opt into one by one.

Each compiled source file produces a separate CSS file.  (The
`standard-minifiers` package merges them into one file afterwards.)

### Importing

You can use the regular `@import` syntax to import any Sass files: sources or
imports.

Besides the usual way of importing files based on the relative path in the same
package (or app), you can also import files from other packages or apps with the
following syntax.

Importing styles from a different package:

```scss
@import "{my-package:pretty-buttons}/buttons/_styles.scss";

.my-button {
  // use the styles imported from a package
  @extend .pretty-button;
}
```

Importing styles from the target app:

```scss
@import "{}/client/styles/imports/colors.scss";

.my-nav {
  // use a color from the app style pallete
  background-color: @primary-branding-color;
}
```

### Sourcemaps
These are on by default.

### Autoprefixer
As of Meteor 1.2 autoprefixer should preferably be installed as a separate plugin. You can do so by running:

```
meteor remove standard-minifiers
meteor add seba:minifiers-autoprefixer@0.0.2
```

In a Meteor 1.3+ project, do the same by running:
```
meteor remove standard-minifier-css
meteor add seba:minifiers-autoprefixer
```

## LibSass vs Ruby Sass
Please note that this project uses [LibSass](https://github.com/hcatlin/libsass). LibSass is a C++ implementation of the Ruby Sass compiler. It has most of the features of the Ruby version, but not all of them. Things are improving, so please be patient. Before you ask, I have no intention of making a version of this package that links to the Ruby version instead.

For a quick rundown on what libsass does and doesn't (currently) do, [check here](http://sass-compatibility.github.io/).
