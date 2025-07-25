# Aurora-Webserver

Complete rewrite and combination of [Aurora-React](https://github.com/sierra-m/Aurora-React) and
[Gaia-Core-Server](https://github.com/sierra-m/Gaia-Core-Server). The old website used ES6/7/8 transpiled
with Babel to run on Node 12. The new site is entirely typescript, running on [Bun](https://bun.sh),
a fast all-in-one JavaScript runtime.

## Key Differences

Below are the major framework changes:

| Item               | Old             | New              |
|--------------------|-----------------|------------------|
| Runtime            | Node 12         | Bun              |
| Language           | Node, ES6/7/8   | Typescript       |
| Transpiler         | Babel           | Bun (internally) |
| Backend Framework  | Express         | Express          |
| Frontend Framework | React (classic) | React (hooks)    |
| Hot Reloading      | react-scripts   | Vite             |
| Production Build   | Webpack         | Vite             |

The vast majority of changes are due to implementing typescript and changing to new (supported) libraries,
removing bloat, minimizing dependencies, etc. There are also a number of UI improvements - switching to hooks,
updating to use Bootstrap 5, and correcting React state usage has fixed many long-time bugs and given the
frontend a fresh, new feel.

To install dependencies:

```bash
bun install
```

To build the app for production:

```bash
vite build
```

To run:

```bash
bun start
```
