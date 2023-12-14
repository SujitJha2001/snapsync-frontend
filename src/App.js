import "./App.css";
import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { v4 as uuidv4 } from 'uuid';

let socket;

function App() {
  const CHUNK_SIZE = 51200 //500KB
  const [senderProgress, setSenderProgress] = useState({
    sentChunk: 0,
    totalChunks: 0
  });
  const [fileChunksRecieved, setFileChunksRecieved] = useState([]);
  const [recieverProgress, setRecieverProgress] = useState(0);
  const [CreateRoom, setCreateRoom] = useState("");
  const [JoinRoom, setJoinRoom] = useState("");
  const [file, setFile] = useState(null);

  function createRoom() {
    socket.emit("createRoom", uuidv4());
  }

  function joinRoom() {
    if (JoinRoom.length) {
      socket.emit("joinRoom", JoinRoom);
    }
    else {
      alert("Please provide Room Name");
    }
  }
  function copyRoomId() {
    const createRoomInput = document.getElementById("createRoomInput");
    let roomValue = createRoomInput?.value;
    if (!roomValue?.length) {
      const joinRoomInput = document.getElementById("joinRoomInput");
      roomValue = joinRoomInput?.value;
    }

    // Use modern clipboard API
    navigator.clipboard.writeText(roomValue)
      .then(() => {
        alert("Room ID copied to clipboard!");
      })
      .catch((err) => {
        console.error('Unable to copy to clipboard', err);
      });
  }


  const sendFileData = (file) => {
    /*************************GET ROOM ID****************************/
    let uniqueFileId = uuidv4();
    const createRoomInput = document.getElementById("createRoomInput");
    let roomValue = createRoomInput?.value;
    /***************************************************************************/
    const reader = new FileReader();

    reader.onload = (event) => {
      const fileData = event.target.result;
      const totalChunks = Math.ceil(fileData?.byteLength / CHUNK_SIZE);
      console.log("Total Chunks", totalChunks);
      // const chunks = [];

      for (let i = 0; i < totalChunks; i++) {
        setSenderProgress(() => {
          let obj = {
            totalChunks: totalChunks,
            sentChunk: i + 1
          }
          return obj;
        })
        const start = i * CHUNK_SIZE;
        const end = Math.min((i + 1) * CHUNK_SIZE, fileData.byteLength);
        const chunk = fileData.slice(start, end);
        // Convert ArrayBuffer to regular array
        // const chunkArray = Array.from(new Uint8Array(chunk));
        const chunkArray = new Uint8Array(chunk);

        // chunks.push(chunk);
        console.log(i + 1, "/", totalChunks, " Sent ... ");
        socket.emit('sendFileChunk', { room: roomValue, fileName: file.name, chunk: chunkArray, currentChunk: i, totalChunks, uniqueFileId });
      }
    };

    reader.readAsArrayBuffer(file);
  }

  function sendFile() {
    if (file && !!file.files[0]) {
      sendFileData(file.files[0]);
    }
  }
  useEffect(() => {
    let data = fileChunksRecieved[fileChunksRecieved.length - 1]
    if (fileChunksRecieved.length) {
      setRecieverProgress(() => (((data.currentChunk + 1) / data.totalChunks) * 100).toFixed(2))
    }
    if (fileChunksRecieved.length > 0 && (data.currentChunk == data.totalChunks - 1)) {
      console.log("File Recieved completely");
      // Combine chunks into a Blob
      const chunks = fileChunksRecieved.map(chunk => new Uint8Array(chunk.chunk).buffer);
      const blob = new Blob(chunks, { type: "application/octet-stream" });
      // Create a link element to trigger the download
      const downloadLink = document.createElement("a");
      downloadLink.href = URL.createObjectURL(blob);
      downloadLink.download = data.fileName;
      // Trigger the download
      downloadLink.click();

      // Clean up the URL object
      URL.revokeObjectURL(downloadLink.href);

      setFileChunksRecieved(() => []);
    }
  }, [fileChunksRecieved])
  useEffect(() => {
    if (socket) {
      socket.off();
      socket.on("ConnectionEstablished", (data) => {
        alert("Frontend Message Connected to " + data);
      });
      socket.on("message", (message) => {
        if (message.message == "Room created successfully") {
          // Update UI to show file input after joining the room
          document.getElementById("fileInputContainer").style.display = "flex";
          document.getElementById("createRoomBtn").style.display = "none";
          document.getElementById("joinRoomBtn").style.display = "none";
          document.getElementById("OR").style.display = "none";
          // document.getElementById("createRoomLabel").style.display = "block";
          document.getElementById("createRoomInput").style.display = "block";
          // document.getElementById("joinRoomLabel").style.display = "none";
          document.getElementById("joinRoomInput").style.display = "none";
          document.getElementById("createRoomInput").value = message.value;
          document.getElementById("createRoomInput").disabled = true;
          document.getElementById("copyRoomNameBtn").style.display = "block";
        }
        if (message.message == "Joined Room Successfully" || message.message == "One user can join only one room. Hence removing user from previous rooms and adding to the new one") {
          // Update UI to show file input after joining the room
          document.getElementById("createRoomBtn").style.display = "none";
          document.getElementById("joinRoomInput").disabled = true;
          document.getElementById("copyRoomNameBtn").style.display = "block";
          document.getElementById("joinRoomBtn").style.display = "none";
          document.getElementById("OR").style.display = "none";
          alert(message.message);
        }
        if (message.message == "Invalid Room Id") {
          alert(message.message + ` : ${message.value}`);
        }
        if (message.message == "File Sent : ") {
          alert(message.message + message.value);
        }
      })

      socket.on("recieveFileChunk", (data) => {
        const roomName = data.room;
        console.log(`Received chunk ${data.currentChunk + 1} of ${data.totalChunks} for file ${data.fileName} in room ${roomName}`);
        setFileChunksRecieved((prevArray) => {
          const newArray = [...prevArray, { currentChunk: data.currentChunk, totalChunks: data.totalChunks, chunk: data.chunk, fileName: data.fileName }];
          return newArray
        })
      })
    } else {
      console.log("Connecting to the socket")
      socket = io("http://localhost:4003");
      // socket = io("https://snapsyncsj.azurewebsites.net/");

    }
  }, [socket])


  return (
    <div className="body">
      <h1 id="title">SnapSync</h1>
      <div className="innerBody">
        <div id="base">
          <button id="createRoomBtn" onClick={createRoom} >
            Create Room
          </button>
          <h1 id="OR">OR</h1>

          <div className="inputAndCopy">
            <input id="joinRoomInput" type="text" style={{ width: "auto" }} onChange={(e) => {
              setJoinRoom(e.target.value)
            }} />
            <button id="joinRoomBtn" onClick={joinRoom}>
              Join Room
            </button>

            <input
              id="createRoomInput"
              type="text"
              style={{ display: "none", width: "auto" }}
              onChange={(e) => {
                setCreateRoom(() => e.target.value)
              }}
            />
            <button
              id="copyRoomNameBtn"
              onClick={copyRoomId}
              style={{ display: "none" }}
            >
              Copy
            </button>
          </div>
        </div>
        <div id="fileInputContainer" style={{ display: "none" }}>
          <input type="file" id="fileInput" accept="*/*" onChange={(e) => {
            setFile(() => e.target)
          }} />
          <button onClick={sendFile}>Send File</button>
        </div>
        <div id="messages">
          <h3 id="senderProgress" style={{ display: (senderProgress.sentChunk > 0) ? "block" : "none" }}>Sender Progress : {((senderProgress.sentChunk / senderProgress.totalChunks) * 100).toFixed(2)}%</h3>
          <h3 id="recieverProgress" style={{ display: (recieverProgress > 0) ? "block" : "none" }}>Reciever Progress : {recieverProgress}%</h3>
        </div>
      </div>
    </div>
  );
}

export default App;
