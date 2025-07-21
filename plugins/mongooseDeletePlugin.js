const mongooseDelete = require("mongoose-delete");

module.exports = function applySoftDelete(schema) {
  schema.plugin(mongooseDelete, {
    deletedAt: true,
    overrideMethods: "all", // overrides find, count, etc.
  });
};
