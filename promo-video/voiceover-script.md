# RotVault — Voiceover Scripts

Use these with the promo videos in this folder. Record your voice (phone voice memos, Audacity, or CapCut/TikTok voiceover) and lay it over the matching video file.

---

## Video files

| File | Format | Length | Best for |
|------|--------|--------|----------|
| `RotVault-Preview.mp4` | 16:9 (1280×720) | ~30 sec | Quick posts, Discord |
| `RotVault-Preview-Long.mp4` | 16:9 (1280×720) | ~72 sec | YouTube, Gumroad, Twitter |
| `RotVault-TikTok.mp4` | 9:16 (1080×1920) | ~39 sec | TikTok, Reels, Shorts |

---

## LONG VERSION (~72 sec)
**Video:** `RotVault-Preview-Long.mp4`

Read at a natural, confident pace — not too fast.

| Time | On screen | Say this |
|------|-----------|----------|
| 0:00–0:04 | ROT VAULT logo | "If you trade brainrots in Steal The Brainrots… you need RotVault." |
| 0:04–0:09 | "Still tracking in Discord DMs?" | "Stop counting profit in your head, or losing track in Discord messages." |
| 0:09–0:15 | Dashboard stats | "RotVault shows your total sold, total spent, net profit, and how many brainrots you have in stock — all in one dashboard." |
| 0:15–0:20 | Search catalog | "Adding stock is easy. Search the full brainrot catalog — every item, with icons." |
| 0:20–0:26 | Mutations + prices | "Pick your mutation, set what you paid, and what you're asking for it." |
| 0:26–0:31 | Traits grid | "Stack traits too — Bats, Skibidi, Pumpkin — with multipliers built in." |
| 0:31–0:37 | Stock list | "Your stock list updates instantly. See what you paid, what you're asking, and hit Sell when you flip it." |
| 0:37–0:42 | Mark as Sold | "Enter your sale price… and RotVault calculates your profit on that trade automatically." |
| 0:42–0:47 | Stats update | "Total sold, total spent, and net profit all update for you. No spreadsheets." |
| 0:47–0:52 | Sold tab | "Check the Sold tab for your full sale history — every flip, every profit." |
| 0:52–0:57 | Purchased tab | "The Purchased tab logs every buy you've ever made." |
| 0:57–1:02 | Feature grid | "Full catalog, all mutations, trait multipliers, auto profit math — and your data saves on your device." |
| 1:02–1:07 | Desktop app | "You can use it free in your browser, or install the desktop app with custom colors and a neon border." |
| 1:07–1:13 | CTA + URL | "Try RotVault free — link in the description. brandinoc.github.io/brainrot-tracker" |

### Long version — casual / TikTok voice variant

> "Bro if you're flipping brainrots and still using notes app… RotVault tracks your stock, your buys, your sells, and your actual profit. Search any brainrot, pick mutations and traits, add what you paid, sell it, done — profit calculated. Free in browser or download the app. Link below."

---

## TIKTOK / VERTICAL VERSION (~39 sec)
**Video:** `RotVault-TikTok.mp4`

Energy: slightly faster, punchy. Good for trending sounds underneath (keep voiceover loud).

| Time | On screen | Say this |
|------|-----------|----------|
| 0:00–0:03 | Logo intro | "RotVault." |
| 0:03–0:07 | Hook text | "Trading brainrots but have no idea what you're actually making?" |
| 0:07–0:12 | Stats dashboard | "This tracks everything — sold, spent, profit, and stock." |
| 0:12–0:18 | Add stock modal | "Add any brainrot from the full catalog. Mutations. Traits. Buy price. Ask price." |
| 0:18–0:23 | Stock list + Sell | "When you flip it — hit Sell." |
| 0:23–0:28 | Sold modal + profit | "Type what you sold it for. Profit? Done for you." |
| 0:28–0:33 | Big net profit | "Five thousand three hundred net profit. Every sale tracked." |
| 0:33–0:39 | CTA | "It's free. Link in bio — brandinoc dot github dot io slash brainrot-tracker." |

### TikTok caption (copy-paste)

```
Track your brainrot stock + profit 📊🧠
Free tracker for Steal The Brainrots

🔗 brandinoc.github.io/brainrot-tracker

#stealthebrainrots #roblox #brainrot #robloxtrading #rotvault
```

### TikTok hashtags (pick 5–8)

`#StealTheBrainrots` `#Roblox` `#Brainrot` `#RobloxTrading` `#RotVault` `#STB` `#RobloxTips` `#Trading`

---

## SHORT VERSION (~30 sec)
**Video:** `RotVault-Preview.mp4`

| Time | Say this |
|------|----------|
| 0:00–0:03 | "RotVault — track your brainrot stock, sales, and profit." |
| 0:03–0:08 | "See your totals at a glance." |
| 0:08–0:14 | "Add stock from the full catalog with mutations and traits." |
| 0:14–0:19 | "Your list updates — hit Sell when you flip." |
| 0:19–0:24 | "Profit calculated instantly." |
| 0:24–0:29 | "Free at brandinoc.github.io/brainrot-tracker" |

---

## How to add voiceover (easy methods)

### CapCut (free, recommended)
1. Import `RotVault-TikTok.mp4` or `RotVault-Preview-Long.mp4`
2. Tap **Text → Text to speech** OR record with **Audio → Record**
3. Align your clips to the timestamps above
4. Export at **1080p**

### TikTok app
1. Upload the vertical video
2. Tap **Voiceover** and read the TikTok script
3. Lower original video volume to 0% (video has no audio)
4. Add caption + hashtags from above

### Gumroad / YouTube
1. Use the **long** video + long script
2. Optional: add background music at **10–15% volume** (lo-fi or phonk works with the purple aesthetic)

---

## Re-record videos

```bat
cd promo-video
Record Promo Video.bat        → short only
Record All Promo Videos.bat   → all 3 versions
```

Or individually:
- `npm run record:long`
- `npm run record:vertical`
- `npm run record:all`
