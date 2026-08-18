#!/opt/homebrew/bin/node
// shebang

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { file } = require("googleapis/build/src/apis/file");

const SONGS_DIR = './songs';
let availableSongs = [];
let currentProcess = null;

function listSongs() {
    availableSongs = fs.readdirSync(SONGS_DIR);
    availableSongs.forEach((song, i) => console.log(`${i + 1}. ${song}`));
}

function playSong(id) {
    const idx = parseInt(id) - 1;
    const songName = (!isNaN(idx) && availableSongs[idx]) ? availableSongs[idx] : id;
    const fullPath = path.resolve(SONGS_DIR, songName);
    if (currentProcess) currentProcess.kill();
    currentProcess = spawn('afplay', [fullPath])

}

listSongs();

process.stdin.on("data", data => {
    const input = data.toString().trim();
    if (input.startsWith("play ")) playSong(input.slice(5).trim());
    else if (input === "stop" && currentProcess) currentProcess.kill();
    else if (input === "exit") { if (currentProcess) currentProcess.kill(); process.exit(); }
});