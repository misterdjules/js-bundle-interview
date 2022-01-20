const bar = require("./bar.js");
console.log("bar module:", bar);
module.exports = {
  foo: () => {
    bar.bar();
  },
};
