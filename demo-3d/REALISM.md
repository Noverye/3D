# Making the 3D game more realistic

Everything in `demo-3d` is built procedurally so the game runs with no
downloads. It is laid out so that each part can be replaced with real assets
later, without rewriting the game. This note lists the hooks and the
conventions a realistic asset needs to follow.

## Already realism-ready

- **Units and scale:** metres, y up, real proportions. The cabin is 15 × 7 m (it was 4.6 m deep; the back wall moved out 2.4 m with the furniture against it, so every room has space to walk round, plus a reading nook beside the hearth; `G.ZM` in core.js maps a position in the old layout to the new one),
  with 2.7 m walls; the characters are 1.84 m and 1.60 m tall.
- **Lighting:** physically based materials (`MeshStandardMaterial`), physically
  correct light units, ACES tone mapping, sRGB output, image-based lighting
  from environment maps (sunset, night, day outside, a warm room inside),
  shadow maps, SSAO on Epic.
- **Time of day:** one set of blended values (`STATE.day`, `STATE.tod`)
  drives sky, sun, fog, exposure, window glow and lamps, so a physical sky or
  baked lighting can be dropped in as another set.
- **Sound:** sources are placed in the world (fire, fridge, clock, windows,
  kettle) and heard through HRTF panners from the camera, muffled through
  walls. Recorded audio can replace each procedural source one at a time.
- **Story and content:** dialogue, interactions, reactions and smart objects
  live in `js/story.js` and refer to places by coordinates and ids, not to how
  anything looks.

## The asset manifest (`js/assets.js`)

List a real asset in `G.ASSET_MANIFEST` and it replaces the procedural one;
anything not listed stays procedural.

```js
props: {
  kettle:   { url: 'models/props/kettle.glb' },
  armchair: { url: 'models/props/armchair.glb', scale: 1 },
},
textures: {
  floor: { map: 'textures/oak_albedo.jpg', normalMap: 'textures/oak_normal.jpg',
           roughnessMap: 'textures/oak_rough.jpg', repeat: [2, 2] },
},
characters: {
  partner: { url: 'models/partner.glb', fit: true, keepMaterials: true, hideProcedural: 'all' },
},
```

Assets load before the world is built, behind the loading screen, so they are
compiled in the shader warm-up like everything else.

### Props

Slots that accept a model today: `kettle`, `armchair`, `chair` (all three
kitchen chairs), `clock`. New props should be added with
`G.propSlot(id, x, y, z, rotationY, buildFn)` or `G.propify(id, group)`.

Conventions for prop models:

- glTF 2.0 (`.glb`), metres, y up.
- Origin on the floor at the centre of the object's footprint; front faces +z.
- Fit the existing footprint. Colliders and interaction points are defined
  separately (in `interior.js` / `story.js`), so a model that is much larger or
  smaller than the procedural one needs those numbers changed too.
- Real PBR materials (base colour, normal, roughness/metalness). Keep texel
  density consistent across props, roughly 512–1024 px per metre.

### Textures

Any named material in `G.MAT` can take a texture set: `floor`, `boards` (the
interior walls), `logs` (the outside walls), `stone`, `shingle`, `snow`,
`plaid`, `knitCream`, `linen`, `rug`, `sofa`, `wood`, `darkWood`, and others.
A normal map replaces the painted bump map.

### Characters

The characters are animated by a procedural rig (hips, spine, chest, neck,
head, arms, legs) in `js/people.js`. A skinned model is driven by copying each
rig joint's motion onto the matching bone.

- Bone names are matched automatically for common rigs: Mixamo
  (`mixamorig:Hips`, `LeftArm`, `LeftForeArm`, `LeftUpLeg`…), Rigify / MPFB
  (`upperarm.L`, `forearm.L`, `thigh.L`, `shin.L`…) and similar. Left and
  right are worked out from where each bone actually sits.
- `fit: true` scales the model to the character's height.
- `keepMaterials: true` keeps the model's own materials (skin, hair, clothes)
  instead of the game's knit and jersey.
- `hideProcedural: 'all'` hides the procedural face and hair too. Use it when
  the model has its own head.
- Export in a relaxed A-pose or T-pose with the feet on the ground at the
  origin, facing +z.

The realistic MPFB characters are in `models/real/partner.glb` and
`models/real/player.glb`, made in Blender by `tools/game_export.py` on the
`claude/character-models` branch (`prepare()`, `optimise()`, `export_all()`).
They are compressed with meshopt geometry and WebP textures; `lib/meshopt_decoder.js`
decodes them. **To change a character, edit the `.blend` and export again;
don't edit the GLB.** `js/models_real.js` holds the same two files as base64,
for hosts that can't serve `.glb`. They're stored decompressed (`node tools/unmeshopt.js`)
so they load without WebAssembly. Regenerate it after a new export. Stats shows
which body each character got. The
children keep the built-in bodies.

Outdoor clothes are fitted to whatever body is loaded. `people.js`
(`measureFit`) measures the model in its rest pose. `life.js` (`fitGear`) then
uses those measurements to:
- widen each sleeve to clear its arm;
- flare the coat hem over the thighs and centre the coat on the body;
- set the hat on that skull and over the hair;
- move the scarf to the collar and size the boots to the feet.

The adults' long wool coats are real meshes in the models (`tools/coats.py` on the
`claude/character-models` branch: `make_coat()` builds each round its character's body and jumper,
`skin_coat()` weights it — upper coat like the body, never the arms; the skirt split front and back,
each half blending from the hips onto its own thigh and a spring bone, `coat_L` / `coat_R`). In the game
`setDressed` swaps the built-on coat for them, they take the game's wool, and `G.swingCoat` (people.js)
swings the tails so they trail, swing out on turns and settle when you stop. Hat, scarf and boots stay
built-on; the boots are sized from each model's own feet and ride its foot bones.

The children in the prologue are child copies of the same characters
(`models/real/kid_*.glb`, embedded in `js/models_kids.js`), made by `make_kid()`,
`kid_figure()` and `export_kids()` in `tools/game_export.py`; their bobble hats
and scarf are fitted the same way (`fitKid`).

Fitted on top of that, from each model's own measurements (life.js, `fitGear`):
- the hat comes down to just above the brows (the real eye line) and grows to cover the hair on top;
- the scarf rests on the long coat's front neckline, sized to the collar and riding up a little at the back;
- the coat's peaked sleeve heads are brought down onto a natural shoulder line;
- boots are sized to the body (a child's wellies stop below the knee);
- jumpers follow the hips, not the thighs, and their hems are let down a little (`fixTops`, people.js), so
  sitting doesn't pull them into a point or open a gap at the waist.

The exported hands lost most of their finger width when the meshes were simplified; `plumpFingers` (people.js)
pushes finger-weighted vertices out along their normals at load, and the relaxed hand closes the thumb toward
the index finger. Re-exporting the hands at full detail from the `.blend` would be the proper fix.

Hugs reach with two-bone IK on the model's own arm bones (`hugIK`, people.js): the taller one over the
shoulders, the other round the back, hands curled on the back.

The model's own jumper is hidden while the coat is on. The real heads have no blink shapes, so each eye
gets a skin-coloured lid (`makeRealLids` in people.js) on the head bone, shown while the eyes are shut: in
blinks, dozing, hugs. Hats and the snow on them are handed to the model's own head bone after fitting
(`toHeadBone` in life.js), so they stay on when the head turns. Blend-shape blinks from the `.blend` would be better.

### Motion smoothing

- The neck and head ride a critically damped spring toward their pose (`springHead`, people.js), so a new look-at,
  a glance, a doze or a hug eases in and out instead of snapping; a target behind keeps the same shoulder.
- Pose weights (arm poses, holding hands, swaying, the hug) use `G.spring` (core.js) instead of plain damping,
  so they start gently. Sitting down and getting up take about a second, eased, with the chest going forward
  over the feet half-way.
- Holding hands, both holding arms reach for one point between the two of you (`holdIK`, on the same two-bone
  solver as the hug, `solveArm`), swinging a little with the stride, so the hands meet.
- Feet follow uneven ground (`plantFeet`): the hips come down for the lower foot and the other knee bends.
- Outdoors the wind presses the coat hems and makes them flutter (`G.swingCoat`).
- Turning on the spot takes small steps; brisk steps in fresh snow kick a little powder off the toes (`G.kickAt`).
- The real eyes are split into two eyeballs on pivots and turn toward what the character looks at, ahead of
  the head, with small saccades (`makeRealEyes`, `aimEyes`, people.js).
- The scarf's hanging end is a chain of five knitted segments with verlet physics (`G.simScarf`, life.js):
  gravity, the body's own motion, a little wind, kept in front of the chest. The player's pace is on a spring.
- Boot shafts ride the shin bone and flare for the calf; the coat's seams share skin weights so they don't open;
  the legs under the leggings are tucked a few millimetres so skin can't poke through.

### Motion capture and body language

- **Clips** (`js/mocap.js`, built by `tools/mocap/build_clips.js` from the CMU Motion Capture Database, free for any use):
  idle (82_08, 40_10, 40_11, 77_02), walk (16_15), seated (86_09), and two newer ones:
  - **talking** (18_08 + 19_08, a recorded conversation with hand gestures): eased in on whoever is speaking, at half
    strength, and softer when walking or sitting;
  - **laughing** (13_14): plays on lines like "Ha!" and when the narration mentions laughing.
  The BVH sources go in `tools/mocap/bvh/` (not committed); the existing clips came out of the rebuild unchanged.
- **Seated hands** no longer stay glued to the thighs: each person drifts between resting places (thighs, clasped in
  the lap, a hand on the knee) on their own slow timing. When talking, the conversation recording moves the forearms
  over that. The CMU sitting clips weren't used for the arms, because their hands are up at the face.
- **Blinking stops** when the imitation drops its act (`noBlink`).

### Camera and control

- **Cutscenes:** you can always look around. Drag, or hold Z / C, to turn the view up to about 80° from where the
  camera stands; it eases back a few seconds after you let go. You stay where the scene puts you.
- **Conversations that aren't staged:** you can keep walking, and the camera follows you instead of cutting to
  over-the-shoulder shots. Hugs, dances, minigames and the scrapbook still hold you in place.
- **Lying in bed:** pushing a movement key gets you up when the story allows it (`G.lieMove`).
- **Playing as Partner:** the two swap bodies where they stand (`swapPlaces`, game.js), so nothing moves on screen.
  A scene hands control back to him *before* it places anyone (the guarded `STATE.busy`, `G.say`, `G.cutTo`,
  `G.setShot` and `G.UI.choose`). Interactions in the house are done by her, where she stands.

### The house as the Entity wins

- The colour grading's memory tint (`uMem`) drains the colour as corruption and memories taken go up, in the night and
  in Act IV. At its worst the bed gets made perfectly. Scrapbook pages go blank, and one child is painted out of the
  hall photograph (`G.take`).

## Build 69

- **Gentle nights:** `SETTINGS.nights` (`G.gentle()`). It skips `hunt()`, the night heartbeat, `slip()`, the obsessive walk-ups and the Act IV glimpses.
- **Endings dialog:** `#endings` on the title screen. It reads `snowed.endings`, and `showEnd` refreshes the count through `G.syncEndings`.

## Eyes and eyelids (build 86)

- Open eyes were always fine: brown irises, pupils and whites from the model's own eye texture. My earlier close-ups had caught her with her lids still shut.
- Closed eyes (every blink, every bed scene) used a cap whose colour was the whole skin texture's average, darkened, which came out grey-brown. It was also bigger than the eye, so it stood out past the lashes.
  - The cap's colour is now sampled from the face skin round each eye (cheek, temple, brow bone), keeping the brighter half of the texels so the lashes, brows and the socket's painted shadow don't darken it, then a touch darker and warmer for a lid in shade.
  - It now hugs the eyeball (1.035 × its radius, set 2% back), so the face round the opening hides its edge the way real lids sit.
  - The finish is 0.62 roughness instead of a flat 0.95.
- The eye material also cuts away fully transparent texels (`alphaTest` 0.5). This is harmless with the current eye mesh, which has no separate cornea, and correct if a future export includes one.

## His trousers (build 85)

- He no longer wears the same skin-tight leggings as her: `leggings_player` is now straight-leg trousers (`tools/trousers.py`, run in Blender). The result is saved as a new file, `cozy_characters_trousers.blend`, in the CozyCharacters folder; the other .blend files are untouched, and the file keeps a hidden `backup_leggings_player`.
  - Thigh: the leggings' own shape plus about 1.2 cm of ease.
  - Below the knee: the original leggings were open at the back of the calf, because knee socks covered it. That part is replaced by a new tube of rings around the middle of his calf, wide enough to clear every point of his body by 9 mm. His body is very sparse under the socks, so a few long faces span knee to ankle; the clearance is checked on faces, not just corners. It tapers slightly to an ankle hem with a turned-under edge, so his socks show below.
  - New vertices take their skin weights from his body underneath. Tested sitting (hips and knees at about 90°): the trousers bend with the legs and nothing pokes through.
- In the game: `tools/patch_gear.js` now accepts a `leggings_<name>` key, which replaces the leggings mesh in place, keeping its own material and without vertex colours.
- `models/real/*.glb` now match the embedded bundles again (the smaller textures from build 83, plus the trousers). The local test server loads the .glb files, while the published page and the zip load the bundles. Build 83's texture comparison had in fact compared the old .glb with itself, so the smaller textures were only properly checked in game from this build on. The full-resolution textures are still in the Blender files and in git history.

## Fixes from the scene sheet (build 84)

- Endings and The First Snow in bed: `home(true)` now uses the morning's close shot over the foot of the bed. The old one, 2.45 m up, caught the bedside lamps as big pale blobs in the corners.
- The First Snow porch bench: the shot moved inside the porch, to the right and higher (50° fov). The old one was 0.95 m away at bench height, showing her hat and his scarf. The first fix sat behind the railing and a post.
- Replaced: through one pane of the kitchen window and over the plants on the sill, so the window's cross frames the table instead of covering it, and she's visible.
- Prompts (E / Q) are hidden while a line of dialogue is on screen: E advances the line then, so showing "E Bed" was misleading. Walking during conversation is unchanged.

## Loading, Memories, the scene sheet (build 83)

- `tools/shrink_textures.py` re-encodes the oversized textures inside the embedded bundles: hair to 1024 px, skin to 1536 px, WebP q86 (alpha q90).
  - It repacks the GLB binary chunk around the changed image bufferViews and leaves geometry and materials untouched. Run it again after regenerating a bundle.
  - (Build 85: `models/real/` was brought back in line with the bundles; see above.)
  - Result: `models_real.js` 8.3 → 6.1 MB, `models_kids.js` 6.0 → 4.1 MB. No visible difference, even at closer than any in-game shot.
- `js/memories.js`
  - `G.remember('vig' | 'scrap' | 'photo', …)` is called from `meanwhile()`, `addScrap()` and `keepPhoto()`.
  - Storage keys: `snowed.mem.vig`, `snowed.mem.scrap` and `snowed.mem.photo` (newest 12 photos that fit, dropping the oldest if storage is full).
  - The title-screen panel has three tabs. Scrapbook paintings use `G.UI.paintSnap`, which now has a `candles` painting.
- `tools/tests/sheet.py` plays every chapter with the first answer each time, captures a JPEG at each new line or choice (plus one frame when a chapter waits for free play), and writes one self-contained HTML page with a grid per chapter.

## The power cut and the name slips (build 82)

- `js/powercut.js`
  - Trigger: evening, `cakeDone`, not cuddled, porch not done, not watching the door, inside, she's within 7 m, sunset (`todTarget < 0.5`), 35 s settled. Once.
  - Weather is held at `heavy`. The lamps stutter (power ×0.2 three times), then `LAMPS[i].on` is saved and cleared. `G.setHold(true)` with no timer; if the hand is let go she re-holds up to 3 times.
  - Candles: three wax cylinders on the coffee table, with flames (stretched spheres plus an additive radial-glow sprite) and one `PointLight` (intensity 0 until lit; 1.5 with a flicker during the cut, 0.55 after).
  - The `pcCandles` inter at the kitchen drawer (11.45, −1.55) opens a scene with a low shot from the hearth side (both undressed), and a match `strike` sound per candle.
  - Power returns 75 s after the candles (220 s without them), or quietly as the sofa scene starts (`Story.cuddle` wrapper).
  - Night: if `flags.powerCut` is set, after 40 s close together and free, the lamps go out with no flicker. The imitation stands `still` and gazes; two narration lines; lamps restored.
- Name slips
  - `G.fmt` resolves pet names through `G.nameSlip(k)` first. `G.say` and `bark` set `G.fmtWho` while formatting.
  - Only for `partner` lines in the `night` chapter. `{toHim}` → `callPartner` on the 2nd, 5th, 8th… use. `{dear}` → `callBoth[1]` with its last word moved to the front on the 2nd, 6th… use.
  - The first slip of each kind shows a hint 2.8 s later and calls `G.observe('slip_lovely' | 'slip_order')`. `slip()` checks `obs.slip_lovely`.
  - A few of the night's lines now carry pet names, so there's something to slip.

## Meanwhile, hands, the night's copies, sounds, phones (build 81)

- Meanwhile cutaways (`updateMeanwhile` in companion.js).
  - When they trigger: morning or evening; more than 6.5 m apart and not `sameRoom()`; she's lying in bed (morning) or her task is in the `do` phase with an id in `VIGS`; this has held for 14 s; at most 2 per chapter, 120 s apart, each id once.
  - Shot: the existing bed framing, or `vigShot`, which tries 15 angle and distance pairs around her face. It rejects positions on the other side of the cabin wall from her or blocked by `G.CAMBLOCK` (now exposed as `G.camBlocked`).
  - Lines: `N` with auto 6.5, then an optional `P` with auto 3.2, and a matching sound.
  - Also: in the morning, once he's out of bed, she leaves the cuddle pose (`lieDown` at `BED.R`, `shapeBed({R:true})`).
- Hand-holding (`updateHand`).
  - Walking outside together at 0.6–2.4 m/s within 2.4 m for 7 s, or idle together under the porch roof for 5 s, or the end of the window task → `G.setHold(true)` with `holdTimer` 14–34 s.
  - Cooldown 90–130 s. Only on his route in her chapters.
- Night copies (`updateWrong`, once each).
  - `overfeed` task at the hearth (fuel +0.5, then 1).
  - The window: it's placed 0.38 m beside him (`standAt`) with `STATE.snowStill` on while it speaks.
  - "There you are" after 75 s within 6 m.
  - Gated by `itNight()`: `nightUp`, door not open, not withdrawn, not slipping, not swapped.
- Sounds (Web Audio, no recordings).
  - `squeak` (triangle wave with a 38–58 Hz wobble, band-passed, in strokes) on every frost drawing.
  - `page` (a band-passed swish and a low pat) in the reading scene and the First Snow.
  - `catchFire` (a low whoomp and a quickening crackle) when lighting the fire, when she stokes it, and when the imitation does.
  - `paws` (uneven light crunches, fading out) for the fox tracks.
- Phones.
  - The corner bar hides the "Quality" label and Stats, so it fits on one line.
  - The title, pause, endings and scrapbook screens scroll when they don't fit (auto margins in a scrolling grid). Under 520 px tall, the title is smaller and the bar is hidden on the title screen.
  - Phone in landscape: subtitles, choices and prompts sit at the bottom, between the two control areas (`100vw − 380px`). Subtitle size still follows the subtitle setting (`--subK`).

## Cameras and reactions (build 80)

- `liven()` in game.js applies to every scene shot (`STATE.sceneShot`), scaled by `G.MOTION`.
  - Push-in: 6.5% of the distance, eased over 14 s from `CAM.shotT`, which `setShot` sets.
  - Arc: ±0.03 rad around the look point (period about 37 s), plus a 3% narrower fov.
  - Speaker lean: if the current speaker's head is within 0.42×fov of the view centre and under 7 m away, the look point moves toward it (at most 0.22 m or 16%) and the fov narrows by 2.5%. The lean eases in and out (`CAM.lean`).
- companion.js additions:
  - Window: `G.WINDOWS` panes below 2.2 m. He's idle for 6 s within 1.4 m of one and facing it → a `window` task beside him (it tries 10 candidate spots because of furniture), with `noReach` (new task option in `partnerTask`), a gaze, and a line for night, snow or day. At most 3 per chapter, cooldown 80 s.
  - Running indoors: speed above 2.4 inside for 1.5 s → a bark. At most 2, cooldown 150 s.
  - Away: in the morning or evening, more than 14 m apart for over 45 s, then back within 3.5 m → a bark. Checked before the goal hints, so the hints don't drown it out.

## Companion awareness (build 79)

- `js/companion.js` runs through `G.STEP_HOOKS`.
  - It is limited to his route in her chapters (`hers()`), and stays quiet while busy, during scripts, tasks or leads, while she's hidden or lying down, or when `flags.noBarks` is set.
- `goal()` returns a target and two lines for each chapter state.
  - If he hasn't got 1.5 m closer to the target for 40 s (75 s after the first prompt), `pointTowards` runs.
  - She barks, walks up to 2.2 m toward the target (`G.navOpen` check, 3 s cap), gazes at it and plays the `wave` pose. Cooldown 30 s.
- Wall bump: a movement key held, actual displacement under 0.15 m/s for 1.8 s, she's within 6 m → a bark. Cooldown 70 s.
  - `PLAYER.speed` is the commanded speed, so it doesn't drop against a wall. The check measures displacement instead.
- Evening memory barks: the first unused entry in `DAY` whose condition holds, when she's within 4 m and not seated. Every 55–90 s. Reset on jump.
- `life.js` STOKE task: if `F.fuel < 0.28`, the basket has logs, she's free, inside and within 8 m of the hearth, she walks to the hearth, plays the `warm` pose, and her `onEnd` adds 0.42 fuel and takes one log.
  - The 30 s gate uses a timestamp (`STOKE.at`) rather than a flag, so an aborted walk can't lock it.

## Together in bed (build 73)

- **`G.cuddleInBed(him, her)`:** him on his back, turned a little toward her. Her on her side against him (`lieRoll` about -1.05), her head at his shoulder and her knees drawn up a little. Her top arm rests across his chest, half-way down; his near arm goes round her with his hand at her back (`cuddleIK`, two-bone IK each frame while both are lying).
- **Build 74:** the blanket is pulled up to their shoulders as one broad mound over both of them, tucked in over their feet, so only their heads show, close together on the pillows. Her face is turned toward him and tucked in at his shoulder. Her forearm lies across the middle of his chest and his hand is at her back, both under the blanket, and his other hand rests on his stomach. The You Found Me opening now looks down from above the pillows, not up from the foot of the bed.
- **Used in the tender scenes:** bedtime, the first morning, climbing back in for "ten more minutes", and the endings that open in bed. The imitation's nights ("exactly on her side") and the her-route waking ("exactly half the bed") keep them apart on purpose.

## Loading and cold reactions (build 71)

- **Smaller models:** `tools/quantize_glb.js` stores the character geometry quantized (KHR_mesh_quantization, which GLTFLoader reads natively, so no WebAssembly decoder is needed). Normals become 8-bit, UVs and vertex colours 16-bit, and skin weights 8-bit, with each vertex still summing to exactly 255. Positions stay full floats. `dequantize()` in people.js turns those attributes straight back into floats after loading, because this three.js doesn't scale them on getX/setX and the game reshapes the bodies. The adults' file went from 10.7 to 8.3 MB, the children's from 7.5 to 6.0 MB. Run `node tools/quantize_glb.js` (and `... kids`) again after any `patch_gear.js`; the patcher works on quantized files.
- **Loading screen:** it waits only for the two adults. The children (needed only in the prologue) finish loading behind the title, and the prologue waits for them if they're not in yet.
- **Cold reactions:** stepping out from under the roof gives a 1.5 s shiver (arms in, a shudder through the shoulders, a bigger breath). Coming in from the snow gives two stamps on the porch or mat, with the sound. On the frozen lake they're slightly bent at the knees, with arms out for balance (more when moving) and an occasional small wobble.

## Character animation (build 70)

- **Reaching for things:** using something (the kettle, a door, the radio...) starts `G.startReach`. They turn to face it, and the nearer hand goes out to just short of it (two-bone IK through `solveArm`), holds, and comes back over about 1.1 s. There's a little lean for low things. It skips people, things out of reach, and anything while sitting or lying, and lets go if you walk off or a scene moves you. When she busies herself with something (her smart tasks), she reaches for it too.
- **Sitting down and getting up:** besides the existing forward lean, the hands now come forward onto the knees to brace or push off, peaking halfway.

## Interface (build 69)

- **Direction: frosted window glass at night.** Surfaces are cool and translucent (`--frost`, blurred and saturated). Text is a cool white (`--ink`). The warm lamplight colour (`--lamp`, #f3b76e) is kept for what you press (Begin, Resume), and for the choice you're on, which gets a lamp-coloured bar down its left edge.
- **Type:** Instrument Serif for the title, act cards, narration and endings; Hanken Grotesk for everything else; JetBrains Mono only inside key caps. No tracked all-caps labels.
- **Title:** bottom-left, the name large and calm, with a soft shadow behind the text block. Play as, Nights and Chapter sit in one glass panel with segmented controls (a recessed track with the chosen option lifted out). Below that are the Endings link and the controls as key caps.
- **Corner bar:** quality, time of day, stats and pause are one slim pane of glass with dividers.
- **Menus** (pause, endings) are one frosted pane each, with hairline dividers between rows. Nights can also be changed from the pause menu.
- **Phones:** below 560 px the title text gets a darker bottom-up gradient, the option rows wrap, and the key list is hidden.

## Build 68

- **Drone:** `G.Audio.set({ drone, droneFast })`. Two sines at 49 and 51.4 Hz plus a quiet triangle an octave up, lowpassed at 320 Hz and created on first use. It runs in the night and in Act IV before the reunion, and the pad drops to 30% then. `STATE.hush` cuts it in about 25 ms; it comes back over about 2 s.
- **No breath:** `G.noBreath` is wrapped in act4.js so the imitation (either route) never puffs in the cold.
- **Phones:** a tap within 1.2 s of a line ending doesn't count as "Come out" (`G.lineEndT`), so advancing the close call's last line can't get her caught by accident.

## Build 67

- **Hiding on the window seat:** a seated hiding pose (`hideSit`). Her knees are pulled up to her chest, her feet are tucked in on the cushion, and her arms wrap round her knees. She sits well back on the seat.
- **His night:** a heartbeat near the imitation once suspicion is at 2, and the lamps stutter before `slip()`.

## Her route through the night and Act IV (build 66)

- **Switch:** `G.herRoute()` (Partner chosen on the title screen). `CH.bedtime` hands over to `bedtimeHer`, `CH.night` to `nightHer` (Elsewhere with `{ her: true }`: she wakes beside him and gets up for water first), and `CH.lastbirthday` to `lastHer` (act4.js). `CH.act4_home` resumes either route.
- **Swapped bodies:** her route drives her body through `G.swapBodies()`, as Elsewhere does. Clothes belong to the model, not to whoever is driving it, so act4.js dresses through `dressBody(c, on)`.
- **Who "you" is:** speaker labels, the speaker camera and the talking gestures now follow the swap. `G.labelsTurned()` covers her chapters, swapped bodies, and her bedtime. This also fixes Elsewhere and dawn, which used to label her lines "Partner".
- **Her Act IV:** the trail pieces start hidden and appear as she places them (`TRAIL.show`). His version's interactions are off while `S.flags.herA4` is set. The Entity's lines at the door draw on what she did: `her_hid`, `caught`, `her_window`, `her_trail`, `her_sent`.

- **Suspense:** `heartbeat()` and `nearMiss()` in night.js (with `NIGHT.searching` and `NIGHT.tense`), and `G.Audio.heart()` (two low filtered-noise thumps). Coming out next to it calls `caught()` straight away (`NIGHT.justCaught` stops the search loop). In Act IV, the glimpses use the snow figure (`ENT`) at low opacity, and `STATE.snowStill` freezes the snow.

## Night light, poses and checks (build 65)

- **Moonlight indoors:** at night with every lamp off and the fire low, the indoor sky fill rises from 55% to 115%, so the dark kitchen is readable (blue, moonlit) instead of black.
- **Poses:** hiding is now a tighter self-hug (elbows in, hands on the opposite arms, not up at the face). Her held arm is pulled out lower, and his grabbing hand follows it.
- **The Entity:** it's shaded as packed snow. It keeps only a little of its own glow, adds a cold moonlit rim and a faint sparkle, and has deeper surface bumps and a drift of snow round its feet.
- **Endings after a chapter jump:** an ending left running by a jump to another chapter no longer puts its end card over the new chapter.
- **Checks:** there's a quick automated run of every chapter (each one jumped to and played for 45 s, as each character), which fails on any script error. It would have caught build 63's Act IV crash.

## Poses: hiding, the wrist grab, the Entity (build 64)

- **Wrist grab:** this uses IK (`grabIK` in people.js, set with `c.grabWith`). His arm 0 solves onto her arm-1 hand, wherever her `held` pose has put it, so the hands meet between them. A fixed `grab` arm pose is still there, but it read as an arm stuck out sideways on his rig.
- **Study hiding:** she's actually inside the lean-to (`G.ANNEX`), behind the door, and the camera holds a shot of the door from the kitchen. There are cuts in and out.
- **Entity:** the snow figure's arms are lathe shapes. r128 has no `CapsuleGeometry`, and the error stopped the rest of Act IV's setup in build 63.

## Hats, scarves, gloves and boots (builds 59–62)

All made in Blender round each character's own body (`tools/winter_gear.py`, run after `tools/overcoat.py` on `cozy_characters_overcoats.blend`), skinned to the same skeleton, and added to `models/real/*.glb` by `tools/patch_gear.js` (which also replaces the coat). The old built-in hat, scarf ring and boots stay in the game but hidden (`userData.replaced`).
- **Beanies:** shaped on the skull with room for the hair, the brim just above the brows and low at the back, a turned-up cuff; hers has a bobble. Knit ribs run round the head. Her hair is tucked to the new hat's real shape.
- **Scarves:** wrapped twice round the neck on the coat's collar, with two flat ends hanging down the chest (one longer), laid over the coat and clear of the lapels and buttons. The wraps follow the neck and chest; the ends take the coat's own weights.
- **Glove cuffs (62):** each glove has its own ribbed cuff tube, sized round the jumper sleeve and the wrist bones, from over the back of the hand 11 cm up the forearm under the coat sleeve, so no wrist shows when the arms bend (the body has no skin under the jumper to extend the glove along).
- **Gloves:** knitted, a layer over each hand with the hand's own finger weights (so they curl with the fingers), and a ribbed cuff that goes up under the sleeve.
- **Boots:** built in slices round the foot and lower leg to mid-calf, with a flat sole a little wider than the foot. His are dark leather; hers are tan suede with a fleece cuff (vertex colours, converted to linear in the patch).
- **Build 60:** his beanie sits higher, over the tops of his ears instead of down over them; the gloves have a little more room round the base of the thumb; and when sitting only the front of the coat lies on the lap (with the thighs) while the sides hang from the hips, and the coat-tail springs no longer swing the skirt; before, the whole skirt lifted into a dome over the lap.
- **Coat fixes:** pocket flaps and buttons move as one piece (no spike at the hip when sitting), and the turn-back cuffs are weighted from the sleeve only.
- **Loading:** a body that arrives after the loading screen gives up is now fitted and dressed as soon as it's measured (before, his outdoor clothes could stay unfitted).

## Wool overcoats (builds 57–58)

- **Tailored** (build 57, `tools/overcoat.py`, always starting again from the original coats kept as `backup_coat_*`): the coat body is fitted to the jumper's torso and the sleeves to its arms (1.5 / 1.2 cm ease), so the body no longer wraps round the arms. The front closes with an overlap, the back seam is welded, the collar sits over the jumper's neckline, the cuffs reach just past the wrist and the sleeve heads tuck under the shoulders. Weights above the hips copy the jumper's own, so coat and jumper bend together.
- **Skirt:** an even A-line from the hips (no ledge, no curving in under the seat), clear of the legs. The front and sides follow the thighs (it lies on the lap when sitting, opens with the stride); the back hangs from the hips and the coat-tail springs; under the knee it drapes with the shin.
- **Overcoat details** (build 58): a V opening with notched lapels, a turned-down collar, three dark horn buttons, two flap pockets at the hips, turn-back cuffs, and 6 mm of wool thickness (3.5 mm on the details), all skinned like the coat under them. Each coat is now about 4,800 vertices / 9,600 triangles.
- **In the game:** `tools/patch_overcoat.js` swaps the coat mesh in `models/real/*.glb` (and the embedded copies in `js/models_real.js`) for the export, with UVs (30 cm a tile) and vertex colours. The coat material uses a new wool texture (`TX.wool`, a fine melton with a faint twill; `TX.woolB` for the bump) instead of the jersey, with vertex colours on for the buttons. The old runtime shoulder fold in `life.js` is off (`window.COAT_FOLD` brings it back).
- **Blender files** (CozyCharacters folder on the user's Desktop): `cozy_characters_overcoats.blend` has the finished overcoats; `cozy_characters_coats_tailored.blend` the tailored stage. Earlier files and the originals are untouched.
- **Hair under the hat:** pressed further in (to 84% of the crown), so her bun no longer shows through the back.

## Winter clothes fitted (builds 54–56)

- **Coats refitted in Blender** (`tools/coats.py`, `fit_coat`): each coat is drawn in to sit about 1.6 cm off the jumper and body (1.2 cm on the sleeves), relaxed like cloth, with the skirt's flare kept below the hips and the front seam welded. Same vertices, so the skin weights still hold. The fitted positions are patched into `js/models_real.js` and `models/real/*.glb`.
- **Blender files** on the user's PC (CozyCharacters folder): `cozy_characters_coats_fit.blend` holds the fitted coats, with hidden `backup_coat_*` copies of the old ones; the exports are in `export_fit\`. The original `.blend` files are untouched (`cozy_characters_before_fit_session.blend` is the earlier state).
- **Hair under the hat:** her bun is pressed inside the hat while it's on (`tuckUnderHat` in `js/life.js`) and restored when it comes off, instead of poking through.
- **Hair under the hat (55):** all hair above the brim is pressed inside the crown (his too), fitted to the crown and brim only so nothing pokes through the bobble. The brim sits a little lower on the forehead.
- **Sleeves re-skinned (56):** the sleeves used to be weighted mostly to the hips and chest, so they stayed behind when the arms moved (his showed the jumper through, with a web from armpit to wrist). They are now weighted from the arm bones themselves (`weight_sleeves` in `tools/coats.py`): upper arm, a smooth hand-over to the forearm at the elbow, a little hand at the cuff, and the sleeve head shared with the shoulder and chest. Tested in Blender with arms out and reaching forward. Copied into the game's models by matching vertices (`JOINTS_0`/`WEIGHTS_0`).
- **Blender file:** the session's working copy is now `Downloads\\cozy_characters_coats_fit.blend` (the file that was open in Blender); the Desktop copy has the build-55 coats.
- **Scarf:** the loose tail hangs straight down the chest and lies against the coat. The body's forward is measured from the chest bone to the scarf root, because the rig's bone axes don't point forward (that had swung her tail out sideways).

## Stand-ins to replace later

These are deliberately cheap approximations, each in one place:

| Effect | Now | Realistic replacement |
| --- | --- | --- |
| Sunbeams | additive light shafts (`fx.js`, `buildSunbeams`) | volumetric lighting / froxel fog |
| Steam, breath, chimney smoke, snow puffs | sprites | particle system with lit, soft particles |
| Snowfall | point sprites | GPU particles with motion blur |
| Footprints, wet prints | instanced decals | deferred decals or a deformable snow height map |
| Windows | flat glow at night | interior mapping / real interior lighting seen through glass |
| Trees | near: spruces of separate drooping boughs with snow on their tops; far: low-poly cones; instanced | scanned or SpeedTree-style conifers with LODs |
| Fire | seven flame tongues at different depths and a bright core, a glowing coal bed, logs lit from below, a light that moves | flipbook or simulated fire with a light probe |
| Faces | procedural eyes, lids, lips | the model's own head with blend shapes |
| The Entity at the door | a pale translucent column with a head (`act4.js`) | a figure of drifting snow, shaped like a person |
| Hiding, the wrist grab | text only; hiding freezes you (`night.js`) | crouch and grip poses on the rigs |
| Hair | alpha-tested cards | the model's hair cards or strands |
| Radio music, humming, sound effects | synthesised in `game.js` (`G.Audio`) | recorded audio through the same placed sources |
| Gerald (the bullfinch) | primitive shapes (`fx.js`) | a small rigged bird with a few animation clips |
| Front door | hinged box, swings by proximity | modelled door with the same pivot (`G.FRONT_DOOR`) |
| Outdoor clothes | coat, hat, scarf and boots built over the body (`life.js`, `buildGear`) | clothing on the character model, swapped by a visibility flag |
| Snow on shoulders, frost | small snow caps; a frosted overlay drawn on a canvas | snow accumulation in the cloth shader; lens frost post-effect |
| Snowman, snow angels, the summer circle | spheres, decals, instanced tufts and flowers (`play.js`, `walk.js`) | sculpted snow, deformable snow, scanned grass and flowers |
| Props in hands (book, mug, logs, watering can) | attached to the chest or hand of the procedural rig | attached to hand bones of the model with proper grips |

## Performance budget

Measured on the current build: about 200 draw calls and 0.55 M triangles on
High; under 2 M triangles on Epic outdoors; no shaders compiled mid-game.
Realistic assets should keep draw calls down (static meshes are merged per
material and area by `G.mergeStatic`, so share materials where possible) and
come with LODs for anything seen from far away.
