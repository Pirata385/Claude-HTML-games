// Água-Tinta — UI strings (owner E), English only (owner decision; supersedes the pt-BR/en plan in DESIGN.md).
// Prefixes: ui.* hud.* settings.* tut.* note.* credits.* rarity.* size.* common.* (plus debug.error, used by AQ.scenes).
// Canvas-drawn strings (credits.*, ui.title.subtitle, ui.title.name) stay inside the atlas charset (no em dash, ellipsis or arrows).
(function (AQ) {
  'use strict';

  AQ.i18n.add('en', {
    common: {
      ok: "OK",
      cancel: "Cancel",
      close: "Close",
      back: "Back",
      yes: "Yes",
      no: "No",
      "continue": "Continue",
      confirm: "Confirm",
      on: "On",
      off: "Off",
      auto: "Auto",
      none: "None",
      remove: "Remove",
      locked: "Locked",
      unknown: "???",
      coins: {
        one: "{n} coin",
        other: "{n} coins"
      },
      pearls: {
        one: "{n} pearl",
        other: "{n} pearls"
      }
    },
    rarity: {
      C: "Common",
      U: "Uncommon",
      R: "Rare",
      L: "Legendary"
    },
    size: {
      XS: "Tiny",
      S: "Small",
      M: "Medium",
      L: "Large",
      XL: "Huge",
      XXL: "Colossal"
    },
    debug: {
      error: "Error in {where} (see the console)"
    },
    ui: {
      listSep: ", ",
      unit: {
        cm: "{n} cm",
        kg: "{n} kg",
        m: "{n} m"
      },
      time: {
        dh: "{d} d {h} h",
        hm: "{h} h {m} min",
        m: "{m} min",
        s: "{s} s"
      },
      title: {
        name: "Água-Tinta",
        subtitle: "fishing and aquarium in ascii",
        "continue": "Continue",
        newGame: "New game",
        settings: "Settings",
        credits: "Credits",
        gamesMenu: "Games menu",
        version: "v{v}",
        confirmNewTitle: "Start over?",
        confirmNewBody: "There is a saved game. A new game replaces your current progress (a backup is kept).",
        confirmNewOk: "New game"
      },
      tank: {
        name: "Tank {n}",
        short: "T{n}",
        title: "Choose a tank",
        usage: "{used}/{cap}",
        full: "no room",
        fits: "fits",
        current: "current",
        fishCount: {
          one: "{n} fish",
          other: "{n} fish"
        },
        cantFit: "This fish does not fit in any tank."
      },
      toast: {
        saveInvalid: "Invalid save — a backup was kept.",
        quality: "Quality adjusted: {preset}",
        newSpecies: "+1 species in the Notebook: {name}",
        seen: "Spotted: {name}",
        sighting: "Sighting: {name}!",
        sold: "Sold: {name} for {amount}",
        kept: "{name} went to {tank}",
        released: "{name} swam home. Luck +5%",
        record: "New record: {name}, {len}",
        goal: "Goal complete: {name}",
        achievement: "Achievement: {name}",
        zoneUnlocked: "New water unlocked: {zone}",
        stars: "The aquarium now has {stars}",
        paper: "Paper theme unlocked",
        collected: "Ticket booth: +{amount}",
        tillEmpty: "The ticket booth is empty for now.",
        bred: "A baby {name} was born!",
        producedPearl: "The oyster made {n} pearl(s).",
        producedBait: "Your tank shrimp gave {n} baits.",
        fed: "{tank} fed.",
        feedNo: "Not enough coins to feed.",
        hungry: "{tank} is hungry.",
        predatorWarn: "{predator} is eyeing {prey} in {tank}…",
        predation: "{predator} ate {prey} in {tank}. Keep the tanks fed!",
        frenzy: "Frenzy! The birds are diving!",
        frenzyEnd: "The frenzy is over.",
        legendary: "Something huge moves in the deep…",
        bought: "Bought: {name}",
        deniedCoins: "Not enough coins.",
        deniedPearls: "Not enough pearls.",
        deniedReq: "Not available yet.",
        deniedMaxed: "Already maxed out.",
        baitOut: "Out of bait — back to {name}.",
        baitEquipped: "Bait: {name}",
        early: "Too early! The fish got spooked.",
        late: "Too late — it let go of the bait.",
        escape: "It got away!",
        waited: "You waited until {time} ({phase}).",
        imported: "Save imported.",
        copied: "Copied to the clipboard.",
        copyFail: "Could not copy — select the text and copy it by hand.",
        reset: "Save erased. A fresh start.",
        fullscreenFail: "Fullscreen is not available in this browser.",
        noFit: "No tank has room for it.",
        moved: "{name} moved to {tank}",
        renamed: "Now called {name}.",
        message: "A bottle! \"{title}\"",
        tutorialSkipped: "Tutorial skipped.",
        tutorialDone: "All set! The sea is yours.",
        light: "{tank} light: {mode}",
        legendaryEscaped: "It will return while the conditions hold.",
        sellNo: "Could not sell."
      },
      catch: {
        title: "On the line!",
        "new": "NEW!",
        trophy: "Trophy!",
        dense: "Dense Ink",
        record: "Record: {len}",
        recordNew: "New record!",
        keep: "Keep",
        keepSub: "{tank} · {used}/{cap}",
        keepNone: "no room",
        keepNo: "cannot stay",
        sell: "Sell",
        release: "Release",
        releaseSub: "+5% luck",
        measures: "{len} · {kg}",
        otherTank: "other tank",
        keysHint: "Shortcuts: 1 · 2 · 3"
      },
      fish: {
        title: "Fish card",
        origin: "Caught in {zone}, {date}",
        born: "Born here, {date}",
        juvenile: "Juvenile · {pct} grown",
        happy: "Happiness",
        factor: {
          food: "Food",
          space: "Space",
          habitat: "Habitat",
          light: "Light",
          harmony: "Harmony",
          quality: "Water"
        },
        likes: "Likes: {list}",
        value: "Sale value: {price}",
        move: "Move",
        sell: "Sell",
        release: "Release",
        rename: "Rename",
        renameLabel: "Nickname",
        renameSave: "Save",
        releaseTitle: "Release {name}?",
        releaseBody: "It goes back to the sea. This cannot be undone.",
        sellTitle: "Sell {name}?",
        sellBody: "You get {price}.",
        gone: "This fish is no longer here.",
        habitat: {
          sand: "sand",
          plants: "plants",
          rocks: "rocks",
          coral: "coral",
          cave: "caves",
          open: "open water"
        },
        light: {
          day: "bright light",
          dim: "dim light",
          night: "darkness"
        },
        dense: "Dense Ink",
        trophy: "Trophy",
        bred: "aquarium-born"
      },
      zone: {
        depth: "Depth: down to {max}",
        now: "Now: {time} · {phase} · {weather}",
        forecast: "Forecast: {list}",
        species: "Species: {n}/{total}",
        bestNow: "Good right now",
        bestNone: "Nothing known for these conditions… yet.",
        fish: "Fish",
        wait: "Wait until…",
        waitTitle: "Wait until",
        locked: "Locked",
        requires: "To fish here:",
        luck: "Luck: +{pct}"
      },
      bait: {
        title: "Bait",
        count: "x{n}",
        infinite: "endless",
        lure: "lure · permanent",
        use: "Use",
        inUse: "in use",
        none: "none left",
        buyHint: "Buy more bait in the Shop."
      },
      decor: {
        title: "Decorate {tank}",
        slot: "Slot {n}",
        empty: "empty",
        pick: "Pick a slot, then a piece.",
        owned: "x{n}",
        none: "No decor in storage. Buy some in the Shop.",
        attract: "+{pct} appeal",
        remove: "Take out",
        place: "Place",
        tags: {
          rocks: "rocks",
          plants: "plants",
          coral: "coral",
          cave: "cave",
          sand: "sand"
        }
      },
      offline: {
        title: "While you were away",
        away: "Away for {time}",
        coins: "Ticket booth: +{amount}",
        pearls: "Oysters: +{n} pearl(s)",
        capped: "The safe filled up. A bigger safe holds more time.",
        nothing: "The sea stayed quiet.",
        calm: "The fish waited for you. Nobody was lost.",
        ok: "Great",
        goAquarium: "See aquarium"
      },
      shop: {
        title: "Seu Zé's Store",
        tab: {
          gear: "Gear",
          bait: "Bait",
          boat: "Boat",
          aquarium: "Aquarium",
          decor: "Decor"
        },
        buy: "Buy",
        free: "free",
        maxed: "maxed",
        owned: "owned",
        have: "have {n}",
        stored: "in storage: {n}",
        requires: "Requires: {list}",
        current: "Current: {name}",
        tierLabel: "{name}",
        forTank: "For",
        pack: "pack of {n}",
        permanent: "permanent",
        tankNew: "New tank (#{n})",
        stars: "{n} stars",
        unlocks: "Unlocks: {zone}",
        empty: "Nothing for sale here yet.",
        stat: {
          cast: "Cast",
          window: "Strike window",
          St: "Steering",
          Ls: "Strength",
          maxLen: "Reach",
          snapGrace: "Grace",
          reelSpeed: "Reel",
          riseRate: "Response",
          hookClass: "Hook",
          radius: "Light",
          cap: "Capacity",
          filter: "Filter",
          hours: "Safe"
        },
        deny: {
          coins: "Need more coins",
          pearls: "Need more pearls",
          req: "Requirement missing",
          maxed: "Already maxed"
        },
        feeder: "Auto-feeder",
        hoursVal: "{n} h"
      },
      bestiary: {
        title: "Field Notebook",
        completion: "{n}/{total} ({pct})",
        tab: {
          sightings: "Sight.",
          messages: "Msg"
        },
        tabFull: {
          sightings: "Sightings",
          messages: "Messages"
        },
        unknown: "???",
        seen: "(seen)",
        caught: "x{n}",
        record: "Record: {len} · {kg}",
        recordDate: "on {date}",
        counts: "Caught {caught} · Kept {kept} · Sold {sold} · Released {released}",
        dense: "Dense Ink: {v}",
        band: {
          surface: "surface",
          mid: "mid-water",
          bottom: "bottom"
        },
        where: "{zone} · {band}",
        hintTime: "Time: {list}",
        hintWeather: "Weather: {list}",
        hintBait: "Favourite bait: {list}",
        anyTime: "any time",
        anyWeather: "any weather",
        hidden: "Catch one (or find a bottle) to learn more.",
        sightingSeen: "Spotted on {date}",
        sightingNot: "Not spotted yet.",
        messageNot: "Bottle not found yet.",
        pick: "Pick an entry.",
        nonCatch: "not catchable",
        legend: "Legendary"
      },
      goals: {
        title: "Goals",
        active: "In progress",
        done: "Completed",
        achievements: "Achievements",
        progress: "{cur}/{max}",
        reward: "Reward: {list}",
        allDone: "Every goal is done. The sea thanks you.",
        count: "{n}/{total}",
        locked: "???",
        unlock: {
          perola: "Black Pearl on sale",
          paperTheme: "Paper theme",
          papel: "Paper bait"
        },
        tabGoals: "Goals",
        tabAch: "Achievements"
      },
      pause: {
        title: "Paused",
        "continue": "Continue",
        settings: "Settings",
        bestiary: "Notebook",
        map: "Back to map",
        title2: "Title screen",
        gamesMenu: "Games menu"
      },
      saveio: {
        title: "Export / import",
        exportLabel: "Keep this text to take your progress elsewhere:",
        copy: "Copy",
        download: "Download file",
        importLabel: "Paste an exported save here:",
        "import": "Import",
        file: "Open file",
        err: {
          format: "Invalid format.",
          checksum: "The text is incomplete or was changed.",
          json: "Corrupted save.",
          shape: "This does not look like an Água-Tinta save.",
          future: "This save is from a newer version of the game.",
          migrate: "Could not convert this save."
        },
        confirmTitle: "Import this save?",
        confirmBody: "Your current progress will be replaced (a backup is kept).",
        exportTab: "Export",
        importTab: "Import"
      },
      confirm: {
        resetTitle: "Erase the save?",
        resetBody: "All progress will be erased. Settings are kept.",
        resetOk: "Erase…",
        reset2Title: "Are you really sure?",
        reset2Body: "This cannot be undone. The tanks will be empty again.",
        reset2Ok: "Erase everything",
        wait: "Wait… {n}"
      },
      note: {
        tap: "tap to continue",
        message: "Message in a bottle",
        story: "Note"
      },
      credits: {
        title: "Credits"
      },
      ending: {
        skip: "Skip"
      }
    },
    hud: {
      map: "Map",
      aquarium: "Aquarium",
      shop: "Shop",
      bestiary: "Notebook",
      goals: "Goals",
      back: "Map",
      pause: "Pause",
      bait: "Bait: {name} x{n}",
      baitInf: "Bait: {name}",
      baitShort: "{name} x{n}",
      retrieve: "Retrieve",
      reel: "Reel (hold to reel in)",
      clock: "{time} · {phase} · {weather}",
      wallet: "{coins} coins, {pearls} pearls",
      tank: "Tank {n}/{total}",
      feed: "Feed",
      feedFree: "free",
      decorate: "Decorate",
      light: "Light: {mode}",
      lightMode: {
        day: "Day",
        dim: "Dim",
        night: "Night"
      },
      contemplate: "Contemplate",
      contemplateExit: "tap to return",
      till: "Tickets",
      prevTank: "Previous tank",
      nextTank: "Next tank",
      saved: "saved",
      aquariumTitle: "AQUARIUM",
      happy: "{face} {pct}",
      usage: "{used}/{cap}",
      starsAria: "{n} stars",
      baitName: {
        massa: "dough",
        minhoca: "worm",
        camarao: "shrimp",
        lula: "squid",
        luminosa: "glow bait",
        colher: "spoon",
        jig: "jig",
        papel: "paper",
        perola: "Black Pearl"
      }
    },
    settings: {
      title: "Settings",
      sec: {
        sound: "Sound",
        video: "Display",
        controls: "Controls",
        game: "Game"
      },
      volMaster: "Master volume",
      volMusic: "Music",
      volSfx: "Effects",
      volAmbience: "Ambience",
      quality: "Quality",
      q: {
        auto: "Auto",
        high: "High",
        medium: "Medium",
        low: "Low"
      },
      motionStyle: "Motion",
      ms: {
        fluid: "Fluid",
        grid: "Classic grid"
      },
      reducedMotion: "Reduce motion",
      rm: {
        auto: "Auto",
        on: "Yes",
        off: "No"
      },
      glyphSize: "Glyph size",
      uiScale: "Interface scale",
      highContrast: "High contrast",
      theme: "Theme",
      th: {
        noite: "Night",
        papel: "Paper",
        papelLocked: "Paper (finish the story)"
      },
      haptics: "Vibration",
      showFps: "Show FPS",
      hints: "Control hints",
      handedness: "Hand",
      hand: {
        right: "Right",
        left: "Left"
      },
      assists: "Assists",
      autoSteer: "Auto rod",
      wideWindows: "Wide windows",
      fullscreen: "Fullscreen",
      fsEnter: "Enter",
      fsExit: "Exit",
      tutorial: "Tutorial",
      tutorialSkip: "Skip",
      tutorialDone: "done",
      save: "Save",
      "export": "Export",
      "import": "Import",
      reset: "Erase save…",
      na: "(not supported)"
    },
    tut: {
      cast: {
        touch: "Drag back and release to cast",
        mouse: "Click, drag back and release",
        keyboard: "← → to aim, hold Space",
        gamepad: "Aim with the stick, hold A"
      },
      sink: "The bait sinks…",
      wait: "Let the fish come closer…",
      nibble: "Not yet… wait for the bite.",
      strike: {
        touch: "NOW! Tap.",
        mouse: "NOW! Click.",
        keyboard: "NOW! Space.",
        gamepad: "NOW! Press A."
      },
      reel: {
        touch: "Hold (@) to reel in",
        mouse: "Hold the mouse button to reel in",
        keyboard: "Hold Space to reel in",
        gamepad: "Hold A to reel in"
      },
      tension: "keep it in the middle",
      steer: {
        touch: "Pull the rod the other way!  drag -->",
        mouse: "Pull the rod the other way!  mouse -->",
        keyboard: "Pull the rod the other way!  hold D -->",
        gamepad: "Pull the rod the other way!  stick -->"
      },
      keep: "Keep your first fish in the aquarium.",
      goAquarium: "Your fish is waiting. Head back to the map.",
      goAquariumMap: "Your fish is waiting. Open the Aquarium.",
      card: {
        touch: "Tap a fish to see its card.",
        mouse: "Click a fish to see its card.",
        keyboard: "Press , or . to pick a fish, then Space."
      },
      feed: "Feed the tank — the first one is free.",
      till: "Tap Tickets to collect what the visitors paid."
    },
    note: {
      intro: "Dear, the aquarium is yours now. The tanks are empty — and the sea is full.",
      firstCatch: "Every aquarium starts with a small fish.",
      aquarium: "A well-fed fish is a happy fish. The right light and a place to hide — and visitors will pay to see them.",
      recife: "On the Reef the fish run sideways. Hold the rod firm, always to the other side.",
      kelp: "In the Kelp Forest they flee to the rocks. Do not let them get there.",
      mar: "In the Open Sea the fish jump. When one leaves the water, let go of the reel.",
      abismo: "In the Abyss, only those who bring light can see. And some things glow on their own.",
      stars4: "Four stars, dear! Seu Zé has the Black Pearl recipe: one pearl for each stormy night.",
      ending: "All ink returns to the sea. Thank you for returning mine.",
      sign: {
        iara: "— Grandma Iara",
        i: "— I."
      }
    },
    credits: {
      title: "AGUA-TINTA",
      subtitle: "fishing and aquarium in ascii",
      l1: "a story by Grandma Iara",
      h2: "made by",
      l2: "five ink agents and a director",
      h3: "fish drawings",
      l3: "ASCII characters, one by one",
      h4: "typeface",
      l4: "JetBrains Mono, SIL OFL 1.1 license",
      h5: "sound",
      l5: "Web Audio, not a single file",
      h6: "thanks",
      l6: "to everyone who lets the small fish go",
      end: "thank you for playing"
    }
  });
})(window.AQ);
