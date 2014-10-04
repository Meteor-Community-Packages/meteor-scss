meteor-scss
===========

Node-sass wrapped to work with meteor.

This allows .scss and .sass files to work with meteor.

Also includes the option to run [Autoprefixer](https://github.com/postcss/autoprefixer) on the css that sass has compiled.

To use:
This package is configured to find *.scss *.sass files and compile them through node-sass and provide them to the page. So just start using it, the scss files can be anywhere in the project.

Configuration
-------------

Add a `scss.json` file at the project's root to pass configuration options to node-sass. See [node-sass](https://github.com/andrew/node-sass)'s documentation for a list of options.

Example (for using bourbon and neat with meteor-bower):

```json
{
  "includePaths": [
    ".meteor/local/bower",
    ".meteor/local/bower/node-bourbon/assets/stylesheets",
    ".meteor/local/bower/neat/app/assets/stylesheets"
  ]
}
```

Autoprefixer support
--------------------
To enable Autoprefixer support, set 'enableAutoprefixer' to true in your 'scss.json' file. Custom [Autoprefixer config](https://github.com/postcss/autoprefixer-core#usage) can be set in the 'autoprefixerOptions' variable in the same file. If you don't specify any options, the [default](https://github.com/postcss/autoprefixer-core#usage) config will be used.

Autoprefixer example:

```json
{
  "enableAutoprefixer": true,
  "autoprefixerOptions": {
      "browsers": ["> 5%", "BlackBerry", "OperaMini"],
      "cascade": false
  }
}
```


Meteor 0.8.0
------------
Please use 0.8.4 or above for meteor 0.8.x, and 0.8.3 for earlier. The API has changed and as such these are the compatible versions.
