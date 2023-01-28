// Authors:         Trenker Michael, Schranz Tobias (2023)
// Description:     Handles the drawing part by manipulating the canvas. Every drawing 
//                  action of the user gets packaged into a json object and is sent over 
//                  to the connected peer via the implemented functionality in webrtc.js.
//                  Received drawing instructions from the connected peer are continuouslly 
//                  parsed and drawn onto to the canvas, thus synchronizing the users canvas.

const thicknessSlider = document.getElementById('thicknessSlider');
const colorPicker = document.getElementById("colorPicker");
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
var mouseDown = false;

function isCanvasSupported() {
    return !!(canvas.getContext && canvas.getContext('2d'));
}

function getThickness() {
    return thicknessSlider.value;
}

function getColor() {
    const pen = document.getElementById("toolPen");
    if (pen && !pen.checked) {
        return "white";
    } else {
        return colorPicker.value;
    }
}

function clearCanvas() {
    context.clearRect(0, 0, canvas.width, canvas.height);
}

function resize() {
    canvas.width = window.innerWidth - 35;
    canvas.height = window.innerHeight;
}

function mouseUpCallback() {
    mouseDown = false;
}

function keyDownCallback(e) {
    if (e.key === 'Backspace') {
        clearCanvas();
    }
}

function mouseDownCallback(e) {
    mouseDown = true;
    mouseMoveCallback(e);
}

function mouseMoveCallback(e) {
    // draw line if mouse is pressed and inside canvas
    if ((e.target.id === 'canvas') && mouseDown && (e.buttons === 1)) {
        drawInstruction = {
            start: {
                x: e.offsetX - e.movementX,
                y: e.offsetY - e.movementY
            },
            end: {
                x: e.offsetX,
                y: e.offsetY
            },
            thickness: getThickness(),
            color: getColor(),
        };
        drawLine(drawInstruction);
        webRTCSendData(JSON.stringify(drawInstruction));
    }
}

function drawLine(instruction) {
    context.beginPath();
    context.moveTo(instruction.start.x, instruction.start.y);
    context.lineTo(instruction.end.x, instruction.end.y);
    context.strokeStyle = instruction.color;
    context.lineWidth = instruction.thickness;
    context.lineCap = 'round';
    context.stroke();
}

if (isCanvasSupported) {
    window.onmousedown = mouseDownCallback;
    window.onmouseup = mouseUpCallback;
    window.onmousemove = mouseMoveCallback;
    window.onkeydown = keyDownCallback;
    window.onload = resize;
    window.onresize = resize;
}