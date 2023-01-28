// Authors:     Trenker Michael, Schranz Tobias (2023)
// Description: This script contains the logic for establishing and exchanging
//              data using the WebRTC protocol and the peer-connection. This
//              code example makes use of the browsers BroadcastChannel API as 
//              the signaling server for simplicity purposes. The peer-connection
//              can be established between different browsing tabs and windows.         

const connectButton = document.getElementById('connectButton');
const disconnectButton = document.getElementById('disconnectButton');
const acceptRequestButton = document.getElementById('acceptRequestButton');
const declineRequestButton = document.getElementById('declineRequestButton');
const statusText = document.getElementById('statusText');
const loader = document.getElementById('loader');
const modal = document.getElementById("requestModal");
let receivedAnswer = false;
let receivedAcknowledge = false;
let receiveChannel;
let sendChannel;
let pc;

connectButton.onclick = connect;
disconnectButton.onclick = disconnect;

// using BroadcastChannel API as signaling server
const signaling = new BroadcastChannel('drawing');

// broadcast a "ready" message every second until a peer is found
window.setInterval(() => {
    if (!(pc)) {
        signaling.postMessage({type: 'ready'});
    }
}, 1000);

signaling.onmessage = e => {
    // dispatch correct function based on signal type
    switch (e.data.type) {
        case 'ready':
            handleReady(); break;
        case 'offer':
            handleOffer(e.data); break;
        case 'candidate':
            handleCandidate(e.data); break;
        case 'answer':
            handleAnswer(e.data); break;
        case 'acknowledge': 
            handleAcknowledge(); break;
        case 'bye':
            hangup(); break;
    }
};

function handleReady(){
    if (!pc) {
        changeStatus(false, 'disconnected - ready to connect', '#FF0000');
        connectButton.disabled = false;
    }
}

async function handleOffer(offer) {   
    // check if no peer connection already exists and await user confirmation
    if (pc) {
        return;
    } else if (await waitForConfirmation()) {
        await createPeerConnection();
        await pc.setRemoteDescription(offer);
        pc.ondatachannel = (event) => {
            receiveChannel = event.channel;
            receiveChannel.onmessage = onReceiveChannelMessageCallback;
            receiveChannel.onopen = onReceiveChannelStateChange;
            receiveChannel.onclose = onReceiveChannelStateChange;
        }
        
        const answer = await pc.createAnswer();
        signaling.postMessage({
            type: 'answer',
            sdp: answer.sdp
        });
        await pc.setLocalDescription(answer);
        connectButton.disabled = true;
        
        // wait for acknowledge message from other peer 
        // => cancel connection after no answer in 5 seconds
        setTimeout(() => {
            if (!receivedAcknowledge) {
                hangup();
            }
        }, 5000);
     } else{
        hangup();
    }
}

async function handleCandidate(candidate) {
    if (!pc) {
        return;
    }
    if (!candidate.candidate) {
        await pc.addIceCandidate(null);
    } else {
        await pc.addIceCandidate(candidate);
    }
}

async function handleAnswer(answer) {
    receivedAnswer = true;
    // send acknowledge message after answer was received (similar to a 3-way-handshake)
    if (pc) {
        signaling.postMessage({type: 'acknowledge'});
        changeStatus(false, 'connected', '#3aad13');
        await pc.setRemoteDescription(answer);
    }
}

function handleAcknowledge(){
    receivedAcknowledge = true;
    changeStatus(false, 'connected', '#3aad13');
}

async function hangup() {
    // disconnect peer connection / reset connection 
    modal.style.display = "none";
    changeStatus();
    if (pc) {
        pc.close();
        pc = null;
    }
    sendChannel = null;               
    receiveChannel = null;
    receivedAnswer = false;           
    receivedAcknowledge = false;
    connectButton.disabled = true;    
    disconnectButton.disabled = true;
};

function createPeerConnection() {
    pc = new RTCPeerConnection();
    // set callback for responding with icecandidate
    pc.onicecandidate = e => {
        const message = {
            type: 'candidate',
            candidate: null,
        };
        if (e.candidate) {
            message.candidate = e.candidate.candidate;
            message.sdpMid = e.candidate.sdpMid;
            message.sdpMLineIndex = e.candidate.sdpMLineIndex;
        }
        signaling.postMessage(message);
    };
}

async function connect() {
    connectButton.disabled = true;
    disconnectButton.disabled = false;

    // follow the webrtc's connection procedure
    await createPeerConnection();
    sendChannel = pc.createDataChannel('sendDataChannel');
    sendChannel.onopen = onSendChannelStateChange;
    sendChannel.onmessage = onSendChannelMessageCallback;
    sendChannel.onclose = onSendChannelStateChange;

    const offer = await pc.createOffer();
    signaling.postMessage({
        type: 'offer',
        sdp: offer.sdp
    });
    await pc.setLocalDescription(offer);

    // wait for answer from peer; otherwise reset connection if timeout (5s) exceeded
    changeStatus(true, 'connecting ...');
    setTimeout(() => {
        if (!receivedAnswer) {
            hangup();
        }
    }, 5000);
}

async function disconnect() {
    hangup();
    signaling.postMessage({
        type: 'bye'
    });
}

//confirm if user accepts connection, otherwise resolve to false after 5 seconds
async function waitForConfirmation(){
    modal.style.display = "block";

    return new Promise((resolve, reject) => {
            acceptRequestButton.addEventListener('click', (e) => {
                modal.style.display = "none";
                changeStatus(true, 'waiting for acknowledge ...');
                resolve(true);
            });
            declineRequestButton.addEventListener('click', (e) => {
                modal.style.display = "none";
                resolve(false);
            });
            setTimeout(() => {
                modal.style.display = "none";
                resolve(false);
            }, 5000);
        }
    );
}

function webRTCSendData(data) {
    // send data (in our case drawing instructions) over the datachannel
    if (sendChannel && (sendChannel.readyState == 'open')) {
        sendChannel.send(data);
    } else if (receiveChannel && (receiveChannel.readyState == 'open')) {
        receiveChannel.send(data);
    }
}

function onReceiveChannelMessageCallback(event) {
    //draw lines received from peer
    drawLine(JSON.parse(event.data));
}

function onSendChannelMessageCallback(event) {
    //send own lines to peer
    drawLine(JSON.parse(event.data));
}

function onSendChannelStateChange() {
    if(sendChannel){
        const readyState = sendChannel.readyState;
        if (readyState === 'open') {
            clearCanvas(); //clear canvas on new connection
            disconnectButton.disabled = false;
        } else {
            disconnectButton.disabled = true;
        }
    }
}

function onReceiveChannelStateChange() {
    if (receiveChannel) {
        const readyState = receiveChannel.readyState;
        if (readyState === 'open') {
            clearCanvas(); //clear canvas on new connection
            disconnectButton.disabled = false;
            connectButton.disabled = true;
        } else {
            disconnectButton.disabled = true;
            connectButton.disabled = true;
        }
    }
}

function changeStatus(showLoader = true, message = "disconnected - searching for peer ...", color='black') {
    // change status message and loader (spinner) state
    if (showLoader) {
        loader.classList.remove('hidden');
    } else {
        loader.classList.add('hidden');
    }
    statusText.textContent = 'Status: ' + message;
    statusText.style.color = color;
}
