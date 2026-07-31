# Run the S0 renderer proof

Requirements: Node.js `>=22.12.0`, npm and a desktop browser with WebGL2.

```bash
npm ci
npm run start -- --host 127.0.0.1
```

Open <http://127.0.0.1:5173>. The local Vite server supplies all runtime code;
the page does not request a CDN, remote font, image, audio file or analytics
endpoint.

Run the current foundation checks with:

```bash
npm run verify:s0
```

The browser check uses Python Playwright and the locally installed Google Chrome
when available. It saves JPEGs, timings, render counters and a JSON report under
`../evidence/s0/`.

This is an S0 foundation, not the completed game. It proves the approved local
Three.js/Vite/WebGL2 stack, real-time scene density, title/order handoff,
viewport support and first performance baseline. Locomotion, collision,
gameplay state, audio and complete-run evidence remain subsequent gates.
