const Order = require("./models/Order");
const DriverOrder = require("./models/DriverOrder");
const DriverState = require("./models/DriverState");
const ClientState = require("./models/ClientState");

const passport = require("passport");
const DriverUser = require("./models/DriverUser");
const ClientUser = require("./models/ClientUser");

const routes = (app, db) => {
  // chek authentication of user request
  function ensureAuthenticated(req, res, next) {
    passport.authenticate("driver", { failureRedirect: "/" });
    if (req.isAuthenticated("driver")) {
      return next();
    }
    res.redirect("/");
  }
  //******************************************************************************************* */
  // chek authentication of user request
  function ensureAuthclient(req, res, next) {
    passport.authenticate("client", { failureRedirect: "/" });
    if (req.isAuthenticated()) {
      return next();
    }
    res.redirect("/");
  }
  //******************************************************************************************* */
  // app.get("/logout", function (req, res) {
  //   req.logout();
  //   res.redirect("/");
  // });
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
  //save the executed order to order history in both client and driver users
  app.put("/api/driverOrderHistory/:id", async (req, res) => {
    const clientId = req.body.orderLoader.userId;
    const userId = req.params.id;
    let updateAdder = {
        $push: { orderedHistory: { $each: [req.body], $position: 0 } },
      },
      options = {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        useFindAndModify: false,
      };
    try {
      // save it to the driver
      const driverData = await DriverUser.findOneAndUpdate(
        { _id: userId },
        updateAdder,
        options
      );
      // and to the client
      const clientData = await ClientUser.findOneAndUpdate(
        { _id: clientId },
        updateAdder,
        options
      );
      // console.log(clientData.orderedHistory.length);
      // delete the last order for driver if its more than 100 in the list
      if (driverData.orderedHistory.length > 100) {
        await DriverUser.findOneAndUpdate(
          { _id: userId },
          { $pop: { orderedHistory: 1 } },
          options
        );
      }
      // delete the last order for client if its more than 10 in the list
      if (clientData.orderedHistory.length > 10) {
        await ClientUser.findOneAndUpdate(
          { _id: clientId },
          { $pop: { orderedHistory: 1 } },
          options
        );
      }

      // then clean both states of client and driver
      await DriverState.findOneAndRemove(
        { uberId: userId },
        { new: true, useFindAndModify: false }
      );
      await ClientState.findOneAndRemove(
        { clientId: clientId },
        { new: true, useFindAndModify: false }
      );
      return res.status(200).json({ success: true, driverData });
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
  //get a client rating
  app.get("/api/getClientRating/:clientId", async (req, res) => {
    const clientId = req.params.clientId;

    try {
      const data = await ClientUser.findOne({ _id: clientId });
      return res.status(200).json({ success: true, data: data.rating });
    } catch (err) {
      return res.status(400).json({ success: false, err });
    }
  });
  //******************************************************************************************* */
  //get a driver rating
  app.get("/api/getDriverRating/:driverId", async (req, res) => {
    const driverId = req.params.driverId;

    try {
      const data = await DriverUser.findOne({ _id: driverId });
      // console.log(data)
      return res.status(200).json({ success: true, data: data.rating });
    } catch (err) {
      return res.status(400).json({ success: false, err });
    }
  });
  //******************************************************************************************* */
  //client rates the driver
  app.put("/api/clientRateTheDriver/:driverId", async (req, res) => {
    const driverId = req.params.driverId;
    const rateNumber = req.body.rateNumber > 0 ? req.body.rateNumber : 4.9;
    let updateAdder = {
        $push: { rating: { $each: [rateNumber], $position: 0 } },
      },
      options = {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        useFindAndModify: false,
      };
    try {
      // save it to the driver
      const driverData = await DriverUser.findOneAndUpdate(
        { _id: driverId },
        updateAdder,
        options
      );
      // delete the last order for driver if its more than 100 in the list
      if (driverData.rating.length > 100) {
        await DriverUser.findOneAndUpdate(
          { _id: driverId },
          { $pop: { rating: 1 } },
          options
        );
      }
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(400).json({ success: false, err });
    }
  });
  //******************************************************************************************* */
  //driver rates the client
  app.put("/api/driverRateTheClient/:clientId", async (req, res) => {
    const clientId = req.params.clientId;
    const rateNumber = req.body.rateNumber > 0 ? req.body.rateNumber : 4.9;
    let updateAdder = {
        $push: { rating: { $each: [rateNumber], $position: 0 } },
      },
      options = {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        useFindAndModify: false,
      };
    try {
      // save it to the client
      const clientData = await ClientUser.findOneAndUpdate(
        { _id: clientId },
        updateAdder,
        options
      );
      // delete the last order for client if its more than 100 in the list
      if (clientData.rating.length > 10) {
        await ClientUser.findOneAndUpdate(
          { _id: clientId },
          { $pop: { rating: 1 } },
          options
        );
      }
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(400).json({ success: false, err });
    }
  });
  //******************************************************************************************* */
};

module.exports = routes;
