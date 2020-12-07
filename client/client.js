const BG_COLOUR = '#231f20';

const socket = io(
                    // 'https://snake-stage.herokuapp.com/'
                    'http://localhost:3000'
                    ,{transports: ['websocket'], upgrade: false}
                );
socket.on('init', handleInit);
socket.on('gameState', handleGameState);
socket.on('terminate', function() {
    console.log('Client has exited in server');
});

window.addEventListener('beforeunload', function (e) {
    console.log("disconnecting...");
    socket.disconnect();
});

const gameScreen = document.getElementById('gameScreen');
const joinGameBtn = document.getElementById('joinGameButton');

let canvas, ctx;

/**** ENGINE SETUP ****/
var frameCount = 0;
var fpsInterval, startTime, now, then;

function InternalStart(fps) {
    fpsInterval = 1000 / fps;
    then = Date.now();
    startTime = then;
    
    Start();

    //InternalUpdate();
}

function InternalUpdate() 
{
    requestAnimationFrame(InternalUpdate);
    now = Date.now();
    var elapsed = now - then;
    if (elapsed > fpsInterval) 
    {
        // Get ready for next frame by setting then=now, but...
        // Also, adjust for fpsInterval not being multiple of 16.67
        then = now - (elapsed % fpsInterval);
        
        ctx.fillStyle = BG_COLOUR;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        Update(elapsed / 1000);
        
        var sinceStart = now - startTime;
        var currentFps = Math.round(1000 / (sinceStart / ++frameCount) * 100) / 100;
        
        ctx.font = "12px Arial";
        ctx.fillStyle = "white";
        ctx.fillText("FPS: "+currentFps, canvas.width-60, 10);
    }
}

/**** GAME_CODE ****/
let inputQueue = []
let initData = null;
let snake = null;

function handleInit(data)
{
    //console.log('Init: ' + data);
    initData = data;
    snake = data.snake;
    InternalStart(data.fps);

    DrawSnake(snake, initData.cellSize, initData.cellSize - 1, 'orange', 'white');
}

function handleGameState(buffer)
{
    Update();

    console.log(buffer.byteLength + ' : ' + Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join(''));
    var index = 0;
    while (index < buffer.byteLength) {
        let offset = bytesToint16(buffer.slice(index, index + 2));
        index += 2;
        let posX = bytesToint16(buffer.slice(index, index + 2));
        index += 2;
        let posY = bytesToint16(buffer.slice(index, index + 2));
        index += 2;
        let tail = []
        for (let i = 6; i < offset; i+= 4) {
            let posX = bytesToint16(buffer.slice(index, index + 2));
            index += 2;
            let posY = bytesToint16(buffer.slice(index, index + 2));
            index += 2;
            tail.push( { x: posX, y: posY } );
        }

        let snake = {
            pos: { x: posX, y: posY },
            tail: tail,
        }
        DrawSnake(snake, initData.cellSize, initData.cellSize - 1, 'orange', 'white');
    };
}

function bytesToint16(buffer)
{
    if (buffer.byteLength != 2) {
        console.log('This buffer size is not exactly 2. size: ' + buffer.byteLength);
    }
    const view = new DataView(buffer);
    return view.getUint16(0);
}

function Start()
{
    initialScreen.style.display = "none";
    gameScreen.style.display = "block";
  
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
  
    canvas.width = canvas.height = initData.gridSize * initData.cellSize;
  
    ctx.fillStyle = BG_COLOUR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  
    document.addEventListener('keydown', keydown);
}

function keydown(e) {
    socket.emit('keydown', e.keyCode);
}

function Update()
{
    ctx.fillStyle = BG_COLOUR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function DrawSnake(snake, step, size, headColor, tailColor)
{
    //console.log(snake);
    ctx.fillStyle = tailColor;
    for (let cell of snake.tail) 
    {
        ctx.fillRect(cell.x * step, cell.y * step, size, size);
    }

    ctx.fillStyle = headColor;
    ctx.fillRect(snake.pos.x * step, snake.pos.y * step, size, size);
}
