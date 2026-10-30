(function () {
  'use strict';
  const A = window.Archives;
  const $ = (id) => document.getElementById(id);
  const RECORDS = [
    { title: 'The Armistice Telegram', short: 'ARMI­STICE TELEGRAM', theme: 'NOVEMBER 11 · VETERANS DAY' },
    { title: 'The November 23 Ledger', short: 'NOVEMBER 23 LEDGER', theme: 'NOVEMBER 23 · FIBONACCI DAY' },
    { title: 'The Missing Place Cards', theme: 'THANKSGIVING · NOVEMBER 26' },
    { title: 'The Harvest Inventory', theme: 'NOVEMBER 06 · HARVEST' },
    { title: 'The Repeated Hour', theme: 'NOVEMBER 01 · CLOCK CHANGE' },
    { title: 'The Election-Night Ledger', theme: 'NOVEMBER 03 · ELECTION DAY' },
    { title: 'The Remembrance Route', theme: 'NOVEMBER 19 · REMEMBRANCE' },
    { title: 'The First Frost Signal', theme: 'NOVEMBER 29 · OBSERVATORY' },
    { title: 'The Historian’s Index', theme: 'NOVEMBER 09 · HISTORICAL RESEARCH' },
    { title: 'The Lantern Switchboard', theme: 'NOVEMBER 30 · LANTERNS' },
    { title: 'The Eleventh Seal', theme: 'FINAL · ALL TEN CLUES' }
  ];
  let id = null;
  let puzzleData = null;
  let state = null;
  let view = 0;
  let toastTimer;

  function htmlEscape(value) {
    return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function getStorage(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }
  function setStorage(key, value) {
    try { localStorage.setItem(key, value); } catch (_) { /* Runs without storage; progress will be session-only. */ }
  }
  function stateKey(participant) { return 'november-archives-v1:' + participant; }
  function loadState(participant) {
    let saved;
    try { saved = JSON.parse(getStorage(stateKey(participant))); } catch (_) { /* malformed save */ }
    if (!saved || !Number.isInteger(saved.solved)) saved = {};
    return {
      solved: Math.min(11, Math.max(0, saved.solved || 0)),
      notes: saved.notes && typeof saved.notes === 'object' ? saved.notes : {},
      seats: Array.isArray(saved.seats) && saved.seats.length === 7 ? saved.seats : Array(7).fill(''),
      switches: Array.isArray(saved.switches) && saved.switches.length === 10 ? saved.switches.map(x => x ? 1 : 0) : Array(10).fill(0),
      drafts: saved.drafts && typeof saved.drafts === 'object' ? saved.drafts : {}
    };
  }
  function saveState() { if (id && state) setStorage(stateKey(id), JSON.stringify(state)); }
  function showToast(message) {
    $('toast').textContent = message;
    $('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2500);
  }
  function copyText(content, label) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(content).then(() => showToast(label + ' copied.'), () => showToast('Copy is unavailable here; select the text instead.'));
    } else {
      showToast('Clipboard unavailable in this browser. Select and copy the text.');
    }
  }
  function openParticipant(participant) {
    participant = A.normalizeId(participant);
    if (!A.validId(participant)) return false;
    id = participant;
    puzzleData = A.getData(id);
    state = loadState(id);
    view = state.solved;
    setStorage('november-archives-last-id', id);
    $('welcome').classList.add('hidden');
    $('workspace').classList.remove('hidden');
    $('participant-display').textContent = id;
    render();
    window.scrollTo(0, 0);
    return true;
  }
  function showWelcome() {
    id = null;
    state = null;
    puzzleData = null;
    $('workspace').classList.add('hidden');
    $('welcome').classList.remove('hidden');
    $('join-id').value = '';
    $('join-feedback').textContent = '';
    window.scrollTo(0, 0);
  }
  function nav() {
    // Puzzle 11 is intentionally absent from the menu until Puzzle 10 is solved.
    const revealed = state.solved >= 10;
    const total = state.solved === 11 ? 11 : 10;
    $('progress-fraction').textContent = String(state.solved).padStart(2, '0') + ' / ' + total;
    $('record-nav').innerHTML = RECORDS.slice(0, revealed ? 11 : 10).map((rec, i) => {
      const locked = i > state.solved;
      const completed = i < state.solved;
      const status = completed ? 'FILE OPENED' : locked ? 'SEALED / LOCKED' : i === 10 ? 'UNLISTED RECORD' : 'READY TO DECODE';
      return `<button type="button" class="${locked ? 'locked' : 'available'} ${view === i ? 'current' : ''}" data-view="${i}" ${locked ? 'disabled' : ''} aria-label="Record ${i + 1}: ${rec.title}${locked ? ' locked' : ''}">
         <span class="nav-number">${String(i + 1).padStart(2, '0')}</span><span class="nav-info"><b>${rec.title}</b><small>${status}</small></span><span class="nav-indicator">${completed ? '✓' : locked ? '⌁' : '↗'}</span>
       </button>`;
    }).join('') + (state.solved === 11 ? `<button type="button" class="available ${view === 11 ? 'current' : ''}" data-view="11"><span class="nav-number">★</span><span class="nav-info"><b>Completion certificate</b><small>ALL ELEVEN OPENED</small></span><span class="nav-indicator">↗</span></button>` : '');
    $('record-nav').querySelectorAll('button[data-view]').forEach(button => {
      button.addEventListener('click', () => {
        const next = Number(button.dataset.view);
        if (next <= state.solved) { view = next; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      });
    });
  }
  function header(number, title, subtitle, stamp) {
    return `<div class="record-heading"><div><div class="record-number">RECORD ${String(number).padStart(2, '0')} / PRIVATE COLLECTION · NOVEMBER 2026</div><h2>${title}</h2><p class="record-subtitle">${subtitle}</p></div><div class="record-stamp">${stamp}</div></div>`;
  }
  function answerBlock(title, description, placeholder, maxlength, ariaLabel, buttonText = 'Unlock next record →') {
    return `<div class="answer-area"><h3>${title}</h3><p>${description}</p><form id="answer-form" class="answer-form"><input class="answer-field" id="answer-input" aria-label="${ariaLabel}" autocomplete="off" spellcheck="false" maxlength="${maxlength}" placeholder="${placeholder}" required /><button type="submit" class="primary-btn">${buttonText}</button></form><div class="answer-feedback" id="answer-feedback" aria-live="polite"></div></div>`;
  }
  function notebook(index) {
    const saved = typeof state.notes[index] === 'string' ? state.notes[index] : '';
    return `<details class="notebook"><summary>PERSONAL FIELD NOTES / SCRATCHPAD</summary><textarea id="notes-input" aria-label="Your scratchpad" placeholder="Keep calculations or ideas here. They are saved in this browser.">${htmlEscape(saved)}</textarea><div class="notebook-caption">Private to this browser. No hints are stored here, only what you write.</div></details>`;
  }
  function telegramHTML() {
    const strips = puzzleData.telegram.strips.map(({ station, symbol }) => `<div class="telegram-strip"><span class="tag">LINE ${String(station).padStart(2, '0')}</span><strong>${symbol}</strong></div>`).join('');
    return header(1, 'The Armistice Telegram', 'NOVEMBER 11 · THE ELEVENTH HOUR', 'INTERCEPTED') + `
       <p class="narrative">At the eleventh hour of the eleventh day of the eleventh month in 1918, an armistice took effect. In this fictional archive, an operator's eight-digit routing number survived only as a series of encrypted signal slips. Nine slips were recovered. One is a forgery.</p>
       <div class="doc-block"><div class="doc-label">TRANSMITTER MANUAL / ROTOR XI</div>
         <p>Each original digit <span class="mono">D</span> (0 through 9) was transformed into a letter. Letters represent values <b>A = 0</b> through <b>Z = 25</b>. Line numbers <b>i</b> are 1 through 8. The four-digit key is <b>1918</b>, repeated as needed, starting at line 1.</p>
         <div class="formula">K<sub>i</sub> = [1, 9, 1, 8, 1, 9, 1, 8] at line i</div>
         <div class="formula">C<sub>i</sub> = (D<sub>i</sub> + i² + 11i + K<sub>i</sub>) mod 26</div>
         <p>To identify the forged duplicate, the last digit obeys the operator's checksum:</p>
         <div class="formula">D<sub>8</sub> = (3D<sub>1</sub> + D<sub>2</sub> + 4D<sub>3</sub> + D<sub>4</sub> + 5D<sub>5</sub> + 9D<sub>6</sub> + 2D<sub>7</sub>) mod 10</div>
       </div>
       <div class="doc-label">RECOVERED SIGNAL SLIPS / SCRAMBLED ORDER</div><div class="telegram-table">${strips}</div>
       <p class="doc-footnote">Two slips claim the same line number. Only one produces a valid eight-digit routing number. Preserve all leading zeros.</p>
       ${answerBlock('Restore the routing number', 'Enter the eight original digits in line-number order, not the order in which the slips were recovered.', '00000000', 8, 'Eight digit routing number')}
       ${notebook(0)}`;
  }
  function ledgerHTML() {
    const { a0, a1 } = puzzleData.ledger;
    return header(2, 'The November 23 Ledger', 'NOVEMBER 23 · FIBONACCI DAY', 'UNRESOLVED') + `
       <p class="narrative">November 23 is often written 11/23: the opening digits of the Fibonacci sequence, 1, 1, 2, 3. A ledger discovered between the archive's files contains a sequence built on the same rule, but its first two entries are different for every participant.</p>
       <div class="doc-block"><div class="doc-label">EXTRACT / MATHEMATICAL LEDGER</div><p>The first two entries of your ledger are:</p>
       <div class="ledger-head"><div class="ledger-chip"><small>ENTRY 0</small><strong>${a0.toLocaleString('en-US')}</strong></div><div class="ledger-chip"><small>ENTRY 1</small><strong>${a1.toLocaleString('en-US')}</strong></div></div>
       <p>For each subsequent entry, add the two preceding entries and retain only the final six digits:</p>
       <div class="formula">L<sub>n</sub> = (L<sub>n−1</sub> + L<sub>n−2</sub>) mod 1,000,000 &nbsp; for n ≥ 2</div>
       <p>Entries are indexed from zero. Compute the three values indicated below, then combine them using the final seal formula.</p></div>
       <div class="doc-block dark"><div class="doc-label">INDEXED ENTRIES / THE THREE MARKS</div>
       <div class="ledger-indices"><span>L<sub>1123</sub></span><span>L<sub>1918</sub></span><span>L<sub>2026</sub></span></div>
       <div class="formula">SEAL = (L<sub>1123</sub> + 11 × L<sub>1918</sub> + 23 × L<sub>2026</sub>) mod 1,000,000</div>
       <p>The archive accepts exactly six digits, including any leading zeros. A spreadsheet, a program, or another reliable method may be used.</p></div>
       ${answerBlock('Recover the ledger seal', 'Enter the six-digit result of the final formula.', '000000', 6, 'Six digit ledger seal')}
       ${notebook(1)}`;
  }
  function seatOptions(current, seatIndex) {
    return `<option value="">— choose —</option>` + puzzleData.table.guests.map(name => {
      const initial = name[0].toUpperCase();
      const elsewhere = state.seats.some((value, ix) => ix !== seatIndex && value === initial);
      return `<option value="${initial}" ${current === initial ? 'selected' : ''} ${elsewhere ? 'disabled' : ''}>${name}</option>`;
    }).join('');
  }
  function tableHTML() {
    const seats = Array.from({ length: 7 }, (_, ix) => `<div class="seat"><label class="seat-number" for="seat-${ix}">SEAT ${ix + 1}</label><select id="seat-${ix}" class="seat-select" data-seat="${ix}" aria-label="Seat ${ix + 1}">${seatOptions(state.seats[ix], ix)}</select></div>`).join('');
    const clues = puzzleData.table.clues.map(s => `<li>${htmlEscape(s)}</li>`).join('');
    return header(3, 'The Missing Place Cards', 'THANKSGIVING · THE SEVEN-GUEST TABLE', 'RECONSTRUCT') + `
       <p class="narrative">A Thanksgiving host left behind seven place cards and nine observations. The seating plan is missing. Every observation is true, and exactly one left-to-right arrangement satisfies all nine.</p>
       <div class="doc-block"><div class="doc-label">DINNER NOTES / RECOVERED WITNESS STATEMENTS</div>
       <p>Seven guests sit in a straight row, facing the same direction. Left and right always refer to the seating diagram below, with <b>seat 1 on the far left</b>.</p>
       <ol class="clue-list">${clues}</ol></div>
       <div class="doc-label">RECOVERED PLACE CARDS</div><div class="guest-list">${puzzleData.table.guests.map(n => `<div class="guest-pill">${n}</div>`).join('')}</div>
       <div class="answer-area"><h3>Reconstruct the table</h3><p>Choose one guest per numbered seat. Each name may be used only once. This arrangement is your answer.</p>
       <div class="seat-row">${seats}</div><div class="table-line" aria-hidden="true"></div><div class="table-caption">VIEWED FROM THE ENTRANCE · SEAT 1 IS ON THE LEFT</div>
       <form id="seating-form" class="answer-form"><button class="primary-btn" type="submit">Verify the seating plan →</button><button type="button" id="clear-seats" class="secondary-btn">Clear seats</button></form>
       <div class="answer-feedback" id="answer-feedback" aria-live="polite"></div></div>${notebook(2)}`;
  }
  // Archives 04–11. Each record uses a different mathematical or investigative tool.
  function harvestHTML() {
    const p=puzzleData.harvest;
    return header(4,'The Harvest Inventory','NOVEMBER 06 · THE MISSING HARVEST MANIFEST','UNCOUNTED') + `
      <p class="narrative">A cooperative's harvest inventory was sealed in four nearly identical crates of paperwork. The original total has been lost, but each clerk counted the same stock in bundles of a different size.</p>
      <div class="doc-block"><div class="doc-label">THE FOUR CLERKS / UNRECONCILED COUNTS</div>
      <p>The number of preserved jars was an integer strictly between <strong>${p.low.toLocaleString('en-US')}</strong> and <strong>${p.high.toLocaleString('en-US')}</strong>. Each clerk made bundles from the <em>entire</em> stock, leaving the following leftovers:</p>
      <div class="remainder-grid">${p.remainder.map(x=>`<div class="remainder-card"><small>GROUPS OF ${x.n}</small><strong>${x.r}</strong><span>left over</span></div>`).join('')}</div>
      <p>All four statements are exact. No jars were added or removed between counts.</p></div>
      <div class="doc-block dark"><div class="doc-label">WAREHOUSE ORDER / RECONCILIATION</div><p>Restore the <b>one</b> total consistent with the bound and all four remainder conditions. The counting notebooks contain no other usable figures.</p></div>
      ${answerBlock('Recover the missing inventory','Enter the exact whole-number count, with no commas.','00000',5,'Total jars')}${notebook(3)}`;
  }
  function clockHTML() {
    const p=puzzleData.clock;
    return header(5,'The Repeated Hour','NOVEMBER 01 · DAYLIGHT-SAVING CHANGE','TIME DISPUTED')+`
      <p class="narrative">When the clocks fell back in 2026, eight signals passed through a relay station. Each slip shows the <em>relay receipt</em> clock time, its UTC offset, and how many minutes the signal spent in transit. The station letters are out of order.</p>
      <div class="doc-block"><div class="doc-label">CONTROL ROOM NOTE / TWO ONE-O'CLOCK HOURS</div>
      <p>When daylight saving time ended on November 1, clocks were turned back one hour, so the hour from 1:00 to 1:59 a.m. happened twice. The first 1:30 a.m. used <b>UTC−4</b> (four hours behind UTC); the second used <b>UTC−5</b> (five hours behind UTC). Those two readings are one hour apart.</p>
      <p>For each slip, convert its <strong>receipt time to UTC</strong>, then subtract the relay delay to find when the message was originally transmitted. Sort slips by this <strong>transmission instant</strong>, earliest to latest.</p></div>
      <div class="doc-label">RELAY LOG / SHUFFLED SIGNAL SLIPS</div>
      <div class="scroll-table"><table class="archive-table"><thead><tr><th>Station</th><th>Receipt / clock</th><th>Offset</th><th>Relay delay</th></tr></thead><tbody>${p.slips.map(s=>`<tr><td class="mono big-letter">${s.station}</td><td class="mono">${s.time}</td><td>${s.offset}</td><td>${s.delay} min</td></tr>`).join('')}</tbody></table></div>
      <p class="doc-footnote">All receipts occurred on November 1.</p>
      ${answerBlock('Restore the message order','Enter the eight station letters in order of the actual transmission times.','ABCDEFGH',8,'Station order')}${notebook(4)}`;
  }
  function ballotHTML() {
    const p=puzzleData.ballot;
    return header(6,'The Election-Night Ledger','NOVEMBER 03 · ELECTION DAY','COUNT DISPUTED')+`
      <p class="narrative">A fictional archive committee used ranked-choice voting to select the custodian of its November collection. Six bundles of ballots survived, but the round-by-round totals did not.</p>
      <div class="doc-block"><div class="doc-label">ELECTION BOARD / COUNTING RULES</div>
      <p>Each ballot lists all four candidates from first choice to last. Count first choices among the candidates still in the race. If nobody has <b>more than half of all ${p.total} votes</b>, eliminate the candidate with the fewest votes. Transfer those ballots to their next remaining choice. Repeat until someone has an outright majority.</p>
      <p>There are no ties for the fewest votes in any elimination round.</p></div>
      <div class="scroll-table"><table class="archive-table"><thead><tr><th>Ballots</th><th>1st choice</th><th>2nd</th><th>3rd</th><th>4th</th></tr></thead><tbody>${p.batches.map(b=>`<tr><td class="mono"><b>${b.count}</b></td>${b.ranking.map(n=>`<td>${n}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <div class="doc-block dark"><div class="doc-label">CERTIFIED RESULT / REQUIRED FORMAT</div><p>Report both the eventual winner and the winner's vote total <em>in the round when they first exceed half the ballots</em>.</p><div class="formula">CANDIDATE-TOTAL &nbsp; (example: ELM-42)</div></div>
      ${answerBlock('Certify the election','Use the winning candidate’s full name, a hyphen, and their winning-round vote total.','NAME-00',12,'Election result')}${notebook(5)}`;
  }
  function routeHTML() {
    const p=puzzleData.route;
    return header(7,'The Remembrance Route','NOVEMBER 19 · AN ARCHIVAL ROUTE MAP','ROUTE LOST')+`
      <p class="narrative">A fictional remembrance procession follows a network of one-way streets. The parade has to start at the archive hall, finish at the memorial, and visit both the library and the public square. The original route sheet is missing.</p>
      <div class="doc-block"><div class="doc-label">CITY SURVEYOR / NETWORK RULES</div>
      <p>Start at <strong>A (Archive Hall)</strong>, finish at <strong>H (Memorial)</strong>, and visit <strong>C (Library)</strong> and <strong>F (Square)</strong> somewhere along the route. Only the listed directed streets exist; all streets go forward in the alphabet. Costs represent fictional permit units, not geographical distance.</p>
      <div class="route-stops">${'ABCDEFGH'.split('').map((x,i)=>`<span class="${'ACFH'.includes(x)?'critical':''}">${x}<small>${x==='A'?'START':x==='H'?'END':x==='C'?'LIBRARY':x==='F'?'SQUARE':'WAYPOINT'}</small></span>`).join('')}</div>
      <p>You must start at <strong>A</strong>, visit <strong>C</strong> and <strong>F</strong>, and finish at <strong>H</strong>. The other stops (<strong>B, D, E, and G</strong>) are optional. You may only travel along the listed one-way streets. Find the route with the <strong>lowest total cost</strong>.</p></div>
      <div class="doc-label">ONE-WAY STREETS / PERMIT COSTS</div>
      <div class="route-edges">${p.edges.map(e=>`<div class="route-edge"><span>${e.from} <b>→</b> ${e.to}</span><strong>${e.cost}</strong></div>`).join('')}</div>
      <div class="doc-block dark"><div class="doc-label">PERMIT AUTHORIZATION</div><p>Enter the complete sequence of visited stop letters, followed by a hyphen and the total cost.</p><div class="formula">EXAMPLE: ABCEFH-98</div></div>
      ${answerBlock('Reconstruct the optimal route','Include A and H and all intermediate stops actually used.','ABCEFGH-99',18,'Minimum cost route')}${notebook(6)}`;
  }
  function frostHTML() {
    const p=puzzleData.frost;
    const rows=p.original.map((row,r)=>`<div class="frost-row">${row.map((v,c)=>`<div class="frost-cell ${v?'on':''}" title="Row ${r+1}, column ${c+1}, ${v?'active':'inactive'}" aria-label="${v?'Filled':'Empty'}"></div>`).join('')}</div>`).join('');
    return header(8,'The First Frost Signal','NOVEMBER 29 · OBSERVATORY FIELD STATION','PATTERN UNKNOWN')+`
      <p class="narrative">An observatory's November field map recorded 49 temperature sensors, some triggered and others dark. A curious old machine advanced the display using only the eight surrounding sensors. The printout shows its initial state, not the final one.</p>
      <div class="doc-block"><div class="doc-label">FIELD INSTRUMENT / EVOLUTION RULES</div>
      <p>Each square is either <b>active (dark)</b> or <b>inactive (light)</b>. All 49 squares update <b>simultaneously</b> once per generation:</p>
      <ol class="clue-list"><li>An active square remains active if it has exactly <b>2 or 3</b> active neighbors; otherwise it goes inactive.</li><li>An inactive square becomes active if it has exactly <b>3</b> active neighbors; otherwise it stays inactive.</li><li>Neighbors are the eight adjacent squares, including diagonals. Outside the 7×7 grid, everything is permanently inactive.</li></ol>
      <p>Repeat these rules for <strong>three complete generations</strong> beyond the printed starting arrangement.</p></div>
      <div class="doc-label">WEATHER STATION / ORIGINAL SENSOR MAP (GENERATION 0)</div>
      <div class="frost-layout"><div class="frost-map" role="img" aria-label="Seven by seven grid of sensor states">${rows}</div><div class="sensor-notes"><b>INSTRUMENT 7 × 7</b><span>■ &nbsp; active</span><span>□ &nbsp; inactive</span><hr/><p>Read the final grid row by row, top to bottom. Count the number of active sensors in each row and write those seven counts consecutively.</p></div></div>
      ${answerBlock('Read the frost signature','Enter seven digits, one count (0–7) for each row after the third update.','0000000',7,'Seven row counts')}${notebook(7)}`;
  }
  function historyHTML() {
    const p=puzzleData.history;
    return header(9,'The Historian’s Index','NOVEMBER 09 · DATES IN THE ARCHIVES','REFERENCES MISSING')+`
      <p class="narrative">Four November events were removed from a historian's index. Only brief descriptions and their personal weighting factors remain. Reconstruct the day of November and the four-digit year of each event before calculating the index seal.</p>
      <div class="doc-label">INDEX CARDS / YEAR AND DAY MISSING</div>
      <div class="history-cards">${p.events.map((e,i)=>`<div class="history-card"><div class="doc-label">CARD ${String(i+1).padStart(2,'0')} / WEIGHT ${e.multiplier}</div><p>${htmlEscape(e.clue)}</p><div class="history-unknown">NOVEMBER &nbsp; __, &nbsp; ____</div></div>`).join('')}</div>
      <div class="doc-block dark"><div class="doc-label">CATALOG FORMULA / HISTORIAN'S SEAL</div>
      <p>Research the correct November day <b>d</b> and year <b>y</b> for each event. Next, sort the cards by <b>year, oldest to newest</b>. Keep the weight printed on each card. Number the chronologically sorted cards <b>j = 1, 2, 3, 4</b>, then compute:</p>
      <div class="formula">SEAL = [ Σ (j × y × d × card weight) ] mod 1,000,000</div>
      <p>Include leading zeros to make exactly six digits. There are no intentionally false cards; every event is historically documented.</p></div>
      ${answerBlock('Restore the historian’s index','Enter the six-digit result.','000000',6,'Historian index seal')}${notebook(8)}`;
  }
  function boardMarkup(lights, includeNumbers) {
    return `<div class="switchboard-grid">${lights.map((v,i)=>{
      const at=puzzleData.switchboard.positions.findIndex(([r,c])=>r*5+c===i);
      return `<div class="switch-light ${v?'lit':''}" aria-label="Row ${Math.floor(i/5)+1}, column ${i%5+1}: ${v?'lit':'unlit'}">${includeNumbers&&at!==-1?`<span class="switch-position">${at+1}</span>`:''}</div>`;
    }).join('')}</div>`;
  }
  function switchboardHTML(){
    const p=puzzleData.switchboard;
    const active=A.lightsFor(state.switches);
    return header(10,'The Lantern Switchboard','NOVEMBER 30 · THE LAST OPEN RECORD','CIRCUIT LOCKED')+`
      <p class="narrative">A lantern display was found behind the archive's final door. Ten numbered switches operate a 5×5 panel of lights. The only record of the correct configuration is a photograph of the desired lit pattern.</p>
      <div class="doc-block"><div class="doc-label">ENGINEER'S INSTRUCTIONS / BINARY SWITCHES</div>
      <p>Every switch begins OFF. Turning a switch ON toggles the light at the switch's own grid position and each of its up to four orthogonal neighbors (above, below, left, right). Toggles are simultaneous in the sense that each light's final state depends on the <b>odd or even number of active switches affecting it</b>. Diagonals do not count; nothing wraps around an edge.</p>
      <p>Find the <strong>unique ten-switch configuration</strong> matching the photographic target. Use the switches below to test a candidate. The numbers printed on the switch positions identify where each switch is wired.</p></div>
      <div class="board-pair"><div class="board-panel"><div class="doc-label">PHOTOGRAPHIC TARGET</div>${boardMarkup(p.target,false)}<small>Fixed / requested pattern</small></div><div class="board-panel"><div class="doc-label">LIVE CONTROL PANEL</div><div id="live-switchboard">${boardMarkup(active,true)}</div><small>Changes as switches are toggled</small></div></div>
      <div class="doc-label">CONTROL BANK / NUMBERED SWITCHES</div>
      <div class="switch-buttons">${state.switches.map((n,i)=>`<button type="button" class="switch-toggle ${n?'is-on':''}" data-toggle="${i}" aria-pressed="${!!n}"><b>${String(i+1).padStart(2,'0')}</b><span>${n?'ON':'OFF'}</span></button>`).join('')}</div>
      <div class="answer-area"><h3>Match the lantern display</h3><p>Set all ten switches so your live panel exactly matches the target, then submit your configuration.</p><form id="switch-form" class="answer-form"><button type="submit" class="primary-btn">Verify switchboard →</button><button type="button" class="secondary-btn" id="switch-clear">Reset switches</button></form><div class="answer-feedback" id="answer-feedback" aria-live="polite"></div></div>${notebook(9)}`;
  }
  function stripHTML(index){
    const s=puzzleData.strips[index];
    return `<div class="recovered-strip"><div><span class="doc-label">RECOVERED INDEX STRIP · RECORD ${String(index+1).padStart(2,'0')}</span><p>Filed with the other recovered slips. Its purpose is not yet clear.</p></div><div class="strip-fields"><div><small>NOV DAY</small><b>${String(s.day).padStart(2,'0')}</b></div><div><small>GLYPH</small><b>${s.glyph}</b></div><div><small>DIAL</small><b>${String(s.dial).padStart(2,'0')}</b></div><div><small>SEAL</small><b>${String(s.seal).padStart(2,'0')}</b></div></div></div>`;
  }
  function mysteryHTML(){
    const strips=puzzleData.strips;
    return `<div class="surprise-note"><span>UNLISTED RECORD</span><strong>You finished the ten listed puzzles. One more record has appeared.</strong></div>` +
      header(11,'The Eleventh Seal','NOVEMBER · INDEX RECONSTRUCTION','RECORD 11')+`
      <p class="narrative">Each of the ten previous records included an index strip with a day, glyph, dial, and two-digit seal. This additional record explains how to combine those strips. Every one is needed.</p>
      <div class="doc-block"><div class="doc-label">INDEX INSTRUCTIONS / REASSEMBLE THE STRIPS</div>
      <ol class="clue-list"><li>Collect all ten index strips. Order them by <strong>NOV DAY</strong> (November calendar date), smallest to largest. Record numbers are irrelevant.</li>
      <li>Decode each glyph by shifting it <strong>backward</strong> through the alphabet by its own DIAL value. Use <b>A=0</b> through <b>Z=25</b> and wrap around. The ten plaintext letters should form an intelligible archival phrase.</li>
      <li>For each plaintext letter, change its alphabet position to <b>A=1</b> through <b>Z=26</b>. Keep the two-digit SEAL from the same strip.</li>
      <li>Initialize the accumulator to <b>202611</b>. Process the ten ordered strips, one by one, using the rule below. Keep only the final eight decimal digits after <em>every</em> step.</li></ol>
      <div class="formula">H<sub>0</sub> = 202611</div><div class="formula">H<sub>j</sub> = (131 × H<sub>j−1</sub> + 26 × SEAL<sub>j</sub> + LETTER<sub>j</sub>) mod 100,000,000</div>
      <p>Submit the decoded ten-letter phrase, a hyphen, and the final eight-digit value, including leading zeros.</p></div>
      <div class="doc-label">TEN RECOVERED INDEX STRIPS / STILL IN RECORD ORDER</div>
      <div class="scroll-table"><table class="archive-table"><thead><tr><th>Record</th><th>Nov day</th><th>Glyph</th><th>Dial</th><th>Seal</th></tr></thead><tbody>${strips.map(s=>`<tr><td class="mono">${String(s.record).padStart(2,'0')}</td><td class="mono">${String(s.day).padStart(2,'0')}</td><td class="mono big-letter">${s.glyph}</td><td class="mono">${String(s.dial).padStart(2,'0')}</td><td class="mono">${String(s.seal).padStart(2,'0')}</td></tr>`).join('')}</tbody></table></div>
      ${answerBlock('Open the eleventh seal','Format: TENLETTERPHRASE-00000000 (no spaces).','PHRASEHERE-00000000',24,'Final decoded phrase and eight-digit seal','Open the eleventh seal →')}${notebook(10)}`;
  }
  function finalHTML(){
    const code=A.completionCode(id);
    return `<div class="record-heading"><div><div class="record-number">ARCHIVE CERTIFICATE / ELEVEN RECORDS RECOVERED</div><h2>The collection is complete.</h2><p class="record-subtitle">THE NOVEMBER ARCHIVES · FINAL RECORD OPENED</p></div><div class="record-stamp">VERIFIED</div></div>
      <div class="final-record"><div class="final-medallion" aria-hidden="true"><span>XI</span><small>COMPLETE</small></div><h2>You opened the eleventh seal.</h2>
      <p>You completed the ten listed puzzles and uncovered the additional eleventh record. Here is your completion code.</p>
      <div class="completion-code" id="code-display">${code}</div><div class="final-actions"><button id="copy-code-btn" class="primary-btn">Copy completion code ⧉</button><button id="review-btn" class="secondary-btn">Review recovered records</button></div>
      <p class="fine-print">Keep this code together with your participant ID. It is your completion certificate for the full eleven-puzzle challenge.</p></div>`;
  }
  function render(){
    nav();
    const complete=view===11;
    $('toolbar-path').textContent=complete?'COLLECTION / COMPLETION CERTIFICATE':`COLLECTION / RECORD ${String(view+1).padStart(2,'0')}`;
    $('toolbar-status').textContent=complete?'STATUS: COMPLETE':view<state.solved?'STATUS: RECOVERED ✓':'STATUS: UNRESOLVED';
    const contents=[telegramHTML,ledgerHTML,tableHTML,harvestHTML,clockHTML,ballotHTML,routeHTML,frostHTML,historyHTML,switchboardHTML,mysteryHTML];
    $('record-body').innerHTML=`<article class="paper-record">${complete?finalHTML():contents[view]()+ (view<10 && view<state.solved ? stripHTML(view):'')}</article>`;
    if(complete){
      $('copy-code-btn').addEventListener('click',()=>copyText(A.completionCode(id),'Completion code'));
      $('review-btn').addEventListener('click',()=>{view=0;render();});
      return;
    }
    const notes=$('notes-input');
    if(notes)notes.addEventListener('input',()=>{state.notes[view]=notes.value;saveState();});
    const form=$('answer-form');
    if(form){
      if(state.drafts[view]) $('answer-input').value=state.drafts[view];
      $('answer-input').addEventListener('input',()=>{state.drafts[view]=$('answer-input').value;saveState();});
      form.addEventListener('submit',onAnswer);
    }
    const seatingForm=$('seating-form');
    if(seatingForm){
      document.querySelectorAll('.seat-select').forEach(el=>el.addEventListener('change',()=>{
        const idx=Number(el.dataset.seat);state.seats[idx]=el.value;saveState();
        document.querySelectorAll('.seat-select').forEach((select,seatIdx)=>{select.innerHTML=seatOptions(state.seats[seatIdx],seatIdx);});
        $('answer-feedback').textContent='';
      }));
      $('clear-seats').addEventListener('click',()=>{state.seats=Array(7).fill('');saveState();render();});
      seatingForm.addEventListener('submit',onSeating);
    }
    const switchForm=$('switch-form');
    if(switchForm){
      document.querySelectorAll('[data-toggle]').forEach(el=>el.addEventListener('click',()=>{
        const n=Number(el.dataset.toggle);state.switches[n]^=1;saveState();
        document.querySelectorAll('[data-toggle]').forEach((button,i)=>{
          button.classList.toggle('is-on',!!state.switches[i]);button.setAttribute('aria-pressed',!!state.switches[i]);
          button.querySelector('span').textContent=state.switches[i]?'ON':'OFF';
        });
        $('live-switchboard').innerHTML=boardMarkup(A.lightsFor(state.switches),true);
        $('answer-feedback').textContent='';
      }));
      $('switch-clear').addEventListener('click',()=>{state.switches=Array(10).fill(0);saveState();render();});
      switchForm.addEventListener('submit',onSwitchboard);
    }
  }
  function advance(){
    if(view===state.solved){state.solved=Math.min(11,state.solved+1);saveState();view=state.solved;}
    else view=state.solved;
    render();window.scrollTo({top:0,behavior:'smooth'});
  }
  function success(form,message){
    const feedback=$('answer-feedback');feedback.textContent=message;feedback.classList.add('success');
    form.querySelector('button[type=submit]').disabled=true;
    setTimeout(advance,500);
  }
  function failure(message){const feedback=$('answer-feedback');feedback.textContent=message;feedback.classList.remove('success');}
  function onAnswer(e){
    e.preventDefault();const raw=$('answer-input').value.trim().replace(/\s+/g,'').toUpperCase();
    const key=A.keys[view];const expected=view===10?puzzleData.final.answer:puzzleData[key].answer;
    if(raw===expected.toUpperCase())success($('answer-form'),view===10?'The eleventh seal has opened.':'Correct. The next record is opening…');
    else failure('The seal remains closed. Check your answer and try again.');
  }
  function onSeating(e){
    e.preventDefault();const order=state.seats.join('');
    if(state.seats.some(x=>!x)||new Set(state.seats).size!==7)failure('All seven seats must contain different guests.');
    else if(order===puzzleData.table.answer)success($('seating-form'),'The place cards are restored.');
    else failure('This arrangement contradicts at least one observation.');
  }
  function onSwitchboard(e){
    e.preventDefault();const active=A.lightsFor(state.switches);
    if(active.every((n,i)=>n===puzzleData.switchboard.target[i]))success($('switch-form'),'The lanterns match the target.');
    else failure('The lit pattern does not match the target.');
  }
  function saveBackup(){
    if(!id||!state)return;
    const payload={format:'mr-purdys-puzzles-november-archives',version:2,id,exportedAt:new Date().toISOString(),progress:state};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob), link=document.createElement('a');
    link.href=url;link.download='November_Archives_'+id+'_progress.json';
    document.body.appendChild(link);link.click();link.remove();
    // The URL is revoked after the click is initiated, allowing the browser to finish downloading.
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    showToast('Progress file ready. Keep it with your participant ID.');
  }
  async function restoreBackup(file){
    if(!file)return;
    try{
      if(file.size>250000)throw Error('The file is too large to be a progress backup.');
      const saved=JSON.parse(await file.text());
      if(saved.format!=='mr-purdys-puzzles-november-archives'||saved.version!==2||!A.validId(saved.id))throw Error('This is not a recognized November Archives backup.');
      const p=saved.progress;
      if(!p||!Number.isInteger(p.solved)||p.solved<0||p.solved>11)throw Error('The backup contains invalid progress.');
      if(id!==saved.id)openParticipant(saved.id);
      if(p.solved<state.solved)throw Error('This backup is older than the progress already saved in this browser.');
      const cleaned={
        solved:p.solved,
        notes:Object.fromEntries(Object.entries(p.notes||{}).filter(([k,v])=>/^([0-9]|10)$/.test(k)&&typeof v==='string').map(([k,v])=>[k,v.slice(0,20000)])),
        drafts:Object.fromEntries(Object.entries(p.drafts||{}).filter(([k,v])=>/^([0-9]|10)$/.test(k)&&typeof v==='string').map(([k,v])=>[k,v.slice(0,1000)])),
        seats:Array.isArray(p.seats)&&p.seats.length===7?p.seats.map(x=>typeof x==='string'&&/^[ABCDEFG]?$/.test(x)?x:''):Array(7).fill(''),
        switches:Array.isArray(p.switches)&&p.switches.length===10?p.switches.map(x=>x?1:0):Array(10).fill(0)
      };
      state=cleaned;saveState();view=state.solved;render();window.scrollTo({top:0,behavior:'smooth'});
      showToast('Progress restored for '+id+'.');
    }catch(error){showToast(error.message||'Unable to restore that file.');}
  }
  $('backup-save-btn').addEventListener('click',saveBackup);
  $('backup-load-btn').addEventListener('click',()=>$('backup-file').click());
  $('backup-file').addEventListener('change',e=>{const f=e.target.files[0];restoreBackup(f);e.target.value='';});
  $('new-id-btn').addEventListener('click',()=>openParticipant(A.newId()));
  $('join-id').addEventListener('input',()=>{ $('join-id').value=A.normalizeId($('join-id').value).slice(0,8);$('join-feedback').textContent='';});
  $('join-form').addEventListener('submit',e=>{e.preventDefault();if(!openParticipant($('join-id').value))$('join-feedback').textContent='Enter a valid eight-character participant ID (letters except I and O; digits 2–9).';});
  $('copy-id-btn').addEventListener('click',()=>copyText(id,'Participant ID'));
  $('switch-id-btn').addEventListener('click',showWelcome);
  const previous=getStorage('november-archives-last-id');
  if(previous&&A.validId(previous))openParticipant(previous);
})();
