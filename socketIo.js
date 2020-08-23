const { getDistance } = require("geolib");

const socket_io = (io, db) => {
  let clientWaitingList = [];
  let driverList = [];
  const driver = io.of("/driver");
  const taxiUser = io.of("/taxiuser");

  //driverApp socketio
  driver.on("connect", (socket) => {
    // console.log("driver is");
    socket.on("disconnect", () => {
      // console.log("disconnect");
    });
    //listening for driver
    socket.on("add user", (driverData) => {
      // console.log("add driver");
      // console.log(clientWaitingList);

      //if any client is waiting, then give their order to the driver
      if (clientWaitingList.length > 0) {
        // console.log(clientWaitingList);
        const client = clientWaitingList.shift();
        driver.emit(`recieve order ${driverData.userId}`, client);
        taxiUser.emit(`waiting ${client.userId}`, [driverData]);
        return false;
      }
      //else add the driver to the list
      driverList.push(driverData);
    });

    //if the driver disconnected, then delete her from the driver list
    socket.on("reduce user", (userId) => {
      // console.log("reduced");
      const item = driverList.filter((item) => item.userId !== userId);
      driverList = [...item];
    });

    // driver accepted the order
    socket.on("driver accepted", (data) => {
      // console.log("driveraccepted: ", data);
      taxiUser.emit(`driver accepted ${data.clientId}`, data);
    });

    // driver location updated
    socket.on("update driver location", (data) => {
      // console.log(data);
      taxiUser.emit(`update driver location ${data.clientId}`, data);
    });

    // driver is arrived to pickup the client
    socket.on("driver arrived", (data) => {
      // console.log(data);
      taxiUser.emit(`driver arrived ${data.clientId}`, data);
    });

    // start moving to destination
    socket.on("to destination", (data) => {
      // console.log("destination");
      taxiUser.emit(`to destination ${data.clientId}`, data);
    });

    // order executed succesfully
    socket.on("order is executed", (data) => {
      // console.log("executed");
      taxiUser.emit(`order is executed ${data.clientId}`, data);
    });

    //drivers feedback
    socket.on("driver rated", (data) => {
      // console.log(data);
      taxiUser.emit(`driver rated ${data.clientId}`, data);
    });
  });

  // ************ *********** ************ //
  // ************ *********** ************ //
  // ************ *********** ************ //

  //TaxiApp socketio
  taxiUser.on("connect", (socket) => {
    socket.on("disconnect", () => {
      // console.log("disconnect");
    });
    //listening for booking
    socket.on("add order", (order) => {
      //if no drivers yet, add client to waiting list and let the client know about that
      if (driverList.length === 0) {
        socket.emit(`waiting ${order.userId}`, null);
        return false;
      } else if (driverList.length === 1) {
        // console.log(driverList);
        socket.emit(`waiting ${order.userId}`, driverList);
        driver.emit(`recieve order ${driverList[0].userId}`, order);
        driverList = [];
        return false;
      }
      //sending to the client a driver list
      socket.emit(`waiting ${order.userId}`, driverList);
      //adding distance between driver and client location
      const arr = driverList.map((item, index) => ({
        ...item,
        index,
        dist: getDistance(
          { latitude: order.fromWhere.lat, longitude: order.fromWhere.lng },
          { latitude: item.lat, longitude: item.lng }
        ),
      }));
      //finding the nearest taxi
      const minDist = arr.reduce((minimum, item) => {
        return (minimum.dist || 10000) < item.dist ? minimum : item;
      }, {});
      // sending response to the driver
      driver.emit(`recieve order ${minDist.userId}`, order);
      //remove the driver from the waiting list
      driverList.splice(arr.index, 1);
    });
    // if user waits add the client to the waiting list
    socket.on("user is waiting", (order) => {
      clientWaitingList.push(order);
    });

    // if user canceled remove the use from the list
    socket.on("user canceled", (userId) => {
      const newList = clientWaitingList.filter(
        (client) => client.userId !== userId
      );
      clientWaitingList = [...newList];
    });

    //on user pressed coming out
    socket.on("user coming out", (driverId) => {
      // console.log(driverId);
      driver.emit(`user coming out ${driverId}`);
    });

    //on user rated driver
    socket.on("client rated", (data) => {
      // console.log(data);
      driver.emit(`client rated ${data.driverId}`, data);
    });
  });
};

module.exports = socket_io;
