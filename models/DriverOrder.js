const mongoose = require("mongoose");
const Schema = mongoose.Schema;

//create Schema for taxiApp order
const ItemSchema = new Schema({
  myLocation : {
      type: Object,
      required: true
  },
  orderedDate: {
      type: String
  }
});

module.exports = DriverOrder = mongoose.model("driverOrder", ItemSchema);
