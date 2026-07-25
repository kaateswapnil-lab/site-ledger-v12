import { useState, useMemo, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts";

/* ═══════════ DESIGN TOKENS ═══════════ */
const DEF_SETTINGS={theme:"dark",accent:"#F59E0B",font:"monospace",fontSize:14,logoUrl:""};
const getSettings=()=>{try{return {...DEF_SETTINGS,...JSON.parse(localStorage.getItem("sl_settings")||"{}")};}catch{return DEF_SETTINGS;}};
const saveSettings=s=>localStorage.setItem("sl_settings",JSON.stringify(s));
const loadData=()=>{try{const d=localStorage.getItem("sl_data");return d?JSON.parse(d):null;}catch{return null;}};
const persistData=d=>localStorage.setItem("sl_data",JSON.stringify(d));

const mkColors=accent=>({
  or:accent,tl:"#2DD4BF",rd:"#F87171",pu:"#A78BFA",
  gn:"#34D399",dk:"#060C1A",cd:"#0E1628",br:"#1E2D45",
  gr:"#4B6180",bl:"#60A5FA",si:"#94A3B8",
  bg1:"#060C1A",bg2:"#0A1223",bg3:"#0E1628",
});
let C=mkColors(DEF_SETTINGS.accent);
const PC=[C.or,C.tl,C.rd,C.pu,C.gn,C.bl,"#FB923C","#E879F9"];
const BD="1px solid #1E2D45";
const G=(c,o=0.15)=>`rgba(${parseInt(c.slice(1,3),16)},${parseInt(c.slice(3,5),16)},${parseInt(c.slice(5,7),16)},${o})`;
const INR=n=>"₹ "+Number(n||0).toLocaleString("en-IN");
const uid=()=>"x"+Date.now()+Math.floor(Math.random()*9999);
const dDiff=d=>Math.max(0,Math.floor((new Date("2025-03-15")-new Date(d||"2025-01-01"))/864e5));
const aBkt=d=>d<=30?"0–30 Days":d<=60?"31–60 Days":d<=90?"61–90 Days":"90+ Days";
const pSt=(pd,tot)=>pd>=tot&&tot>0?"Paid":pd>0?"Partial":"Unpaid";
const pCol=s=>s==="Paid"?C.gn:s==="Partial"?C.or:C.rd;
const DAYS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
/* ── Financial year helpers ── */
const getFY=(d)=>{const dt=d?new Date(d+"T00:00:00"):new Date();const y=dt.getFullYear();const m=dt.getMonth();return m>=3?y:y-1;};
const getFYStr=(d)=>{const fy=getFY(d);return String(fy).slice(2)+"-"+String(fy+1).slice(2);};
/* Next doc number: TYPE/001/25-26 */
const nextDocNo=(prefix,arr,field)=>{const fy=getFYStr();const cur=(arr||[]).filter(x=>(x[field]||"").includes("/"+fy));const nums=cur.map(x=>parseInt((x[field]||"").split("/")[1])||0);const n=(nums.length?Math.max(...nums):0)+1;return prefix+"/"+String(n).padStart(3,"0")+"/"+fy;};
/* Number to words (Indian system) */
const numWords=(n)=>{if(!n)return"Zero";const a=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];const b=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];const cr=Math.floor(n/10000000),lk=Math.floor((n%10000000)/100000),th=Math.floor((n%100000)/1000),hu=Math.floor((n%1000)/100),te=n%100;const w2=(x)=>x<20?a[x]:b[Math.floor(x/10)]+(x%10?" "+a[x%10]:"");const parts=[];if(cr)parts.push(w2(cr)+" Crore");if(lk)parts.push(w2(lk)+" Lakh");if(th)parts.push(w2(th)+" Thousand");if(hu)parts.push(a[hu]+" Hundred");if(te)parts.push(w2(te));return parts.join(" ")+" Only";};
const inPeriod=(d,f,t)=>{if(!d)return false;if(f&&d<f)return false;if(t&&d>t)return false;return true;};
const fmtDate=d=>{if(!d)return"";try{return new Date(d+"T00:00:00").toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});}catch{return d;}};

/* ── Calculations ── */
const calcLI=items=>{
  if(!items||!items.length)return{rows:[],basic:0,gstAmt:0,total:0,discount:0,netBasic:0};
  const rows=items.map(it=>{const gross=(it.qty||0)*(it.rate||0),disc=gross*(it.disc||0)/100,b=gross-disc,g=b*(it.gst||0)/100;return{...it,gross,disc,b,g,tot:b+g};});
  const basic=rows.reduce((a,r)=>a+r.b,0),gstAmt=rows.reduce((a,r)=>a+r.g,0),discount=rows.reduce((a,r)=>a+r.disc,0);
  return{rows,basic,gstAmt,total:basic+gstAmt,discount,netBasic:basic};
};
const cS=s=>{
  if(s.lineItems&&s.lineItems.length){const li=calcLI(s.lineItems);const td=li.basic*(s.tds||0)/100;return{g:li.gstAmt,gross:li.total,td,net:li.total-td,basic:li.basic,discount:li.discount};}
  const b=(s.basic||0),disc=b*(s.discount||0)/100,nb=b-disc,g=nb*(s.gst||0)/100,td=nb*(s.tds||0)/100;
  return{g,gross:nb+g,td,net:nb+g-td,basic:nb,discount:disc};
};
const cP=p=>{const b=(p.qty||0)*(p.rate||0);return{b,ga:b*(p.gst||0)/100,tot:b*(1+(p.gst||0)/100)};};
const cW=w=>{const e=Math.round((w.basic||0)*(w.present||0)/Math.max(w.days||1,1)),h=Math.round(e*.4),gr=e+h;const pf=Math.round(e*.12),esi=Math.round(gr*.0075),pt=200,lwf=25,tds=gr>50000?Math.round((gr-50000)*.05):0;const ded=pf+esi+pt+lwf+tds;return{e,h,gr,pf,esi,pt,lwf,tds,ded,net:gr-ded};};
const getBankBal=(txns,banks,id)=>{const b=banks.find(x=>x.id===id);return txns.filter(t=>t.bankId===id).reduce((a,t)=>a+(t.type==="Cr"?t.amt:-t.amt),(b?b.openBal:0));};
const getPettyBal=(txns,books,id)=>{const b=books.find(x=>x.id===id);return txns.filter(t=>t.pettyId===id).reduce((a,t)=>a+(t.type==="Cr"?t.amt:-t.amt),(b?b.openBal:0));};

/* ── Roles ── */
const ALL_MODS=["dash","dpr","sales","purchase","hr","inventory","accounts","reports","masters","settings","calc"];
const ROLE_ACCESS={
  Admin:ALL_MODS,
  Manager:["dash","dpr","sales","purchase","hr","inventory","accounts","reports","settings"],
  Accountant:["dash","sales","purchase","accounts","reports"],
  Supervisor:["dash","dpr","hr","inventory","purchase"],
  Viewer:["dash","sales","reports"],
};

/* ══════════ MASTER DATA ══════════ */
const INIT_M={
  sites:[{id:"s1",name:"NH-48 Highway Bridge",client:"NHAI",loc:"Delhi-Mumbai Expy",start:"2025-01-01",status:"Active"},{id:"s2",name:"Rajnagar Residential",client:"Rajnagar Builders",loc:"Pune",start:"2025-01-05",status:"Active"},{id:"s3",name:"MIDC Industrial Shed",client:"MIDC Authority",loc:"Nashik",start:"2025-01-10",status:"Active"}],
  clients:[{id:"c1",name:"NHAI",contact:"Mr. Sharma",phone:"9876543210",gst:"07AAKFN0968H1Z7",billTo:"New Delhi — NHAI HQ",shipTo:"Delhi-Mumbai Expressway, NH-48 Site"},{id:"c2",name:"Rajnagar Builders",contact:"Mr. Patel",phone:"9823456780",gst:"27AAKFN1234H1Z5",billTo:"Pune — Rajnagar Office",shipTo:"Rajnagar Residential Site, Pune"},{id:"c3",name:"MIDC Authority",contact:"Mr. Desai",phone:"9712345678",gst:"27AAKFN5678H1Z2",billTo:"Nashik — MIDC Office",shipTo:"MIDC Industrial Zone, Nashik"}],
  vendors:[{id:"v1",name:"Steel India Ltd",contact:"Mr. Kumar",phone:"9856341200",cat:"Steel",gst:"27AAACS1234H1Z5",terms:"Credit 30d"},{id:"v2",name:"ACC Cement",contact:"Ms. Nair",phone:"9745632100",cat:"Cement",gst:"27AAACS5678H1Z2",terms:"Advance"},{id:"v3",name:"Tata Steel",contact:"Mr. Singh",phone:"9634521007",cat:"Steel",gst:"21AAACT1234H1Z3",terms:"Credit 45d"},{id:"v4",name:"UltraTech",contact:"Mr. Roy",phone:"9523410098",cat:"Cement",gst:"27AAACT5678H1Z4",terms:"Credit 30d"}],
  items:[{id:"i1",name:"TMT Steel 12mm",unit:"MT",cat:"Steel",hsn:"72142000",rate:58000},{id:"i2",name:"OPC 53 Cement",unit:"Bags",cat:"Cement",hsn:"25232910",rate:380},{id:"i3",name:"PPC Cement",unit:"Bags",cat:"Cement",hsn:"25232100",rate:370},{id:"i4",name:"20mm Aggregate",unit:"CFT",cat:"Aggregate",hsn:"25171000",rate:75},{id:"i5",name:"River Sand",unit:"CFT",cat:"Sand",hsn:"26209090",rate:55},{id:"i6",name:"Structural Steel",unit:"MT",cat:"Steel",hsn:"73089090",rate:72000}],
  services:[{id:"sv1",name:"Foundation Work",unit:"SqM",cat:"Civil",sac:"995411",rate:1200,gst:18},{id:"sv2",name:"Concrete Casting",unit:"CuM",cat:"Civil",sac:"995412",rate:4500,gst:18},{id:"sv3",name:"Steel Fabrication",unit:"MT",cat:"Steel",sac:"998726",rate:12000,gst:18}],
  labours:[{id:"l1",name:"Ramesh Kumar",role:"Supervisor",siteId:"s1",phone:"9834512300",wage:1200,pf:true},{id:"l2",name:"Suresh Patel",role:"Mason",siteId:"s1",phone:"9723401100",wage:750,pf:false},{id:"l3",name:"Priya Nair",role:"Site Engineer",siteId:"s2",phone:"9612390087",wage:1800,pf:true},{id:"l4",name:"Kiran Bhat",role:"Welder",siteId:"s3",phone:"9501289976",wage:950,pf:false},{id:"l5",name:"Sanjay Gupta",role:"Site Engineer",siteId:"s3",phone:"9890123456",wage:1700,pf:true}],
  machinery:[{id:"m1",name:"JCB Excavator",type:"Earthwork",owner:"Owned",reg:"MH-12-AB-1234",hsn:"84295200",rate:9000,locType:"site",locId:"s1",status:"Active"},{id:"m2",name:"Concrete Mixer",type:"Concreting",owner:"Owned",reg:"MH-12-CD-5678",hsn:"84749000",rate:2500,locType:"godown",locId:"g1",status:"Active"},{id:"m3",name:"Tower Crane 30T",type:"Lifting",owner:"Hired",reg:"MH-12-EF-9012",hsn:"84261200",rate:19000,locType:"site",locId:"s2",status:"Active"}],
  banks:[{id:"b1",name:"HDFC Current",accNo:"50100123456789",ifsc:"HDFC0001234",branch:"Andheri West",openBal:500000},{id:"b2",name:"SBI OD Account",accNo:"123456789012",ifsc:"SBIN0001234",branch:"Fort Mumbai",openBal:200000}],
  pettyCash:[{id:"p1",name:"Head Office Petty",keeper:"Admin",openBal:25000},{id:"p2",name:"Site S1 Petty",keeper:"Ramesh Kumar",openBal:10000},{id:"p3",name:"Site S2 Petty",keeper:"Priya Nair",openBal:8000}],
  godowns:[{id:"g1",name:"Central Godown Mumbai",loc:"Andheri East",keeper:"Store Manager"},{id:"g2",name:"Pune Yard",loc:"Hadapsar Pune",keeper:"Yard Incharge"}],
  users:[{id:"u1",name:"Admin User",username:"admin",password:"admin123",role:"Admin",moduleAccess:ALL_MODS},{id:"u2",name:"Site Manager",username:"manager",password:"mgr123",role:"Manager",moduleAccess:["dash","dpr","sales","purchase","hr","inventory","accounts","reports"]},{id:"u3",name:"Accountant",username:"acc",password:"acc123",role:"Accountant",moduleAccess:["dash","sales","purchase","accounts","reports"]},{id:"u4",name:"Ramesh Kumar",username:"ramesh",password:"sup123",role:"Supervisor",moduleAccess:["dash","dpr","hr","inventory","purchase"]},{id:"u5",name:"View Only",username:"view",password:"view123",role:"Viewer",moduleAccess:["dash","sales","reports"]}],
  expenseCats:["Labour","Machinery","Transport","Materials","Admin","Safety","Misc","Subcontract","Utilities","Fuel"],
  company:{name:"Your Construction Co.",addr:"123 Contractor Lane Mumbai 400001",gst:"27AAAYC1234H1Z5",phone:"9800000000",email:"info@yourco.com",bank:"HDFC Bank",acc:"50100123456789",ifsc:"HDFC0001234",branch:"Andheri West",sign:"Authorised Signatory",logoUrl:""},
};

/* ══════════ TRANSACTION DATA ══════════ */
const INIT_D={
  sales:[
    {id:"sl1",date:"2025-01-05",siteId:"s1",soId:"so1",client:"NHAI",inv:"INV-001",desc:"Foundation Work",tds:2,paidAmt:1850000,lineItems:[{desc:"Foundation Work Zone A",hsn:"995411",qty:1540,unit:"SqM",rate:1200,gst:18,disc:0}]},
    {id:"sl2",date:"2025-01-20",siteId:"s1",soId:"so1",client:"NHAI",inv:"INV-002",desc:"Pillar Erection",tds:2,paidAmt:1000000,lineItems:[{desc:"Pillar Erection",hsn:"995411",qty:200,unit:"SqM",rate:6500,gst:18,disc:0},{desc:"Concrete Casting",hsn:"995412",qty:125,unit:"CuM",rate:4500,gst:18,disc:0}]},
    {id:"sl3",date:"2025-02-10",siteId:"s2",soId:"so2",client:"Rajnagar Builders",inv:"INV-003",desc:"Foundation Plinth",tds:2,paidAmt:3200000,lineItems:[{desc:"Foundation Plinth Work",hsn:"995411",qty:2667,unit:"SqM",rate:1200,gst:12,disc:0}]},
    {id:"sl4",date:"2025-02-15",siteId:"s3",client:"MIDC Authority",inv:"INV-004",desc:"Site Preparation",tds:2,paidAmt:950000,lineItems:[{desc:"Site Preparation",hsn:"995411",qty:792,unit:"SqM",rate:1200,gst:18,disc:0}]},
  ],
  saleOrders:[
    {id:"so1",date:"2025-01-01",siteId:"s1",client:"NHAI",desc:"NH-48 Full Contract",tds:2,status:"Active",convertedInvs:[],lineItems:[{desc:"Foundation Work",hsn:"995411",qty:5000,unit:"SqM",rate:1200,gst:18,disc:0},{desc:"Concrete Casting",hsn:"995412",qty:500,unit:"CuM",rate:4500,gst:18,disc:0},{desc:"Steel Fabrication",hsn:"998726",qty:100,unit:"MT",rate:12000,gst:18,disc:0}]},
    {id:"so2",date:"2025-01-05",siteId:"s2",client:"Rajnagar Builders",desc:"Residential Block A",tds:2,status:"Active",convertedInvs:[],lineItems:[{desc:"Foundation Plinth",hsn:"995411",qty:4167,unit:"SqM",rate:1200,gst:12,disc:0},{desc:"Concrete Casting",hsn:"995412",qty:200,unit:"CuM",rate:4500,gst:12,disc:0}]},
  ],
  estimates:[
    {id:"est1",date:"2025-01-15",siteId:"s1",client:"NHAI",estNo:"EST-001",desc:"Phase 2 Estimate",validTill:"2025-03-15",status:"Sent",lineItems:[{desc:"Pile Foundation",hsn:"995411",qty:2000,unit:"SqM",rate:1500,gst:18,disc:5}]},
  ],
  proforma:[
    {id:"pf1",date:"2025-02-01",siteId:"s2",client:"Rajnagar Builders",pfNo:"PRO-001",desc:"Block B Proforma",validTill:"2025-04-01",lineItems:[{desc:"RCC Work Block B",hsn:"995412",qty:3000,unit:"SqM",rate:1800,gst:18,disc:0}]},
  ],
  debitNotes:[
    {id:"dn1",date:"2025-02-20",siteId:"s1",client:"NHAI",dnNo:"DN-001",invRef:"INV-001",reason:"Price revision — foundation extra depth",lineItems:[{desc:"Extra Depth Foundation Work",hsn:"995411",qty:100,unit:"SqM",rate:200,gst:18,disc:0}],paidAmt:0},
  ],
  creditNotes:[
    {id:"cn1",date:"2025-02-22",siteId:"s1",vendor:"Steel India Ltd",cnNo:"CN-001",billRef:"PU-001",reason:"Quality rejection — 5MT TMT returned",lineItems:[{item:"TMT Steel 12mm",hsn:"72142000",qty:5,unit:"MT",rate:58000,gst:18,disc:0}],paidAmt:0},
  ],
  purchases:[{id:"pu1",date:"2025-01-03",siteId:"s1",poId:"po1",vendor:"Steel India Ltd",item:"TMT Steel 12mm",hsn:"72142000",qty:50,unit:"MT",rate:58000,gst:18,paidAmt:290000,itcClaimed:true},{id:"pu2",date:"2025-01-08",siteId:"s1",vendor:"ACC Cement",item:"OPC 53 Cement",hsn:"25232910",qty:2000,unit:"Bags",rate:380,gst:28,paidAmt:0,itcClaimed:false},{id:"pu3",date:"2025-01-05",siteId:"s2",poId:"po2",vendor:"UltraTech",item:"PPC Cement",hsn:"25232100",qty:3000,unit:"Bags",rate:370,gst:28,paidAmt:1110000,itcClaimed:true}],
  purchaseOrders:[
    {id:"po1",date:"2025-01-01",siteId:"s1",vendor:"Steel India Ltd",desc:"TMT and Structural Steel Supply",status:"Active",lineItems:[{item:"TMT Steel 12mm",hsn:"72142000",qty:150,unit:"MT",rate:58000,gst:18,disc:0},{item:"Structural Steel",hsn:"73089090",qty:50,unit:"MT",rate:72000,gst:18,disc:0}]},
    {id:"po2",date:"2025-01-03",siteId:"s2",vendor:"UltraTech",desc:"PPC Cement Annual Contract",status:"Active",lineItems:[{item:"PPC Cement",hsn:"25232100",qty:5000,unit:"Bags",rate:370,gst:28,disc:0}]},
  ],
  expenses:[{id:"ex1",date:"2025-01-05",siteId:"s1",cat:"Labour",hsn:"",desc:"Skilled Labour x30",amt:180000,paidAmt:180000,itcClaimed:false},{id:"ex2",date:"2025-01-10",siteId:"s1",cat:"Machinery",hsn:"",desc:"JCB Hire 5 days",amt:45000,paidAmt:0,itcClaimed:false},{id:"ex3",date:"2025-01-08",siteId:"s2",cat:"Labour",hsn:"",desc:"Labour x40",amt:240000,paidAmt:240000,itcClaimed:false},{id:"ex4",date:"2025-02-01",siteId:"s3",cat:"Transport",hsn:"",desc:"Material Transport",amt:35000,paidAmt:0,itcClaimed:false}],
  payroll:[{id:"pr1",name:"Ramesh Kumar",role:"Supervisor",siteId:"s1",days:26,present:26,basic:45000,month:"2025-02",paidAmt:0},{id:"pr2",name:"Suresh Patel",role:"Mason",siteId:"s1",days:26,present:24,basic:28000,month:"2025-02",paidAmt:0},{id:"pr3",name:"Priya Nair",role:"Site Engineer",siteId:"s2",days:26,present:26,basic:55000,month:"2025-02",paidAmt:55000}],
  attendance:[{id:"a1",date:"2025-02-17",siteId:"s1",name:"Ramesh Kumar",role:"Supervisor",present:true,ot:2},{id:"a2",date:"2025-02-17",siteId:"s1",name:"Suresh Patel",role:"Mason",present:true,ot:0},{id:"a3",date:"2025-02-17",siteId:"s2",name:"Priya Nair",role:"Site Engineer",present:true,ot:0},{id:"a4",date:"2025-02-18",siteId:"s1",name:"Ramesh Kumar",role:"Supervisor",present:true,ot:0},{id:"a5",date:"2025-02-18",siteId:"s1",name:"Suresh Patel",role:"Mason",present:false,ot:0}],
  inventory:[{id:"iv1",locType:"site",locId:"s1",item:"TMT 12mm",unit:"MT",open:20,recv:50,used:55,close:15,min:10,rate:58000},{id:"iv2",locType:"site",locId:"s1",item:"OPC 53",unit:"Bags",open:500,recv:2000,used:1800,close:700,min:300,rate:380},{id:"iv3",locType:"godown",locId:"g1",item:"TMT 12mm",unit:"MT",open:100,recv:200,used:50,close:250,min:50,rate:58000},{id:"iv4",locType:"godown",locId:"g1",item:"PPC Cement",unit:"Bags",open:1000,recv:5000,used:2000,close:4000,min:500,rate:370},{id:"iv5",locType:"site",locId:"s2",item:"PPC Cement",unit:"Bags",open:200,recv:3000,used:2600,close:600,min:400,rate:370}],
  bankTxns:[{id:"bt1",bankId:"b1",date:"2025-01-05",desc:"NHAI Payment INV-001",type:"Cr",amt:1850000,ref:"CHQ-1001"},{id:"bt2",bankId:"b1",date:"2025-01-08",desc:"Steel India Part Payment",type:"Dr",amt:290000,ref:"RTGS-001"},{id:"bt3",bankId:"b2",date:"2025-01-10",desc:"Site Expenses Transfer",type:"Dr",amt:180000,ref:"CHQ-2001"},{id:"bt4",bankId:"b1",date:"2025-01-20",desc:"NHAI Part Receipt INV-002",type:"Cr",amt:1000000,ref:"RTGS-002"}],
  pettyTxns:[{id:"pt1",pettyId:"p1",date:"2025-02-15",desc:"Tea and snacks",type:"Dr",amt:800,by:"Ramesh"},{id:"pt2",pettyId:"p2",date:"2025-02-16",desc:"Hardware bolts",type:"Dr",amt:1250,by:"Suresh"},{id:"pt3",pettyId:"p1",date:"2025-02-16",desc:"Office supplies",type:"Dr",amt:2200,by:"Admin"},{id:"pt4",pettyId:"p1",date:"2025-01-15",desc:"Cash from HDFC",type:"Cr",amt:25000,by:"Admin"}],
  vouchers:[{id:"vo1",date:"2025-01-08",vtype:"out",party:"Steel India Ltd",partyType:"vendor",siteId:"s1",amt:290000,via:"bank",accountId:"b1",desc:"Part payment TMT steel",ref:"RTGS-001"},{id:"vo2",date:"2025-01-05",vtype:"in",party:"NHAI",partyType:"client",siteId:"s1",amt:1850000,via:"bank",accountId:"b1",desc:"INV-001 receipt",ref:"CHQ-1001"}],
  contraEntries:[{id:"ce1",date:"2025-01-15",fromType:"bank",fromId:"b1",toType:"petty",toId:"p1",amt:25000,desc:"Cash withdrawal for office"},{id:"ce2",date:"2025-02-01",fromType:"bank",fromId:"b1",toType:"bank",toId:"b2",amt:100000,desc:"Transfer to SBI for site"}],
  loans:[{id:"ln1",date:"2025-01-01",loanType:"borrowed",party:"Rajesh Shah",partyType:"Director",amt:5000000,interest:12,desc:"Working capital loan",status:"Active",txns:[{date:"2025-01-01",type:"received",amt:5000000,desc:"Loan received"},{date:"2025-02-01",type:"interest",amt:50000,desc:"Interest Feb"}]},{id:"ln2",date:"2025-01-15",loanType:"given",party:"Ramesh Kumar",partyType:"Employee",amt:50000,interest:0,desc:"Salary advance",status:"Active",txns:[{date:"2025-01-15",type:"given",amt:50000,desc:"Advance given"},{date:"2025-02-28",type:"recovery",amt:10000,desc:"Recovery from salary"}]}],
  stockTransfers:[{id:"st1",date:"2025-01-10",fromType:"godown",fromId:"g1",toType:"site",toId:"s1",item:"TMT 12mm",qty:50,unit:"MT",rate:58000,desc:"Issue to site S1"}],
  materialReceipts:[{id:"mr1",date:"2025-01-03",locType:"site",locId:"s1",siteId:"s1",vendor:"Steel India Ltd",item:"TMT 12mm",qty:50,unit:"MT",rate:58000,gst:18,poId:"po1",grnNo:"GRN-001",remarks:"Good condition"}],
  dpr:[{id:"dp1",date:"2025-02-17",siteId:"s1",soId:"so1",supervisor:"Ramesh Kumar",workers:30,weather:"Clear",clientInstructions:"Proceed with Zone A foundation per revised drawings",entries:[{type:"service",name:"Foundation Work",soLineIdx:0,completedQty:45,unit:"SqM",remarks:"Zone A complete"},{type:"item",name:"TMT 12mm",soLineIdx:null,completedQty:2.5,unit:"MT",remarks:"Consumed for columns"}],remarks:"Good progress on schedule"}],
  otherIncome:[
    {id:"oi1",date:"2025-01-20",siteId:"s1",cat:"Scrap Sale",desc:"MS scrap iron sold",amt:18500,via:"bank",accountId:"b1",ref:""},
    {id:"oi2",date:"2025-02-05",siteId:"s2",cat:"Labour Outsourced",desc:"Labour provided to subcontractor",amt:45000,via:"petty",accountId:"p1",ref:""},
  ],
  cheques:[
    {id:"ch1",date:"2025-01-10",type:"received",chequeNo:"CHQ-4521",bankId:"b1",party:"NHAI",amt:1850000,dueDate:"2025-01-15",status:"Cleared",desc:"INV-001 receipt"},
    {id:"ch2",date:"2025-01-22",type:"issued",chequeNo:"CHQ-2201",bankId:"b1",party:"Steel India Ltd",amt:290000,dueDate:"2025-01-28",status:"Presented",desc:"TMT steel part payment"},
    {id:"ch3",date:"2025-02-05",type:"received",chequeNo:"CHQ-6710",bankId:"b2",party:"Rajnagar Builders",amt:500000,dueDate:"2025-03-10",status:"Pending",desc:"INV-003 advance"},
  ],
  tdsTcs:[
    {id:"tt1",date:"2025-01-05",txnType:"tds",direction:"receivable",party:"NHAI",partyType:"client",section:"194C",rate:2,baseAmt:1850000,taxAmt:37000,refInv:"INV-001",status:"Deducted",challNo:""},
    {id:"tt2",date:"2025-01-20",txnType:"tds",direction:"receivable",party:"NHAI",partyType:"client",section:"194C",rate:2,baseAmt:2200000,taxAmt:44000,refInv:"INV-002",status:"Deducted",challNo:""},
    {id:"tt3",date:"2025-01-08",txnType:"tds",direction:"payable",party:"Steel India Ltd",partyType:"vendor",section:"194Q",rate:0.1,baseAmt:290000,taxAmt:290,refInv:"PU-001",status:"Pending",challNo:""},
  ],
};

/* ══════════ PRINT HELPER ══════════ */
const openPrint=(html,title="Document")=>{
  try{const blob=new Blob([html],{type:"text/html"});const url=URL.createObjectURL(blob);const w=window.open(url,"_blank","width=960,height=750");if(!w)alert("Allow popups for printing.");}catch(e){console.error(e);}
};
const printWrapper=(content,title,co)=>`<!DOCTYPE html><html><head><meta charset=utf-8><title>${title}</title><style>body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:0}@media print{.noprint{display:none}}</style></head><body>${content}<div class=noprint style="text-align:center;padding:16px;background:#f8fafc;border-top:1px solid #e2e8f0;margin-top:20px"><button onclick="window.print()" style="background:#F59E0B;color:#000;border:none;padding:10px 28px;border-radius:6px;font-weight:700;font-size:13px;cursor:pointer;margin-right:10px">Print / Save PDF</button><button onclick="window.close()" style="background:#e2e8f0;color:#333;border:none;padding:10px 20px;border-radius:6px;font-weight:700;cursor:pointer">Close</button></div></body></html>`;

const genInv=(sale,co,cl,opts={})=>{
  const c=cS(sale);const n=v=>Number(v||0).toLocaleString("en-IN");const st=pSt(sale.paidAmt||0,c.net);
  const docType=opts.isProforma?"PROFORMA INVOICE":opts.isDebit?"DEBIT NOTE":opts.isEstimate?"ESTIMATE / QUOTATION":"TAX INVOICE";
  const docNo=sale.inv||sale.pfNo||sale.estNo||sale.dnNo||"—";
  const liRows=(sale.lineItems||[{desc:sale.desc,hsn:"",qty:1,unit:"Lump",rate:sale.basic||0,gst:sale.gst||18,disc:0}]).map(it=>{
    const gr=(it.qty||0)*(it.rate||0),d=gr*(it.disc||0)/100,b=gr-d,g=b*(it.gst||0)/100;
    return "<tr><td>"+(it.desc||it.item||"")+"</td><td>"+(it.hsn||"—")+"</td><td style=\"text-align:right\">"+it.qty+" "+it.unit+"</td><td style=\"text-align:right\">"+n(it.rate)+"</td><td style=\"text-align:center\">"+(it.disc||0)+"%</td><td style=\"text-align:right\">"+n(b)+"</td><td style=\"text-align:center\">"+it.gst+"%</td><td style=\"text-align:right\">"+n(g)+"</td><td style=\"text-align:right\">"+n(b+g)+"</td></tr>";
  }).join("");
  const abstractHtmlInline=opts.soAbstract?("<div style=\"margin:0 28px 14px;border:2px solid #F59E0B;border-radius:8px;overflow:hidden\"><div style=\"background:#F59E0B;color:#060C1A;padding:8px 14px;font-weight:700;font-size:11px\">RUNNING ACCOUNT ABSTRACT</div><table style=\"width:100%;border-collapse:collapse\"><thead><tr><th style=\"padding:6px 10px;background:#f8fafc;font-size:10px;text-align:left\">Item / Service</th><th style=\"padding:6px 10px;background:#f8fafc;font-size:10px;text-align:right\">Est Qty</th><th style=\"padding:6px 10px;background:#f8fafc;font-size:10px;text-align:right\">Completed</th><th style=\"padding:6px 10px;background:#f8fafc;font-size:10px;text-align:right\">Prev Billed</th><th style=\"padding:6px 10px;background:#f8fafc;font-size:10px;text-align:right\">This Bill</th><th style=\"padding:6px 10px;background:#f8fafc;font-size:10px;text-align:right\">Balance</th></tr></thead><tbody>"+opts.soAbstract.map(r=>"<tr><td style=\"padding:5px 10px;border-bottom:1px solid #f1f5f9\">"+r.desc+"</td><td style=\"padding:5px 10px;border-bottom:1px solid #f1f5f9;text-align:right\">"+r.estimated+" "+r.unit+"</td><td style=\"padding:5px 10px;border-bottom:1px solid #f1f5f9;text-align:right;color:#34D399;font-weight:600\">"+r.completed+" "+r.unit+"</td><td style=\"padding:5px 10px;border-bottom:1px solid #f1f5f9;text-align:right\">"+r.prevBilled+" "+r.unit+"</td><td style=\"padding:5px 10px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:700\">"+r.thisBill+" "+r.unit+"</td><td style=\"padding:5px 10px;border-bottom:1px solid #f1f5f9;text-align:right;color:#F87171\">"+r.balance+" "+r.unit+"</td></tr>").join("")+"</tbody></table></div>"):"";
  const logoHtml=co.logoUrl?("<img src=\""+co.logoUrl+"\" style=\"height:40px;margin-bottom:4px;display:block\">"):"";
  const badgeHtml=(!opts.isEstimate&&!opts.isProforma)?("<span class=badge>"+st+"</span>"):"";
  const statusHtml=(!opts.isEstimate&&!opts.isProforma)?("<p style=\"color:"+pCol(st)+";font-weight:700\">"+st+"</p>"):("<p style=\"color:#64748b\">"+( sale.status||"Draft")+"</p>");
  const discHtml=c.discount>0?("<div class=sr><span>Gross Value</span><span>Rs "+n(c.basic+c.discount)+"</span></div><div class=sr style=\"color:#34D399\"><span>Less: Discount</span><span>- Rs "+n(c.discount)+"</span></div>"):"";
  const tdsHtml=(!opts.isEstimate&&!opts.isProforma)?("<div class=sr style=\"color:#F87171\"><span>Less TDS @"+(sale.tds||0)+"%</span><span>- Rs "+n(c.td)+"</span></div>"):"";
  const payHtml=(!opts.isEstimate&&!opts.isProforma)?("<div class=sr style=\"color:#34D399\"><span>Received</span><span>Rs "+n(sale.paidAmt||0)+"</span></div><div class=sr style=\"color:#F87171;font-weight:bold\"><span>Balance Due</span><span>Rs "+n(Math.max(0,c.net-(sale.paidAmt||0)))+"</span></div>"):"";
  const netLabel=opts.isEstimate?"NET ESTIMATE":opts.isProforma?"PROFORMA AMOUNT":"NET PAYABLE";
  const netAmt=opts.isEstimate||opts.isProforma?c.gross:c.net;
  const amtWords=opts.isEstimate||opts.isProforma?"":("<div style=\"padding:8px 28px 4px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px\"><b>Amount in Words:</b> Rupees "+numWords(Math.round(netAmt))+"</div>");
  const validHtml=(opts.isEstimate||opts.isProforma)?("p."+fmtDate(sale.validTill||"")):"";
  /* GST bifurcation */
  const hsnMap={};(sale.lineItems||[]).forEach(function(it){const k=(it.hsn||it.sac||"N/A")+"|"+(it.gst||0);const b=(it.qty||0)*(it.rate||0)*(1-(it.disc||0)/100);const g=b*(it.gst||0)/100;if(!hsnMap[k])hsnMap[k]={hsn:it.hsn||it.sac||"N/A",desc:(it.desc||it.item||"").slice(0,30),gstRate:it.gst||0,taxable:0,cgst:0,sgst:0};hsnMap[k].taxable+=b;hsnMap[k].cgst+=g/2;hsnMap[k].sgst+=g/2;});
  const gstRows=Object.values(hsnMap).map(function(r){return "<tr><td>"+r.hsn+"</td><td>"+r.desc+"</td><td style=\"text-align:right\">"+n(r.taxable)+"</td><td style=\"text-align:center\">"+r.gstRate+"%</td><td style=\"text-align:right\">"+n(r.cgst)+"</td><td style=\"text-align:right\">"+n(r.sgst)+"</td><td style=\"text-align:right\">"+n(r.cgst+r.sgst)+"</td></tr>";}).join("");
  const gstTable=(!opts.isEstimate&&!opts.isProforma&&Object.keys(hsnMap).length>0)?("<div style=\"margin:0 28px 14px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden\"><div style=\"background:#060C1A;color:#F59E0B;padding:7px 14px;font-size:10px;font-weight:700\">GST BIFURCATION (HSN/SAC WISE)</div><table style=\"width:100%;border-collapse:collapse;font-size:11px\"><thead><tr style=\"background:#f8fafc\"><th style=\"padding:5px 8px\">HSN/SAC</th><th style=\"padding:5px 8px\">Description</th><th style=\"padding:5px 8px;text-align:right\">Taxable</th><th style=\"padding:5px 8px;text-align:center\">Rate</th><th style=\"padding:5px 8px;text-align:right\">CGST</th><th style=\"padding:5px 8px;text-align:right\">SGST</th><th style=\"padding:5px 8px;text-align:right\">Total</th></tr></thead><tbody>"+gstRows+"</tbody></table></div>"):"";
  /* RA abstract page 2 */
  const abstractHtml=opts.soAbstract?("<div style=\"page-break-before:always;padding:28px;font-family:Arial,sans-serif\"><h3 style=\"margin:0 0 12px\">RUNNING ACCOUNT ABSTRACT — "+docNo+"</h3><table style=\"width:100%;border-collapse:collapse\"><thead><tr style=\"background:#060C1A\"><th style=\"padding:7px 10px;text-align:left;color:#F59E0B\">Description</th><th style=\"padding:7px 10px;text-align:right;color:#F59E0B\">Est</th><th style=\"padding:7px 10px;text-align:right;color:#34D399\">Done</th><th style=\"padding:7px 10px;text-align:right;color:#F59E0B\">Prev</th><th style=\"padding:7px 10px;text-align:right;color:#F59E0B\">This</th><th style=\"padding:7px 10px;text-align:right;color:#F87171\">Bal</th></tr></thead><tbody>"+opts.soAbstract.map(function(r){return "<tr><td style=\"padding:6px 10px;border-bottom:1px solid #f1f5f9\">"+r.desc+"</td><td style=\"padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:right\">"+r.estimated+" "+r.unit+"</td><td style=\"padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:right;color:#34D399\">"+r.completed+" "+r.unit+"</td><td style=\"padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:right\">"+r.prevBilled+" "+r.unit+"</td><td style=\"padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:700\">"+r.thisBill+" "+r.unit+"</td><td style=\"padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:right;color:#F87171\">"+r.balance+" "+r.unit+"</td></tr>";}).join("")+"</tbody></table></div>"):"";
  const css=".pg{max-width:900px;margin:0 auto;border:2px solid #060C1A;font-family:Arial,sans-serif;font-size:12px;color:#111}.hdr{background:#060C1A;color:#F59E0B;padding:18px 28px;display:flex;justify-content:space-between;align-items:center}.hdr h1{margin:0;font-size:20px}.hdr p{margin:2px 0;color:#94A3B8;font-size:11px}.badge{background:#F59E0B;color:#060C1A;padding:3px 12px;border-radius:20px;font-weight:700;font-size:11px;display:inline-block;margin-top:4px}.meta{display:flex;padding:10px 28px;background:#f8fafc;border-bottom:1px solid #e2e8f0;gap:16px}.meta div{flex:1}.meta h4{margin:0 0 2px;color:#64748b;font-size:9px;text-transform:uppercase}.meta p{margin:0;font-weight:600;font-size:11px}.tf{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;padding:12px 28px;border-bottom:1px solid #e2e8f0}.tf h4{color:#F59E0B;font-size:9px;text-transform:uppercase;margin:0 0 5px}table{width:100%;border-collapse:collapse}th{background:#060C1A;color:#F59E0B;padding:8px 12px;text-align:left;font-size:10px}td{padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:11px}.itbl{padding:0 28px 12px}.sum{display:flex;justify-content:flex-end;padding:10px 28px}.sb{width:320px}.sr{display:flex;justify-content:space-between;padding:5px 0;font-size:12px;border-bottom:1px solid #f8fafc}.st{display:flex;justify-content:space-between;padding:10px 0;font-weight:700;font-size:16px;border-top:2px solid #060C1A;margin-top:4px}.bk{padding:14px 28px;background:#f8fafc;border-top:1px solid #e2e8f0}.bk h4{color:#F59E0B;font-size:9px;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px}.bg{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.bg label{display:block;color:#94a3b8;font-size:9px;text-transform:uppercase}.bg span{font-size:12px;font-weight:600}.ft{padding:12px 28px;display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8}.np{text-align:center;padding:18px;background:#f8fafc}@media print{.np{display:none}}";
  const html="<!DOCTYPE html><html><head><meta charset=utf-8><title>"+docType+" "+docNo+"</title><style>"+css+"</style></head><body><div class=pg>"+
    "<div class=hdr><div>"+logoHtml+"<h1>"+(co.name||"")+"</h1><p>"+(co.addr||"")+"</p><p>GST: "+(co.gst||"")+" | "+(co.phone||"")+"</p></div>"+
    "<div style=\"text-align:right\"><div style=\"font-size:11px;color:#94a3b8\">"+docType+"</div><div style=\"font-size:22px;font-weight:800;color:#F59E0B\">"+docNo+"</div>"+badgeHtml+"</div></div>"+
    "<div class=meta><div><h4>Date</h4><p>"+fmtDate(sale.date)+"</p></div><div><h4>"+docNo+"</h4><p>"+docNo+"</p></div><div><h4>"+(opts.isEstimate||opts.isProforma?"Valid Till":"TDS Rate")+"</h4><p>"+(opts.isEstimate||opts.isProforma?fmtDate(sale.validTill||""):(sale.tds||0)+"%")+"</p></div><div><h4>"+(opts.isEstimate||opts.isProforma?"Status":"Payment")+"</h4>"+statusHtml+"</div></div>"+
    "<div class=tf><div><h4>Bill To</h4><p style=\"font-size:15px;font-weight:700\">"+(cl?cl.name:sale.client)+"</p><p style=\"font-size:11px;color:#64748b\">"+(cl?cl.billTo||cl.addr||"":"")+"</p><p style=\"font-size:10px;color:#94a3b8\">GST: "+(cl?cl.gst:"N/A")+"</p></div>"+
    "<div><h4>Ship To</h4><p style=\"font-size:11px\">"+(cl?cl.shipTo||"":"")+"</p></div>"+
    "<div><h4>From</h4><p style=\"font-size:15px;font-weight:700\">"+co.name+"</p><p style=\"font-size:11px;color:#64748b\">"+co.addr+"</p><p style=\"font-size:10px;color:#94a3b8\">GST: "+co.gst+"</p></div></div>"+
    abstractHtmlInline+
    "<div class=itbl><table><thead><tr><th>Description</th><th>HSN/SAC</th><th style=\"text-align:right\">Qty/Unit</th><th style=\"text-align:right\">Rate</th><th>Disc%</th><th style=\"text-align:right\">Basic</th><th>GST%</th><th style=\"text-align:right\">GST Amt</th><th style=\"text-align:right\">Total</th></tr></thead><tbody>"+liRows+"</tbody></table></div>"+
    "<div class=sum><div class=sb>"+discHtml+"<div class=sr><span>Taxable Value</span><span>Rs "+n(c.basic)+"</span></div><div class=sr><span>GST Amount</span><span>Rs "+n(c.g)+"</span></div><div class=sr><span>Gross Total</span><span>Rs "+n(c.gross)+"</span></div>"+tdsHtml+"<div class=st><span>"+netLabel+"</span><span>Rs "+n(netAmt)+"</span></div>"+payHtml+"</div></div>"+
    amtWords+
    gstTable+
    "<div class=bk><h4>Bank Details for Payment</h4><div class=bg><div><label>Bank</label><span>"+co.bank+"</span></div><div><label>Account No</label><span>"+co.acc+"</span></div><div><label>IFSC</label><span>"+co.ifsc+"</span></div><div><label>Branch</label><span>"+co.branch+"</span></div></div></div>"+
    "<div class=ft><p>"+(opts.isEstimate?"This estimate is valid till "+fmtDate(sale.validTill)+". Subject to contract terms.":"Payment due 30 days. Interest @18% p.a. on overdue.")+"</p><div style=\"text-align:right\"><p style=\"margin:0\">For "+co.name+"</p><p style=\"margin:28px 0 0;border-top:1px solid #e2e8f0;padding-top:4px;font-size:10px\">Authorised Signatory</p></div></div></div>"+
    abstractHtml+
    "<div class=np><button onclick=\"window.print()\" style=\"background:#F59E0B;color:#060C1A;border:none;padding:10px 28px;border-radius:6px;font-weight:700;font-size:13px;cursor:pointer;margin-right:10px\">Print / Save PDF</button><button onclick=\"window.close()\" style=\"background:#e2e8f0;color:#333;border:none;padding:10px 20px;border-radius:6px;font-weight:700;cursor:pointer\">Close</button></div></body></html>";
  try{const blob=new Blob([html],{type:"text/html"});const url=URL.createObjectURL(blob);const w=window.open(url,"_blank","width=920,height=720");if(!w)alert("Allow popups for printing.");}catch(e){console.error(e);}
};
const genGenericPrint=(title,bodyHtml,co)=>openPrint(printWrapper("<div style=\"max-width:900px;margin:0 auto;padding:24px;font-family:Arial,sans-serif\"><div style=\"background:#060C1A;color:#F59E0B;padding:14px 24px;display:flex;justify-content:space-between;align-items:center;border-radius:8px 8px 0 0\"><div><div style=\"font-weight:800;font-size:18px\">"+(co?co.name:"")+"</div><div style=\"color:#94a3b8;font-size:10px\">"+(co?co.gst:"")+"</div></div><div style=\"font-size:16px;font-weight:700;color:white\">"+title+"</div></div><div style=\"border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 8px 8px\">"+bodyHtml+"</div></div>",title,co),title);

/* ══════════ DESIGN SYSTEM ══════════ */
const ss={
  card:{background:C.cd,borderRadius:12,border:BD,boxShadow:"0 4px 24px rgba(0,0,0,.3)"},
  th:{padding:"14px 16px",color:"#FFFFFF",fontSize:13,fontFamily:"monospace",fontWeight:800,textAlign:"left",borderBottom:"2px solid #1E2D45",borderRight:"1px solid #1E2D45",whiteSpace:"nowrap",textTransform:"uppercase",letterSpacing:1,background:"linear-gradient(180deg,#162236,#0E1628)"},
  td:{padding:"14px 16px",fontSize:14,color:"#FFFFFF",borderBottom:"1px solid #1E2D45",borderRight:"1px solid #1E2D45",lineHeight:1.6,fontWeight:600},
  inp:{background:"#060C1A",border:"1px solid #1E2D45",borderRadius:8,color:"#FFFFFF",padding:"12px 14px",fontSize:14,width:"100%",marginBottom:10,outline:"none",boxSizing:"border-box",fontFamily:"monospace",transition:"all .2s"},
  lbl:{display:"block",color:"#E2E8F0",fontSize:12,fontFamily:"monospace",marginBottom:4,letterSpacing:1,textTransform:"uppercase",fontWeight:700},
};
const TT={background:"#0A1223",border:BD,borderRadius:8,fontSize:11,color:"#E2E8F0"};

function Tag({c,ch}){const m={g:["rgba(52,211,153,.1)","#34D399","rgba(52,211,153,.25)"],r:["rgba(248,113,113,.1)","#F87171","rgba(248,113,113,.25)"],o:["rgba(245,158,11,.1)","#F59E0B","rgba(245,158,11,.25)"],p:["rgba(167,139,250,.1)","#A78BFA","rgba(167,139,250,.25)"],b:["rgba(96,165,250,.1)","#60A5FA","rgba(96,165,250,.25)"],t:["rgba(45,212,191,.1)","#2DD4BF","rgba(45,212,191,.25)"]};const[bg,fg,bo]=m[c]||m.o;return <span style={{background:bg,color:fg,padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:600,whiteSpace:"nowrap",border:"1px solid "+bo,fontFamily:"monospace"}}>{ch}</span>;}
function Btn({onClick,color,children,sm,full,disabled,icon}){return <button onClick={onClick} disabled={disabled} style={{background:disabled?"rgba(30,45,69,.5)":color?G(color,0.9):G(C.or,0.9),color:disabled?C.gr:color?"white":C.dk,border:"1px solid "+(disabled?"#1E2D45":color||C.or),borderRadius:7,padding:sm?"3px 10px":"8px 16px",fontWeight:700,fontSize:sm?10:11,cursor:disabled?"not-allowed":"pointer",whiteSpace:"nowrap",width:full?"100%":undefined,fontFamily:"monospace",display:"inline-flex",alignItems:"center",gap:4,justifyContent:"center",transition:"all .15s"}}>{icon&&<span>{icon}</span>}{children}</button>;}
function F({label,children}){return <div style={{marginBottom:2}}><label style={ss.lbl}>{label}</label>{children}</div>;}
function Inp({val,onChange,type,placeholder}){return <input type={type||"text"} placeholder={placeholder||""} style={ss.inp} value={val||""} onChange={e=>onChange(e.target.value)}/>;}
function Num({val,onChange,placeholder}){return <input type="number" style={ss.inp} value={val||""} onChange={e=>onChange(+e.target.value)} placeholder={placeholder||"0"}/>;}
function Sel({val,onChange,opts}){return <select style={ss.inp} value={val==null?"":val} onChange={e=>onChange(e.target.value)}>{opts.map(o=>{const v=o&&typeof o==="object"?o.v:String(o);const l=o&&typeof o==="object"?o.l:String(o);return <option key={v} value={v}>{l}</option>;})}</select>;}
function GR({cols,children,gap}){return <div style={{display:"grid",gridTemplateColumns:cols,gap:gap||8}}>{children}</div>;}
function KCard({label,value,sub,color,icon}){return <div style={{...ss.card,padding:"16px 18px",position:"relative",overflow:"hidden",background:"linear-gradient(135deg,#0E1628,#0A1223)"}}><div style={{position:"absolute",inset:0,background:`linear-gradient(135deg,${G(color||C.or,0.06)} 0%,transparent 60%)`,pointerEvents:"none"}}/><div style={{position:"absolute",top:0,left:0,width:3,height:"100%",background:color||C.or,borderRadius:"12px 0 0 12px"}}/><div style={{color:C.si,fontSize:9,letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>{icon&&<span style={{marginRight:4}}>{icon}</span>}{label}</div><div style={{fontFamily:"monospace",fontSize:16,fontWeight:700,color:color||C.or,marginBottom:2}}>{value}</div>{sub&&<div style={{color:"#334155",fontSize:10,marginTop:2}}>{sub}</div>}</div>;}
function SFilt({val,onChange}){return <div style={{display:"flex",gap:4,marginBottom:10}}>{["All","Paid","Partial","Unpaid"].map(s=><button key={s} onClick={()=>onChange(s)} style={{padding:"5px 14px",borderRadius:20,border:"1px solid "+(val===s?C.or:"#1E2D45"),background:val===s?G(C.or,0.15):"transparent",color:val===s?C.or:C.gr,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:val===s?700:400}}>{s}</button>)}</div>;}
function Modal({title,onClose,children,wide,xwide}){return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(4px)"}}><div style={{...ss.card,width:xwide?940:wide?700:480,maxHeight:"93vh",overflowY:"auto",padding:24,background:"linear-gradient(135deg,#0E1628,#0A1223)"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,paddingBottom:12,borderBottom:BD}}><span style={{color:C.or,fontFamily:"monospace",fontWeight:700,fontSize:13,letterSpacing:1}}>{title}</span><button onClick={onClose} style={{background:"rgba(248,113,113,.1)",border:"1px solid rgba(248,113,113,.2)",color:C.rd,cursor:"pointer",fontSize:14,borderRadius:6,padding:"2px 8px",fontWeight:700}}>✕</button></div>{children}</div></div>;}
function Confirm({label,onOk,onNo}){return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.9)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}}><div style={{...ss.card,padding:28,width:360,textAlign:"center",background:"linear-gradient(135deg,#0E1628,#0A1223)"}}><div style={{fontSize:36,marginBottom:10}}>⚠</div><div style={{color:"#E2E8F0",fontWeight:700,fontSize:16,marginBottom:6}}>Delete Record?</div><div style={{color:C.gr,fontSize:11,marginBottom:20,padding:"8px 12px",background:"rgba(248,113,113,.07)",borderRadius:7,border:"1px solid rgba(248,113,113,.2)"}}>{label}</div><div style={{display:"flex",gap:10,justifyContent:"center"}}><Btn onClick={onNo} color={C.gr}>Cancel</Btn><Btn onClick={onOk} color={C.rd}>Delete</Btn></div></div></div>;}
function SubTabs({tabs,val,onChange}){return <div style={{display:"flex",gap:2,marginBottom:14,background:"#060C1A",borderRadius:10,padding:4,flexWrap:"wrap"}}>{tabs.map(t=><button key={t.v} onClick={()=>onChange(t.v)} style={{padding:"5px 14px",borderRadius:7,border:"none",fontFamily:"monospace",fontSize:10,fontWeight:700,cursor:"pointer",background:val===t.v?"linear-gradient(135deg,#1E2D45,#162236)":"transparent",color:val===t.v?C.or:C.gr,boxShadow:val===t.v?"0 2px 8px rgba(0,0,0,.4)":"none"}}><span style={{marginRight:4}}>{t.icon}</span>{t.l}</button>)}</div>;}
function PeriodBar({from,to,onFrom,onTo}){const PRESET=[{l:"Jan",f:"2025-01-01",t:"2025-01-31"},{l:"Feb",f:"2025-02-01",t:"2025-02-28"},{l:"Q1 '25",f:"2025-01-01",t:"2025-03-31"},{l:"All",f:"",t:""}];return <div style={{...ss.card,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",background:"linear-gradient(135deg,#0A1223,#060C1A)"}}><span style={{color:C.si,fontSize:10,fontWeight:700,letterSpacing:1}}>PERIOD</span><input type="date" style={{...ss.inp,marginBottom:0,width:130,fontSize:11}} value={from} onChange={e=>onFrom(e.target.value)}/><span style={{color:C.gr}}>→</span><input type="date" style={{...ss.inp,marginBottom:0,width:130,fontSize:11}} value={to} onChange={e=>onTo(e.target.value)}/>{PRESET.map(p=><button key={p.l} onClick={()=>{onFrom(p.f);onTo(p.t);}} style={{padding:"4px 10px",borderRadius:6,border:"1px solid #1E2D45",background:"transparent",color:C.gr,cursor:"pointer",fontSize:10,fontFamily:"monospace"}}>{p.l}</button>)}{(from||to)&&<button onClick={()=>{onFrom("");onTo("");}} style={{padding:"3px 8px",borderRadius:6,border:"1px solid rgba(248,113,113,.3)",background:"rgba(248,113,113,.07)",color:C.rd,cursor:"pointer",fontSize:10,fontFamily:"monospace"}}>✕ Clear</button>}</div>;}

function LineItemsEditor({items,onChange,type,serviceOpts,itemOpts,gstOpts,showDiscount,showHSN}){
  const upd=(i,k,v)=>{const n=[...items];n[i]={...n[i],[k]:v};if(k==="desc"||k==="item"){const src=type==="service"?serviceOpts.find(s=>s.name===v):itemOpts.find(s=>s.name===v);if(src){n[i]={...n[i],unit:src.unit,rate:src.rate,gst:src.gst||18,hsn:src.hsn||src.sac||""};}}onChange(n);};
  const add=()=>onChange([...items,{desc:"",item:"",hsn:"",qty:1,unit:"",rate:0,gst:18,disc:0}]);
  const rem=i=>onChange(items.filter((_,j)=>j!==i));
  const tot=items.reduce((a,it)=>{const b=(it.qty||0)*(it.rate||0)*(1-(it.disc||0)/100);return a+b*(1+(it.gst||18)/100);},0);
  const cols=(showHSN?3:2)+(showDiscount?1:0);
  return <div style={{...ss.card,padding:12,marginBottom:10,background:"#060C1A"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
      <span style={{color:C.si,fontSize:10,letterSpacing:1,textTransform:"uppercase"}}>Line Items</span>
      <Btn sm onClick={add} color={C.br}>+ Add Row</Btn>
    </div>
    {items.map((it,i)=>{
      const gcols=`${showHSN?"1fr ":""}2fr 0.7fr 0.6fr 0.8fr${showDiscount?" 0.5fr":""} 0.5fr auto`;
      return <div key={i} style={{display:"grid",gridTemplateColumns:gcols,gap:4,marginBottom:6,alignItems:"start"}}>
        {showHSN&&<div><label style={{...ss.lbl,display:i===0?"block":"none"}}>HSN/SAC</label><input style={{...ss.inp,marginBottom:0,fontSize:10}} value={it.hsn||""} onChange={e=>upd(i,"hsn",e.target.value)} placeholder="HSN/SAC"/></div>}
        {type==="service"
          ?<div><label style={{...ss.lbl,display:i===0?"block":"none"}}>Description</label><input style={{...ss.inp,marginBottom:0}} value={it.desc||""} list={"svc"+i} onChange={e=>upd(i,"desc",e.target.value)} placeholder="Service"/><datalist id={"svc"+i}>{(serviceOpts||[]).map(s=><option key={s.id} value={s.name}/>)}</datalist></div>
          :<div><label style={{...ss.lbl,display:i===0?"block":"none"}}>Item</label><input style={{...ss.inp,marginBottom:0}} value={it.item||it.desc||""} list={"itm"+i} onChange={e=>upd(i,"item",e.target.value)} placeholder="Item"/><datalist id={"itm"+i}>{(itemOpts||[]).map(s=><option key={s.id} value={s.name}/>)}</datalist></div>}
        <div><label style={{...ss.lbl,display:i===0?"block":"none"}}>Qty</label><input type="number" style={{...ss.inp,marginBottom:0}} value={it.qty||""} onChange={e=>upd(i,"qty",+e.target.value)} placeholder="0"/></div>
        <div><label style={{...ss.lbl,display:i===0?"block":"none"}}>Unit</label><input style={{...ss.inp,marginBottom:0}} value={it.unit||""} onChange={e=>upd(i,"unit",e.target.value)} placeholder="MT"/></div>
        <div><label style={{...ss.lbl,display:i===0?"block":"none"}}>Rate</label><input type="number" style={{...ss.inp,marginBottom:0}} value={it.rate||""} onChange={e=>upd(i,"rate",+e.target.value)} placeholder="0"/></div>
        {showDiscount&&<div><label style={{...ss.lbl,display:i===0?"block":"none"}}>Disc%</label><input type="number" style={{...ss.inp,marginBottom:0}} value={it.disc||0} onChange={e=>upd(i,"disc",+e.target.value)} placeholder="0"/></div>}
        <div><label style={{...ss.lbl,display:i===0?"block":"none"}}>GST%</label><select style={{...ss.inp,marginBottom:0}} value={it.gst||18} onChange={e=>upd(i,"gst",+e.target.value)}>{(gstOpts||[0,5,12,18,28]).map(g=><option key={g} value={g}>{g}%</option>)}</select></div>
        <div style={{paddingTop:i===0?20:0}}><button onClick={()=>rem(i)} style={{background:"rgba(248,113,113,.1)",border:"1px solid rgba(248,113,113,.2)",color:C.rd,cursor:"pointer",fontSize:12,padding:"4px 7px",borderRadius:5}}>✕</button></div>
      </div>;
    })}
    {items.length>0&&<div style={{borderTop:BD,paddingTop:8,display:"flex",justifyContent:"space-between"}}><span style={{color:C.gr,fontSize:10}}>{items.length} item(s)</span><span style={{color:C.or,fontWeight:700,fontFamily:"monospace"}}>{INR(tot)} <span style={{color:C.gr,fontWeight:400,fontSize:10}}>incl.GST</span></span></div>}
  </div>;
}

function Tbl({cols,rows,foot,onEdit,onDel,onRcv,onPrint,rcvLabel,csvName,printLabel}){
  const[q,setQ]=useState("");
  const filt=rows.filter(r=>!q||r.some(c=>String(c&&c.props?JSON.stringify(c.props.children||""):c||"").toLowerCase().includes(q.toLowerCase())));
  const doCSV=()=>{const body=filt.map(r=>r.map(c=>{const v=c&&c.props?String(c.props.children||""):String(c||"");return '"'+v.replace(/"/g,"'")+'"';}).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([cols.join(",")+"\n"+body],{type:"text/csv"}));a.download=(csvName||"data")+".csv";a.click();};
  const hasAct=onEdit||onDel;
  return <div>
    <div style={{display:"flex",gap:8,marginBottom:10}}>
      <div style={{flex:1,position:"relative"}}><span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:C.gr,fontSize:12}}>🔍</span><input style={{...ss.inp,marginBottom:0,paddingLeft:30}} placeholder="Search..." value={q} onChange={e=>setQ(e.target.value)}/></div>
      {csvName&&<Btn onClick={doCSV} color={C.gr} icon="⬇">CSV</Btn>}
    </div>
    <div style={{...ss.card,overflowX:"auto"}}><table style={{borderCollapse:"collapse",width:"100%"}}>
      <thead><tr style={{background:"#060C1A"}}>{cols.map((c,i)=><th key={i} style={ss.th}>{c}</th>)}{onRcv&&<th style={{...ss.th,width:100}}>Action</th>}{hasAct&&<th style={{...ss.th,width:110}}>Edit/Del</th>}</tr></thead>
      <tbody>{filt.length===0?<tr><td colSpan={cols.length+3} style={{...ss.td,textAlign:"center",color:"#334155",padding:32}}>No records</td></tr>:filt.map((r,i)=>{const oi=rows.indexOf(r);return <tr key={i} style={{background:i%2===0?"transparent":"rgba(255,255,255,0.02)",transition:"background .15s"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(245,158,11,0.06)"} onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"transparent":"rgba(255,255,255,0.02)"}>{r.map((c,j)=><td key={j} style={ss.td}>{c}</td>)}{onRcv&&<td style={ss.td}><div style={{display:"flex",gap:3}}>{onPrint&&<button onClick={()=>onPrint(oi)} style={{padding:"3px 9px",borderRadius:6,border:"1px solid rgba(167,139,250,.3)",background:"rgba(167,139,250,.1)",color:C.pu,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>🖨</button>}<button onClick={()=>onRcv(oi)} style={{padding:"3px 9px",borderRadius:6,border:"1px solid rgba(52,211,153,.3)",background:"rgba(52,211,153,.1)",color:C.gn,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>{rcvLabel||"Pay"}</button></div></td>}{hasAct&&<td style={ss.td}><div style={{display:"flex",gap:3}}>{onPrint&&!onRcv&&<button onClick={()=>onPrint(oi)} style={{padding:"3px 9px",borderRadius:6,border:"1px solid rgba(167,139,250,.3)",background:"rgba(167,139,250,.1)",color:C.pu,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>🖨</button>}{onEdit&&<button onClick={()=>onEdit(oi)} style={{padding:"3px 9px",borderRadius:6,border:"1px solid rgba(245,158,11,.3)",background:"rgba(245,158,11,.1)",color:C.or,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Edit</button>}{onDel&&<button onClick={()=>onDel(oi)} style={{padding:"3px 9px",borderRadius:6,border:"1px solid rgba(248,113,113,.3)",background:"rgba(248,113,113,.1)",color:C.rd,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Del</button>}</div></td>}</tr>;})}
      </tbody>{foot&&<tfoot><tr style={{background:"#060C1A"}}>{foot.map((c,i)=><td key={i} style={{...ss.td,fontWeight:700,color:C.or,borderBottom:"none"}}>{c}</td>)}{onRcv&&<td style={{...ss.td,borderBottom:"none"}}/>}{hasAct&&<td style={{...ss.td,borderBottom:"none"}}/>}</tr></tfoot>}
    </table></div>
  </div>;
}
function MTbl({cols,rows,onEdit,onDel}){return <div style={{...ss.card,overflowX:"auto"}}><table style={{borderCollapse:"collapse",width:"100%"}}><thead><tr style={{background:"#060C1A"}}>{cols.map((c,i)=><th key={i} style={ss.th}>{c}</th>)}<th style={{...ss.th,width:110}}>Actions</th></tr></thead><tbody>{rows.length===0?<tr><td colSpan={cols.length+1} style={{...ss.td,textAlign:"center",color:"#334155",padding:28}}>No records</td></tr>:rows.map((r,i)=><tr key={i} style={{background:i%2===0?"transparent":"rgba(255,255,255,0.02)",transition:"background .15s"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(245,158,11,0.06)"} onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"transparent":"rgba(255,255,255,0.02)"}>{r.map((c,j)=><td key={j} style={ss.td}>{c}</td>)}<td style={ss.td}><div style={{display:"flex",gap:4}}>{onEdit&&<button onClick={()=>onEdit(i)} style={{padding:"3px 9px",borderRadius:6,border:"1px solid rgba(245,158,11,.3)",background:"rgba(245,158,11,.1)",color:C.or,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Edit</button>}{onDel&&<button onClick={()=>onDel(i)} style={{padding:"3px 9px",borderRadius:6,border:"1px solid rgba(248,113,113,.3)",background:"rgba(248,113,113,.1)",color:C.rd,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Del</button>}</div></td></tr>)}</tbody></table></div>;}

function Clock(){const[now,setNow]=useState(new Date());useEffect(()=>{const t=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(t);},[]);const h=now.getHours(),m=now.getMinutes(),s=now.getSeconds(),ampm=h>=12?"PM":"AM",hh=String(h%12||12).padStart(2,"0"),mm=String(m).padStart(2,"0"),ss2=String(s).padStart(2,"0");return <div style={{textAlign:"right",lineHeight:1.3}}><div style={{color:C.or,fontFamily:"monospace",fontWeight:700,fontSize:14,letterSpacing:1.5}}>{hh}:{mm}:{ss2}<span style={{fontSize:10,color:C.gr,marginLeft:4}}>{ampm}</span></div><div style={{color:"#334155",fontSize:10}}>{DAYS[now.getDay()]} {now.getDate()} {MONTHS[now.getMonth()]} {now.getFullYear()}</div></div>;}

function MiniCalendar(){
  const[cur,setCur]=useState(new Date());
  const today=new Date();
  const yr=cur.getFullYear(),mo=cur.getMonth();
  const firstDay=new Date(yr,mo,1).getDay();
  const days=new Date(yr,mo+1,0).getDate();
  const cells=[];
  for(let i=0;i<firstDay;i++)cells.push(null);
  for(let d=1;d<=days;d++)cells.push(d);
  while(cells.length%7!==0)cells.push(null);
  return <div style={{...ss.card,padding:14,background:"linear-gradient(135deg,#0E1628,#0A1223)"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
      <button onClick={()=>setCur(new Date(yr,mo-1,1))} style={{background:"none",border:"none",color:C.gr,cursor:"pointer",fontSize:16,padding:"2px 8px"}}>‹</button>
      <span style={{color:C.or,fontWeight:700,fontSize:12}}>{MONTHS[mo]} {yr}</span>
      <button onClick={()=>setCur(new Date(yr,mo+1,1))} style={{background:"none",border:"none",color:C.gr,cursor:"pointer",fontSize:16,padding:"2px 8px"}}>›</button>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
      {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d,i)=><div key={i} style={{textAlign:"center",color:C.gr,fontSize:9,fontWeight:700}}>{d}</div>)}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
      {cells.map((d,i)=>{const isToday=d&&yr===today.getFullYear()&&mo===today.getMonth()&&d===today.getDate();const isSun=((i%7)===0);return <div key={i} style={{textAlign:"center",padding:"4px 0",borderRadius:4,fontSize:10,fontWeight:isToday?700:400,background:isToday?C.or:"transparent",color:isToday?C.dk:isSun&&d?C.rd:d?C.si:"transparent"}}>{d||""}</div>;})}
    </div>
  </div>;
}

function Login({onLogin}){const[u,setU]=useState("");const[p,setP]=useState("");const[err,setErr]=useState("");const go=()=>{const usr=INIT_M.users.find(x=>x.username===u&&x.password===p);if(usr)onLogin(usr);else setErr("Invalid credentials");};return <div style={{minHeight:"100vh",background:`radial-gradient(ellipse at 20% 50%,#0F1D33,${C.dk})`,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(circle at 2px 2px,rgba(96,165,250,.04) 1px,transparent 0)",backgroundSize:"32px 32px",pointerEvents:"none"}}/><div style={{...ss.card,padding:44,width:400,textAlign:"center",boxShadow:"0 32px 80px rgba(0,0,0,.7)",position:"relative",background:"linear-gradient(135deg,#0E1628,#0A1223)"}}><div style={{position:"absolute",top:-1,left:"50%",transform:"translateX(-50%)",width:"60%",height:2,background:"linear-gradient(90deg,transparent,#F59E0B,transparent)",borderRadius:2}}/><div style={{width:64,height:64,background:"linear-gradient(135deg,rgba(245,158,11,.2),rgba(245,158,11,.05))",borderRadius:16,border:"1px solid rgba(245,158,11,.3)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:30}}>🏗</div><div style={{color:C.or,fontFamily:"monospace",fontWeight:800,fontSize:26,letterSpacing:4,marginBottom:4}}>SITE LEDGER</div><div style={{color:"#334155",fontSize:11,marginBottom:32,letterSpacing:1}}>v9 — Civil Contractor ERP</div><div style={{textAlign:"left",background:"#060C1A",borderRadius:10,padding:16,border:BD}}><F label="Username"><Inp val={u} onChange={setU} placeholder="Username"/></F><F label="Password"><input type="password" style={{...ss.inp,marginBottom:0}} value={p} onChange={e=>setP(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="Password"/></F></div>{err&&<div style={{color:C.rd,fontSize:11,margin:"10px 0",padding:"8px 12px",background:"rgba(248,113,113,.08)",borderRadius:7,border:"1px solid rgba(248,113,113,.2)"}}>{err}</div>}<div style={{marginTop:14}}><Btn full onClick={go}>LOGIN →</Btn></div></div></div>;}

const INIT_WC=[
  {id:"wc1",siteId:"s1",policyNo:"WC/2025/001",insurer:"New India Assurance",sumAssured:5000000,premium:25000,startDate:"2025-04-01",expiryDate:"2026-03-31"},
  {id:"wc2",siteId:"s2",policyNo:"WC/2025/002",insurer:"Oriental Insurance",sumAssured:3000000,premium:15000,startDate:"2025-04-01",expiryDate:"2026-03-31"},
];

export default function App(){const[user,setUser]=useState(null);const[settings,setSettings]=useState(getSettings);if(!user)return <Login onLogin={setUser}/>;return <Main user={user} onLogout={()=>setUser(null)} settings={settings} setSettings={v=>{setSettings(v);saveSettings(v);}}/>;};

/* ══════════ MODULE CONFIG ══════════ */
const MOD_GROUPS=[
  {id:"dash",l:"Dashboard",icon:"📊",color:"#2DD4BF",desc:"Overview & KPIs"},
  {id:"dpr",l:"DPR",icon:"📋",color:"#60A5FA",desc:"Daily Progress"},
  {id:"sales",l:"Sales",icon:"💰",color:"#34D399",desc:"Orders, Invoices, DN"},
  {id:"purchase",l:"Purchase",icon:"🛒",color:"#F87171",desc:"PO, Bills, CN"},
  {id:"hr",l:"HR",icon:"👷",color:"#A78BFA",desc:"Attendance & Payroll"},
  {id:"inventory",l:"Inventory",icon:"📦",color:"#FB923C",desc:"Stock & Godowns"},
  {id:"accounts",l:"Accounts",icon:"🏦",color:"#F59E0B",desc:"Banks, Loans, Vouchers"},
  {id:"reports",l:"Reports",icon:"📈",color:"#E879F9",desc:"P&L, BS, Ledger"},
  {id:"masters",l:"Masters",icon:"⚙",color:"#64748B",desc:"Master Data"},
  {id:"settings",l:"Settings",icon:"🎨",color:"#94A3B8",desc:"Themes & Preferences"},
  {id:"calc",l:"Civil Calc",icon:"🔢",color:"#34D399",desc:"Engineering Calculators"},
];

function Main({user,onLogout,settings,setSettings}){
  C=mkColors(settings.accent||DEF_SETTINGS.accent);
  const[site,setSite]=useState("ALL");
  const[tab,setTab]=useState("dash");
  const[salesSub,setSalesSub]=useState("inv");
  const[purchSub,setPurchSub]=useState("bills");
  const[hrSub,setHrSub]=useState("att");
  const[invSub,setInvSub]=useState("stock");
  const[accSub,setAccSub]=useState("vouchers");
  const[chqFilter,setChqFilter]=useState("All");
  const[ttFilter,setTtFilter]=useState("All");
  const[oiSub,setOiSub]=useState("list");
  const[calcSub,setCalcSub]=useState("reinforcement");
  const[calcInputs,setCalcInputs]=useState({});
  const ci=(k,v)=>setCalcInputs(p=>({...p,[k]:+v||0}));

  /* Image picker helper — returns base64 data URL */
  const pickImage=(cb)=>{const inp=document.createElement("input");inp.type="file";inp.accept="image/*";inp.onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>cb(ev.target.result);r.readAsDataURL(f);};inp.click();};
  const[repSub,setRepSub]=useState("pl");
  const[mTab,setMTab]=useState("sites");
  const[showKPIs,setShowKPIs]=useState(true);
  const[data,setData]=useState(()=>{const d=loadData()||INIT_D;if(!d.wcPolicies)d.wcPolicies=INIT_WC;return d;});
  const[masters,setMasters]=useState(INIT_M);
  const[modal,setModal]=useState(null);
  const[form,setForm]=useState({});
  const[del,setDel]=useState(null);
  const[ledEnt,setLedEnt]=useState("client");
  const[ledName,setLedName]=useState("NHAI");
  const[fSt,setFSt]=useState("All");
  const[dbDate,setDbDate]=useState("2025-02-17");
  const[dprSite,setDprSite]=useState("all");
  const[rpFrom,setRpFrom]=useState("2025-01-01");
  const[rpTo,setRpTo]=useState("2025-03-31");

  useEffect(()=>{persistData(data);},[data]);

  const sf=(f,v)=>setForm(p=>({...p,[f]:v}));
  const co=masters.company;
  const userModAccess=user.moduleAccess||ROLE_ACCESS[user.role]||[];
  const can=t=>userModAccess.includes(t);

  const upd=(key,fn)=>setData(p=>({...p,[key]:fn(p[key]||[])}));
  const updM=(key,fn)=>setMasters(p=>({...p,[key]:fn(p[key]||[])}));

  const isApprover = ["Admin", "Manager", "Owner", "Site Manager"].includes(user.role);
  const checkApproval = (action, targetType, targetKey, payload, targetId) => {
    if (isApprover) return false;
    upd("pendingApprovals", arr => [...arr, { id: uid(), action, targetType, targetKey, payload, targetId, requestedBy: user.name, timestamp: new Date().toISOString(), status: "pending" }]);
    alert("Action submitted for approval.");
    return true;
  };

  const handleApprove = (a) => {
    if(a.targetType === "master") {
      if(a.action === "add") updM(a.targetKey, arr => [...arr, { ...a.payload, id: uid() }]);
      else if(a.action === "edit") updM(a.targetKey, arr => arr.map((x, i) => i === a.targetId ? { ...a.payload, id: x.id } : x));
      else if(a.action === "delete") updM(a.targetKey, arr => arr.filter((_, i) => i !== a.targetId));
    } else if(a.targetType === "txn") {
      if(a.action === "add") upd(a.targetKey, arr => [...arr, { ...a.payload, id: uid() }]);
      else if(a.action === "edit") upd(a.targetKey, arr => arr.map(x => x.id === a.targetId ? { ...a.payload, id: a.targetId } : x));
      else if(a.action === "delete") upd(a.targetKey, arr => arr.filter(x => x.id !== a.targetId));
      else if(a.action === "receive_pay") {
        const payload = a.payload;
        upd(a.targetKey, arr => arr.map(x => x.id === payload._oid ? { ...x, paidAmt: Math.min((x.paidAmt || 0) + payload._add, 999999999) } : x));
        const vtype = payload._isSale ? "in" : "out";
        const vDesc = (payload._isSale ? "Receipt " : "Payment ") + (payload.inv || payload.dnNo || payload.cnNo || payload.desc || "");
        const nV = { id: uid(), date: payload.payDate, vtype, party: payload.client || payload.vendor || "", partyType: payload._isSale ? "client" : "vendor", siteId: payload.siteId || "", amt: payload._add, via: payload.via, accountId: payload.accountId, desc: vDesc, ref: payload.payRef || "" };
        upd("vouchers", arr => [...arr, nV]);
        if (payload.via === "bank" && payload.accountId) upd("bankTxns", arr => [...arr, { id: uid(), bankId: payload.accountId, date: payload.payDate, desc: vDesc, type: vtype === "in" ? "Cr" : "Dr", amt: payload._add, ref: payload.payRef || "" }]);
        else if (payload.via === "petty" && payload.accountId) upd("pettyTxns", arr => [...arr, { id: uid(), pettyId: payload.accountId, date: payload.payDate, desc: vDesc, type: vtype === "in" ? "Cr" : "Dr", amt: payload._add, by: user.name }]);
      }
    }
    upd("pendingApprovals", arr => arr.filter(x => x.id !== a.id));
  };
  const handleReject = (a) => upd("pendingApprovals", arr => arr.filter(x => x.id !== a.id));

  const saveRec=(key,item)=>{if(checkApproval(modal.oid?"edit":"add","txn",key,item,modal.oid))return;upd(key,arr=>modal.oid?arr.map(x=>x.id===modal.oid?{...item,id:modal.oid}:x):[...arr,{...item,id:uid()}]);};
  const delRec=(key,id)=>{if(checkApproval("delete","txn",key,null,id))return;upd(key,arr=>arr.filter(x=>x.id!==id));};
  const delM=(key,idx)=>{if(checkApproval("delete","master",key,null,idx))return;updM(key,arr=>arr.filter((_,i)=>i!==idx));};
  const openAdd=(mod,extra)=>{
    const docNums={
      sales:{field:"inv",prefix:"INV",arr:data.sales},
      so:{field:"soNo",prefix:"SO",arr:data.saleOrders},
      estimate:{field:"estNo",prefix:"EST",arr:data.estimates},
      proforma:{field:"pfNo",prefix:"PRO",arr:data.proforma},
      debitNote:{field:"dnNo",prefix:"DN",arr:data.debitNotes},
      otherincome:{field:"oiNo",prefix:"OI",arr:data.otherIncome},
      po:{field:"poNo",prefix:"PO",arr:data.purchaseOrders},
      creditNote:{field:"cnNo",prefix:"CN",arr:data.creditNotes},
      vouchers:{field:"vNo",prefix:"VC",arr:data.vouchers},
    };
    const dn=docNums[mod];
    const base2={gst:18,tds:2,days:26,siteId:site==="ALL"?"":site,via:"bank",accountId:(masters.banks[0]||{}).id||"",lineItems:[{desc:"",item:"",hsn:"",qty:1,unit:"",rate:0,gst:18,disc:0}]};
    if(dn&&dn.field){base2[dn.field]=nextDocNo(dn.prefix,dn.arr||[],dn.field);}
    setForm({...base2,...(extra||{})});
    setModal({t:"txn",mod});
  };
  const openEdit=(mod,item)=>{setForm({...item,lineItems:item.lineItems&&item.lineItems.length?item.lineItems:[{desc:item.desc||"",hsn:"",qty:1,unit:"",rate:item.basic||0,gst:item.gst||18,disc:0}]});setModal({t:"txn",mod,oid:item.id});};
  const openMAdd=(key)=>{setForm({});setModal({t:"master",key});};
  const openMEdit=(key,idx)=>{setForm({...masters[key][idx]});setModal({t:"master",key,oidx:idx});};
  const saveTxn=key=>{saveRec(key,form);setModal(null);setForm({});};
  const doDelete=()=>{if(del.isM)delM(del.key,del.idx);else delRec(del.key,del.id);setDel(null);};
  const saveM=(key,item)=>{if(checkApproval(modal.oidx!=null?"edit":"add","master",key,item,modal.oidx))return;updM(key,arr=>modal.oidx!=null?arr.map((x,i)=>i===modal.oidx?{...item,id:x.id}:x):[...arr,{...item,id:uid()}]);};

  const fData=useMemo(()=>{if(site==="ALL")return data;const f={};["sales","saleOrders","purchases","purchaseOrders","expenses","payroll","attendance","dpr","materialReceipts","estimates","proforma","debitNotes","creditNotes"].forEach(k=>{f[k]=(data[k]||[]).filter(x=>!x.siteId||x.siteId===site);});return{...data,...f};},[data,site]);
  const rData=useMemo(()=>{const filt=(arr,dk="date")=>(arr||[]).filter(x=>inPeriod(x[dk],rpFrom,rpTo));return{sales:filt(fData.sales),purchases:filt(fData.purchases),expenses:filt(fData.expenses),payroll:filt(fData.payroll,"month"),vouchers:filt(data.vouchers),bankTxns:filt(data.bankTxns),pettyTxns:filt(data.pettyTxns),debitNotes:filt(fData.debitNotes||[]),creditNotes:filt(fData.creditNotes||[])};},[fData,data,rpFrom,rpTo]);

  const sName=id=>{if(id==="CONSULTANCY")return"Consultancy";if(id==="OFFICE")return"Head Office";if(id==="GODOWN")return"Godown";return(masters.sites.find(s=>s.id===id)||{}).name||id||"—";};
  const gName=id=>(masters.godowns.find(g=>g.id===id)||{}).name||id||"—";
  const bName=id=>(masters.banks.find(b=>b.id===id)||{}).name||id||"—";
  const pcName=id=>(masters.pettyCash.find(p=>p.id===id)||{}).name||id||"—";

  const openRcv=(key,item)=>{const tot=key==="sales"||key==="debitNotes"?cS(item).net:key==="purchases"||key==="creditNotes"?cP(item).tot:key==="payroll"?cW(item).net:(item.amt||0);setForm({...item,_tot:tot,_bal:Math.max(0,tot-(item.paidAmt||0)),payAdd:"",via:"bank",accountId:(masters.banks[0]||{}).id||"",payDate:new Date().toISOString().slice(0,10),payRef:""});setModal({t:"rcv",key,oid:item.id,isSale:["sales","debitNotes"].includes(key)});};
  const saveRcvPay=()=>{
    const add=Number(form.payAdd)||0;if(add<=0)return;
    if(checkApproval("receive_pay", "txn", modal.key, {...form, _add:add, _isSale:modal.isSale, _oid:modal.oid}, modal.oid)) { setModal(null); setForm({}); return; }
    upd(modal.key,arr=>arr.map(x=>x.id===modal.oid?{...x,paidAmt:Math.min((x.paidAmt||0)+add,999999999)}:x));
    const vtype=modal.isSale?"in":"out";
    const vDesc=(modal.isSale?"Receipt ":"Payment ")+(form.inv||form.dnNo||form.cnNo||form.desc||"");
    const nV={id:uid(),date:form.payDate,vtype,party:form.client||form.vendor||"",partyType:modal.isSale?"client":"vendor",siteId:form.siteId||"",amt:add,via:form.via,accountId:form.accountId,desc:vDesc,ref:form.payRef||""};
    upd("vouchers",arr=>[...arr,nV]);
    if(form.via==="bank"&&form.accountId)upd("bankTxns",arr=>[...arr,{id:uid(),bankId:form.accountId,date:form.payDate,desc:vDesc,type:vtype==="in"?"Cr":"Dr",amt:add,ref:form.payRef||""}]);
    else if(form.via==="petty"&&form.accountId)upd("pettyTxns",arr=>[...arr,{id:uid(),pettyId:form.accountId,date:form.payDate,desc:vDesc,type:vtype==="in"?"Cr":"Dr",amt:add,by:user.name}]);
    setModal(null);setForm({});
  };

  const autoFill=name=>{const mo=form.month||"2025-02";const att=(data.attendance||[]).filter(a=>a.name===name&&(a.date||"").startsWith(mo));sf("present",att.filter(a=>a.present).length);sf("days",att.length||26);};

  /* Convert Sale Order → pre-filled Invoice */
  const convertSoToInv=so=>{
    const invNo="INV-"+(String((data.sales||[]).length+1).padStart(3,"0"));
    const today=new Date().toISOString().slice(0,10);
    setForm({date:today,inv:invNo,siteId:so.siteId,soId:so.id,client:so.client,tds:so.tds||2,desc:so.desc,lineItems:(so.lineItems||[]).map(li=>({...li,disc:0}))});
    setModal({t:"txn",mod:"sales"});
  };

  /* Open direct bank debit/credit modal */
  const openBankEntry=(bankId)=>{
    setForm({date:new Date().toISOString().slice(0,10),bankId:bankId||(masters.banks[0]||{}).id||"",type:"Cr",amt:"",desc:"",ref:"",tdsAmt:0,tcsAmt:0});
    setModal({t:"bankEntry"});
  };
  const saveBankEntry=()=>{
    const amt=Number(form.amt)||0; if(amt<=0)return;
    upd("bankTxns",arr=>[...arr,{id:uid(),bankId:form.bankId,date:form.date,desc:form.desc,type:form.type,amt,ref:form.ref||""}]);
    if(form.tdsAmt>0||form.tcsAmt>0){upd("tdsTcs",arr=>[...arr,{id:uid(),date:form.date,txnType:form.tdsAmt>0?"tds":"tcs",direction:form.type==="Cr"?"receivable":"payable",party:form.desc,partyType:"other",section:form.tdsAmt>0?"194C":"206C",rate:0,baseAmt:amt,taxAmt:form.tdsAmt||form.tcsAmt||0,refInv:form.ref||"",status:"Deducted",challNo:""}]);}
    setModal(null);setForm({});
  };

  /* Open cheque modal */
  const openCheque=(item)=>{
    setForm(item?{...item}:{date:new Date().toISOString().slice(0,10),type:"received",chequeNo:"",bankId:(masters.banks[0]||{}).id||"",party:"",amt:"",dueDate:"",status:"Pending",desc:"",tdsAmt:0});
    setModal({t:"cheque",oid:item?item.id:null});
  };
  const saveCheque=()=>{
    upd("cheques",arr=>modal.oid?arr.map(x=>x.id===modal.oid?{...form,id:modal.oid}:x):[...arr,{...form,id:uid()}]);
    setModal(null);setForm({});
  };
  const byStatus=(arr,getTot)=>{if(fSt==="All")return arr;return arr.filter(e=>pSt(e.paidAmt||0,getTot(e))===fSt);};

  /* SO progress for DPR */
  const getSoProgress=soId=>{if(!soId)return[];const so=(data.saleOrders||[]).find(s=>s.id===soId);if(!so)return[];const allInvs=(data.sales||[]).filter(s=>s.soId===soId);return(so.lineItems||[]).map((li,idx)=>{const completed=(data.dpr||[]).filter(d=>d.soId===soId).reduce((a,d)=>{const e=(d.entries||[]).find(en=>en.soLineIdx===idx);return a+(e?e.completedQty:0);},0);const prevBilled=allInvs.reduce((a,inv)=>{const il=inv.lineItems&&inv.lineItems[idx];return a+(il?il.qty:0);},0);return{desc:li.desc,unit:li.unit,estimated:li.qty,completed:Math.round(completed*100)/100,prevBilled,thisBill:0,balance:Math.max(0,li.qty-prevBilled)};});};

  /* KPIs */
  const k=useMemo(()=>{const s=fData.sales||[],pu=fData.purchases||[],ex=fData.expenses||[],py=fData.payroll||[];const dn=fData.debitNotes||[],cn=fData.creditNotes||[];const tB=s.reduce((a,b)=>a+cS(b).basic,0)+dn.reduce((a,b)=>a+cS(b).basic,0),tG=s.reduce((a,b)=>a+cS(b).g,0),tTDS=s.reduce((a,b)=>a+cS(b).td,0);const pB=pu.reduce((a,b)=>a+cP(b).b,0),pG=pu.reduce((a,b)=>a+cP(b).ga,0);const tE=ex.reduce((a,b)=>a+b.amt,0),tP=py.reduce((a,b)=>a+cW(b).net,0);const profit=tB-pB-tE-tP;const totalBankBal=masters.banks.reduce((a,b)=>a+getBankBal(data.bankTxns||[],masters.banks,b.id),0);const totalPettyBal=masters.pettyCash.reduce((a,b)=>a+getPettyBal(data.pettyTxns||[],masters.pettyCash,b.id),0);return{tB,tG,tTDS,net:tB+tG-tTDS,pB,pG,tE,tP,profit,margin:tB?(profit/tB*100).toFixed(1):0,totalBankBal,totalPettyBal};},[fData,data,masters]);

  /* TDS / TCS summary */
  const tdsTcsSummary=useMemo(()=>{
    const all=data.tdsTcs||[];
    const tdsRcv=all.filter(x=>x.txnType==="tds"&&x.direction==="receivable");
    const tdsPay=all.filter(x=>x.txnType==="tds"&&x.direction==="payable");
    const tcsRcv=all.filter(x=>x.txnType==="tcs"&&x.direction==="receivable");
    const tcsPay=all.filter(x=>x.txnType==="tcs"&&x.direction==="payable");
    return{
      tdsRcvTotal:tdsRcv.reduce((a,x)=>a+x.taxAmt,0),
      tdsRcvPending:tdsRcv.filter(x=>x.status==="Pending").reduce((a,x)=>a+x.taxAmt,0),
      tdsPayTotal:tdsPay.reduce((a,x)=>a+x.taxAmt,0),
      tdsPayPending:tdsPay.filter(x=>x.status==="Pending").reduce((a,x)=>a+x.taxAmt,0),
      tcsRcvTotal:tcsRcv.reduce((a,x)=>a+x.taxAmt,0),
      tcsPayTotal:tcsPay.reduce((a,x)=>a+x.taxAmt,0),
      all,tdsRcv,tdsPay,tcsRcv,tcsPay,
    };
  },[data.tdsTcs]);

  /* Cheque reminders — due in next 10 days */
  const chequeReminders=useMemo(()=>{
    const today=new Date();
    return(data.cheques||[]).filter(c=>{if(c.status==="Cleared"||c.status==="Cancelled"||c.status==="Bounced")return false;if(!c.dueDate)return false;const d=new Date(c.dueDate+"T00:00:00");const diff=Math.ceil((d-today)/864e5);return diff>=0&&diff<=10;});
  },[data.cheques]);

  const rk=useMemo(()=>{const s=rData.sales||[],pu=rData.purchases||[],ex=rData.expenses||[],py=rData.payroll||[];const tB=s.reduce((a,b)=>a+cS(b).basic,0),tG=s.reduce((a,b)=>a+cS(b).g,0),tTDS=s.reduce((a,b)=>a+cS(b).td,0);const pB=pu.reduce((a,b)=>a+cP(b).b,0),pG=pu.reduce((a,b)=>a+cP(b).ga,0);const tE=ex.reduce((a,b)=>a+b.amt,0),tP=py.reduce((a,b)=>a+cW(b).net,0);const profit=tB-pB-tE-tP;return{tB,tG,tTDS,net:tB+tG-tTDS,pB,pG,tE,tP,profit,margin:tB?(profit/tB*100).toFixed(1):0};},[rData]);

  const mChart=useMemo(()=>{const m={};(fData.sales||[]).forEach(s=>{const mo=(s.date||"").slice(0,7);if(mo){if(!m[mo])m[mo]={mo,rev:0,cost:0};m[mo].rev+=cS(s).basic;}});(fData.purchases||[]).forEach(p=>{const mo=(p.date||"").slice(0,7);if(mo){if(!m[mo])m[mo]={mo,rev:0,cost:0};m[mo].cost+=cP(p).b;}});(fData.expenses||[]).forEach(e=>{const mo=(e.date||"").slice(0,7);if(mo){if(!m[mo])m[mo]={mo,rev:0,cost:0};m[mo].cost+=e.amt;}});return Object.values(m).sort((a,b)=>a.mo.localeCompare(b.mo)).map(x=>({...x,mo:x.mo.slice(5),profit:x.rev-x.cost}));},[fData]);
  const ePie=useMemo(()=>{const m={};(fData.expenses||[]).forEach(e=>{m[e.cat]=(m[e.cat]||0)+e.amt;});return Object.entries(m).map(([name,value])=>({name,value}));},[fData]);

  /* Balance Sheet computation */
  const balanceSheet=useMemo(()=>{
    const bankBal=masters.banks.reduce((a,b)=>a+getBankBal(data.bankTxns||[],masters.banks,b.id),0);
    const pettyBal=masters.pettyCash.reduce((a,b)=>a+getPettyBal(data.pettyTxns||[],masters.pettyCash,b.id),0);
    const receivables=(rData.sales||[]).reduce((a,s)=>{const c=cS(s);return a+Math.max(0,c.net-(s.paidAmt||0));},0);
    const invValue=(data.inventory||[]).reduce((a,i)=>a+(i.close||0)*(i.rate||0),0);
    const loansGiven=(data.loans||[]).filter(l=>["given","advance"].includes(l.loanType)&&l.status==="Active").reduce((a,l)=>a+l.amt,0);
    const payables=(rData.purchases||[]).reduce((a,p)=>{const c=cP(p);return a+Math.max(0,c.tot-(p.paidAmt||0));},0)+(rData.expenses||[]).reduce((a,e)=>a+Math.max(0,e.amt-(e.paidAmt||0)),0);
    const loansBorrowed=(data.loans||[]).filter(l=>l.loanType==="borrowed"&&l.status==="Active").reduce((a,l)=>a+l.amt,0);
    const gstPayable=Math.max(0,k.tG-k.pG);
    const tdsPayable=k.tTDS;
    const totalAssets=bankBal+pettyBal+receivables+invValue+loansGiven;
    const totalLiab=payables+loansBorrowed+gstPayable+tdsPayable;
    const equity=totalAssets-totalLiab;
    return{bankBal,pettyBal,receivables,invValue,loansGiven,totalAssets,payables,loansBorrowed,gstPayable,tdsPayable,totalLiab,equity};
  },[data,masters,rData,k]);

  /* Ledger */
  const ledger=useMemo(()=>{const txns=[];if(ledEnt==="client"){(rData.sales||[]).filter(s=>s.client===ledName).forEach(s=>{const c=cS(s);txns.push({date:s.date,ref:s.inv,desc:s.desc,dr:c.net,cr:0,type:"Invoice"});if(s.paidAmt>0)txns.push({date:s.date,ref:s.inv,desc:"Receipt",dr:0,cr:s.paidAmt,type:"Receipt"});});}else if(ledEnt==="vendor"){(rData.purchases||[]).filter(p=>p.vendor===ledName).forEach(p=>{const c=cP(p);txns.push({date:p.date,ref:"BILL",desc:p.item,dr:0,cr:c.tot,type:"Purchase"});if(p.paidAmt>0)txns.push({date:p.date,ref:"PMT",desc:"Payment",dr:p.paidAmt,cr:0,type:"Payment"});});}txns.sort((a,b)=>(a.date||"").localeCompare(b.date||""));let bal=0;return txns.map(t=>{bal+=t.dr-t.cr;return{...t,bal};});},[rData,ledEnt,ledName]);

  const aging=useMemo(()=>{const rb={"0–30 Days":{cnt:0,amt:0},"31–60 Days":{cnt:0,amt:0},"61–90 Days":{cnt:0,amt:0},"90+ Days":{cnt:0,amt:0}};const pb={"0–30 Days":{cnt:0,amt:0},"31–60 Days":{cnt:0,amt:0},"61–90 Days":{cnt:0,amt:0},"90+ Days":{cnt:0,amt:0}};(rData.sales||[]).filter(s=>s.paidAmt<cS(s).net).forEach(s=>{const b=aBkt(dDiff(s.date));rb[b].cnt++;rb[b].amt+=cS(s).net-(s.paidAmt||0);});[...(rData.purchases||[]).filter(p=>p.paidAmt<cP(p).tot),...(rData.expenses||[]).filter(e=>e.paidAmt<e.amt)].forEach(p=>{const tot=p.qty!=null?cP(p).tot:p.amt;const b=aBkt(dDiff(p.date));pb[b].cnt++;pb[b].amt+=tot-(p.paidAmt||0);});return{rb,pb};},[rData]);

  const dayBookEntries=useMemo(()=>{const all=[];(data.sales||[]).filter(x=>x.date===dbDate).forEach(x=>all.push({module:"Sales",party:x.client,desc:x.inv+" — "+x.desc,amt:cS(x).net,type:"income"}));(data.purchases||[]).filter(x=>x.date===dbDate).forEach(x=>all.push({module:"Purchase",party:x.vendor,desc:x.item,amt:cP(x).tot,type:"expense"}));(data.expenses||[]).filter(x=>x.date===dbDate).forEach(x=>all.push({module:"Expense",party:x.cat,desc:x.desc,amt:x.amt,type:"expense"}));(data.vouchers||[]).filter(x=>x.date===dbDate).forEach(x=>all.push({module:"Voucher",party:x.party,desc:x.desc,amt:x.amt,type:x.vtype==="in"?"income":"expense"}));return all;},[data,dbDate]);

  /* GST Report */
  const gstReport=useMemo(()=>{
    try{
      const sl=rData.sales||[];const pu=rData.purchases||[];
      const output=sl.reduce((a,s)=>{try{const c=cS(s);return{basic:a.basic+(c.basic||0),gst:a.gst+(c.g||0)};}catch{return a;}},{basic:0,gst:0});
      const input=pu.reduce((a,p)=>{try{const c=cP(p);return{basic:a.basic+(c.b||0),gst:a.gst+(c.ga||0)};}catch{return a;}},{basic:0,gst:0});
      const net=output.gst-input.gst;
      const unclaimed=pu.filter(p=>!p.itcClaimed).reduce((a,p)=>{try{return a+cP(p).ga;}catch{return a;}},0);
      /* HSN/SAC-wise GST breakdown */
      const hsnMap={};sl.forEach(s=>{(s.lineItems||[]).forEach(li=>{const k=li.hsn||li.sac||"N/A";const b=(li.qty||0)*(li.rate||0)*(1-(li.disc||0)/100);const g=b*(li.gst||0)/100;if(!hsnMap[k])hsnMap[k]={hsn:k,desc:li.desc||li.item||"",gst:li.gst||0,taxable:0,cgst:0,sgst:0,igst:0,total:0};hsnMap[k].taxable+=b;hsnMap[k].cgst+=g/2;hsnMap[k].sgst+=g/2;hsnMap[k].total+=b+g;});});
      return{output,input,net,unclaimed,hsnRows:Object.values(hsnMap)};
    }catch(e){return{output:{basic:0,gst:0},input:{basic:0,gst:0},net:0,unclaimed:0,hsnRows:[]};}
  },[rData]);

  const SITE_LIST=[{id:"ALL",name:"All Sites"},...masters.sites.map(s=>({id:s.id,name:s.name}))];
  const siteOpts=[{v:"",l:"Select Site"},{v:"CONSULTANCY",l:"🎓 Consultancy"},{v:"OFFICE",l:"🏢 Head Office"},{v:"GODOWN",l:"🏭 Godown"},...masters.sites.map(s=>({v:s.id,l:s.name}))];
  const bankOpts=masters.banks.map(b=>({v:b.id,l:b.name}));
  const pettyOpts=masters.pettyCash.map(p=>({v:p.id,l:p.name}));
  const gOpts=[0,5,12,18,28];
  const TABS=MOD_GROUPS.filter(t=>can(t.id));
  const MTABS=[{k:"sites",l:"Sites"},{k:"clients",l:"Clients"},{k:"vendors",l:"Vendors"},{k:"items",l:"Items"},{k:"services",l:"Services"},{k:"labours",l:"HR"},{k:"machinery",l:"Machinery"},{k:"banks",l:"Banks"},{k:"pettyCash",l:"Petty Cash"},{k:"godowns",l:"Godowns"},{k:"users",l:"Users"},{k:"expenseCats",l:"Exp.Cats"},{k:"company",l:"Company"}];
  const curTab=TABS.find(t=>t.id===tab)||TABS[0]||{};

  /* Print handlers for reports */
  const printPL=()=>{const rows=[["INCOME","",true],["Basic Revenue",INR(rk.tB),false],["GST Output",INR(rk.tG),false],["","",false],["COST OF WORK","",true],["Materials",INR(rk.pB),false],["Expenses",INR(rk.tE),false],["Payroll",INR(rk.tP),false],["Total Cost",INR(rk.pB+rk.tE+rk.tP),false],["","",false],["GROSS PROFIT",INR(rk.profit),true],["Margin",rk.margin+"%",true]];const trs=rows.map(([l,v,h])=>l?"<tr><td style=\"padding:6px 10px;border-bottom:1px solid #f1f5f9;font-weight:"+(h?700:400)+";color:"+(h?"#F59E0B":"#333")+"\">" +l+"</td><td style=\"padding:6px 10px;text-align:right;font-weight:"+(h?700:400)+"\">" +v+"</td></tr>":"<tr><td colspan=2 style=\"padding:4px\"></td></tr>").join("");genGenericPrint("Profit & Loss Statement","<table style=\"width:100%;border-collapse:collapse\">"+trs+"</table><div style=\"padding:10px;background:#f8fafc;border-radius:4px;margin-top:10px;font-size:11px;color:#64748b\">Period: "+rpFrom+" to "+rpTo+"</div>",co);};
  const printBS=()=>{const bs=balanceSheet;const mkRow=(l,v)=>"<div style=\"display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f1f5f9\"><span>"+l+"</span><span style=\"font-weight:600\">"+v+"</span></div>";const assets=[["Bank & Cash",INR(bs.bankBal+bs.pettyBal)],["Accounts Receivable",INR(bs.receivables)],["Inventory",INR(bs.invValue)],["Loans Given",INR(bs.loansGiven)]].map(([l,v])=>mkRow(l,v)).join("");const liabs=[["Accounts Payable",INR(bs.payables)],["Loans Borrowed",INR(bs.loansBorrowed)],["GST Payable",INR(bs.gstPayable)],["TDS Payable",INR(bs.tdsPayable)]].map(([l,v])=>mkRow(l,v)).join("");const equityRow=mkRow("Net Equity","<span style=\"color:"+(bs.equity>=0?"#34D399":"#F87171")+"\">"+INR(bs.equity)+"</span>");const html="<div style=\"display:grid;grid-template-columns:1fr 1fr;gap:20px\"><div><h3 style=\"color:#34D399;margin:0 0 10px\">ASSETS</h3>"+assets+"<div style=\"display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid #34D399;font-weight:700;font-size:14px\"><span>Total Assets</span><span style=\"color:#34D399\">"+INR(bs.totalAssets)+"</span></div></div><div><h3 style=\"color:#F87171;margin:0 0 10px\">LIABILITIES &amp; EQUITY</h3>"+liabs+equityRow+"<div style=\"display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid #F87171;font-weight:700;font-size:14px\"><span>Total L+E</span><span style=\"color:#F87171\">"+INR(bs.totalLiab+Math.max(0,bs.equity))+"</span></div></div></div>";genGenericPrint("Balance Sheet",html,co);};
  const printLedger=()=>{const trs=ledger.map(r=>"<tr><td style=\"padding:5px 8px;border-bottom:1px solid #f1f5f9\">"+r.date+"</td><td>"+r.ref+"</td><td>"+r.desc+"</td><td style=\"text-align:right\">"+(r.dr>0?INR(r.dr):"—")+"</td><td style=\"text-align:right\">"+(r.cr>0?INR(r.cr):"—")+"</td><td style=\"text-align:right;font-weight:700\">"+INR(r.bal)+"</td></tr>").join("");const ths=["Date","Ref","Description","Debit","Credit","Balance"].map(h=>"<th style=\"padding:7px 10px;text-align:left\">"+h+"</th>").join("");genGenericPrint("Account Ledger — "+ledName,"<table style=\"width:100%;border-collapse:collapse\"><thead><tr style=\"background:#060C1A;color:#F59E0B\">"+ths+"</tr></thead><tbody>"+trs+"</tbody></table>",co);};
  const printDayBook=()=>{const trs=dayBookEntries.map(e=>"<tr><td style=\"padding:5px 8px;border-bottom:1px solid #f1f5f9\">"+e.module+"</td><td>"+e.party+"</td><td>"+e.desc+"</td><td style=\"color:"+(e.type==="income"?"#34D399":"#F87171")+";font-weight:600\">"+(e.type==="income"?"IN":"OUT")+"</td><td style=\"text-align:right;font-weight:700\">"+INR(e.amt)+"</td></tr>").join("");const ths=["Module","Party","Description","Flow","Amount"].map(h=>"<th style=\"padding:7px 10px;text-align:left\">"+h+"</th>").join("");genGenericPrint("Day Book — "+dbDate,"<table style=\"width:100%;border-collapse:collapse\"><thead><tr style=\"background:#060C1A;color:#F59E0B\">"+ths+"</tr></thead><tbody>"+trs+"</tbody></table>",co);};

  /* ══════════════════ RENDER ══════════════════ */
  const fStyle=settings.font==="sans"?"Arial,sans-serif":settings.font==="serif"?"Georgia,serif":"'Courier New',monospace";
  return <div style={{height:"100vh",overflow:"hidden",display:"flex",flexDirection:"column",background:C.bg1,color:"#E2E8F0",fontFamily:fStyle,fontSize:settings.fontSize||12}}>
    {/* TOP BAR */}
    <div style={{background:"linear-gradient(90deg,#060C1A,#0A1223)",borderBottom:"1px solid #1A2840",padding:"0 20px",display:"flex",alignItems:"center",gap:12,height:50,position:"sticky",top:0,zIndex:100,boxShadow:"0 4px 20px rgba(0,0,0,.5)"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:34,height:34,background:`linear-gradient(135deg,${G(C.or,0.2)},${G(C.or,0.05)})`,borderRadius:9,border:`1px solid ${G(C.or,0.3)}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🏗</div><div><div style={{color:C.or,fontWeight:800,fontSize:14,letterSpacing:3,lineHeight:1}}>SITE LEDGER</div><div style={{color:"#1E3A5F",fontSize:9,letterSpacing:1}}>CIVIL ERP v9</div></div></div>
      <div style={{flex:1}}/><Clock/>
      <div style={{width:1,background:"#1E2D45",height:26}}/>
      <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:28,height:28,borderRadius:"50%",background:`linear-gradient(135deg,${G(C.pu,0.3)},${G(C.bl,0.2)})`,border:`1px solid ${G(C.pu,0.4)}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>👤</div><div><div style={{color:"#E2E8F0",fontSize:11,fontWeight:700}}>{user.name}</div><div style={{color:C.gr,fontSize:9}}>{user.role}</div></div></div>
      <button onClick={onLogout} style={{padding:"5px 12px",borderRadius:7,border:"1px solid rgba(248,113,113,.3)",background:"rgba(248,113,113,.08)",color:C.rd,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>↩ Logout</button>
    </div>
    <div style={{display:"flex",flex:1,overflow:"hidden"}}>
      {/* SIDEBAR */}
      <div style={{width:168,background:"linear-gradient(180deg,#060C1A,#08101E)",borderRight:"1px solid #1A2840",flexShrink:0,overflowY:"auto",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"10px 8px 8px",borderBottom:"1px solid #1A2840"}}>
          <div style={{color:"#1E3A5F",fontSize:9,letterSpacing:1.5,marginBottom:6,paddingLeft:2,textTransform:"uppercase"}}>Site Filter</div>
          {SITE_LIST.map(s=>{const active=site===s.id;return <div key={s.id} onClick={()=>setSite(s.id)} style={{padding:"5px 8px",borderRadius:7,marginBottom:2,cursor:"pointer",background:active?G(C.or,0.1):"transparent",borderLeft:"2px solid "+(active?C.or:"transparent")}}><div style={{color:active?C.or:"#334155",fontSize:10,fontWeight:active?700:400,lineHeight:1.3}}>{s.name}</div></div>;})}
        </div>
        <div style={{padding:"10px 6px",flex:1}}>
          <div style={{color:"#1E3A5F",fontSize:9,letterSpacing:1.5,marginBottom:8,paddingLeft:4,textTransform:"uppercase"}}>Modules</div>
          {TABS.map(t=>{const active=tab===t.id;return <button key={t.id} onClick={()=>setTab(t.id)} style={{display:"flex",alignItems:"center",gap:8,width:"100%",textAlign:"left",padding:"8px 10px",borderRadius:9,marginBottom:3,color:"#E2E8F0",background:active?`linear-gradient(135deg,${G(t.color,0.15)},${G(t.color,0.05)})`:"transparent",border:`1px solid ${active?G(t.color,0.3):"transparent"}`,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:active?700:400,boxShadow:active?"0 2px 12px rgba(0,0,0,.4)":"none"}}><span style={{fontSize:14,filter:active?"none":"grayscale(1) opacity(.4)"}}>{t.icon}</span><div style={{flex:1}}><div style={{color:active?t.color:"#4B6180",fontWeight:active?700:400,fontSize:10}}>{t.l}</div>{active&&<div style={{color:G(t.color,0.8),fontSize:8,marginTop:1}}>{t.desc}</div>}</div>{active&&<div style={{width:4,height:4,borderRadius:"50%",background:t.color}}/>}</button>;})}
        </div>
        <div style={{padding:"8px",borderTop:"1px solid #1A2840",background:"#060C1A"}}><div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 8px",borderRadius:7,background:"rgba(245,158,11,.05)",border:"1px solid rgba(245,158,11,.1)"}}><span style={{fontSize:14}}>🏗</span><div style={{flex:1}}><div style={{color:C.or,fontSize:9,fontWeight:700,letterSpacing:1}}>SITE LEDGER</div><div style={{color:"#1E3A5F",fontSize:8}}>v9 — Build 2025</div></div></div></div>
      </div>
      {/* CONTENT */}
      <div style={{flex:1,overflowY:"auto",overflowX:"hidden",background:C.bg2}}>
        <div style={{padding:"14px 18px 0",display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,borderBottom:"1px solid #1A2840",paddingBottom:14,background:"linear-gradient(180deg,#060C1A,transparent)"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:40,height:40,borderRadius:10,background:`linear-gradient(135deg,${G(curTab.color||C.or,0.2)},${G(curTab.color||C.or,0.05)})`,border:`1px solid ${G(curTab.color||C.or,0.3)}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{curTab.icon}</div><div><h2 style={{margin:0,color:"#E2E8F0",fontSize:16,fontWeight:700}}>{curTab.l}</h2><div style={{color:C.gr,fontSize:10,marginTop:1}}>{site==="ALL"?"All Sites":sName(site)} · {user.role}</div></div></div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
            {tab==="dash"&&<Btn onClick={()=>setShowKPIs(!showKPIs)} color={C.gr} icon={showKPIs?"🙈":"👁"}>{showKPIs?"Hide KPIs":"Show KPIs"}</Btn>}
            {tab==="dpr"&&site!=="ALL"&&<Btn onClick={()=>openAdd("dpr")} color={C.bl} icon="＋">Add DPR</Btn>}
            {tab==="sales"&&salesSub==="so"&&site!=="ALL"&&<Btn onClick={()=>openAdd("so")} color={C.gn} icon="＋">Sale Order</Btn>}
            {tab==="sales"&&salesSub==="inv"&&site!=="ALL"&&<Btn onClick={()=>openAdd("sales")} color={C.gn} icon="＋">Invoice</Btn>}
            {tab==="sales"&&salesSub==="est"&&site!=="ALL"&&<Btn onClick={()=>openAdd("estimate")} color={C.gn} icon="＋">Estimate</Btn>}
            {tab==="sales"&&salesSub==="proforma"&&site!=="ALL"&&<Btn onClick={()=>openAdd("proforma")} color={C.gn} icon="＋">Proforma</Btn>}
            {tab==="sales"&&salesSub==="dn"&&site!=="ALL"&&<Btn onClick={()=>openAdd("debitNote")} color={C.rd} icon="＋">Debit Note</Btn>}
            {tab==="sales"&&salesSub==="otherincome"&&<Btn onClick={()=>openAdd("otherincome")} color={C.tl} icon="＋">Add Income</Btn>}
            {tab==="purchase"&&purchSub==="po"&&site!=="ALL"&&<Btn onClick={()=>openAdd("po")} color={C.rd} icon="＋">Purchase Order</Btn>}
            {tab==="purchase"&&purchSub==="bills"&&site!=="ALL"&&<Btn onClick={()=>openAdd("purch")} color={C.rd} icon="＋">Purchase Bill</Btn>}
            {tab==="purchase"&&purchSub==="exp"&&site!=="ALL"&&<Btn onClick={()=>openAdd("exp")} color={C.rd} icon="＋">Expense</Btn>}
            {tab==="purchase"&&purchSub==="cn"&&site!=="ALL"&&<Btn onClick={()=>openAdd("creditNote")} color={C.rd} icon="＋">Credit Note</Btn>}
            {tab==="hr"&&hrSub==="att"&&site!=="ALL"&&<Btn onClick={()=>openAdd("att")} color={C.pu} icon="＋">Attendance</Btn>}
            {tab==="hr"&&hrSub==="pay"&&site!=="ALL"&&<Btn onClick={()=>openAdd("pay")} color={C.pu} icon="＋">Payroll</Btn>}
            {tab==="hr"&&hrSub==="wc"&&<Btn onClick={()=>openAdd("wc")} color={C.bl} icon="＋">Add Policy</Btn>}
            {tab==="accounts"&&accSub==="vouchers"&&<Btn onClick={()=>openAdd("vouchers")} color={C.or} icon="＋">Voucher</Btn>}
            {tab==="accounts"&&accSub==="contra"&&<Btn onClick={()=>openAdd("contra")} color={C.or} icon="＋">Contra</Btn>}
            {tab==="accounts"&&accSub==="loans"&&<Btn onClick={()=>openAdd("loans")} color={C.or} icon="＋">Loan</Btn>}
            {tab==="inventory"&&invSub==="stock"&&<Btn onClick={()=>openAdd("inventory")} color={C.or} icon="＋">Stock Entry</Btn>}
            {tab==="inventory"&&invSub==="recv"&&<Btn onClick={()=>openAdd("matreceipt")} color={C.or} icon="＋">Receive Material</Btn>}
            {tab==="inventory"&&invSub==="transfer"&&<Btn onClick={()=>openAdd("transfers")} color={C.or} icon="＋">Transfer</Btn>}
            {tab==="masters"&&can("masters")&&<Btn onClick={()=>openMAdd(mTab)} color={C.or} icon="＋">Add</Btn>}
          </div>
        </div>
        <div style={{padding:"0 18px 24px"}}>

        {/* ══ DASHBOARD ══ */}
        {tab==="dash"&&<div>
          {isApprover && (data.pendingApprovals||[]).length > 0 && <div style={{...ss.card, padding: 14, marginBottom: 14, border: "1px solid "+C.or}}>
            <div style={{color:C.or, fontWeight:700, fontSize:14, marginBottom: 10}}>Pending Approvals ({(data.pendingApprovals||[]).length})</div>
            <table style={{width:"100%", borderCollapse:"collapse", color:C.rd}}>
              <thead><tr>{["Requested By","Module","Action","Details","Action"].map(h=><th key={h} style={{...ss.th, padding:"8px", fontSize:11}}>{h}</th>)}</tr></thead>
              <tbody>
                {(data.pendingApprovals||[]).map(a => (
                  <tr key={a.id} style={{borderBottom: BD}}>
                    <td style={{...ss.td, padding:"8px", fontSize:11}}>{a.requestedBy}</td>
                    <td style={{...ss.td, padding:"8px", fontSize:11}}>{a.targetKey}</td>
                    <td style={{...ss.td, padding:"8px", fontSize:11}}><Tag c={a.action==="delete"?"r":a.action==="edit"?"o":"g"} ch={a.action.toUpperCase()}/></td>
                    <td style={{...ss.td, padding:"8px", fontSize:11, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{a.action==="delete"?"DELETE":(a.payload?JSON.stringify(a.payload).substring(0,60)+"...":"-")}</td>
                    <td style={{...ss.td, padding:"8px", fontSize:11}}>
                      <div style={{display:"flex", gap:4}}>
                        <Btn sm onClick={()=>handleApprove(a)}>Approve</Btn>
                        <Btn sm color={C.rd} onClick={()=>handleReject(a)}>Reject</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
          {showKPIs && <div style={{marginBottom:14}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:10}}>
              <KCard icon="💰" label="Revenue" value={INR(k.tB)} sub={"GST "+INR(k.tG)} color={C.tl}/>
              <KCard icon="📈" label="Gross Profit" value={INR(k.profit)} sub={"Margin "+k.margin+"%"} color={k.profit>=0?C.gn:C.rd}/>
              <KCard icon="🏦" label="Bank Balance" value={INR(k.totalBankBal)} sub={masters.banks.length+" accounts"} color={C.or}/>
              <KCard icon="💵" label="Petty Cash" value={INR(k.totalPettyBal)} sub={masters.pettyCash.length+" books"} color={C.pu}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
              <KCard icon="🛒" label="Material Cost" value={INR(k.pB)} sub={"ITC "+INR(k.pG)} color={C.rd}/>
              <KCard icon="🔧" label="Expenses" value={INR(k.tE)} color={C.rd}/>
              <KCard icon="👷" label="Payroll Net" value={INR(k.tP)} color={C.bl}/>
              <KCard icon="⏳" label="Net Receivable" value={INR(k.net)} color={C.pu}/>
            </div>
          </div>}
          </div>}

          {/* ══ JOB ORDER BUDGET TRACKING ══ */}
          {fData.jobOrders?.length > 0 && <div style={{...ss.card, padding:14, marginBottom:12, background:"linear-gradient(135deg,#0E1628,#0A1223)"}}>
            <div style={{color:C.si,fontSize:10,letterSpacing:1,marginBottom:10,textTransform:"uppercase"}}>Job Order Budget Tracking</div>
            {fData.jobOrders.map(jo => {
              const so = (data.saleOrders||[]).find(s=>s.id===jo.soId);
              const totMatB = jo.tasks?.reduce((a,t)=>a+(Number(t.matBudget)||0),0)||0;
              const totLabB = jo.tasks?.reduce((a,t)=>a+(Number(t.labBudget)||0),0)||0;
              const totMacB = jo.tasks?.reduce((a,t)=>a+(Number(t.macBudget)||0),0)||0;
              const actMat = (data.purchases||[]).filter(p=>p.jobOrderId===jo.id).reduce((a,p)=>a+((p.qty||0)*(p.rate||0)*(1+(p.gst||18)/100)),0);
              const actLab = (data.payroll||[]).filter(p=>p.jobOrderId===jo.id).reduce((a,p)=>a+(cW(p).gr),0);
              const actMac = (data.expenses||[]).filter(e=>e.jobOrderId===jo.id).reduce((a,e)=>a+(Number(e.amt)||0),0);
              const mRatio = totMatB ? (actMat/totMatB)*100 : (actMat > 0 ? 100 : 0);
              const lRatio = totLabB ? (actLab/totLabB)*100 : (actLab > 0 ? 100 : 0);
              const macRatio = totMacB ? (actMac/totMacB)*100 : (actMac > 0 ? 100 : 0);
              return (
                <div key={jo.id} style={{marginBottom:10, paddingBottom:10, borderBottom:"1px solid #1A2840"}}>
                  <div style={{display:"flex", justifyContent:"space-between", marginBottom:6}}>
                    <div>
                      <b style={{color:C.pu}}>{jo.joNo}</b> <span style={{color:C.si, fontSize:10}}>({sName(jo.siteId)})</span>
                      {so && <div style={{color:C.gr, fontSize:9}}>{so.desc}</div>}
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{color:C.or, fontWeight:700, fontSize:12}}>{INR(totMatB+totLabB+totMacB)} Budget</div>
                      <div style={{color: (actMat+actLab+actMac) > (totMatB+totLabB+totMacB) ? C.rd : C.gn, fontSize:11}}>
                        {INR(actMat+actLab+actMac)} Actual
                      </div>
                    </div>
                  </div>
                  <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10}}>
                    <div>
                      <div style={{display:"flex", justifyContent:"space-between", fontSize:9, color:C.si}}><span>Material</span><span style={{color:mRatio>100?C.rd:C.si}}>{Math.round(mRatio)}%</span></div>
                      <div style={{height:4, background:"#060C1A", borderRadius:2, marginTop:2}}><div style={{height:"100%", width:Math.min(mRatio,100)+"%", background:mRatio>100?C.rd:C.tl, borderRadius:2}}/></div>
                    </div>
                    <div>
                      <div style={{display:"flex", justifyContent:"space-between", fontSize:9, color:C.si}}><span>Labour</span><span style={{color:lRatio>100?C.rd:C.si}}>{Math.round(lRatio)}%</span></div>
                      <div style={{height:4, background:"#060C1A", borderRadius:2, marginTop:2}}><div style={{height:"100%", width:Math.min(lRatio,100)+"%", background:lRatio>100?C.rd:C.pu, borderRadius:2}}/></div>
                    </div>
                    <div>
                      <div style={{display:"flex", justifyContent:"space-between", fontSize:9, color:C.si}}><span>Machinery</span><span style={{color:macRatio>100?C.rd:C.si}}>{Math.round(macRatio)}%</span></div>
                      <div style={{height:4, background:"#060C1A", borderRadius:2, marginTop:2}}><div style={{height:"100%", width:Math.min(macRatio,100)+"%", background:macRatio>100?C.rd:C.or, borderRadius:2}}/></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>}

          <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:12,marginBottom:12}}>
            <MiniCalendar/>
            <div style={{...ss.card,padding:14,background:"linear-gradient(135deg,#0E1628,#0A1223)"}}><div style={{color:C.si,fontSize:10,marginBottom:10,letterSpacing:1,textTransform:"uppercase"}}>Financial Year {getFYStr()}</div>{[["Revenue",INR(k.tB),C.tl],["Expenses",INR(k.pB+k.tE),C.rd],["Payroll",INR(k.tP),C.pu],["Profit",INR(k.profit),k.profit>=0?C.gn:C.rd]].map(([l,v,c])=><div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #0A1223"}}><span style={{color:C.si,fontSize:11}}>{l}</span><span style={{color:c,fontWeight:700,fontFamily:"monospace"}}>{v}</span></div>)}</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:12}}>
            <div style={{...ss.card,padding:16}}><div style={{color:C.si,fontSize:10,letterSpacing:1,marginBottom:12,textTransform:"uppercase"}}>Monthly Revenue / Cost / Profit</div>
              <ResponsiveContainer width="100%" height={170}><BarChart data={mChart} barGap={3}><XAxis dataKey="mo" tick={{fill:"#334155",fontSize:9}} axisLine={false} tickLine={false}/><YAxis tick={{fill:"#334155",fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>"₹"+Math.round(v/100000)+"L"}/><Tooltip formatter={v=>INR(v)} contentStyle={TT}/><Bar dataKey="rev" fill={C.tl} radius={[4,4,0,0]} name="Revenue"/><Bar dataKey="cost" fill={C.rd} radius={[4,4,0,0]} name="Cost"/><Bar dataKey="profit" fill={C.or} radius={[4,4,0,0]} name="Profit"/></BarChart></ResponsiveContainer>
            </div>
            <div style={{...ss.card,padding:16}}><div style={{color:C.si,fontSize:10,letterSpacing:1,marginBottom:12,textTransform:"uppercase"}}>Expense Breakdown</div>
              <ResponsiveContainer width="100%" height={160}><PieChart><Pie data={ePie} cx="50%" cy="50%" outerRadius={60} dataKey="value" label={({name,percent})=>name+" "+(percent*100).toFixed(0)+"%"} labelLine={false} fontSize={9}>{ePie.map((_,i)=><Cell key={i} fill={PC[i%PC.length]}/>)}</Pie><Tooltip formatter={v=>INR(v)} contentStyle={TT}/></PieChart></ResponsiveContainer>
            </div>
          </div>
        </div>}

        {/* ══ DPR (linked to Sale Order) ══ */}
        {tab==="dpr"&&<div>
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            <Sel val={dprSite} onChange={setDprSite} opts={[{v:"all",l:"All Sites"},...masters.sites.map(s=>({v:s.id,l:s.name}))]}/>
          </div>
          {(data.dpr||[]).filter(d=>dprSite==="all"||d.siteId===dprSite).map((d,di)=>{const so=(data.saleOrders||[]).find(s=>s.id===d.soId);return(
            <div key={di} style={{...ss.card,marginBottom:14,overflow:"hidden"}}>
              <div style={{padding:"10px 16px",borderBottom:BD,display:"flex",justifyContent:"space-between",alignItems:"center",background:G(C.bl,0.06)}}>
                <div><span style={{color:C.or,fontWeight:700,fontSize:12}}>DPR — {d.date}</span><span style={{color:C.gr,fontSize:10,marginLeft:10}}>{sName(d.siteId)}</span>{so&&<span style={{color:C.tl,fontSize:10,marginLeft:10}}>SO: {so.desc}</span>}</div>
                <div style={{display:"flex",gap:12,fontSize:10}}><span style={{color:C.si}}>Supervisor: <b style={{color:C.pu}}>{d.supervisor}</b></span><span style={{color:C.si}}>Workers: <b style={{color:C.tl}}>{d.workers}</b></span><span style={{color:C.si}}>Weather: <span style={{color:C.bl}}>{d.weather}</span></span></div>
              </div>
              {d.clientInstructions&&<div style={{padding:"7px 16px",background:G(C.or,0.05),borderBottom:BD,fontSize:11}}><span style={{color:C.or,fontWeight:700}}>📌 Client Instructions: </span><span style={{color:"#CBD5E1"}}>{d.clientInstructions}</span></div>}
              <table style={{borderCollapse:"collapse",width:"100%",fontSize:11}}>
                <thead><tr style={{background:"#060C1A"}}><th style={ss.th}>Type</th><th style={ss.th}>Item / Service</th><th style={ss.th}>Completed Qty</th><th style={ss.th}>Unit</th><th style={ss.th}>Remarks</th></tr></thead>
                <tbody>{(d.entries||[]).map((e,i)=><tr key={i}><td style={ss.td}><Tag c={e.type==="service"?"b":"o"} ch={e.type}/></td><td style={ss.td}>{e.name}</td><td style={{...ss.td,color:C.gn,fontWeight:700}}>{e.completedQty}</td><td style={ss.td}>{e.unit}</td><td style={{...ss.td,color:C.gr}}>{e.remarks}</td></tr>)}</tbody>
              </table>
              {d.soId&&so&&<div style={{padding:"8px 16px",borderTop:BD,background:G(C.tl,0.04)}}>
                <div style={{color:C.tl,fontSize:10,fontWeight:700,marginBottom:6,letterSpacing:1}}>SO PROGRESS TRACKER</div>
                {getSoProgress(d.soId).map((p,i)=>{const pct=p.estimated?Math.min(100,Math.round(p.completed/p.estimated*100)):0;return <div key={i} style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:3}}><span style={{color:C.si}}>{p.desc}</span><span style={{color:C.gr}}>Est: {p.estimated} {p.unit} | Done: <b style={{color:C.gn}}>{p.completed}</b> | Balance: <b style={{color:C.rd}}>{p.balance}</b></span></div>
                  <div style={{height:5,background:"#0A1223",borderRadius:3}}><div style={{height:"100%",width:pct+"%",background:`linear-gradient(90deg,${C.tl},${G(C.tl,0.5)})`,borderRadius:3}}/></div>
                  <div style={{color:"#1E2D45",fontSize:9,marginTop:1}}>{pct}% complete</div>
                </div>;})}
              </div>}
              {d.remarks&&<div style={{padding:"7px 16px",fontSize:11,color:"#4B6180",borderTop:BD}}>📝 {d.remarks}</div>}
              {(d.images||[]).length>0&&<div style={{padding:"8px 16px",borderTop:BD,display:"flex",gap:8,flexWrap:"wrap"}}>{d.images.map((img,i)=><img key={i} src={img} style={{height:64,borderRadius:6,objectFit:"cover",border:"1px solid "+C.br,cursor:"pointer"}} onClick={()=>window.open(img,"_blank")}/>)}</div>}
              <div style={{padding:"8px 16px",borderTop:BD,display:"flex",gap:6,justifyContent:"flex-end"}}>
                <button onClick={()=>openEdit("dpr",d)} style={{padding:"4px 12px",borderRadius:6,border:"1px solid rgba(245,158,11,.3)",background:"rgba(245,158,11,.1)",color:C.or,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>✎ Edit DPR</button>
                <button onClick={()=>setDel({key:"dpr",id:d.id,label:"DPR — "+d.date})} style={{padding:"4px 12px",borderRadius:6,border:"1px solid rgba(248,113,113,.3)",background:"rgba(248,113,113,.1)",color:C.rd,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>🗑 Delete</button>
              </div>
            </div>
          );})}
        </div>}

        {/* ══ SALES (SO | Invoices | Estimates | Proforma | Debit Notes | Job Orders) ══ */}
        {tab==="sales"&&<div>
          <SubTabs val={salesSub} onChange={setSalesSub} tabs={[{v:"so",l:"Sale Orders",icon:"📑"},{v:"jo",l:"Job Orders",icon:"📋"},{v:"inv",l:"Invoices",icon:"🧾"},{v:"est",l:"Estimates",icon:"📝"},{v:"proforma",l:"Proforma",icon:"📄"},{v:"dn",l:"Debit Notes",icon:"⬆"},{v:"otherincome",l:"Other Income",icon:"💹"}]}/>
          {salesSub==="so"&&<div>
            <div style={{...ss.card,overflowX:"auto"}}>
              <table style={{borderCollapse:"collapse",width:"100%"}}>
                <thead><tr style={{background:"#060C1A"}}>{["Date","Site","Client","Description","Order Value","Billed","Remaining","Converted","Status","Actions"].map(h=><th key={h} style={ss.th}>{h}</th>)}</tr></thead>
                <tbody>{(fData.saleOrders||[]).length===0?<tr><td colSpan={10} style={{...ss.td,textAlign:"center",color:"#334155",padding:32}}>No Sale Orders</td></tr>:(fData.saleOrders||[]).map((r,idx)=>{
                  const li=calcLI(r.lineItems||[]);const tv=li.total||0;
                  const billed=(fData.sales||[]).filter(s=>s.soId===r.id).reduce((a,s)=>a+cS(s).basic,0);
                  const convd=(r.convertedInvs||[]).length;
                  return <tr key={idx} onMouseEnter={e=>e.currentTarget.style.background="#0A1223"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                    <td style={ss.td}>{r.date}</td><td style={ss.td}>{sName(r.siteId)}</td><td style={ss.td}>{r.client}</td><td style={ss.td}>{r.desc}</td>
                    <td style={ss.td}><b style={{color:C.or}}>{INR(tv)}</b></td>
                    <td style={ss.td}><span style={{color:C.gn}}>{INR(billed)}</span></td>
                    <td style={ss.td}><span style={{color:C.rd}}>{INR(tv-billed)}</span></td>
                    <td style={ss.td}>{convd>0?<Tag c="g" ch={convd+" inv"}/>:<Tag c="r" ch="None"/>}</td>
                    <td style={ss.td}><Tag c={r.status==="Active"?"g":"r"} ch={r.status}/></td>
                    <td style={ss.td}><div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                      {r.status==="Active"&&<button onClick={()=>convertSoToInv(r)} style={{padding:"3px 9px",borderRadius:6,border:"1px solid rgba(52,211,153,.4)",background:"rgba(52,211,153,.12)",color:C.gn,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700,whiteSpace:"nowrap"}}>→ Invoice</button>}
                      <button onClick={()=>setModal({t:"soProgress",so:r})} style={{padding:"3px 9px",borderRadius:6,border:"1px solid rgba(45,212,191,.3)",background:"rgba(45,212,191,.1)",color:C.tl,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>📊</button>
                      <button onClick={()=>{genInv({...r,inv:r.id},co,masters.clients.find(c=>c.name===r.client),{isEstimate:true});}} style={{padding:"3px 9px",borderRadius:6,border:"1px solid rgba(167,139,250,.3)",background:"rgba(167,139,250,.1)",color:C.pu,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>🖨</button>
                      <button onClick={()=>openEdit("so",r)} style={{padding:"3px 9px",borderRadius:6,border:"1px solid rgba(245,158,11,.3)",background:"rgba(245,158,11,.1)",color:C.or,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Edit</button>
                      <button onClick={()=>setDel({key:"saleOrders",id:r.id,label:r.desc})} style={{padding:"3px 9px",borderRadius:6,border:"1px solid rgba(248,113,113,.3)",background:"rgba(248,113,113,.1)",color:C.rd,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Del</button>
                    </div></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </div>}
          {salesSub==="jo"&&<div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:12}}>
              <Btn onClick={()=>openAdd("jo")} color={C.or} icon="➕">New Job Order</Btn>
            </div>
            <div style={{...ss.card,overflowX:"auto"}}>
              <table style={{borderCollapse:"collapse",width:"100%"}}>
                <thead><tr style={{background:"#060C1A"}}>{["Date","Job Order No","Sale Order Ref","Site","Total Est. Cost","Tasks","Actions"].map(h=><th key={h} style={ss.th}>{h}</th>)}</tr></thead>
                <tbody>{(fData.jobOrders||[]).length===0?<tr><td colSpan={7} style={{...ss.td,textAlign:"center",color:"#334155",padding:32}}>No Job Orders</td></tr>:(fData.jobOrders||[]).map((r,idx)=>{
                  const so = (data.saleOrders||[]).find(s=>s.id===r.soId);
                  const totalMat = (r.tasks||[]).reduce((a,t)=>a+(Number(t.matBudget)||0),0);
                  const totalLab = (r.tasks||[]).reduce((a,t)=>a+(Number(t.labBudget)||0),0);
                  const totalMac = (r.tasks||[]).reduce((a,t)=>a+(Number(t.macBudget)||0),0);
                  return <tr key={idx} onMouseEnter={e=>e.currentTarget.style.background="#0A1223"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                    <td style={ss.td}>{r.date}</td>
                    <td style={ss.td}><b style={{color:C.pu}}>{r.joNo}</b></td>
                    <td style={ss.td}>{so ? so.client+" — "+so.desc : "—"}</td>
                    <td style={ss.td}>{sName(r.siteId)}</td>
                    <td style={ss.td}><b style={{color:C.or}}>{INR(totalMat+totalLab+totalMac)}</b></td>
                    <td style={ss.td}>{r.tasks?.length||0} Tasks</td>
                    <td style={ss.td}><div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                      <button onClick={()=>openEdit("jo",r)} style={{padding:"3px 9px",borderRadius:6,border:"1px solid rgba(245,158,11,.3)",background:"rgba(245,158,11,.1)",color:C.or,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Edit</button>
                      <button onClick={()=>setDel({key:"jobOrders",id:r.id,label:r.joNo})} style={{padding:"3px 9px",borderRadius:6,border:"1px solid rgba(248,113,113,.3)",background:"rgba(248,113,113,.1)",color:C.rd,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Del</button>
                    </div></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </div>}
          {salesSub==="inv"&&<div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
              <KCard icon="💰" label="Basic Revenue" value={INR(k.tB)} color={C.tl}/><KCard icon="📊" label="GST Billed" value={INR(k.tG)} color={C.or}/><KCard icon="📉" label="TDS Deducted" value={INR(k.tTDS)} color={C.rd}/><KCard icon="🎯" label="Net Receivable" value={INR(k.net)} color={C.pu}/>
            </div>
            <SFilt val={fSt} onChange={setFSt}/>
            <Tbl cols={["Date","Site","Client","Invoice","Desc","Basic","Disc","GST","Net","Rcvd","Bal","EWB","Status"]}
              rows={byStatus(fData.sales||[],s=>cS(s).net).map(r=>{const c=cS(r),bal=c.net-(r.paidAmt||0),st=pSt(r.paidAmt||0,c.net);return[r.date,sName(r.siteId),r.client,<b key="i" style={{color:C.pu}}>{r.inv}</b>,r.desc,INR(c.basic),c.discount>0?<Tag key="d" c="g" ch={"–"+INR(c.discount)}/>:"—",<Tag key="g" c="o" ch="GST"/>,INR(c.net),<span key="p" style={{color:C.gn}}>{INR(r.paidAmt||0)}</span>,<b key="b" style={{color:bal>0?C.rd:C.gn}}>{INR(bal)}</b>,r.eWayBill?<Tag key="ew" c="b" ch="EWB"/>:"—",<Tag key="s" c={st==="Paid"?"g":st==="Partial"?"o":"r"} ch={st}/>];})}
              foot={["","","","","","Total","","",INR(k.net),"","","",""]}
              onEdit={i=>openEdit("sales",byStatus(fData.sales||[],s=>cS(s).net)[i])}
              onDel={i=>{const e=byStatus(fData.sales||[],s=>cS(s).net)[i];setDel({key:"sales",id:e.id,label:e.inv});}}
              onRcv={i=>openRcv("sales",byStatus(fData.sales||[],s=>cS(s).net)[i])} rcvLabel="Receive"
              onPrint={i=>{const e=byStatus(fData.sales||[],s=>cS(s).net)[i];const so=(data.saleOrders||[]).find(s=>s.id===e.soId);const abst=so?getSoProgress(e.soId).map((p,idx)=>{const il=e.lineItems&&e.lineItems[idx];return{...p,thisBill:il?il.qty:0};}):null;genInv(e,co,masters.clients.find(c=>c.name===e.client),{soAbstract:abst});}}
              csvName="sales"/>
          </div>}
          {salesSub==="est"&&<div>
            <Tbl cols={["Date","Site","Client","Est No","Description","Value","Valid Till","Status"]}
              rows={(fData.estimates||[]).map(r=>{const li=calcLI(r.lineItems||[]);return[r.date,sName(r.siteId),r.client,<b key="e" style={{color:C.pu}}>{r.estNo}</b>,r.desc,<b key="v" style={{color:C.or}}>{INR(li.total)}</b>,r.validTill||"—",<Tag key="s" c={r.status==="Approved"?"g":r.status==="Sent"?"b":"o"} ch={r.status||"Draft"}/>];})}
              onEdit={i=>openEdit("estimate",fData.estimates[i])}
              onDel={i=>setDel({key:"estimates",id:fData.estimates[i].id,label:fData.estimates[i].desc})}
              onPrint={i=>{const e=fData.estimates[i];genInv(e,co,masters.clients.find(c=>c.name===e.client),{isEstimate:true});}}
              csvName="estimates"/>
          </div>}
          {salesSub==="proforma"&&<div>
            <Tbl cols={["Date","Site","Client","PF No","Description","Value","Valid Till"]}
              rows={(fData.proforma||[]).map(r=>{const li=calcLI(r.lineItems||[]);return[r.date,sName(r.siteId),r.client,<b key="p" style={{color:C.pu}}>{r.pfNo}</b>,r.desc,<b key="v" style={{color:C.or}}>{INR(li.total)}</b>,r.validTill||"—"];})}
              onEdit={i=>openEdit("proforma",fData.proforma[i])}
              onDel={i=>setDel({key:"proforma",id:fData.proforma[i].id,label:fData.proforma[i].desc})}
              onPrint={i=>{const e=fData.proforma[i];genInv(e,co,masters.clients.find(c=>c.name===e.client),{isProforma:true});}}
              csvName="proforma"/>
          </div>}
          {salesSub==="dn"&&<div>
            <div style={{...ss.card,padding:"8px 14px",marginBottom:10,background:G(C.rd,0.07),border:`1px solid ${G(C.rd,0.2)}`}}><span style={{color:C.rd,fontSize:11}}>Debit Notes increase the amount receivable from client — price revisions, additional work, or extra charges.</span></div>
            <SFilt val={fSt} onChange={setFSt}/>
            <Tbl cols={["Date","Site","Client","DN No","Inv Ref","Reason","Value","Paid","Balance","Status"]}
              rows={byStatus(fData.debitNotes||[],d=>cS(d).net).map(r=>{const c=cS(r),bal=c.net-(r.paidAmt||0),st=pSt(r.paidAmt||0,c.net);return[r.date,sName(r.siteId),r.client,<b key="d" style={{color:C.rd}}>{r.dnNo}</b>,<span key="ref" style={{color:C.gr,fontSize:10}}>{r.invRef||"—"}</span>,r.reason,<b key="v" style={{color:C.or}}>{INR(c.net)}</b>,<span key="p" style={{color:C.gn}}>{INR(r.paidAmt||0)}</span>,<b key="b" style={{color:bal>0?C.rd:C.gn}}>{INR(bal)}</b>,<Tag key="s" c={st==="Paid"?"g":st==="Partial"?"o":"r"} ch={st}/>];})}
              onEdit={i=>openEdit("debitNote",byStatus(fData.debitNotes||[],d=>cS(d).net)[i])}
              onDel={i=>{const e=byStatus(fData.debitNotes||[],d=>cS(d).net)[i];setDel({key:"debitNotes",id:e.id,label:e.dnNo});}}
              onRcv={i=>openRcv("debitNotes",byStatus(fData.debitNotes||[],d=>cS(d).net)[i])} rcvLabel="Receive"
              onPrint={i=>{const e=byStatus(fData.debitNotes||[],d=>cS(d).net)[i];genInv(e,co,masters.clients.find(c=>c.name===e.client),{isDebit:true});}}
              csvName="debit_notes"/>
          </div>}

          {/* ── OTHER INCOME ── */}
          {salesSub==="otherincome"&&<div>
            <div style={{...ss.card,padding:"8px 14px",marginBottom:10,background:G(C.tl,0.06),border:"1px solid "+G(C.tl,0.2)}}><span style={{color:C.tl,fontSize:11}}>Other Income covers scrap sales, inventory disposals, labour outsourced to other contractors, interest income, etc.</span></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
              {["Scrap Sale","Labour Outsourced","Other"].map(cat=><KCard key={cat} icon="💹" label={cat} value={INR((fData.otherIncome||[]).filter(x=>x.cat===cat).reduce((a,b)=>a+b.amt,0))} color={C.tl}/>)}
            </div>
            <Tbl cols={["Date","Site","Category","Description","Amount","Via","Reference"]}
              rows={(fData.otherIncome||[]).map(r=>[r.date,sName(r.siteId),<Tag key="c" c="t" ch={r.cat}/>,r.desc,<b key="a" style={{color:C.tl}}>{INR(r.amt)}</b>,<Tag key="v" c={r.via==="bank"?"b":"o"} ch={r.via}/>,<span key="r" style={{color:C.gr,fontSize:10}}>{r.ref||"—"}</span>])}
              onEdit={i=>openEdit("otherincome",fData.otherIncome[i])}
              onDel={i=>setDel({key:"otherIncome",id:fData.otherIncome[i].id,label:fData.otherIncome[i].desc})}
              csvName="other_income"/>
            <div style={{...ss.card,padding:"8px 12px",marginTop:8,background:G(C.tl,0.04)}}><span style={{color:C.si,fontSize:10}}>Total Other Income: <b style={{color:C.tl}}>{INR((fData.otherIncome||[]).reduce((a,b)=>a+b.amt,0))}</b></span></div>
          </div>}
        </div>}

        {/* ══ PURCHASE ══ */}
        {tab==="purchase"&&<div>
          <SubTabs val={purchSub} onChange={setPurchSub} tabs={[{v:"po",l:"Purchase Orders",icon:"📋"},{v:"bills",l:"Purchase Bills",icon:"🧾"},{v:"exp",l:"Expenses",icon:"🔧"},{v:"cn",l:"Credit Notes",icon:"⬇"}]}/>
          {purchSub==="po"&&<Tbl cols={["Date","Site","Vendor","Description","Order Value","Received","Pending","Status"]}
            rows={(fData.purchaseOrders||[]).map(r=>{const li=calcLI(r.lineItems||[]);const tv=li.total||0;const recv=(fData.purchases||[]).filter(p=>p.poId===r.id).reduce((a,p)=>a+cP(p).b,0);return[r.date,sName(r.siteId),r.vendor,r.desc,<b key="t" style={{color:C.or}}>{INR(tv)}</b>,<span key="r" style={{color:C.gn}}>{INR(recv)}</span>,<span key="p" style={{color:C.rd}}>{INR(tv-recv)}</span>,<Tag key="s" c={r.status==="Active"?"g":"r"} ch={r.status}/>];})}
            onEdit={i=>openEdit("po",fData.purchaseOrders[i])} onDel={i=>setDel({key:"purchaseOrders",id:fData.purchaseOrders[i].id,label:fData.purchaseOrders[i].desc})}
            onPrint={i=>{const r=fData.purchaseOrders[i];genInv({...r,inv:r.id,tds:0,paidAmt:0},co,masters.vendors.find(v=>v.name===r.vendor),{isProforma:true});}}
            csvName="purchase_orders"/>}
          {purchSub==="bills"&&<div>
            <div style={{...ss.card,padding:"10px 14px",marginBottom:10,background:G(C.gn,0.06),border:"1px solid "+G(C.gn,0.2),display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{color:C.gn,fontSize:11}}>💡 ITC Summary — Claimed: <b>{INR((fData.purchases||[]).filter(p=>p.itcClaimed).reduce((a,p)=>a+cP(p).ga,0))}</b> &nbsp;|&nbsp; Pending: <b style={{color:C.or}}>{INR((fData.purchases||[]).filter(p=>!p.itcClaimed).reduce((a,p)=>a+cP(p).ga,0))}</b></span>
              <button onClick={()=>{upd("purchases",arr=>arr.map(p=>({...p,itcClaimed:true})));}} style={{padding:"4px 12px",borderRadius:6,border:"1px solid rgba(52,211,153,.4)",background:"rgba(52,211,153,.1)",color:C.gn,cursor:"pointer",fontFamily:"monospace",fontSize:10,fontWeight:700}}>Mark All Claimed</button>
            </div>
            <SFilt val={fSt} onChange={setFSt}/>
            <div style={{...ss.card,overflowX:"auto"}}>
              <table style={{borderCollapse:"collapse",width:"100%"}}>
                <thead><tr style={{background:"#060C1A"}}>{["Date","Site","Vendor","Item","HSN","Qty","Rate","Basic","GST%","Total","ITC","Paid","Balance","Status","Actions"].map(h=><th key={h} style={ss.th}>{h}</th>)}</tr></thead>
                <tbody>{byStatus(fData.purchases||[],p=>cP(p).tot).length===0?<tr><td colSpan={15} style={{...ss.td,textAlign:"center",color:"#334155",padding:32}}>No bills</td></tr>:byStatus(fData.purchases||[],p=>cP(p).tot).map((r,idx)=>{
                  const origIdx=(fData.purchases||[]).findIndex(x=>x.id===r.id);
                  const c=cP(r),bal=c.tot-(r.paidAmt||0),st=pSt(r.paidAmt||0,c.tot);
                  return <tr key={idx} onMouseEnter={e=>e.currentTarget.style.background="#0A1223"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                    <td style={ss.td}>{r.date}</td><td style={ss.td}>{sName(r.siteId)}</td><td style={ss.td}>{r.vendor}</td><td style={ss.td}>{r.item}</td>
                    <td style={ss.td}><span style={{color:C.gr,fontSize:10}}>{r.hsn||"—"}</span></td>
                    <td style={ss.td}>{r.qty}</td><td style={ss.td}>{INR(r.rate)}</td><td style={ss.td}>{INR(c.b)}</td>
                    <td style={ss.td}><Tag c="o" ch={r.gst+"%"}/></td>
                    <td style={ss.td}><b style={{color:C.or}}>{INR(c.tot)}</b></td>
                    <td style={ss.td}><Tag c={r.itcClaimed?"g":"r"} ch={r.itcClaimed?"Claimed":"Pending"}/></td>
                    <td style={ss.td}><span style={{color:C.gn}}>{INR(r.paidAmt||0)}</span></td>
                    <td style={ss.td}><b style={{color:bal>0?C.rd:C.gn}}>{INR(bal)}</b></td>
                    <td style={ss.td}><Tag c={st==="Paid"?"g":st==="Partial"?"o":"r"} ch={st}/></td>
                    <td style={ss.td}><div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                      {!r.itcClaimed&&<button onClick={()=>upd("purchases",arr=>arr.map(x=>x.id===r.id?{...x,itcClaimed:true}:x))} style={{padding:"3px 8px",borderRadius:5,border:"1px solid rgba(52,211,153,.4)",background:"rgba(52,211,153,.1)",color:C.gn,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700,whiteSpace:"nowrap"}}>✓ Claim ITC</button>}
                      <button onClick={()=>openRcv("purchases",r)} style={{padding:"3px 8px",borderRadius:5,border:"1px solid rgba(96,165,250,.3)",background:"rgba(96,165,250,.1)",color:C.bl,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Pay</button>
                      <button onClick={()=>openEdit("purch",r)} style={{padding:"3px 8px",borderRadius:5,border:"1px solid rgba(245,158,11,.3)",background:"rgba(245,158,11,.1)",color:C.or,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Edit</button>
                      <button onClick={()=>setDel({key:"purchases",id:r.id,label:r.item})} style={{padding:"3px 8px",borderRadius:5,border:"1px solid rgba(248,113,113,.3)",background:"rgba(248,113,113,.1)",color:C.rd,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Del</button>
                    </div></td>
                  </tr>;
                })}</tbody>
                <tfoot><tr style={{background:"#060C1A"}}>{["","","","","","","","Total","",INR(k.pB+k.pG),"","","","",""].map((c,i)=><td key={i} style={{...ss.td,fontWeight:700,color:C.or,borderBottom:"none"}}>{c}</td>)}</tr></tfoot>
              </table>
            </div>
          </div>}
          {purchSub==="exp"&&<div><SFilt val={fSt} onChange={setFSt}/>
            <Tbl cols={["Date","Site","Category","Description","Amount","Paid","Balance","Status"]}
              rows={byStatus(fData.expenses||[],e=>e.amt).map(r=>{const bal=r.amt-(r.paidAmt||0),st=pSt(r.paidAmt||0,r.amt);return[r.date,sName(r.siteId),<Tag key="c" c="p" ch={r.cat}/>,r.desc,<b key="a" style={{color:C.or}}>{INR(r.amt)}</b>,<span key="p" style={{color:C.gn}}>{INR(r.paidAmt||0)}</span>,<b key="b" style={{color:bal>0?C.rd:C.gn}}>{INR(bal)}</b>,<Tag key="s" c={st==="Paid"?"g":st==="Partial"?"o":"r"} ch={st}/>];})}
              foot={["","","","Total",INR(k.tE),"","",""]}
              onEdit={i=>openEdit("exp",byStatus(fData.expenses||[],e=>e.amt)[i])}
              onDel={i=>{const e=byStatus(fData.expenses||[],e=>e.amt)[i];setDel({key:"expenses",id:e.id,label:e.desc});}}
              onRcv={i=>openRcv("expenses",byStatus(fData.expenses||[],e=>e.amt)[i])} csvName="expenses"/>
          </div>}
          {purchSub==="cn"&&<div>
            <div style={{...ss.card,padding:"8px 14px",marginBottom:10,background:G(C.gn,0.07),border:`1px solid ${G(C.gn,0.2)}`}}><span style={{color:C.gn,fontSize:11}}>Credit Notes reduce the amount payable to vendor — material returns, quality rejections, or price corrections.</span></div>
            <Tbl cols={["Date","Site","Vendor","CN No","Bill Ref","Reason","Value","Paid","Balance","Status"]}
              rows={byStatus(fData.creditNotes||[],cn=>calcLI(cn.lineItems||[]).total).map(r=>{const tot=calcLI(r.lineItems||[]).total,bal=tot-(r.paidAmt||0),st=pSt(r.paidAmt||0,tot);return[r.date,sName(r.siteId),r.vendor,<b key="c" style={{color:C.gn}}>{r.cnNo}</b>,<span key="ref" style={{color:C.gr,fontSize:10}}>{r.billRef||"—"}</span>,r.reason,<b key="v" style={{color:C.or}}>{INR(tot)}</b>,<span key="p" style={{color:C.gn}}>{INR(r.paidAmt||0)}</span>,<b key="b" style={{color:bal>0?C.rd:C.gn}}>{INR(bal)}</b>,<Tag key="s" c={st==="Paid"?"g":st==="Partial"?"o":"r"} ch={st}/>];})}
              onEdit={i=>openEdit("creditNote",byStatus(fData.creditNotes||[],cn=>calcLI(cn.lineItems||[]).total)[i])}
              onDel={i=>{const e=byStatus(fData.creditNotes||[],cn=>calcLI(cn.lineItems||[]).total)[i];setDel({key:"creditNotes",id:e.id,label:e.cnNo});}}
              onRcv={i=>openRcv("creditNotes",byStatus(fData.creditNotes||[],cn=>calcLI(cn.lineItems||[]).total)[i])} csvName="credit_notes"/>
          </div>}
        </div>}

        {/* ══ HR ══ */}
        {tab==="hr"&&<div>
          <SubTabs val={hrSub} onChange={setHrSub} tabs={[{v:"att",l:"Attendance",icon:"✅"},{v:"pay",l:"Payroll",icon:"💼"},{v:"wc",l:"Workmen Comp.",icon:"🛡"},{v:"payslip",l:"Pay Slips",icon:"📄"},{v:"gate",l:"Gate Register",icon:"🚪"}]}/>
          {hrSub==="att"&&<div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
              <KCard icon="✅" label="Present" value={(fData.attendance||[]).filter(a=>a.present).length} color={C.gn}/><KCard icon="❌" label="Absent" value={(fData.attendance||[]).filter(a=>!a.present).length} color={C.rd}/><KCard icon="⏰" label="OT Hours" value={(fData.attendance||[]).reduce((a,b)=>a+(b.ot||0),0)+"h"} color={C.or}/>
            </div>
            <Tbl cols={["Date","Site","Name","Role","Status","OT"]}
              rows={(fData.attendance||[]).map(r=>{const sc={present:"g",halfday:"o",absent:"r",paidleave:"b",paidholiday:"t",outsideduty:"p"};const sl={present:"Present",halfday:"Half Day",absent:"Absent",paidleave:"Paid Leave",paidholiday:"Paid Holiday",outsideduty:"Outside Duty"};const st=r.status||( r.present?"present":"absent");return[r.date,sName(r.siteId),<b key="n">{r.name}</b>,<Tag key="r" c="p" ch={r.role||"Worker"}/>,<Tag key="s" c={sc[st]||"r"} ch={sl[st]||st}/>,<span key="o" style={{color:r.ot>0?C.or:C.gr}}>{r.ot||0}h</span>];})}
              onEdit={i=>openEdit("att",fData.attendance[i])} onDel={i=>setDel({key:"attendance",id:fData.attendance[i].id,label:fData.attendance[i].name})} csvName="attendance"/>
          </div>}
          {hrSub==="pay"&&<div>
            <div style={{...ss.card,marginBottom:10,padding:"8px 14px",background:G(C.pu,0.07),border:`1px solid ${G(C.pu,0.2)}`}}><span style={{color:C.pu,fontSize:10}}>PF 12% · ESI 0.75% · Prof.Tax ₹200 · TDS 5% above ₹50k · HRA 40%</span></div>
            <SFilt val={fSt} onChange={setFSt}/>
            <Tbl cols={["Name","Role","Site","Month","Days","Gross","PF","ESI","LWF","Net Pay","Paid","Bal","Status"]}
              rows={byStatus(fData.payroll||[],w=>cW(w).net).map(r=>{const p=cW(r),bal=p.net-(r.paidAmt||0),st=pSt(r.paidAmt||0,p.net);return[<b key="n">{r.name}</b>,<Tag key="r" c="p" ch={r.role}/>,sName(r.siteId),r.month||"—",r.present+"/"+r.days,INR(p.gr),<span key="pf" style={{color:C.rd,fontSize:10}}>{INR(p.pf)}</span>,<span key="esi" style={{color:C.rd,fontSize:10}}>{INR(p.esi)}</span>,<span key="lwf" style={{color:C.rd,fontSize:10}}>{INR(p.lwf||25)}</span>,<b key="np" style={{color:C.tl}}>{INR(p.net)}</b>,<span key="p" style={{color:C.gn}}>{INR(r.paidAmt||0)}</span>,<b key="b" style={{color:bal>0?C.rd:C.gn}}>{INR(bal)}</b>,<Tag key="s" c={st==="Paid"?"g":st==="Partial"?"o":"r"} ch={st}/>];})}
              foot={["","","","","","","","","",INR(k.tP),"","",""]}
              onEdit={i=>openEdit("pay",byStatus(fData.payroll||[],w=>cW(w).net)[i])} onDel={i=>{const e=byStatus(fData.payroll||[],w=>cW(w).net)[i];setDel({key:"payroll",id:e.id,label:e.name});}} onRcv={i=>openRcv("payroll",byStatus(fData.payroll||[],w=>cW(w).net)[i])} csvName="payroll"/>
          </div>}

          {hrSub==="wc"&&<div>
            <div style={{...ss.card,padding:"8px 14px",marginBottom:10,background:G(C.bl,0.06),border:"1px solid "+G(C.bl,0.2)}}><span style={{color:C.bl,fontSize:11}}>Workmen Compensation covers workers against on-site accidents. Maintain site-wise policies here.</span></div>
            <Tbl cols={["Site","Policy No","Insurer","Sum Assured","Premium","Start","Expiry","Status"]}
              rows={(data.wcPolicies||[]).map(r=>[sName(r.siteId),<b key="p" style={{color:C.pu}}>{r.policyNo}</b>,r.insurer,<b key="s" style={{color:C.or}}>{INR(r.sumAssured)}</b>,INR(r.premium),r.startDate,r.expiryDate,<Tag key="st" c={new Date(r.expiryDate+"T00:00:00")>new Date()?"g":"r"} ch={new Date(r.expiryDate+"T00:00:00")>new Date()?"Active":"Expired"}/>])}
              onEdit={i=>openEdit("wc",data.wcPolicies[i])} onDel={i=>setDel({key:"wcPolicies",id:data.wcPolicies[i].id,label:data.wcPolicies[i].policyNo})} csvName="wc_policies"/>
          </div>}

          {hrSub==="payslip"&&<div>
            <div style={{...ss.card,padding:"8px 14px",marginBottom:10,background:G(C.pu,0.06),border:"1px solid "+G(C.pu,0.2)}}><span style={{color:C.pu,fontSize:11}}>Select month and employee to generate a pay slip. Prints 2 copies per A4 page.</span></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
              <F label="Month"><input type="month" style={{...ss.inp}} value={form.psMonth||new Date().toISOString().slice(0,7)} onChange={e=>sf("psMonth",e.target.value)}/></F>
              <F label="Employee"><Sel val={form.psEmp||""} onChange={v=>sf("psEmp",v)} opts={[{v:"",l:"Select Employee"},...masters.labours.map(l=>l.name)]}/></F>
              <div style={{display:"flex",alignItems:"flex-end",paddingBottom:8}}><Btn full onClick={()=>{const emp=masters.labours.find(l=>l.name===form.psEmp);if(!emp)return alert("Select employee");const pr=(data.payroll||[]).find(p=>p.name===form.psEmp&&p.month===(form.psMonth||""));const pd=pr||{name:form.psEmp,role:emp.role,basic:emp.wage*26,present:26,days:26,month:form.psMonth};const p=cW(pd);const nr=v=>Number(v||0).toLocaleString("en-IN");const buildSlip=(no)=>"<div style='border:1px solid #ccc;padding:16px;font-size:11px;font-family:Arial,sans-serif;margin-bottom:"+(no===1?"4px":"0")+"'><div style='display:flex;justify-content:space-between;border-bottom:2px solid #060C1A;padding-bottom:8px;margin-bottom:10px'><div><div style='font-weight:800;font-size:14px'>"+(co.name||"")+"</div><div style='color:#64748b;font-size:10px'>"+(co.addr||"")+"</div></div><div style='text-align:right'><div style='font-weight:700;font-size:12px;color:#F59E0B'>PAY SLIP</div><div style='font-size:10px;color:#64748b'>"+(form.psMonth||pd.month)+"</div></div></div><table style='width:100%;border-collapse:collapse;font-size:10px'><thead><tr><th style='background:#060C1A;color:#F59E0B;padding:5px 8px;text-align:left'>Earnings</th><th style='background:#060C1A;color:#F59E0B;padding:5px 8px;text-align:right'>Amount</th><th style='background:#060C1A;color:#F87171;padding:5px 8px;text-align:left'>Deductions</th><th style='background:#060C1A;color:#F87171;padding:5px 8px;text-align:right'>Amount</th></tr></thead><tbody><tr><td style='padding:4px 8px;border-bottom:1px solid #f1f5f9'>Basic Earned</td><td style='padding:4px 8px;text-align:right'>"+nr(p.e)+"</td><td style='padding:4px 8px;border-bottom:1px solid #f1f5f9'>PF 12%</td><td style='padding:4px 8px;text-align:right'>"+nr(p.pf)+"</td></tr><tr><td style='padding:4px 8px;border-bottom:1px solid #f1f5f9'>HRA 40%</td><td style='padding:4px 8px;text-align:right'>"+nr(p.h)+"</td><td style='padding:4px 8px;border-bottom:1px solid #f1f5f9'>ESI 0.75%</td><td style='padding:4px 8px;text-align:right'>"+nr(p.esi)+"</td></tr><tr><td style='padding:4px 8px;border-bottom:1px solid #f1f5f9'>Gross</td><td style='padding:4px 8px;text-align:right;font-weight:600'>"+nr(p.gr)+"</td><td style='padding:4px 8px;border-bottom:1px solid #f1f5f9'>Prof Tax + LWF</td><td style='padding:4px 8px;text-align:right'>"+nr(p.pt+(p.lwf||25))+"</td></tr><tr><td colspan=2 style='padding:4px 8px'></td><td style='padding:4px 8px;border-bottom:1px solid #f1f5f9'>TDS</td><td style='padding:4px 8px;text-align:right'>"+nr(p.tds)+"</td></tr><tr style='background:#f8fafc;font-weight:700'><td style='padding:5px 8px'>NET PAYABLE</td><td style='padding:5px 8px;text-align:right;color:#34D399'>"+nr(p.net)+"</td><td style='padding:5px 8px'>Total Deductions</td><td style='padding:5px 8px;text-align:right;color:#F87171'>"+nr(p.ded)+"</td></tr></tbody></table><div style='display:flex;justify-content:space-between;margin-top:12px;font-size:10px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:8px'><span>Employee: "+pd.name+" | Designation: "+pd.role+"</span><span>Sign: ________________</span></div></div>";const fullHtml="<!DOCTYPE html><html><head><meta charset=utf-8><title>Pay Slip</title><style>body{font-family:Arial,sans-serif;margin:20px;padding:0}@media print{body{margin:0}}</style></head><body>"+buildSlip(1)+"<hr style='border:1px dashed #ccc;margin:8px 0'>"+buildSlip(2)+"<div style='text-align:center;padding:12px;margin-top:8px'><button onclick='window.print()' style='background:#F59E0B;color:#000;border:none;padding:8px 24px;border-radius:6px;font-weight:700;cursor:pointer'>Print Pay Slip (2 per page)</button></div></body></html>";try{const blob=new Blob([fullHtml],{type:"text/html"});const url=URL.createObjectURL(blob);window.open(url,"_blank","width=720,height=640");}catch(e){console.error(e);}}} color={C.pu}>🖨 Generate Pay Slip</Btn></div>
            </div>
            {form.psEmp&&(()=>{const pr=(data.payroll||[]).filter(p=>p.name===form.psEmp);return pr.length>0&&<div style={{...ss.card,padding:14,marginTop:8}}><div style={{color:C.or,fontWeight:700,marginBottom:8,fontSize:11}}>Payroll History — {form.psEmp}</div>{pr.map((p,i)=>{const cw=cW(p);return<div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #0A1223",fontSize:11}}><span style={{color:C.si}}>{p.month}</span><span>{p.present}/{p.days} days</span><span style={{color:C.tl}}>Net: {INR(cw.net)}</span><Tag c={pSt(p.paidAmt||0,cw.net)==="Paid"?"g":"r"} ch={pSt(p.paidAmt||0,cw.net)}/></div>;})}  </div>;})()}
          </div>}

          {hrSub==="gate"&&<div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:12}}>
              <Btn onClick={()=>openAdd("gateRegister")} color={C.or} icon="➕">New Gate Entry</Btn>
            </div>
            <Tbl cols={["Date","Type","Name","Mobile","Purpose","Whom to Visit","Time In","Time Out","Action"]}
              rows={(data.gateRegister||[]).map(r=>[
                r.date,
                <Tag key="t" c={r.type==="Visitor"?"p":"b"} ch={r.type}/>,
                <b key="n">{r.name}</b>,
                r.mobile||"—",
                r.purpose||"—",
                r.whomToVisit||"—",
                r.timeIn||"—",
                <span key="out" style={{color:r.timeOut?C.gn:C.or}}>{r.timeOut||"Pending"}</span>,
                !r.timeOut ? <button key="m" onClick={()=>{
                  upd("gateRegister", arr=>arr.map(x=>x.id===r.id?{...x,timeOut:new Date().toLocaleTimeString('en-US',{hour12:false,hour:"2-digit",minute:"2-digit"}), status:"Out"}:x));
                }} style={{padding:"4px 8px",borderRadius:5,border:"1px solid "+C.or,background:"transparent",color:C.or,cursor:"pointer",fontSize:10,fontFamily:"monospace"}}>Mark Out</button> : "Done"
              ])}
              onEdit={i=>openEdit("gateRegister",data.gateRegister[i])} 
              onDel={i=>setDel({key:"gateRegister",id:data.gateRegister[i].id,label:data.gateRegister[i].name})} 
              csvName="gate_register"/>
          </div>}
        </div>}

        {/* ══ INVENTORY ══ */}
        {tab==="inventory"&&<div>
          <SubTabs val={invSub} onChange={setInvSub} tabs={[{v:"stock",l:"Stock",icon:"📦"},{v:"godown",l:"Godowns",icon:"🏭"},{v:"recv",l:"GRN",icon:"📥"},{v:"transfer",l:"Transfers",icon:"↔"}]}/>
          {invSub==="stock"&&<Tbl cols={["Location","Type","Item","Unit","Opening","Rcvd","Used","Closing","Min","Status","Rate","Value"]}
            rows={(data.inventory||[]).map(r=>{const low=r.close<=r.min;return[r.locType==="site"?sName(r.locId):gName(r.locId),<Tag key="t" c={r.locType==="site"?"b":"o"} ch={r.locType}/>,<b key="i" style={{color:low?C.rd:"#CBD5E1"}}>{r.item}</b>,r.unit,r.open,<span key="rv" style={{color:C.tl}}>{r.recv}</span>,<span key="u" style={{color:C.rd}}>{r.used}</span>,<b key="cl" style={{color:low?C.rd:C.or}}>{r.close}</b>,r.min,<Tag key="s" c={low?"r":"g"} ch={low?"LOW":"OK"}/>,INR(r.rate),<b key="v" style={{color:C.tl}}>{INR(r.close*r.rate)}</b>];})}
            foot={["","","","","","","","","","","Total",INR((data.inventory||[]).reduce((a,b)=>a+b.close*b.rate,0))]}
            onEdit={i=>openEdit("inventory",data.inventory[i])} onDel={i=>setDel({key:"inventory",id:data.inventory[i].id,label:data.inventory[i].item})} csvName="inventory"/>}
          {invSub==="godown"&&<div>{masters.godowns.map(g=><div key={g.id} style={{...ss.card,marginBottom:12,overflow:"hidden"}}><div style={{padding:"8px 14px",borderBottom:BD,background:G(C.bl,0.05)}}><b style={{color:C.or}}>{g.name}</b><span style={{color:C.gr,fontSize:10,marginLeft:10}}>{g.loc}</span></div><table style={{borderCollapse:"collapse",width:"100%",fontSize:11}}><thead><tr style={{background:"#060C1A"}}>{["Item","Unit","Opening","Rcvd","Issued","Closing","Min","Status","Value"].map(h=><th key={h} style={ss.th}>{h}</th>)}</tr></thead><tbody>{(data.inventory||[]).filter(i=>i.locType==="godown"&&i.locId===g.id).map((i,idx)=>{const low=i.close<=i.min;return <tr key={idx}><td style={ss.td}>{i.item}</td><td style={ss.td}>{i.unit}</td><td style={ss.td}>{i.open}</td><td style={{...ss.td,color:C.tl}}>{i.recv}</td><td style={{...ss.td,color:C.rd}}>{i.used}</td><td style={{...ss.td,color:low?C.rd:C.or,fontWeight:700}}>{i.close}</td><td style={ss.td}>{i.min}</td><td style={ss.td}><Tag c={low?"r":"g"} ch={low?"LOW":"OK"}/></td><td style={{...ss.td,color:C.tl,fontWeight:700}}>{INR(i.close*i.rate)}</td></tr>;})}</tbody></table></div>)}</div>}
          {invSub==="recv"&&<Tbl cols={["Date","GRN","Location","Vendor","Item","Qty","Unit","Rate","GST","Total"]}
            rows={(data.materialReceipts||[]).map(r=>[r.date,<b key="g" style={{color:C.pu}}>{r.grnNo}</b>,r.locType==="site"?sName(r.locId):gName(r.locId),r.vendor,r.item,r.qty,r.unit,INR(r.rate),r.gst+"%",<b key="t" style={{color:C.or}}>{INR((r.qty||0)*(r.rate||0)*(1+(r.gst||0)/100))}</b>])}
            onEdit={i=>openEdit("matreceipt",data.materialReceipts[i])} onDel={i=>setDel({key:"materialReceipts",id:data.materialReceipts[i].id,label:data.materialReceipts[i].item})} csvName="material_receipts"/>}
          {invSub==="transfer"&&<Tbl cols={["Date","From","From Loc","To","To Loc","Item","Qty","Unit","Value"]}
            rows={(data.stockTransfers||[]).map(r=>[r.date,<Tag key="ft" c={r.fromType==="site"?"b":"o"} ch={r.fromType}/>,r.fromType==="site"?sName(r.fromId):gName(r.fromId),<Tag key="tt" c={r.toType==="site"?"b":"o"} ch={r.toType}/>,r.toType==="site"?sName(r.toId):gName(r.toId),r.item,r.qty,r.unit,<b key="v" style={{color:C.tl}}>{INR((r.qty||0)*(r.rate||0))}</b>])}
            onEdit={i=>openEdit("transfers",data.stockTransfers[i])} onDel={i=>setDel({key:"stockTransfers",id:data.stockTransfers[i].id,label:data.stockTransfers[i].item})} csvName="transfers"/>}
        </div>}

        {/* ══ ACCOUNTS ══ */}
        {tab==="accounts"&&<div>
          <SubTabs val={accSub} onChange={setAccSub} tabs={[{v:"vouchers",l:"Vouchers",icon:"🧾"},{v:"contra",l:"Contra",icon:"↔"},{v:"banks",l:"Banks",icon:"🏦"},{v:"petty",l:"Petty Cash",icon:"💵"},{v:"cheques",l:"Cheques",icon:"🖊"},{v:"loans",l:"Loans",icon:"🏛"},{v:"tdstcs",l:"TDS / TCS",icon:"📑"}]}/>
          {accSub==="vouchers"&&<Tbl cols={["Date","Type","Party","Site","Amount","Via","Account","Desc","Ref"]}
            rows={(data.vouchers||[]).map(r=>[r.date,<Tag key="t" c={r.vtype==="in"?"g":"r"} ch={r.vtype==="in"?"IN":"OUT"}/>,r.party,sName(r.siteId),<b key="a" style={{color:r.vtype==="in"?C.gn:C.rd}}>{INR(r.amt)}</b>,<Tag key="v" c={r.via==="bank"?"b":"o"} ch={r.via}/>,r.via==="bank"?bName(r.accountId):pcName(r.accountId),r.desc,<span key="r" style={{color:C.gr}}>{r.ref||"—"}</span>])}
            onEdit={i=>openEdit("vouchers",data.vouchers[i])} onDel={i=>setDel({key:"vouchers",id:data.vouchers[i].id,label:data.vouchers[i].desc})}
            onPrint={i=>{const v=data.vouchers[i];const vrows=[["Date",v.date],["Type",v.vtype==="in"?"Money In":"Money Out"],["Party",v.party],["Amount","Rs "+Number(v.amt).toLocaleString("en-IN")],["Via",v.via==="bank"?bName(v.accountId):pcName(v.accountId)],["Reference",v.ref||"—"],["Description",v.desc]].map(([l,val])=>"<tr><td style=\"padding:6px 10px;color:#64748b;font-size:11px;width:35%\">"+l+"</td><td style=\"padding:6px 10px;font-weight:600\">"+val+"</td></tr>").join("");genGenericPrint("Voucher","<table style=\"width:100%;border-collapse:collapse\">"+vrows+"</table>",co);}}
            csvName="vouchers"/>}
          {accSub==="contra"&&<Tbl cols={["Date","From Type","From Account","To Type","To Account","Amount","Description"]}
            rows={(data.contraEntries||[]).map(r=>[r.date,<Tag key="ft" c="b" ch={r.fromType}/>,r.fromType==="bank"?bName(r.fromId):pcName(r.fromId),<Tag key="tt" c="o" ch={r.toType}/>,r.toType==="bank"?bName(r.toId):pcName(r.toId),<b key="a" style={{color:C.or}}>{INR(r.amt)}</b>,r.desc])}
            onEdit={i=>openEdit("contra",data.contraEntries[i])} onDel={i=>setDel({key:"contraEntries",id:data.contraEntries[i].id,label:data.contraEntries[i].desc})} csvName="contra"/>}
          {accSub==="banks"&&<div>
            {chequeReminders.length>0&&<div style={{...ss.card,padding:"10px 14px",marginBottom:12,background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.3)",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:18}}>⏰</span>
              <div><div style={{color:C.or,fontWeight:700,fontSize:11}}>Cheque Reminders — {chequeReminders.length} cheque(s) due within 10 days</div>
              <div style={{color:C.si,fontSize:10,marginTop:2}}>{chequeReminders.map(c=>`${c.chequeNo} (${c.party} — ${INR(c.amt)}, due ${c.dueDate})`).join(" | ")}</div></div>
            </div>}
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:12}}>
              <button onClick={()=>openBankEntry()} style={{padding:"7px 16px",borderRadius:7,border:"1px solid rgba(52,211,153,.4)",background:"rgba(52,211,153,.12)",color:C.gn,cursor:"pointer",fontFamily:"monospace",fontSize:11,fontWeight:700}}>+ Direct Dr / Cr Entry</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat("+Math.min(masters.banks.length,3)+",1fr)",gap:10,marginBottom:14}}>
              {masters.banks.map(b=>{const bal=getBankBal(data.bankTxns||[],masters.banks,b.id);return <KCard key={b.id} icon="🏦" label={b.name} value={INR(bal)} sub={"A/c …"+b.accNo.slice(-4)} color={bal<0?C.rd:C.tl}/>;})  }
            </div>
            {masters.banks.map(b=><div key={b.id} style={{...ss.card,marginBottom:14,overflow:"hidden"}}>
              <div style={{padding:"10px 16px",borderBottom:BD,display:"flex",justifyContent:"space-between",alignItems:"center",background:G(C.bl,0.05)}}>
                <span style={{color:C.or,fontWeight:700}}>🏦 {b.name}</span>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{color:C.gr,fontSize:10}}>Opening: {INR(b.openBal)} | Bal: <b style={{color:C.tl}}>{INR(getBankBal(data.bankTxns||[],masters.banks,b.id))}</b></span>
                  <button onClick={()=>openBankEntry(b.id)} style={{padding:"3px 10px",borderRadius:6,border:"1px solid rgba(52,211,153,.4)",background:"rgba(52,211,153,.1)",color:C.gn,cursor:"pointer",fontFamily:"monospace",fontSize:10,fontWeight:700}}>+ Entry</button>
                </div>
              </div>
              <table style={{borderCollapse:"collapse",width:"100%",fontSize:11}}><thead><tr style={{background:"#060C1A"}}>{["Date","Description","Type","Amount","Category / Ref","Action"].map(h=><th key={h} style={ss.th}>{h}</th>)}</tr></thead>
              <tbody>{(data.bankTxns||[]).filter(t=>t.bankId===b.id).length===0?<tr><td colSpan={6} style={{...ss.td,textAlign:"center",color:"#1E2D45",padding:16}}>No transactions</td></tr>:(data.bankTxns||[]).filter(t=>t.bankId===b.id).map((t,i)=><tr key={i} onMouseEnter={e=>e.currentTarget.style.background="#0A1223"} onMouseLeave={e=>e.currentTarget.style.background=""}><td style={ss.td}>{t.date}</td><td style={ss.td}>{t.desc}</td><td style={ss.td}><Tag c={t.type==="Cr"?"g":"r"} ch={t.type==="Cr"?"Credit":"Debit"}/></td><td style={{...ss.td,color:t.type==="Cr"?C.gn:C.rd,fontWeight:700}}>{INR(t.amt)}</td><td style={{...ss.td,color:C.gr}}>{t.category||t.ref||"—"}</td><td style={ss.td}><div style={{display:"flex",gap:3}}><button onClick={()=>{setForm({...t,bankId:t.bankId});setModal({t:"bankEntry",oid:t.id});}} style={{padding:"2px 7px",borderRadius:5,border:"1px solid rgba(245,158,11,.3)",background:"rgba(245,158,11,.1)",color:C.or,cursor:"pointer",fontSize:10,fontFamily:"monospace"}}>Edit</button><button onClick={()=>{if(window.confirm("Delete this bank entry?"))upd("bankTxns",arr=>arr.filter(x=>x.id!==t.id));}} style={{padding:"2px 7px",borderRadius:5,border:"1px solid rgba(248,113,113,.3)",background:"rgba(248,113,113,.1)",color:C.rd,cursor:"pointer",fontSize:10,fontFamily:"monospace"}}>Del</button></div></td></tr>)}</tbody>
              </table>
            </div>)}
          </div>}
          {accSub==="petty"&&<div>
            <div style={{display:"grid",gridTemplateColumns:"repeat("+Math.min(masters.pettyCash.length,3)+",1fr)",gap:10,marginBottom:14}}>
              {masters.pettyCash.map(p=>{const bal=getPettyBal(data.pettyTxns||[],masters.pettyCash,p.id);return <KCard key={p.id} icon="💵" label={p.name} value={INR(bal)} sub={"Keeper: "+p.keeper} color={bal<0?C.rd:C.or}/>;})  }
            </div>
            {masters.pettyCash.map(p=><div key={p.id} style={{...ss.card,marginBottom:14,overflow:"hidden"}}>
              <div style={{padding:"10px 16px",borderBottom:BD,display:"flex",justifyContent:"space-between",alignItems:"center",background:G(C.or,0.05)}}>
                <span style={{color:C.or,fontWeight:700}}>💵 {p.name}</span><span style={{color:C.gr,fontSize:10}}>Opening: {INR(p.openBal)} | Bal: <b style={{color:C.tl}}>{INR(getPettyBal(data.pettyTxns||[],masters.pettyCash,p.id))}</b></span>
              </div>
              <table style={{borderCollapse:"collapse",width:"100%",fontSize:11}}><thead><tr style={{background:"#060C1A"}}>{["Date","Description","Type","Amount","By"].map(h=><th key={h} style={ss.th}>{h}</th>)}</tr></thead>
              <tbody>{(data.pettyTxns||[]).filter(t=>t.pettyId===p.id).length===0?<tr><td colSpan={5} style={{...ss.td,textAlign:"center",color:"#1E2D45",padding:16}}>No transactions</td></tr>:(data.pettyTxns||[]).filter(t=>t.pettyId===p.id).map((t,i)=><tr key={i}><td style={ss.td}>{t.date}</td><td style={ss.td}>{t.desc}</td><td style={ss.td}><Tag c={t.type==="Cr"?"g":"r"} ch={t.type==="Cr"?"In":"Out"}/></td><td style={{...ss.td,color:t.type==="Cr"?C.gn:C.rd,fontWeight:700}}>{INR(t.amt)}</td><td style={{...ss.td,color:C.pu}}>{t.by}</td></tr>)}</tbody>
              </table>
            </div>)}
          </div>}
          {accSub==="loans"&&<div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
              <KCard icon="📥" label="Borrowed" value={INR((data.loans||[]).filter(l=>l.loanType==="borrowed").reduce((a,b)=>a+b.amt,0))} color={C.rd}/><KCard icon="📤" label="Given" value={INR((data.loans||[]).filter(l=>l.loanType==="given").reduce((a,b)=>a+b.amt,0))} color={C.gn}/><KCard icon="🔑" label="Advances" value={INR((data.loans||[]).filter(l=>l.loanType==="advance").reduce((a,b)=>a+b.amt,0))} color={C.or}/>
            </div>
            <Tbl cols={["Date","Type","Party","Party Type","Amount","Interest%","Desc","Status"]}
              rows={(data.loans||[]).map(r=>[r.date,<Tag key="t" c={r.loanType==="borrowed"?"r":r.loanType==="given"?"g":"o"} ch={r.loanType}/>,<b key="n">{r.party}</b>,<Tag key="pt" c="b" ch={r.partyType}/>,<b key="a" style={{color:C.or}}>{INR(r.amt)}</b>,r.interest+"%",r.desc,<Tag key="s" c={r.status==="Active"?"o":"g"} ch={r.status}/>])}
              onEdit={i=>openEdit("loans",data.loans[i])} onDel={i=>setDel({key:"loans",id:data.loans[i].id,label:data.loans[i].party})} csvName="loans"/>
          </div>}

          {/* ── CHEQUES ── */}
          {accSub==="cheques"&&<div>
            {chequeReminders.length>0&&<div style={{...ss.card,padding:"10px 14px",marginBottom:10,background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.3)"}}>
              <span style={{color:C.or,fontWeight:700}}>⏰ {chequeReminders.length} cheque(s) due in next 10 days: </span>
              <span style={{color:C.si,fontSize:10}}>{chequeReminders.map(c=>`${c.chequeNo} — ${c.party} — ${INR(c.amt)} — Due: ${c.dueDate}`).join("  |  ")}</span>
            </div>}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
              {[["Received","received",C.gn],["Issued","issued",C.rd],["Cleared","Cleared",C.tl],["Pending","Pending",C.or]].map(([l,fv,c])=><KCard key={l} icon="🖊" label={l} value={(data.cheques||[]).filter(ch=>fv==="received"||fv==="issued"?ch.type===fv:ch.status===fv).length+" cheques"} sub={INR((data.cheques||[]).filter(ch=>fv==="received"||fv==="issued"?ch.type===fv:ch.status===fv).reduce((a,ch)=>a+Number(ch.amt||0),0))} color={c}/>)}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{display:"flex",gap:4}}>
                {["All","received","issued"].map(f=><button key={f} onClick={()=>setChqFilter(f)} style={{padding:"5px 14px",borderRadius:20,border:"1px solid "+(chqFilter===f?C.or:"#1E2D45"),background:chqFilter===f?G(C.or,0.15):"transparent",color:chqFilter===f?C.or:C.gr,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:chqFilter===f?700:400}}>{f==="All"?"All":f==="received"?"Received":"Issued"}</button>)}
              </div>
              <button onClick={()=>openCheque(null)} style={{padding:"7px 16px",borderRadius:7,border:"1px solid rgba(245,158,11,.4)",background:"rgba(245,158,11,.12)",color:C.or,cursor:"pointer",fontFamily:"monospace",fontSize:11,fontWeight:700}}>+ Add Cheque</button>
            </div>
            <div style={{...ss.card,overflowX:"auto"}}>
              <table style={{borderCollapse:"collapse",width:"100%"}}>
                <thead><tr style={{background:"#060C1A"}}>{["Date","Type","Cheque No","Bank","Party","Amount","Due Date","Status","Description","Actions"].map(h=><th key={h} style={ss.th}>{h}</th>)}</tr></thead>
                <tbody>{(data.cheques||[]).filter(c=>chqFilter==="All"||c.type===chqFilter).length===0?<tr><td colSpan={10} style={{...ss.td,textAlign:"center",color:"#334155",padding:32}}>No cheques</td></tr>:(data.cheques||[]).filter(c=>chqFilter==="All"||c.type===chqFilter).map((c,i)=>{
                  const today=new Date();const due=new Date(c.dueDate+"T00:00:00");const daysLeft=Math.ceil((due-today)/864e5);const isUrgent=c.status==="Pending"&&daysLeft>=0&&daysLeft<=10;
                  return <tr key={i} style={{background:isUrgent?"rgba(245,158,11,.04)":""}} onMouseEnter={e=>e.currentTarget.style.background="#0A1223"} onMouseLeave={e=>e.currentTarget.style.background=isUrgent?"rgba(245,158,11,.04)":""}>
                    <td style={ss.td}>{c.date}</td>
                    <td style={ss.td}><Tag c={c.type==="received"?"g":"r"} ch={c.type==="received"?"Received":"Issued"}/></td>
                    <td style={ss.td}><b style={{color:C.pu}}>{c.chequeNo}</b></td>
                    <td style={ss.td}>{bName(c.bankId)}</td>
                    <td style={ss.td}><b>{c.party}</b></td>
                    <td style={ss.td}><b style={{color:C.or}}>{INR(c.amt)}</b></td>
                    <td style={ss.td}><span style={{color:isUrgent?C.or:"#CBD5E1",fontWeight:isUrgent?700:400}}>{c.dueDate||"—"}{isUrgent&&<span style={{color:C.or,fontSize:9,marginLeft:4}}>({daysLeft}d)</span>}</span></td>
                    <td style={ss.td}><Tag c={c.status==="Cleared"?"g":c.status==="Bounced"?"r":c.status==="Presented"?"b":"o"} ch={c.status}/></td>
                    <td style={ss.td}><span style={{color:C.gr,fontSize:10}}>{c.desc}</span></td>
                    <td style={ss.td}><div style={{display:"flex",gap:3}}>
                      <button onClick={()=>openCheque(c)} style={{padding:"3px 9px",borderRadius:6,border:"1px solid rgba(245,158,11,.3)",background:"rgba(245,158,11,.1)",color:C.or,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Edit</button>
                      {c.status==="Pending"&&<button onClick={()=>{upd("cheques",arr=>arr.map(x=>x.id===c.id?{...x,status:"Cleared"}:x));}} style={{padding:"3px 9px",borderRadius:6,border:"1px solid rgba(52,211,153,.3)",background:"rgba(52,211,153,.1)",color:C.gn,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Clear</button>}
                      {c.status==="Pending"&&<button onClick={()=>{upd("cheques",arr=>arr.map(x=>x.id===c.id?{...x,status:"Bounced"}:x));}} style={{padding:"3px 9px",borderRadius:6,border:"1px solid rgba(248,113,113,.3)",background:"rgba(248,113,113,.1)",color:C.rd,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Bounce</button>}
                    </div></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </div>}

          {/* ── TDS / TCS ── */}
          {accSub==="tdstcs"&&<div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
              <KCard icon="📥" label="TDS Receivable" value={INR(tdsTcsSummary.tdsRcvTotal)} sub={"Pending: "+INR(tdsTcsSummary.tdsRcvPending)} color={C.gn}/>
              <KCard icon="📤" label="TDS Payable" value={INR(tdsTcsSummary.tdsPayTotal)} sub={"Pending: "+INR(tdsTcsSummary.tdsPayPending)} color={C.rd}/>
              <KCard icon="📋" label="TCS Receivable" value={INR(tdsTcsSummary.tcsRcvTotal)} color={C.bl}/>
              <KCard icon="📋" label="TCS Payable" value={INR(tdsTcsSummary.tcsPayTotal)} color={C.or}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {[["TDS RECEIVABLE (Deducted by Clients)",tdsTcsSummary.tdsRcv,C.gn],["TDS PAYABLE (To be deducted on Vendor Payments)",tdsTcsSummary.tdsPay,C.rd]].map(([title,rows,color])=><div key={title} style={{...ss.card,padding:16}}>
                <div style={{color,fontWeight:700,fontSize:11,marginBottom:12,borderBottom:BD,paddingBottom:8}}>{title}</div>
                {rows.length===0?<div style={{color:"#334155",textAlign:"center",padding:20,fontSize:11}}>No entries</div>:rows.map((r,i)=><div key={i} style={{padding:"7px 0",borderBottom:"1px solid #0A1223",display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:8,alignItems:"center"}}>
                  <div><div style={{color:"#CBD5E1",fontSize:11,fontWeight:600}}>{r.party}</div><div style={{color:C.gr,fontSize:10}}>{r.section} @ {r.rate}% — {r.refInv}</div></div>
                  <div><div style={{color:color,fontWeight:700,fontFamily:"monospace"}}>{INR(r.taxAmt)}</div><div style={{color:C.gr,fontSize:10}}>on {INR(r.baseAmt)}</div></div>
                  <div style={{display:"flex",flexDirection:"column",gap:3,alignItems:"flex-end"}}>
                    <Tag c={r.status==="Deducted"?"g":r.status==="Filed"?"b":"o"} ch={r.status}/>
                    <button onClick={()=>upd("tdsTcs",arr=>arr.map(x=>x.id===r.id?{...x,status:r.status==="Pending"?"Deducted":"Filed"}:x))} style={{padding:"2px 8px",borderRadius:5,border:"1px solid rgba(245,158,11,.3)",background:"rgba(245,158,11,.1)",color:C.or,cursor:"pointer",fontSize:9,fontFamily:"monospace",fontWeight:700}}>{r.status==="Pending"?"Mark Deducted":r.status==="Deducted"?"Mark Filed":"✓"}</button>
                  </div>
                </div>)}
              </div>)}
            </div>
            <div style={{...ss.card,padding:16,marginTop:12}}>
              <div style={{color:C.or,fontWeight:700,fontSize:11,marginBottom:12,borderBottom:BD,paddingBottom:8}}>+ ADD TDS / TCS ENTRY</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                {[["txnType","Type",[{v:"tds",l:"TDS"},{v:"tcs",l:"TCS"}]],["direction","Direction",[{v:"receivable",l:"Receivable (from client)"},{v:"payable",l:"Payable (to govt)"}]],["section","Section",["194C","194J","194I","194Q","206C","Other"]],["status","Status",["Pending","Deducted","Filed"]]].map(([fld,lbl,opts])=><F key={fld} label={lbl}><Sel val={form[fld]||opts[0]?.v||opts[0]} onChange={v=>sf(fld,v)} opts={opts}/></F>)}
                {[["party","Party / Name"],["refInv","Invoice / Bill Ref"]].map(([fld,lbl])=><F key={fld} label={lbl}><Inp val={form[fld]||""} onChange={v=>sf(fld,v)}/></F>)}
                <F label="Base Amount"><Num val={form.baseAmt||0} onChange={v=>sf("baseAmt",v)}/></F>
                <F label="Tax Amount"><Num val={form.taxAmt||0} onChange={v=>sf("taxAmt",v)}/></F>
                <F label="Date"><Inp val={form.ttDate||""} onChange={v=>sf("ttDate",v)} type="date"/></F>
                <div style={{display:"flex",alignItems:"flex-end"}}><Btn full onClick={()=>{if(!form.party||!form.taxAmt)return;upd("tdsTcs",arr=>[...arr,{id:uid(),date:form.ttDate||new Date().toISOString().slice(0,10),txnType:form.txnType||"tds",direction:form.direction||"receivable",party:form.party,partyType:"other",section:form.section||"194C",rate:form.rate||0,baseAmt:form.baseAmt||0,taxAmt:form.taxAmt||0,refInv:form.refInv||"",status:form.status||"Pending",challNo:""}]);sf("party","");sf("taxAmt",0);sf("baseAmt",0);}} color={C.or} icon="＋">Add Entry</Btn></div>
              </div>
            </div>
          </div>}
        </div>}

        {/* ══ REPORTS (P&L | Balance Sheet | Ageing | Ledger | Day Book | GST) ══ */}
        {tab==="reports"&&<div>
          <SubTabs val={repSub} onChange={setRepSub} tabs={[{v:"pl",l:"P & L",icon:"📈"},{v:"bs",l:"Balance Sheet",icon:"⚖"},{v:"aging",l:"Ageing",icon:"📅"},{v:"gst",l:"GST",icon:"🏷"},{v:"ledger",l:"Ledger",icon:"📒"},{v:"daybook",l:"Day Book",icon:"📰"}]}/>
          {repSub!=="daybook"&&<PeriodBar from={rpFrom} to={rpTo} onFrom={setRpFrom} onTo={setRpTo}/>}

          {repSub==="pl"&&<div>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}><Btn onClick={printPL} color={C.gr} icon="🖨">Print P&L</Btn></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
              <KCard icon="💰" label="Revenue from Ops" value={INR(rk.tB)} color={C.tl}/>
              <KCard icon="💹" label="Other Income" value={INR((rData.otherIncome||[]).reduce((a,x)=>a+x.amt,0))} color={C.bl}/>
              <KCard icon="📈" label="Net Profit" value={INR(rk.profit)} sub={"Margin "+rk.margin+"%"} color={rk.profit>=0?C.gn:C.rd}/>
              <KCard icon="🧾" label="GST Output" value={INR(rk.tG)} color={C.or}/>
            </div>
            {(()=>{
              const oi=(rData.otherIncome||[]).reduce((a,x)=>a+x.amt,0);
              const totalIncome=rk.tB+oi;
              const empBenefit=rk.tP;
              const matCost=rk.pB;
              const otherExp=rk.tE;
              const finCost=(data.loans||[]).reduce((a,l)=>a+(l.txns||[]).filter(t=>t.type==="interest").reduce((b,t)=>b+t.amt,0),0);
              const deprExp=0;
              const totalExp=matCost+empBenefit+finCost+deprExp+otherExp;
              const pbt=totalIncome-totalExp;
              const PR=({label,value,bold,indent,sub,color,hdr,total})=><div style={{display:"flex",justifyContent:"space-between",padding:hdr?"10px 0 6px":total?"10px 0":"5px 0",borderBottom:hdr?"1px solid #1E2D45":total?"2px solid #1E2D45":"1px solid #0A1223",marginTop:hdr?8:0,paddingLeft:(indent||0)*14}}>
                <div><span style={{color:hdr?C.or:total?"#E2E8F0":C.si,fontWeight:hdr||total||bold?700:400,fontSize:hdr?12:11}}>{label}</span>{sub&&<span style={{color:C.gr,fontSize:9,marginLeft:8}}>{sub}</span>}</div>
                {value!==undefined&&<span style={{color:color||(total?C.or:"#CBD5E1"),fontWeight:total||bold?700:400,fontFamily:"monospace",fontSize:total?12:11}}>{INR(value)}</span>}
              </div>;
              return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div style={{...ss.card,padding:18}}>
                  <div style={{color:C.or,fontWeight:800,fontSize:13,textAlign:"center",borderBottom:"2px solid "+C.or,paddingBottom:8,marginBottom:10}}>STATEMENT OF PROFIT & LOSS</div>
                  <PR label="a. Revenue from Operations" hdr/>
                  <PR label="Revenue (Basic)" value={rk.tB} indent={1}/>
                  <PR label="b. Other Income" hdr/>
                  <PR label="Other Income (Scrap / Outsourced etc.)" value={oi} indent={1}/>
                  <PR label="c. Total Income (a + b)" value={totalIncome} total color={C.tl}/>
                  <PR label="d. Expenses" hdr/>
                  <PR label="(i) Cost of Items / Services Sold" value={matCost} indent={1}/>
                  <PR label="(ii) Employee Benefit Expenses" value={empBenefit} indent={1}/>
                  <PR label="(iii) Finance Costs" value={finCost} indent={1}/>
                  <PR label="(iv) Depreciation & Amortization" value={deprExp} indent={1}/>
                  <PR label="(v) Other Expenses" value={otherExp} indent={1}/>
                  <PR label="Total Expenses (i+ii+iii+iv+v)" value={totalExp} total color={C.rd}/>
                  <PR label="e. Profit/(Loss) before Partners' Remuneration & Tax" value={pbt} total color={pbt>=0?C.gn:C.rd}/>
                  <PR label="f. Partners' Remuneration" value={0} indent={1}/>
                  <PR label="g. Profit Before Tax" value={pbt} bold color={pbt>=0?C.gn:C.rd}/>
                  <PR label="h. Tax Expense" hdr/>
                  <PR label="(i) Current Tax" value={0} indent={1}/>
                  <PR label="(ii) Deferred Tax" value={0} indent={1}/>
                  <PR label="i. Profit/(Loss) for the Period" value={pbt} total color={pbt>=0?C.gn:C.rd}/>
                  <div style={{marginTop:8,padding:"8px 12px",background:G(pbt>=0?C.gn:C.rd,0.08),borderRadius:6,border:"1px solid "+G(pbt>=0?C.gn:C.rd,0.2),textAlign:"center"}}>
                    <div style={{color:C.si,fontSize:10}}>Net Margin</div>
                    <div style={{color:pbt>=0?C.gn:C.rd,fontWeight:800,fontSize:18,fontFamily:"monospace"}}>{rk.margin}%</div>
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <div style={{...ss.card,padding:14}}>
                    <div style={{color:C.si,fontSize:10,letterSpacing:1,marginBottom:10,textTransform:"uppercase"}}>Site-wise Revenue vs Profit</div>
                    <ResponsiveContainer width="100%" height={200}><BarChart data={masters.sites.map(s=>{const sd=(rData.sales||[]).filter(x=>x.siteId===s.id);const pd=(rData.purchases||[]).filter(x=>x.siteId===s.id);const ed=(rData.expenses||[]).filter(x=>x.siteId===s.id);const rev=sd.reduce((a,b)=>a+cS(b).basic,0);const cost=pd.reduce((a,b)=>a+cP(b).b,0)+ed.reduce((a,b)=>a+b.amt,0);return{site:s.name.slice(0,10),rev,profit:rev-cost};})} barGap={3}><XAxis dataKey="site" tick={{fill:"#334155",fontSize:9}} axisLine={false} tickLine={false}/><YAxis tick={{fill:"#334155",fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>"₹"+Math.round(v/100000)+"L"}/><Tooltip formatter={v=>INR(v)} contentStyle={TT}/><Bar dataKey="rev" fill={C.tl} radius={[4,4,0,0]} name="Revenue"/><Bar dataKey="profit" fill={C.or} radius={[4,4,0,0]} name="Profit"/></BarChart></ResponsiveContainer>
                  </div>
                  <div style={{...ss.card,padding:14}}>
                    <div style={{color:C.si,fontSize:10,letterSpacing:1,marginBottom:10,textTransform:"uppercase"}}>Cost Composition</div>
                    <ResponsiveContainer width="100%" height={130}><PieChart><Pie data={[{name:"Materials",value:rk.pB},{name:"Expenses",value:rk.tE},{name:"Payroll",value:rk.tP},{name:"Finance",value:finCost}]} cx="50%" cy="50%" outerRadius={50} dataKey="value" label={({name,percent})=>name+" "+(percent*100).toFixed(0)+"%"} labelLine={false} fontSize={9}>{[C.rd,C.or,C.pu,C.bl].map((c,i)=><Cell key={i} fill={c}/>)}</Pie><Tooltip formatter={v=>INR(v)} contentStyle={TT}/></PieChart></ResponsiveContainer>
                  </div>
                </div>
              </div>;
            })()}
          </div>}
          {repSub==="bs"&&<div>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}><Btn onClick={printBS} color={C.gr} icon="🖨">Print Balance Sheet</Btn></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
              <KCard icon="📊" label="Total Assets" value={INR(balanceSheet.totalAssets)} color={C.gn}/>
              <KCard icon="📋" label="Total Liabilities" value={INR(balanceSheet.totalLiab)} color={C.rd}/>
              <KCard icon="⚖" label="Net Equity" value={INR(balanceSheet.equity)} color={balanceSheet.equity>=0?C.tl:C.rd}/>
              <KCard icon="🏦" label="Cash & Bank" value={INR(balanceSheet.bankBal+balanceSheet.pettyBal)} color={C.or}/>
            </div>
            {(()=>{const bs=balanceSheet;
              const BRow=({label,value,bold,indent,color,section})=><div style={{display:"flex",justifyContent:"space-between",padding:section?"9px 0 6px":"5px 0 5px "+(indent||0)*14+"px",borderBottom:section?"1px solid #1E2D45":"1px solid #0A1223",borderTop:section?"1px solid #1E2D45":"none",marginTop:section?8:0}}>
                <span style={{color:section?C.or:bold?"#E2E8F0":C.si,fontWeight:section||bold?700:400,fontSize:section?12:11,paddingLeft:(indent||0)*8}}>{label}</span>
                <span style={{color:color||"#CBD5E1",fontWeight:bold?700:500,fontFamily:"monospace",fontSize:bold?12:11}}>{value?INR(value):""}</span>
              </div>;
            return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {/* LEFT: EQUITY & LIABILITIES */}
              <div style={{...ss.card,padding:18}}>
                <div style={{color:C.rd,fontWeight:800,marginBottom:10,fontSize:13,textAlign:"center",borderBottom:"2px solid "+C.rd,paddingBottom:8}}>EQUITY & LIABILITIES</div>
                <BRow label="1. Owner's / Partner's Funds" section/>
                <BRow label="(a) Owner's Capital Account" value={bs.equity*0.7} indent={1}/>
                <BRow label="(b) Reserves & Surplus" value={bs.equity*0.3} indent={1}/>
                <BRow label="Total Owner's Funds" value={bs.equity} bold color={C.tl}/>
                <BRow label="2. Non-Current Liabilities" section/>
                <BRow label="(a) Long-term Borrowings" value={bs.loansBorrowed} indent={1}/>
                <BRow label="(b) Deferred Tax Liabilities" value={0} indent={1}/>
                <BRow label="(c) Other Long-term Liabilities" value={0} indent={1}/>
                <BRow label="Total Non-Current Liabilities" value={bs.loansBorrowed} bold/>
                <BRow label="3. Current Liabilities" section/>
                <BRow label="(a) Trade Payables" value={bs.payables} indent={1}/>
                <BRow label="(b) GST Payable (Net)" value={Math.max(0,bs.gstPayable)} indent={1}/>
                <BRow label="(c) TDS Payable" value={bs.tdsPayable} indent={1}/>
                <BRow label="(d) Other Current Liabilities" value={0} indent={1}/>
                <BRow label="Total Current Liabilities" value={bs.payables+Math.max(0,bs.gstPayable)+bs.tdsPayable} bold/>
                <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0",borderTop:"2px solid "+C.rd,marginTop:8,fontWeight:800,fontSize:13}}>
                  <span style={{color:C.rd}}>TOTAL EQUITY & LIABILITIES</span>
                  <span style={{color:C.rd,fontFamily:"monospace"}}>{INR(bs.totalLiab+Math.max(0,bs.equity))}</span>
                </div>
              </div>
              {/* RIGHT: ASSETS */}
              <div style={{...ss.card,padding:18}}>
                <div style={{color:C.gn,fontWeight:800,marginBottom:10,fontSize:13,textAlign:"center",borderBottom:"2px solid "+C.gn,paddingBottom:8}}>ASSETS</div>
                <BRow label="1. Non-Current Assets" section/>
                <BRow label="(a) Property, Plant & Equipment" value={0} indent={1}/>
                <BRow label="(b) Capital Work-in-Progress" value={0} indent={1}/>
                <BRow label="(c) Long-term Loans & Advances" value={bs.loansGiven} indent={1}/>
                <BRow label="Total Non-Current Assets" value={bs.loansGiven} bold/>
                <BRow label="2. Current Assets" section/>
                <BRow label="(a) Inventories" value={bs.invValue} indent={1}/>
                <BRow label="(b) Trade Receivables" value={bs.receivables} indent={1}/>
                <BRow label="(c) Cash & Bank Balances" value={bs.bankBal+bs.pettyBal} indent={1}/>
                <BRow label="(d) Short-term Loans & Advances" value={0} indent={1}/>
                <BRow label="(e) Other Current Assets" value={0} indent={1}/>
                <BRow label="Total Current Assets" value={bs.invValue+bs.receivables+bs.bankBal+bs.pettyBal} bold color={C.tl}/>
                <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0",borderTop:"2px solid "+C.gn,marginTop:8,fontWeight:800,fontSize:13}}>
                  <span style={{color:C.gn}}>TOTAL ASSETS</span>
                  <span style={{color:C.gn,fontFamily:"monospace"}}>{INR(bs.totalAssets)}</span>
                </div>
              </div>
            </div>;})()} 
          </div>}

          {repSub==="aging"&&<div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {[["RECEIVABLES — Sales Unpaid",aging.rb,C.tl],["PAYABLES — Purchases + Expenses",aging.pb,C.rd]].map(([title,bkts,color])=><div key={title} style={{...ss.card,padding:18}}>
                <div style={{color,fontWeight:700,marginBottom:14,fontSize:12,borderBottom:BD,paddingBottom:10}}>{title}</div>
                {Object.entries(bkts).map(([bucket,{cnt,amt}])=>{const total=Object.values(bkts).reduce((a,b)=>a+b.amt,0);const pct=total?Math.round(amt/total*100):0;return <div key={bucket} style={{marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{color:C.si,fontSize:11}}>{bucket}</span><span style={{color,fontWeight:700,fontFamily:"monospace"}}>{INR(amt)} <span style={{color:C.gr,fontWeight:400,fontSize:10}}>({cnt})</span></span></div>
                  <div style={{height:6,background:"#0A1223",borderRadius:3}}><div style={{height:"100%",width:pct+"%",background:`linear-gradient(90deg,${color},${G(color,0.5)})`,borderRadius:3}}/></div>
                </div>;})}
                <div style={{borderTop:BD,paddingTop:8,display:"flex",justifyContent:"space-between"}}><span style={{color:C.si,fontSize:10}}>Total</span><span style={{color,fontWeight:700,fontFamily:"monospace"}}>{INR(Object.values(bkts).reduce((a,b)=>a+b.amt,0))}</span></div>
              </div>)}
            </div>
          </div>}

          {repSub==="gst"&&<div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
              <KCard icon="📤" label="GST Output" value={INR(gstReport.output.gst)} sub={"On "+INR(gstReport.output.basic)+" taxable"} color={C.or}/><KCard icon="📥" label="GST Input (ITC)" value={INR(gstReport.input.gst)} sub={"On "+INR(gstReport.input.basic)+" purchases"} color={C.gn}/><KCard icon="💰" label="Net GST Payable" value={INR(Math.max(0,gstReport.net))} color={gstReport.net>0?C.rd:C.gn}/><KCard icon="⏳" label="Unclaimed ITC" value={INR(gstReport.unclaimed)} color={C.pu}/>
            </div>
            <div style={{...ss.card,padding:18,marginBottom:12}}>
              <div style={{color:C.or,fontWeight:700,marginBottom:14,fontSize:12}}>GST RECONCILIATION — {rpFrom} to {rpTo}</div>
              {[["Output GST (Sales)",INR(gstReport.output.gst),C.or],["Input GST Available (ITC)",INR(gstReport.input.gst),C.gn],["ITC Already Claimed",INR(gstReport.input.gst-gstReport.unclaimed),C.gn],["Pending ITC",INR(gstReport.unclaimed),C.pu],["Net GST Payable",INR(Math.max(0,gstReport.net)),gstReport.net>0?C.rd:C.gn]].map(([l,v,c])=><div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #0A1223"}}><span style={{color:C.si,fontSize:11}}>{l}</span><span style={{color:c,fontWeight:600,fontFamily:"monospace"}}>{v}</span></div>)}
            </div>
            <Tbl cols={["Date","Invoice","Client/Vendor","Type","Taxable","GST%","GST Amt","ITC"]}
              rows={[...(rData.sales||[]).map(s=>{const c=cS(s);return[s.date,s.inv,s.client,"Output",INR(c.basic),"—",<b key="g" style={{color:C.or}}>{INR(c.g)}</b>,"N/A"];}),...(rData.purchases||[]).map(p=>{const c=cP(p);return[p.date,"BILL",p.vendor,"Input",INR(c.b),p.gst+"%",<b key="g" style={{color:C.gn}}>{INR(c.ga)}</b>,<Tag key="i" c={p.itcClaimed?"g":"r"} ch={p.itcClaimed?"Claimed":"Pending"}/>];})]}
              csvName="gst_report"/>
            {(gstReport.hsnRows||[]).length>0&&<div style={{...ss.card,marginTop:12,overflow:"hidden"}}>
              <div style={{padding:"10px 14px",background:G(C.or,0.06),borderBottom:BD}}><span style={{color:C.or,fontWeight:700,fontSize:11}}>📊 HSN / SAC Wise GST Summary</span></div>
              <table style={{borderCollapse:"collapse",width:"100%"}}>
                <thead><tr style={{background:"#060C1A"}}>{["HSN/SAC","Description","Taxable Value","GST Rate","CGST","SGST","Total GST"].map(h=><th key={h} style={ss.th}>{h}</th>)}</tr></thead>
                <tbody>{(gstReport.hsnRows||[]).map((r,i)=><tr key={i} onMouseEnter={e=>e.currentTarget.style.background="#0A1223"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                  <td style={ss.td}><b style={{color:C.tl}}>{r.hsn}</b></td>
                  <td style={ss.td}>{r.desc.slice(0,30)}</td>
                  <td style={ss.td}><b style={{color:C.or}}>{INR(r.taxable)}</b></td>
                  <td style={ss.td}><Tag c="o" ch={r.gstRate+"%"}/></td>
                  <td style={ss.td}>{INR(r.cgst)}</td>
                  <td style={ss.td}>{INR(r.sgst)}</td>
                  <td style={ss.td}><b style={{color:C.gn}}>{INR(r.cgst+r.sgst)}</b></td>
                </tr>)}</tbody>
              </table>
            </div>}
          </div>}

          {repSub==="ledger"&&<div>
            <div style={{...ss.card,padding:"10px 14px",marginBottom:12,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              <Sel val={ledEnt} onChange={v=>{setLedEnt(v);setLedName(v==="client"?"NHAI":v==="vendor"?"Steel India Ltd":"");}} opts={[{v:"client",l:"Client Ledger"},{v:"vendor",l:"Vendor Ledger"}]}/>
              {ledEnt==="client"&&<Sel val={ledName} onChange={setLedName} opts={[...new Set((data.sales||[]).map(s=>s.client))].map(c=>({v:c,l:c}))}/>}
              {ledEnt==="vendor"&&<Sel val={ledName} onChange={setLedName} opts={[...new Set((data.purchases||[]).map(p=>p.vendor))].map(v=>({v:v,l:v}))}/>}
              <Btn onClick={printLedger} color={C.gr} icon="🖨">Print</Btn>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
              <KCard icon="⬆" label="Total Debit" value={INR(ledger.reduce((a,t)=>a+t.dr,0))} color={C.rd}/><KCard icon="⬇" label="Total Credit" value={INR(ledger.reduce((a,t)=>a+t.cr,0))} color={C.gn}/><KCard icon="=" label="Closing Balance" value={INR(ledger.length?ledger[ledger.length-1].bal:0)} color={C.or}/>
            </div>
            <Tbl cols={["Date","Ref","Description","Type","Debit","Credit","Balance"]}
              rows={ledger.map(r=>[r.date,<b key="r" style={{color:C.pu}}>{r.ref}</b>,r.desc,<Tag key="t" c="b" ch={r.type}/>,r.dr>0?<span key="d" style={{color:C.rd,fontWeight:700}}>{INR(r.dr)}</span>:"—",r.cr>0?<span key="c" style={{color:C.gn,fontWeight:700}}>{INR(r.cr)}</span>:"—",<b key="b" style={{color:r.bal>=0?C.tl:C.rd}}>{INR(r.bal)}</b>])}
              foot={["","","","Closing","","",INR(ledger.length?ledger[ledger.length-1].bal:0)]} csvName="ledger"/>
          </div>}

          {repSub==="daybook"&&<div>
            <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center"}}>
              <label style={ss.lbl}>Date:</label><input type="date" style={{...ss.inp,marginBottom:0,width:160}} value={dbDate} onChange={e=>setDbDate(e.target.value)}/><span style={{color:C.gr,fontSize:11}}>{dayBookEntries.length} entries</span>
              <Btn onClick={printDayBook} color={C.gr} icon="🖨">Print</Btn>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
              <KCard icon="⬆" label="Total In" value={INR(dayBookEntries.filter(e=>e.type==="income").reduce((a,e)=>a+e.amt,0))} color={C.gn}/><KCard icon="⬇" label="Total Out" value={INR(dayBookEntries.filter(e=>e.type==="expense").reduce((a,e)=>a+e.amt,0))} color={C.rd}/><KCard icon="=" label="Net" value={INR(dayBookEntries.filter(e=>e.type==="income").reduce((a,e)=>a+e.amt,0)-dayBookEntries.filter(e=>e.type==="expense").reduce((a,e)=>a+e.amt,0))} color={C.or}/>
            </div>
            <Tbl cols={["Module","Party","Description","Flow","Amount"]}
              rows={dayBookEntries.map(e=>[<Tag key="m" c={e.module==="Sales"?"g":e.module==="Purchase"?"r":e.module==="Bank"?"b":"o"} ch={e.module}/>,e.party,e.desc,<Tag key="t" c={e.type==="income"?"g":"r"} ch={e.type==="income"?"IN":"OUT"}/>,<b key="a" style={{color:e.type==="income"?C.gn:C.rd}}>{INR(e.amt)}</b>])}
              csvName={"daybook_"+dbDate}/>
          </div>}
        </div>}

        {/* ══ MASTERS ══ */}
        {tab==="masters"&&can("masters")&&<div>
          <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:14,padding:6,background:"#060C1A",borderRadius:10,width:"fit-content"}}>
            {MTABS.map(t=><button key={t.k} onClick={()=>setMTab(t.k)} style={{padding:"5px 14px",borderRadius:7,border:"none",fontFamily:"monospace",fontSize:10,fontWeight:mTab===t.k?700:400,cursor:"pointer",background:mTab===t.k?"linear-gradient(135deg,#1E2D45,#162236)":"transparent",color:mTab===t.k?C.or:C.gr,borderBottom:"2px solid "+(mTab===t.k?C.or:"transparent")}}>{t.l}</button>)}
          </div>
          {mTab==="sites"&&<MTbl cols={["Name","Client","Location","Status"]} rows={masters.sites.map(r=>[r.name,r.client,r.loc,<Tag key="s" c={r.status==="Active"?"g":"r"} ch={r.status}/>])} onEdit={i=>openMEdit("sites",i)} onDel={i=>setDel({key:"sites",idx:i,isM:true,label:masters.sites[i].name})}/>}
          {mTab==="clients"&&<MTbl cols={["Name","Contact","Phone","GST","Bill To","Ship To"]} rows={masters.clients.map(r=>[r.name,r.contact,r.phone,<span key="g" style={{color:C.gr,fontSize:10}}>{r.gst}</span>,r.billTo||"—",r.shipTo||"—"])} onEdit={i=>openMEdit("clients",i)} onDel={i=>setDel({key:"clients",idx:i,isM:true,label:masters.clients[i].name})}/>}
          {mTab==="vendors"&&<MTbl cols={["Name","Contact","Phone","Category","GST"]} rows={masters.vendors.map(r=>[r.name,r.contact,r.phone,<Tag key="c" c="b" ch={r.cat}/>,<span key="g" style={{color:C.gr,fontSize:10}}>{r.gst}</span>])} onEdit={i=>openMEdit("vendors",i)} onDel={i=>setDel({key:"vendors",idx:i,isM:true,label:masters.vendors[i].name})}/>}
          {mTab==="items"&&<MTbl cols={["Name","Unit","Category","HSN","Rate"]} rows={masters.items.map(r=>[r.name,r.unit,<Tag key="c" c="o" ch={r.cat}/>,<b key="h" style={{color:C.tl}}>{r.hsn}</b>,INR(r.rate)])} onEdit={i=>openMEdit("items",i)} onDel={i=>setDel({key:"items",idx:i,isM:true,label:masters.items[i].name})}/>}
          {mTab==="services"&&<MTbl cols={["Name","Unit","Category","SAC Code","Rate","GST"]} rows={masters.services.map(r=>[r.name,r.unit,<Tag key="c" c="p" ch={r.cat}/>,<b key="s" style={{color:C.tl}}>{r.sac}</b>,INR(r.rate),r.gst+"%"])} onEdit={i=>openMEdit("services",i)} onDel={i=>setDel({key:"services",idx:i,isM:true,label:masters.services[i].name})}/>}
          {mTab==="labours"&&<MTbl cols={["Photo","Name","Role","Site","Phone","Wage","PF","KYC"]} rows={masters.labours.map(r=>[r.photo?<img key="ph" src={r.photo} style={{width:32,height:32,objectFit:"cover",borderRadius:"50%",border:"1px solid "+C.br}}/>:<span key="ph" style={{fontSize:20}}>👤</span>,<b key="n">{r.name}</b>,<Tag key="r" c="p" ch={r.role}/>,sName(r.siteId),r.phone,INR(r.wage),<Tag key="p" c={r.pf?"g":"r"} ch={r.pf?"Yes":"No"}/>,r.kyc?<Tag key="k" c="g" ch="Verified"/>:<Tag key="k" c="r" ch="Pending"/>])} onEdit={i=>openMEdit("labours",i)} onDel={i=>setDel({key:"labours",idx:i,isM:true,label:masters.labours[i].name})}/>}
          {mTab==="machinery"&&<MTbl cols={["Machine","Type","Ownership","HSN","Reg","Status"]} rows={masters.machinery.map(r=>[r.name,<Tag key="t" c="b" ch={r.type}/>,<Tag key="o" c={r.owner==="Owned"?"g":"o"} ch={r.owner}/>,<b key="h" style={{color:C.tl}}>{r.hsn||"—"}</b>,r.reg,<Tag key="s" c={r.status==="Active"?"g":r.status==="Maintenance"?"o":"r"} ch={r.status}/>])} onEdit={i=>openMEdit("machinery",i)} onDel={i=>setDel({key:"machinery",idx:i,isM:true,label:masters.machinery[i].name})}/>}
          {mTab==="banks"&&<MTbl cols={["Name","Account No","IFSC","Branch","Opening"]} rows={masters.banks.map(r=>[r.name,r.accNo,r.ifsc,r.branch,INR(r.openBal)])} onEdit={i=>openMEdit("banks",i)} onDel={i=>setDel({key:"banks",idx:i,isM:true,label:masters.banks[i].name})}/>}
          {mTab==="pettyCash"&&<MTbl cols={["Name","Keeper","Opening Balance"]} rows={masters.pettyCash.map(r=>[r.name,r.keeper,INR(r.openBal)])} onEdit={i=>openMEdit("pettyCash",i)} onDel={i=>setDel({key:"pettyCash",idx:i,isM:true,label:masters.pettyCash[i].name})}/>}
          {mTab==="godowns"&&<MTbl cols={["Name","Location","Keeper"]} rows={masters.godowns.map(r=>[r.name,r.loc,r.keeper])} onEdit={i=>openMEdit("godowns",i)} onDel={i=>setDel({key:"godowns",idx:i,isM:true,label:masters.godowns[i].name})}/>}
          {mTab==="users"&&<MTbl cols={["Name","Username","Role","Module Access"]} rows={masters.users.map(r=>[r.name,r.username,<Tag key="r" c="p" ch={r.role}/>,<span key="a" style={{color:C.gr,fontSize:10}}>{(r.moduleAccess||[]).length} modules</span>])} onEdit={i=>openMEdit("users",i)} onDel={i=>setDel({key:"users",idx:i,isM:true,label:masters.users[i].name})}/>}
          {mTab==="expenseCats"&&<div><div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>{(masters.expenseCats||[]).map((c,i)=><Tag key={i} c="p" ch={c}/>)}</div><div style={{display:"flex",gap:8}}><input style={{...ss.inp,marginBottom:0,flex:1}} placeholder="New category..." id="newcat"/><Btn onClick={()=>{const v=document.getElementById("newcat").value.trim();if(v)updM("expenseCats",arr=>[...arr,v]);document.getElementById("newcat").value="";}} color={C.or} icon="＋">Add</Btn><Btn onClick={()=>updM("expenseCats",arr=>arr.slice(0,-1))} color={C.rd}>Remove Last</Btn></div></div>}
          {mTab==="company"&&<div style={{...ss.card,padding:18}}>{[["Company Name",co.name],["Address",co.addr],["GST",co.gst],["Phone",co.phone],["Email",co.email],["Bank",co.bank],["Account No",co.acc],["IFSC",co.ifsc],["Branch",co.branch],["Signatory",co.sign]].map(([l,v])=><div key={l} style={{display:"flex",padding:"7px 0",borderBottom:"1px solid #0A1223"}}><span style={{color:C.si,fontSize:10,width:130,flexShrink:0,textTransform:"uppercase"}}>{l}</span><span style={{color:"#E2E8F0",fontSize:11}}>{v||"—"}</span></div>)}<div style={{marginTop:14}}><Btn onClick={()=>{setForm({...masters.company});setModal({t:"master",key:"company"});}} color={C.or} icon="✎">Edit Company Info</Btn></div></div>}
        </div>}

        {/* ══ CIVIL CALCULATOR ══ */}
        {tab==="calc"&&<div>
          <SubTabs val={calcSub} onChange={setCalcSub} tabs={[
            {v:"reinforcement",l:"Reinforcement",icon:"🔩"},
            {v:"concrete",l:"Concrete",icon:"🏗"},
            {v:"brickwork",l:"Brickwork",icon:"🧱"},
            {v:"metal",l:"Metal Weight",icon:"⚙"},
            {v:"road",l:"Road",icon:"🛣"},
            {v:"roofpitch",l:"Roof / Pitch",icon:"🏠"},
            {v:"flooring",l:"Flooring",icon:"🪵"},
            {v:"paint",l:"Paint",icon:"🎨"},
            {v:"watertank",l:"Water Tank",icon:"💧"},
            {v:"excavation",l:"Excavation",icon:"🪣"},
            {v:"shuttering",l:"Shuttering",icon:"📐"},
            {v:"diagonal",l:"Diagonal",icon:"📏"},
            {v:"convert",l:"Unit Converter",icon:"🔄"},
          ]}/>
          {(()=>{
            const C2=({label,value,unit})=><div style={{...ss.card,padding:"12px 16px",background:"linear-gradient(135deg,"+G(C.tl,0.08)+",transparent)"}}><div style={{color:C.si,fontSize:9,letterSpacing:1,marginBottom:4,textTransform:"uppercase"}}>{label}</div><div style={{color:C.tl,fontFamily:"monospace",fontWeight:700,fontSize:16}}>{isNaN(value)||!isFinite(value)?"—":Number(value).toFixed(3)}</div>{unit&&<div style={{color:C.gr,fontSize:10,marginTop:2}}>{unit}</div>}</div>;
            const CG=({children})=><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{children}</div>;
            const Inp2=({label,k,placeholder,unit})=><F label={label+(unit?" ("+unit+")":"")+"  "}><input type="number" style={ss.inp} value={calcInputs[k]||""} onChange={e=>ci(k,e.target.value)} placeholder={placeholder||"0"}/></F>;
            const Card=({title,color,children})=><div style={{...ss.card,padding:18,background:"linear-gradient(135deg,#0E1628,#0A1223)"}}>
              <div style={{color:color||C.or,fontWeight:700,fontSize:13,marginBottom:14,borderBottom:"1px solid #1E2D45",paddingBottom:8}}>{title}</div>
              {children}
            </div>;
            const i=calcInputs;
            
            /* ── REINFORCEMENT ── */
            if(calcSub==="reinforcement") return <CG>
              <Card title="🔩 Bar Weight Calculator" color={C.rd}>
                <Inp2 label="Diameter" k="barDia" placeholder="12" unit="mm"/>
                <Inp2 label="Length" k="barLen" placeholder="12" unit="m"/>
                <Inp2 label="No. of Bars" k="barQty" placeholder="1"/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
                  <C2 label="Weight / bar" value={(Math.pow(i.barDia||0,2)/162.2)*(i.barLen||0)} unit="kg"/>
                  <C2 label="Total Weight" value={(Math.pow(i.barDia||0,2)/162.2)*(i.barLen||0)*(i.barQty||1)} unit="kg"/>
                </div>
                <div style={{...ss.card,padding:"8px 10px",marginTop:10,background:G(C.rd,0.06),border:"1px solid "+G(C.rd,0.2)}}><span style={{color:C.si,fontSize:10}}>Formula: D²/162.2 × Length (kg/m)</span></div>
              </Card>
              <Card title="📊 Stirrup Calculator" color={C.or}>
                <Inp2 label="Beam Width" k="bw" placeholder="300" unit="mm"/>
                <Inp2 label="Beam Depth" k="bd" placeholder="450" unit="mm"/>
                <Inp2 label="Cover" k="bCover" placeholder="25" unit="mm"/>
                <Inp2 label="Spacing" k="stirSpacing" placeholder="150" unit="mm"/>
                <Inp2 label="Beam Length" k="beamLen" placeholder="5" unit="m"/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
                  <C2 label="Perimeter" value={2*((i.bw||0)+(i.bd||0)-(4*(i.bCover||0)))/1000+0.1} unit="m/stirrup"/>
                  <C2 label="No. of Stirrups" value={Math.ceil((i.beamLen||0)*1000/(i.stirSpacing||150))+1} unit="nos"/>
                  <C2 label="Total Length" value={(2*((i.bw||0)+(i.bd||0)-(4*(i.bCover||0)))/1000+0.1)*(Math.ceil((i.beamLen||0)*1000/(i.stirSpacing||150))+1)} unit="m"/>
                </div>
              </Card>
              <Card title="🔩 Development Length" color={C.pu}>
                <Inp2 label="Bar Diameter" k="dlDia" placeholder="16" unit="mm"/>
                <F label="Steel Grade"><Sel val={i.dlGrade||"Fe415"} onChange={v=>setCalcInputs(p=>({...p,dlGrade:v}))} opts={["Fe415","Fe500","Fe550"]}/></F>
                <F label="Concrete Grade"><Sel val={i.dlConc||"M20"} onChange={v=>setCalcInputs(p=>({...p,dlConc:v}))} opts={["M15","M20","M25","M30","M35","M40"]}/></F>
                <C2 label="Development Length" value={(()=>{const fy={Fe415:415,Fe500:500,Fe550:550}[i.dlGrade||"Fe415"];const fck={M15:15,M20:20,M25:25,M30:30,M35:35,M40:40}[i.dlConc||"M20"];const tbd=fck<=20?1.2:fck<=25?1.4:fck<=30?1.5:fck<=35?1.7:1.9;return (0.87*fy*(i.dlDia||0))/(4*tbd);})() } unit="mm"/>
              </Card>
              <Card title="⚖ BBS Summary (Footings)" color={C.bl}>
                <Inp2 label="Footing Length" k="ftL" placeholder="1500" unit="mm"/>
                <Inp2 label="Footing Width" k="ftW" placeholder="1500" unit="mm"/>
                <Inp2 label="Main Bar Dia" k="ftDia" placeholder="12" unit="mm"/>
                <Inp2 label="Spacing" k="ftSpacing" placeholder="150" unit="mm"/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
                  <C2 label="Bars (L-dir)" value={Math.floor((i.ftW||0)/(i.ftSpacing||150))+1} unit="nos"/>
                  <C2 label="Bars (W-dir)" value={Math.floor((i.ftL||0)/(i.ftSpacing||150))+1} unit="nos"/>
                  <C2 label="Total Length" value={((Math.floor((i.ftW||0)/(i.ftSpacing||150))+1)*(i.ftL||0)+(Math.floor((i.ftL||0)/(i.ftSpacing||150))+1)*(i.ftW||0))/1000} unit="m"/>
                  <C2 label="Total Weight" value={Math.pow(i.ftDia||0,2)/162.2*((Math.floor((i.ftW||0)/(i.ftSpacing||150))+1)*(i.ftL||0)+(Math.floor((i.ftL||0)/(i.ftSpacing||150))+1)*(i.ftW||0))/1000} unit="kg"/>
                </div>
              </Card>
            </CG>;

            /* ── CONCRETE ── */
            if(calcSub==="concrete") return <CG>
              <Card title="🏗 Concrete Volume" color={C.tl}>
                <F label="Element"><Sel val={i.concElem||"slab"} onChange={v=>setCalcInputs(p=>({...p,concElem:v}))} opts={["slab","beam","column","footing","staircase"]}/></F>
                <Inp2 label="Length" k="cL" placeholder="5" unit="m"/>
                <Inp2 label="Width / Diameter" k="cW" placeholder="0.3" unit="m"/>
                <Inp2 label="Depth / Height" k="cD" placeholder="0.15" unit="m"/>
                <Inp2 label="No. of Members" k="cN" placeholder="1"/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
                  <C2 label="Wet Volume" value={(i.cL||0)*(i.cW||0)*(i.cD||0)*(i.cN||1)} unit="m³"/>
                  <C2 label="Dry Volume (×1.54)" value={(i.cL||0)*(i.cW||0)*(i.cD||0)*(i.cN||1)*1.54} unit="m³"/>
                </div>
              </Card>
              <Card title="🧮 Concrete Mix Design (M20)" color={C.or}>
                <Inp2 label="Concrete Volume" k="mixVol" placeholder="1" unit="m³"/>
                <F label="Mix Ratio"><Sel val={i.mixRatio||"1:1.5:3"} onChange={v=>setCalcInputs(p=>({...p,mixRatio:v}))} opts={["1:1:2","1:1.5:3","1:2:4","1:3:6"]}/></F>
                {(()=>{const ratio={"1:1:2":[1,1,2],"1:1.5:3":[1,1.5,3],"1:2:4":[1,2,4],"1:3:6":[1,3,6]}[i.mixRatio||"1:1.5:3"];const sum=ratio.reduce((a,b)=>a+b,0);const dryVol=(i.mixVol||1)*1.54;const cement=(dryVol*ratio[0]/sum)*1440;const sand=(dryVol*ratio[1]/sum)*1600;const agg=(dryVol*ratio[2]/sum)*1500;return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
                  <C2 label="Cement" value={cement} unit="kg"/>
                  <C2 label="Cement Bags (50kg)" value={cement/50} unit="bags"/>
                  <C2 label="Sand" value={sand} unit="kg"/>
                  <C2 label="Aggregate" value={agg} unit="kg"/>
                </div>;})()}
              </Card>
            </CG>;

            /* ── BRICKWORK ── */
            if(calcSub==="brickwork") return <CG>
              <Card title="🧱 Brickwork Calculator" color="#FB923C">
                <Inp2 label="Wall Length" k="wL" placeholder="5" unit="m"/>
                <Inp2 label="Wall Height" k="wH" placeholder="3" unit="m"/>
                <F label="Wall Thickness"><Sel val={i.wT||"0.23"} onChange={v=>setCalcInputs(p=>({...p,wT:v}))} opts={[{v:"0.115",l:"Half Brick (115mm)"},{v:"0.23",l:"Single Brick (230mm)"},{v:"0.345",l:"One & Half (345mm)"}]}/></F>
                <Inp2 label="Deduct Openings Area" k="wDed" placeholder="0" unit="m²"/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
                  <C2 label="Volume of Wall" value={((i.wL||0)*(i.wH||0)-(i.wDed||0))*(parseFloat(i.wT)||0.23)} unit="m³"/>
                  <C2 label="No. of Bricks" value={Math.ceil(((i.wL||0)*(i.wH||0)-(i.wDed||0))*(parseFloat(i.wT)||0.23)*500)} unit="nos"/>
                  <C2 label="Mortar Volume" value={((i.wL||0)*(i.wH||0)-(i.wDed||0))*(parseFloat(i.wT)||0.23)*0.3} unit="m³"/>
                  <C2 label="Cement (bags)" value={Math.ceil(((i.wL||0)*(i.wH||0)-(i.wDed||0))*(parseFloat(i.wT)||0.23)*0.3*1.3*320/50)} unit="bags"/>
                </div>
              </Card>
              <Card title="🏚 Plaster Calculator" color={C.si}>
                <Inp2 label="Area" k="plArea" placeholder="50" unit="m²"/>
                <F label="Thickness"><Sel val={i.plThk||"0.012"} onChange={v=>setCalcInputs(p=>({...p,plThk:v}))} opts={[{v:"0.012",l:"12mm"},{v:"0.015",l:"15mm"},{v:"0.020",l:"20mm"}]}/></F>
                <F label="Mix Ratio"><Sel val={i.plMix||"1:4"} onChange={v=>setCalcInputs(p=>({...p,plMix:v}))} opts={["1:3","1:4","1:5","1:6"]}/></F>
                {(()=>{const thk=parseFloat(i.plThk||0.012);const area=i.plArea||0;const vol=area*thk*1.35;const ratio=parseInt((i.plMix||"1:4").split(":")[1])||4;return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
                  <C2 label="Dry Volume" value={vol} unit="m³"/>
                  <C2 label="Cement" value={vol*1440/(1+ratio)} unit="kg"/>
                  <C2 label="Cement Bags" value={vol*1440/(1+ratio)/50} unit="bags"/>
                  <C2 label="Sand" value={vol*1600*ratio/(1+ratio)} unit="kg"/>
                </div>;})()}
              </Card>
            </CG>;

            /* ── METAL WEIGHT ── */
            if(calcSub==="metal") return <CG>
              <Card title="⚙ Metal Weight Calculator" color={C.gr}>
                <F label="Section Type"><Sel val={i.secType||"rod"} onChange={v=>setCalcInputs(p=>({...p,secType:v}))} opts={[{v:"rod",l:"Round Rod"},{v:"sq",l:"Square Rod"},{v:"plate",l:"MS Plate"},{v:"pipe",l:"Hollow Pipe"},{v:"angle",l:"Angle Section"}]}/></F>
                {i.secType==="rod"&&<><Inp2 label="Diameter" k="secD" placeholder="25" unit="mm"/><Inp2 label="Length" k="secL" placeholder="6" unit="m"/></>}
                {i.secType==="sq"&&<><Inp2 label="Side" k="secA" placeholder="25" unit="mm"/><Inp2 label="Length" k="secL" placeholder="6" unit="m"/></>}
                {i.secType==="plate"&&<><Inp2 label="Length" k="pltL" placeholder="2" unit="m"/><Inp2 label="Width" k="pltW" placeholder="1" unit="m"/><Inp2 label="Thickness" k="pltT" placeholder="6" unit="mm"/></>}
                {i.secType==="pipe"&&<><Inp2 label="Outer Dia" k="pipeOD" placeholder="50" unit="mm"/><Inp2 label="Thickness" k="pipeT" placeholder="3" unit="mm"/><Inp2 label="Length" k="secL" placeholder="6" unit="m"/></>}
                {i.secType==="angle"&&<><Inp2 label="Leg A" k="angA" placeholder="50" unit="mm"/><Inp2 label="Leg B" k="angB" placeholder="50" unit="mm"/><Inp2 label="Thickness" k="angT" placeholder="5" unit="mm"/><Inp2 label="Length" k="secL" placeholder="6" unit="m"/></>}
                <Inp2 label="Quantity" k="secQty" placeholder="1" unit="nos"/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
                  <C2 label="Weight / piece" value={(()=>{const ty=i.secType||"rod";const d=i.secD||0,a=i.secA||0,L=i.secL||0;if(ty==="rod")return Math.PI*(d/2000)**2*L*7850;if(ty==="sq")return (a/1000)**2*L*7850;if(ty==="plate")return (i.pltL||0)*(i.pltW||0)*(i.pltT||0)/1000*7850;if(ty==="pipe"){const od=i.pipeOD||0,t=i.pipeT||0;return Math.PI*((od/2000)**2-((od-2*t)/2000)**2)*L*7850;}if(ty==="angle"){const aa=i.angA||0,ab=i.angB||0,at=i.angT||0;return(aa+ab-at)*at/1000000*L*7850;}return 0;})() } unit="kg"/>
                  <C2 label="Total Weight" value={(()=>{const ty=i.secType||"rod";const d=i.secD||0,a=i.secA||0,L=i.secL||0;const w=ty==="rod"?Math.PI*(d/2000)**2*L*7850:ty==="sq"?(a/1000)**2*L*7850:ty==="plate"?(i.pltL||0)*(i.pltW||0)*(i.pltT||0)/1000*7850:ty==="pipe"?Math.PI*(((i.pipeOD||0)/2000)**2-(((i.pipeOD||0)-2*(i.pipeT||0))/2000)**2)*(i.secL||0)*7850:ty==="angle"?((i.angA||0)+(i.angB||0)-(i.angT||0))*(i.angT||0)/1000000*(i.secL||0)*7850:0;return w*(i.secQty||1);})() } unit="kg"/>
                </div>
              </Card>
              <Card title="📦 Material Density Reference" color={C.bl}>
                {[["MS / Steel","7850 kg/m³"],["Cast Iron","7200 kg/m³"],["Aluminum","2700 kg/m³"],["Copper","8900 kg/m³"],["Brass","8500 kg/m³"],["Stainless Steel","8000 kg/m³"],["Concrete (PCC)","2400 kg/m³"],["Concrete (RCC)","2500 kg/m³"],["Brick Masonry","1920 kg/m³"],["Soil (loose)","1600 kg/m³"]].map(([m,d])=><div key={m} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #0A1223",fontSize:10}}><span style={{color:C.si}}>{m}</span><span style={{color:"#CBD5E1",fontFamily:"monospace"}}>{d}</span></div>)}
              </Card>
            </CG>;

            /* ── ROAD ── */
            if(calcSub==="road") return <CG>
              <Card title="🛣 Road / Pavement" color={C.or}>
                <Inp2 label="Road Length" k="rdL" placeholder="1000" unit="m"/>
                <Inp2 label="Road Width" k="rdW" placeholder="7" unit="m"/>
                <Inp2 label="WBM/Base Thickness" k="rdBase" placeholder="0.2" unit="m"/>
                <Inp2 label="Bitumen Thickness" k="rdBit" placeholder="0.05" unit="m"/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
                  <C2 label="Road Area" value={(i.rdL||0)*(i.rdW||0)} unit="m²"/>
                  <C2 label="Base Volume" value={(i.rdL||0)*(i.rdW||0)*(i.rdBase||0)} unit="m³"/>
                  <C2 label="Bitumen Volume" value={(i.rdL||0)*(i.rdW||0)*(i.rdBit||0)} unit="m³"/>
                  <C2 label="Bitumen (tonnes)" value={(i.rdL||0)*(i.rdW||0)*(i.rdBit||0)*2.35} unit="t"/>
                </div>
              </Card>
              <Card title="🏔 Earthwork / Subgrade" color={C.pu}>
                <Inp2 label="Length" k="ewL" placeholder="500" unit="m"/>
                <Inp2 label="Top Width" k="ewTW" placeholder="8" unit="m"/>
                <Inp2 label="Bottom Width" k="ewBW" placeholder="5" unit="m"/>
                <Inp2 label="Height" k="ewH" placeholder="1.5" unit="m"/>
                <C2 label="Volume (Trapezoidal)" value={((i.ewTW||0)+(i.ewBW||0))/2*(i.ewH||0)*(i.ewL||0)} unit="m³"/>
              </Card>
            </CG>;

            /* ── ROOF / PITCH ── */
            if(calcSub==="roofpitch") return <CG>
              <Card title="🏠 Roof Area & Pitch" color={C.rd}>
                <Inp2 label="Plan Length" k="rfL" placeholder="10" unit="m"/>
                <Inp2 label="Plan Width" k="rfW" placeholder="8" unit="m"/>
                <Inp2 label="Pitch (Rise/Run)" k="rfPitch" placeholder="30" unit="degrees"/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
                  <C2 label="Slope Factor" value={1/Math.cos((i.rfPitch||30)*Math.PI/180)} unit="×"/>
                  <C2 label="Actual Roof Area" value={(i.rfL||0)*(i.rfW||0)/Math.cos((i.rfPitch||30)*Math.PI/180)} unit="m²"/>
                  <C2 label="Ridge Length" value={i.rfL||0} unit="m"/>
                  <C2 label="Rafter Length" value={(i.rfW||0)/2/Math.cos((i.rfPitch||30)*Math.PI/180)} unit="m"/>
                </div>
              </Card>
              <Card title="🪣 Rain Water Harvesting" color={C.tl}>
                <Inp2 label="Roof Area" k="rwArea" placeholder="100" unit="m²"/>
                <Inp2 label="Annual Rainfall" k="rwRain" placeholder="800" unit="mm"/>
                <C2 label="Runoff Volume" value={(i.rwArea||0)*(i.rwRain||0)/1000*0.85} unit="m³/year"/>
              </Card>
            </CG>;

            /* ── FLOORING ── */
            if(calcSub==="flooring") return <CG>
              <Card title="🪵 Flooring / Tiling" color="#FB923C">
                <Inp2 label="Room Length" k="flL" placeholder="5" unit="m"/>
                <Inp2 label="Room Width" k="flW" placeholder="4" unit="m"/>
                <Inp2 label="Tile Size" k="flTS" placeholder="600" unit="mm"/>
                <Inp2 label="Wastage %" k="flWaste" placeholder="10"/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
                  <C2 label="Floor Area" value={(i.flL||0)*(i.flW||0)} unit="m²"/>
                  <C2 label="Tiles Required" value={Math.ceil((i.flL||0)*(i.flW||0)/Math.pow((i.flTS||600)/1000,2)*(1+(i.flWaste||10)/100))} unit="nos"/>
                  <C2 label="With Wastage" value={(i.flL||0)*(i.flW||0)*(1+(i.flWaste||10)/100)} unit="m²"/>
                </div>
              </Card>
              <Card title="🏠 Skirting Calculator" color={C.si}>
                <Inp2 label="Perimeter" k="skPer" placeholder="18" unit="m"/>
                <Inp2 label="Skirting Height" k="skH" placeholder="100" unit="mm"/>
                <Inp2 label="Door Width" k="skDoor" placeholder="1" unit="m"/>
                <C2 label="Skirting Length" value={(i.skPer||0)-(i.skDoor||0)} unit="m"/>
                <C2 label="Skirting Area" value={((i.skPer||0)-(i.skDoor||0))*(i.skH||100)/1000} unit="m²"/>
              </Card>
            </CG>;

            /* ── PAINT ── */
            if(calcSub==="paint") return <CG>
              <Card title="🎨 Paint Calculator" color={C.pu}>
                <Inp2 label="Wall Area" k="ptArea" placeholder="100" unit="m²"/>
                <Inp2 label="Deduct Doors/Windows" k="ptDed" placeholder="10" unit="m²"/>
                <F label="No. of Coats"><Sel val={i.ptCoats||"2"} onChange={v=>setCalcInputs(p=>({...p,ptCoats:v}))} opts={[{v:"1",l:"1 coat"},{v:"2",l:"2 coats"},{v:"3",l:"3 coats"}]}/></F>
                <F label="Paint Type"><Sel val={i.ptType||"emulsion"} onChange={v=>setCalcInputs(p=>({...p,ptType:v}))} opts={[{v:"emulsion",l:"Emulsion (covering ~10m²/L)"},{v:"distemper",l:"Distemper (~12m²/L)"},{v:"primer",l:"Primer (~8m²/L)"},{v:"enamel",l:"Enamel (~15m²/L)"}]}/></F>
                {(()=>{const cov={emulsion:10,distemper:12,primer:8,enamel:15}[i.ptType||"emulsion"];const net=(i.ptArea||0)-(i.ptDed||0);const coats=parseInt(i.ptCoats||2);return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
                  <C2 label="Net Area" value={net} unit="m²"/>
                  <C2 label="Paint Required" value={net*coats/cov} unit="litres"/>
                  <C2 label="4L Tins" value={Math.ceil(net*coats/cov/4)} unit="tins"/>
                  <C2 label="20L Drums" value={Math.ceil(net*coats/cov/20)} unit="drums"/>
                </div>;})()}
              </Card>
              <Card title="🔵 Primer & Putty" color={C.bl}>
                <Inp2 label="Total Wall Area" k="pwArea" placeholder="120" unit="m²"/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
                  <C2 label="Wall Putty (kg)" value={(i.pwArea||0)*0.5} unit="kg"/>
                  <C2 label="Primer (L)" value={(i.pwArea||0)/8} unit="litres"/>
                  <C2 label="Putty Bags (5kg)" value={Math.ceil((i.pwArea||0)*0.5/5)} unit="bags"/>
                </div>
              </Card>
            </CG>;

            /* ── WATER TANK ── */
            if(calcSub==="watertank") return <CG>
              <Card title="💧 Water Tank Capacity" color={C.tl}>
                <F label="Tank Shape"><Sel val={i.wtShape||"rect"} onChange={v=>setCalcInputs(p=>({...p,wtShape:v}))} opts={[{v:"rect",l:"Rectangular"},{v:"round",l:"Circular"},{v:"overhead",l:"Overhead Sump"}]}/></F>
                {(i.wtShape||"rect")==="rect"&&<><Inp2 label="Length" k="wtL" placeholder="2" unit="m"/><Inp2 label="Width" k="wtW" placeholder="1.5" unit="m"/><Inp2 label="Depth" k="wtD" placeholder="1.2" unit="m"/></>}
                {i.wtShape==="round"&&<><Inp2 label="Diameter" k="wtDia" placeholder="2" unit="m"/><Inp2 label="Height" k="wtH" placeholder="1.5" unit="m"/></>}
                <Inp2 label="Free Board" k="wtFB" placeholder="0.15" unit="m"/>
                {(()=>{const cap=i.wtShape==="round"?Math.PI*(i.wtDia||0)**2/4*((i.wtH||0)-(i.wtFB||0.15)):(i.wtL||0)*(i.wtW||0)*((i.wtD||0)-(i.wtFB||0.15));return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
                  <C2 label="Capacity" value={cap} unit="m³"/>
                  <C2 label="Capacity" value={cap*1000} unit="litres"/>
                </div>;})()}
              </Card>
              <Card title="🚿 Daily Requirement" color={C.or}>
                <Inp2 label="No. of Persons" k="wdPer" placeholder="50"/>
                <F label="Usage per Person"><Sel val={i.wdUsage||"135"} onChange={v=>setCalcInputs(p=>({...p,wdUsage:v}))} opts={[{v:"75",l:"Rural (75L)"},{v:"100",l:"Semi-urban (100L)"},{v:"135",l:"Urban (135L)"},{v:"150",l:"Metro (150L)"}]}/></F>
                <Inp2 label="Storage Days" k="wdDays" placeholder="1"/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
                  <C2 label="Daily Demand" value={(i.wdPer||0)*(parseInt(i.wdUsage||135))/1000} unit="m³/day"/>
                  <C2 label="Tank Capacity Reqd" value={(i.wdPer||0)*(parseInt(i.wdUsage||135))/1000*(i.wdDays||1)} unit="m³"/>
                </div>
              </Card>
            </CG>;

            /* ── EXCAVATION ── */
            if(calcSub==="excavation") return <CG>
              <Card title="🪣 Excavation Volume" color={C.or}>
                <F label="Foundation Type"><Sel val={i.excType||"trench"} onChange={v=>setCalcInputs(p=>({...p,excType:v}))} opts={[{v:"trench",l:"Trench (Strip)"},{v:"pit",l:"Isolated Pit"},{v:"slope",l:"Cut Slope (Trapezoidal)"}]}/></F>
                <Inp2 label="Length" k="excL" placeholder="10" unit="m"/>
                <Inp2 label={i.excType==="slope"?"Top Width":"Width"} k="excW" placeholder="1.2" unit="m"/>
                {i.excType==="slope"&&<Inp2 label="Bottom Width" k="excBW" placeholder="0.8" unit="m"/>}
                <Inp2 label="Depth" k="excD" placeholder="1.5" unit="m"/>
                <Inp2 label="Earthwork Factor" k="excF" placeholder="1.3"/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
                  <C2 label="Net Volume" value={i.excType==="slope"?((i.excW||0)+(i.excBW||0))/2*(i.excD||0)*(i.excL||0):(i.excL||0)*(i.excW||0)*(i.excD||0)} unit="m³"/>
                  <C2 label="Disposal Vol (×factor)" value={(i.excType==="slope"?((i.excW||0)+(i.excBW||0))/2:(i.excW||0))*(i.excD||0)*(i.excL||0)*(i.excF||1.3)} unit="m³"/>
                </div>
              </Card>
              <Card title="🏗 Plum Concrete" color={C.si}>
                <Inp2 label="PCC Volume" k="plumVol" placeholder="10" unit="m³"/>
                <F label="Grade"><Sel val={i.plumGrade||"M10"} onChange={v=>setCalcInputs(p=>({...p,plumGrade:v}))} opts={["M7.5","M10","M15"]}/></F>
                {(()=>{const ratio={M7_5:[1,4,8],M10:[1,3,6],M15:[1,2,4]}[i.plumGrade||"M10"]||[1,3,6];const v=(i.plumVol||0)*1.54;const s=ratio.reduce((a,b)=>a+b,0);return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
                  <C2 label="Cement (bags)" value={v*ratio[0]/s*1440/50} unit="bags"/>
                  <C2 label="Sand" value={v*ratio[1]/s*1600} unit="kg"/>
                  <C2 label="Aggregate" value={v*ratio[2]/s*1500} unit="kg"/>
                </div>;})()}
              </Card>
            </CG>;

            /* ── SHUTTERING ── */
            if(calcSub==="shuttering") return <CG>
              <Card title="📐 Shuttering Area" color={C.bl}>
                <F label="Element"><Sel val={i.shutElem||"slab"} onChange={v=>setCalcInputs(p=>({...p,shutElem:v}))} opts={[{v:"slab",l:"Slab"},{v:"beam",l:"Beam"},{v:"column",l:"Column"}]}/></F>
                {i.shutElem==="slab"&&<><Inp2 label="Length" k="shL" placeholder="5" unit="m"/><Inp2 label="Width" k="shW" placeholder="4" unit="m"/></>}
                {i.shutElem==="beam"&&<><Inp2 label="Span" k="shL" placeholder="5" unit="m"/><Inp2 label="Width" k="shW" placeholder="0.3" unit="m"/><Inp2 label="Depth" k="shD" placeholder="0.45" unit="m"/><Inp2 label="No. of Beams" k="shN" placeholder="1"/></>}
                {i.shutElem==="column"&&<><Inp2 label="Perimeter" k="shPer" placeholder="1.2" unit="m"/><Inp2 label="Height" k="shH" placeholder="3" unit="m"/><Inp2 label="No. of Columns" k="shN" placeholder="1"/></>}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
                  <C2 label="Shuttering Area" value={(()=>{if(i.shutElem==="slab")return(i.shL||0)*(i.shW||0);if(i.shutElem==="beam")return((i.shW||0)+2*(i.shD||0))*(i.shL||0)*(i.shN||1);if(i.shutElem==="column")return(i.shPer||0)*(i.shH||0)*(i.shN||1);return 0;})() } unit="m²"/>
                </div>
              </Card>
              <Card title="📦 Shuttering Materials" color={C.gr}>
                <Inp2 label="Total Shuttering Area" k="shtArea" placeholder="100" unit="m²"/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
                  <C2 label="Plywood (nos)" value={Math.ceil((i.shtArea||0)/2.5)} unit="sheets (1220×2440)"/>
                  <C2 label="Nails" value={(i.shtArea||0)*0.5} unit="kg"/>
                  <C2 label="Props (nos)" value={Math.ceil((i.shtArea||0)/1.5)} unit="nos"/>
                  <C2 label="Timber (approx)" value={(i.shtArea||0)*0.05} unit="m³"/>
                </div>
              </Card>
            </CG>;

            /* ── DIAGONAL ── */
            if(calcSub==="diagonal") return <CG>
              <Card title="📏 Diagonal & Pythagoras" color={C.rd}>
                <Inp2 label="Length (L)" k="dgL" placeholder="4" unit="m"/>
                <Inp2 label="Width (W)" k="dgW" placeholder="3" unit="m"/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
                  <C2 label="Diagonal" value={Math.sqrt(Math.pow(i.dgL||0,2)+Math.pow(i.dgW||0,2))} unit="m"/>
                  <C2 label="Area" value={(i.dgL||0)*(i.dgW||0)} unit="m²"/>
                  <C2 label="Perimeter" value={2*((i.dgL||0)+(i.dgW||0))} unit="m"/>
                  <C2 label="3rd Side (given 2 sides)" value={Math.sqrt(Math.abs(Math.pow(i.dgL||0,2)-Math.pow(i.dgW||0,2)))} unit="m"/>
                </div>
              </Card>
              <Card title="📐 Compound Angles" color={C.or}>
                <Inp2 label="Angle A" k="cmpA" placeholder="30" unit="°"/>
                <Inp2 label="Hypotenuse" k="cmpH" placeholder="5" unit="m"/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
                  <C2 label="Opposite (sin A × H)" value={Math.sin((i.cmpA||0)*Math.PI/180)*(i.cmpH||0)} unit="m"/>
                  <C2 label="Adjacent (cos A × H)" value={Math.cos((i.cmpA||0)*Math.PI/180)*(i.cmpH||0)} unit="m"/>
                </div>
              </Card>
            </CG>;

            /* ── UNIT CONVERTER ── */
            if(calcSub==="convert") return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
              {[
                {title:"📏 Length",color:C.tl,conv:[["mm","m",0.001],["cm","m",0.01],["inch","m",0.0254],["ft","m",0.3048],["yard","m",0.9144],["km","m",1000],["mile","m",1609.34]]},
                {title:"🏗 Area",color:C.or,conv:[["sqft","sqm",0.0929],["sqyd","sqm",0.836],["acre","sqm",4047],["hectare","sqm",10000],["sqinch","sqm",0.000645]]},
                {title:"💧 Volume",color:C.bl,conv:[["litre","m³",0.001],["gallon","m³",0.004546],["cubic ft","m³",0.0283],["cubic yard","m³",0.7646],["cubic inch","m³",0.0000164]]},
                {title:"⚖ Weight",color:C.pu,conv:[["gram","kg",0.001],["pound","kg",0.4536],["tonne","kg",1000],["quintal","kg",100],["cwt","kg",50.8]]},
                {title:"🌡 Temperature",color:C.rd,conv:[["°C to °F","=",null],["°F to °C","=",null]]},
                {title:"📐 Angle",color:C.gn,conv:[["degree","radian",Math.PI/180],["radian","degree",180/Math.PI],["gradian","degree",0.9],["percent slope","degree",null]]},
              ].map(({title,color,conv})=><Card key={title} title={title} color={color}>
                <Inp2 label="Input Value" k={"uc_"+title.split(" ").join("")} placeholder="1"/>
                {conv.map(([from,to,factor])=>{const val=i["uc_"+title.split(" ").join("")]||0;let res;if(from==="°C to °F")res=val*9/5+32;else if(from==="°F to °C")res=(val-32)*5/9;else if(from==="percent slope")res=Math.atan(val/100)*180/Math.PI;else res=val*factor;return <div key={from} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #0A1223",fontSize:10}}><span style={{color:C.si}}>{from} → {to}</span><span style={{color:color,fontWeight:600,fontFamily:"monospace"}}>{isNaN(res)||!isFinite(res)?"—":res.toFixed(5)}</span></div>;})}
              </Card>)}
            </div>;

            return <div style={{...ss.card,padding:40,textAlign:"center",color:C.gr}}>Select a calculator from tabs above</div>;
          })()}
        </div>}

        {/* ══ SETTINGS ══ */}
        {tab==="settings"&&<div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{...ss.card,padding:20}}>
              <div style={{color:C.or,fontWeight:700,marginBottom:16,fontSize:12,borderBottom:BD,paddingBottom:10}}>🎨 Interface Settings</div>
              <F label="Accent / Brand Color">
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
                  {["#F59E0B","#34D399","#60A5FA","#A78BFA","#F87171","#2DD4BF","#FB923C","#E879F9"].map(c=><div key={c} onClick={()=>setSettings({...settings,accent:c})} style={{width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",border:settings.accent===c?"3px solid white":"2px solid transparent",boxSizing:"border-box"}}/>)}
                  <input type="color" value={settings.accent} onChange={e=>setSettings({...settings,accent:e.target.value})} style={{width:32,height:32,border:"none",background:"none",cursor:"pointer",borderRadius:"50%"}}/>
                </div>
              </F>
              <F label="Font Family"><Sel val={settings.font||"monospace"} onChange={v=>setSettings({...settings,font:v})} opts={[{v:"monospace",l:"Monospace (default)"},{v:"sans",l:"Sans-serif"},{v:"serif",l:"Serif"}]}/></F>
              <F label="Font Size"><Sel val={settings.fontSize||12} onChange={v=>setSettings({...settings,fontSize:+v})} opts={[{v:11,l:"Small (11px)"},{v:12,l:"Medium (12px)"},{v:13,l:"Large (13px)"},{v:14,l:"X-Large (14px)"}]}/></F>
              <div style={{marginTop:14,display:"flex",gap:8}}>
                <Btn onClick={()=>saveSettings(settings)} color={C.gn} icon="💾">Save Settings</Btn>
                <Btn onClick={()=>{const d=DEF_SETTINGS;setSettings(d);saveSettings(d);}} color={C.gr}>Reset Defaults</Btn>
              </div>
            </div>
            <div style={{...ss.card,padding:20}}>
              <div style={{color:C.or,fontWeight:700,marginBottom:16,fontSize:12,borderBottom:BD,paddingBottom:10}}>💾 Data Management</div>
              <div style={{marginBottom:12,padding:"10px 14px",background:G(C.gn,0.07),borderRadius:8,border:`1px solid ${G(C.gn,0.2)}`}}>
                <div style={{color:C.gn,fontWeight:700,fontSize:11,marginBottom:4}}>Auto-save Enabled</div>
                <div style={{color:C.si,fontSize:10}}>All transaction data is automatically saved to your browser's local storage after every change.</div>
              </div>
              <div style={{display:"flex",gap:8,flexDirection:"column"}}>
                <Btn onClick={()=>{const meta={exportedAt:new Date().toISOString(),version:"v10",records:{sales:(data.sales||[]).length,purchases:(data.purchases||[]).length,dpr:(data.dpr||[]).length,vouchers:(data.vouchers||[]).length}};const blob=new Blob([JSON.stringify({meta,data,masters,settings},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="SiteLedger_v10_backup_"+(new Date().toISOString().slice(0,10))+"_"+(new Date().toISOString().slice(11,16).replace(":","-"))+".json";a.click();}} color={C.tl} icon="⬇" full>Export Full Backup (JSON)</Btn>
                <label style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"8px 16px",borderRadius:7,border:`1px solid ${C.bl}`,background:G(C.bl,0.1),color:C.bl,cursor:"pointer",fontFamily:"monospace",fontSize:11,fontWeight:700}}>
                  <span>⬆</span> Import Backup (JSON)
                  <input type="file" accept=".json" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{try{const b=JSON.parse(ev.target.result);if(b.data)setData(b.data);if(b.masters)setMasters(b.masters);if(b.settings){setSettings(b.settings);saveSettings(b.settings);}alert("Backup restored successfully!");}catch{alert("Invalid backup file.");}};r.readAsText(f);}}/>
                </label>
                <Btn onClick={()=>{if(window.confirm("Clear all transaction data? Masters will be kept."))setData(INIT_D);}} color={C.rd} icon="🗑" full>Reset Transaction Data</Btn>
              </div>
            </div>
          </div>
        </div>}

        </div></div></div>

    {/* ═══════════ RECEIVE / PAY MODAL ═══════════ */}
    {/* ═══════════ DIRECT BANK ENTRY MODAL ═══════════ */}
    {modal&&modal.t==="bankEntry"&&<Modal title="🏦 DIRECT BANK DEBIT / CREDIT ENTRY" onClose={()=>setModal(null)}>
      <div style={{...ss.card,padding:"8px 14px",marginBottom:12,background:G(C.bl,0.07),border:"1px solid "+G(C.bl,0.2)}}><span style={{color:C.bl,fontSize:10}}>Direct bank debit/credit entry — interest, charges, EMI, salary, etc. TDS/TCS captured if filled.</span></div>
      <GR cols="1fr 1fr"><F label="Date"><Inp val={form.date||""} onChange={v=>sf("date",v)} type="date"/></F><F label="Bank Account"><Sel val={form.bankId||""} onChange={v=>sf("bankId",v)} opts={masters.banks.map(b=>({v:b.id,l:b.name}))}/></F></GR>
      <F label="Category"><Sel val={form.category||"Other"} onChange={v=>sf("category",v)} opts={["Bank Charges","Interest Received","Interest Paid","EMI Payment","Loan Disbursement","Loan Repayment","Salary Transfer","Dividend","Tax Payment","GST Payment","TDS Payment","Capital Introduced","Drawings","Other"]}/></F>
      <GR cols="1fr 1fr"><F label="Transaction Type"><div style={{display:"flex",gap:6,marginBottom:8}}>{["Cr","Dr"].map(t=><button key={t} onClick={()=>sf("type",t)} style={{flex:1,padding:"8px",borderRadius:7,border:"1px solid "+(form.type===t?(t==="Cr"?C.gn:C.rd):"#1E2D45"),background:form.type===t?(t==="Cr"?G(C.gn,0.15):G(C.rd,0.15)):"#060C1A",color:form.type===t?(t==="Cr"?C.gn:C.rd):C.gr,cursor:"pointer",fontFamily:"monospace",fontSize:11,fontWeight:form.type===t?700:400}}>{t==="Cr"?"📥 Credit (Money In)":"📤 Debit (Money Out)"}</button>)}</div></F>
      <F label="Amount"><Num val={form.amt} onChange={v=>sf("amt",v)}/></F></GR>
      <F label="Description"><Inp val={form.desc||""} onChange={v=>sf("desc",v)} placeholder="Bank interest / charges / transfer / EMI..."/></F>
      <F label="Reference / Cheque No"><Inp val={form.ref||""} onChange={v=>sf("ref",v)} placeholder="CHQ-001 / NEFT-REF..."/></F>
      <div style={{...ss.card,padding:"10px 14px",marginBottom:8,background:G(C.pu,0.06),border:"1px solid "+G(C.pu,0.2)}}>
        <div style={{color:C.pu,fontSize:10,fontWeight:700,marginBottom:8,letterSpacing:.5}}>TDS / TCS (optional — fill if applicable)</div>
        <GR cols="1fr 1fr 1fr"><F label="TDS Deducted (₹)"><Num val={form.tdsAmt||0} onChange={v=>sf("tdsAmt",v)}/></F><F label="TCS Collected (₹)"><Num val={form.tcsAmt||0} onChange={v=>sf("tcsAmt",v)}/></F><F label="Section"><Inp val={form.section||""} onChange={v=>sf("section",v)} placeholder="194C / 206C..."/></F></GR>
      </div>
      <Btn full onClick={saveBankEntry} color={form.type==="Cr"?C.gn:C.rd}>{form.type==="Cr"?"Save Credit Entry":"Save Debit Entry"}</Btn>
    </Modal>}

    {/* ═══════════ CHEQUE MODAL ═══════════ */}
    {modal&&modal.t==="cheque"&&<Modal title={(modal.oid?"EDIT":"NEW")+" CHEQUE ENTRY"} onClose={()=>setModal(null)}>
      <GR cols="1fr 1fr"><F label="Date"><Inp val={form.date||""} onChange={v=>sf("date",v)} type="date"/></F><F label="Cheque Type"><div style={{display:"flex",gap:6,marginBottom:8}}>{["received","issued"].map(t=><button key={t} onClick={()=>sf("type",t)} style={{flex:1,padding:"8px",borderRadius:7,border:"1px solid "+(form.type===t?(t==="received"?C.gn:C.rd):"#1E2D45"),background:form.type===t?(t==="received"?G(C.gn,0.15):G(C.rd,0.15)):"#060C1A",color:form.type===t?(t==="received"?C.gn:C.rd):C.gr,cursor:"pointer",fontFamily:"monospace",fontSize:11,fontWeight:form.type===t?700:400}}>{t==="received"?"📥 Received":"📤 Issued"}</button>)}</div></F></GR>
      <GR cols="1fr 1fr"><F label="Cheque No"><Inp val={form.chequeNo||""} onChange={v=>sf("chequeNo",v)} placeholder="CHQ-001"/></F><F label="Bank Account"><Sel val={form.bankId||""} onChange={v=>sf("bankId",v)} opts={masters.banks.map(b=>({v:b.id,l:b.name}))}/></F></GR>
      <GR cols="1fr 1fr"><F label={form.type==="received"?"Received From":"Issued To"}><Inp val={form.party||""} onChange={v=>sf("party",v)} placeholder="Party name"/></F><F label="Amount"><Num val={form.amt} onChange={v=>sf("amt",v)}/></F></GR>
      <GR cols="1fr 1fr"><F label="Cheque Due / Clearing Date"><Inp val={form.dueDate||""} onChange={v=>sf("dueDate",v)} type="date"/></F><F label="Status"><Sel val={form.status||"Pending"} onChange={v=>sf("status",v)} opts={["Pending","Presented","Cleared","Bounced","Cancelled"]}/></F></GR>
      <F label="Description / Narration"><Inp val={form.desc||""} onChange={v=>sf("desc",v)} placeholder="Invoice reference / purpose..."/></F>
      {form.status==="Bounced"&&<div style={{...ss.card,padding:"8px 12px",background:G(C.rd,0.1),border:"1px solid "+G(C.rd,0.3),marginBottom:8}}><span style={{color:C.rd,fontSize:11}}>⚠ Bounced cheque — remember to record bank charges and re-present/recover from party.</span></div>}
      <Btn full onClick={saveCheque} color={form.type==="received"?C.gn:C.rd}>Save Cheque</Btn>
    </Modal>}

    {modal&&modal.t==="rcv"&&<Modal title={modal.isSale?"💚 RECEIVE PAYMENT":"🔴 MAKE PAYMENT"} onClose={()=>setModal(null)}>
      <div style={{background:G(C.or,0.07),borderRadius:8,padding:"10px 14px",marginBottom:14,border:"1px solid "+G(C.or,0.15)}}>
        {[["Total",INR(form._tot||0),"#E2E8F0"],["Paid",INR(form.paidAmt||0),C.gn],["Balance",INR(form._bal||0),C.rd]].map(([l,v,c])=><div key={l} style={{display:"flex",justifyContent:"space-between",padding:"3px 0"}}><span style={{color:C.si,fontSize:11}}>{l}</span><span style={{color:c,fontWeight:700,fontFamily:"monospace"}}>{v}</span></div>)}
      </div>
      <GR cols="1fr 1fr"><F label="Date"><Inp val={form.payDate} onChange={v=>sf("payDate",v)} type="date"/></F><F label="Amount"><Num val={form.payAdd} onChange={v=>sf("payAdd",v)}/></F></GR>
      <F label="Payment Mode"><div style={{display:"flex",gap:6,marginBottom:10}}>{["bank","petty"].map(m=><button key={m} onClick={()=>sf("via",m)} style={{flex:1,padding:"8px",borderRadius:7,border:"1px solid "+(form.via===m?C.or:"#1E2D45"),background:form.via===m?G(C.or,0.15):"#060C1A",color:form.via===m?C.or:C.gr,cursor:"pointer",fontFamily:"monospace",fontSize:11,fontWeight:form.via===m?700:400}}>{m==="bank"?"🏦 Bank / RTGS":"💵 Petty Cash"}</button>)}</div></F>
      {form.via==="bank"&&<F label="Bank Account"><Sel val={form.accountId} onChange={v=>sf("accountId",v)} opts={masters.banks.map(b=>({v:b.id,l:b.name}))}/></F>}
      {form.via==="petty"&&<F label="Petty Cash Book"><Sel val={form.accountId} onChange={v=>sf("accountId",v)} opts={masters.pettyCash.map(p=>({v:p.id,l:p.name}))}/></F>}
      <F label="Reference / Cheque No"><Inp val={form.payRef} onChange={v=>sf("payRef",v)} placeholder="RTGS-001 / CHQ-1234"/></F>
      <div style={{...ss.card,padding:"10px 14px",marginBottom:8,background:G(C.pu,0.06),border:"1px solid "+G(C.pu,0.2)}}>
        <div style={{color:C.pu,fontSize:10,fontWeight:700,marginBottom:6,letterSpacing:.5}}>TDS / TCS (fill if deducted at source)</div>
        <GR cols="1fr 1fr 1fr">
          <F label={modal.isSale?"TDS Deducted by Client (₹)":"TDS You Deduct (₹)"}><Num val={form.rcvTds||0} onChange={v=>sf("rcvTds",v)}/></F>
          <F label="TCS (₹)"><Num val={form.rcvTcs||0} onChange={v=>sf("rcvTcs",v)}/></F>
          <F label="Section"><Inp val={form.rcvSection||"194C"} onChange={v=>sf("rcvSection",v)} placeholder="194C / 194J..."/></F>
        </GR>
        {(form.rcvTds>0||form.rcvTcs>0)&&<div style={{color:C.si,fontSize:10,marginTop:4}}>Net cash {modal.isSale?"received":"paid"}: <b style={{color:C.or}}>{INR(Math.max(0,(Number(form.payAdd)||0)-(form.rcvTds||0)-(form.rcvTcs||0)))}</b></div>}
      </div>
      <Btn full onClick={()=>{
        saveRcvPay();
        const taxAmt=(form.rcvTds||0)+(form.rcvTcs||0);
        if(taxAmt>0){upd("tdsTcs",arr=>[...arr,{id:uid(),date:form.payDate,txnType:form.rcvTds>0?"tds":"tcs",direction:modal.isSale?"receivable":"payable",party:form.client||form.vendor||form.name||"",partyType:modal.isSale?"client":"vendor",section:form.rcvSection||"194C",rate:0,baseAmt:Number(form.payAdd)||0,taxAmt,refInv:form.inv||form.dnNo||"",status:"Deducted",challNo:""}]);}
      }} color={modal.isSale?C.gn:C.rd}>{modal.isSale?"Confirm Receipt":"Confirm Payment"}</Btn>
    </Modal>}

    {/* ═══════════ TRANSACTION MODALS ═══════════ */}
    {modal&&modal.t==="txn"&&(()=>{
      const isEdit=!!modal.oid;const mod=modal.mod;
      const liItems=form.lineItems||[{desc:"",item:"",hsn:"",qty:1,unit:"",rate:0,gst:18,disc:0}];
      const liTotal=calcLI(liItems).total;
      const TITLES={sales:"SALES INVOICE",so:"SALE ORDER",estimate:"ESTIMATE / QUOTATION",proforma:"PROFORMA INVOICE",debitNote:"DEBIT NOTE",creditNote:"CREDIT NOTE",purch:"PURCHASE BILL",po:"PURCHASE ORDER",exp:"EXPENSE",pay:"PAYROLL",att:"ATTENDANCE",vouchers:"VOUCHER",contra:"CONTRA ENTRY",loans:"LOAN",transfers:"STOCK TRANSFER",matreceipt:"MATERIAL RECEIPT",inventory:"INVENTORY ENTRY",dpr:"DAILY PROGRESS REPORT"};
      const tt=(isEdit?"EDIT — ":"NEW — ")+(TITLES[mod]||mod.toUpperCase());
      const isWide=["purch","exp","pay","att","loans","transfers","matreceipt","dpr","debitNote","creditNote"].includes(mod);
      const isXWide=["sales","so","po","estimate","proforma"].includes(mod);
      return <Modal title={tt} onClose={()=>setModal(null)} wide={isWide} xwide={isXWide}>

        {/* SALES INVOICE */}
        {mod==="sales"&&<div>
          <GR cols="1fr 1fr"><F label="Date"><Inp val={form.date} onChange={v=>sf("date",v)} type="date"/></F><F label="Invoice No"><Inp val={form.inv} onChange={v=>sf("inv",v)} placeholder="INV-005"/></F></GR>
          <GR cols="1fr 1fr"><F label="Site"><Sel val={form.siteId} onChange={v=>sf("siteId",v)} opts={siteOpts}/></F><F label="Link Sale Order"><Sel val={form.soId||""} onChange={v=>sf("soId",v)} opts={[{v:"",l:"None (Direct)"},...(data.saleOrders||[]).map(s=>({v:s.id,l:s.client+" — "+s.desc}))]}/></F></GR>
          <GR cols="1fr 1fr"><F label="Client"><Sel val={form.client||""} onChange={v=>sf("client",v)} opts={[{v:"",l:"Select Client"},...masters.clients.map(c=>c.name)]}/></F><F label="TDS %"><Sel val={form.tds||2} onChange={v=>sf("tds",+v)} opts={[0,1,2,5,10]}/></F></GR>
          <LineItemsEditor items={liItems} onChange={v=>sf("lineItems",v)} type="service" serviceOpts={masters.services} itemOpts={masters.items} gstOpts={gOpts} showDiscount showHSN/>
          <GR cols="2fr 1fr"><F label="Description (summary)"><Inp val={form.desc} onChange={v=>sf("desc",v)}/></F>
          <div style={{...ss.card,padding:"10px 12px",textAlign:"right",background:"#060C1A"}}><div style={{color:C.si,fontSize:9}}>NET PAYABLE (after TDS)</div><div style={{color:C.or,fontWeight:700,fontFamily:"monospace",fontSize:14}}>{INR(calcLI(liItems).basic*(1-(form.tds||2)/100)+calcLI(liItems).gstAmt)}</div></div></GR>
          <GR cols="1fr 1fr"><F label="Invoice Type"><Sel val={form.invoiceType||"RA"} onChange={v=>sf("invoiceType",v)} opts={[{v:"RA",l:"Running Account (RA)"},{v:"Final",l:"Final Invoice"},{v:"Supplementary",l:"Supplementary"}]}/></F><F label="Client Work Order No"><Inp val={form.clientWONo||""} onChange={v=>sf("clientWONo",v)} placeholder="WO/2025/001"/></F></GR>
          <GR cols="1fr 1fr"><F label="Client WO Date"><Inp val={form.clientWODate||""} onChange={v=>sf("clientWODate",v)} type="date"/></F><F label="E-Way Bill No"><Inp val={form.eWayBill||""} onChange={v=>sf("eWayBill",v)} placeholder="EWB-XXXXXXXXXXXXXXXXX"/></F></GR>
          <Btn full onClick={()=>{saveRec("sales",form);setModal(null);setForm({});}}>Save Invoice</Btn>
        </div>}

        {/* SALE ORDER */}
        {mod==="so"&&<div>
          <GR cols="1fr 1fr"><F label="Date"><Inp val={form.date} onChange={v=>sf("date",v)} type="date"/></F><F label="Site"><Sel val={form.siteId} onChange={v=>sf("siteId",v)} opts={siteOpts}/></F></GR>
          <GR cols="1fr 1fr"><F label="Client"><Sel val={form.client||""} onChange={v=>sf("client",v)} opts={[{v:"",l:"Select"},...masters.clients.map(c=>c.name)]}/></F><F label="TDS %"><Sel val={form.tds||2} onChange={v=>sf("tds",+v)} opts={[0,1,2,5,10]}/></F></GR>
          <F label="Description"><Inp val={form.desc} onChange={v=>sf("desc",v)} placeholder="Contract description"/></F>
          <LineItemsEditor items={liItems} onChange={v=>sf("lineItems",v)} type="service" serviceOpts={masters.services} itemOpts={masters.items} gstOpts={gOpts} showHSN/>
          <GR cols="1fr 1fr"><F label="Status"><Sel val={form.status||"Active"} onChange={v=>sf("status",v)} opts={["Active","Completed","Cancelled"]}/></F>
          <div style={{...ss.card,padding:"10px 12px",textAlign:"right",background:"#060C1A"}}><div style={{color:C.si,fontSize:9}}>ORDER VALUE</div><div style={{color:C.or,fontWeight:700,fontFamily:"monospace",fontSize:14}}>{INR(liTotal)}</div></div></GR>
          <Btn full onClick={()=>{saveRec("saleOrders",{...form,convertedInvs:form.convertedInvs||[]});setModal(null);setForm({});}}>Save Sale Order</Btn>
        </div>}

        {/* JOB ORDER */}
        {mod==="jo"&&<div>
          <GR cols="1fr 1fr"><F label="Date"><Inp val={form.date} onChange={v=>sf("date",v)} type="date"/></F><F label="Job Order No"><Inp val={form.joNo} onChange={v=>sf("joNo",v)} placeholder="JO-001"/></F></GR>
          <GR cols="1fr 1fr">
            <F label="Link Sale Order">
              <Sel val={form.soId||""} onChange={v=>{
                sf("soId",v);
                const so = (data.saleOrders||[]).find(s=>s.id===v);
                if(so) {
                  sf("siteId", so.siteId);
                  sf("client", so.client);
                  if(!(form.tasks?.length>0)) {
                    sf("tasks", (so.lineItems||[]).map((li,i)=>({id:uid()+i, name: li.desc || li.item || "Unknown Task", qty: li.qty||1, unit: li.unit||"Nos", phase: "Site Preparation", estStartDate: form.date||new Date().toISOString().slice(0,10), estEndDate: "", matBudget: 0, labBudget: 0, macBudget: 0})));
                  }
                }
              }} opts={[{v:"",l:"Select Sale Order"},...(data.saleOrders||[]).map(s=>({v:s.id,l:s.client+" — "+s.desc}))]}/>
            </F>
            <F label="Site"><Sel val={form.siteId} onChange={v=>sf("siteId",v)} opts={siteOpts}/></F>
          </GR>
          {form.tasks && form.tasks.length > 0 && <div style={{...ss.card, padding:10, marginTop:10, overflowX:"auto"}}>
            <div style={{color:C.or, fontWeight:700, marginBottom:8}}>Task Allocations & Budget</div>
            <table style={{borderCollapse:"collapse", width:"100%", fontSize:10}}>
              <thead><tr style={{background:"#060C1A"}}>{["Phase","Task","Start Date","End Date","Mat. Budget","Lab. Budget","Mac. Budget"].map(h=><th key={h} style={{...ss.th, padding:"6px 4px"}}>{h}</th>)}</tr></thead>
              <tbody>{form.tasks.map((t,i)=><tr key={i}>
                <td style={{...ss.td, padding:"4px"}}><Sel val={t.phase} onChange={v=>sf("tasks", form.tasks.map((x,idx)=>idx===i?{...x, phase:v}:x))} opts={["Site Preparation","Foundation & Sub-Structure","Super Structure & RCC","Finishing & MEP"]}/></td>
                <td style={{...ss.td, padding:"4px"}}><Inp val={t.name} onChange={v=>sf("tasks", form.tasks.map((x,idx)=>idx===i?{...x, name:v}:x))}/></td>
                <td style={{...ss.td, padding:"4px"}}><Inp type="date" val={t.estStartDate} onChange={v=>sf("tasks", form.tasks.map((x,idx)=>idx===i?{...x, estStartDate:v}:x))}/></td>
                <td style={{...ss.td, padding:"4px"}}><Inp type="date" val={t.estEndDate} onChange={v=>sf("tasks", form.tasks.map((x,idx)=>idx===i?{...x, estEndDate:v}:x))}/></td>
                <td style={{...ss.td, padding:"4px"}}><Num val={t.matBudget} onChange={v=>sf("tasks", form.tasks.map((x,idx)=>idx===i?{...x, matBudget:v}:x))}/></td>
                <td style={{...ss.td, padding:"4px"}}><Num val={t.labBudget} onChange={v=>sf("tasks", form.tasks.map((x,idx)=>idx===i?{...x, labBudget:v}:x))}/></td>
                <td style={{...ss.td, padding:"4px"}}><Num val={t.macBudget} onChange={v=>sf("tasks", form.tasks.map((x,idx)=>idx===i?{...x, macBudget:v}:x))}/></td>
              </tr>)}</tbody>
            </table>
            <div style={{marginTop:8, display:"flex", justifyContent:"space-between", background:"#060C1A", padding:"8px", borderRadius:4}}>
              <span style={{color:C.tl, fontWeight:700}}>Total Mat: {INR(form.tasks.reduce((a,x)=>a+(Number(x.matBudget)||0),0))}</span>
              <span style={{color:C.pu, fontWeight:700}}>Total Lab: {INR(form.tasks.reduce((a,x)=>a+(Number(x.labBudget)||0),0))}</span>
              <span style={{color:C.or, fontWeight:700}}>Total Mac: {INR(form.tasks.reduce((a,x)=>a+(Number(x.macBudget)||0),0))}</span>
            </div>
          </div>}
          <div style={{marginTop:12}}>
            <Btn full onClick={()=>{saveRec("jobOrders",form);setModal(null);setForm({});}}>Save Job Order</Btn>
          </div>
        </div>}

        {/* ESTIMATE */}
        {mod==="estimate"&&<div>
          <GR cols="1fr 1fr"><F label="Date"><Inp val={form.date} onChange={v=>sf("date",v)} type="date"/></F><F label="Estimate No"><Inp val={form.estNo} onChange={v=>sf("estNo",v)} placeholder="EST-002"/></F></GR>
          <GR cols="1fr 1fr"><F label="Site"><Sel val={form.siteId} onChange={v=>sf("siteId",v)} opts={siteOpts}/></F><F label="Client"><Sel val={form.client||""} onChange={v=>sf("client",v)} opts={[{v:"",l:"Select"},...masters.clients.map(c=>c.name)]}/></F></GR>
          <GR cols="1fr 1fr"><F label="Valid Till"><Inp val={form.validTill} onChange={v=>sf("validTill",v)} type="date"/></F><F label="Status"><Sel val={form.status||"Draft"} onChange={v=>sf("status",v)} opts={["Draft","Sent","Approved","Rejected"]}/></F></GR>
          <F label="Description"><Inp val={form.desc} onChange={v=>sf("desc",v)} placeholder="Estimate for..."/></F>
          <LineItemsEditor items={liItems} onChange={v=>sf("lineItems",v)} type="service" serviceOpts={masters.services} itemOpts={masters.items} gstOpts={gOpts} showDiscount showHSN/>
          <Btn full onClick={()=>{saveRec("estimates",form);setModal(null);setForm({});}}>Save Estimate / Quotation</Btn>
        </div>}

        {/* PROFORMA */}
        {mod==="proforma"&&<div>
          <GR cols="1fr 1fr"><F label="Date"><Inp val={form.date} onChange={v=>sf("date",v)} type="date"/></F><F label="Proforma No"><Inp val={form.pfNo} onChange={v=>sf("pfNo",v)} placeholder="PRO-002"/></F></GR>
          <GR cols="1fr 1fr"><F label="Site"><Sel val={form.siteId} onChange={v=>sf("siteId",v)} opts={siteOpts}/></F><F label="Client"><Sel val={form.client||""} onChange={v=>sf("client",v)} opts={[{v:"",l:"Select"},...masters.clients.map(c=>c.name)]}/></F></GR>
          <GR cols="1fr 1fr"><F label="Valid Till"><Inp val={form.validTill} onChange={v=>sf("validTill",v)} type="date"/></F><F label="Description"><Inp val={form.desc} onChange={v=>sf("desc",v)}/></F></GR>
          <LineItemsEditor items={liItems} onChange={v=>sf("lineItems",v)} type="service" serviceOpts={masters.services} itemOpts={masters.items} gstOpts={gOpts} showHSN/>
          <Btn full onClick={()=>{saveRec("proforma",form);setModal(null);setForm({});}}>Save Proforma Invoice</Btn>
        </div>}

        {/* DEBIT NOTE */}
        {mod==="debitNote"&&<div>
          <GR cols="1fr 1fr"><F label="Date"><Inp val={form.date} onChange={v=>sf("date",v)} type="date"/></F><F label="Debit Note No"><Inp val={form.dnNo} onChange={v=>sf("dnNo",v)} placeholder="DN-002"/></F></GR>
          <GR cols="1fr 1fr"><F label="Site"><Sel val={form.siteId} onChange={v=>sf("siteId",v)} opts={siteOpts}/></F><F label="Client"><Sel val={form.client||""} onChange={v=>sf("client",v)} opts={[{v:"",l:"Select"},...masters.clients.map(c=>c.name)]}/></F></GR>
          <GR cols="1fr 1fr"><F label="Invoice Ref"><Inp val={form.invRef||""} onChange={v=>sf("invRef",v)} placeholder="INV-001"/></F><F label="TDS %"><Sel val={form.tds||2} onChange={v=>sf("tds",+v)} opts={[0,1,2,5,10]}/></F></GR>
          <F label="Reason for Debit Note"><Inp val={form.reason||""} onChange={v=>sf("reason",v)} placeholder="Price revision / extra charges / penalty"/></F>
          <LineItemsEditor items={liItems} onChange={v=>sf("lineItems",v)} type="service" serviceOpts={masters.services} itemOpts={masters.items} gstOpts={gOpts} showHSN/>
          <Btn full onClick={()=>{saveRec("debitNotes",form);setModal(null);setForm({});}}>Save Debit Note</Btn>
        </div>}

        {/* CREDIT NOTE */}
        {mod==="creditNote"&&<div>
          <GR cols="1fr 1fr"><F label="Date"><Inp val={form.date} onChange={v=>sf("date",v)} type="date"/></F><F label="Credit Note No"><Inp val={form.cnNo} onChange={v=>sf("cnNo",v)} placeholder="CN-002"/></F></GR>
          <GR cols="1fr 1fr"><F label="Site"><Sel val={form.siteId} onChange={v=>sf("siteId",v)} opts={siteOpts}/></F><F label="Vendor"><Sel val={form.vendor||""} onChange={v=>sf("vendor",v)} opts={[{v:"",l:"Select"},...masters.vendors.map(v=>v.name)]}/></F></GR>
          <GR cols="1fr 1fr"><F label="Bill Ref (PO / Bill No)"><Inp val={form.billRef||""} onChange={v=>sf("billRef",v)} placeholder="PU-001"/></F><div/></GR>
          <F label="Reason for Credit Note"><Inp val={form.reason||""} onChange={v=>sf("reason",v)} placeholder="Quality rejection / return / price correction"/></F>
          <LineItemsEditor items={liItems} onChange={v=>sf("lineItems",v)} type="item" serviceOpts={masters.services} itemOpts={masters.items} gstOpts={gOpts} showHSN/>
          <Btn full onClick={()=>{saveRec("creditNotes",form);setModal(null);setForm({});}}>Save Credit Note</Btn>
        </div>}

        {/* PURCHASE ORDER */}
        {mod==="po"&&<div>
          <GR cols="1fr 1fr"><F label="Date"><Inp val={form.date} onChange={v=>sf("date",v)} type="date"/></F><F label="Site"><Sel val={form.siteId} onChange={v=>sf("siteId",v)} opts={siteOpts}/></F></GR>
          <F label="Vendor"><Sel val={form.vendor||""} onChange={v=>sf("vendor",v)} opts={[{v:"",l:"Select"},...masters.vendors.map(v=>v.name)]}/></F>
          <F label="Description"><Inp val={form.desc} onChange={v=>sf("desc",v)} placeholder="Material supply description"/></F>
          <LineItemsEditor items={liItems} onChange={v=>sf("lineItems",v)} type="item" serviceOpts={masters.services} itemOpts={masters.items} gstOpts={gOpts} showHSN/>
          <GR cols="1fr 1fr"><F label="Status"><Sel val={form.status||"Active"} onChange={v=>sf("status",v)} opts={["Active","Completed","Cancelled"]}/></F>
          <div style={{...ss.card,padding:"10px 12px",textAlign:"right",background:"#060C1A"}}><div style={{color:C.si,fontSize:9}}>ORDER VALUE</div><div style={{color:C.or,fontWeight:700,fontFamily:"monospace",fontSize:14}}>{INR(liTotal)}</div></div></GR>
          <Btn full onClick={()=>{saveRec("purchaseOrders",form);setModal(null);setForm({});}}>Save Purchase Order</Btn>
        </div>}

        {/* PURCHASE BILL */}
        {mod==="purch"&&<div>
          <GR cols="1fr 1fr"><F label="Date"><Inp val={form.date} onChange={v=>sf("date",v)} type="date"/></F><F label="Site"><Sel val={form.siteId} onChange={v=>sf("siteId",v)} opts={siteOpts}/></F></GR>
          <GR cols="1fr 1fr">
            <F label="Job Order"><Sel val={form.jobOrderId||""} onChange={v=>{sf("jobOrderId",v);sf("taskId","");}} opts={[{v:"",l:"None"},...(data.jobOrders||[]).filter(j=>j.siteId===form.siteId).map(j=>({v:j.id,l:j.joNo}))]}/></F>
            {form.jobOrderId ? <F label="Task"><Sel val={form.taskId||""} onChange={v=>sf("taskId",v)} opts={[{v:"",l:"Select Task"},...((data.jobOrders||[]).find(j=>j.id===form.jobOrderId)?.tasks||[]).map(t=>({v:t.id,l:t.name}))]}/></F> : <div/>}
          </GR>
          <F label="Vendor"><Sel val={form.vendor||""} onChange={v=>sf("vendor",v)} opts={[{v:"",l:"Select"},...masters.vendors.map(v=>v.name)]}/></F>
          <GR cols="1fr 1fr"><F label="Item"><Sel val={form.item||""} onChange={v=>{sf("item",v);const it=masters.items.find(i=>i.name===v);if(it){sf("unit",it.unit);sf("rate",it.rate);sf("gst",it.gst||18);sf("hsn",it.hsn||"");}}} opts={[{v:"",l:"Select"},...masters.items.map(i=>i.name)]}/></F><F label="HSN Code"><Inp val={form.hsn||""} onChange={v=>sf("hsn",v)} placeholder="HSN / SAC code"/></F></GR>
          <GR cols="1fr 1fr 1fr"><F label="Qty"><Num val={form.qty} onChange={v=>sf("qty",v)}/></F><F label="Unit"><Inp val={form.unit||""} onChange={v=>sf("unit",v)}/></F><F label="Rate"><Num val={form.rate} onChange={v=>sf("rate",v)}/></F></GR>
          <GR cols="1fr 1fr 1fr"><F label="Item Category"><Sel val={form.itemCategory||"Goods"} onChange={v=>sf("itemCategory",v)} opts={[{v:"Goods",l:"Goods"},{v:"Services",l:"Services"},{v:"Capital Goods",l:"Capital Goods"}]}/></F><F label="ITC Eligibility"><Sel val={form.itcEligible!==false?"eligible":"ineligible"} onChange={v=>sf("itcEligible",v==="eligible")} opts={[{v:"eligible",l:"Eligible for ITC"},{v:"ineligible",l:"Ineligible for ITC"}]}/></F><F label="GST %"><Sel val={form.gst||18} onChange={v=>sf("gst",+v)} opts={gOpts}/></F></GR>
          {form.itemCategory==="Capital Goods"&&<div style={{...ss.card,padding:"8px 12px",marginBottom:8,background:G(C.pu,0.07),border:"1px solid "+G(C.pu,0.2)}}><span style={{color:C.pu,fontSize:10}}>Capital Goods: ITC available @50% in year 1, balance in subsequent years.</span></div>}
          <F label="ITC Claim Status"><Sel val={form.itcClaimed?"yes":"no"} onChange={v=>sf("itcClaimed",v==="yes")} opts={[{v:"no",l:"Pending Claim"},{v:"yes",l:"Claimed"}]}/></F>
          {form.qty>0&&form.rate>0&&<div style={{background:G(C.rd,0.07),borderRadius:7,padding:"8px 12px",marginBottom:8,border:"1px solid "+G(C.rd,0.2)}}>{[["Basic",INR((form.qty||0)*(form.rate||0)),"#E2E8F0"],["GST",INR((form.qty||0)*(form.rate||0)*(form.gst||18)/100),C.or],["Total",INR((form.qty||0)*(form.rate||0)*(1+(form.gst||18)/100)),C.rd]].map(([l,v,c],i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span style={{color:C.si}}>{l}</span><span style={{color:c,fontWeight:i===2?700:400,fontFamily:"monospace"}}>{v}</span></div>)}</div>}
          <GR cols="1fr 1fr"><F label="E-Way Bill No (optional)"><Inp val={form.eWayBill||""} onChange={v=>sf("eWayBill",v)} placeholder="EWB-XXXXXXXXXXXXXXXXX"/></F><F label="Vehicle / Transport No"><Inp val={form.vehicleNo||""} onChange={v=>sf("vehicleNo",v)} placeholder="MH-12-AB-1234"/></F></GR>
          <Btn full onClick={()=>saveTxn("purchases")}>Save Purchase</Btn>
        </div>}

        {/* EXPENSE */}
        {mod==="exp"&&<div>
          <GR cols="1fr 1fr"><F label="Date"><Inp val={form.date} onChange={v=>sf("date",v)} type="date"/></F><F label="Site"><Sel val={form.siteId} onChange={v=>sf("siteId",v)} opts={siteOpts}/></F></GR>
          <GR cols="1fr 1fr">
            <F label="Job Order"><Sel val={form.jobOrderId||""} onChange={v=>{sf("jobOrderId",v);sf("taskId","");}} opts={[{v:"",l:"None"},...(data.jobOrders||[]).filter(j=>j.siteId===form.siteId).map(j=>({v:j.id,l:j.joNo}))]}/></F>
            {form.jobOrderId ? <F label="Task"><Sel val={form.taskId||""} onChange={v=>sf("taskId",v)} opts={[{v:"",l:"Select Task"},...((data.jobOrders||[]).find(j=>j.id===form.jobOrderId)?.tasks||[]).map(t=>({v:t.id,l:t.name}))]}/></F> : <div/>}
          </GR>
          <GR cols="1fr 1fr"><F label="Category"><Sel val={form.cat||""} onChange={v=>sf("cat",v)} opts={[{v:"",l:"Select"},...(masters.expenseCats||[])]}/></F><F label="HSN/SAC (optional)"><Inp val={form.hsn||""} onChange={v=>sf("hsn",v)} placeholder="—"/></F></GR>
          <F label="Description"><Inp val={form.desc||""} onChange={v=>sf("desc",v)}/></F>
          <F label="Amount"><Num val={form.amt} onChange={v=>sf("amt",v)}/></F>
          <F label="Bill / Receipt Photo (optional)">
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
              {(form.images||[]).map((img,i)=><div key={i} style={{position:"relative",width:72,height:72}}>
                <img src={img} style={{width:72,height:72,objectFit:"cover",borderRadius:6,border:"1px solid "+C.br}}/>
                <button onClick={()=>sf("images",(form.images||[]).filter((_,j)=>j!==i))} style={{position:"absolute",top:-4,right:-4,background:C.rd,border:"none",borderRadius:"50%",width:18,height:18,color:"white",cursor:"pointer",fontSize:11}}>x</button>
              </div>)}
              <button onClick={()=>pickImage(url=>sf("images",[...(form.images||[]),url]))} style={{width:72,height:72,borderRadius:6,border:"2px dashed "+C.br,background:"transparent",color:C.gr,cursor:"pointer",fontSize:10,fontFamily:"monospace",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4}}>
                <span style={{fontSize:22}}>📷</span>Add Bill
              </button>
            </div>
          </F>
          <Btn full onClick={()=>saveTxn("expenses")}>Save Expense</Btn>
        </div>}

        {/* PAYROLL */}
        {mod==="pay"&&<div>
          <GR cols="1fr 1fr"><F label="Month"><Inp val={form.month||""} onChange={v=>sf("month",v)} type="month"/></F><F label="Site"><Sel val={form.siteId} onChange={v=>sf("siteId",v)} opts={siteOpts}/></F></GR>
          <GR cols="1fr 1fr">
            <F label="Job Order"><Sel val={form.jobOrderId||""} onChange={v=>{sf("jobOrderId",v);sf("taskId","");}} opts={[{v:"",l:"None"},...(data.jobOrders||[]).filter(j=>j.siteId===form.siteId).map(j=>({v:j.id,l:j.joNo}))]}/></F>
            {form.jobOrderId ? <F label="Task"><Sel val={form.taskId||""} onChange={v=>sf("taskId",v)} opts={[{v:"",l:"Select Task"},...((data.jobOrders||[]).find(j=>j.id===form.jobOrderId)?.tasks||[]).map(t=>({v:t.id,l:t.name}))]}/></F> : <div/>}
          </GR>
          <GR cols="1fr 1fr"><F label="Employee"><Sel val={form.name||""} onChange={v=>{sf("name",v);autoFill(v);const lb=masters.labours.find(l=>l.name===v);if(lb)sf("role",lb.role);}} opts={[{v:"",l:"Select"},...masters.labours.map(l=>l.name)]}/></F><F label="Role"><Inp val={form.role||""} onChange={v=>sf("role",v)}/></F></GR>
          <GR cols="1fr 1fr 1fr"><F label="Working Days"><Num val={form.days} onChange={v=>sf("days",v)}/></F><F label="Days Present"><Num val={form.present} onChange={v=>sf("present",v)}/></F><F label="Basic Salary"><Num val={form.basic} onChange={v=>sf("basic",v)}/></F></GR>
          {form.basic>0&&<div style={{background:G(C.pu,0.07),borderRadius:7,padding:"10px 12px",marginBottom:8,border:"1px solid "+G(C.pu,0.2)}}>{(()=>{const p=cW(form);return[["Earned Basic",INR(p.e),"#E2E8F0"],["HRA 40%",INR(p.h),C.pu],["Gross",INR(p.gr),C.or],["PF 12%","–"+INR(p.pf),C.rd],["ESI 0.75%","–"+INR(p.esi),C.rd],["Prof Tax","–"+INR(p.pt),C.rd],["LWF","–"+INR(p.lwf||25),C.rd],["TDS","–"+INR(p.tds),C.rd],["NET PAY",INR(p.net),C.tl]].map(([l,v,c],i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:i===6?"1px solid "+G(C.pu,0.2):"none"}}><span style={{color:C.si}}>{l}</span><span style={{color:c,fontWeight:i===7?700:400,fontFamily:"monospace"}}>{v}</span></div>);})()}</div>}
          <Btn full onClick={()=>saveTxn("payroll")}>Save Payroll</Btn>
        </div>}

        {/* ATTENDANCE */}
        {mod==="att"&&<div>
          <GR cols="1fr 1fr"><F label="Date"><Inp val={form.date||""} onChange={v=>sf("date",v)} type="date"/></F><F label="Site"><Sel val={form.siteId} onChange={v=>sf("siteId",v)} opts={siteOpts}/></F></GR>
          <F label="Employee"><Sel val={form.name||""} onChange={v=>{sf("name",v);const lb=masters.labours.find(l=>l.name===v);if(lb)sf("role",lb.role);}} opts={[{v:"",l:"Select"},...masters.labours.map(l=>l.name)]}/></F>
          <GR cols="1fr 1fr"><F label="Status"><Sel val={form.status||"present"} onChange={v=>{sf("status",v);sf("present",["present","halfday","outsideduty"].includes(v));}} opts={[{v:"present",l:"Present"},{v:"halfday",l:"Half Day"},{v:"absent",l:"Absent"},{v:"paidleave",l:"Paid Leave"},{v:"paidholiday",l:"Paid Holiday"},{v:"outsideduty",l:"Outside Duty"}]}/></F><F label="Overtime Hours"><Num val={form.ot||0} onChange={v=>sf("ot",v)}/></F></GR>
          <Btn full onClick={()=>saveTxn("attendance")}>Save Attendance</Btn>
        </div>}

        {/* GATE REGISTER */}
        {mod==="gateRegister"&&<div>
          <F label="Entry Type"><Sel val={form.type||"Visitor"} onChange={v=>sf("type",v)} opts={["Visitor","Employee"]}/></F>
          {form.type==="Employee" ? (
            <F label="Select Employee"><Sel val={form.name||""} onChange={v=>sf("name",v)} opts={[{v:"",l:"Select HR Person"},...masters.labours.map(l=>l.name)]}/></F>
          ) : (
            <F label="Name"><Inp val={form.name||""} onChange={v=>sf("name",v)}/></F>
          )}
          {form.type!=="Employee" && <GR cols="1fr 1fr">
            <F label="Address"><Inp val={form.address||""} onChange={v=>sf("address",v)}/></F>
            <F label="Mobile No."><Inp val={form.mobile||""} onChange={v=>sf("mobile",v)}/></F>
          </GR>}
          {form.type!=="Employee" && <GR cols="1fr 1fr">
            <F label="Purpose"><Inp val={form.purpose||""} onChange={v=>sf("purpose",v)}/></F>
            <F label="Whom to Visit"><Inp val={form.whomToVisit||""} onChange={v=>sf("whomToVisit",v)}/></F>
          </GR>}
          <GR cols="1fr 1fr">
            <F label="Date"><Inp type="date" val={form.date||new Date().toISOString().slice(0,10)} onChange={v=>sf("date",v)}/></F>
            <F label="Time In"><Inp type="time" val={form.timeIn||new Date().toLocaleTimeString('en-US',{hour12:false,hour:"2-digit",minute:"2-digit"})} onChange={v=>sf("timeIn",v)}/></F>
          </GR>
          {modal.oid && <F label="Time Out (Optional)"><Inp type="time" val={form.timeOut||""} onChange={v=>sf("timeOut",v)}/></F>}
          <Btn full onClick={()=>{
            if(!form.name) return alert("Enter name");
            const date = form.date || new Date().toISOString().slice(0,10);
            if(form.type === "Employee") {
              const emp = masters.labours.find(l=>l.name===form.name);
              if(emp) {
                 const existAtt = (data.attendance||[]).find(a=>a.name===form.name && a.date===date);
                 if(!existAtt) upd("attendance", arr=>[...arr, {id:uid(), date, siteId:emp.siteId, name:emp.name, role:emp.role, present:true, status:"present", ot:0}]);
              }
            }
            saveTxn("gateRegister");
          }}>Save Entry</Btn>
        </div>}

        {/* VOUCHER */}
        {mod==="vouchers"&&<div>
          <GR cols="1fr 1fr"><F label="Date"><Inp val={form.date||""} onChange={v=>sf("date",v)} type="date"/></F><F label="Voucher Flow"><div style={{display:"flex",gap:5,marginBottom:8}}>{[{v:"in",l:"💚 Money In",c:C.gn},{v:"out",l:"🔴 Money Out",c:C.rd}].map(o=><button key={o.v} onClick={()=>sf("vtype",o.v)} style={{flex:1,padding:"7px",borderRadius:7,border:"1px solid "+(form.vtype===o.v?o.c:"#1E2D45"),background:form.vtype===o.v?G(o.c,0.15):"#060C1A",color:form.vtype===o.v?o.c:C.gr,cursor:"pointer",fontFamily:"monospace",fontSize:11,fontWeight:form.vtype===o.v?700:400}}>{o.l}</button>)}</div></F></GR>
          <F label="Payment Type">
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
              {[
                {v:"against_invoice",l:"Against Invoice",icon:"🧾",desc:"Payment for specific invoice"},
                {v:"advance_invoice",l:"Advance — Invoice",icon:"📤",desc:"Advance against future invoice"},
                {v:"advance_ledger",l:"Advance — Ledger",icon:"📒",desc:"Open advance on ledger (no invoice)"},
                {v:"adhoc",l:"Ad Hoc Payment",icon:"💸",desc:"One-time misc payment"},
              ].map(o=><button key={o.v} onClick={()=>sf("paymentType",o.v)} style={{padding:"8px 10px",borderRadius:7,border:"1px solid "+(form.paymentType===o.v?C.or:"#1E2D45"),background:form.paymentType===o.v?G(C.or,0.1):"#060C1A",color:form.paymentType===o.v?C.or:C.gr,cursor:"pointer",textAlign:"left",fontFamily:"monospace"}}>
                <div style={{fontSize:14,marginBottom:2}}>{o.icon}</div>
                <div style={{fontSize:10,fontWeight:form.paymentType===o.v?700:400,color:form.paymentType===o.v?C.or:"#CBD5E1"}}>{o.l}</div>
                <div style={{fontSize:9,color:C.gr,marginTop:2}}>{o.desc}</div>
              </button>)}
            </div>
          </F>
          {form.paymentType==="against_invoice"&&<F label="Invoice Reference"><Sel val={form.invRef||""} onChange={v=>{sf("invRef",v);const inv=(form.vtype==="out"?(data.purchases||[]):(data.sales||[])).find(x=>x.id===v);if(inv){sf("party",inv.client||inv.vendor||"");sf("amt",inv.paidAmt?Math.max(0,(form.vtype==="in"?cS(inv).net:cP(inv).tot)-(inv.paidAmt||0)):0);}}} opts={[{v:"",l:"Select Invoice"},...(form.vtype==="out"?(data.purchases||[]).map(p=>({v:p.id,l:p.vendor+" — "+(p.item||"")+" ("+p.date+")"})):(data.sales||[]).map(s=>({v:s.id,l:s.client+" — "+s.inv+" ("+s.date+")"})))]}/></F>}
          {form.paymentType==="advance_invoice"&&<div style={{...ss.card,padding:"8px 12px",marginBottom:8,background:G(C.or,0.06),border:"1px solid "+G(C.or,0.2)}}><span style={{color:C.or,fontSize:10}}>Advance against a future invoice — linked to party ledger. Can be adjusted when invoice is raised.</span></div>}
          {form.paymentType==="advance_ledger"&&<div style={{...ss.card,padding:"8px 12px",marginBottom:8,background:G(C.bl,0.06),border:"1px solid "+G(C.bl,0.2)}}><span style={{color:C.bl,fontSize:10}}>Open ledger advance — not linked to any invoice. Track via party ledger until adjusted.</span></div>}
          <GR cols="1fr 1fr"><F label="Party Name"><Inp val={form.party||""} onChange={v=>sf("party",v)} placeholder="Client / Vendor / Person"/></F><F label="Party Type"><Sel val={form.partyType||"client"} onChange={v=>sf("partyType",v)} opts={["client","vendor","employee","other"]}/></F></GR>
          <GR cols="1fr 1fr"><F label="Site"><Sel val={form.siteId||""} onChange={v=>sf("siteId",v)} opts={siteOpts}/></F><F label="Amount"><Num val={form.amt} onChange={v=>sf("amt",v)}/></F></GR>
          <F label="Payment Mode"><div style={{display:"flex",gap:6,marginBottom:8}}>{["bank","petty"].map(m=><button key={m} onClick={()=>sf("via",m)} style={{flex:1,padding:"8px",borderRadius:7,border:"1px solid "+(form.via===m?C.or:"#1E2D45"),background:form.via===m?G(C.or,0.15):"#060C1A",color:form.via===m?C.or:C.gr,cursor:"pointer",fontFamily:"monospace",fontSize:11,fontWeight:form.via===m?700:400}}>{m==="bank"?"🏦 Bank":"💵 Petty Cash"}</button>)}</div></F>
          {form.via==="bank"&&<F label="Bank Account"><Sel val={form.accountId||""} onChange={v=>sf("accountId",v)} opts={masters.banks.map(b=>({v:b.id,l:b.name}))}/></F>}
          {form.via==="petty"&&<F label="Petty Cash Book"><Sel val={form.accountId||""} onChange={v=>sf("accountId",v)} opts={masters.pettyCash.map(p=>({v:p.id,l:p.name}))}/></F>}
          <F label="Description"><Inp val={form.desc||""} onChange={v=>sf("desc",v)}/></F>
          <F label="Reference / Cheque No"><Inp val={form.ref||""} onChange={v=>sf("ref",v)} placeholder="Cheque / RTGS no"/></F>
          <Btn full onClick={()=>{
            if(form.via==="bank"&&form.accountId)upd("bankTxns",arr=>[...arr,{id:uid(),bankId:form.accountId,date:form.date,desc:form.desc,type:form.vtype==="in"?"Cr":"Dr",amt:form.amt||0,ref:form.ref||"",category:form.paymentType}]);
            else if(form.via==="petty"&&form.accountId)upd("pettyTxns",arr=>[...arr,{id:uid(),pettyId:form.accountId,date:form.date,desc:form.desc,type:form.vtype==="in"?"Cr":"Dr",amt:form.amt||0,by:user.name}]);
            saveTxn("vouchers");
          }}>Save Voucher</Btn>
        </div>}

        {/* CONTRA */}
        {mod==="contra"&&<div>
          <GR cols="1fr 1fr"><F label="Date"><Inp val={form.date||""} onChange={v=>sf("date",v)} type="date"/></F><F label="Amount"><Num val={form.amt} onChange={v=>sf("amt",v)}/></F></GR>
          <GR cols="1fr 1fr"><F label="From Type"><Sel val={form.fromType||"bank"} onChange={v=>{sf("fromType",v);sf("fromId",(v==="bank"?masters.banks[0]:masters.pettyCash[0]||{}).id||"");}} opts={[{v:"bank",l:"Bank Account"},{v:"petty",l:"Petty Cash"}]}/></F><F label="From Account"><Sel val={form.fromId||""} onChange={v=>sf("fromId",v)} opts={form.fromType==="petty"?masters.pettyCash.map(p=>({v:p.id,l:p.name})):masters.banks.map(b=>({v:b.id,l:b.name}))}/></F></GR>
          <GR cols="1fr 1fr"><F label="To Type"><Sel val={form.toType||"petty"} onChange={v=>{sf("toType",v);sf("toId",(v==="bank"?masters.banks[0]:masters.pettyCash[0]||{}).id||"");}} opts={[{v:"bank",l:"Bank Account"},{v:"petty",l:"Petty Cash"}]}/></F><F label="To Account"><Sel val={form.toId||""} onChange={v=>sf("toId",v)} opts={form.toType==="petty"?masters.pettyCash.map(p=>({v:p.id,l:p.name})):masters.banks.map(b=>({v:b.id,l:b.name}))}/></F></GR>
          <F label="Description"><Inp val={form.desc||""} onChange={v=>sf("desc",v)} placeholder="Cash withdrawal / Bank transfer"/></F>
          <Btn full onClick={()=>{const amt=Number(form.amt)||0;if(form.fromType==="bank"&&form.fromId)upd("bankTxns",arr=>[...arr,{id:uid(),bankId:form.fromId,date:form.date,desc:form.desc,type:"Dr",amt,ref:"CONTRA"}]);else if(form.fromType==="petty"&&form.fromId)upd("pettyTxns",arr=>[...arr,{id:uid(),pettyId:form.fromId,date:form.date,desc:form.desc,type:"Dr",amt,by:"Contra"}]);if(form.toType==="bank"&&form.toId)upd("bankTxns",arr=>[...arr,{id:uid(),bankId:form.toId,date:form.date,desc:form.desc,type:"Cr",amt,ref:"CONTRA"}]);else if(form.toType==="petty"&&form.toId)upd("pettyTxns",arr=>[...arr,{id:uid(),pettyId:form.toId,date:form.date,desc:form.desc,type:"Cr",amt,by:"Contra"}]);saveTxn("contraEntries");}}>Save Contra Entry</Btn>
        </div>}

        {/* LOAN */}
        {mod==="wc"&&<div>
          <GR cols="1fr 1fr"><F label="Site"><Sel val={form.siteId||""} onChange={v=>sf("siteId",v)} opts={siteOpts}/></F><F label="Policy No"><Inp val={form.policyNo||""} onChange={v=>sf("policyNo",v)} placeholder="WC/2025/001"/></F></GR>
          <GR cols="1fr 1fr"><F label="Insurance Company"><Inp val={form.insurer||""} onChange={v=>sf("insurer",v)} placeholder="New India Assurance"/></F><F label="Sum Assured"><Num val={form.sumAssured} onChange={v=>sf("sumAssured",v)}/></F></GR>
          <GR cols="1fr 1fr"><F label="Annual Premium"><Num val={form.premium} onChange={v=>sf("premium",v)}/></F><F label="Workers Covered"><Num val={form.workersCovered} onChange={v=>sf("workersCovered",v)}/></F></GR>
          <GR cols="1fr 1fr"><F label="Start Date"><Inp val={form.startDate||""} onChange={v=>sf("startDate",v)} type="date"/></F><F label="Expiry Date"><Inp val={form.expiryDate||""} onChange={v=>sf("expiryDate",v)} type="date"/></F></GR>
          <F label="Notes"><Inp val={form.notes||""} onChange={v=>sf("notes",v)} placeholder="Coverage details, agent contact..."/></F>
          <Btn full onClick={()=>saveTxn("wcPolicies")}>Save WC Policy</Btn>
        </div>}

        {mod==="loans"&&<div>
          <GR cols="1fr 1fr"><F label="Date"><Inp val={form.date||""} onChange={v=>sf("date",v)} type="date"/></F><F label="Loan Type"><Sel val={form.loanType||"borrowed"} onChange={v=>sf("loanType",v)} opts={[{v:"borrowed",l:"Borrowed from Director/Investor"},{v:"given",l:"Given to Employee"},{v:"advance",l:"Advance to Vendor"}]}/></F></GR>
          <GR cols="1fr 1fr"><F label="Party Name"><Inp val={form.party||""} onChange={v=>sf("party",v)}/></F><F label="Party Type"><Sel val={form.partyType||"Director"} onChange={v=>sf("partyType",v)} opts={["Director","Investor","Employee","Vendor","Other"]}/></F></GR>
          <GR cols="1fr 1fr"><F label="Principal Amount"><Num val={form.amt} onChange={v=>sf("amt",v)}/></F><F label="Interest % p.a."><Num val={form.interest||0} onChange={v=>sf("interest",v)}/></F></GR>
          <F label="Description"><Inp val={form.desc||""} onChange={v=>sf("desc",v)}/></F>
          <F label="Status"><Sel val={form.status||"Active"} onChange={v=>sf("status",v)} opts={["Active","Closed"]}/></F>
          <Btn full onClick={()=>{const loan={...form,txns:form.txns||[{date:form.date,type:form.loanType==="borrowed"?"received":"given",amt:Number(form.amt)||0,desc:"Initial amount"}]};saveRec("loans",loan);setModal(null);setForm({});}}>Save Loan</Btn>
        </div>}

        {/* STOCK TRANSFER */}
        {mod==="transfers"&&<div>
          <GR cols="1fr 1fr"><F label="Date"><Inp val={form.date||""} onChange={v=>sf("date",v)} type="date"/></F><F label="Item / Machinery"><Inp val={form.item||""} onChange={v=>sf("item",v)}/></F></GR>
          <GR cols="1fr 1fr 1fr"><F label="Qty"><Num val={form.qty} onChange={v=>sf("qty",v)}/></F><F label="Unit"><Inp val={form.unit||""} onChange={v=>sf("unit",v)}/></F><F label="Rate"><Num val={form.rate} onChange={v=>sf("rate",v)}/></F></GR>
          <GR cols="1fr 1fr"><F label="From Type"><Sel val={form.fromType||"godown"} onChange={v=>sf("fromType",v)} opts={[{v:"godown",l:"Godown"},{v:"site",l:"Site"}]}/></F><F label="From Location"><Sel val={form.fromId||""} onChange={v=>sf("fromId",v)} opts={form.fromType==="site"?masters.sites.map(s=>({v:s.id,l:s.name})):masters.godowns.map(g=>({v:g.id,l:g.name}))}/></F></GR>
          <GR cols="1fr 1fr"><F label="To Type"><Sel val={form.toType||"site"} onChange={v=>sf("toType",v)} opts={[{v:"site",l:"Site"},{v:"godown",l:"Godown"}]}/></F><F label="To Location"><Sel val={form.toId||""} onChange={v=>sf("toId",v)} opts={form.toType==="site"?masters.sites.map(s=>({v:s.id,l:s.name})):masters.godowns.map(g=>({v:g.id,l:g.name}))}/></F></GR>
          <F label="Description"><Inp val={form.desc||""} onChange={v=>sf("desc",v)}/></F>
          <Btn full onClick={()=>saveTxn("stockTransfers")}>Save Transfer</Btn>
        </div>}

        {/* MATERIAL RECEIPT */}
        {mod==="matreceipt"&&<div>
          <GR cols="1fr 1fr"><F label="Date"><Inp val={form.date||""} onChange={v=>sf("date",v)} type="date"/></F><F label="GRN No"><Inp val={form.grnNo||""} onChange={v=>sf("grnNo",v)} placeholder="GRN-003"/></F></GR>
          <F label="Vendor"><Sel val={form.vendor||""} onChange={v=>sf("vendor",v)} opts={[{v:"",l:"Select"},...masters.vendors.map(v=>v.name)]}/></F>
          <F label="Item"><Sel val={form.item||""} onChange={v=>{sf("item",v);const it=masters.items.find(i=>i.name===v);if(it){sf("unit",it.unit);sf("rate",it.rate);sf("gst",it.gst||18);}}} opts={[{v:"",l:"Select"},...masters.items.map(i=>i.name)]}/></F>
          <GR cols="1fr 1fr 1fr"><F label="Qty"><Num val={form.qty} onChange={v=>sf("qty",v)}/></F><F label="Unit"><Inp val={form.unit||""} onChange={v=>sf("unit",v)}/></F><F label="Rate"><Num val={form.rate} onChange={v=>sf("rate",v)}/></F></GR>
          <GR cols="1fr 1fr"><F label="Received At Type"><Sel val={form.locType||"site"} onChange={v=>sf("locType",v)} opts={[{v:"site",l:"Site"},{v:"godown",l:"Godown"}]}/></F><F label="Location"><Sel val={form.locId||""} onChange={v=>sf("locId",v)} opts={form.locType==="site"?masters.sites.map(s=>({v:s.id,l:s.name})):masters.godowns.map(g=>({v:g.id,l:g.name}))}/></F></GR>
          <GR cols="1fr 1fr"><F label="GST %"><Sel val={form.gst||18} onChange={v=>sf("gst",+v)} opts={gOpts}/></F><F label="Link to PO"><Sel val={form.poId||""} onChange={v=>sf("poId",v)} opts={[{v:"",l:"None"},...(data.purchaseOrders||[]).map(p=>({v:p.id,l:p.vendor+": "+p.desc}))]}/></F></GR>
          <F label="Remarks"><Inp val={form.remarks||""} onChange={v=>sf("remarks",v)} placeholder="Condition, shortfall, damage etc."/></F>
          <Btn full onClick={()=>saveTxn("materialReceipts")}>Save Material Receipt</Btn>
        </div>}

        {/* INVENTORY */}
        {mod==="inventory"&&<div>
          <GR cols="1fr 1fr"><F label="Loc Type"><Sel val={form.locType||"site"} onChange={v=>sf("locType",v)} opts={[{v:"site",l:"Site"},{v:"godown",l:"Godown"}]}/></F><F label="Location"><Sel val={form.locId||""} onChange={v=>sf("locId",v)} opts={form.locType==="site"?masters.sites.map(s=>({v:s.id,l:s.name})):masters.godowns.map(g=>({v:g.id,l:g.name}))}/></F></GR>
          <F label="Item"><Inp val={form.item||""} onChange={v=>sf("item",v)}/></F>
          <GR cols="1fr 1fr 1fr"><F label="Unit"><Inp val={form.unit||""} onChange={v=>sf("unit",v)}/></F><F label="Opening Stock"><Num val={form.open} onChange={v=>sf("open",v)}/></F><F label="Min Stock Alert"><Num val={form.min} onChange={v=>sf("min",v)}/></F></GR>
          <GR cols="1fr 1fr 1fr"><F label="Received"><Num val={form.recv} onChange={v=>sf("recv",v)}/></F><F label="Used / Issued"><Num val={form.used} onChange={v=>sf("used",v)}/></F><F label="Rate per Unit"><Num val={form.rate} onChange={v=>sf("rate",v)}/></F></GR>
          <F label="Photos (optional)"><div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>{(form.images||[]).map((img,i)=><div key={i} style={{position:"relative",width:68,height:68}}><img src={img} style={{width:68,height:68,objectFit:"cover",borderRadius:5,border:"1px solid "+C.br}}/><button onClick={()=>sf("images",(form.images||[]).filter((_,j)=>j!==i))} style={{position:"absolute",top:-4,right:-4,background:C.rd,border:"none",borderRadius:"50%",width:16,height:16,color:"white",cursor:"pointer",fontSize:10}}>x</button></div>)}<button onClick={()=>pickImage(url=>sf("images",[...(form.images||[]),url]))} style={{width:68,height:68,borderRadius:5,border:"2px dashed "+C.br,background:"transparent",color:C.gr,cursor:"pointer",fontSize:10,fontFamily:"monospace",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3}}><span style={{fontSize:18}}>📦</span>Add</button></div></F>
          <Btn full onClick={()=>{saveRec("inventory",{...form,close:(form.open||0)+(form.recv||0)-(form.used||0)});setModal(null);setForm({});}}>Save Inventory Entry</Btn>
        </div>}

        {/* OTHER INCOME */}
        {mod==="otherincome"&&<div>
          <GR cols="1fr 1fr"><F label="Date"><Inp val={form.date||""} onChange={v=>sf("date",v)} type="date"/></F><F label="Site / Location"><Sel val={form.siteId||""} onChange={v=>sf("siteId",v)} opts={[{v:"",l:"Select"},{v:"OFFICE",l:"🏢 Head Office"},{v:"GODOWN",l:"🏭 Godown"},...masters.sites.map(s=>({v:s.id,l:s.name}))]}/></F></GR>
          <GR cols="1fr 1fr"><F label="Category"><Sel val={form.cat||""} onChange={v=>sf("cat",v)} opts={[{v:"",l:"Select"},..."Scrap Sale,Inventory Sale,Labour Outsourced,Interest Income,Rental Income,Other".split(",")]}/></F><F label="Amount"><Num val={form.amt} onChange={v=>sf("amt",v)}/></F></GR>
          <F label="Description"><Inp val={form.desc||""} onChange={v=>sf("desc",v)} placeholder="Brief description of income source"/></F>
          <F label="Payment Via"><div style={{display:"flex",gap:6,marginBottom:8}}>{["bank","petty"].map(m=><button key={m} onClick={()=>sf("via",m)} style={{flex:1,padding:"8px",borderRadius:7,border:"1px solid "+(form.via===m?C.tl:"#1E2D45"),background:form.via===m?G(C.tl,0.15):"#060C1A",color:form.via===m?C.tl:C.gr,cursor:"pointer",fontFamily:"monospace",fontSize:11,fontWeight:form.via===m?700:400}}>{m==="bank"?"🏦 Bank":"💵 Cash"}</button>)}</div></F>
          {form.via==="bank"&&<F label="Bank Account"><Sel val={form.accountId||""} onChange={v=>sf("accountId",v)} opts={masters.banks.map(b=>({v:b.id,l:b.name}))}/></F>}
          {form.via==="petty"&&<F label="Petty Book"><Sel val={form.accountId||""} onChange={v=>sf("accountId",v)} opts={masters.pettyCash.map(p=>({v:p.id,l:p.name}))}/></F>}
          <F label="Reference"><Inp val={form.ref||""} onChange={v=>sf("ref",v)} placeholder="Invoice / weighment slip no."/></F>
          <Btn full onClick={()=>{const newItem={...form,id:uid()};upd("otherIncome",arr=>modal.oid?arr.map(x=>x.id===modal.oid?{...newItem,id:modal.oid}:x):[...arr,newItem]);if(form.via==="bank"&&form.accountId)upd("bankTxns",arr=>[...arr,{id:uid(),bankId:form.accountId,date:form.date,desc:(form.cat||"")+" — "+form.desc,type:"Cr",amt:form.amt||0,ref:form.ref||""}]);else if(form.via==="petty"&&form.accountId)upd("pettyTxns",arr=>[...arr,{id:uid(),pettyId:form.accountId,date:form.date,desc:(form.cat||"")+" — "+form.desc,type:"Cr",amt:form.amt||0,by:user.name}]);setModal(null);setForm({});}}>Save Other Income</Btn>
        </div>}

        {/* DPR (linked to Sale Order, progress tracking, client instructions) */}
        {mod==="dpr"&&<div>
          <GR cols="1fr 1fr"><F label="Date"><Inp val={form.date||""} onChange={v=>sf("date",v)} type="date"/></F><F label="Site"><Sel val={form.siteId||""} onChange={v=>sf("siteId",v)} opts={siteOpts}/></F></GR>
          <GR cols="1fr 1fr"><F label="Link Sale Order"><Sel val={form.soId||""} onChange={v=>{sf("soId",v);const so=(data.saleOrders||[]).find(s=>s.id===v);if(so){const entries=(so.lineItems||[]).map((li,idx)=>({type:"service",name:li.desc,soLineIdx:idx,completedQty:0,unit:li.unit,remarks:""}));sf("entries",entries);}}} opts={[{v:"",l:"No Sale Order"},...(data.saleOrders||[]).map(s=>({v:s.id,l:s.client+" — "+s.desc}))]}/></F><F label="Supervisor"><Sel val={form.supervisor||""} onChange={v=>sf("supervisor",v)} opts={[{v:"",l:"Select"},...masters.labours.filter(l=>l.role==="Supervisor").map(l=>l.name)]}/></F></GR>
          <GR cols="1fr 1fr"><F label="Weather"><Sel val={form.weather||"Clear"} onChange={v=>sf("weather",v)} opts={["Clear","Cloudy","Rain","Hot","Cold"]}/></F><F label="Workers on Site"><Num val={form.workers||0} onChange={v=>sf("workers",v)}/></F></GR>
          <F label="Client / Engineer Instructions"><Inp val={form.clientInstructions||""} onChange={v=>sf("clientInstructions",v)} placeholder="Instructions received from client / engineer / architect today..."/></F>
          <F label="Day Remarks"><Inp val={form.remarks||""} onChange={v=>sf("remarks",v)} placeholder="Overall progress summary..."/></F>
          <div style={{...ss.card,padding:12,marginBottom:10,background:"#060C1A"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{color:C.si,fontSize:10,textTransform:"uppercase",letterSpacing:.5}}>Work Progress Entries</span>
              <button style={{padding:"4px 12px",borderRadius:6,border:"1px solid "+C.br,background:"transparent",color:C.gr,cursor:"pointer",fontFamily:"monospace",fontSize:10,fontWeight:700}} onClick={()=>sf("entries",[...(form.entries||[]),{type:"service",name:"",soLineIdx:null,completedQty:0,unit:"",remarks:""}])}>+ Add Row</button>
            </div>
            {(form.entries||[]).map((e,i)=>{const so=form.soId?(data.saleOrders||[]).find(s=>s.id===form.soId):null;return <div key={i} style={{display:"grid",gridTemplateColumns:"70px 2fr 1fr 1fr 1fr auto",gap:5,marginBottom:5,alignItems:"center"}}>
              <select style={{...ss.inp,marginBottom:0,fontSize:10}} value={e.type} onChange={ev=>{const ne=[...(form.entries||[])];ne[i]={...ne[i],type:ev.target.value};sf("entries",ne);}}><option value="service">Service</option><option value="item">Item</option></select>
              {so&&e.type==="service"?<select style={{...ss.inp,marginBottom:0}} value={e.soLineIdx!=null?e.soLineIdx:""} onChange={ev=>{const ne=[...(form.entries||[])];const idx=ev.target.value!==""?+ev.target.value:null;ne[i]={...ne[i],soLineIdx:idx,name:idx!=null?(so.lineItems[idx]||{}).desc||"":ne[i].name,unit:idx!=null?(so.lineItems[idx]||{}).unit||"":ne[i].unit};sf("entries",ne);}}><option value="">Custom Item</option>{(so.lineItems||[]).map((l,j)=><option key={j} value={j}>{l.desc}</option>)}</select>:<input style={{...ss.inp,marginBottom:0}} value={e.name} onChange={ev=>{const ne=[...(form.entries||[])];ne[i]={...ne[i],name:ev.target.value};sf("entries",ne);}} placeholder="Name"/>}
              <input type="number" style={{...ss.inp,marginBottom:0}} value={e.completedQty||0} onChange={ev=>{const ne=[...(form.entries||[])];ne[i]={...ne[i],completedQty:+ev.target.value};sf("entries",ne);}} placeholder="Qty Done"/>
              <input style={{...ss.inp,marginBottom:0}} value={e.unit||""} onChange={ev=>{const ne=[...(form.entries||[])];ne[i]={...ne[i],unit:ev.target.value};sf("entries",ne);}} placeholder="Unit"/>
              <input style={{...ss.inp,marginBottom:0}} value={e.remarks||""} onChange={ev=>{const ne=[...(form.entries||[])];ne[i]={...ne[i],remarks:ev.target.value};sf("entries",ne);}} placeholder="Remarks"/>
              <button onClick={()=>sf("entries",(form.entries||[]).filter((_,j)=>j!==i))} style={{background:"rgba(248,113,113,.1)",border:"1px solid rgba(248,113,113,.2)",color:C.rd,cursor:"pointer",fontSize:12,padding:"4px 7px",borderRadius:5}}>x</button>
            </div>;})}
          </div>
          {/* Image attachments for DPR */}
          <F label="Site Photos (optional — click to add)">
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
              {(form.images||[]).map((img,i)=><div key={i} style={{position:"relative",width:72,height:72}}>
                <img src={img} style={{width:72,height:72,objectFit:"cover",borderRadius:6,border:"1px solid "+C.br}}/>
                <button onClick={()=>sf("images",(form.images||[]).filter((_,j)=>j!==i))} style={{position:"absolute",top:-4,right:-4,background:C.rd,border:"none",borderRadius:"50%",width:18,height:18,color:"white",cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>x</button>
              </div>)}
              <button onClick={()=>pickImage(url=>sf("images",[...(form.images||[]),url]))} style={{width:72,height:72,borderRadius:6,border:"2px dashed "+C.br,background:"transparent",color:C.gr,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,fontSize:10,fontFamily:"monospace"}}>
                <span style={{fontSize:22}}>📷</span>Add
              </button>
            </div>
          </F>
          <div style={{...ss.card,padding:12,marginBottom:10,background:"#060C1A"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{color:C.si,fontSize:10,textTransform:"uppercase",letterSpacing:.5}}>Consumed Items (Inventory Deduction)</span>
              <button style={{padding:"3px 10px",borderRadius:5,border:"1px solid "+C.br,background:"transparent",color:C.gr,cursor:"pointer",fontFamily:"monospace",fontSize:10}} onClick={()=>sf("consumedItems",[...(form.consumedItems||[]),{item:"",qty:0,unit:"",locType:"site",locId:form.siteId||""}])}>+ Add</button>
            </div>
            {(form.consumedItems||[]).map((ci,ii)=><div key={ii} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr auto",gap:4,marginBottom:4,alignItems:"center"}}>
              <input style={{...ss.inp,marginBottom:0}} value={ci.item||""} onChange={ev=>{const ne=[...(form.consumedItems||[])];ne[ii]={...ne[ii],item:ev.target.value};sf("consumedItems",ne);}} placeholder="Item name"/>
              <input type="number" style={{...ss.inp,marginBottom:0}} value={ci.qty||""} onChange={ev=>{const ne=[...(form.consumedItems||[])];ne[ii]={...ne[ii],qty:+ev.target.value};sf("consumedItems",ne);}} placeholder="Qty"/>
              <input style={{...ss.inp,marginBottom:0}} value={ci.unit||""} onChange={ev=>{const ne=[...(form.consumedItems||[])];ne[ii]={...ne[ii],unit:ev.target.value};sf("consumedItems",ne);}} placeholder="Unit"/>
              <select style={{...ss.inp,marginBottom:0}} value={ci.locType||"site"} onChange={ev=>{const ne=[...(form.consumedItems||[])];ne[ii]={...ne[ii],locType:ev.target.value};sf("consumedItems",ne);}}><option value="site">Site</option><option value="godown">Godown</option></select>
              <button onClick={()=>sf("consumedItems",(form.consumedItems||[]).filter((_,jj)=>jj!==ii))} style={{background:"rgba(248,113,113,.1)",border:"1px solid rgba(248,113,113,.2)",color:C.rd,cursor:"pointer",fontSize:12,padding:"4px 7px",borderRadius:5}}>x</button>
            </div>)}
          </div>
          <Btn full onClick={()=>{(form.consumedItems||[]).forEach(ci=>{if(!ci.item||!ci.qty)return;upd("inventory",arr=>arr.map(inv=>inv.item===ci.item&&inv.locType===ci.locType?{...inv,used:(inv.used||0)+ci.qty,close:Math.max(0,(inv.close||0)-ci.qty)}:inv));});saveTxn("dpr");}}>Save DPR</Btn>
        </div>}

      </Modal>;
    })()}

    {/* ═══════════ MASTER MODALS ═══════════ */}
    {modal&&modal.t==="master"&&<Modal title={(modal.oidx!=null?"EDIT — ":"ADD — ")+modal.key.toUpperCase()} onClose={()=>setModal(null)}>
      {modal.key==="sites"&&<div><F label="Name"><Inp val={form.name||""} onChange={v=>sf("name",v)}/></F><F label="Client"><Inp val={form.client||""} onChange={v=>sf("client",v)}/></F><F label="Location"><Inp val={form.loc||""} onChange={v=>sf("loc",v)}/></F><F label="Status"><Sel val={form.status||"Active"} onChange={v=>sf("status",v)} opts={["Active","Completed","On Hold"]}/></F><Btn full onClick={()=>{saveM("sites",form);setModal(null);}}>Save</Btn></div>}
      {modal.key==="clients"&&<div><F label="Name"><Inp val={form.name||""} onChange={v=>sf("name",v)}/></F><F label="Contact Person"><Inp val={form.contact||""} onChange={v=>sf("contact",v)}/></F><F label="Phone"><Inp val={form.phone||""} onChange={v=>sf("phone",v)}/></F><F label="GST Number"><Inp val={form.gst||""} onChange={v=>sf("gst",v)}/></F><F label="Bill To Address"><Inp val={form.billTo||""} onChange={v=>sf("billTo",v)} placeholder="Registered / billing address"/></F><F label="Ship To Address"><Inp val={form.shipTo||""} onChange={v=>sf("shipTo",v)} placeholder="Site / delivery address"/></F><Btn full onClick={()=>{saveM("clients",form);setModal(null);}}>Save</Btn></div>}
      {modal.key==="vendors"&&<div>
        <GR cols="1fr 1fr"><F label="Name"><Inp val={form.name||""} onChange={v=>sf("name",v)}/></F><F label="Category"><Sel val={form.cat||""} onChange={v=>sf("cat",v)} opts={["Select","Sub-Contractor","Equipment Vendor","Material Supplier","Service Provider","Consultant","Other"]}/></F></GR>
        <GR cols="1fr 1fr"><F label="Sub-Category (Products/Services)"><Inp val={form.subCat||""} onChange={v=>sf("subCat",v)}/></F><F label="Payment Terms"><Sel val={form.terms||""} onChange={v=>sf("terms",v)} opts={["Select","Advance","Credit 15 Days","Credit 30 Days","Credit 45 Days","Credit 60 Days","Credit 90 Days"]}/></F></GR>
        <GR cols="1fr 1fr"><F label="Contact Person"><Inp val={form.contact||""} onChange={v=>sf("contact",v)}/></F><F label="Phone"><Inp val={form.phone||""} onChange={v=>sf("phone",v)}/></F></GR>
        <GR cols="1fr 1fr"><F label="Email"><Inp val={form.email||""} onChange={v=>sf("email",v)}/></F><F label="Address"><Inp val={form.address||""} onChange={v=>sf("address",v)}/></F></GR>
        <GR cols="1fr 1fr 1fr"><F label="GST Number"><Inp val={form.gst||""} onChange={v=>sf("gst",v)}/></F><F label="TDS Applicable"><Sel val={form.tdsApp?"yes":"no"} onChange={v=>sf("tdsApp",v==="yes")} opts={[{v:"no",l:"No"},{v:"yes",l:"Yes"}]}/></F><F label="TCS Applicable"><Sel val={form.tcsApp?"yes":"no"} onChange={v=>sf("tcsApp",v==="yes")} opts={[{v:"no",l:"No"},{v:"yes",l:"Yes"}]}/></F></GR>
        <div style={{color:C.or,fontSize:10,marginTop:6,marginBottom:6,fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>Banking Details</div>
        <GR cols="1fr 1fr"><F label="Bank Name"><Inp val={form.bankName||""} onChange={v=>sf("bankName",v)}/></F><F label="Account No"><Inp val={form.bankAccount||""} onChange={v=>sf("bankAccount",v)}/></F></GR>
        <F label="IFSC Code"><Inp val={form.ifsc||""} onChange={v=>sf("ifsc",v)}/></F>
        <Btn full onClick={()=>{saveM("vendors",form);setModal(null);}}>Save Vendor</Btn>
      </div>}
      {modal.key==="items"&&<div><F label="Item Name"><Inp val={form.name||""} onChange={v=>sf("name",v)}/></F><F label="Unit"><Inp val={form.unit||""} onChange={v=>sf("unit",v)}/></F><F label="Category"><Inp val={form.cat||""} onChange={v=>sf("cat",v)}/></F><F label="HSN Code"><Inp val={form.hsn||""} onChange={v=>sf("hsn",v)} placeholder="8-digit HSN code"/></F><F label="Standard Rate"><Num val={form.rate} onChange={v=>sf("rate",v)}/></F><Btn full onClick={()=>{saveM("items",form);setModal(null);}}>Save</Btn></div>}
      {modal.key==="services"&&<div><F label="Service Name"><Inp val={form.name||""} onChange={v=>sf("name",v)}/></F><F label="Unit"><Inp val={form.unit||""} onChange={v=>sf("unit",v)}/></F><F label="Category"><Inp val={form.cat||""} onChange={v=>sf("cat",v)}/></F><F label="SAC Code"><Inp val={form.sac||""} onChange={v=>sf("sac",v)} placeholder="6-digit SAC code"/></F><F label="Standard Rate"><Num val={form.rate} onChange={v=>sf("rate",v)}/></F><F label="GST %"><Sel val={form.gst||18} onChange={v=>sf("gst",+v)} opts={gOpts}/></F><Btn full onClick={()=>{saveM("services",form);setModal(null);}}>Save</Btn></div>}
      {modal.key==="labours"&&<div>
        <GR cols="auto 1fr"><div>
          {form.photo?<div style={{position:"relative"}}><img src={form.photo} style={{width:80,height:80,objectFit:"cover",borderRadius:8,border:"2px solid "+C.or}}/><button onClick={()=>sf("photo","")} style={{position:"absolute",top:-4,right:-4,background:C.rd,border:"none",borderRadius:"50%",width:18,height:18,color:"white",cursor:"pointer",fontSize:11}}>x</button></div>:<button onClick={()=>pickImage(url=>sf("photo",url))} style={{width:80,height:80,borderRadius:8,border:"2px dashed "+C.br,background:"transparent",color:C.gr,cursor:"pointer",fontSize:10,fontFamily:"monospace",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4}}><span style={{fontSize:22}}>👤</span>Photo</button>}
        </div><div>
          <F label="Name"><Inp val={form.name||""} onChange={v=>sf("name",v)}/></F>
          <F label="Role"><Sel val={form.role||""} onChange={v=>sf("role",v)} opts={["Select","Labour","Site Helper","Mason","Carpenter","Fitter","Welder","Painter","Driver","Operator","Security","Site Supervisor","Site Accountant","Site Manager","Office Boy","Office Helper","Office Accountant","Clerk","Executive","Manager","Admin","Owner"]}/></F>
        </div></GR>
        <GR cols="1fr 1fr"><F label="DOB"><Inp type="date" val={form.dob||""} onChange={v=>sf("dob",v)}/></F><F label="Email ID"><Inp val={form.email||""} onChange={v=>sf("email",v)}/></F></GR>
        <GR cols="1fr 1fr"><F label="Site"><Sel val={form.siteId||""} onChange={v=>sf("siteId",v)} opts={siteOpts}/></F><F label="Phone"><Inp val={form.phone||""} onChange={v=>sf("phone",v)}/></F></GR>
        <F label="Address"><Inp val={form.address||""} onChange={v=>sf("address",v)}/></F>
        <GR cols="1fr 1fr"><F label="Daily Wage"><Num val={form.wage} onChange={v=>sf("wage",v)}/></F><F label="PF Applicable"><Sel val={form.pf?"yes":"no"} onChange={v=>sf("pf",v==="yes")} opts={[{v:"yes",l:"Yes"},{v:"no",l:"No"}]}/></F></GR>
        <GR cols="1fr 1fr"><F label="UAN No."><Inp val={form.uan||""} onChange={v=>sf("uan",v)}/></F><F label="Bank Name"><Inp val={form.bankName||""} onChange={v=>sf("bankName",v)}/></F></GR>
        <GR cols="1fr 1fr"><F label="Bank Account No."><Inp val={form.bankAccount||""} onChange={v=>sf("bankAccount",v)}/></F><F label="IFSC Code"><Inp val={form.ifsc||""} onChange={v=>sf("ifsc",v)}/></F></GR>
        <F label="Aadhar / PAN No"><Inp val={form.kyc||""} onChange={v=>sf("kyc",v)} placeholder="XXXX-XXXX-XXXX / ABCDE1234F"/></F>
        <F label="KYC Documents (Aadhar / PAN photos)">
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
            {(form.kycDocs||[]).map((img,i)=><div key={i} style={{position:"relative",width:80,height:60}}>
              <img src={img} style={{width:80,height:60,objectFit:"cover",borderRadius:5,border:"1px solid "+C.br}}/>
              <button onClick={()=>sf("kycDocs",(form.kycDocs||[]).filter((_,j)=>j!==i))} style={{position:"absolute",top:-4,right:-4,background:C.rd,border:"none",borderRadius:"50%",width:16,height:16,color:"white",cursor:"pointer",fontSize:10}}>x</button>
            </div>)}
            {(form.kycDocs||[]).length<3&&<button onClick={()=>pickImage(url=>sf("kycDocs",[...(form.kycDocs||[]),url]))} style={{width:80,height:60,borderRadius:5,border:"2px dashed "+C.br,background:"transparent",color:C.gr,cursor:"pointer",fontSize:10,fontFamily:"monospace",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}><span style={{fontSize:18}}>🪪</span>Add Doc</button>}
          </div>
        </F>
        <Btn full onClick={()=>{
          if(!form.dob) { alert("Please provide DOB."); return; }
          const dobD=new Date(form.dob); const today=new Date(); let age=today.getFullYear()-dobD.getFullYear();
          const m=today.getMonth()-dobD.getMonth(); if(m<0||(m===0&&today.getDate()<dobD.getDate())) age--;
          if(age<18) { alert("Age must be at least 18 years to be added."); return; }
          saveM("labours",form);setModal(null);
        }}>Save HR Person</Btn>
      </div>}
      {modal.key==="machinery"&&<div><F label="Machine Name"><Inp val={form.name||""} onChange={v=>sf("name",v)}/></F><F label="Type"><Inp val={form.type||""} onChange={v=>sf("type",v)}/></F><F label="Ownership"><Sel val={form.owner||"Owned"} onChange={v=>sf("owner",v)} opts={["Owned","Hired","Leased"]}/></F><F label="HSN Code"><Inp val={form.hsn||""} onChange={v=>sf("hsn",v)} placeholder="Machinery HSN"/></F><F label="Reg No"><Inp val={form.reg||""} onChange={v=>sf("reg",v)}/></F><F label="Rate per Day"><Num val={form.rate} onChange={v=>sf("rate",v)}/></F><GR cols="1fr 1fr"><F label="Location Type"><Sel val={form.locType||"site"} onChange={v=>sf("locType",v)} opts={[{v:"site",l:"Site"},{v:"godown",l:"Godown"}]}/></F><F label="Location"><Sel val={form.locId||""} onChange={v=>sf("locId",v)} opts={form.locType==="site"?masters.sites.map(s=>({v:s.id,l:s.name})):masters.godowns.map(g=>({v:g.id,l:g.name}))}/></F></GR><F label="Status"><Sel val={form.status||"Active"} onChange={v=>sf("status",v)} opts={["Active","Maintenance","Retired"]}/></F><Btn full onClick={()=>{saveM("machinery",form);setModal(null);}}>Save</Btn></div>}
      {modal.key==="banks"&&<div><F label="Bank Name"><Inp val={form.name||""} onChange={v=>sf("name",v)}/></F><F label="Account No"><Inp val={form.accNo||""} onChange={v=>sf("accNo",v)}/></F><GR cols="1fr 1fr"><F label="IFSC"><Inp val={form.ifsc||""} onChange={v=>sf("ifsc",v)}/></F><F label="Branch"><Inp val={form.branch||""} onChange={v=>sf("branch",v)}/></F></GR><F label="Opening Balance"><Num val={form.openBal} onChange={v=>sf("openBal",v)}/></F><Btn full onClick={()=>{saveM("banks",form);setModal(null);}}>Save Bank</Btn></div>}
      {modal.key==="pettyCash"&&<div><F label="Name"><Inp val={form.name||""} onChange={v=>sf("name",v)}/></F><F label="Keeper Name"><Inp val={form.keeper||""} onChange={v=>sf("keeper",v)}/></F><F label="Opening Balance"><Num val={form.openBal} onChange={v=>sf("openBal",v)}/></F><Btn full onClick={()=>{saveM("pettyCash",form);setModal(null);}}>Save</Btn></div>}
      {modal.key==="godowns"&&<div><F label="Godown Name"><Inp val={form.name||""} onChange={v=>sf("name",v)}/></F><F label="Location / Address"><Inp val={form.loc||""} onChange={v=>sf("loc",v)}/></F><F label="Keeper / Incharge"><Inp val={form.keeper||""} onChange={v=>sf("keeper",v)}/></F><Btn full onClick={()=>{saveM("godowns",form);setModal(null);}}>Save</Btn></div>}
      {modal.key==="users"&&<div>
        <F label="Full Name"><Sel val={form.name||""} onChange={v=>sf("name",v)} opts={[{v:"",l:"Select from HR"},...masters.labours.map(l=>l.name)]}/></F>
        <F label="Username"><Inp val={form.username||""} onChange={v=>sf("username",v)}/></F>
        <F label="Password"><input type="password" style={ss.inp} value={form.password||""} onChange={e=>sf("password",e.target.value)}/></F>
        <F label="Role"><Sel val={form.role||"Viewer"} onChange={v=>sf("role",v)} opts={["Admin","Manager","Accountant","Supervisor","Viewer"]}/></F>
        <F label="Module Access">
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:8}}>
            {MOD_GROUPS.map(m=>{
              const accObj=form.moduleAccessObj||{};
              const myPerms = accObj[m.id]||[];
              const on=myPerms.length>0;
              const subOpts = ["View","Create","Edit","Delete","Approve","Reject","Download","Upload"];
              return <div key={m.id} style={{padding:"8px",borderRadius:8,border:"1px solid "+(on?m.color:"#1E2D45"),background:on?G(m.color,0.05):"transparent"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                  <div style={{color:on?m.color:C.gr,fontWeight:700,fontSize:11}}>{m.icon} {m.l}</div>
                  <button onClick={()=>{
                    const nobj = {...accObj};
                    if(on) delete nobj[m.id];
                    else nobj[m.id] = ["View"];
                    sf("moduleAccessObj", nobj);
                    sf("moduleAccess", Object.keys(nobj));
                  }} style={{background:"transparent",color:on?C.rd:C.gn,border:"1px solid "+(on?C.rd:C.gn),borderRadius:4,fontSize:9,padding:"2px 6px",cursor:"pointer"}}>{on?"Remove":"Add"}</button>
                </div>
                {on && <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}}>
                  {subOpts.map(so=>{
                    const has = myPerms.includes(so);
                    return <button key={so} onClick={()=>{
                      const nobj = {...accObj};
                      if(has) nobj[m.id] = myPerms.filter(x=>x!==so);
                      else nobj[m.id] = [...myPerms, so];
                      if(nobj[m.id].length===0) delete nobj[m.id];
                      sf("moduleAccessObj", nobj);
                      sf("moduleAccess", Object.keys(nobj));
                    }} style={{padding:"2px 8px",borderRadius:12,border:"1px solid "+(has?m.color:"#1E2D45"),background:has?G(m.color,0.15):"transparent",color:has?m.color:C.gr,cursor:"pointer",fontSize:9}}>{so}</button>;
                  })}
                </div>}
              </div>;
            })}
          </div>
        </F>
        <Btn full onClick={()=>{saveM("users",form);setModal(null);}}>Save User</Btn>
      </div>}
      {modal.key==="company"&&<div><F label="Company Name"><Inp val={form.name||""} onChange={v=>sf("name",v)}/></F><F label="Address"><Inp val={form.addr||""} onChange={v=>sf("addr",v)}/></F><F label="GST Number"><Inp val={form.gst||""} onChange={v=>sf("gst",v)}/></F><F label="Phone"><Inp val={form.phone||""} onChange={v=>sf("phone",v)}/></F><F label="Email"><Inp val={form.email||""} onChange={v=>sf("email",v)}/></F><F label="Bank Name"><Inp val={form.bank||""} onChange={v=>sf("bank",v)}/></F><F label="Account No"><Inp val={form.acc||""} onChange={v=>sf("acc",v)}/></F><GR cols="1fr 1fr"><F label="IFSC"><Inp val={form.ifsc||""} onChange={v=>sf("ifsc",v)}/></F><F label="Branch"><Inp val={form.branch||""} onChange={v=>sf("branch",v)}/></F></GR><F label="Authorised Signatory"><Inp val={form.sign||""} onChange={v=>sf("sign",v)}/></F><F label="Company Logo">
          <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:8}}>
            {(form.logoUrl)?<div style={{position:"relative"}}><img src={form.logoUrl} style={{height:60,maxWidth:200,objectFit:"contain",borderRadius:6,border:"1px solid "+C.br,background:"white",padding:4}}/><button onClick={()=>sf("logoUrl","")} style={{position:"absolute",top:-4,right:-4,background:C.rd,border:"none",borderRadius:"50%",width:18,height:18,color:"white",cursor:"pointer",fontSize:11}}>x</button></div>:<div style={{width:100,height:60,borderRadius:6,border:"2px dashed "+C.br,background:"#060C1A",display:"flex",alignItems:"center",justifyContent:"center",color:C.gr,fontSize:9}}>No Logo</div>}
            <div><button onClick={()=>pickImage(url=>sf("logoUrl",url))} style={{padding:"6px 14px",borderRadius:6,border:"1px solid "+C.or,background:G(C.or,0.1),color:C.or,cursor:"pointer",fontFamily:"monospace",fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>📷 Upload Logo</button><Inp val={form.logoUrl||""} onChange={v=>sf("logoUrl",v)} placeholder="Or paste image URL..."/></div>
          </div>
        </F><Btn full onClick={()=>{setMasters(p=>({...p,company:{...form}}));setModal(null);}}>Save Company Info</Btn></div>}
    </Modal>}

    {/* ══ SO PROGRESS MODAL ══ */}
    {modal&&modal.t==="soProgress"&&(()=>{
      const so=modal.so;
      const allInvs=(data.sales||[]).filter(s=>s.soId===so.id);
      const allDprs=(data.dpr||[]).filter(d=>d.soId===so.id);
      const rows=(so.lineItems||[]).map((line,idx)=>{const completedQty=allDprs.reduce((a,d)=>{const e=(d.entries||[]).find(en=>en.soLineIdx===idx);return a+(e?Number(e.completedQty||0):0);},0);const invoicedQty=allInvs.reduce((a,inv)=>{const il=(inv.lineItems||[])[idx];return a+(il?Number(il.qty||0):0);},0);const pct=line.qty>0?Math.min(100,Math.round(completedQty/line.qty*100)):0;return{...line,completedQty,invoicedQty,balanceQty:Math.max(0,line.qty-invoicedQty),pct};});
      return <Modal title={"📊 Sale Order Progress — "+so.id} onClose={()=>setModal(null)} xwide>
        <div style={{padding:"10px 14px",background:G(C.tl,0.06),borderRadius:8,border:"1px solid "+G(C.tl,0.2),marginBottom:14}}>
          <div style={{color:"#E2E8F0",fontWeight:700}}>{so.client} — {so.desc}</div>
          <div style={{color:C.gr,fontSize:11,marginTop:3}}>Date: {so.date} | Status: <span style={{color:so.status==="Active"?C.gn:C.rd}}>{so.status}</span></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
          <KCard icon="📑" label="Order Value" value={INR(calcLI(so.lineItems||[]).total)} color={C.or}/>
          <KCard icon="🧾" label="Invoiced" value={INR(allInvs.reduce((a,s)=>a+cS(s).basic,0))} color={C.gn}/>
          <KCard icon="📋" label="DPR Sessions" value={allDprs.length} color={C.bl}/>
          <KCard icon="⚖" label="Balance" value={INR(calcLI(so.lineItems||[]).total-allInvs.reduce((a,s)=>a+cS(s).basic,0))} color={C.rd}/>
        </div>
        <div style={{...ss.card,overflowX:"auto",marginBottom:12}}>
          <table style={{borderCollapse:"collapse",width:"100%"}}>
            <thead><tr style={{background:"#060C1A"}}>{["Description","HSN","SO Qty","Completed (DPR)","Invoiced","Balance","Progress"].map(h=><th key={h} style={ss.th}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r,i)=><tr key={i} onMouseEnter={e=>e.currentTarget.style.background="#0A1223"} onMouseLeave={e=>e.currentTarget.style.background=""}>
              <td style={ss.td}><b>{r.desc}</b></td>
              <td style={{...ss.td,color:C.gr,fontSize:10}}>{r.hsn||"—"}</td>
              <td style={ss.td}><b style={{color:C.or}}>{r.qty} {r.unit}</b></td>
              <td style={ss.td}><b style={{color:C.gn}}>{r.completedQty} {r.unit}</b></td>
              <td style={ss.td}><span style={{color:C.bl}}>{r.invoicedQty} {r.unit}</span></td>
              <td style={ss.td}><b style={{color:r.balanceQty>0?C.rd:C.gn}}>{r.balanceQty} {r.unit}</b></td>
              <td style={ss.td}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{flex:1,height:5,background:"#1E2D45",borderRadius:3}}><div style={{height:"100%",width:r.pct+"%",background:"linear-gradient(90deg,"+C.tl+","+G(C.tl,0.5)+")",borderRadius:3}}/></div><span style={{color:C.tl,fontWeight:700,fontFamily:"monospace",fontSize:10,minWidth:30}}>{r.pct}%</span></div></td>
            </tr>)}</tbody>
          </table>
        </div>
        {allDprs.length>0&&<div style={{...ss.card,padding:14}}><div style={{color:C.or,fontWeight:700,fontSize:11,marginBottom:8}}>📅 DPR History</div>{allDprs.slice().reverse().map((d,i)=><div key={i} style={{padding:"5px 0",borderBottom:"1px solid #0A1223",display:"flex",justifyContent:"space-between",fontSize:10}}><span style={{color:"#CBD5E1"}}>{d.date} — {d.supervisor}</span><span style={{color:C.gr}}>{d.workers} workers</span><span style={{color:C.tl}}>{(d.entries||[]).length} entries</span></div>)}</div>}
      </Modal>;
    })()}

    {del&&<Confirm label={del.label||"this record"} onOk={doDelete} onNo={()=>setDel(null)}/>}
  </div>;
}
