# Sass for Meteor
This is a Sass build plugin for Meteor. It compiles Sass files with node-sass and it has options to control the load order of Sass files and use Autoprefixer on the generated CSS.

## Installation

Install using Meteor's package management system:

```bash
> meteor add fourseven:scss
```

## Usage
Without any additional configuration after installation, this package automatically finds all `.scss` and `.sass` files in your project, compiles them with [node-sass](https://github.com/sass/node-sass), and includes the resulting CSS in the application bundle that Meteor sends to the client. The files can be anywhere in your project.

## Configuration
This package has options that can be specified in a `scss.json` file in the project's root directory. Please restart your server after changing this file to allow Sass to recompute your css.

### includePaths
If you have packages that have stylesheets you want to import, you can add those paths to the compiler to simplify importing them

For example, if you're using Bourbon and Neat with [mquandalle:bower](https://github.com/mquandalle/meteor-bower)

```json
{
  "includePaths": [
    ".meteor/local/bower",
    ".meteor/local/bower/node-bourbon/assets/stylesheets",
    ".meteor/local/bower/neat/app/assets/stylesheets"
  ]
}
```

Note: On an initial build, i.e. after a fresh `meteor reset`, importing sass files from packages will throw an error, because the `.meteor/local/` directory doesn't exist yet.

### Sourcemaps [since 2.0.0_1]
These are on by default. To disable please set the following in `scss.json`:
```json
{
  "sourceMap": false
}
```

### Controlling load order [since 2.0.0-beta_3]
Out of the box, if you want to use variables and mixins in a Sass file, they must be explicitly imported. In addition, there is no easy way to control which files are loaded first, which can be crucial if you're using a CSS framework like Bootstrap or even just trying to share global styles appropriately. Having a single file that imports all of the other Sass files, an index file of sorts, solves this, but is tedious and fragile to manually maintain. This package provides a mechanism to automate that.

If the `"useIndex"` option in the `scss.json` file is `true`, this plugin will make a file named `index.scss` that has imports for every `.scss` and `.sass` file in the project, with the exception of files whose names are prefixed with an underscore (i.e. partials). You can specify a different filepath for the index file (instead of `index.scss`) with the `"indexFilePath"` option.

Example:

```json
{
  "useIndex" : true,
  "indexFilePath" : "client/stylesheets/main.scss"
}
```
New Sass files will have import statements automatically appended to the index file. Existing content will never be overwritten. You can arrange the imports in any order you want. Import your mixins and theme variables first and put them in "scope" for all of the others.

### Autoprefixer
To enable [Autoprefixer](https://github.com/postcss/autoprefixer) set `"enableAutoprefixer"` to `true` in your `scss.json` file. You can configure what options are given to Autoprefixer with the `"autoprefixerOptions"` field. See the [Autoprefixer](https://github.com/postcss/autoprefixer-core#usage) docs to see what the default options are.

Example:

```json
{
  "enableAutoprefixer": true,
  "autoprefixerOptions": {
      "browsers": ["> 5%", "BlackBerry", "OperaMini"],
      "cascade": false
  }
}
```


## LibSass vs Ruby Sass
Please note that this project uses [LibSass](https://github.com/hcatlin/libsass). LibSass is a C++ implementation of the Ruby Sass compiler. It has most of the features of the Ruby version, but not all of them. Things are improving, so please be patient. Before you ask, I have no intention of making a version of this package that links to the Ruby version instead.

For a quick rundown on what libsass does and doesn't (currently) do, [check here](http://sass-compatibility.github.io/).


## Heroku
If you're having problems running this on Heroku please use the cedar-14 stack, by typing the following `heroku stack:set cedar-14` - see [#41](https://github.com/fourseven/meteor-scss/issues/41) for more information.
