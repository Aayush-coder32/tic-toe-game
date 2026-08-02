# Neon Noughts

Neon Noughts is a production-quality, dependency-free Tic-Tac-Toe web app built around a calm glassmorphism interface and a focused, replayable game loop. It works as a static site: open `index.html` and start playing.

## Features

- Player vs Player pass-and-play mode.
- Player vs Computer with Easy, Medium, Hard, and Impossible difficulty levels.
- Easy random AI, Medium 50/50 smart-or-random AI, and minimax-powered Hard/Impossible AI.
- Responsive 3×3 board with animated placement, hover states, winning-line glow, and confetti.
- Dark Midnight and light Daylight themes, high-contrast mode, reduced-motion support, and visible keyboard focus.
- Undo, redo, restart, pause/resume, hint, game timer, move history, and auto-restart.
- Persistent scoreboard and personal statistics powered by `localStorage`.
- Win rate, current streak, longest streak, best score, recent-results graph, and achievement badges.
- Daily perfect-play challenge.
- Custom player name and symbol selection.
- Web Audio sound effects with mute/unmute controls; no sound files required.
- Board screenshot export, statistics export/import, share/copy score, and fullscreen mode.
- Rules and preferences surfaces designed for keyboard and screen-reader-friendly use.

## Screenshots

The app includes a landing screen, setup dialog, responsive game workspace, settings dialog, pause state, and result celebration. Open `index.html` to view the current interface at its intended size; no build step or server is required.

## Installation

1. Download or clone this folder.
2. Open `index.html` in a current desktop or mobile browser.
3. Select a game mode and start playing.

No package manager, compilation, server, or environment variables are needed.

## Folder structure

```text
tic toe game/
├── index.html   # Accessible application markup and screen structure
├── style.css    # Responsive visual system, themes, animations, and layout
├── script.js    # Game engine, AI, persistence, sound, export, and UI state
└── README.md    # Project documentation
```

## How to play

Choose “Play a match” from the home screen, select Player vs Player or Player vs Computer, and tune the setup options. Place a mark in an empty cell when it is your turn. Connect three marks in a row, column, or diagonal to win.

In a computer match, the difficulty controls the opponent: Easy plays random moves, Medium mixes smart and random moves, Hard searches for the best move, and Impossible uses perfect minimax play. Use `P` to pause and `H` to request a hint while playing.

Scores and stats are stored locally in the browser. Use “Export data” in the footer to download a JSON backup. To import a backup, right-click “Export data” and choose a previously exported JSON file.

## Technologies used

- HTML5 semantic markup and ARIA attributes.
- CSS3 custom properties, grid/flexbox layout, responsive media queries, animations, and glass effects.
- Modern JavaScript (ES6+) with no frameworks or libraries.
- `localStorage` for persistence.
- Web Audio API for sound effects.
- Canvas API for board screenshot export.
- Fullscreen, Clipboard, Web Share, File, and Blob APIs where supported by the browser.

## Future improvements

- Optional background music and a richer sound pack.
- Online multiplayer with a small server-side match relay.
- More board skins and player-customized color palettes.
- Additional AI personality profiles and opening-book analysis.

## License

Released under the MIT License. You may use, modify, and distribute the project with attribution.
