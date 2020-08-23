const mongoose = require("mongoose");
const Schema = mongoose.Schema;

//create Schema for taxiApp order
const ItemSchema = new Schema({
  fromWhere: {
    type: Object,
    required: true,
  },
  toGo: {
    type: Object,
    required: true,
  },
  pickUpLocation: {
    type: String,
  },
  orderDetailed: {
    type: Object,
    required: true,
  },
  additionalOptions: {
    type: Object,
    required: true,
  },
  orderedDate: {
    type: String,
  },
});

module.exports = Order = mongoose.model("order", ItemSchema);
