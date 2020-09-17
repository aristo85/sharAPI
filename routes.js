const Order = require("./models/Order");
const DriverOrder = require("./models/DriverOrder");
const DriversOrderHistory = require("./models/DriversOrderHistory");
const DriverState = require("./models/DriverState");
const ClientState = require("./models/ClientState");
// const ClientUser = require("./models/ClientUser");

const passport = require("passport");
// const bCrypt = require("bcrypt");
// const DriverUser = require("./models/DriverUser");

const routes = (app, db) => {
  // chek authentication of user request
  function ensureAuthenticated(req, res, next) {
    passport.authenticate("driver", { failureRedirect: "/" })
    if (req.isAuthenticated("driver")) {
      return next();
    }
    res.redirect("/");
  }
  //******************************************************************************************* */
  // chek authentication of user request
  function ensureAuthclient(req, res, next) {
    passport.authenticate("client", { failureRedirect: "/" })
    if (req.isAuthenticated()) {
      return next();
    }
    res.redirect("/");
  }
  //******************************************************************************************* */
  app.get('/logout', function(req, res){
    req.logout();
    res.redirect('/');
  });
  //home
  app.get("/", async (req, res) => {
    res.send("hi everyone");
  });
  
  //******************************************************************************************* */
  app.get("/profile", ensureAuthenticated, (req, res) => {
    res.send("now you pass");
  });
  //******************************************************************************************* */
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
  //******************************************************************************************* */
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
  //******************************************************************************************* */
  //save the executed order to order history
  app.put("/api/driverOrderHistory/:id", async (req, res) => {
    const clientId = req.body.orderLoader.userId;
    const userId = req.params.id;
    let query = { driverId: userId },
      update = req.body,
      options = {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        useFindAndModify: false,
      };
    try {
      const data = await DriversOrderHistory.findOneAndUpdate(
        query,
        update,
        options
      );
      await DriverState.findOneAndRemove(
        { uberId: userId },
        { new: true, useFindAndModify: false }
      );
      await ClientState.findOneAndRemove(
        { clientId: clientId },
        { new: true, useFindAndModify: false }
      );
      return res.status(200).json({ success: true, data });
    } catch (err) {
      return res.status(400).json({ success: false, err });
    }
  });
  //******************************************************************************************* */
  //delete temporary order state
  app.delete("/api/deleteOrderStates/:userId/:driverId", async (req, res) => {
    const clientId = req.params.userId;
    const driverId = req.params.driverId;
    try {
      // if the order already accepted, then the driver state should be clreared
      if (driverId) {
        await DriverState.deleteMany(
          { uberId: driverId },
          { new: true, useFindAndModify: false }
        );
      }
      if (clientId && clientId !== "null") {
        await ClientState.deleteMany(
          { clientId: clientId },
          { new: true, useFindAndModify: false }
        );
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(400).json({ success: false, err });
    }
  });
  //******************************************************************************************* */
  //get a driver state
  app.get("/api/getDriverState/:driverId", async (req, res) => {
    const driverId = req.params.driverId;

    try {
      const data = await DriverState.findOne({ uberId: driverId });
      return res.status(200).json({ success: true, data });
    } catch (err) {
      return res.status(400).json({ success: false, err });
    }
  });

  //get a client state
  app.get("/api/getClientState/:clientId", async (req, res) => {
    const clientId = req.params.clientId;

    try {
      const data = await ClientState.findOne({ clientId: clientId });
      return res.status(200).json({ success: true, data });
    } catch (err) {
      return res.status(400).json({ success: false, err });
    }
  });
  //******************************************************************************************* */
};

module.exports = routes;
