const GRID_SIZE = 60;
const CELL_SIZE = 10;
const SPEED = 1;
const FPS = 10;
const ROOM_NAME = 'secret'

const io = require('socket.io')({transports: ['websocket'], upgrade: false});
const state = {};
var connectedClients = {};
var clientCount = 0;

io.on('connection', client => {

    clientCount++;
    console.log('connected: ' + client.id + ' remaining: ' + clientCount);
    
    client.on('disconnect', () => {
        delete connectedClients[client.id];
        clientCount--;
        client.emit('terminate');
        console.log('disconnected: ' + client.id + ' remaining: ' + clientCount);
    });
    
    let initData = getInitData(client.id);
    connectedClients[client.id] = initData.snake;
    client.join(ROOM_NAME);
    client.number = connectedClients.length + 1;
    client.emit('init', initData);
    client.on('keydown', handleKeydown);

    if (clientCount == 1)
    {
        startGameInterval(ROOM_NAME);
    }

    function getInitData(id)
    {
        let spawnX = Math.floor(Math.random() * GRID_SIZE);
        let spawnY = GRID_SIZE - 20;
        return {
            snake: {
                id: id,
                pos: { x: spawnX, y: spawnY },
                dir: { x: 0, y: 0 },
                tail: [
                    { x: spawnX, y: spawnY + 10 },
                    { x: spawnX, y: spawnY + 9 },
                    { x: spawnX, y: spawnY + 8 },
                    { x: spawnX, y: spawnY + 7 },
                    { x: spawnX, y: spawnY + 6 },
                    { x: spawnX, y: spawnY + 5 },
                    { x: spawnX, y: spawnY + 4 },
                    { x: spawnX, y: spawnY + 3 },
                    { x: spawnX, y: spawnY + 2 },
                    { x: spawnX, y: spawnY + 1 },
                ],
                inputQueue: [ { x: 0, y: -1 } ],
            },
            gridSize: GRID_SIZE,
            cellSize: CELL_SIZE,
            speed: SPEED,
            fps: FPS
        };
    }

    function handleKeydown(keyCode)
    {
        let snake = connectedClients[client.id];

        let inputQueue = snake.inputQueue;
        if (inputQueue.length > 6) 
        {
            inputQueue.shift();
        }
        
        switch (keyCode) {
            case 37: { // left
                if (snake.dir.x != 1)
                {
                    inputQueue.push({ x: -1, y: 0 });
                }
                break;
            }
            case 38: { // down
                if (snake.dir.y != 1)
                {
                    inputQueue.push({ x: 0, y: -1 }); 
                }
                break;
            }
            case 39: { // right
                if (snake.dir.x != -1)
                {
                    inputQueue.push({ x: 1, y: 0 });
                }
                break;
            }
            case 40: { // up
                if (snake.dir.y != -1)
                {
                    inputQueue.push({ x: 0, y: 1 }); 
                }
                break;
            }
        }
    }
});


function startGameInterval(roomName) 
{
    //console.log("client data:" + JSON.stringify(connectedClients))
    const intervalId = setInterval(() => {
        let clients = Object.values(connectedClients);
        if (clients.length > 0)
        {
            for (let client of clients)
            {
                UpdateSnake(client);
            };
            emitGameState(roomName, clients);
        }
        else 
        {
            clearInterval(intervalId);
        }
    }, 1000 / FPS);
}

function UpdateSnake(snake)
{
    snake.tail.push( { x: snake.pos.x, y: snake.pos.y } );
    
    if (snake.inputQueue.length > 0)
    {
        snake.dir = snake.inputQueue.shift();
    }
    
    snake.pos.x += snake.dir.x * SPEED;
    snake.pos.y += snake.dir.y * SPEED;
    
    if (snake.pos.x < 0) snake.pos.x = GRID_SIZE - 1;
    if (snake.pos.y < 0) snake.pos.y = GRID_SIZE - 1;
    if (snake.pos.x > GRID_SIZE) snake.pos.x = 0;
    if (snake.pos.y > GRID_SIZE) snake.pos.y = 0;
    
    snake.tail.shift();
}

function emitGameState(room, gameState) {
    //var jsonGameState = JSON.stringify(gameState);
    // console.log("Emit : " + io.sockets.in(room));

    var byteCount = 0;
    for (let clientState of gameState) {
        byteCount += 2; //offset
        byteCount += 4; //pos
        byteCount += clientState.tail.length * 4; //tail
    }
    //console.log("send: " + byteCount)
    var buffer = new ArrayBuffer(byteCount);
    const view = new DataView(buffer);
    var index = 0;
    for (let clientState of gameState) {
        view.setInt16(index, 2 + 4 + clientState.tail.length * 4);
        index += 2;
        
        view.setInt16(index, clientState.pos.x);
        index += 2;
        
        view.setInt16(index, clientState.pos.y);
        index += 2;
        
        for (let tail of clientState.tail) {
            view.setInt16(index, tail.x);
            index += 2;

            view.setInt16(index, tail.y);
            index += 2;
        }
        // console.log(buffer);
        // console.log(Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join(''));
    };
    io.sockets.in(room).emit('gameState', buffer);
}

io.listen(process.env.PORT || 3000);