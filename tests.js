Tinytest.add("sass/scss - imports", function (test) {
  var div = document.createElement('div');
  document.body.appendChild(div);

  var prefixes = ['scss'];

  try {
    var t = function (className, style) {
      prefixes.forEach(function(prefix){
        div.className = prefix + '-' + className;

        // Read 'border-top-style' instead of 'border-style' (which is set
        // by the stylesheet) because only the individual styles are computed
        // and can be retrieved. Trying to read the synthetic 'border-style'
        // gives an empty string.
        test.equal(getStyleProperty(div, 'border-top-style'), style,  div.className);
      });

    };
    t('el1', 'dotted');
    t('el2', 'dashed');
    t('el3', 'solid');
    t('el4', 'double');
    t('el5', 'groove');
    t('el6', 'inset');

    // This is assigned to 'ridge' in not-included.s(a|c)ss, which is ... not
    // included. So that's why it should be 'none'.  (This tests that we don't
    // process non-main files.)
    t('el0', 'none');
  } finally {
    document.body.removeChild(div);
  }
});


Tinytest.add('sass/scss - import from includePaths', function (test) {

  var div = document.createElement('div');

  document.body.appendChild(div);

  try {

    div.className = 'from-include-paths';

    test.equal(getStyleProperty(div, 'border-bottom-style'), 'outset',  div.className);

  } finally {

    document.body.removeChild(div);

  }

});

Tinytest.add('sass/scss - read environment variables with env()', function (test) {
  var div = document.createElement('div');
  document.body.appendChild(div);

  try {
    div.className = 'from-env';
    test.equal(getStyleProperty(div, 'width'), '1px', div.className);
  } finally {
    document.body.removeChild(div);
  }
});
