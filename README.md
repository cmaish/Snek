# 🐍 Snek Arena

A bright, colourful snake-arena game for kids — **no ads, no real-money shop, no tracking, works offline**.
It's a Progressive Web App made of plain static files (HTML/CSS/JS, no build step, no server code), so you can host it on S3/CloudFront or anywhere else that serves files.

## How it plays

- Steer by dragging anywhere on the screen (floating joystick), pointing the mouse, or arrow keys / WASD.
- Eat glowing dots to grow (⭐ stars are worth extra). Every snake wears a number badge with its size.
- **Bigger snakes eat smaller ones.** Bump into a smaller snake's body to chomp off its tail; hit it head-on to swallow it whole. Touch a bigger snake and *you* get eaten. Badges are **green** when you can eat that snake and **red** when it can eat you, and the screen edges glow red when a bigger snake is close.
- Hold **BOOST** (button, second finger, mouse button or space) to zoom; it costs a little size.
- Eat snakes quickly for combos (DOUBLE GULP!, TRIPLE GULP!…). Size milestones, kill feed, countdown, haptics, confetti and star ratings keep it lively.
- Matches last 3 minutes by default. Finish as the biggest snake for bonus coins. Coins buy body skins (19, with patterns, eyes and hats), **character heads** and boosters.

**Heads** (shop → 🐶 Heads; mix and match with any body): Classic Snek plus 41 characters — Shiba Inu, Puppy, Ginger Cat, Froggy, Chick, Mouse, Teddy Bear, Piggy, Hamster, Panda, Bunny, Dalmatian, Fox, Penguin, Koala, Sheep, Monkey, Raccoon, Cow, Owl, Husky, Black Cat, Polar Bear, Hedgehog, Tiger, Lion, Axolotl, Sloth, Bat, Reindeer, Shark, Dino, Ghost, Pumpkin, Robot, Alien, Ninja, Astronaut, Monster, Dragon and Unicorn. Dino, Dragon and Monster take their colour from the body skin. Bots wear random heads too.

**In-game power-ups** (bubbles in the arena; arrows at the screen edge point to nearby ones):
🧲 Magnet · ⚡ Zoom · ⭐ Super Star (invincible, eats anyone) · 2× Double growth · ❄️ Freeze (slows everyone else) · 🍰 Candy Rain (a shower of food) · 🍄 Giant (fights as if 50% bigger)

**Pre-game boosters** (bought with coins on the screen after PLAY):
🍔 Big Start · 🫧 Bubble Shield · 🧲 Super Magnet · 🚀 Turbo Fuel (free boosting) · ❤️ Extra Life · 💰 Coin Rush (double coins)

**Kid settings** (⚙️ on the home screen): sound, music, vibration, and boost button on the left for left-handers. There's also a 🎁 daily gift with a streak bonus.

## Grown-up settings (admin menu)

Tap the faint 🔒 in the bottom-right corner of the home screen (or open `…/#admin`). **The default PIN is `1234`** — change it in the PIN tab.

| Tab | What you can do |
| --- | --- |
| 🐶 Heads | Set each head's price (0 = free) or hide it; make every head free in one tap. |
| 🎨 Skins | Create, edit, duplicate, reorder, hide or delete skins. Set colours, pattern, eyes, hat, price, "free for everyone", and whether bots can wear it. Live preview. |
| 🎮 Game rules | Number of bots, difficulty, whether bots hunt the player, gentle mode (lose length instead of being eaten), match length, arena size, food amount, starting size, speed, spawn protection, boost on/off, names on/off, coin multiplier, which power-ups appear, booster prices (or turn boosters off), daily gift size. |
| 🪙 Player progress | Set/add coins, unlock or re-lock skins, reset best score or all progress. |
| 💾 Backup | Export skins, head prices + rules as `config.json`, or import one. |
| 🔑 PIN | Change the PIN. |

The admin config and the player's progress are stored **separately** in the browser (`snek.admin.v1` and `snek.progress.v1` in localStorage). Changing skins or rules never touches coins or unlocked skins unless you use the Player progress tab.

### Changing the defaults for every device

Settings made in the admin menu are saved on that device. To make them the default everywhere:

1. Admin menu → 💾 Backup → **Download config.json** (tick "include the PIN" if you want the same PIN everywhere).
2. Replace `public/config.json` on your host with that file.

Layers (later wins): built-in defaults → `config.json` on the server → that device's admin changes. "Restore defaults" in the admin menu falls back to `config.json`.
You can also hand-edit `config.json`; the format is the same as the export (`settings` and/or `skins`). The PIN is only a kid-proof gate, not real security — everything is client-side.

## Run it locally

```bash
python3 -m http.server 8080 -d public
# open http://localhost:8080
```

## Host it on AWS

Everything to upload is in `public/`. Service workers (offline mode + "Add to Home Screen") need **HTTPS**, so use CloudFront or Amplify rather than the plain S3 website endpoint.

**Easiest — AWS Amplify Hosting:** Amplify console → *Deploy without Git* → drag in a zip of the *contents* of `public/`. You get an HTTPS URL straight away.

**S3 + CloudFront:**

1. Create a private S3 bucket.
2. Create a CloudFront distribution with the bucket as origin (Origin Access Control), default root object `index.html`.
3. Deploy: `./deploy.sh <bucket-name> <distribution-id>` (needs the AWS CLI). The script sets `no-cache` on `index.html`, `sw.js`, `config.json` and the manifest so updates come through.

Then open the URL on the tablet/phone and use the browser's **Add to Home Screen** / **Install** (there's also a 📲 button on the home screen in Chrome/Edge). After the first load it works with no internet.

### Updating

Devices pick up new files in the background and use them on the next launch. To force an immediate refresh everywhere, bump `VERSION` in `public/sw.js` before deploying.

## Project layout

```
public/              ← upload this folder
  index.html
  manifest.webmanifest, sw.js, config.json
  css/style.css
  js/
    main.js     screens, HUD, shop, boosters, results
    boosters.js pre-game booster list
    game.js     arena simulation + rendering
    snake.js    snake movement & drawing
    bots.js     bot AI
    render.js   sprites, faces, hats, previews
    heads.js    character heads (built from ears/muzzles/noses/markings)
    skins.js    default skins + validation
    config.js   admin config layers + PIN
    storage.js  player progress
    admin.js    grown-up settings UI
    input.js    touch / mouse / keyboard
    audio.js    synthesised sound effects + music
  icons/
tools/               icon generator + heads.html gallery (not needed for hosting)
deploy.sh            S3/CloudFront upload helper
```

Everything (graphics, sound, music) is generated in code — there are no image or audio assets besides the app icons.
