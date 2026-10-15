/**
 * Seeds an empty ChordVault DB (DB_PATH, default ./data/chordvault.db) through the app's models,
 * and leaves a DB that already has users alone:
 * a hidden _system owner and the demo admin with sample songs and setlists.
 *
 * Usage: node scripts/seed-data.mjs
 */

import { createRequire } from 'module';
import crypto from 'crypto';
import { DEMO_ACCOUNT } from './lib/session.mjs';
const require = createRequire(import.meta.url);
const { db } = require('../lib/db');
const User = require('../lib/models/user');
const Song = require('../lib/models/song');
const Setlist = require('../lib/models/setlist');
const { hashPassword } = require('../lib/auth');
const { ROLES, VISIBILITY } = require('../lib/constants');

if (User.count().count > 0) {
  console.log('Database already has users, skipping seed');
  db.close();
  process.exit(0);
}

const system = User.create('_system', await hashPassword(crypto.randomBytes(32).toString('hex')), ROLES.OWNER);
console.log(`Created _system (id: ${system.id}, role: owner)`);
const demo = User.create(DEMO_ACCOUNT.username, await hashPassword(DEMO_ACCOUNT.password), ROLES.ADMIN);
console.log(`Created ${DEMO_ACCOUNT.username} (id: ${demo.id}, role: admin)`);

const songs = [
  {
    title: 'Amazing Grace',
    artist: 'John Newton',
    content: `{title: Amazing Grace}\n{artist: John Newton}\n{key: G}\n\n{start_of_verse: Verse 1}\n[G]Amazing grace, how [G7]sweet the [C]sound\nThat [C]saved a [G]wretch like [Em]me[D]\n[G]I once was lost, but [G7]now am [C]found\nWas [C]blind but [G]now [D]I [G]see\n{end_of_verse}\n\n{start_of_verse: Verse 2}\n[G]'Twas grace that [G7]taught my [C]heart to fear\nAnd [C]grace my [G]fears re[Em]lieved[D]\n[G]How precious [G7]did that [C]grace appear\nThe [C]hour I [G]first [D]be[G]lieved\n{end_of_verse}\n\n{start_of_verse: Verse 3}\n[G]Through many [G7]dangers, [C]toils and snares\nI [C]have al[G]ready [Em]come[D]\n[G]'Tis grace hath [G7]brought me [C]safe thus far\nAnd [C]grace will [G]lead [D]me [G]home\n{end_of_verse}`,
    key: 'G', language: 'en', tags: 'hymn,worship', bpm: 72, format_detected: 'ChordPro',
    youtube_url: 'https://www.youtube.com/watch?v=Jbe7OruLk8I',
  },
  {
    title: 'It Is Well with My Soul',
    artist: 'Horatio Spafford',
    content: `{title: It Is Well with My Soul}\n{artist: Horatio Spafford}\n{key: C}\n\n{start_of_verse: Verse 1}\nWhen [C]peace like a [F]river at[C]tendeth my way,\nWhen [Am]sorrows like [D7]sea billows [G]roll;\nWhat[C]ever my [F]lot, Thou hast [C]taught me to [Am]say,\nIt is [F]well, it is [G7]well with my [C]soul.\n{end_of_verse}\n\n{start_of_chorus}\nIt is [G]well (it is [C]well)\nWith my [G]soul (with my [C]soul),\nIt is [F]well, it is [G7]well with my [C]soul.\n{end_of_chorus}\n\n{start_of_verse: Verse 2}\nThough [C]Satan should [F]buffet, though [C]trials should come,\nLet [Am]this blest as[D7]surance con[G]trol,\nThat [C]Christ has re[F]garded my [C]helpless es[Am]tate,\nAnd hath [F]shed His own [G7]blood for my [C]soul.\n{end_of_verse}`,
    key: 'C', language: 'en', tags: 'hymn,worship', bpm: 72, format_detected: 'ChordPro',
  },
  {
    title: 'Blessed Assurance',
    artist: 'Fanny Crosby',
    content: `{title: Blessed Assurance}\n{artist: Fanny Crosby}\n{key: D}\n\n{start_of_verse: Verse 1}\n[D]Blessed as[G]surance, [D]Jesus is mine!\n[D]O what a [E7]foretaste of [A]glory divine!\n[D]Heir of sal[G]vation, [D]purchase of [Bm]God,\n[E7]Born of His [D]Spirit, [A7]washed in His [D]blood.\n{end_of_verse}\n\n{start_of_chorus}\n[D]This is my [G]story, [D]this is my song,\n[A]Praising my [E7]Savior all [A]the day long;\n[D]This is my [G]story, [D]this is my [Bm]song,\n[G]Praising my [D]Savior [A7]all the day [D]long.\n{end_of_chorus}\n\n{start_of_verse: Verse 2}\n[D]Perfect sub[G]mission, [D]perfect delight,\n[D]Visions of [E7]rapture now [A]burst on my sight;\n[D]Angels de[G]scending [D]bring from a[Bm]bove\n[E7]Echoes of [D]mercy, [A7]whispers of [D]love.\n{end_of_verse}`,
    key: 'D', language: 'en', tags: 'hymn,opener', bpm: 96, format_detected: 'ChordPro',
  },
  {
    title: 'Holy, Holy, Holy',
    artist: 'Reginald Heber',
    content: `{title: Holy, Holy, Holy}\n{artist: Reginald Heber}\n{key: D}\n\n{start_of_verse: Verse 1}\n[D]Holy, holy, [Bm]holy! [G]Lord God Al[D]mighty!\nEarly in the [G]morning our [E7]song shall rise to [A]Thee;\n[D]Holy, holy, [Bm]holy, [G]merciful and [D]mighty!\n[G]God in three [D]Persons, [A7]blessed Trini[D]ty!\n{end_of_verse}\n\n{start_of_verse: Verse 2}\n[D]Holy, holy, [Bm]holy! [G]All the saints a[D]dore Thee,\nCasting down their [G]golden crowns a[E7]round the glassy [A]sea;\n[D]Cherubim and [Bm]seraphim [G]falling down be[D]fore Thee,\n[G]Who wast, and [D]art, and [A7]evermore shalt [D]be.\n{end_of_verse}`,
    key: 'D', language: 'en', tags: 'hymn,worship', bpm: 84, format_detected: 'ChordPro',
  },
  {
    title: 'Come Thou Fount of Every Blessing',
    artist: 'Robert Robinson',
    content: `{title: Come Thou Fount of Every Blessing}\n{artist: Robert Robinson}\n{key: D}\n\n{start_of_verse: Verse 1}\n[D]Come, Thou Fount of [G]every [D]blessing,\nTune my heart to [A]sing Thy [D]grace;\nStreams of mercy, [G]never [D]ceasing,\nCall for songs of [A]loudest [D]praise.\n{end_of_verse}\n\n{start_of_bridge: Refrain}\n[A]Teach me some me[D]lodious [A]sonnet,\n[A]Sung by flaming [D]tongues a[A]bove;\n[D]Praise the mount! I'm [G]fixed up[D]on it,\nMount of Thy re[A]deeming [D]love.\n{end_of_bridge}`,
    key: 'D', language: 'en', tags: 'hymn,closer', bpm: 88, format_detected: 'ChordPro',
  },
  {
    title: 'Silent Night',
    artist: 'Franz Gruber',
    content: `{title: Silent Night}\n{artist: Franz Gruber}\n{key: C}\n\n{start_of_verse: Verse 1}\n[C]Silent night, holy [C]night\n[G7]All is calm, [C]all is bright\n[F]Round yon Virgin [C]Mother and Child\n[F]Holy Infant so [C]tender and mild\n[G7]Sleep in heavenly [Am]peace[F]\n[C]Sleep [G7]in heavenly [C]peace\n{end_of_verse}\n\n{start_of_verse: Verse 2}\n[C]Silent night, holy [C]night\n[G7]Shepherds quake [C]at the sight\n[F]Glories stream from [C]heaven afar\n[F]Heavenly hosts sing [C]Alleluia\n[G7]Christ the Savior is [Am]born[F]\n[C]Christ [G7]the Savior is [C]born\n{end_of_verse}\n\n{start_of_verse: Verse 3}\n[C]Silent night, holy [C]night\n[G7]Son of God, [C]love's pure light\n[F]Radiant beams from [C]Thy holy face\n[F]With the dawn of re[C]deeming grace\n[G7]Jesus, Lord, at Thy [Am]birth[F]\n[C]Jesus, [G7]Lord, at Thy [C]birth\n{end_of_verse}`,
    key: 'C', language: 'en', tags: 'hymn,christmas', bpm: 60, format_detected: 'ChordPro',
  },
];

const songIds = songs.map(({ content, format_detected, youtube_url = null, ...meta }) => {
  const id = Song.create(demo.id, { ...meta, youtube_url }, content, VISIBILITY.PUBLIC, format_detected).lastInsertRowid;
  console.log(`  Song: ${meta.title} (id: ${id})`);
  return id;
});

// Sunday opens with a song that has a chorus, so playback shows every section style.
const setlists = [
  ['Sunday Morning Worship', VISIBILITY.PUBLIC, '2026-03-23', [1, 2, 3, 0]],
  ['Christmas Eve Service', VISIBILITY.PUBLIC, '2025-12-24', [5, 0]],
  ['Personal Practice', VISIBILITY.PRIVATE, '2026-03-19', [4]],
];
for (const [name, visibility, date, order] of setlists) {
  const setlistId = Setlist.create(demo.id, name, visibility, date).lastInsertRowid;
  for (const i of order) Setlist.addSongEntry(setlistId, songIds[i], {});
  console.log(`  Setlist: ${name} (id: ${setlistId}, ${visibility}, ${order.length} songs)`);
}

db.close();
console.log('Seed complete');
