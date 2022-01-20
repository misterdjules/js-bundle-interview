const foo = require("./foo.js");

module.exports = {
  bar: () => {
    console.log("in bar.bar()");
    if (foo.foo) {
      console.log(foo.foo());
    }
  },
};
