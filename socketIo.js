const CronJob = require("cron").CronJob;
const ClientState = require("./models/ClientState");
const { getDistance } = require("geolib");
const DriverState = require("./models/DriverState");

const socket_io = (io, app) => {
  const main = io.of("/main");
  let clientList = [];
  let driverRooms = [];
  let clientStateList = [];
  let driverStateList = [];
  //******************************************************************************************* */
  // clean the memory DB once in a day(04:42:00 tomsk)
  var job = new CronJob("00 42 04 * * *", async () => {
    // clean states and remove older data
    const newTimeFilter = new Date().getTime() - 14400000;
    newClientState = clientStateList.filter(
      (obj) => obj.orderDate > newTimeFilter
    );
    newDriverState = driverStateList.filter(
      (obj) => obj.orderDate > newTimeFilter
    );
    clientStateList = [...newClientState];
    driverStateList = [...newDriverState];
    try {
      await ClientState.deleteMany({ orderDate: { $lt: newTimeFilter } });
      await DriverState.deleteMany({ orderDate: { $lt: newTimeFilter } });
    } catch (err) {}
  });
  job.start();
  //******************************************************************************************* */
  const handleClientState = async (clientId, state, dataUpdate, message) => {
    // updatae the local memory client state
    const objIndex = clientStateList.findIndex(
      (obj) => obj.clientId === clientId
    );
    // updating message state if the action was from message
    if (message) {
      clientStateList[objIndex].messageList.unshift(message);
    } else {
      if (objIndex >= 0) {
        clientStateList[objIndex].state = state;
      } else {
        clientStateList.push({
          clientId: clientId,
          state: state,
          messageList: [],
          orderDate: new Date().getTime(),
        });
      }
    }

    // saving client state to the DB with mongoose
    let query = { clientId: clientId },
      // updating message state if the action was from message
      update = message
        ? { $push: { messageList: { $each: [message], $position: 0 } } }
        : { ...dataUpdate, orderDate: new Date().getTime() },
      options = {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        useFindAndModify: false,
      };
    try {
      // Find the document
      await ClientState.findOneAndUpdate(query, update, options);
    } catch (err) {
      throw err;
    }
  };
  //******************************************************************************************* */
  const handleDriverState = async (uberId, state, dataUpdate, message) => {
    // updatae the local memory driver state
    const objIndex = driverStateList.findIndex((obj) => obj.uberId === uberId);
    // updating message state if the action was from message
    if (message) {
      driverStateList[objIndex].messageList.unshift(message);
    } else {
      if (objIndex >= 0) {
        driverStateList[objIndex].state = state;
      } else {
        driverStateList.push({
          uberId: uberId,
          state: state,
          messageList: [],
          orderDate: new Date().getTime(),
        });
      }
    }

    // saving driver state to the DB with mongoose
    let query = { uberId: uberId },
      update = message
        ? { $push: { messageList: { $each: [message], $position: 0 } } }
        : { ...dataUpdate, orderDate: new Date().getTime() },
      options = {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        useFindAndModify: false,
      };
    try {
      // Find the document
      await DriverState.findOneAndUpdate(query, update, options);
    } catch (err) {
      throw err;
    }
  };
  //******************************************************************************************* */
  main.on("connection", (socket) => {
    // on reconnection, update state!
    socket.on("reconnection", (data) => {
      // if the socket is from client
      if (data.clientId) {
        console.log(data.isReconnecting, clientStateList);
        // if client connect for the first time, create new state for it
        if (!data.isReconnecting) {
          clientFirstConnectionSetup();
          // return false;
        } else if (data.isReconnecting === "fromApp") {
          // otherwise find this client among the list
          const amongStates = clientStateList.find(
            (item) => item.clientId === data.clientId
          );
          // send the state back to the client
          socket.emit(`reconnect ${data.clientId}`, amongStates);
        } else if (data.isReconnecting === "fromDB") {
          // updatae the local memory driver state
          const objIndex = clientStateList.findIndex(
            (obj) => obj.clientId === data.clientId
          );
          if (objIndex >= 0) {
            clientStateList[objIndex].state = data.clientState;
          } else {
            clientStateList.push({
              clientId: data.clientId,
              state: data.clientState,
              // messageList: [],
              orderDate: new Date().getTime(),
            });
          }
          socket.emit(`reconnect ${data.clientId}`, { state: "app" });
        }
      } else {
        // else if the socket is from driver
        // if driver connect for the first time, create new state for it
        if (!data.isReconnecting) {
          driverFirstConnectionSetup();
          // return false;
        } else if (data.isReconnecting === "fromApp") {
          // otherwise find this driver among the list
          const driverAmongStates = driverStateList.find(
            (item) => item.uberId === data.uberId
          );
          // send the state back to the driver
          socket.emit(`reconnect ${data.uberId}`, driverAmongStates);
        } else if (data.isReconnecting === "fromDB") {
          // updatae the local memory driver state
          const objIndex = driverStateList.findIndex(
            (obj) => obj.uberId === data.uberId
          );
          if (objIndex >= 0) {
            driverStateList[objIndex].state = data.driverState;
          } else {
            driverStateList.push({
              uberId: data.uberId,
              state: data.driverState,
              messageList: data.messageList,
              orderDate: new Date().getTime(),
            });
          }
          socket.emit(`reconnect ${data.uberId}`, { state: "app" });
        }
      }
    });
    //
    ////**** *///**** *///**** *///**** *///**** *///**** */
    //
    // if user waits add the client to the waiting list
    socket.on("user is waiting", (clientData) => {
      // firstly remove if there any
      removeClient(clientData.userId);
      clientList.push(clientData);
      console.log(clientData);
      // save clietn state
      handleClientState(clientData.userId, "isClientWaiting", {
        isClientWaiting: true,
        clientData,
      });
    });
    //
    ////**** *///**** *///**** *///**** *///**** *///**** */
    //
    socket.on("join", (data) => {
      // if the driver joined the client room
      if (data.driverData) {
        // and add the coordinate to the state for this time only because when cancel is occure while
        //  the driver receive order, will be needed to reset the waiting list
        const { lat, lng } = data.driverData;
        const newStateList = driverStateList.map((item) =>
          item.uberId === data.driverData.userId
            ? { ...item, room: data.room, lat, lng }
            : item
        );
        driverStateList = [...newStateList];
      }
      socket.join(data.room);
    });
    //
    ////**** *///**** *///**** *///**** *///**** *///**** */
    //
    //driver rejected the order
    socket.on("ignore order", (data) => {
      // tell the client about the rejection
      main.emit(`skip order ${data.clientData.userId}`, data);
      // save states
      handleClientState(data.clientData.userId, "isClientWaiting", {
        driverList: null,
      });
      handleDriverState(data.driverData.userId, "isSwitch", {
        orderLoader: null,
      });
      // add to the clients and driver data's ignored list, then add them to waiting lists
      const clientIgnoredList = data.clientData.ignoredList;
      const driverIgnoredList = data.driverData.ignoredList;
      const clientHasIgnoredList = {
        ...data.clientData,
        ignoredList: [...clientIgnoredList, data.driverData.userId],
      };
      const driverHasIgnoredList = {
        ...data.driverData,
        ignoredList: [...driverIgnoredList, data.clientData.userId],
      };
      // firstly remove if there any
      removeClient(data.clientData.userId);
      clientList.push(clientHasIgnoredList);
      // firstly remove if there any
      removeDriver(data.driverData.userId);
      driverRooms.push(driverHasIgnoredList);
      // searching for other drivers
      handleClientAfterDriverSkiped(clientHasIgnoredList);
      handleDriverAfterSkiped(driverHasIgnoredList);
    });
    //
    ////**** *///**** *///**** *///**** *///**** *///**** */
    //
    //driver time is ranout choosing order
    socket.on("order timeout", (data) => {
      // tell the client about the rejection
      main.emit(`skip order ${data.clientData.userId}`, data);
      // save states
      handleClientState(data.clientData.userId, "isClientWaiting", {
        driverList: null,
      });
      handleDriverState(data.driverData.userId, "isSwitch", {
        orderLoader: null,
      });
      // put client and driver on search
      handleClientAfterAnyReset(data.clientData);
      driverFirstConnectionSetup(data.driverData);
    });
    //
    ////**** *///**** *///**** *///**** *///**** *///**** */
    //
    // driver accepted the order
    socket.on("driver accepted", (data) => {
      main.emit(`driver accepted ${data.clientId}`, data);
      handleClientState(data.clientId, "driverAccepted", {
        driverAccepted: data,
        messageList: [],
      });
      handleDriverState(data.driverId, "isOrderAccepted", {
        isOrderAccepted: true,
        messageList: [],
      });
    });
    //
    ////**** *///**** *///**** *///**** *///**** *///**** */
    //
    // message from client to driver
    socket.on("clientMsg", (data) => {
      socket.broadcast.to(data.room).emit("message", data.message);
      // update the chat states
      const date = `${new Date().getHours()}:${new Date().getMinutes()}`;
      handleDriverState(data.driverId, null, null, {
        id: 2,
        msg: data.message,
        date,
      });
      handleClientState(data.room, null, null, {
        id: 1,
        msg: data.message,
        date,
      });
    });
    //
    ////**** *///**** *///**** *///**** *///**** *///**** */
    //
    // message from driver to client
    socket.on("driverMsg", (data) => {
      socket.broadcast.to(data.room).emit("message", data.message);
      // update the chat states
      const date = `${new Date().getHours()}:${new Date().getMinutes()}`;
      handleDriverState(data.driverId, null, null, {
        id: 1,
        msg: data.message,
        date,
      });
      handleClientState(data.room, null, null, {
        id: 2,
        msg: data.message,
        date,
      });
    });
    //
    ////**** *///**** *///**** *///**** *///**** *///**** */
    //
    // driver location updated
    socket.on("update driver location", (data) => {
      main.emit(`update driver location ${data.clientId}`, data);
    });
    //
    ////**** *///**** *///**** *///**** *///**** *///**** */
    //
    // driver is arrived to pickup the client
    socket.on("driver arrived", (data) => {
      main.emit(`driver arrived ${data.clientId}`, data);
      handleClientState(data.clientId, "driverArrived", {
        driverArrived: data,
      });
      handleDriverState(data.driverId, "isDriverWaiting", {
        isDriverWaiting: true,
      });
    });
    //
    ////**** *///**** *///**** *///**** *///**** *///**** */
    //
    //on user pressed coming out
    socket.on("user coming out", (driverId) => {
      main.emit(`user coming out ${driverId}`);
      handleDriverState(driverId, "isUserComing", {
        isUserComing: true,
      });
    });
    //
    ////**** *///**** *///**** *///**** *///**** *///**** */
    //
    // start moving to destination
    socket.on("to destination", (data) => {
      main.emit(`to destination ${data.clientId}`, {
        clientId: data.clientId,
        driverId: data.driverId,
      });
      handleClientState(data.clientId, "toDestination", {
        clientData: data.newClientData,
        toDestination: data,
      });
      handleDriverState(data.driverId, "pickedClient", {
        orderLoader: data.newClientData,
        pickedClient: true,
      });
    });
    //
    ////**** *///**** *///**** *///**** *///**** *///**** */
    //
    // order executed succesfully
    socket.on("order is executed", (data) => {
      main.emit(`order is executed ${data.clientId}`, data);
      // remove the client state from memory
      removeclientState(data.clientId);
      removeDriverState(data.driverId);
    });
    //
    ////**** *///**** *///**** *///**** *///**** *///**** */
    //
    // ***************************
    //drivers feedback and finish this order
    socket.on("driver rated", (data) => {
      driverFirstConnectionSetup(data.driverData);
      main.emit(`driver rated ${data.clientId}`, data);
    });
    //
    ////**** *///**** *///**** *///**** *///**** *///**** */
    //
    //driver switched off
    socket.on("switched off", (data) => {
      // remove driver from waiting list, and clear the temp memory state
      removeDriver(data.driverId);
      removeDriverState(data.driverId);
      // if the driver recieved the order already, then put the client for searching again
      if (data.clientData) {
        // inform the client that this driver is switched off and need to repeat searching
        main.emit(`switched off ${data.clientData.userId}`, null);
        handleClientState(data.clientData.userId, "isClientWaiting", {
          driverList: null,
        });
        handleClientAfterAnyReset(data.clientData);
      }
    });
    //
    ////**** *///**** *///**** *///**** *///**** *///**** */
    //
    // if user canceled remove the use from the list
    socket.on("user canceled", (data) => {
      // let the driver know in case if the driver is chosen
      main.in(data.userId).emit("user canceled", data);
      // find if there a joined driver in state to this client room
      let driverJoinedRoom = driverStateList.find(
        (item) => item.room === data.userId
      );
      if (driverJoinedRoom) {
        handleDriverState(driverJoinedRoom.uberId, "isSwitch", {
          orderLoader: null,
        });
      }
      // remove the order state from memory
      removeclientState(data.userId);
      // remove the client from the list
      removeClient(data.userId);
    });
    //
    ////**** *///**** *///**** *///**** *///**** *///**** */
    //
    socket.on("driver leave room", (room) => {
      socket.leave(room);
    });
    //
    ////**** *///**** *///**** *///**** *///**** *///**** */
    //
    socket.on("driver rejoin room", (room) => {
      socket.join(room);
    });
    //
    ////**** *///**** *///**** *///**** *///**** *///**** */
    //
    socket.on("drReconnAfterClCancel", (data) => {
      // if driver already accepted the order and the client is specifically want to ignore this driver
      // add to the driver data's ignored list, then add it to waiting lists
      // const driverIgnoredList = data.driverAccepted.ignoredList;
      const driverHasIgnoredList = {
        ...data.driverAccepted,
        ignoredList: [data.clientId],
      };
      // firstly remove if there any
      removeDriver(data.driverAccepted.driverId);
      driverRooms.push(driverHasIgnoredList);
      // searching for other clients
      handleDriverAfterSkiped(driverHasIgnoredList);
    });

    // socket.on("remove driver", (userId) => {
    //   removeDriver(userId);
    // });

    //******************************************************* */
    //******************************************************* */
    //******************************************************* */
    //******************************************************* */
    //******************************************************* */
    //******************************************************* */

    // if socket connection from client
    const clientFirstConnectionSetup = () => {
      const clientData = JSON.parse(socket.request._query.clientData);
      const clientId = clientData.userId;

      let newDriverRooms = driverRooms.filter((driver) => {
        let isAvailabe = driver.ignoredList.find((id) => id === clientId);
        return !isAvailabe;
      });

      if (newDriverRooms.length > 0) {
        // sending to the client a driver list
        socket.emit(`waiting ${clientId}`, newDriverRooms);
        // save client state
        handleClientState(clientId, "driverList", {
          driverList: newDriverRooms,
          clientData,
        });
        //adding distance between driver and client location
        const arr = newDriverRooms.map((item, index) => ({
          ...item,
          index,
          dist: getDistance(
            {
              latitude: clientData.fromWhere.lat,
              longitude: clientData.fromWhere.lng,
            },
            { latitude: item.lat, longitude: item.lng }
          ),
        }));
        //finding the nearest taxi
        const minDist = arr.reduce((minimum, item) => {
          return (minimum.dist || 10000) < item.dist ? minimum : item;
        }, {});
        // remove driver from waiting list and send response to the driver
        main.emit(`recieve order ${minDist.userId}`, clientData);
        // save driver state
        handleDriverState(minDist.userId, "orderLoader", {
          orderLoader: clientData,
        });
        //remove the driver from the waiting list
        driverRooms.splice(arr.index, 1);
      } else {
        // if no drivers, dont add the client to waiting list yet until client emits(waiting)
        socket.emit(`waiting ${clientId}`, null);
      }
    };

    const driverFirstConnectionSetup = (data) => {
      const driverData = data
        ? data
        : JSON.parse(socket.request._query.driverData);
      const uberId = driverData.userId;
      console.log("clientList", clientList);

      let newClientList = clientList.filter((client) => {
        let isAvailabe = client.ignoredList.find((id) => id === uberId);
        return !isAvailabe;
      });

      if (newClientList.length > 0) {
        const takenClient = newClientList.shift();
        // then delete the chosen client from the list
        removeClient(takenClient.userId);
        // driver recieves the order to accept
        socket.emit(`recieve order ${driverData.userId}`, takenClient);
        // save data to memory and the DB
        handleDriverState(uberId, "orderLoader", { orderLoader: takenClient });
        // the client is informed about the requested for a driver
        main.emit(`waiting ${takenClient.userId}`, [driverData]);
        // save client state
        handleClientState(takenClient.userId, "driverList", {
          driverList: [driverData],
        });
      } else {
        // if the client list also is empty then just add this driver to the waiting list
        driverRooms.push(driverData);
        // save state to memory and the DB
        handleDriverState(uberId, "isSwitch", { isSwitch: true });
      }
    };

    const handleClientAfterDriverSkiped = (clientData) => {
      const clientId = clientData.userId;
      // remove those drivers already been declined from the client
      let newList = [];
      // filter the driverRooms
      for (let i = 0; i < driverRooms.length; i++) {
        let ignored = clientData.ignoredList.find(
          (id) => id === driverRooms[i].userId
        );
        if (!ignored) {
          newList.push(driverRooms[i]);
        }
      }
      // if driver rooms is not empty after removing ignored list from it
      if (newList.length > 0) {
        // sending to the client a driver list
        socket.emit(`waiting ${clientId}`, newList);
        // save client state
        handleClientState(clientId, "driverList", {
          driverList: newList,
        });
        //adding distance between driver and client location
        const arr = newList.map((item, index) => ({
          ...item,
          index,
          dist: getDistance(
            {
              latitude: clientData.fromWhere.lat,
              longitude: clientData.fromWhere.lng,
            },
            { latitude: item.lat, longitude: item.lng }
          ),
        }));
        //finding the nearest taxi
        const minDist = arr.reduce((minimum, item) => {
          return (minimum.dist || 10000) < item.dist ? minimum : item;
        }, {});
        // remove driver from waiting list and send response to the driver
        main.emit(`recieve order ${minDist.userId}`, clientData);
        // save driver state
        handleDriverState(minDist.userId, "orderLoader", {
          orderLoader: clientData,
        });
        //remove the driver from the waiting list
        driverRooms.splice(arr.index, 1);
      }
    };

    const handleDriverAfterSkiped = (driverData) => {
      const uberId = driverData.userId;
      // remove those orders already been declined from the driver
      let newList = [];
      // filter the clientList
      for (let i = 0; i < clientList.length; i++) {
        let ignored = driverData.ignoredList.find(
          (id) => id === clientList[i].userId
        );
        if (!ignored) {
          newList.push(clientList[i]);
        }
      }

      if (newList.length > 0) {
        const takenClient = clientList.shift();

        // driver recieves the order to accept
        socket.emit(`recieve order ${driverData.userId}`, takenClient);
        // save data to memory and the DB
        handleDriverState(uberId, "orderLoader", { orderLoader: takenClient });

        // the client is informed about the requested for a driver
        main.emit(`waiting ${takenClient.userId}`, [driverData]);
        // save client state
        handleClientState(takenClient.userId, "driverList", {
          driverList: [driverData],
        });
      }
    };

    // client search again after the driver switched off insted of (accept or skip), while recieved the order
    const handleClientAfterAnyReset = (data) => {
      const clientData = data;
      const clientId = clientData.userId;
      if (driverRooms.length > 0) {
        // sending to the client a driver list
        socket.emit(`waiting ${clientId}`, driverRooms);
        // save client state
        handleClientState(clientId, "driverList", {
          driverList: driverRooms,
        });
        //adding distance between driver and client location
        const arr = driverRooms.map((item, index) => ({
          ...item,
          index,
          dist: getDistance(
            {
              latitude: clientData.fromWhere.lat,
              longitude: clientData.fromWhere.lng,
            },
            { latitude: item.lat, longitude: item.lng }
          ),
        }));
        //finding the nearest taxi
        const minDist = arr.reduce((minimum, item) => {
          return (minimum.dist || 10000) < item.dist ? minimum : item;
        }, {});
        // remove driver from waiting list and send response to the driver
        main.emit(`recieve order ${minDist.userId}`, clientData);
        // save driver state
        handleDriverState(minDist.userId, "orderLoader", {
          orderLoader: clientData,
        });
        //remove the driver from the waiting list
        driverRooms.splice(arr.index, 1);
      } else {
        // add the client to waiting list
        // firstly remove if there any
        removeClient(clientData.userId);
        clientList.push(clientData);
      }
    };

    // client remover fn
    const removeClient = (clientId) => {
      if (clientList.length > 0) {
        const newList = clientList.filter((obj) => obj.userId !== clientId);
        clientList = [...newList];
      }
    };

    // driver remover fn
    const removeDriver = (userId) => {
      if (driverRooms.length > 0) {
        const newList = driverRooms.filter((obj) => obj.userId !== userId);
        driverRooms = [...newList];
      }
    };

    // clientState remover fn
    const removeclientState = (clientId) => {
      if (clientStateList.length > 0) {
        const newList = clientStateList.filter(
          (obj) => obj.clientId !== clientId
        );
        clientStateList = [...newList];
      }
    };

    // driverState remover fn
    const removeDriverState = (uberId) => {
      if (driverStateList.length > 0) {
        const newList = driverStateList.filter((obj) => obj.uberId !== uberId);
        driverStateList = [...newList];
      }
    };
  });
  //******************************************************************************************* */
  // //delete driver from the app first run if
  // app.delete("/api/deleteDriver/:driverId", (req, res) => {
  //   const driverId = req.params.driverId;
  //   removeDriver(driverId);
  //   return res.status(200).json({ success: true, driverRooms });
  // });
  //******************************************************************************************* */
};

module.exports = socket_io;
