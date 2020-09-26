const mongoose = require("mongoose");
const Schema = mongoose.Schema;

//create Schema for taxiApp order
const ItemSchema = new Schema({
  clientId: {
    type: String,
  },
  orderDate: {
    type: Number,
  },
  clientData: {
    type: Object,
  },
  clientState: {
    type: String,
  },
  isOrderExecuted: {
    // type: String,
  },
  toDestination: {
    type: Object,
  },
  driverArrived: {
    type: Object,
  },
  driverAccepted: {
    type: Object,
  },
  driverList: {
    type: Array,
  },
  isClientWaiting: {
    // type: String,
  },
  messageList: {
    type: Array,
  },
});

module.exports = ClientState = mongoose.model("clientState", ItemSchema);
