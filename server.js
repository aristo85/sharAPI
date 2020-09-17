const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");
const session = require("express-session");
const passport = require("passport");
const cookieParser = require("cookie-parser");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);
const cors = require("cors");

const routes = require("./routes");
const authClient = require("./authClient");
const socket_io = require("./socketIo");
const authDriver = require("./authDriver");

// bodyParser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
// app.use(
//   cors({
//     credentials: true,
//     origin: ["http://192.168.0.3:5000/", "http://localhost:5000/"],
//   })
// );

// session settings:
app.use(
  session({
    secret: process.env.SESSION_SECRET || require("./env").SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
  })
);
app.use(passport.initialize());
app.use(passport.session());

// DB config
const connectionKey = process.env.MONGO_URI || require("./env").mongoURI;

// Connect to Mongo
try {
  mongoose.connect(
    connectionKey,
    { useUnifiedTopology: true, useNewUrlParser: true },
    async (err, db) => {
      if (err) {
        throw err;
      } else {
        console.log("Successful database connection");

        //separating authentication, socket.io and routing files with 'authClient.js', socketIo.js and 'routes.js'
        //authentication
        authClient(app, db);
        authDriver(app, db);
        //routes
        routes(app, db);

        //socket.io
        socket_io(io, db);

        // Serve static assets if production
        if (process.env.NODE_ENV === "production") {
          // Set static folder
          app.use(express.static("client/build"));

          app.get("*", (req, res) => {
            res.sendFile(
              path.resolve(__dirname, "client", "build", "index.html")
            );
          });
        }

        const port = process.env.PORT || 5000;
        http.listen(port, () => {
          console.log(`Server Running on ${port}`);
        });
      }
    }
  );
} catch (err) {
  console.log("Database error: " + err);
}
