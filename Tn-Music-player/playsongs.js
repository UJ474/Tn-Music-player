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
let timeElapsed = 0;
let songDuration = 0;
let trackingInterval = null;


function getSongDuration(songFilePath) {
    return new Promise((resolve, reject) => {
        const afinfoCurrentProcess = spawn('afinfo', [songFilePath]);
        
        afinfoCurrentProcess.stdout.on('data', (data) => {
            const durationMatch = data.toString().split('duration:')[1].split('.')[0].trim().match(/(\d+(\.\d+)?)/);
            if (durationMatch) {
                resolve(Number(durationMatch[1]) + 1);
            } else {
                reject(new Error('Could not determine song duration'));
            }
        });
        afinfoCurrentProcess.stderr.on('data', (data) => {
            reject(new Error(data.toString()));
        });
    });
}


function startElapsedTracking() {
    timeElapsed = 0;
    return setInterval(() => {
        if (!isPaused && currentProcess) {
            timeElapsed += 0.1;
        }
        listSongs();
    }, 100);
}

// check for available songs
// show the current song name and its state (playing/paused)
// read the songs directory
// list the available songs with the pointing arrow
// show progress bar with duration and elapsed time


function listSongs() {
    if (availableSongs.length > 0) {
        process.stdout.write(`\x1b[${availableSongs.length + 2}A\x1b[0J`);
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

   const BAR_WIDTH = 100;
   const filled = Math.floor((timeElapsed / songDuration) * BAR_WIDTH);
   const bar = '~'.repeat(filled) + '.'.repeat(BAR_WIDTH - filled);
   const fmt = s => String(Math.floor(s / 60)).padStart(2,'0') + ':' + String(Math.floor(s % 60)).padStart(2,'0');
   console.log(`[${bar}] ${fmt(timeElapsed)} / ${fmt(songDuration)}`);    
}

// get the playing song using index
// using path and vlc player spawn the song playing process
// start getting the elapsed time every 1s
// add the song in the history to save to go backward

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

    if (trackingInterval) clearInterval(trackingInterval);
    trackingInterval = startElapsedTracking();

    getSongDuration(fullPath).then(duration => {
        songDuration = duration;
    }).catch(err => {
        console.error(`Error getting duration: ${err.message}`);
    });

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

listSongs();
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


// show the current song playing
// first arrow navigation version printed songs list again and again. why did that happen, and how did you make the list redraw in the same place, like what was used for this?
// what implementation was used to pause/resume the song, how was the state managed? how was index managed to saty in the range?
// ASCI character codes used to detect user input in hex to match which key was pressed
// 0x03 - Ctrl+C => kills the process
// 0x1b 0x5b 0x41 - Up arrow => to move index up with min(0, index - 1)
// 0x1b 0x5b 0x42 - Down arrow => to move index down with max(availableSongs.length - 1, index + 1)
// 0x0d - Enter => to start the song playing process
// 0x6e - 'n' key => to increase the index by 1 and play next song
// 0x62 - 'b' key => to get the last song played in the history
// 0x70 - 'p' key => to toggle pause/resume the current song
// for key 'p' the implementation used to manage the state was to keep track of whether the song was paused or playing using a boolean variable isPaused.
// VLC uses a 'pause/n' command to toggle the playback state.
// used a promise to get the song duration using the 'afinfo' command and parse the output to extract the duration in seconds.
