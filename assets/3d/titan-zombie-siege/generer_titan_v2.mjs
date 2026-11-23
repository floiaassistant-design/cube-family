// Cube Family - Titan zombie siege V2, procedural improvement of V1.
// Usage: node assets/3d/titan-zombie-siege/generer_titan_v2.mjs
// No third-party dependencies; requires adjacent titan_zombie_siege_v1.glb.
import {readFileSync,writeFileSync} from "node:fs";
function upgradeV1(bytes){
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(String.fromCharCode(...bytes.slice(0,4))!=="glTF"||dv.getUint32(4,true)!==2||dv.getUint32(8,true)!==bytes.length)throw Error("Invalid V1 GLB");
 const jlen=dv.getUint32(12,true),jtext=String.fromCharCode(...bytes.slice(20,20+jlen));
 const doc=JSON.parse(jtext), binStart=20+jlen+8;
 const bin=Array.from(bytes.slice(binStart,binStart+dv.getUint32(20+jlen,true)));
 if(doc.animations?.length!==5||doc.meshes?.length!==9)throw Error("Unexpected V1 skeleton");
 const palette={
 "678D65":"65795D","82A479":"829777","42664F":"465D49","344F42":"344C3C","94AA6E":"80945E",
 "D9D3AA":"C7BEB0","3E5B61":"6A2734","55767A":"8E3942","293E49":"4C222C",
 "AE633B":"995031","DB8E4C":"D27B42","68737A":"66636A","3A4851":"403E45","9DA3A1":"A39B96",
 "696D74":"706A6C","94949A":"9B9291","414550":"48474D","F1C65F":"C0F838",
 "FFE898":"EAFF78","EDE1B9":"D8CCB6","26343B":"252731",
 "3A3948":"45383B","565263":"67535A","4F3A34":"53332C","735343":"744B3D",
 "AFB7AC":"8B8079"
 };
 function linear(hex){const b=[];for(let k=0;k<6;k+=2){let v=parseInt(hex.slice(k,k+2),16)/255;v=v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);b.push(Math.round(v*255))}return b}
 const colorMap=new Map(Object.entries(palette).map(([a,b])=>[linear(a).join(","),linear(b)]));
 // Change V1 vertex colors in-place. Keep all original bone geometry and motion tracks.
 for(let mi=0;mi<doc.meshes.length;mi++){
   const name=doc.meshes[mi].name;
   for(const prim of doc.meshes[mi].primitives){
    const acc=doc.accessors[prim.attributes.COLOR_0],view=doc.bufferViews[acc.bufferView];
    if(acc.componentType!==5121||acc.type!=="VEC4")throw Error("Unsupported vertex-color layout");
    const offset=(view.byteOffset||0)+(acc.byteOffset||0),stride=view.byteStride||4;
    for(let v=0;v<acc.count;v++){
      const p=offset+stride*v, key=[bin[p],bin[p+1],bin[p+2]].join(",");
      let rgb=colorMap.get(key);
      if(name==="Core_WeakPoint"){
        const c=[bin[p],bin[p+1],bin[p+2]];
        const lum=(c[0]+c[1]+c[2])/765;
        rgb=linear(lum>.50?"FF5A79":lum>.20?"DA2846":"78243A");
      }
      if(rgb){bin[p]=rgb[0];bin[p+1]=rgb[1];bin[p+2]=rgb[2]}
    }
   }
 }
 // Add detail meshes anchored to existing articulated joints.
 const GROUP=new Map(), unit=.24;
 const nodes=Object.fromEntries(doc.nodes.map((n,i)=>[n.name,i]));
 function box(parent,x0,x1,y0,y1,z0,z1,color,material=0){
   if(!nodes.hasOwnProperty(parent))throw Error("Unknown parent "+parent);
   const key=parent+"#"+material;
   if(!GROUP.has(key))GROUP.set(key,{parent,material,boxes:[]});
   GROUP.get(key).boxes.push([x0,x1,y0,y1,z0,z1,color]);
 }
 // Torso: battered rusty plate armour, layered burgundy tabard, ribs and rivets.
 for(const side of [-1,1]){
   const x=side<0?-11:8;
   box("Body",x,x+3,29,40,7,9,"#87402F");
   box("Body",x,x+3,38,40,9,10,"#B5653B");
   box("Body",x,x+3,30,31,10,11,"#45424A");
   for(let y of [32,36,39])box("Body",x+1,x+2,y,y+1,10,11,"#B7A9A3");
 }
 box("Body",-8,7,24,26,7,10,"#6A342D");
 box("Body",-7,6,20,24,7,9,"#772532");
 for(const [x,low] of [[-7,14],[-4,12],[-1,15],[2,11],[5,14]]){
   box("Body",x,x+2,low,20,8,9,"#762934");
   box("Body",x,x+2,low,low,9,10,"#B25B4A");
 }
 // Ancient fortress icon on the tabard.
 for(let x=-3;x<=3;x++)box("Body",x,x,17,18,10,10,"#C0A06F");
 for(let x of [-3,0,3])box("Body",x,x,19,20,10,10,"#C0A06F");
 for(let x of [-2,2])box("Body",x,x,16,16,10,10,"#C0A06F");
 for(let y of [30,35,40]){box("Body",-7,-5,y,y+1,10,11,"#B8AD9E");box("Body",4,6,y,y+1,10,11,"#B8AD9E")}
 // Rib plates frame (but do not cover) the glowing chest.
 for(let y of [30,34,38]){
   box("Body",-9,-4,y,y+1,10,12,"#AEAAA6");
   box("Body",3,8,y,y+1,10,12,"#AEAAA6");
 }
 // Heavy belts, bolts, and hanging metal chain segments.
 box("Body",-10,10,25,27,8,10,"#6C4031");
 for(let x=-9;x<=9;x+=3){box("Body",x,x+1,26,27,11,12,"#C07B48")}
 for(let i=0;i<10;i++){const x=-10+i*2,y=41-Math.round(2*Math.sin(i/9*Math.PI));box("Body",x,x+1,y,y+1,7,9,i%2?"#A39283":"#6E6562")}
 // Offset shoulder plates and individual prominent bolt heads.
 for(const sx of [-1,1]){
   const a=sx===-1?-15:9,b=sx===-1?-9:15;
   box("Body",a,b,43,45,-7,8,"#6F4840");
   box("Body",a,b,45,46,-7,8,"#AA6540");
   for(const z of [-6,-2,3,7])box("Body",sx===-1?a:a+5,sx===-1?a+1:a+6,45,46,z,z+1,"#C9AE86");
 }
 // Head: rusty forehead plate, moss/fringe, teeth and luminous eyes.
 box("Head",-7,7,55,56,4,8,"#664D4F");
 box("Head",2,7,56,58,4,8,"#9E563A");
 for(let x of [3,6])box("Head",x,x+1,57,58,9,9,"#C4A188");
 for(let x=-7;x<=7;x+=3){
    box("Head",x,x+1,55,57,7,9,"#6E824A");
    box("Head",x,x,53-(Math.abs(x)%3),54,9,10,"#809558");
 }
 for(let x of [-6,-5,3,4])box("Head",x,x,49,51,11,12,"#D4FD4A",1);
 box("Head",-8,-6,49,52,8,10,"#4F654D");
 for(let x of [-5,-2,1,4])box("Jaw",x,x,42,45,11,12,"#D4CDB8");
 // Left arm: leather bands, rust plating, stitches and smaller claw.
 box("Arm_Left",-19,-11,29,31,5,8,"#935331");
 for(let x of [-20,-16,-12])box("Arm_Left",x,x+1,30,31,8,9,"#D19B68");
 for(let y of [23,27,31])box("Arm_Left",-20,-11,y,y+1,6,7,"#70413B");
 for(let x of [-19,-16,-13])box("Arm_Left",x,x+1,19,23,7,9,"#A9AAA0");
 // Right arm: oversized stone gatebreaker with rusted reinforced bands.
 box("Arm_Right",12,26,26,28,-8,9,"#6F4D42");
 box("Arm_Right",12,26,23,24,-8,10,"#B0693F");
 box("Arm_Right",12,26,18,19,-8,10,"#84462F");
 for(let y of [18,23,27])for(let x of [13,18,23,26]){
   box("Arm_Right",x,x+1,y,y+1,11,12,"#D8AF82");
 }
 for(let x of [13,17,21,25])box("Arm_Right",x,x+3,16,19,10,13,"#80797B");
 for(let x of [13,17,21,25])box("Arm_Right",x,x+1,16,17,14,14,"#AC9E9A");
 for(let z of [-7,-3,1,5])box("Arm_Right",12,14,22,23,z,z+2,"#9D6541");
 // Crack lines on the stone gauntlet.
 for(let i=0;i<6;i++)box("Arm_Right",19+(i%2),19+(i%2),28-i,28-i,10,12,"#34353A");
 // Back spikes, buckles, and ribs, separate back joint.
 for(let x of [-9,-3,4,10]){
   box("Back_Spines",x,x+1,42,50,-12,-10,"#9E9A92");
   box("Back_Spines",x,x,50,52,-12,-11,"#D3C8B0");
 }
 for(let y of [31,36,40])box("Back_Spines",-11,11,y,y+1,-12,-11,"#784432");
 // Sturdy leg plates, toe segments and armored joints.
 for(const [parent,center] of [["Leg_Left",-6],["Leg_Right",6]]){
    for(let y of [6,11,19])box(parent,center-5,center+5,y,y+2,5,7,"#955331");
    box(parent,center-4,center+4,14,19,5,7,"#635D60");
    for(let x of [center-4,center,center+4])box(parent,x,x+1,6,8,8,9,"#C2A78E");
    for(let x of [center-4,center,center+4])box(parent,x,x+1,1,3,11,13,"#8A8585");
 }
 // Sapphire/red core geometry: separate emissive material and parent animated.
 box("Core_WeakPoint",-2,2,31,35,12,13,"#F23D57",2);
 box("Core_WeakPoint",-1,1,32,34,14,14,"#FF8090",2);
 box("Core_WeakPoint",0,0,33,33,15,15,"#FFF0DF",2);
 // Register emissive materials; original V1 material remains at index 0.
 doc.materials[0].doubleSided=true;
 doc.materials.push({name:"Yeux_phosphorescents",pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:1},emissiveFactor:[0.32,0.44,0.02],doubleSided:true});
 doc.materials.push({name:"Coeur_corrompu_rouge",pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:.55},emissiveFactor:[.9,.025,.045],doubleSided:true});
 function rgb(hex){const vals=[];for(let p=1;p<7;p+=2){let v=parseInt(hex.slice(p,p+2),16)/255;v=v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);vals.push(Math.round(v*255))}return [...vals,255]}
 function appendBuffer(data){
   const offset=bin.length;
   for(const val of data)bin.push(val);
   while(bin.length%4)bin.push(0);
   return {buffer:0,byteOffset:offset,byteLength:data.length};
 }
 function accessor(data,count,type,componentType,extra={}){
   const ix=doc.bufferViews.length;doc.bufferViews.push(appendBuffer(data));
   const ai=doc.accessors.length;doc.accessors.push({bufferView:ix,componentType,count,type,...extra});return ai;
 }
 function packedF32(arr){const data=new Uint8Array(arr.length*4),dv=new DataView(data.buffer);for(let i=0;i<arr.length;i++)dv.setFloat32(i*4,arr[i],true);return data}
 function packedU32(arr){const data=new Uint8Array(arr.length*4),dv=new DataView(data.buffer);for(let i=0;i<arr.length;i++)dv.setUint32(i*4,arr[i],true);return data}
 let triangles=0,groups=0;
 for(const [key,g] of GROUP){
   const parent=doc.nodes[nodes[g.parent]],pivot=parent.translation||[0,0,0];
   let positions=[],normals=[],colors=[],indices=[];
   function quad(points,normal,c){
     let offset=positions.length/3;
     for(const p of points){positions.push((p[0]-pivot[0]/unit)*unit,(p[1]-pivot[1]/unit)*unit,(p[2]-pivot[2]/unit)*unit);normals.push(...normal);colors.push(...c)}
     indices.push(offset,offset+1,offset+2,offset,offset+2,offset+3);
   }
   for(const [ax,bx,ay,by,az,bz,color] of g.boxes){
     const x0=ax-.5,x1=bx+.5,y0=ay-.5,y1=by+.5,z0=az-.5,z1=bz+.5,c=rgb(color);
     quad([[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]],[0,0,1],c);
     quad([[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0]],[0,0,-1],c);
     quad([[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1]],[1,0,0],c);
     quad([[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]],[-1,0,0],c);
     quad([[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]],[0,1,0],c);
     quad([[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]],[0,-1,0],c);
   }
   if(!positions.length)continue;
   const xyz=packedF32(positions), normal=packedF32(normals), col=Uint8Array.from(colors), idx=packedU32(indices);
   const mm=[],mx=[];for(let k=0;k<3;k++){let a=Infinity,b=-Infinity;for(let i=k;i<positions.length;i+=3){a=Math.min(a,positions[i]);b=Math.max(b,positions[i])}mm.push(a);mx.push(b)}
   const attr={POSITION:accessor(xyz,positions.length/3,"VEC3",5126,{min:mm,max:mx}),NORMAL:accessor(normal,normals.length/3,"VEC3",5126),COLOR_0:accessor(col,colors.length/4,"VEC4",5121,{normalized:true})};
   const mesh=doc.meshes.length;
   doc.meshes.push({name:g.parent+"_Design_V2_"+g.material,primitives:[{attributes:attr,indices:accessor(idx,indices.length,"SCALAR",5125),material:g.material,mode:4}]});
   const ni=doc.nodes.length;doc.nodes.push({name:g.parent+"_DetailV2_"+g.material,mesh});
   if(!parent.children)parent.children=[];parent.children.push(ni);
   triangles+=indices.length/3;groups++;
 }
 doc.asset.generator="Cube Family - Titan siege V2 (V1 rig preserved + decorative voxel meshes)";
 doc.extras={source_version:"v1",reference_height_m:14,design_version:2,source_script:"generer_titan_v2.mjs",note:"Visual references and orthographic drawing are conceptual; 24m scale label on illustration is incorrect."};
 doc.buffers[0].byteLength=bin.length;
 const json=JSON.stringify(doc);
 const raw=new Uint8Array(json.length+((4-json.length%4)%4));for(let i=0;i<json.length;i++)raw[i]=json.charCodeAt(i);raw.fill(32,json.length);
 const total=28+raw.length+bin.length,output=new Uint8Array(total),header=new DataView(output.buffer);
 output.set([103,108,84,70],0);header.setUint32(4,2,true);header.setUint32(8,total,true);
 header.setUint32(12,raw.length,true);output.set([74,83,79,78],16);output.set(raw,20);
 const binHeader=20+raw.length;header.setUint32(binHeader,bin.length,true);output.set([66,73,78,0],binHeader+4);output.set(bin,binHeader+8);
 if(header.getUint32(8,true)!==output.length||doc.nodes.length<20||doc.animations.map(a=>a.name).join("|")!=="Idle|Walk|Smash|Roar|Death")throw Error("V2 output failed validation");
 return {bytes:output,stats:{nodes:doc.nodes.length,meshes:doc.meshes.length,animations:doc.animations.map(a=>a.name),design_boxes:[...GROUP.values()].reduce((a,g)=>a+g.boxes.length,0),added_triangles:triangles,added_meshes:groups}};
}
const source=readFileSync(new URL("./titan_zombie_siege_v1.glb",import.meta.url));
const {bytes,stats}=upgradeV1(new Uint8Array(source));
writeFileSync(new URL("./titan_zombie_siege_v2.glb",import.meta.url),bytes);
process.stdout.write(JSON.stringify({size:bytes.length,...stats},null,2)+"\n");
