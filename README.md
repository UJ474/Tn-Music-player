# Tn-Music-player

A lightweight, terminal-based CLI music player written in Node.js for macOS. The application scans a local directory for audio files, renders an interactive in-place terminal interface, provides real-time progress and duration tracking, and controls audio playback through a background VLC process using raw keystroke event handling.


## Overview

Tn-Music-player brings audio playback to the command line without requiring a graphical user interface. By combining Node.js stream handling, terminal ANSI control sequences, and VLC's remote control interface, it offers seamless playback, real-time elapsed time rendering, and keyboard-driven navigation.


## Core Concepts and Architecture

### 1. In-Place Terminal Rendering via ANSI Escape Codes
Standard terminal output typically appends lines sequentially, which creates screen clutter when updating dynamic content like playback timers. Tn-Music-player avoids this by using ANSI escape sequences:
- `\x1b[<N>A`: Moves the terminal cursor up by N lines.
- `\x1b[0J`: Clears all text from the current cursor position to the end of the screen.

Every time the display updates (every 100ms or on keypress), the cursor is repositioned to overwrite the previous list and progress bar, producing a smooth, flicker-free terminal interface.

### 2. Raw Mode Input Handling
Node.js normally buffers standard input line by line until the Enter key is pressed. Tn-Music-player switches standard input into raw mode using:
```javascript
process.stdin.setRawMode(true);
```
In raw mode:
- Input is received byte-by-byte without waiting for a newline.
- Keystrokes are not automatically echoed to the screen.
- Special keys (arrow keys, control combinations) emit multi-byte ANSI sequences that are parsed directly by hex byte matching.

### 3. VLC Remote Control via IPC
Audio playback is delegated to an external VLC process spawned in headless mode:
- `--no-video`: Disables all video output.
- `--quiet`: Suppresses informational log output.
- `--intf dummy`: Disables GUI interfaces.
- `--extraintf rc`: Enables the Remote Control text interface.
- `--rc-fake-tty`: Forces VLC to treat its input pipe as a TTY, enabling commands via standard input.

To toggle pause and resume, the application writes `pause\n` directly to the running VLC process's `stdin` stream rather than restarting the process.

### 4. Duration Resolution and Progress Tracking
- macOS Native `afinfo`: Audio file duration is retrieved asynchronously by spawning the macOS built-in `afinfo` utility and parsing the metadata output with regular expressions wrapped in a JavaScript Promise.
- Elapsed Time Interval: A 100ms timer tracks elapsed time while playing and recalculates the progress bar width (100 characters) across filled (`~`) and unfilled (`.`) segments formatted into `MM:SS` time markers.

### 5. Playback History Stack
The player maintains an internal `songHistory` array and a pointer `historyIndex`:
- When a new song is played, subsequent history is pruned and the new track is pushed to the stack.
- Pressing the back key (`b`) moves the history index backward, allowing users to return to previously played tracks in chronological order.


## Technologies Used

- Node.js (Runtime Environment)
  - `child_process`: Uses `spawn` to run external player and metadata processes (`vlc`, `afinfo`).
  - `fs`: Synchronously reads the contents of the songs directory (`fs.readdirSync`).
  - `path`: Resolves cross-platform absolute and relative file paths (`path.resolve`).
  - `process.stdin` / `process.stdout`: Low-level stream manipulation for raw input reading and ANSI escape writing.
- VLC Media Player (CLI / RC Interface): Backend audio decoding and playback engine.
- macOS CoreAudio `afinfo`: Built-in macOS command-line utility for audio metadata and duration extraction.


## Keybindings and Controls

The player maps raw hex byte sequences received from `process.stdin` to player actions:

| Key | Byte / Escape Code | Action | Behavior |
| --- | --- | --- | --- |
| Up Arrow | `0x1b 0x5b 0x41` | Navigate Up | Decrements selection index; clamped at 0 |
| Down Arrow | `0x1b 0x5b 0x42` | Navigate Down | Increments selection index; clamped at max song count |
| Enter | `0x0d` | Play Selected | Spawns VLC process to play the currently highlighted track |
| n | `0x6e` | Next Track | Advances selection index cyclically and starts playback |
| b | `0x62` | Previous Track | Plays the previous song from the history stack |
| p | `0x70` | Pause / Resume | Toggles playback state by sending `pause\n` to VLC stdin |
| Ctrl + C | `0x03` | Exit | Terminates active VLC child process and exits cleanly |

Text command fallbacks supported when entered:
- `play <id|name>`: Plays a specific track by list number or exact filename.
- `stop`: Kills the current playback process.
- `exit`: Kills playback and exits the application.


## Prerequisites

1. Operating System: macOS (due to the use of native `afinfo` for duration extraction).
2. Node.js: Node.js 16.x or newer installed.
3. VLC Media Player: Installed and accessible at `/opt/homebrew/bin/vlc` (standard path for Apple Silicon Homebrew installations).


## Setup and Installation

### 1. Clone the Repository
```bash
git clone https://github.com/UJ474/Tn-Music-player.git
cd Tn-Music-player
```

### 2. Install Dependencies
Install VLC media player via Homebrew if not already installed:
```bash
brew install --cask vlc
```

Verify that VLC is available at `/opt/homebrew/bin/vlc`. If you are using an Intel Mac or custom installation where VLC is located elsewhere (e.g., `/usr/local/bin/vlc` or `/Applications/VLC.app/Contents/MacOS/VLC`), update the path in `Tn-Music-player/playsongs.js` accordingly.

Ensure Node.js is installed:
```bash
node -v
```

### 3. Add Audio Files
Create a `songs` directory inside `Tn-Music-player` (if not already present) and place your audio files (`.mp3`, `.m4a`, `.wav`, etc.) inside it:
```bash
mkdir -p Tn-Music-player/songs
cp /path/to/your/music/*.mp3 Tn-Music-player/songs/
```


## Project Structure

```
Tn-Music-player/
├── README.md                      # Project documentation
└── Tn-Music-player/
    ├── playsongs.js               # Main executable player script
    └── songs/                     # Directory containing local audio files
```


## Usage

Navigate to the `Tn-Music-player` subdirectory and run the script:

```bash
cd Tn-Music-player
node playsongs.js
```

Or make the script executable directly:
```bash
chmod +x playsongs.js
./playsongs.js
```

Once running:
1. Use the Up and Down arrow keys to highlight a song in the list.
2. Press Enter to start playback.
3. Use `p` to pause and resume.
4. Use `n` to skip to the next track, or `b` to return to the previously played track.
5. Press `Ctrl + C` to stop playback and exit.
