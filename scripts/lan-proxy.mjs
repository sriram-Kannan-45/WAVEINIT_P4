import net from "node:net";

const TARGET_PORT = 3000;
const PROXY_PORT = 3001;

const server = net.createServer((clientSocket) => {
  const targetSocket = net.connect(TARGET_PORT, "127.0.0.1");

  clientSocket.pipe(targetSocket);
  targetSocket.pipe(clientSocket);

  clientSocket.on("error", () => targetSocket.destroy());
  targetSocket.on("error", () => clientSocket.destroy());
});

server.listen(PROXY_PORT, "0.0.0.0", () => {
  console.log(`[LAN Forwarder] Active on 0.0.0.0:${PROXY_PORT} -> localhost:${TARGET_PORT}`);
});
