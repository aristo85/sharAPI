const mongoose = require("mongoose");
const Schema = mongoose.Schema;

//create Schema for taxiApp order
const ItemSchema = new Schema({
  uberId: {
    type: String,
  },
  orderDate: {
    type: Number,
  },
  driverState: {
    type: String,
  },
  isOrderExecuted: {
    // type: String,
  },
  pickedClient: {
    type: Boolean,
  },
  isUserComing: {
    type: Boolean,
  },
  isDriverWaiting: {
    type: Boolean,
  },
  isOrderAccepted: {
    type: Boolean,
  },
  orderLoader: {
    type: Object,
  },
  isSwitch: {
    type: Boolean,
  },
  messageList: {
    type: Array,
  },
});

module.exports = DriverState = mongoose.model("driverState", ItemSchema);
