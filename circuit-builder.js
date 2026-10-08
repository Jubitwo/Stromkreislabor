/* Offline circuit editor for the learning laboratory. */
"use strict";
window.CircuitBuilder = (() => {
  const types = {
    battery: {name:"Batterie",ports:[[-55,0],[55,0]]},
    lamp: {name:"Lampe",resistance:30,ports:[[-55,0],[55,0]]},
    resistor: {name:"Widerstand",resistance:100,ports:[[-55,0],[55,0]]},
    motor: {name:"Motor",resistance:60,ports:[[-55,0],[55,0]]},
    switch: {name:"Schalter",ports:[[-55,0],[55,0]]},
    changeover: {name:"Wechselschalter",ports:[[-55,0],[55,-20],[55,20]]}
  };
  const initial = () => ({parts:[],wires:[],nextId:1,electrons:true,speed:1,voltage:6});
  let model, persist, host, pending=null, drag=null, notice="", result;
  function symbol(type,closed=false,lit=false) {
    const left='<path d="M-55 0H-25" />',right='<path d="M25 0H55" />';
    if(type==="battery")return '<path d="M-55 0H-10M10 0H55M-10-24V24M10-13V13"/><text x="-29" y="-29">+</text><text x="20" y="-29">−</text>';
    if(type==="switch")return '<path d="M-55 0H-22M22 0H55"/><circle cx="-22" cy="0" r="3"/><circle cx="22" cy="0" r="3"/><path class="switch-blade" d="'+(closed?'M-22 0H22':'M-22 0L16-24')+'"/>';
    if(type==="changeover")return '<path d="M-55 0H-22M22-20H55M22 20H55"/><circle cx="-22" cy="0" r="3"/><circle cx="22" cy="-20" r="3"/><circle cx="22" cy="20" r="3"/><path class="switch-blade" d="M-22 0L22 '+(closed?20:-20)+'"/>';
    if(type==="resistor")return left+right+'<rect x="-25" y="-13" width="50" height="26"/>';
    return left+right+`<circle cx="0" cy="0" r="25" class="${lit?"lit":""}"/>`+(type==="lamp"?'<path d="M-16-16L16 16M16-16L-16 16"/>':'<text x="0" y="7" text-anchor="middle" class="motor-letter">M</text>');
  }
  function template() {
    return `<style>
      .cb-layout{display:grid;grid-template-columns:220px minmax(0,1fr);gap:18px}.cb-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.cb-tool{border:1px solid var(--line);border-radius:8px;padding:8px 10px;background:white;color:var(--ink);font:inherit;cursor:pointer}.cb-tool svg{width:100%;height:50px}.cb-symbol{fill:white;stroke:#294958;stroke-width:3;stroke-linejoin:round;stroke-linecap:round}.cb-symbol text{fill:#294958;stroke:none;font:700 18px system-ui}.cb-symbol .lit{fill:#ffe297;stroke:#b67c09}.cb-symbol .motor-letter{font-size:22px}.cb-board{width:100%;display:block;background:#f7fbfc;border:1px solid var(--line);border-radius:12px;touch-action:none;user-select:none}.cb-part{cursor:grab}.cb-part .part-bg{fill:#fff;stroke:#d3e2e7;stroke-width:1}.cb-label{font:600 12px system-ui;fill:#294958;stroke:none}.cb-port{fill:white;stroke:#087f83;stroke-width:3;cursor:crosshair}.cb-port.pending{fill:#edb64a}.cb-port-hit{fill:transparent;stroke:none;cursor:crosshair}.cb-wire{fill:none;stroke:#54717e;stroke-width:4}.cb-wire.live{stroke:#087f83}.cb-wire-hit{fill:none;stroke:transparent;stroke-width:18;cursor:pointer}.cb-electron{fill:#1269c0;stroke:white;stroke-width:1;pointer-events:none}.cb-wire-list{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}.cb-status{min-height:52px}.cb-palette{display:grid;gap:8px}.cb-guide{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.cb-guide article{text-align:center;border:1px solid var(--line);padding:8px;border-radius:10px}.cb-guide svg{width:100%;height:65px}.cb-remove{cursor:pointer;font:700 17px system-ui;fill:#a53737;stroke:none}.cb-options label{display:block;margin:12px 0}.cb-options input[type=range]{width:100%;accent-color:#087f83}.cb-part:focus-visible,.cb-port-hit:focus-visible{outline:none;stroke:#c37900;stroke-width:4}
      @media(max-width:760px){.cb-layout{grid-template-columns:minmax(0,1fr)}.cb-palette{grid-template-columns:repeat(3,minmax(0,1fr))}.cb-guide{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(prefers-reduced-motion:reduce){.cb-electron{display:none}}
    </style>
    <div class="eyebrow">Labor · Selbst verdrahten</div><h1 style="font-size:clamp(2rem,5vw,3.2rem)">Baue deinen Stromkreis</h1>
    <p class="lead">Platziere Bauteile und ziehe eine Leitung von Anschluss zu Anschluss. Alternativ klickst du beide Anschlüsse nacheinander an – auch mit Tab und Enter.</p>
    <p><a href="./arbeitsblatt-stromkreise.html">Begleitendes Arbeitsblatt für 60 Minuten öffnen und drucken</a></p>
    <div class="cb-layout"><aside class="card"><h3>Bauteile hinzufügen</h3><div class="cb-palette">${Object.entries(types).map(([key,t])=>`<button class="cb-tool" data-cb-add="${key}"><svg viewBox="-65 -40 130 80" aria-hidden="true"><g class="cb-symbol">${symbol(key)}</g></svg>${t.name}</button>`).join("")}</div>
    <div class="cb-options"><h3 style="margin-top:20px">Elektronenfluss</h3><label><input type="checkbox" id="cb-electrons"> Elektronen anzeigen</label><label for="cb-speed">Animationsgeschwindigkeit <output id="cb-speed-value"></output><input id="cb-speed" type="range" min=".25" max="3" step=".25"></label><label for="cb-voltage">Batteriespannung <output id="cb-voltage-value"></output><input id="cb-voltage" type="range" min="1.5" max="12" step=".5"></label></div></aside>
    <section class="card" style="min-width:0"><h3>Deine Arbeitsfläche</h3><p class="small muted">Bauteile am Gehäuse verschieben. Schalter per Doppelklick oder über den Schalterknopf bedienen. Leitung anklicken oder „Entfernen“ wählen. × entfernt ein Bauteil samt angeschlossenen Leitungen. Verzweigungen entstehen durch mehrere Leitungen am selben Anschluss; reine Leitungskreuzungen sind nicht verbunden.</p>
    <div class="cb-toolbar"><button class="cb-tool" data-cb-example="series">Beispiel: Reihe</button><button class="cb-tool" data-cb-example="parallel">Beispiel: Parallel</button><button class="cb-tool" data-cb-cancel>Leitung abbrechen</button><button class="cb-tool" data-cb-reset>Alles zurücksetzen</button></div>
    <svg id="cb-board" class="cb-board" viewBox="0 0 900 520" aria-label="Arbeitsfläche zum Verdrahten von elektrischen Bauteilen"><defs><pattern id="cb-grid" width="25" height="25" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#b5cbd3"/></pattern></defs><rect width="900" height="520" fill="url(#cb-grid)"/><g id="cb-wires"></g><path id="cb-preview" d="" fill="none" stroke="#c37900" stroke-width="3" stroke-dasharray="7 5"/><g id="cb-parts"></g></svg>
    <div class="cb-status" role="status" aria-live="polite" id="cb-status"></div><div id="cb-switches" class="cb-toolbar"></div><div id="cb-wire-list" class="cb-wire-list" aria-label="Leitungen entfernen"></div>
    <div class="callout small"><strong>Elektronen</strong> bewegen sich in den äußeren Metallleitungen vom Minuspol zum Pluspol. Die technische Stromrichtung ist umgekehrt. Die blauen Punkte veranschaulichen die Richtung; ihre Geschwindigkeit ist kein Maß für den echten Elektronenstrom. Sie erscheinen nur auf stromführenden Wegen. Bei reduzierter Bewegung im Betriebssystem bleiben die Punkte ausgeblendet.</div></section></div>
    <section class="card" style="margin-top:20px"><h2>Schaltzeichen auf einen Blick</h2><div class="cb-guide">${Object.entries(types).map(([key,t])=>`<article><svg viewBox="-70 -45 140 90" role="img" aria-label="${t.name}"><g class="cb-symbol">${symbol(key)}</g></svg><strong>${t.name}</strong><p class="small muted">${key==="battery"?"Langer Strich: Pluspol; kurzer Strich: Minuspol":key==="resistor"?"Rechteck nach europäischer Schaltzeichendarstellung":key==="switch"?"Offener Kontakt mit sichtbarer Lücke":key==="changeover"?"Ein gemeinsamer Anschluss, zwei wählbare Kontakte":key==="lamp"?"Kreis mit Kreuz: Glühlampe":"Kreis mit M: Motor"}</p></article>`).join("")}<article><svg viewBox="-70 -45 140 90" role="img" aria-label="Leitung und verbundene Verzweigung"><g class="cb-symbol"><path d="M-55 0H55M0 0V-30"/><circle cx="0" cy="0" r="4" style="fill:#294958"/></g></svg><strong>Leitung / Verbindung</strong><p class="small muted">Linie: Leitung. Punkt: verbundene Verzweigung. Im Labor bildet ein gemeinsamer Anschluss diesen Knoten.</p></article></div>
    <div class="callout warning small"><strong>Modell und Sicherheit:</strong> Eine Batterie; Lampe 30 Ω, Widerstand 100 Ω, Motor vereinfacht als 60 Ω. Leitungen und geschlossene Kontakte besitzen jeweils 0,01 Ω als kleine Modellwiderstände. Helligkeit wird über die elektrische Leistung angenähert; ein echter Motor und Glühlampen verhalten sich komplexer. Kurzschlüsse werden erkannt und die Animation aus Sicherheitsgründen gestoppt. Nur virtuelle Niederspannung – niemals mit Steckdosen experimentieren.</div></section>`;
  }
  const terminal = (part,index) => part.id+":"+index;
  function coordinate(key) {
    const [id,index]=key.split(":");const part=model.parts.find(p=>p.id===Number(id));
    const offset=types[part.type].ports[Number(index)];return {x:part.x+offset[0],y:part.y+offset[1]};
  }
  function topology() {
    const nodes=model.parts.flatMap(p=>types[p.type].ports.map((_,i)=>terminal(p,i)));
    const edges=model.wires.map(w=>({id:"w"+w.id,a:w.a,b:w.b,r:.01}));
    for(const p of model.parts) {
      if(types[p.type].resistance)edges.push({id:"p"+p.id,a:terminal(p,0),b:terminal(p,1),r:types[p.type].resistance});
      if(p.type==="switch"&&p.closed)edges.push({id:"p"+p.id,a:terminal(p,0),b:terminal(p,1),r:.01});
      if(p.type==="changeover")edges.push({id:"p"+p.id,a:terminal(p,0),b:terminal(p,p.closed?2:1),r:.01});
    }
    return {nodes,edges};
  }
  function reachable(start,edges) {
    const seen=new Set([start]),queue=[start];
    for(let i=0;i<queue.length;i++)for(const e of edges) {
      const next=e.a===queue[i]?e.b:e.b===queue[i]?e.a:null;
      if(next&&!seen.has(next)){seen.add(next);queue.push(next);}
    }
    return seen;
  }
  function solve() {
    const {nodes,edges}=topology(),battery=model.parts.find(p=>p.type==="battery"),currents=new Map();
    if(!battery)return {currents,total:0,message:"Füge eine Batterie hinzu und verbinde ihre beiden Pole über einen Verbraucher."};
    const plus=terminal(battery,0),minus=terminal(battery,1);
    if(reachable(plus,edges.filter(e=>e.r===.01)).has(minus))return {currents,total:0,short:true,message:"Kurzschluss: Die Pole sind ohne Verbraucher verbunden. Entferne die überbrückende Leitung. Elektronenanzeige gestoppt."};
    const connected=new Set([...reachable(plus,edges),...reachable(minus,edges)]);
    const unknown=nodes.filter(n=>connected.has(n)&&n!==plus&&n!==minus);
    const indices=new Map(unknown.map((n,i)=>[n,i]));
    const matrix=unknown.map(()=>Array(unknown.length+1).fill(0));
    for(const edge of edges)for(const [a,b] of [[edge.a,edge.b],[edge.b,edge.a]]) {
      const i=indices.get(a);if(i===undefined)continue;
      const g=1/edge.r;matrix[i][i]+=g;
      if(indices.has(b))matrix[i][indices.get(b)]-=g;
      else if(b===plus)matrix[i][unknown.length]+=g*model.voltage;
    }
    for(let col=0;col<unknown.length;col++) {
      let pivot=col;
      for(let row=col+1;row<unknown.length;row++)if(Math.abs(matrix[row][col])>Math.abs(matrix[pivot][col]))pivot=row;
      if(Math.abs(matrix[pivot][col])<1e-10)return {currents,total:0,message:"Der Aufbau konnte nicht zuverlässig berechnet werden. Prüfe die Verbindungen oder setze den Aufbau zurück."};
      [matrix[col],matrix[pivot]]=[matrix[pivot],matrix[col]];
      const divisor=matrix[col][col];for(let j=col;j<=unknown.length;j++)matrix[col][j]/=divisor;
      for(let row=0;row<unknown.length;row++)if(row!==col){const factor=matrix[row][col];for(let j=col;j<=unknown.length;j++)matrix[row][j]-=factor*matrix[col][j];}
    }
    const voltage=new Map([[plus,model.voltage],[minus,0],...unknown.map((n,i)=>[n,matrix[i][unknown.length]])]);
    let total=0;
    for(const edge of edges) {
      const current=voltage.has(edge.a)&&voltage.has(edge.b)?(voltage.get(edge.a)-voltage.get(edge.b))/edge.r:0;
      currents.set(edge.id,Math.abs(current)<1e-7?0:current);
      if(edge.a===plus)total+=current;if(edge.b===plus)total-=current;
    }
    total=Math.max(0,total);
    return {currents,total,message:total>1e-7?`Geschlossener Stromweg · Gesamtstrom ${total.toLocaleString("de-DE",{maximumFractionDigits:3})} A. Blauer Elektronenfluss: Minus → Plus in den äußeren Leitungen.`:"Kein Stromfluss: Es gibt noch keinen geschlossenen Weg über einen Verbraucher. Prüfe Leitungen und Schalter."};
  }
  function path(a,b) {const mid=(a.x+b.x)/2;return `M${a.x} ${a.y}H${mid}V${b.y}H${b.x}`;}
  function wirePath(wire) {
    const a=coordinate(wire.a),b=coordinate(wire.b);
    const direction=key=>key.split(":")[1]==="0"?-1:1;
    const aDirection=direction(wire.a),bDirection=direction(wire.b);
    if(a.y===b.y&&aDirection!==bDirection&&(b.x-a.x)*aDirection>0)return `M${a.x} ${a.y}H${b.x}`;
    const ax=a.x+24*aDirection,bx=b.x+24*bDirection;
    const bendY=a.y===b.y?Math.max(12,a.y-70):(a.y+b.y)/2;
    return `M${a.x} ${a.y}H${ax}V${bendY}H${bx}V${b.y}H${b.x}`;
  }
  function particles(id,current) {
    if(!model.electrons||!current)return "";
    const direction=current>0?"1;0":"0;1",duration=4/model.speed;
    return [0,1,2].map(i=>`<circle class="cb-electron" r="4"><animateMotion dur="${duration}s" begin="${-duration*i/3}s" repeatCount="indefinite" keyPoints="${direction}" keyTimes="0;1" calcMode="linear"><mpath href="#${id}"/></animateMotion></circle>`).join("");
  }
  function draw() {
    result=solve();
    host.querySelector("#cb-wires").innerHTML=model.wires.map(w=>{
      const current=result.currents.get("w"+w.id)||0,id="cb-wire-"+w.id,d=wirePath(w);
      return `<path id="${id}" class="cb-wire ${current?"live":""}" d="${d}"/><path class="cb-wire-hit" data-cb-wire="${w.id}" d="${d}"><title>Leitung ${w.id} entfernen</title></path>${particles(id,current)}`;
    }).join("");
    host.querySelector("#cb-parts").innerHTML=model.parts.map(p=>{
      const current=result.currents.get("p"+p.id)||0,lit=Math.abs(current)>1e-7;
      const name=types[p.type].name+" "+p.id;
      const ports=types[p.type].ports.map(([x,y],i)=>`<circle class="cb-port ${pending===terminal(p,i)?"pending":""}" cx="${x}" cy="${y}" r="6"/><circle class="cb-port-hit" cx="${x}" cy="${y}" r="13" data-cb-port="${terminal(p,i)}" tabindex="0" role="button" aria-label="${name}, Anschluss ${p.type==="battery"?(i===0?"Plus":"Minus"):p.type==="changeover"?(i===0?"gemeinsam":i===1?"oben":"unten"):i+1}"/>`).join("");
      const power=current*current*(types[p.type].resistance||0);
      const brightness=Math.min(1,power/1.2);
      const body=symbol(p.type,p.closed,lit).replace('class="lit"',`class="lit" style="fill:rgb(255,${Math.round(255-55*brightness)},${Math.round(255-175*brightness)})"`);
      return `<g class="cb-part" data-cb-part="${p.id}" transform="translate(${p.x} ${p.y})" tabindex="0" role="group" aria-label="${name}; mit Pfeiltasten verschieben"><rect class="part-bg" x="-72" y="-43" width="144" height="102" rx="12"/><g class="cb-symbol">${body}</g>${ports}<text x="-62" y="49" class="cb-label">${name}${p.type==="switch"?(p.closed?" · zu":" · offen"):""}</text><text x="55" y="-27" class="cb-remove" data-cb-remove="${p.id}" role="button" tabindex="0" aria-label="${name} entfernen">×</text>${lit&&types[p.type].resistance?`<text class="cb-label" text-anchor="middle" y="77">${Math.abs(current).toLocaleString("de-DE",{minimumFractionDigits:3,maximumFractionDigits:3})} A · ${power.toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2})} W</text>`:""}</g>`;
    }).join("");
    host.querySelector("#cb-status").textContent=notice||result.message;
    host.querySelector("#cb-status").className="cb-status feedback "+(result.short?"bad":result.total?"good":"");
    host.querySelector("#cb-switches").innerHTML=model.parts.filter(p=>["switch","changeover"].includes(p.type)).map(p=>`<button class="cb-tool" data-cb-switch="${p.id}">${types[p.type].name} ${p.id}: ${p.type==="switch"?(p.closed?"geschlossen":"offen"):(p.closed?"unten":"oben")} · umschalten</button>`).join("");
    host.querySelector("#cb-wire-list").innerHTML=model.wires.map(w=>`<button class="cb-tool small" data-cb-wire="${w.id}">Leitung ${w.id} entfernen</button>`).join("");
    host.querySelector("#cb-electrons").checked=model.electrons;
    host.querySelector("#cb-speed").value=model.speed;host.querySelector("#cb-speed-value").textContent=model.speed+"×";
    host.querySelector("#cb-voltage").value=model.voltage;host.querySelector("#cb-voltage-value").textContent=model.voltage+" V";
    const preview=host.querySelector("#cb-preview");preview.setAttribute("d",pending?`M${coordinate(pending).x} ${coordinate(pending).y}`:"");
  }
  function update(){persist(model);draw();}
  function connect(key) {
    if(!pending){pending=key;notice="Anschluss gewählt. Ziehe zum zweiten Anschluss oder wähle ihn mit Klick / Enter.";draw();return;}
    if(pending===key){pending=null;notice="Leitung abgebrochen.";draw();return;}
    if(model.wires.some(w=>(w.a===pending&&w.b===key)||(w.b===pending&&w.a===key))){notice="Diese Anschlüsse sind bereits verbunden.";pending=null;draw();return;}
    model.wires.push({id:model.nextId++,a:pending,b:key});pending=null;notice="";update();
  }
  function add(type) {
    if(model.parts.length>=16){notice="Maximal 16 Bauteile. Entferne zuerst ein Bauteil.";draw();return;}
    if(type==="battery"&&model.parts.some(p=>p.type==="battery")){notice="Dieses Modell unterstützt eine Batterie. Ihre Spannung kannst du am Regler ändern.";draw();return;}
    const index=model.parts.length;
    model.parts.push({id:model.nextId++,type,x:125+(index%4)*205,y:110+Math.floor(index/4)*105,closed:false});notice="";update();
  }
  function example(parallel) {
    model=initial();model.parts=[{id:1,type:"battery",x:150,y:120},{id:2,type:"switch",x:430,y:120,closed:false},{id:3,type:"lamp",x:700,y:280},{id:4,type:"lamp",x:430,y:410}];
    const links=parallel?[["1:0","2:0"],["2:1","3:0"],["3:1","1:1"],["2:1","4:0"],["4:1","1:1"]]:[["1:0","2:0"],["2:1","3:0"],["3:1","4:0"],["4:1","1:1"]];
    model.wires=links.map(([a,b],i)=>({id:i+5,a,b}));model.nextId=10;pending=null;notice="Beispiel geladen. Schließe den Schalter oder ändere die Leitungen.";update();
  }
  function point(event) {
    const svg=host.querySelector("#cb-board"),p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());
  }
  function mount(element,saved,onSave) {
    host=element;persist=onSave;model=saved||initial();pending=null;notice="";drag=null;
    const board=host.querySelector("#cb-board");
    host.onclick=event=>{
      const target=event.target.closest("[data-cb-add],[data-cb-example],[data-cb-switch],[data-cb-remove],[data-cb-wire],[data-cb-cancel],[data-cb-reset]");
      if(!target)return;
      if(target.dataset.cbAdd)add(target.dataset.cbAdd);
      else if(target.dataset.cbExample)example(target.dataset.cbExample==="parallel");
      else if(target.dataset.cbSwitch){const p=model.parts.find(p=>p.id===Number(target.dataset.cbSwitch));p.closed=!p.closed;notice="";update();}
      else if(target.dataset.cbRemove){const id=Number(target.dataset.cbRemove);model.parts=model.parts.filter(p=>p.id!==id);model.wires=model.wires.filter(w=>!w.a.startsWith(id+":")&&!w.b.startsWith(id+":"));pending=null;notice="";update();}
      else if(target.dataset.cbWire){model.wires=model.wires.filter(w=>w.id!==Number(target.dataset.cbWire));notice="Leitung entfernt.";update();}
      else if(target.hasAttribute("data-cb-cancel")){pending=null;notice="Leitung abgebrochen.";draw();}
      else if(target.hasAttribute("data-cb-reset")){model=initial();pending=null;notice="Arbeitsfläche zurückgesetzt.";update();}
    };
    host.oninput=event=>{
      if(event.target.id==="cb-speed")model.speed=Number(event.target.value);
      else if(event.target.id==="cb-voltage")model.voltage=Number(event.target.value);
      else if(event.target.id==="cb-electrons")model.electrons=event.target.checked;
      else return;
      notice="";update();
    };
    board.onpointerdown=event=>{
      if(event.button!==0)return;
      const port=event.target.closest("[data-cb-port]"),part=event.target.closest("[data-cb-part]");
      if(event.target.closest("[data-cb-remove],[data-cb-wire]"))return;
      const pt=point(event);
      if(port){const key=port.dataset.cbPort;if(pending&&pending!==key){connect(key);return;}pending=key;drag={type:"wire",start:pt};draw();}
      else if(part){const p=model.parts.find(p=>p.id===Number(part.dataset.cbPart));drag={type:"part",id:p.id,dx:pt.x-p.x,dy:pt.y-p.y};}
      else return;
      board.setPointerCapture(event.pointerId);event.preventDefault();
    };
    board.onpointermove=event=>{
      if(!drag)return;const pt=point(event);
      if(drag.type==="wire")host.querySelector("#cb-preview").setAttribute("d",path(coordinate(pending),pt));
      else {const p=model.parts.find(p=>p.id===drag.id);p.x=Math.max(80,Math.min(820,pt.x-drag.dx));p.y=Math.max(65,Math.min(435,pt.y-drag.dy));draw();}
    };
    board.onpointerup=event=>{
      if(!drag)return;
      if(drag.type==="wire"){
        const pt=point(event),end=model.parts.flatMap(p=>types[p.type].ports.map((_,i)=>terminal(p,i))).find(key=>{const c=coordinate(key);return key!==pending&&Math.hypot(c.x-pt.x,c.y-pt.y)<18;});
        if(end)connect(end);else {notice="Wähle den zweiten Anschluss. Escape bricht die Leitung ab.";draw();}
      }else update();
      drag=null;if(board.hasPointerCapture(event.pointerId))board.releasePointerCapture(event.pointerId);
    };
    board.onpointercancel=()=>{drag=null;pending=null;notice="Ziehen abgebrochen.";update();};
    board.ondblclick=event=>{const part=event.target.closest("[data-cb-part]");if(!part)return;const p=model.parts.find(p=>p.id===Number(part.dataset.cbPart));if(["switch","changeover"].includes(p.type)){p.closed=!p.closed;notice="";update();}};
    board.onkeydown=event=>{
      if(event.key==="Escape"){pending=null;notice="Leitung abgebrochen.";draw();return;}
      const port=event.target.closest("[data-cb-port]"),remove=event.target.closest("[data-cb-remove]");
      if(["Enter"," "].includes(event.key)&&(port||remove)){event.preventDefault();if(port){const key=port.dataset.cbPort;connect(key);host.querySelector(`[data-cb-port="${key}"]`)?.focus();}else remove.dispatchEvent(new MouseEvent("click",{bubbles:true}));return;}
      const part=event.target.closest("[data-cb-part]");
      if(!part||port||!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key))return;
      event.preventDefault();const p=model.parts.find(p=>p.id===Number(part.dataset.cbPart));
      p.x=Math.max(80,Math.min(820,p.x+(event.key==="ArrowLeft"?-10:event.key==="ArrowRight"?10:0)));
      p.y=Math.max(65,Math.min(435,p.y+(event.key==="ArrowUp"?-10:event.key==="ArrowDown"?10:0)));
      update();host.querySelector(`[data-cb-part="${p.id}"]`).focus();
    };
    draw();
  }
  return {template,mount};
})();
