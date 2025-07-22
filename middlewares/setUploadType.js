// middlewares/setUploadType.js

const setUploadType = (type) => {
  return (req, res, next) => {
    req.uploadType = type;
    next();
  };
};

module.exports = setUploadType;
