#!/opt/homebrew/bin/node
// shebang

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");


const SONGS_DIR = './songs';
let availableSongs = [];
let currentProcess = null;
let userSelectionIndex = 0;
let songHistory = [];
let historyIndex = -1;
let isPaused = false;
let currentSongName = null;


function listSongs() {
    if (availableSongs.length > 0) {
        process.stdout.write(`\x1b[${availableSongs.length + 1}A\x1b[0J`);
    }
    const state = !currentSongName ? '[ CHOOSE A SONG TO PLAY ]' : isPaused ? '⏸ PAUSED' : '▶ PLAYING';
    console.log(`${state}  ${currentSongName ?? ''}`);

    availableSongs = fs.readdirSync(SONGS_DIR);
    availableSongs.forEach((song, i) => {
        if (i == userSelectionIndex) {
            console.log(`> ${song}`);
        } else {
            console.log(`  ${song}`);
        }
    });
}

function playSong(id) {
    const idx = parseInt(id) - 1;
    const songName = (!isNaN(idx) && availableSongs[idx]) ? availableSongs[idx] : id;
    currentSongName = songName;
    isPaused = false;
    const fullPath = path.resolve(SONGS_DIR, songName);
    if (currentProcess) currentProcess.kill();
    currentProcess = spawn('/opt/homebrew/bin/vlc', [
        '--no-video', '--quiet', '--intf', 'dummy',
        '--extraintf', 'rc', '--rc-fake-tty', fullPath
    ]);

    if (historyIndex === -1 || songHistory[historyIndex] !== songName) {
        songHistory = songHistory.slice(0, historyIndex + 1);
        songHistory.push(songName);
        historyIndex = songHistory.length - 1;
    }
}

function togglePause() {
    if (!currentProcess) return;
    isPaused = !isPaused;
    currentProcess.stdin.write('pause\n');
}

// listSongs();
process.stdin.setRawMode(true);

process.stdin.on("data", rawUserInput => {
    if (rawUserInput[0] === 0x03) {
        if (currentProcess) currentProcess.kill();
        process.exit(0);
    } else if (rawUserInput[0] === 0x1b && rawUserInput[1] === 0x5b) {
        if (rawUserInput[2] === 0x41) {
            userSelectionIndex = Math.max(0, userSelectionIndex - 1);
        } else if (rawUserInput[2] === 0x42) {
            userSelectionIndex = Math.min(availableSongs.length - 1, userSelectionIndex + 1);
        }
    } else if (rawUserInput[0] === 0x0d) {
        playSong(userSelectionIndex + 1);
    } else if (rawUserInput[0] === 0x6e) {
        userSelectionIndex = (userSelectionIndex + 1) % availableSongs.length;
        playSong(userSelectionIndex + 1);

    } else if (rawUserInput[0] === 0x62) {
        if (historyIndex > 0) {
            historyIndex--;
            const prevSong = songHistory[historyIndex];
            userSelectionIndex = availableSongs.indexOf(prevSong);
            const fullPath = path.resolve(SONGS_DIR, prevSong);
            if (currentProcess) currentProcess.kill();
            currentProcess = spawn('/opt/homebrew/bin/vlc', [
                '--no-video', '--quiet', '--intf', 'dummy',
                '--extraintf', 'rc', '--rc-fake-tty', fullPath
            ]);
        }
    } else if (rawUserInput[0] === 0x70) {
        togglePause();
    } else {
    const input = rawUserInput.toString().trim();
    if (input.startsWith("play ")) playSong(input.slice(5).trim());
    else if (input === "stop" && currentProcess) currentProcess.kill();
        else if (input === "exit") { if (currentProcess) currentProcess.kill(); process.exit(); }
    }
    listSongs();
});
