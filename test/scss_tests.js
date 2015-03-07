renderToDiv = function(comp) {
  var body = document.getElementsByTagName("body")[0];
  Blaze.render(comp, body);
}

Tinytest.add("sass - presence", function(test) {
  renderToDiv(Template.test_p_tag);

  var p = $('.sass-dashy-left-border-transition');

  test.equal(p.css('border-left-style'), "dashed");

  // test @import
  test.equal(p.css('border-right-style'), "dotted");

  p.remove();
});

Tinytest.add("sass - autprefixer presence and function", function(test) {
  renderToDiv(Template.test_p_tag);

  var p = $('.sass-dashy-left-border-transition');
  // Prints a list of css properties supported by the phantomjs browser version
  // in use. Obviously this list will change for new releases. Also at some
  // point in time, phantomjs will support the unprefixed transition property
  // and then the test will break again (or even worse, fail to actually test
  // the SUT).
  console.log('XXXX: ' + JSON.stringify(window.getComputedStyle(p.get(0))));

  // Note that '-webkit-transition' is a shorthand property (just like
  // 'background'). We only can run assertions against the actual properties,
  // testing the shorthand does not work.
  // @see: https://developer.mozilla.org/en-US/docs/Web/CSS/Shorthand_properties
  test.equal(p.css('-webkit-transition-duration'), '1s');

  p.remove();
});
