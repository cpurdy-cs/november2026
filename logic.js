/* The November Archives — deterministic puzzle generator, no external dependencies.
   Participants with the same ID receive the same challenge; verification is not tamper proof. */
(function (global) {
  'use strict';
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const NAMES = ['Ada', 'Basil', 'Cora', 'Drew', 'Emery', 'Fern', 'Gus'];
  const WEIGHTS = [3, 1, 4, 1, 5, 9, 2];
  const DAYS = [11, 23, 26, 6, 1, 3, 19, 29, 9, 30];
  const KEYS = ['telegram', 'ledger', 'table', 'harvest', 'clock', 'ballot', 'route', 'frost', 'history', 'switchboard'];
  const SWITCH_POSITIONS = [[0,0],[0,2],[0,4],[1,1],[1,3],[2,0],[2,2],[2,4],[3,1],[4,3]];
  const HISTORICAL_EVENTS = [
    { key: 'Gettysburg', clue: 'Abraham Lincoln delivers the Gettysburg Address in Pennsylvania.', day: 19, year: 1863 },
    { key: 'Armistice', clue: 'The armistice ending the fighting on the Western Front of World War I takes effect.', day: 11, year: 1918 },
    { key: 'Parade', clue: "The first Macy’s Thanksgiving Day Parade is held in New York City.", day: 27, year: 1924 },
    { key: 'Apollo', clue: 'NASA launches the Apollo 12 mission toward the Moon.', day: 14, year: 1969 },
    { key: 'Berlin', clue: 'East German authorities open the Berlin Wall crossings amid the events of the Peaceful Revolution.', day: 9, year: 1989 }
  ];
  function hash32(input) {
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; h = Math.imul(h, 0x846ca68b);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function rngFrom(id, suffix) {
    let state = hash32(id + '/' + suffix);
    return function () {
      state += 0x6D2B79F5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function integer(rnd, low, high) { return low + Math.floor(rnd() * (high - low + 1)); }
  function shuffle(values, rnd) {
    const copy = values.slice();
    for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
    return copy;
  }
  function normalizeId(raw) { return String(raw || '').toUpperCase().replace(/[^A-Z2-9]/g, ''); }
  function validId(raw) { return /^[A-HJ-NP-Z2-9]{8}$/.test(String(raw || '').toUpperCase()); }
  function newId() {
    const values = new Uint32Array(8);
    if (global.crypto && global.crypto.getRandomValues) global.crypto.getRandomValues(values);
    else for (let i = 0; i < values.length; i++) values[i] = Math.floor(Math.random() * 4294967296);
    return Array.from(values, n => ALPHABET[n % ALPHABET.length]).join('');
  }
  function telegram(id) {
    const rnd = rngFrom(id, 'telegram');
    const digits = Array.from({ length: 7 }, () => Math.floor(rnd() * 10));
    digits.push(digits.reduce((sum, d, i) => sum + d * WEIGHTS[i], 0) % 10);
    const key = [1, 9, 1, 8];
    const encrypt = (i, d) => String.fromCharCode(65 + ((d + i * i + 11 * i + key[(i - 1) % 4]) % 26));
    const strips = digits.map((d, ix) => ({ station: ix + 1, symbol: encrypt(ix + 1, d) }));
    strips.push({ station: 5, symbol: encrypt(5, (digits[4] + 1) % 10) });
    return { strips: shuffle(strips, rnd), answer: digits.join('') };
  }
  function ledger(id) {
    const rnd = rngFrom(id, 'ledger');
    const a0 = integer(rnd, 100, 8999), a1 = integer(rnd, 100, 8999);
    let prev = a0, cur = a1;
    const saved = {};
    for (let n = 2; n <= 2026; n++) {
      const next = (prev + cur) % 1000000;
      prev = cur; cur = next;
      if (n === 1123 || n === 1918 || n === 2026) saved[n] = cur;
    }
    const value = (saved[1123] + 11 * saved[1918] + 23 * saved[2026]) % 1000000;
    return { a0, a1, answer: String(value).padStart(6, '0') };
  }
  function tablePuzzle(id) {
    const rnd = rngFrom(id, 'table');
    const roles = shuffle(NAMES, rnd);
    const [A, B, C, D, E, F, G] = roles;
    const clues = [
      `${E} is somewhere between ${A} and ${F}.`,
      `${C} is somewhere between ${A} and ${D}.`,
      `${A} and ${B} are sitting next to each other.`,
      `Exactly one guest sits between ${C} and ${E}.`,
      `${G} sits at one end of the table.`,
      `${C} and ${F} are not sitting next to each other.`,
      `${D} sits somewhere to the left of ${F}.`,
      `${E} sits in one of the three center seats (3, 4, or 5).`,
      `${A} sits in an odd-numbered seat.`
    ];
    return { guests: shuffle(NAMES, rnd), clues: shuffle(clues, rnd), answer: roles.map(name => name[0].toUpperCase()).join('') };
  }
  function harvest(id) {
    const rnd = rngFrom(id, 'harvest');
    const total = integer(rnd, 30000, 75000);
    const low = total - integer(rnd, 3500, 6500);
    const high = total + integer(rnd, 3500, 6500);
    const divisors = [7, 11, 13, 17]; // Product 17017 > length of displayed interval.
    return { low, high, remainder: divisors.map(n => ({ n, r: total % n })), answer: String(total) };
  }
  function clock(id) {
    const rnd = rngFrom(id, 'clock');
    const letters = shuffle('ABCDEFGHJKLMNPQRSTUVWXYZ'.split(''), rnd).slice(0, 8);
    const early = shuffle(Array.from({ length: 51 }, (_, i) => i + 4), rnd).slice(0, 4).sort((a,b)=>a-b);
    const late = shuffle(Array.from({ length: 51 }, (_, i) => i + 4), rnd).slice(0, 4).sort((a,b)=>a-b);
    const ticks = [...early.map(m => ({ minute: m, offset: -4 })), ...late.map(m => ({ minute: m, offset: -5 }))];
    const occupied = new Set();
    const slips = ticks.map((t, i) => {
      const utcMinute = 60 - t.offset * 60 + t.minute;
      // Prevent accidentally equal transmission instants even when receipt minutes differ.
      const delays = shuffle(Array.from({length:14}, (_,j) => j + 3), rnd);
      const delay = delays.find(n => !occupied.has(utcMinute - n));
      if (delay === undefined) throw Error('Unable to assign distinct relay delays');
      occupied.add(utcMinute - delay);
      return {
        station: letters[i], time: '01:' + String(t.minute).padStart(2, '0'),
        offset: 'UTC' + (t.offset < 0 ? '−' : '+') + Math.abs(t.offset),
        delay, utcMinute
      };
    });
    const byTransmission = slips.slice().sort((a,b)=> (a.utcMinute - a.delay) - (b.utcMinute - b.delay));
    return { slips: shuffle(slips.map(({station,time,offset,delay})=>({station,time,offset,delay})),rnd), answer: byTransmission.map(s=>s.station).join('') };
  }
  function ballot(id) {
    const rnd = rngFrom(id, 'ballot');
    const names = shuffle(['Ash', 'Birch', 'Cedar', 'Elm'], rnd);
    const rankings = [
      [0,1,2,3], [1,2,3,0], [2,3,1,0], [3,2,0,1], [1,3,0,2], [3,1,2,0]
    ];
    const bases = [17,14,13,11,8,4];
    const batches = rankings.map((r,i)=> ({ count: bases[i]+integer(rnd,0,1), ranking: r.map(n=>names[n]) }));
    const total = batches.reduce((s,b)=>s+b.count,0);
    let active = new Set(names), lastWinner = null, winningCount = 0, rounds=[];
    while (active.size > 1) {
      const counts = Object.fromEntries(Array.from(active, name => [name,0]));
      for (const b of batches) counts[b.ranking.find(name=>active.has(name))] += b.count;
      rounds.push(counts);
      const majority = Object.entries(counts).find(([,c])=>c>total/2);
      if (majority) { lastWinner=majority[0]; winningCount=majority[1]; break; }
      const sorted = Object.entries(counts).sort((a,b)=>a[1]-b[1]);
      if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) throw Error('Unexpected ballot tie');
      active.delete(sorted[0][0]);
    }
    if (!lastWinner) {
      lastWinner = [...active][0];
      const tally = rounds.at(-1); winningCount = tally[lastWinner];
    }
    return { names: names.slice().sort(), batches: shuffle(batches,rnd), total, answer: lastWinner.toUpperCase() + '-' + winningCount, winner: lastWinner, winningCount };
  }
  function route(id) {
    const rnd = rngFrom(id, 'route');
    const places = 'ABCDEFGH'.split('');
    for (let attempt = 0; attempt < 500; attempt++) {
      const edges = [];
      // Longer street segments usually cost more, making detours competitive.
      const ranges = { 1:[7,19], 2:[15,35], 3:[24,50] };
      for (let i=0;i<7;i++) for (let leap=1;leap<=3;leap++) if (i+leap<8) {
        const [low, high] = ranges[leap];
        edges.push({from:places[i],to:places[i+leap],cost:integer(rnd,low,high)});
      }
      const paths=[];
      function walk(at,seq,cost){
        if(at===7){ if(seq.includes('C') && seq.includes('F')) paths.push({seq,cost});return; }
        edges.filter(e=>e.from===places[at]).forEach(e=>walk(places.indexOf(e.to),seq+e.to,cost+e.cost));
      }
      walk(0,'A',0);
      paths.sort((a,b)=>a.cost-b.cost||a.seq.localeCompare(b.seq));
      // Make sure solving actually requires exploring beyond just A -> C -> F -> H.
      // At least two other stops appear in the uniquely cheapest valid route.
      if (paths.length && paths[0].seq.length >= 6 && (!paths[1] || paths[0].cost !== paths[1].cost)) {
        return { edges: shuffle(edges,rnd), answer: paths[0].seq+'-'+paths[0].cost, optimal:paths[0] };
      }
    }
    throw Error('Unable to generate unique route');
  }
  function nextFrost(grid) {
    const n=grid.length;
    return grid.map((row,r)=>row.map((cell,c)=>{
      let count=0;
      for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)if(dr||dc) {
        if(r+dr>=0 && r+dr<n && c+dc>=0 && c+dc<n) count+=grid[r+dr][c+dc];
      }
      return cell ? +(count===2||count===3) : +(count===3);
    }));
  }
  function frost(id) {
    const rnd = rngFrom(id, 'frost');
    for(let attempt=0;attempt<1000;attempt++){
      const original=Array.from({length:7},()=>Array.from({length:7},()=>+(rnd()<0.35)));
      let g=original;for(let i=0;i<3;i++)g=nextFrost(g);
      const totals=g.map(row=>row.reduce((s,n)=>s+n,0));
      const living=totals.reduce((s,n)=>s+n,0);
      if(living>=8 && living<=29 && totals.filter(x=>x>0).length>=4) return {original,totals,answer:totals.join('')};
    }
    throw Error('Unable to generate weather pattern');
  }
  function history(id) {
    const rnd = rngFrom(id, 'history');
    const events = shuffle(HISTORICAL_EVENTS,rnd).slice(0,4).map(e=>({...e, multiplier: integer(rnd,17,89)}));
    const sorted=events.slice().sort((a,b)=>a.year-b.year);
    const answer=String(sorted.reduce((sum,e,j)=>sum+(j+1)*e.year*e.day*e.multiplier,0)%1000000).padStart(6,'0');
    return {events:shuffle(events,rnd), answer};
  }
  function switchboard(id) {
    const rnd=rngFrom(id,'switchboard');
    let switches, onCount;
    // Reject extreme states so the intended solution cannot be simply all switches ON
    // (or a nearly empty switchboard). Keep the layout and parity rules unchanged.
    do {
      switches=SWITCH_POSITIONS.map(()=>+(rnd()<0.5));
      onCount=switches.reduce((sum,n)=>sum+n,0);
    } while(onCount<3 || onCount>7);
    const target=lightsFor(switches);
    return {positions:SWITCH_POSITIONS.map(p=>p.slice()), target, answer:switches.join('')};
  }
  function lightsFor(switches){
    const lights=Array(25).fill(0);
    SWITCH_POSITIONS.forEach(([r,c],i)=>{
      if(!switches[i])return;
      for (const [dr,dc] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]) {
        const rr=r+dr,cc=c+dc;
        if(rr>=0&&rr<5&&cc>=0&&cc<5) lights[rr*5+cc]^=1;
      }
    });
    return lights;
  }
  function getData(id) {
    if(!validId(id))throw Error('Invalid participant ID.');
    const data={telegram:telegram(id),ledger:ledger(id),table:tablePuzzle(id),harvest:harvest(id),clock:clock(id),ballot:ballot(id),route:route(id),frost:frost(id),history:history(id),switchboard:switchboard(id)};
    // Cipher strips are created from each solved record's particular answer.
    const phrase='ARCHIVEKEY';
    const order=DAYS.map((d,i)=>({d,i})).sort((a,b)=>a.d-b.d);
    data.strips=KEYS.map((key,i)=>{
      const answer=data[key].answer;
      const seal=hash32('SEAL-V2|'+id+'|'+key+'|'+answer)%100;
      const dial=hash32('DIAL-V2|'+id+'|'+key+'|'+answer)%26;
      const position=order.findIndex(p=>p.i===i);
      const glyph=String.fromCharCode(65+(phrase.charCodeAt(position)-65+dial)%26);
      return {day:DAYS[i],record:i+1,glyph,dial,seal};
    });
    let rolling=202611;
    for(const s of data.strips.slice().sort((a,b)=>a.day-b.day)){
      const plaintext=(s.glyph.charCodeAt(0)-65-s.dial+26)%26+1;
      rolling=(rolling*131+26*s.seal+plaintext)%100000000;
    }
    data.final={answer:phrase+'-'+String(rolling).padStart(8,'0'),phrase,rolling:String(rolling).padStart(8,'0')};
    return data;
  }
  function completionCode(id){
    const data=getData(id);
    const input='NOVEMBER-ARCHIVES-V2-FULL-XI|'+id+'|'+KEYS.map(key=>data[key].answer).join('|')+'|'+data.final.answer;
    const x=hash32(input+'|FIRST').toString(16).toUpperCase().padStart(8,'0');
    const y=hash32(input+'|SECOND').toString(16).toUpperCase().padStart(8,'0');
    return 'N26-XI-'+id+'-'+x.slice(0,4)+'-'+x.slice(4)+'-'+y.slice(0,4);
  }
  function verifyCode(id,rawCode){
    if(!validId(id))return false;
    return String(rawCode||'').trim().toUpperCase().replace(/\s+/g,'')===completionCode(id);
  }
  global.Archives=Object.freeze({normalizeId,validId,newId,getData,completionCode,verifyCode,lightsFor,nextFrost,days:DAYS.slice(),keys:KEYS.slice()});
})(typeof window !== 'undefined' ? window : globalThis);
