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
  token: {
    type: String,
  },
  phoneNumber: {
    type: String,
  },
  email: {
    type: String,
  },
  rating: {
    type: Number,
  },
});
// creating method (findByToken) in the driver model
ItemSchema.statics.findByToken = function (token, cb) {
  let user = this;
  jwt.verify(token, "secret", function (err, decode) {
    user.findOne({ _id: decode, token: token }, function (err, user) {
      cb(null, user);
    });
  });
};

module.exports = DriverUser = mongoose.model("driverUser", ItemSchema);
