const Order = require("./models/Order");
const DriverOrder = require("./models/DriverOrder");
const { ObjectID } = require("mongodb");

const routes = (app, db) => {
  //home
  app.get("/", (req, res) => {
    res.send("<h1>hi world</h1>");
  });

  //order from taxiApp user
  app.post("/api/order", async (req, res) => {
    try {
      const orderDB = new Order(req.body);
      const data = await orderDB.save();
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(400).json({ success: false, err });
    }
  });

  //waiting for order from driver user
  app.put("/api/driverOpenToOrder/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const data = await DriverOrder.findOneAndUpdate(
        { _id: userId },
        { myLocation: req.body.myLocation },
        { new: true, useFindAndModify: false }
      );
      return res.status(200).json({ success: true, data });
    } catch (err) {
      return res.status(400).json({ success: false, err });
    }
  });
};

module.exports = routes;
