"use strict";
window.CircuitBuilder = (() => {
  const GRID = 25;
  const types = {
    battery:{name:"Batterie",ports:[[-50,0],[50,0]]},
    lamp:{name:"Lampe",resistance:30,ports:[[-50,0],[50,0]]},
    resistor:{name:"Widerstand",resistance:100,ports:[[-50,0],[50,0]]},
    motor:{name:"Motor",resistance:60,ports:[[-50,0],[50,0]]},
    switch:{name:"Schalter",ports:[[-50,0],[50,0]]},
    changeover:{name:"Wechselschalter",ports:[[-50,0],[50,-25],[50,25]]},
    wire:{name:"Leitung gerade",ports:[[-50,0],[50,0]]},
    corner:{name:"Leitung Ecke",ports:[[-50,0],[0,-50]]},
    junction:{name:"Leitung T-Stück",ports:[[-50,0],[50,0],[0,50]]}
  };
  const initial = () => ({version:2,parts:[],nextId:1,electrons:true,energy:true,speed:1,voltage:6});
  let model,host,persist,selected=null,drag=null,notice="",result,skipClick=false;
  function symbol(type,closed=false,lit=false) {
    const leads='<path d="M-50 0H-25M25 0H50"/>';
    if(type==="wire")return '<path d="M-50 0H50"/>';
    if(type==="corner")return '<path d="M-50 0H0V-50"/>';
    if(type==="junction")return '<path d="M-50 0H50M0 0V50"/><circle cx="0" cy="0" r="4" class="junction-dot"/>';
    if(type==="battery")return '<path d="M-50 0H-10M10 0H50M-10-24V24M10-13V13"/><text x="-28" y="-29">+</text><text x="20" y="-29">−</text>';
    if(type==="switch")return '<path d="M-50 0H-22M22 0H50"/><circle cx="-22" cy="0" r="3"/><circle cx="22" cy="0" r="3"/><path class="switch-blade" d="'+(closed?'M-22 0H22':'M-22 0L16-24')+'"/>';
    if(type==="changeover")return '<path d="M-50 0H-22M22-25H50M22 25H50"/><circle cx="-22" cy="0" r="3"/><circle cx="22" cy="-25" r="3"/><circle cx="22" cy="25" r="3"/><path class="switch-blade" d="M-22 0L22 '+(closed?25:-25)+'"/>';
    if(type==="resistor")return leads+'<rect x="-25" y="-13" width="50" height="26"/>';
    return leads+`<circle cx="0" cy="0" r="25" class="${lit?"lit":""}"/>`+(type==="lamp"?'<path d="M-16-16L16 16M16-16L-16 16"/>':'<text x="0" y="7" text-anchor="middle" class="motor-letter">M</text>');
  }
  function energyGlyph(type,x=0,y=0) {
    let visual="";
    if(type==="lamp") {
      visual=Array.from({length:8},(_,i)=>{
        const angle=i*Math.PI/4,ax=Math.cos(angle),ay=Math.sin(angle);
        return `<path class="energy-ray" d="M${ax*32} ${ay*32}L${ax*45} ${ay*45}"/><circle class="energy-particle" r="3" fill="#efb900"><animateMotion dur="2s" begin="${-i/4}s" repeatCount="indefinite" path="M${ax*32} ${ay*32}L${ax*48} ${ay*48}"/></circle>`;
      }).join("");
    }
    if(type==="motor")visual='<g class="energy-particle energy-motion"><path d="M0-34A34 34 0 0 1 34 0M27-7L34 0L40-8" fill="none" stroke="#087f83" stroke-width="3"/><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="2s" repeatCount="indefinite"/></g>';
    if(["lamp","motor","resistor"].includes(type))visual+='<path class="energy-heat" d="M-17 35q-6 5 0 10t0 10M0 35q-6 5 0 10t0 10M17 35q-6 5 0 10t0 10"/>';
    return `<g class="energy-output" data-energy-type="${type}" transform="translate(${x} ${y})" aria-hidden="true">${visual}</g>`;
  }
  function template() {
    return `<style>
      .cb-layout{display:grid;grid-template-columns:210px minmax(0,1fr);gap:18px}.cb-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.cb-tool{border:1px solid var(--line);border-radius:8px;padding:8px;background:white;color:var(--ink);font:inherit;cursor:pointer}.cb-tool svg{width:100%;height:45px}.cb-symbol{fill:white;stroke:#294958;stroke-width:3;stroke-linejoin:round;stroke-linecap:round}.cb-symbol path{fill:none}.cb-symbol text{fill:#294958;stroke:none;font:700 18px system-ui}.cb-symbol .junction-dot{fill:#294958}.cb-symbol .lit{stroke:#b67c09}.cb-symbol .motor-letter{font-size:22px}.cb-board{width:100%;display:block;background:#f7fbfc;border:1px solid var(--line);border-radius:12px;touch-action:none;user-select:none}.cb-part{cursor:grab}.cb-bg{fill:#ffffffc9;stroke:#d9e6eb;stroke-width:1}.cb-part.selected .cb-bg{stroke:#bd850e;stroke-width:3}.cb-label{font:600 11px system-ui;fill:#294958;pointer-events:none}.cb-port{fill:white;stroke:#ae7049;stroke-width:2}.cb-port.connected{fill:#087f83;stroke:#087f83}.cb-electron,.flow-electron{fill:#1269c0;stroke:white;stroke-width:1;pointer-events:none}.cb-status{min-height:48px}.cb-palette{display:grid;grid-template-columns:1fr 1fr;gap:6px}.cb-palette button{font-size:.8rem;touch-action:none;user-select:none}.cb-guide{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.cb-guide article{text-align:center;border:1px solid var(--line);padding:8px;border-radius:10px}.cb-guide svg{width:100%;height:65px}.cb-options label{display:block;margin:12px 0}.cb-options input[type=range]{width:100%;accent-color:#087f83}.cb-part:focus-visible{outline:none}.cb-part:focus-visible .cb-bg{stroke:#bd850e;stroke-width:3}.cb-ghost{opacity:.6;pointer-events:none}.cb-hit{fill:transparent;stroke:none}.cb-board-wrap{overflow:auto}.cb-selection{font-size:.85rem}.cb-palette .cb-tool:hover{border-color:#087f83}
      @media(max-width:760px){.cb-layout{grid-template-columns:minmax(0,1fr)}.cb-palette{grid-template-columns:repeat(3,minmax(0,1fr))}.cb-guide{grid-template-columns:repeat(2,minmax(0,1fr))}.cb-board{min-width:620px}}
      @media(prefers-reduced-motion:reduce){.cb-electron,.flow-electron{display:none}}
    </style>
    <div class="eyebrow">Labor · Bausteine zusammenfügen</div><h1 style="font-size:clamp(2rem,5vw,3.2rem)">Baue deinen Stromkreis</h1>
    <p class="lead">Ziehe Bauteile und feste Leitungsstücke aus der Auswahl ins Feld. Verschiebe und drehe sie, bis ihre Anschlüsse zusammentreffen. Leitungen werden nicht frei gezogen.</p>
    <p><a href="./arbeitsblatt-stromkreise.html">Begleitendes Arbeitsblatt für 60 Minuten öffnen und drucken</a></p>
    <div class="cb-layout"><aside class="card"><h3>Bausteine</h3><div class="cb-palette">${Object.entries(types).map(([key,t])=>`<button class="cb-tool" data-cb-add="${key}"><svg viewBox="-65 -65 130 130" aria-hidden="true"><g class="cb-symbol">${symbol(key)}</g></svg>${t.name}</button>`).join("")}</div><p class="small muted">Ziehen oder antippen zum Hinzufügen. Anschlüsse rasten am 25er-Raster ein.</p>
    <div class="cb-options"><h3>Elektronenfluss</h3><label><input type="checkbox" id="cb-electrons"> Elektronen anzeigen</label><label><input type="checkbox" id="cb-energy"> Energieumwandlung anzeigen</label><label for="cb-speed">Animationsgeschwindigkeit <output id="cb-speed-value"></output><input id="cb-speed" type="range" min=".25" max="3" step=".25"></label><label for="cb-voltage">Batteriespannung <output id="cb-voltage-value"></output><input id="cb-voltage" type="range" min="1.5" max="12" step=".5"></label></div></aside>
    <section class="card" style="min-width:0"><h3>Deine Arbeitsfläche</h3><p class="small muted">Grüne Anschlüsse: verbunden. Hohle Anschlüsse: noch frei. Nur deckungsgleiche Anschlüsse verbinden sich; Kreuzungen verbinden sich nicht. Für Abzweigungen ein T-Stück verwenden. Schalter direkt antippen. Baustein wählen, dann „Drehen“ oder Taste R; Pfeiltasten verschieben, Entf entfernt.</p>
    <div class="cb-toolbar"><button class="cb-tool" data-cb-example="series">Beispiel: Reihe</button><button class="cb-tool" data-cb-example="parallel">Beispiel: Parallel</button><button class="cb-tool" data-cb-reset>Alles zurücksetzen</button></div>
    <div class="cb-toolbar"><button class="cb-tool" data-cb-rotate>Drehen ↻ 90°</button><button class="cb-tool" data-cb-delete>Auswahl entfernen</button><span id="cb-selection" class="cb-selection" role="status"></span></div>
    <div class="cb-board-wrap"><svg id="cb-board" class="cb-board" viewBox="0 0 1000 650" aria-label="Baustein-Arbeitsfläche: deckungsgleiche Anschlüsse bilden elektrische Verbindungen"><defs><pattern id="cb-grid" width="25" height="25" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r="1.5" fill="#b5cbd3"/></pattern></defs><rect width="1000" height="650" fill="url(#cb-grid)"/><g id="cb-parts"></g><g id="cb-flow"></g><g id="cb-ghost" class="cb-ghost"></g></svg></div>
    <div class="cb-status" role="status" aria-live="polite" id="cb-status"></div><div id="cb-switches" class="cb-toolbar"></div>
    <div id="cb-energy-status" class="callout small" aria-live="polite"></div>
    <div class="callout small"><strong>Elektronen</strong> bewegen sich in den äußeren Metallleitungen vom Minuspol zum Pluspol. Blaue Kreise zeigen diese Richtung auf stromführenden Wegen. Ihre Animationsgeschwindigkeit ist kein Maß für den echten Strom. Bei reduzierter Bewegung im Betriebssystem ist die Animation ausgeblendet.</div></section></div>
    <section class="card" style="margin-top:20px"><h2>Schaltzeichen auf einen Blick</h2><div class="cb-guide">${Object.entries(types).map(([key,t])=>`<article><svg viewBox="-70 -65 140 130" role="img" aria-label="${t.name}"><g class="cb-symbol">${symbol(key)}</g></svg><strong>${t.name}</strong><p class="small muted">${key==="battery"?"Langer Strich: Pluspol; kurzer Strich: Minuspol":key==="resistor"?"Leeres Rechteck":key==="switch"?"Offener Kontakt mit sichtbarer Lücke":key==="changeover"?"Ein gemeinsamer Anschluss, zwei wählbare Kontakte":key==="lamp"?"Kreis mit Kreuz":key==="motor"?"Kreis mit M":key==="junction"?"Verzweigung mit Verbindungspunkt":"Festes Leitungsstück"}</p></article>`).join("")}</div>
    <div class="callout warning small"><strong>Modell:</strong> Eine Batterie; Lampe 30 Ω, Widerstand 100 Ω, Motor vereinfacht als 60 Ω. Leitungsstücke und geschlossene Kontakte: jeweils 0,01 Ω. Helligkeit aus der elektrischen Leistung angenähert. Ein echter Motor und Glühlampen verhalten sich komplexer. Kurzschluss: Warnung und Animationsstopp, nicht Stromlosigkeit im echten Aufbau. Niemals mit Steckdosen experimentieren.</div></section>`;
  }
  const terminal=(part,index)=>part.id+":"+index;
  function transformed(part,offset) {
    const [x,y]=offset;
    const [dx,dy]=[[x,y],[-y,x],[-x,-y],[y,-x]][part.rotation/90];
    return {x:part.x+dx,y:part.y+dy};
  }
  function coordinate(part,index){return transformed(part,types[part.type].ports[index]);}
  function topology() {
    const positions=new Map(),nodes=[],edges=[];
    for(const p of model.parts)for(let i=0;i<types[p.type].ports.length;i++) {
      const key=terminal(p,i),c=coordinate(p,i),position=c.x+","+c.y;
      nodes.push(key);
      if(!positions.has(position))positions.set(position,[]);
      positions.get(position).push(key);
    }
    for(const group of positions.values())for(let i=1;i<group.length;i++)edges.push({id:"contact:"+group[i],a:group[0],b:group[i],r:.001,contact:true});
    for(const p of model.parts) {
      const resistance=types[p.type].resistance;
      const connect=(index,r=.01)=>edges.push({id:"p"+p.id+":"+index,a:terminal(p,0),b:terminal(p,index),r,part:p,index});
      if(resistance)connect(1,resistance);
      else if(["wire","corner"].includes(p.type)||p.type==="switch"&&p.closed)connect(1);
      else if(p.type==="junction"){connect(1);connect(2);}
      else if(p.type==="changeover")connect(p.closed?2:1);
    }
    return {nodes,edges,positions};
  }
  function reachable(start,edges) {
    const seen=new Set([start]),queue=[start];
    for(let i=0;i<queue.length;i++)for(const e of edges) {
      const next=e.a===queue[i]?e.b:e.b===queue[i]?e.a:null;
      if(next&&!seen.has(next)){seen.add(next);queue.push(next);}
    }
    return seen;
  }
  function solve(graph) {
    const {nodes,edges}=graph,battery=model.parts.find(p=>p.type==="battery"),currents=new Map();
    if(!battery)return {currents,total:0,message:"Füge eine Batterie hinzu und füge einen geschlossenen Weg über einen Verbraucher zusammen."};
    const plus=terminal(battery,0),minus=terminal(battery,1);
    if(reachable(plus,edges.filter(e=>e.r<=.01)).has(minus))return {currents,total:0,short:true,message:"Kurzschluss: Die Pole sind ohne Verbraucher verbunden. Entferne die direkte Überbrückung. Animation gestoppt."};
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
      if(Math.abs(matrix[pivot][col])<1e-10)return {currents,total:0,message:"Berechnung nicht zuverlässig möglich. Prüfe die Anschlussstellen oder setze den Aufbau zurück."};
      [matrix[col],matrix[pivot]]=[matrix[pivot],matrix[col]];
      const divisor=matrix[col][col];for(let j=col;j<=unknown.length;j++)matrix[col][j]/=divisor;
      for(let row=0;row<unknown.length;row++)if(row!==col){const factor=matrix[row][col];for(let j=col;j<=unknown.length;j++)matrix[row][j]-=factor*matrix[col][j];}
    }
    const voltages=new Map([[plus,model.voltage],[minus,0],...unknown.map((n,i)=>[n,matrix[i][unknown.length]])]);
    let total=0;
    for(const edge of edges) {
      const current=voltages.has(edge.a)&&voltages.has(edge.b)?(voltages.get(edge.a)-voltages.get(edge.b))/edge.r:0;
      currents.set(edge.id,Math.abs(current)<1e-7?0:current);
      if(edge.a===plus)total+=current;if(edge.b===plus)total-=current;
    }
    total=Math.max(0,total);
    return {currents,total,message:total>1e-7?`Geschlossener Stromweg · Gesamtstrom ${total.toLocaleString("de-DE",{maximumFractionDigits:3})} A. Elektronen: Minus → Plus auf den äußeren Wegen.`:"Kein Stromfluss. Prüfe freie Anschlüsse, die Ausrichtung der Bausteine und offene Schalter."};
  }
  function electronPath(edge) {
    const a=coordinate(edge.part,0),b=coordinate(edge.part,edge.index);
    if(edge.part.type==="changeover"){
      const from=transformed(edge.part,[-22,0]),to=transformed(edge.part,[22,edge.index===1?-25:25]);
      return `M${a.x} ${a.y}L${from.x} ${from.y}L${to.x} ${to.y}L${b.x} ${b.y}`;
    }
    const middle=transformed(edge.part,[0,0]);
    return `M${a.x} ${a.y}L${middle.x} ${middle.y}L${b.x} ${b.y}`;
  }
  function particles(id,current,converter=false) {
    if(!model.electrons||!current)return "";
    const duration=3/model.speed;
    return [0,1].map(i=>{
      const movement=`<animateMotion dur="${duration}s" begin="${-duration*i/2}s" repeatCount="indefinite" keyPoints="${current>0?"1;0":"0;1"}" keyTimes="0;1" calcMode="linear"><mpath href="#${id}"/></animateMotion>`;
      const halo=model.energy&&converter?`<circle class="energy-halo" r="8" fill="none" stroke="#efb900" stroke-width="2">${movement}<animate attributeName="opacity" values="1;1;0;0" keyTimes="0;.4;.6;1" dur="${duration}s" begin="${-duration*i/2}s" repeatCount="indefinite"/></circle>`:"";
      return halo+`<circle class="cb-electron" r="4">${movement}</circle>`;
    }).join("");
  }
  function draw() {
    const graph=topology();result=solve(graph);
    host.querySelector("#cb-parts").innerHTML=model.parts.map(p=>{
      const current=result.currents.get("p"+p.id+":1")||0,power=current*current*(types[p.type].resistance||0),lit=Math.abs(current)>1e-7;
      const brightness=Math.min(1,power/1.2);
      const isWire=["wire","corner","junction"].includes(p.type);
      const body=symbol(p.type,p.closed,lit).replace('class="lit"',`class="lit" style="fill:rgb(255,${Math.round(255-55*brightness)},${Math.round(255-175*brightness)})"`);
      const ports=types[p.type].ports.map((_,i)=>{
        const c=coordinate(p,i),connected=graph.positions.get(c.x+","+c.y).length>1;
        return `<circle class="cb-port ${connected?"connected":""}" data-cb-port="${terminal(p,i)}" cx="${c.x-p.x}" cy="${c.y-p.y}" r="4"><title>${connected?"Verbunden":"Frei"}</title></circle>`;
      }).join("");
      return `<g class="cb-part ${selected===p.id?"selected":""}" data-cb-part="${p.id}" transform="translate(${p.x} ${p.y})" tabindex="0" role="${["switch","changeover"].includes(p.type)?"button":"group"}" ${p.type==="switch"?`aria-pressed="${p.closed}"`:""} aria-label="${types[p.type].name}${isWire?"":" "+p.id}, ${p.rotation} Grad${p.type==="switch"?(p.closed?", geschlossen":", offen"):""}; Pfeiltasten verschieben, R dreht"><rect class="cb-bg" x="-45" y="-45" width="90" height="90" rx="10"/><g class="cb-symbol" transform="rotate(${p.rotation})">${body}</g>${model.energy&&lit&&types[p.type].resistance?energyGlyph(p.type):""}${ports}${isWire?"":`<text class="cb-label" x="0" y="-56" text-anchor="middle">${types[p.type].name} ${p.id}</text>`}${lit&&types[p.type].resistance?`<text class="cb-label" text-anchor="middle" y="73">${Math.abs(current).toLocaleString("de-DE",{maximumFractionDigits:3})} A · ${power.toLocaleString("de-DE",{maximumFractionDigits:2})} W</text>`:""}</g>`;
    }).join("");
    host.querySelector("#cb-flow").innerHTML=graph.edges.filter(e=>e.part).map(e=>{
      const id="cb-flow-"+e.part.id+"-"+e.index;
      return `<path id="${id}" d="${electronPath(e)}" fill="none" stroke="none"/>${particles(id,result.currents.get(e.id)||0,!!types[e.part.type].resistance)}`;
    }).join("");
    host.querySelector("#cb-status").textContent=notice||result.message;
    host.querySelector("#cb-status").className="cb-status feedback "+(result.short?"bad":result.total?"good":"");
    const p=model.parts.find(p=>p.id===selected);
    host.querySelector("#cb-selection").textContent=p?(["wire","corner","junction"].includes(p.type)?"Ausgewählt":types[p.type].name+" "+p.id)+" · "+p.rotation+"°":"Baustein auswählen";
    host.querySelector("[data-cb-rotate]").disabled=!p;host.querySelector("[data-cb-delete]").disabled=!p;
    host.querySelector("#cb-switches").innerHTML=model.parts.filter(p=>["switch","changeover"].includes(p.type)).map(p=>`<button class="cb-tool" data-cb-switch="${p.id}">${types[p.type].name} ${p.id}: ${p.type==="switch"?(p.closed?"geschlossen":"offen"):(p.closed?"Kontakt 2":"Kontakt 1")} · umschalten</button>`).join("");
    host.querySelector("#cb-electrons").checked=model.electrons;
    host.querySelector("#cb-energy").checked=model.energy;
    const activeConverters=model.parts.filter(p=>types[p.type].resistance&&Math.abs(result.currents.get("p"+p.id+":1")||0)>1e-7);
    host.querySelector("#cb-energy-status").hidden=!model.energy;
    host.querySelector("#cb-energy-status").innerHTML=`<strong>Energieumwandlung sichtbar:</strong> ${activeConverters.length?activeConverters.map(p=>`${types[p.type].name} ${p.id}: elektrische Energie → ${p.type==="lamp"?"Licht und Wärme":p.type==="motor"?"Bewegung und Wärme":"Wärme"}`).join(" · "):"Aktuell keine Energieumwandlung: kein stromführender Verbraucher."}<br>Blau = Elektronen; gelbe Ringe = symbolisch abgegebene elektrische Energie, gelbe Strahlen = Licht, orange Wellen = Wärme, Drehpfeil = Bewegung. <strong>Elektronen werden nicht zu Licht und werden nicht verbraucht.</strong> Die Ringe sind eine Lernhilfe, kein wörtliches Transportmodell: Die Batterie stellt Energie bereit, die über das elektrische Feld übertragen und im Verbraucher umgewandelt wird. Die Energiezeichen sind nicht mengengetreu.`;
    host.querySelector("#cb-speed").value=model.speed;host.querySelector("#cb-speed-value").textContent=model.speed+"×";
    host.querySelector("#cb-voltage").value=model.voltage;host.querySelector("#cb-voltage-value").textContent=model.voltage+" V";
  }
  function update(){persist(model);draw();}
  function position(x,y){return {x:Math.max(75,Math.min(925,Math.round(x/GRID)*GRID)),y:Math.max(75,Math.min(575,Math.round(y/GRID)*GRID))};}
  function add(type,x,y) {
    if(model.parts.length>=64){notice="Maximal 64 Bausteine. Entferne zuerst einen Baustein.";draw();return;}
    if(type==="battery"&&model.parts.some(p=>p.type==="battery")){notice="Das Modell unterstützt eine Batterie. Nutze den Spannungsregler.";draw();return;}
    const index=model.parts.length;
    const p={id:model.nextId++,type,...position(x??(125+(index%7)*125),y??(100+Math.floor(index/7)*75)),rotation:0,closed:false};
    model.parts.push(p);selected=p.id;notice="";update();
  }
  function removeSelected(){model.parts=model.parts.filter(p=>p.id!==selected);selected=null;notice="Baustein entfernt.";update();}
  function rotateSelected(){const p=model.parts.find(p=>p.id===selected);if(!p)return;p.rotation=(p.rotation+90)%360;notice="";update();}
  function togglePart(id){const p=model.parts.find(p=>p.id===id);if(p&&["switch","changeover"].includes(p.type)){p.closed=!p.closed;notice="";update();}}
  function example(parallel) {
    model=initial();selected=null;
    const put=(type,x,y,rotation=0)=>{const p={id:model.nextId++,type,x,y,rotation,closed:false};model.parts.push(p);return p;};
    if(!parallel) {
      put("battery",300,200);put("switch",400,200);put("lamp",500,200);put("lamp",600,200);
      put("corner",700,200,270);
      put("wire",700,300,90);put("corner",700,400);
      put("wire",600,400);put("wire",500,400);put("wire",400,400);put("wire",300,400);
      put("corner",200,400,90);put("wire",200,300,90);put("corner",200,200,180);
    } else {
      put("battery",250,200);put("switch",350,200);put("junction",450,200);
      put("corner",550,200,270);put("lamp",550,300,90);put("corner",550,400);
      put("lamp",450,300,90);put("junction",450,400,180);
      put("wire",350,400);put("wire",250,400);put("corner",150,400,90);
      put("wire",150,300,90);put("corner",150,200,180);
    }
    notice="Beispiel geladen. Tippe den offenen Schalter an; verschiebe oder drehe danach Bausteine.";update();
  }
  function point(event){const svg=host.querySelector("#cb-board"),p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());}
  function valid(saved) {
    return saved&&saved.version===2&&Array.isArray(saved.parts)&&saved.parts.length<=64&&saved.parts.every(p=>Number.isInteger(p.id)&&p.id>0&&types[p.type]&&[p.x,p.y].every(v=>Number.isFinite(v)&&v%25===0)&&p.x>=75&&p.x<=925&&p.y>=75&&p.y<=575&&[0,90,180,270].includes(p.rotation)&&typeof p.closed==="boolean")&&new Set(saved.parts.map(p=>p.id)).size===saved.parts.length&&saved.parts.filter(p=>p.type==="battery").length<=1&&Number.isInteger(saved.nextId)&&saved.nextId>Math.max(0,...saved.parts.map(p=>p.id))&&typeof saved.electrons==="boolean"&&Number.isFinite(saved.speed)&&saved.speed>=.25&&saved.speed<=3&&Number.isFinite(saved.voltage)&&saved.voltage>=1.5&&saved.voltage<=12;
  }
  function mount(element,saved,onSave) {
    host=element;persist=onSave;model=valid(saved)?{...saved,energy:saved.energy!==false}:initial();selected=null;drag=null;skipClick=false;
    notice=saved&&!valid(saved)?(saved.version===2?"Gespeicherter Aufbau ungültig. Bitte neu aufbauen.":"Das Labor nutzt jetzt feste Bausteine. Der frühere frei verdrahtete Aufbau wird nicht übernommen. Wähle ein Beispiel oder baue neu."):"";
    host.onclick=event=>{
      if(skipClick){skipClick=false;return;}
      const target=event.target.closest("[data-cb-add],[data-cb-example],[data-cb-switch],[data-cb-rotate],[data-cb-delete],[data-cb-reset]");
      if(!target)return;
      if(target.dataset.cbAdd)add(target.dataset.cbAdd);
      else if(target.dataset.cbExample)example(target.dataset.cbExample==="parallel");
      else if(target.dataset.cbSwitch)togglePart(Number(target.dataset.cbSwitch));
      else if(target.hasAttribute("data-cb-rotate"))rotateSelected();
      else if(target.hasAttribute("data-cb-delete"))removeSelected();
      else {model=initial();selected=null;notice="Arbeitsfläche zurückgesetzt.";update();}
    };
    host.oninput=event=>{
      if(event.target.id==="cb-speed")model.speed=Number(event.target.value);
      else if(event.target.id==="cb-voltage")model.voltage=Number(event.target.value);
      else if(event.target.id==="cb-electrons")model.electrons=event.target.checked;
      else if(event.target.id==="cb-energy")model.energy=event.target.checked;
      else return;
      notice="";update();
    };
    host.onpointerdown=event=>{
      if(event.button!==0)return;
      const palette=event.target.closest("[data-cb-add]"),part=event.target.closest("[data-cb-part]");
      if(!palette&&!part)return;
      const start={x:event.clientX,y:event.clientY};
      if(palette)drag={type:"palette",kind:palette.dataset.cbAdd,start,moved:false};
      else {const p=model.parts.find(p=>p.id===Number(part.dataset.cbPart)),pt=point(event);selected=p.id;drag={type:"part",id:p.id,start,original:{x:p.x,y:p.y},dx:pt.x-p.x,dy:pt.y-p.y,moved:false};draw();}
      host.setPointerCapture(event.pointerId);event.preventDefault();
    };
    host.onpointermove=event=>{
      if(!drag)return;
      if(Math.hypot(event.clientX-drag.start.x,event.clientY-drag.start.y)>5)drag.moved=true;
      const pt=point(event);
      if(drag.type==="palette"){
        const pos=position(pt.x,pt.y);
        host.querySelector("#cb-ghost").innerHTML=`<g transform="translate(${pos.x} ${pos.y})" class="cb-symbol">${symbol(drag.kind)}</g>`;
      }else if(drag.moved){const p=model.parts.find(p=>p.id===drag.id);Object.assign(p,position(pt.x-drag.dx,pt.y-drag.dy));notice="";draw();}
    };
    host.onpointerup=event=>{
      if(!drag)return;const active=drag;drag=null;skipClick=true;
      host.querySelector("#cb-ghost").innerHTML="";
      if(active.type==="palette") {
        const pt=point(event);
        if(!active.moved)add(active.kind);
        else if(pt.x>=50&&pt.x<=950&&pt.y>=50&&pt.y<=600)add(active.kind,pt.x,pt.y);
        else {notice="Baustein bitte innerhalb der Arbeitsfläche ablegen.";draw();}
      }else if(!active.moved)togglePart(active.id);
      else update();
      if(host.hasPointerCapture(event.pointerId))host.releasePointerCapture(event.pointerId);
      setTimeout(()=>{skipClick=false;},0);
    };
    host.onpointercancel=event=>{
      if(drag?.type==="part"){const p=model.parts.find(p=>p.id===drag.id);Object.assign(p,drag.original);}
      drag=null;host.querySelector("#cb-ghost").innerHTML="";notice="Verschieben abgebrochen.";draw();
      if(host.hasPointerCapture(event.pointerId))host.releasePointerCapture(event.pointerId);
    };
    const board=host.querySelector("#cb-board");
    board.onkeydown=event=>{
      const part=event.target.closest("[data-cb-part]");if(!part)return;
      const p=model.parts.find(p=>p.id===Number(part.dataset.cbPart));selected=p.id;
      if(event.key.toLowerCase()==="r"){event.preventDefault();rotateSelected();}
      else if(["Delete","Backspace"].includes(event.key)){event.preventDefault();removeSelected();return;}
      else if(["Enter"," "].includes(event.key)){event.preventDefault();togglePart(p.id);draw();}
      else if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key)){
        event.preventDefault();Object.assign(p,position(p.x+(event.key==="ArrowLeft"?-25:event.key==="ArrowRight"?25:0),p.y+(event.key==="ArrowUp"?-25:event.key==="ArrowDown"?25:0)));notice="";update();
      }else return;
      host.querySelector(`[data-cb-part="${p.id}"]`)?.focus();
    };
    draw();
  }
  return {template,mount,symbol,energyGlyph};
})();
