const bar = require("./bar.js");
const baz = require("./baz.js");

module.exports = {
  foo: () => {
    bar.bar();
    baz.baz();
  },
};
