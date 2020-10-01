const bCrypt = require("bcrypt");
const DriverUser = require("./models/DriverUser");
const jwt = require("jsonwebtoken");

module.exports = (app, db) => {
  const driverAuth = (req, res, next) => {
    let token = req.headers.authorization;
    // call the (findByToken) method from userClient
    DriverUser.findByToken(token, (err, user) => {
      if (err) throw err;
      if (!user)
        return res.json({
          isAuth: false,
          error: true,
        });
      req.token = token;
      req.user = user;
      next();
    });
  };
  // token verifier for client
  app.get("/api/driver/auth", driverAuth, (req, res) => {
    res.status(200).json({
      _id: req._id,
      isAuth: true,
      username: req.user.username,
    });
  });
  //   //******************************************************************************************* */
  // client registering a user
  app.post("/api/driver/register", (req, res, next) => {
    DriverUser.findOne({ username: req.body.username }, function (err, user) {
      if (err) {
        next(err);
      } else if (user) {
        // if the user already exist
        res.json({
          success: false,
          message: "user with this name is exists",
        });
      } else {
        // otherwise hashing the password and save the user in DB
        const hash = bCrypt.hashSync(req.body.password, 10);
        const newUser = new DriverUser({
          username: req.body.username,
          password: hash,
          phoneNumber: req.body.phoneNumber,
          email: req.body.email,
          rating: [4.9],
        });
        newUser.save((err, user) => {
          if (err) {
            res.json({
              success: false,
              message: "something gone wrong from server try again later!",
            });
          } else {
            // generateToken and save it in the user DB then response with cookie
            let token = jwt.sign(user._id.toHexString(), "secret");
            user.token = token;
            user.save((err, user) => {
              if (err) return res.status(400).send(err);
              res.cookie("shar_auth", user.token).status(200).json({
                success: true,
                userId: user._id,
                userName: user.username,
                shar_auth: token,
                phoneNumber: user.phoneNumber,
                rating: user.rating,
              });
            });
          }
        });
      }
    });
  });
  //******************************************************************************************* */
  // client log in user
  app.post("/api/driver/login", (req, res) => {
    // find user
    DriverUser.findOne({ username: req.body.username }, function (err, user) {
      if (!user) {
        return res.json({
          success: false,
          message: "Auth failed, user not found",
        });
      }
      // compare the pssword
      bCrypt.compare(req.body.password, user.password, (err, isMatch) => {
        if (!isMatch) {
          res.json({
            success: false,
            message: "wrong password",
          });
        } else {
          // generateToken and save it in the user DB then response with cookie
          let token = jwt.sign(user._id.toHexString(), "secret");
          user.token = token;
          user.save((err, user) => {
            if (err) return res.status(400).send(err);
            res.cookie("shar_auth", user.token).status(200).json({
              success: true,
              userId: user._id,
              userName: user.username,
              shar_auth: token,
              phoneNumber: user.phoneNumber,
              rating: user.rating,
            });
          });
        }
      });
    });
  });
  // logout a client by removing its token on DB
  app.get("/api/driver/logout", driverAuth, (req, res) => {
    DriverUser.findOneAndUpdate(
      { _id: req.user._id },
      { token: "" },
      { useFindAndModify: false },
      (err, doc) => {
        if (err) return res.json({ success: false, err });
        return res.status(200).send({
          success: true,
        });
      }
    );
  });
};
