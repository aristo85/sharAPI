const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const jwt = require("jsonwebtoken");

//create Schema for taxiApp order
const ItemSchema = new Schema({
  username: {
    type: String,
  },
  password: {
    type: String,
  },
  userType: {
    type: String,
  },
  token: {
    type: String,
  },
});
// creating method (findByToken) in the Client model
ItemSchema.statics.findByToken = function (token, cb) {
  let user = this;
  jwt.verify(token, "secret", function (err, decode) {
    user.findOne({ _id: decode, token: token }, function (err, user) {
      cb(null, user);
    });
  });
};

module.exports = ClientUser = mongoose.model("clientUser", ItemSchema);
