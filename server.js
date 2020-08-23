const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);

const routes = require("./routes");
const socket_io = require("./socketIo");

// bodyParser middleware
app.use(bodyParser.json());
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

        //separating authentication, socket.io and routing files with 'auth.js', socketIo.js and 'routes.js'
        //authentication
        // auth(app, db);
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
