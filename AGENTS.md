# Repository instructions

- Work directly on `main`. Commit each completed, validated change to `main` and push it to `origin/main`. Do not create feature branches or pull requests unless the user explicitly asks.
- Build an installable, responsive PWA for shared-camera motion games, primarily for Avery and Cameron. Avery defaults to blue and Cameron to green. Allow players to choose their colors.
- Keep the person-shaped blob avatars simple. Support multiple players on one camera and keep joint tracking separate from individual game rules so more motion games can be added.
- Process camera frames on the device. Do not upload or record camera video. Handle permission denial, missing players, and camera shutdown clearly.
- Keep keyboard and touch play available, and preserve offline play after the app has been cached.
- Publish through GitHub Actions to GitHub Pages on pushes to `main`. Keep asset paths compatible with the `/workout-game/` project path.
- Run `npm run check`, `npm test`, and `npm run build` before committing application changes. Validate changed UI in a browser when available. Report any hardware-dependent behavior that could not be exercised.
