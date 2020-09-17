const bCrypt = require("bcrypt");
const ClientUser = require("./models/ClientUser");
const jwt = require("jsonwebtoken");

module.exports = (app, db) => {
  const clientAuth = (req, res, next) => {
    let token = req.headers.authorization;
    // call the (findByToken) method from userClient
    ClientUser.findByToken(token, (err, user) => {
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
  app.get("/api/client/auth", clientAuth, (req, res) => {
    res.status(200).json({
      _id: req._id,
      isAuth: true,
      username: req.user.username,
    });
  });
  //******************************************************************************************* */
  // client registering a user
  app.post("/api/client/register", (req, res, next) => {
    ClientUser.findOne({ username: req.body.username }, function (err, user) {
      if (err) {
        next(err);
      } else if (user) {
        // if the user already exist
        res.status(400).json({
          success: false,
          message: "user with this name is exists",
        });
      } else {
        // otherwise hashing the password and save the user in DB
        const hash = bCrypt.hashSync(req.body.password, 10);
        const newUser = new ClientUser({
          username: req.body.username,
          password: hash,
          // userType: req.body.userType,
        });
        newUser.save((err, user) => {
          if (err) {
            res.status(400).json({
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
              });
            });
          }
        });
      }
    });
  });
  //******************************************************************************************* */
  // client log in user
  app.post("/api/client/login", (req, res) => {
    // find user
    ClientUser.findOne({ username: req.body.username }, function (err, user) {
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
            });
          });
        }
      });
    });
  });
  // logout a client by removing its token on DB
  app.get("/api/client/logout", clientAuth, (req, res) => {
    ClientUser.findOneAndUpdate(
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
