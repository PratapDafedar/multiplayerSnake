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

function getInitData()
{
    return {
        snake: getInitSnakeData(),
        gridSize: GRID_SIZE,
        cellSize: CELL_SIZE,
        speed: SPEED,
        fps: FPS
    };
}

function getInitSnakeData()
{
    let spawnX = Math.floor(Math.random() * GRID_SIZE);
    let spawnY = GRID_SIZE - 20;
    return {
        dir: { x: 0, y: 0 },
        tail: [
            { x: spawnX + 4, y: spawnY - 24 },
            { x: spawnX + 4, y: spawnY + 4 },
            { x: spawnX, y: spawnY + 4 },
            { x: spawnX, y: spawnY },
        ],
        inputQueue: [ { x: 0, y: -1 } ],
    }
}

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
    if (snake.inputQueue.length > 0)
    {
        snake.dir = snake.inputQueue.shift();
    }
    
    let lastIndex = snake.tail.length - 1;
    let posX = snake.tail[lastIndex].x;
    let posY = snake.tail[lastIndex].y;
    let prevX = snake.tail[lastIndex - 1].x;
    let prevY = snake.tail[lastIndex - 1].y;

    let nextPosX = posX + snake.dir.x * SPEED;
    let nextPosY = posY + snake.dir.y * SPEED;

    if (nextPosX - prevX != 0 && nextPosY - prevY != 0)
    {
        lastIndex ++;
        snake.tail.push( { x : nextPosX, y : nextPosY } );
    }
    else{
        snake.tail[lastIndex].x = nextPosX;
        snake.tail[lastIndex].y = nextPosY;
    }

    let dx = Math.sign(snake.tail[1].x - snake.tail[0].x) * SPEED;
    let dy = Math.sign(snake.tail[1].y - snake.tail[0].y) * SPEED;
    
    if (dx == 0 && dy == 0 && lastIndex > 1)
    {
        snake.tail.shift();
        lastIndex --;

        snake.tail[0].x += Math.sign(snake.tail[1].x - snake.tail[0].x) * SPEED;
        snake.tail[0].y += Math.sign(snake.tail[1].y - snake.tail[0].y) * SPEED;
    }
    else 
    {
        snake.tail[0].x += dx;
        snake.tail[0].y += dy;
    }
    
    if (snake.tail[lastIndex].x < 0 ||
        snake.tail[lastIndex].y < 0 || 
        snake.tail[lastIndex].x > GRID_SIZE ||
        snake.tail[lastIndex].y > GRID_SIZE) 
    {
        const initData = getInitSnakeData();
        snake.tail = initData.tail;
        snake.dir = initData.dir;
        snake.inputQueue = initData.inputQueue;
    }
    
    // console.log(JSON.stringify(snake));
}

function emitGameState(room, gameState) {
    //var jsonGameState = JSON.stringify(gameState);
    // console.log("Emit : " + io.sockets.in(room));

    var byteCount = 0;
    for (let clientState of gameState) {
        byteCount += 2; //offset
        byteCount += clientState.tail.length * 4; //tail
    }
    //console.log("send: " + byteCount)
    var buffer = new ArrayBuffer(byteCount);
    const view = new DataView(buffer);
    var index = 0;
    for (let clientState of gameState) {
        view.setInt16(index, 2 + clientState.tail.length * 4);
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