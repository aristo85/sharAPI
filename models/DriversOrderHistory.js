const mongoose = require("mongoose");
const Schema = mongoose.Schema;

//create Schema for taxiApp order
const ItemSchema = new Schema({
  driverId: {
    type: String,
  },
  orderLoader: {
    type: Object,
    // required: true,
  },
  orderedDate: {
    type: String,
  },
});

module.exports = DriversOrderHistory = mongoose.model(
  "driversOrderHistory",
  ItemSchema
);
