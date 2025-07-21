// // plugins/softDeletePlugin.js


// module.exports = function softDeletePlugin(schema) {
//   // Automatically filter out soft-deleted documents
//   function excludeDeletedMiddleware() {
//     const query = this.getQuery();
//     if (!query.includeDeleted) {
//       query.isDeleted = false;
//     } else {
//       delete query.includeDeleted;
//     }
//   }

//   schema.pre(/^find/, excludeDeletedMiddleware);
//   schema.pre(/^count/, excludeDeletedMiddleware);
//   schema.pre(/^countDocuments/, excludeDeletedMiddleware);
//   schema.pre(/^findOne/, excludeDeletedMiddleware);
//   schema.pre(/^findOneAndUpdate/, excludeDeletedMiddleware);

//   // Instance method
//   schema.methods.softDelete = function () {
//     this.isDeleted = true;
//     this.deletedAt = new Date();
//     return this.save();
//   };

//   schema.methods.restore = function () {
//     this.isDeleted = false;
//     this.deletedAt = null;
//     return this.save();
//   };

//   // Static methods
//   schema.statics.softDeleteById = async function (id) {
//     return this.findByIdAndUpdate(id, {
//       isDeleted: true,
//       deletedAt: new Date(),
//     });
//   };

//   schema.statics.restoreById = async function (id) {
//     return this.findByIdAndUpdate(id, {
//       isDeleted: false,
//       deletedAt: null,
//     });
//   };
// };
