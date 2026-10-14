import { useState, useMemo, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts";

/* ═══════════ DESIGN TOKENS ═══════════ */
const DEF_SETTINGS={theme:"dark",accent:"#F59E0B",font:"sans",fontSize:13,logoUrl:"",strictApproval:false};
const getSettings=()=>{try{return {...DEF_SETTINGS,...JSON.parse(localStorage.getItem("sl_settings")||"{}")};}catch{return DEF_SETTINGS;}};
const saveSettings=s=>{try{localStorage.setItem("sl_settings",JSON.stringify(s));}catch(e){console.error(e);}};

const mkColors=(accent,theme="dark")=>{
  const isLight=theme==="light";
  return {
    or:accent||(isLight?"#D97706":"#F59E0B"),
    tl:isLight?"#0D9488":"#14B8A6",
    rd:isLight?"#DC2626":"#EF4444",
    pu:isLight?"#7C3AED":"#8B5CF6",
    gn:isLight?"#059669":"#10B981",
    dk:isLight?"#F8FAFC":"#0B0F19",
    cd:isLight?"#FFFFFF":"#111827",
    br:isLight?"#E2E8F0":"#1F2937",
    gr:isLight?"#64748B":"#6B7280",
    bl:isLight?"#0284C7":"#0EA5E9",
    si:isLight?"#475569":"#9CA3AF",
    bg1:isLight?"#F8FAFC":"#0B0F19",
    bg2:isLight?"#F1F5F9":"#111827",
    bg3:isLight?"#FFFFFF":"#1F2937",
    text:isLight?"#0F172A":"#F9FAFB",
    textSub:isLight?"#475569":"#9CA3AF",
    isLight,
  };
};
let C=mkColors(DEF_SETTINGS.accent,DEF_SETTINGS.theme);
const PC=[C.or,C.tl,C.rd,C.pu,C.gn,C.bl,"#FB923C","#E879F9"];
const BD="1px solid "+C.br;
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
/* Next doc number: PREFIX/001/25-26 format */
const nextDocNo=(prefix,arr,field)=>{
  const fy=getFYStr();
  const pattern=new RegExp(`^${prefix}\\/(\\d+)\\/`+fy+"$","i");
  const nums=(arr||[]).map(x=>{
    const v=x[field]||"";
    const m=v.match(pattern);
    return m?parseInt(m[1],10):0;
  });
  const nextN=(nums.length?Math.max(...nums,0):0)+1;
  return `${prefix}/${String(nextN).padStart(3,"0")}/${fy}`;
};
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
  uom:[
    {id:"uom1",name:"Cum",param:"Volume",factor:1,baseUnit:"Cum"},
    {id:"uom2",name:"Sqm",param:"Area",factor:1,baseUnit:"Sqm"},
    {id:"uom3",name:"Sqft",param:"Area",factor:0.092903,baseUnit:"Sqm"},
    {id:"uom4",name:"MT",param:"Weight",factor:1000,baseUnit:"Kg"},
    {id:"uom5",name:"Kg",param:"Weight",factor:1,baseUnit:"Kg"},
    {id:"uom6",name:"Bags",param:"Numbers",factor:50,baseUnit:"Kg"},
    {id:"uom7",name:"CFT",param:"Volume",factor:0.0283168,baseUnit:"Cum"},
    {id:"uom8",name:"Rmt",param:"Length",factor:1,baseUnit:"Rmt"},
    {id:"uom9",name:"Nos",param:"Numbers",factor:1,baseUnit:"Nos"},
    {id:"uom10",name:"ManDays",param:"ManDays",factor:1,baseUnit:"ManDays"},
    {id:"uom11",name:"Hours",param:"Time",factor:1,baseUnit:"Hours"},
    {id:"uom12",name:"Lump",param:"Numbers",factor:1,baseUnit:"Lump"},
  ],
  inputRates:[
    {id:"ir1",type:"material",name:"TMT Fe500 12mm",uom:"MT",rate:56000,gst:18,vendorRateMemory:[{vendor:"Steel India Ltd",rate:56000,date:"2025-01-10"}]},
    {id:"ir2",type:"material",name:"OPC 53 Cement",uom:"Bags",rate:360,gst:28,vendorRateMemory:[{vendor:"ACC Cement",rate:360,date:"2025-01-08"}]},
    {id:"ir3",type:"material",name:"20mm Aggregate",uom:"CFT",rate:70,gst:5,vendorRateMemory:[{vendor:"Local Quarry",rate:70,date:"2025-01-05"}]},
    {id:"ir4",type:"material",name:"River Sand",uom:"CFT",rate:52,gst:5,vendorRateMemory:[{vendor:"M-Sand Suppliers",rate:52,date:"2025-01-05"}]},
    {id:"ir5",type:"material",name:"Binding Wire 18G",uom:"Kg",rate:85,gst:18,vendorRateMemory:[{vendor:"Hardware Mart",rate:85,date:"2025-01-10"}]},
    {id:"ir6",type:"service",name:"Earthwork Excavation",uom:"Cum",rate:180,gst:18,vendorRateMemory:[{vendor:"Earthmovers Co",rate:180,date:"2025-01-02"}]},
    {id:"ir7",type:"machinery",name:"JCB 3DX Hire",uom:"Hours",rate:1100,gst:18,vendorRateMemory:[{vendor:"Infra Rentals",rate:1100,date:"2025-01-15"}]},
    {id:"ir8",type:"machinery",name:"Concrete Mixer (Owned Depr.)",uom:"Hours",rate:350,gst:18,vendorRateMemory:[{vendor:"Internal Fleet",rate:350,date:"2025-01-01"}]},
    {id:"ir9",type:"labour",name:"Skilled Mason",uom:"ManDays",rate:850,gst:0,vendorRateMemory:[{vendor:"Labour Contractor",rate:850,date:"2025-01-01"}]},
    {id:"ir10",type:"labour",name:"Unskilled Helper",uom:"ManDays",rate:550,gst:0,vendorRateMemory:[{vendor:"Labour Contractor",rate:550,date:"2025-01-01"}]},
    {id:"ir11",type:"labour",name:"Bar Bender / Fitter",uom:"ManDays",rate:800,gst:0,vendorRateMemory:[{vendor:"Rebar Team",rate:800,date:"2025-01-01"}]},
    {id:"ir12",type:"transport",name:"Truck 10-Tonne Trip",uom:"Nos",rate:3200,gst:5,vendorRateMemory:[{vendor:"Fast Logistics",rate:3200,date:"2025-01-12"}]},
  ],
  company:{
    name:"Your Construction Co.",
    addr:"123 Contractor Lane Mumbai 400001",
    gst:"27AAAYC1234H1Z5",
    phone:"9800000000",
    email:"info@yourco.com",
    bank:"HDFC Bank",
    acc:"50100123456789",
    ifsc:"HDFC0001234",
    branch:"Andheri West",
    sign:"Authorised Signatory",
    logoUrl:"",
    stakeholders:[
      {id:"stk1",type:"Director",name:"Rajesh Shah",sharePct:60,investAmt:6000000,pan:"ABCPR1234F",phone:"9820011223"},
      {id:"stk2",type:"Partner",name:"Sunita Shah",sharePct:30,investAmt:3000000,pan:"ABCPR5678G",phone:"9820011224"},
      {id:"stk3",type:"Investor",name:"Apex Growth Fund",sharePct:10,investAmt:1000000,pan:"AABCA9012H",phone:"02267891234"},
    ]
  },
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
  purchaseRequisitions:[
    {id:"pr1",prNo:"PR/001/25-26",date:"2025-01-10",siteId:"s1",joId:"jo1",material:"TMT Fe500 12mm",qty:20,unit:"MT",reqByDate:"2025-01-20",reason:"Pillar casting phase 1",status:"Approved",generatedBy:"Ramesh Kumar",approvedBy:"Admin User",remarks:"Priority delivery"},
    {id:"pr2",prNo:"PR/002/25-26",date:"2025-01-15",siteId:"s2",joId:"jo2",material:"OPC 53 Cement",qty:500,unit:"Bags",reqByDate:"2025-01-25",reason:"Plinth concreting",status:"Pending",generatedBy:"Priya Nair",approvedBy:"",remarks:"Awaiting batch confirmation"}
  ],
  issues:[
    {id:"iss1",title:"Delay in Aggregate supply",desc:"Quarry transport strike causing 2-day delay",priority:"High",dueDate:"2025-02-25",status:"Open",createdBy:"Ramesh Kumar",assignedTo:"Admin User",createdAt:"2025-02-18",siteId:"s1"},
    {id:"iss2",title:"Minor hand injury at shuttering",desc:"Worker treated with site first aid, back on duty",priority:"Medium",dueDate:"2025-02-20",status:"Resolved",createdBy:"Ramesh Kumar",assignedTo:"Priya Nair",createdAt:"2025-02-17",siteId:"s1",isAccident:true}
  ],
  stickyNotes:[
    {id:"sn1",text:"Review NHAI revised drawings for pier 4",color:"#FEF08A",date:"2025-02-17"},
    {id:"sn2",text:"Follow up with UltraTech on bulk cement credit days",color:"#BAE6FD",date:"2025-02-18"},
  ],
  siteDocs:[
    {id:"sd1",siteId:"s1",name:"Pier Reinforcement Drawing Rev-2.pdf",type:"PDF",date:"2025-01-15",size:"3.2 MB"},
    {id:"sd2",siteId:"s2",name:"Block A Foundation Soil Report.docx",type:"DOCX",date:"2025-01-20",size:"1.4 MB"}
  ],
  jobOrders:[
    {
      id:"jo1",
      joNo:"JO/001/25-26",
      date:"2025-01-08",
      soId:"so1",
      siteId:"s1",
      client:"NHAI",
      jobName:"NH-48 Full Contract — Zone A Foundation",
      specialInstructions:"Follow IS 456 concrete cover norms and wear safety harnesses on scaffolding.",
      tasks:[
        {id:"t1",name:"Foundation Work",unit:"SqM",soQty:5000,alreadyAllocated:0,qty:2500,maxQty:5000,soLineIdx:0,phase:"Foundation & Sub-Structure",estStartDate:"2025-01-10",estEndDate:"2025-03-31",matBudget:1350000,labBudget:750000,macBudget:300000},
        {id:"t2",name:"Concrete Casting",unit:"CuM",soQty:500,alreadyAllocated:0,qty:250,maxQty:500,soLineIdx:1,phase:"Super Structure & RCC",estStartDate:"2025-02-01",estEndDate:"2025-04-15",matBudget:506250,labBudget:281250,macBudget:112500}
      ]
    }
  ],
  ccs:[
    {
      id:"ccs1",
      ccsNo:"CCS/001/25-26",
      date:"2025-01-12",
      prId:"pr1",
      prNo:"PR/001/25-26",
      material:"TMT Fe500 12mm",
      qty:20,
      unit:"MT",
      siteId:"s1",
      status:"Evaluated",
      quotes:[
        {vendor:"Steel India Ltd",rate:56000,gst:18,landedRate:66080,deliveryDays:7,paymentTerms:"Credit 30d",pastRate:56000,rank:"L1",isL1:true,remarks:"Lowest bidder, test certificate verified"},
        {vendor:"Tata Steel",rate:58500,gst:18,landedRate:69030,deliveryDays:5,paymentTerms:"Credit 45d",pastRate:58000,rank:"L2",isL1:false,remarks:"Reputed brand, higher price"}
      ],
      selectedVendor:"Steel India Ltd",
      poId:"po1"
    }
  ],
};

/* ══════════ PERSISTENCE & STORAGE ENGINE ══════════ */
const loadData=()=>{
  try{
    const raw=localStorage.getItem("sl_data");
    if(!raw) return INIT_D;
    const parsed=JSON.parse(raw);
    const merged={...INIT_D,...parsed};
    Object.keys(INIT_D).forEach(k=>{
      if(merged[k]===undefined||merged[k]===null){
        merged[k]=INIT_D[k];
      }
    });
    if(!merged.jobOrders||!merged.jobOrders.length) merged.jobOrders=INIT_D.jobOrders;
    if(!merged.ccs||!merged.ccs.length) merged.ccs=INIT_D.ccs;
    return merged;
  }catch(e){
    console.error("Error loading sl_data:",e);
    return INIT_D;
  }
};

const persistData=(d)=>{
  try{
    localStorage.setItem("sl_data",JSON.stringify(d));
    localStorage.setItem("sl_last_saved",new Date().toISOString());
  }catch(e){
    console.error("Error saving sl_data:",e);
  }
};

const loadMasters=()=>{
  try{
    const raw=localStorage.getItem("sl_masters");
    if(!raw) return INIT_M;
    const parsed=JSON.parse(raw);
    const merged={...INIT_M,...parsed};
    Object.keys(INIT_M).forEach(k=>{
      if(merged[k]===undefined||merged[k]===null){
        merged[k]=INIT_M[k];
      }
    });
    if(!merged.company) merged.company=INIT_M.company;
    if(!merged.users||!merged.users.length) merged.users=INIT_M.users;
    return merged;
  }catch(e){
    console.error("Error loading sl_masters:",e);
    return INIT_M;
  }
};

const persistMasters=(m)=>{
  try{
    localStorage.setItem("sl_masters",JSON.stringify(m));
  }catch(e){
    console.error("Error saving sl_masters:",e);
  }
};

const getSessionUser=()=>{
  try{
    return JSON.parse(localStorage.getItem("sl_session_user")||sessionStorage.getItem("sl_session_user")||"null");
  }catch(e){
    return null;
  }
};

const saveSessionUser=(u)=>{
  try{
    localStorage.setItem("sl_session_user",JSON.stringify(u));
    sessionStorage.setItem("sl_session_user",JSON.stringify(u));
  }catch(e){}
};

const clearSessionUser=()=>{
  try{
    localStorage.removeItem("sl_session_user");
    sessionStorage.removeItem("sl_session_user");
  }catch(e){}
};

const getSnapshots=()=>{
  try{
    return JSON.parse(localStorage.getItem("sl_snapshots")||"[]");
  }catch(e){
    return [];
  }
};

const saveSnapshot=(label="Manual Checkpoint", d=null, m=null, s=null)=>{
  try{
    const dataToSave = d || loadData();
    const mastersToSave = m || loadMasters();
    const settingsToSave = s || getSettings();
    const snap = {
      id: "snap_" + Date.now(),
      label,
      date: new Date().toISOString(),
      user: (getSessionUser()||{}).name || "User",
      recordCount: Object.values(dataToSave).reduce((acc, v)=>acc + (Array.isArray(v)?v.length:0), 0),
      payload: { data: dataToSave, masters: mastersToSave, settings: settingsToSave }
    };
    const current = getSnapshots();
    const updated = [snap, ...current.filter(x=>x.id!==snap.id)].slice(0, 8);
    localStorage.setItem("sl_snapshots", JSON.stringify(updated));
    return snap;
  }catch(e){
    console.error("Error saving snapshot:", e);
    return null;
  }
};

const deleteSnapshot=(snapId)=>{
  try{
    const current = getSnapshots();
    const updated = current.filter(s=>s.id!==snapId);
    localStorage.setItem("sl_snapshots", JSON.stringify(updated));
    return updated;
  }catch(e){
    return [];
  }
};

/* ══════════ PRINT HELPER ══════════ */
const openPrint=(html,title="Document")=>{
  try{const blob=new Blob([html],{type:"text/html"});const url=URL.createObjectURL(blob);const w=window.open(url,"_blank","width=960,height=750");if(!w)alert("Allow popups for printing.");}catch(e){console.error(e);}
};
const printWrapper=(content,title,co)=>`<!DOCTYPE html><html><head><meta charset=utf-8><title>${title}</title><style>body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:0}@media print{.noprint{display:none}}</style></head><body>${content}<div class=noprint style="text-align:center;padding:16px;background:#f8fafc;border-top:1px solid #e2e8f0;margin-top:20px"><button onclick="window.print()" style="background:#F59E0B;color:#000;border:none;padding:10px 28px;border-radius:6px;font-weight:700;font-size:13px;cursor:pointer;margin-right:10px">Print / Save PDF</button><button onclick="window.close()" style="background:#e2e8f0;color:#333;border:none;padding:10px 20px;border-radius:6px;font-weight:700;cursor:pointer">Close</button></div></body></html>`;

const genInv=(sale,co,cl,opts={})=>{
  const c=cS(sale);const n=v=>Number(v||0).toLocaleString("en-IN");
  const docType=opts.isProforma?"PROFORMA INVOICE":opts.isDebit?"DEBIT NOTE":opts.isEstimate?"QUOTATION":"TAX INVOICE";
  const docNo=sale.inv||sale.pfNo||sale.estNo||sale.dnNo||sale.qtnNo||"—";
  const invTypeDesc=opts.isEstimate?(sale.status||"Draft"):sale.invoiceType==="Final"?"Final Invoice":sale.invoiceType==="Supplementary"?"Supplementary Invoice":"Running Account";
  
  /* Linked Order Info */
  const soObj=opts.soObj||null;
  const joObj=opts.joObj||null;
  const siteDisplayName=opts.siteName||(sale.siteId==="CONSULTANCY"?"Consultancy":(sale.isConsultancy||(sale.desc||"").toLowerCase().includes("consultancy")?"Consultancy":sale.siteId||"—"));
  const jobDisplayName=sale.desc||sale.jobDesc||sale.jobName||(soObj?soObj.desc:"—");
  const soInfoStr=soObj?(soObj.soNo||soObj.id)+" dt. "+fmtDate(soObj.date):sale.soId?sale.soId:(opts.isEstimate?"Pending":"—");
  const joInfoStr=joObj?(joObj.joNo||joObj.id)+" dt. "+fmtDate(joObj.date):sale.joId||sale.jobOrderId?sale.joId||sale.jobOrderId:(opts.isEstimate?"Pending":"—");
  const clientWOStr=sale.clientWONo?(sale.clientWONo+(sale.clientWODate?" dt. "+fmtDate(sale.clientWODate):"")):(opts.isEstimate?"Pending":"—");

  const liRows=(sale.lineItems||[{desc:sale.desc,hsn:"",qty:1,unit:"Lump",rate:sale.basic||0,gst:sale.gst||18,disc:0}]).map(it=>{
    const gr=(it.qty||0)*(it.rate||0),d=gr*(it.disc||0)/100,b=gr-d,g=b*(it.gst||0)/100;
    return "<tr><td>"+(it.desc||it.item||"")+"</td><td>"+(it.hsn||"—")+"</td><td style=\"text-align:right\">"+it.qty+" "+it.unit+"</td><td style=\"text-align:right\">"+n(it.rate)+"</td><td style=\"text-align:center\">"+(it.disc||0)+"%</td><td style=\"text-align:right\">"+n(b)+"</td><td style=\"text-align:center\">"+it.gst+"%</td><td style=\"text-align:right\">"+n(g)+"</td><td style=\"text-align:right\">"+n(b+g)+"</td></tr>";
  }).join("");

  const logoHtml=co.logoUrl?("<img src=\""+co.logoUrl+"\" style=\"height:42px;margin-bottom:4px;display:block\">"):"";
  const badgeHtml="<span class=badge>"+invTypeDesc+"</span>";
  const discHtml=c.discount>0?("<div class=sr><span>Gross Value</span><span>Rs "+n(c.basic+c.discount)+"</span></div><div class=sr style=\"color:#34D399\"><span>Less: Discount</span><span>- Rs "+n(c.discount)+"</span></div>"):"";
  const netLabel=opts.isEstimate?"NET QUOTATION":opts.isProforma?"PROFORMA AMOUNT":"NET INVOICE VALUE";
  const netAmt=c.gross;
  const amtWords="<div style=\"padding:8px 28px 4px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px\"><b>Amount in Words:</b> Rupees "+numWords(Math.round(netAmt))+"</div>";

  /* GST bifurcation */
  const hsnMap={};(sale.lineItems||[]).forEach(function(it){const k=(it.hsn||it.sac||"N/A")+"|"+(it.gst||0);const b=(it.qty||0)*(it.rate||0)*(1-(it.disc||0)/100);const g=b*(it.gst||0)/100;if(!hsnMap[k])hsnMap[k]={hsn:it.hsn||it.sac||"N/A",desc:(it.desc||it.item||"").slice(0,30),gstRate:it.gst||0,taxable:0,cgst:0,sgst:0};hsnMap[k].taxable+=b;hsnMap[k].cgst+=g/2;hsnMap[k].sgst+=g/2;});
  const gstRows=Object.values(hsnMap).map(function(r){return "<tr><td>"+r.hsn+"</td><td>"+r.desc+"</td><td style=\"text-align:right\">"+n(r.taxable)+"</td><td style=\"text-align:center\">"+r.gstRate+"%</td><td style=\"text-align:right\">"+n(r.cgst)+"</td><td style=\"text-align:right\">"+n(r.sgst)+"</td><td style=\"text-align:right\">"+n(r.cgst+r.sgst)+"</td></tr>";}).join("");
  const gstTable=(Object.keys(hsnMap).length>0)?("<div style=\"margin:0 28px 14px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden\"><div style=\"background:#060C1A;color:#F59E0B;padding:7px 14px;font-size:10px;font-weight:700\">GST BIFURCATION (HSN/SAC WISE)</div><table style=\"width:100%;border-collapse:collapse;font-size:11px\"><thead><tr style=\"background:#f8fafc\"><th style=\"padding:5px 8px\">HSN/SAC</th><th style=\"padding:5px 8px\">Description</th><th style=\"padding:5px 8px;text-align:right\">Taxable</th><th style=\"padding:5px 8px;text-align:center\">Rate</th><th style=\"padding:5px 8px;text-align:right\">CGST</th><th style=\"padding:5px 8px;text-align:right\">SGST</th><th style=\"padding:5px 8px;text-align:right\">Total</th></tr></thead><tbody>"+gstRows+"</tbody></table></div>"):"";

  /* Terms and Conditions */
  const termsHtml=sale.terms?("<div style=\"padding:10px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px\"><b style=\"color:#0f172a\">Terms and Conditions:</b><p style=\"margin:4px 0 0;color:#475569;white-space:pre-wrap\">"+sale.terms+"</p></div>"):"";

  /* Page 2 Detailed BOQ for Quotation */
  const boqRows=(sale.lineItems||[]).map(function(it,idx){
    const b=(it.qty||0)*(it.rate||0),d=b*(it.disc||0)/100,tx=b-d,g=tx*(it.gst||18)/100;
    return "<tr><td style=\"text-align:center\">"+(idx+1)+"</td><td><b>"+(it.desc||it.item||"")+"</b><br><small style=\"color:#64748b\">As per standard construction specifications</small></td><td style=\"text-align:center\">"+(it.hsn||"—")+"</td><td style=\"text-align:right\"><b>"+it.qty+"</b></td><td style=\"text-align:center\">"+it.unit+"</td><td style=\"text-align:right\">Rs "+n(it.rate)+"</td><td style=\"text-align:right\">Rs "+n(tx)+"</td><td style=\"text-align:center\">"+it.gst+"%</td><td style=\"text-align:right;font-weight:700\">Rs "+n(tx+g)+"</td></tr>";
  }).join("");

  const boqHtmlPage2=opts.isEstimate?("<div class=\"pg page2\" style=\"page-break-before:always;margin-top:20px\"><div class=hdr><div><h1>DETAILED BILL OF QUANTITIES (BOQ)</h1><p>Annexure to Quotation: "+docNo+" | Date: "+fmtDate(sale.date)+"</p></div><div style=\"text-align:right;color:#F59E0B;font-weight:700\">Page 2 — Detailed BOQ</div></div><div style=\"padding:12px 28px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:11px\"><div><b>Client:</b> "+(cl?cl.name:sale.client)+" | <b>Project:</b> "+siteDisplayName+"</div><div><b>Scope / Job:</b> "+jobDisplayName+"</div></div><div style=\"padding:16px 28px\"><table style=\"width:100%;border-collapse:collapse;font-size:11px\"><thead><tr style=\"background:#060C1A\"><th style=\"text-align:center;color:#F59E0B\">#</th><th style=\"color:#F59E0B\">Item & Scope Description</th><th style=\"text-align:center;color:#F59E0B\">HSN/SAC</th><th style=\"text-align:right;color:#F59E0B\">Qty</th><th style=\"text-align:center;color:#F59E0B\">Unit</th><th style=\"text-align:right;color:#F59E0B\">Rate</th><th style=\"text-align:right;color:#F59E0B\">Basic</th><th style=\"text-align:center;color:#F59E0B\">GST</th><th style=\"text-align:right;color:#F59E0B\">Total</th></tr></thead><tbody>"+boqRows+"</tbody><tfoot><tr style=\"background:#060C1A;color:#fff;font-weight:700\"><td colspan=6 style=\"text-align:right;color:#F59E0B\">Grand Total BOQ Value:</td><td style=\"text-align:right;color:#F59E0B\">Rs "+n(c.basic)+"</td><td style=\"text-align:center;color:#F59E0B\">—</td><td style=\"text-align:right;color:#F59E0B\">Rs "+n(c.gross)+"</td></tr></tfoot></table><div style=\"margin-top:36px;display:flex;justify-content:space-between;color:#64748b;font-size:11px;padding-top:16px;border-top:1px solid #e2e8f0\"><div>Prepared by Technical Estimator</div><div>Accepted &amp; Approved by Client</div></div></div></div>"):"";

  /* Page 2 Running Account Abstract (for Invoices) */
  const abstractHtmlPage2=(!opts.isEstimate&&opts.soAbstract)?("<div class=\"pg page2\" style=\"page-break-before:always;margin-top:20px\"><div class=hdr><div><h1>RUNNING ACCOUNT ABSTRACT</h1><p>Annexure to "+docType+": "+docNo+"</p></div><div style=\"text-align:right;color:#F59E0B;font-weight:700\">Page 2</div></div><div style=\"padding:24px 28px\"><table style=\"width:100%;border-collapse:collapse\"><thead><tr style=\"background:#060C1A\"><th style=\"padding:8px 10px;text-align:left;color:#F59E0B\">Item / Service</th><th style=\"padding:8px 10px;text-align:right;color:#F59E0B\">Estimated</th><th style=\"padding:8px 10px;text-align:right;color:#34D399\">Completed</th><th style=\"padding:8px 10px;text-align:right;color:#F59E0B\">Prev Billed</th><th style=\"padding:8px 10px;text-align:right;color:#F59E0B\">This Bill</th><th style=\"padding:8px 10px;text-align:right;color:#F87171\">Balance</th></tr></thead><tbody>"+opts.soAbstract.map(function(r){return "<tr><td style=\"padding:7px 10px;border-bottom:1px solid #f1f5f9\">"+r.desc+"</td><td style=\"padding:7px 10px;border-bottom:1px solid #f1f5f9;text-align:right\">"+r.estimated+" "+r.unit+"</td><td style=\"padding:7px 10px;border-bottom:1px solid #f1f5f9;text-align:right;color:#34D399;font-weight:600\">"+r.completed+" "+r.unit+"</td><td style=\"padding:7px 10px;border-bottom:1px solid #f1f5f9;text-align:right\">"+r.prevBilled+" "+r.unit+"</td><td style=\"padding:7px 10px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:700\">"+r.thisBill+" "+r.unit+"</td><td style=\"padding:7px 10px;border-bottom:1px solid #f1f5f9;text-align:right;color:#F87171\">"+r.balance+" "+r.unit+"</td></tr>";}).join("")+"</tbody></table><div style=\"margin-top:24px;display:flex;justify-content:space-between;color:#64748b;font-size:11px\"><span>Prepared By Site Engineer</span><span>Approved By Client Representative</span></div></div></div>"):"";

  const css=".pg{max-width:920px;margin:0 auto 20px;border:2px solid #060C1A;font-family:Arial,sans-serif;font-size:12px;color:#111;background:#fff}.hdr{background:#060C1A;color:#F59E0B;padding:16px 28px;display:flex;justify-content:space-between;align-items:center}.hdr h1{margin:0;font-size:20px}.hdr p{margin:2px 0;color:#94A3B8;font-size:11px}.badge{background:#F59E0B;color:#060C1A;padding:4px 12px;border-radius:20px;font-weight:700;font-size:11px;display:inline-block;margin-top:4px}.meta{display:grid;grid-template-columns:repeat(4,1fr);padding:10px 28px;background:#f8fafc;border-bottom:1px solid #e2e8f0;gap:12px}.meta h4{margin:0 0 2px;color:#64748b;font-size:9px;text-transform:uppercase}.meta p{margin:0;font-weight:600;font-size:11px}.doc-ref{display:grid;grid-template-columns:repeat(4,1fr);padding:8px 28px;background:#f1f5f9;border-bottom:1px solid #e2e8f0;font-size:10px;gap:10px}.doc-ref div b{display:block;color:#060C1A;font-size:11px}.tf{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;padding:12px 28px;border-bottom:1px solid #e2e8f0}.tf h4{color:#F59E0B;font-size:9px;text-transform:uppercase;margin:0 0 5px}table{width:100%;border-collapse:collapse}th{background:#060C1A;color:#F59E0B;padding:8px 12px;text-align:left;font-size:10px}td{padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:11px}.itbl{padding:0 28px 12px}.sum{display:flex;justify-content:flex-end;padding:10px 28px}.sb{width:340px}.sr{display:flex;justify-content:space-between;padding:5px 0;font-size:12px;border-bottom:1px solid #f8fafc}.st{display:flex;justify-content:space-between;padding:10px 0;font-weight:700;font-size:16px;border-top:2px solid #060C1A;margin-top:4px}.bk{padding:12px 28px;background:#f8fafc;border-top:1px solid #e2e8f0}.bk h4{color:#F59E0B;font-size:9px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px}.bg{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.bg label{display:block;color:#94a3b8;font-size:9px;text-transform:uppercase}.bg span{font-size:12px;font-weight:600}.ft{padding:12px 28px;display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8}.np{text-align:center;padding:18px;background:#f8fafc}@media print{.np{display:none}.page2{page-break-before:always}}";

  const html="<!DOCTYPE html><html><head><meta charset=utf-8><title>"+docType+" "+docNo+"</title><style>"+css+"</style></head><body><div class=pg>"+
    "<div class=hdr><div>"+logoHtml+"<h1>"+(co.name||"")+"</h1><p>"+(co.addr||"")+"</p><p>GST: "+(co.gst||"")+" | "+(co.phone||"")+"</p></div>"+
    "<div style=\"text-align:right\"><div style=\"font-size:11px;color:#94a3b8\">"+docType+"</div><div style=\"font-size:22px;font-weight:800;color:#F59E0B\">"+docNo+"</div>"+badgeHtml+"</div></div>"+
    "<div class=meta><div><h4>Date</h4><p>"+fmtDate(sale.date)+"</p></div><div><h4>"+(opts.isEstimate?"Quotation Number":"Invoice No")+"</h4><p>"+docNo+"</p></div><div><h4>"+(opts.isEstimate?"Quotation Type":"Invoice Type")+"</h4><p>"+invTypeDesc+"</p></div><div><h4>Site / Project</h4><p>"+siteDisplayName+"</p></div></div>"+
    "<div class=doc-ref><div><span>Client WO No / Date</span><b>"+clientWOStr+"</b></div><div><span>Name of Job</span><b>"+jobDisplayName+"</b></div><div><span>Our Sale Order</span><b>"+soInfoStr+"</b></div><div><span>Our Job Order</span><b>"+joInfoStr+"</b></div></div>"+
    "<div class=tf><div><h4>Bill To</h4><p style=\"font-size:14px;font-weight:700;margin:0 0 4px\">"+(cl?cl.name:sale.client)+"</p><p style=\"font-size:11px;color:#64748b;margin:0\">"+(cl?cl.billTo||cl.addr||"":"")+"</p><p style=\"font-size:10px;color:#94a3b8;margin:2px 0 0\">GST: "+(cl?cl.gst:"N/A")+"</p></div>"+
    "<div><h4>Ship To / Destination</h4><p style=\"font-size:13px;font-weight:700;margin:0 0 2px\">"+(cl?cl.name:(sale.client||"—"))+"</p><p style=\"font-size:11px;color:#64748b;margin:0\">"+(cl?cl.shipTo||cl.billTo||cl.addr||siteDisplayName:siteDisplayName)+"</p><p style=\"font-size:10px;color:#94a3b8;margin:2px 0 0\">GST: "+(cl?cl.gst||"Unregistered / N/A":"N/A")+"</p></div>"+
    "<div><h4>Issued By</h4><p style=\"font-size:14px;font-weight:700;margin:0 0 4px\">"+co.name+"</p><p style=\"font-size:11px;color:#64748b;margin:0\">"+co.addr+"</p><p style=\"font-size:10px;color:#94a3b8;margin:2px 0 0\">GST: "+co.gst+"</p></div></div>"+
    "<div class=itbl><table><thead><tr><th>Description</th><th>HSN/SAC</th><th style=\"text-align:right\">Qty/Unit</th><th style=\"text-align:right\">Rate</th><th>Disc%</th><th style=\"text-align:right\">Basic</th><th>GST%</th><th style=\"text-align:right\">GST Amt</th><th style=\"text-align:right\">Total</th></tr></thead><tbody>"+liRows+"</tbody></table></div>"+
    "<div class=sum><div class=sb>"+discHtml+"<div class=sr><span>Taxable Value</span><span>Rs "+n(c.basic)+"</span></div><div class=sr><span>GST Amount</span><span>Rs "+n(c.g)+"</span></div><div class=sr><span>Gross Total</span><span>Rs "+n(c.gross)+"</span></div><div class=st><span>"+netLabel+"</span><span>Rs "+n(netAmt)+"</span></div></div></div>"+
    amtWords+
    gstTable+
    termsHtml+
    "<div class=bk><h4>Bank Details for Payment</h4><div class=bg><div><label>Bank</label><span>"+co.bank+"</span></div><div><label>Account No</label><span>"+co.acc+"</span></div><div><label>IFSC</label><span>"+co.ifsc+"</span></div><div><label>Branch</label><span>"+co.branch+"</span></div></div></div>"+
    "<div class=ft><p>Subject to jurisdiction terms. Computer generated document.</p><div style=\"text-align:right\"><p style=\"margin:0\">For "+co.name+"</p><p style=\"margin:24px 0 0;border-top:1px solid #e2e8f0;padding-top:4px;font-size:10px\">Authorised Signatory</p></div></div></div>"+
    boqHtmlPage2+
    abstractHtmlPage2+
    "<div class=np><button onclick=\"window.print()\" style=\"background:#F59E0B;color:#060C1A;border:none;padding:10px 28px;border-radius:6px;font-weight:700;font-size:13px;cursor:pointer;margin-right:10px\">Print / Save PDF</button><button onclick=\"window.close()\" style=\"background:#e2e8f0;color:#333;border:none;padding:10px 20px;border-radius:6px;font-weight:700;cursor:pointer\">Close</button></div></body></html>";
  try{const blob=new Blob([html],{type:"text/html"});const url=URL.createObjectURL(blob);const w=window.open(url,"_blank","width=940,height=760");if(!w)alert("Allow popups for printing.");}catch(e){console.error(e);}
};
const genGenericPrint=(title,bodyHtml,co)=>openPrint(printWrapper("<div style=\"max-width:900px;margin:0 auto;padding:24px;font-family:Arial,sans-serif\"><div style=\"background:#060C1A;color:#F59E0B;padding:14px 24px;display:flex;justify-content:space-between;align-items:center;border-radius:8px 8px 0 0\"><div><div style=\"font-weight:800;font-size:18px\">"+(co?co.name:"")+"</div><div style=\"color:#94a3b8;font-size:10px\">"+(co?co.gst:"")+"</div></div><div style=\"font-size:16px;font-weight:700;color:white\">"+title+"</div></div><div style=\"border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 8px 8px\">"+bodyHtml+"</div></div>",title,co),title);

const genPOPrint=(po,co,vendor,opts={})=>{
  const n=v=>Number(v||0).toLocaleString("en-IN");
  const dataRef=opts.dataRef||{};
  const grnItems=(dataRef.materialReceipts||[]).filter(m=>m.poId===po.id);
  const purchBills=(dataRef.purchases||[]).filter(p=>p.poId===po.id);
  const prItems=(dataRef.purchaseRequisitions||[]).filter(pr=>pr.joId===po.jobOrderId||(po.desc||"").includes(pr.prNo));

  const page1Items=(po.lineItems||[]).map((li,i)=>{
    const b=(li.qty||0)*(li.rate||0);const g=b*(li.gst||18)/100;
    return `<tr><td>${i+1}</td><td><b>${li.item||li.desc}</b><br><small style="color:#64748b">HSN: ${li.hsn||"—"}</small></td><td style="text-align:right">${li.qty} ${li.unit||""}</td><td style="text-align:right">₹${n(li.rate)}</td><td style="text-align:center">${li.gst||18}%</td><td style="text-align:right">₹${n(b)}</td><td style="text-align:right">₹${n(b+g)}</td></tr>`;
  }).join("");

  const page2Rows=(po.lineItems||[]).map((li,i)=>{
    const matchedPR=prItems.find(p=>(p.material||"").toLowerCase().includes((li.item||"").toLowerCase()))||{};
    const prQty=matchedPR.qty||li.qty||0;
    const recvQty=grnItems.filter(g=>(g.item||"").toLowerCase().includes((li.item||"").toLowerCase())).reduce((a,x)=>a+(Number(x.qty)||0),0);
    const balQty=Math.max(0,(li.qty||0)-recvQty);
    const billedQty=purchBills.filter(b=>(b.item||"").toLowerCase().includes((li.item||"").toLowerCase())).reduce((a,x)=>a+(Number(x.qty)||0),0);
    const billedAmt=purchBills.filter(b=>(b.item||"").toLowerCase().includes((li.item||"").toLowerCase())).reduce((a,x)=>a+((Number(x.qty)||0)*(Number(x.rate)||0)*(1+(x.gst||18)/100)),0);
    return `<tr><td>${i+1}</td><td><b>${li.item||li.desc}</b></td><td style="text-align:right">${prQty} ${li.unit||""}</td><td style="text-align:right"><b>${li.qty}</b> ${li.unit||""}</td><td style="text-align:right;color:#059669"><b>${recvQty}</b> ${li.unit||""}</td><td style="text-align:right;color:#dc2626"><b>${balQty}</b> ${li.unit||""}</td><td style="text-align:right">${billedQty} ${li.unit||""}</td><td style="text-align:right;font-weight:700">₹${n(billedAmt)}</td></tr>`;
  }).join("");

  const html=`<!DOCTYPE html><html><head><meta charset=utf-8><title>Purchase Order - ${po.poNo||po.id}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#0f172a;margin:0;padding:24px;background:#f8fafc}
    .page{max-width:880px;margin:0 auto 30px;background:#fff;padding:32px;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:1px solid #e2e8f0;border-radius:8px}
    .page2{page-break-before:always;margin-top:30px}
    table{width:100%;border-collapse:collapse;margin:16px 0;font-size:11px}
    th{background:#0f172a;color:#f8fafc;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase}
    td{padding:8px 10px;border-bottom:1px solid #f1f5f9}
    .hdr{display:flex;justify-content:space-between;border-bottom:2px solid #f59e0b;padding-bottom:12px;margin-bottom:14px}
    @media print{.noprint{display:none}body{background:#fff;padding:0}.page{box-shadow:none;border:none;margin:0;padding:20px}.page2{page-break-before:always}}
  </style></head><body>
  <div class=page>
    <div class=hdr>
      <div><h2 style="margin:0;color:#0f172a;font-size:20px">${co.name||""}</h2><p style="margin:2px 0;color:#64748b;font-size:11px">${co.addr||""}<br>GSTIN: <b>${co.gst||""}</b></p></div>
      <div style="text-align:right"><h3 style="margin:0;color:#f59e0b;font-size:16px">PURCHASE ORDER</h3><p style="margin:4px 0;font-family:monospace;font-size:13px;font-weight:700">${po.poNo||po.id}</p><p style="margin:0;color:#64748b">Date: ${po.date}</p></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:12px 14px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;margin-bottom:16px">
      <div><b style="color:#64748b;font-size:10px;text-transform:uppercase">Vendor Details</b><div style="font-weight:700;font-size:13px;margin-top:2px">${vendor?vendor.name:po.vendor}</div><div style="color:#475569;font-size:11px">${vendor?vendor.address||"":"—"}</div><div style="color:#64748b;font-size:10px">GSTIN: ${vendor?vendor.gst||"—":"—"}</div></div>
      <div><b style="color:#64748b;font-size:10px;text-transform:uppercase">Site / Delivery Destination</b><div style="font-weight:700;font-size:13px;margin-top:2px">${opts.siteName||"—"}</div><div style="color:#475569;font-size:11px">Job Order: <b>${po.joNo||po.jobOrderId||"—"}</b></div><div style="color:#64748b;font-size:10px">Status: ${po.status||"Active"}</div></div>
    </div>
    <div style="font-weight:700;color:#0f172a;font-size:12px">PO Scope / Description: <span style="font-weight:400">${po.desc}</span></div>
    <table>
      <thead><tr><th>#</th><th>Material / Description</th><th style="text-align:right">Qty</th><th style="text-align:right">Rate</th><th style="text-align:center">GST%</th><th style="text-align:right">Basic (₹)</th><th style="text-align:right">Total (₹)</th></tr></thead>
      <tbody>${page1Items}</tbody>
    </table>
    <div style="margin-top:20px;display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;padding-top:12px;font-size:10px;color:#64748b">
      <span>Terms: Payment as per contract schedule. Delivery strictly on site.</span>
      <div style="text-align:right"><p style="margin:0;font-weight:700">For ${co.name}</p><p style="margin:30px 0 0">Authorised Signatory</p></div>
    </div>
  </div>

  <!-- PAGE 2: 5-WAY QUANTITY & BILLING RECONCILIATION -->
  <div class="page page2">
    <div class=hdr>
      <div><h3 style="margin:0;color:#0f172a">PURCHASE ORDER — PAGE 2 RECONCILIATION</h3><p style="margin:2px 0;color:#64748b;font-size:11px">PO Ref: <b>${po.poNo||po.id}</b> | Vendor: <b>${vendor?vendor.name:po.vendor}</b></p></div>
      <div style="text-align:right"><span style="background:#fef3c7;color:#b45309;padding:4px 8px;border-radius:4px;font-size:10px;font-weight:700">COMPLIANCE &amp; AUDIT</span></div>
    </div>
    <div style="padding:10px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;font-size:11px;color:#166534;margin-bottom:12px">
      📊 <b>Quantity &amp; Invoiced Reconciliation</b> tracking PR request vs PO commitments vs GRN gate passes vs vendor invoices.
    </div>
    <table>
      <thead><tr><th>#</th><th>Material</th><th style="text-align:right">PR Qty</th><th style="text-align:right">PO Qty</th><th style="text-align:right">GRN Received</th><th style="text-align:right">Balance Qty</th><th style="text-align:right">Invoiced Qty</th><th style="text-align:right">Invoiced Amt</th></tr></thead>
      <tbody>${page2Rows}</tbody>
    </table>
    <div style="margin-top:24px;padding:12px;background:#f8fafc;border-radius:6px;font-size:11px;color:#475569">
      <b>GRN References linked:</b> ${(grnItems.map(g=>g.grnNo+" ("+g.date+")").join(", "))||"None yet"}<br>
      <b>Invoices / Bills linked:</b> ${(purchBills.map(b=>(b.billNo||b.id)+" (₹"+n(cP(b).tot)+")").join(", "))||"None yet"}
    </div>
    <div style="margin-top:30px;display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;padding-top:12px;font-size:10px;color:#64748b">
      <span>Verified by Site Store In-charge</span>
      <span>Approved by Project Manager</span>
    </div>
  </div>

  <div class=noprint style="text-align:center;padding:16px"><button onclick="window.print()" style="background:#f59e0b;color:#0f172a;border:none;padding:10px 28px;border-radius:6px;font-weight:700;cursor:pointer;margin-right:10px">Print / Save PDF</button><button onclick="window.close()" style="background:#e2e8f0;border:none;padding:10px 20px;border-radius:6px;font-weight:700;cursor:pointer">Close</button></div>
  </body></html>`;
  openPrint(html, "PO_"+(po.poNo||po.id));
};

const printCCS=(ccs,co,opts={})=>{
  const n=v=>Number(v||0).toLocaleString("en-IN");
  const quotes=ccs.quotes||[];
  const quoteRows=quotes.map((q,idx)=>{
    const isL1=q.rank==="L1"||q.isL1;
    return `<tr style="${isL1?'background:#f0fdf4;font-weight:600':''}">
      <td style="text-align:center">${idx+1}</td>
      <td><b>${q.vendor}</b> ${isL1?'<span style="background:#10b981;color:#fff;padding:2px 6px;border-radius:12px;font-size:9px;margin-left:6px">⭐ L1 Best</span>':''}</td>
      <td style="text-align:right">₹${n(q.rate)}</td>
      <td style="text-align:center">${q.gst||18}%</td>
      <td style="text-align:right;color:${isL1?'#059669':'#0f172a'};font-weight:700">₹${n(q.landedRate||Math.round(q.rate*(1+(q.gst||18)/100)))}</td>
      <td style="text-align:center">${q.deliveryDays||"—"} Days</td>
      <td style="text-align:center">${q.paymentTerms||"—"}</td>
      <td style="text-align:right;color:#64748b">₹${n(q.pastRate||0)}</td>
      <td style="text-align:center"><span style="padding:2px 8px;border-radius:4px;font-weight:700;background:${isL1?'#dcfce7;color:#15803d':'#f1f5f9;color:#475569'}">${q.rank||("L"+(idx+1))}</span></td>
      <td style="font-size:10px;color:#64748b">${q.remarks||"—"}</td>
    </tr>`;
  }).join("");

  const html=`<!DOCTYPE html><html><head><meta charset=utf-8><title>Commercial Comparison - ${ccs.ccsNo||ccs.id}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#0f172a;margin:0;padding:24px;background:#f8fafc}
    .page{max-width:960px;margin:0 auto;background:#fff;padding:32px;border:1px solid #cbd5e1;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.06)}
    table{width:100%;border-collapse:collapse;margin:16px 0;font-size:11px}
    th{background:#0f172a;color:#f8fafc;padding:9px 10px;text-align:left;font-size:10px;text-transform:uppercase}
    td{padding:8px 10px;border-bottom:1px solid #f1f5f9}
    .hdr{display:flex;justify-content:space-between;border-bottom:2px solid #f59e0b;padding-bottom:12px;margin-bottom:14px}
    @media print{.noprint{display:none}body{background:#fff;padding:0}.page{border:none;box-shadow:none;padding:12px}}
  </style></head><body>
  <div class=page>
    <div class=hdr>
      <div><h2 style="margin:0;color:#0f172a">${co.name||""}</h2><p style="margin:2px 0;color:#64748b;font-size:11px">${co.addr||""}<br>GSTIN: <b>${co.gst||""}</b></p></div>
      <div style="text-align:right"><h3 style="margin:0;color:#f59e0b;font-size:16px">COMMERCIAL COMPARISON SHEET (CCS)</h3><p style="margin:4px 0;font-family:monospace;font-weight:700;font-size:13px">${ccs.ccsNo||ccs.id}</p><p style="margin:0;color:#64748b">Date: ${ccs.date||new Date().toISOString().slice(0,10)}</p></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;background:#f8fafc;padding:12px 14px;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:14px;font-size:11px">
      <div><b style="color:#64748b;font-size:10px;text-transform:uppercase">PR Reference:</b><div style="font-weight:700;margin-top:2px">${ccs.prNo||ccs.prId||"—"}</div></div>
      <div><b style="color:#64748b;font-size:10px;text-transform:uppercase">Material / Scope:</b><div style="font-weight:700;margin-top:2px">${ccs.material||"—"}</div></div>
      <div><b style="color:#64748b;font-size:10px;text-transform:uppercase">Requisition Qty:</b><div style="font-weight:700;margin-top:2px;color:#d97706">${ccs.qty} ${ccs.unit||""}</div></div>
      <div><b style="color:#64748b;font-size:10px;text-transform:uppercase">Recommended L1:</b><div style="font-weight:700;margin-top:2px;color:#059669">${ccs.selectedVendor||(quotes.find(q=>q.rank==="L1"||q.isL1)||{}).vendor||"—"}</div></div>
    </div>
    <table>
      <thead><tr><th>#</th><th>Vendor / Bidder</th><th style="text-align:right">Quoted Rate</th><th style="text-align:center">GST%</th><th style="text-align:right">Landed Rate</th><th style="text-align:center">Delivery</th><th style="text-align:center">Payment Terms</th><th style="text-align:right">Past Rate</th><th style="text-align:center">Rank</th><th>Remarks & Terms</th></tr></thead>
      <tbody>${quoteRows}</tbody>
    </table>
    <div style="padding:10px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;font-size:11px;color:#166534;margin-top:14px">
      💡 <b>Procurement Recommendation:</b> Vendor <b>${ccs.selectedVendor||(quotes.find(q=>q.rank==="L1"||q.isL1)||{}).vendor||"L1 Bidder"}</b> is recommended for issuing Purchase Order based on lowest landed cost evaluation, compliance with PR delivery schedule, and past rate benchmarking.
    </div>
    <div style="margin-top:36px;display:flex;justify-content:space-between;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#475569">
      <div>Prepared By: Procurement Officer<br><small style="color:#94a3b8">Date: ${ccs.date||""}</small></div>
      <div>Verified By: Purchase Manager<br><small style="color:#94a3b8">Rate Verification: Confirmed</small></div>
      <div>Approved By: Project Director<br><small style="color:#94a3b8">Status: Sanctioned for PO</small></div>
    </div>
  </div>
  <div class=noprint style="text-align:center;padding:16px"><button onclick="window.print()" style="background:#f59e0b;color:#000;border:none;padding:10px 28px;border-radius:6px;font-weight:700;cursor:pointer">Print / Save PDF</button></div>
  </body></html>`;
  openPrint(html, "CCS_"+(ccs.ccsNo||ccs.id));
};

const printGRN=(mr,co,opts={})=>{
  const n=v=>Number(v||0).toLocaleString("en-IN");
  const html=`<!DOCTYPE html><html><head><meta charset=utf-8><title>Goods Receipt Note - ${mr.grnNo||mr.id}</title>
  <style>body{font-family:Arial,sans-serif;font-size:12px;margin:0;padding:24px;background:#f8fafc}.page{max-width:820px;margin:0 auto;background:#fff;padding:28px;border:1px solid #cbd5e1;border-radius:8px}table{width:100%;border-collapse:collapse;margin:16px 0}th{background:#0f172a;color:#fff;padding:8px;text-align:left;font-size:10px}td{padding:8px;border-bottom:1px solid #f1f5f9}@media print{.noprint{display:none}body{background:#fff;padding:0}.page{border:none;padding:10px}}</style></head><body>
  <div class=page>
    <div style="display:flex;justify-content:space-between;border-bottom:2px solid #059669;padding-bottom:10px;margin-bottom:12px">
      <div><h2 style="margin:0">${co.name||""}</h2><p style="margin:2px 0;color:#64748b">${co.addr||""}<br>GSTIN: ${co.gst||""}</p></div>
      <div style="text-align:right"><h3 style="margin:0;color:#059669">GOODS RECEIPT NOTE (GRN)</h3><p style="margin:4px 0;font-family:monospace;font-weight:700;font-size:13px">${mr.grnNo||mr.id}</p><p style="margin:0;color:#64748b">Date: ${mr.date}</p></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:#f8fafc;padding:10px 14px;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:14px">
      <div><b>Vendor:</b> ${mr.vendor||"—"}<br><b>PO Reference:</b> ${mr.poId||"—"}</div>
      <div><b>Received At:</b> ${opts.locName||"—"}<br><b>Inspected By:</b> Store In-charge</div>
    </div>
    <table>
      <thead><tr><th>#</th><th>Material / Item Description</th><th style="text-align:right">Received Qty</th><th style="text-align:right">Unit Rate</th><th style="text-align:center">GST%</th><th style="text-align:right">Total Value</th></tr></thead>
      <tbody>
        <tr><td>1</td><td><b>${mr.item}</b><br><small style="color:#64748b">Condition: ${mr.remarks||"Good Condition"}</small></td><td style="text-align:right;font-weight:700;color:#059669">${mr.qty} ${mr.unit||""}</td><td style="text-align:right">₹${n(mr.rate)}</td><td style="text-align:center">${mr.gst||18}%</td><td style="text-align:right;font-weight:700">₹${n((mr.qty||0)*(mr.rate||0)*(1+(mr.gst||18)/100))}</td></tr>
      </tbody>
    </table>
    <div style="margin-top:24px;display:flex;justify-content:space-between;padding-top:14px;border-top:1px solid #e2e8f0;font-size:10px;color:#64748b">
      <div>Received By: ___________________</div>
      <div>Quality Check: Verified Passed</div>
      <div>Store Manager: ___________________</div>
    </div>
  </div>
  <div class=noprint style="text-align:center;padding:14px"><button onclick="window.print()" style="background:#059669;color:#fff;border:none;padding:8px 24px;border-radius:6px;font-weight:700;cursor:pointer">Print GRN</button></div>
  </body></html>`;
  openPrint(html, "GRN_"+(mr.grnNo||mr.id));
};

const printStockTransfer=(st,co,opts={})=>{
  const n=v=>Number(v||0).toLocaleString("en-IN");
  const html=`<!DOCTYPE html><html><head><meta charset=utf-8><title>Stock Transfer Note</title>
  <style>body{font-family:Arial,sans-serif;font-size:12px;margin:0;padding:24px;background:#f8fafc}.page{max-width:820px;margin:0 auto;background:#fff;padding:28px;border:1px solid #cbd5e1;border-radius:8px}table{width:100%;border-collapse:collapse;margin:16px 0}th{background:#0f172a;color:#fff;padding:8px;text-align:left;font-size:10px}td{padding:8px;border-bottom:1px solid #f1f5f9}@media print{.noprint{display:none}body{background:#fff;padding:0}.page{border:none;padding:10px}}</style></head><body>
  <div class=page>
    <div style="display:flex;justify-content:space-between;border-bottom:2px solid #2563eb;padding-bottom:10px;margin-bottom:12px">
      <div><h2 style="margin:0">${co.name||""}</h2><p style="margin:2px 0;color:#64748b">${co.addr||""}<br>GSTIN: ${co.gst||""}</p></div>
      <div style="text-align:right"><h3 style="margin:0;color:#2563eb">MATERIAL TRANSFER GATE PASS</h3><p style="margin:4px 0;font-family:monospace;font-weight:700">${st.id}</p><p style="margin:0;color:#64748b">Date: ${st.date}</p></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:#f8fafc;padding:10px 14px;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:14px">
      <div><b>Dispatch From:</b> ${opts.fromName||st.fromId} (${st.fromType})</div>
      <div><b>Destination:</b> ${opts.toName||st.toId} (${st.toType})<br><b>Transfer Status:</b> <span style="font-weight:700;color:#2563eb">${st.status||"In Transit"}</span></div>
    </div>
    <table>
      <thead><tr><th>#</th><th>Material / Plant Description</th><th style="text-align:right">Transfer Qty</th><th style="text-align:right">Unit Book Rate</th><th style="text-align:right">Total Transferred Value</th></tr></thead>
      <tbody>
        <tr><td>1</td><td><b>${st.item}</b><br><small style="color:#64748b">${st.desc||"Inter-site stock movement"}</small></td><td style="text-align:right;font-weight:700">${st.qty} ${st.unit||""}</td><td style="text-align:right">₹${n(st.rate)}</td><td style="text-align:right;font-weight:700">₹${n((st.qty||0)*(st.rate||0))}</td></tr>
      </tbody>
    </table>
    <div style="margin-top:24px;display:flex;justify-content:space-between;padding-top:14px;border-top:1px solid #e2e8f0;font-size:10px;color:#64748b">
      <div>Dispatched By: ___________________</div>
      <div>Transporter / Driver Sign: ___________________</div>
      <div>Received at Destination: ___________________</div>
    </div>
  </div>
  <div class=noprint style="text-align:center;padding:14px"><button onclick="window.print()" style="background:#2563eb;color:#fff;border:none;padding:8px 24px;border-radius:6px;font-weight:700;cursor:pointer">Print Transfer Note</button></div>
  </body></html>`;
  openPrint(html, "Transfer_"+st.id);
};

/* ══════════ DPR PRINT GENERATOR ══════════ */
const genDPRPrint=(dpr,co,opts={})=>{
  const cats = dpr.workerCats || {};
  const catRows = Object.entries(cats).filter(([_,qty])=>Number(qty)>0).map(([k,qty])=>`
    <div style="background:#f1f5f9;padding:6px 12px;border-radius:4px;border:1px solid #e2e8f0;font-size:11px">
      <span style="color:#64748b;text-transform:capitalize">${k}:</span> <b>${qty}</b>
    </div>
  `).join("") || `<div style="color:#64748b;font-size:11px">Total Workers: ${dpr.workers||0}</div>`;

  const workRows = (dpr.entries||[]).map((e,i)=>`
    <tr>
      <td>${i+1}</td>
      <td><b>${e.name||"—"}</b></td>
      <td style="text-transform:capitalize">${e.type||"Service"}</td>
      <td style="text-align:right;font-weight:700;color:#059669">${e.completedQty||0} ${e.unit||""}</td>
      <td>${e.remarks||"—"}</td>
    </tr>
  `).join("");

  const matRows = (dpr.consumedItems||[]).map((ci,i)=>`
    <tr>
      <td>${i+1}</td>
      <td><b>${ci.item||"—"}</b></td>
      <td style="text-align:right;font-weight:700">${ci.qty||0} ${ci.unit||""}</td>
      <td style="text-transform:capitalize">${ci.locType||"Site"}</td>
    </tr>
  `).join("");

  const accidentPhotos = (dpr.accidentImages||[]).map(img=>`
    <img src="${img}" style="max-height:120px;border-radius:6px;border:1px solid #cbd5e1;margin-right:8px;margin-bottom:8px;object-fit:cover"/>
  `).join("");

  const sitePhotos = (dpr.images||[]).map(img=>`
    <img src="${img}" style="max-height:120px;border-radius:6px;border:1px solid #cbd5e1;margin-right:8px;margin-bottom:8px;object-fit:cover"/>
  `).join("");

  const html = `<!DOCTYPE html><html><head><meta charset=utf-8><title>DPR - ${dpr.date} - ${opts.siteName||""}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#0f172a;margin:0;padding:24px;background:#f8fafc}
    .page{max-width:880px;margin:0 auto;background:#fff;padding:32px;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:1px solid #e2e8f0;border-radius:8px}
    table{width:100%;border-collapse:collapse;margin:12px 0;font-size:11px}
    th{background:#0f172a;color:#f8fafc;padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase}
    td{padding:7px 10px;border-bottom:1px solid #f1f5f9}
    .hdr{display:flex;justify-content:space-between;border-bottom:2px solid #0284c7;padding-bottom:12px;margin-bottom:14px}
    @media print{.noprint{display:none}body{background:#fff;padding:0}.page{box-shadow:none;border:none;margin:0;padding:20px}}
  </style></head><body>
  <div class=page>
    <div class=hdr>
      <div>
        <h2 style="margin:0;color:#0f172a;font-size:20px">${co.name||"Site Ledger"}</h2>
        <p style="margin:2px 0;color:#64748b;font-size:11px">${co.addr||""}<br>GSTIN: <b>${co.gst||""}</b></p>
      </div>
      <div style="text-align:right">
        <h3 style="margin:0;color:#0284c7;font-size:16px">DAILY PROGRESS REPORT (DPR)</h3>
        <p style="margin:4px 0;font-weight:700">Date: ${dpr.date}</p>
        <p style="margin:0;color:#64748b;font-size:11px">Weather: <b>${dpr.weather||"Clear"}</b></p>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;background:#f8fafc;padding:12px 14px;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:14px">
      <div>
        <b style="color:#64748b;font-size:10px;text-transform:uppercase">Project / Site Details</b>
        <div style="font-size:13px;font-weight:700;margin-top:2px">${opts.siteName||"—"}</div>
        <div style="color:#475569;font-size:11px">Job Order: <b>${opts.joNo||dpr.jobOrderId||"—"}</b></div>
        <div style="color:#475569;font-size:11px">Client: <b>${opts.clientName||"—"}</b></div>
      </div>
      <div>
        <b style="color:#64748b;font-size:10px;text-transform:uppercase">Field Supervision</b>
        <div style="font-size:13px;font-weight:700;margin-top:2px">Supervisor: ${dpr.supervisor||"—"}</div>
        <div style="color:#475569;font-size:11px">Total Site Workers: <b style="color:#0284c7;font-size:13px">${dpr.workers||0}</b></div>
      </div>
    </div>

    <div style="margin-bottom:14px">
      <div style="font-weight:700;font-size:11px;color:#334155;text-transform:uppercase;margin-bottom:6px">👷 Worker Deployment (Category-wise)</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${catRows}
      </div>
    </div>

    <div style="margin-bottom:14px">
      <div style="font-weight:700;font-size:11px;color:#334155;text-transform:uppercase;margin-bottom:4px">📋 Works Executed Today</div>
      <table>
        <thead><tr><th>#</th><th>Task / Work Description</th><th>Type</th><th style="text-align:right">Executed Qty</th><th>Remarks</th></tr></thead>
        <tbody>${workRows || "<tr><td colspan=5 style='text-align:center;color:#94a3b8'>No task entries recorded</td></tr>"}</tbody>
      </table>
    </div>

    ${matRows?`
    <div style="margin-bottom:14px">
      <div style="font-weight:700;font-size:11px;color:#334155;text-transform:uppercase;margin-bottom:4px">📦 Materials Consumed on Site</div>
      <table>
        <thead><tr><th>#</th><th>Material</th><th style="text-align:right">Consumed Qty</th><th>Source</th></tr></thead>
        <tbody>${matRows}</tbody>
      </table>
    </div>`:""}

    ${dpr.clientInstructions?`
    <div style="margin-bottom:12px;padding:10px 14px;background:#fef3c7;border:1px solid #fde68a;border-radius:6px;font-size:11px;color:#92400e">
      <b>📌 Client / Engineer Instructions:</b> ${dpr.clientInstructions}
    </div>`:""}

    ${dpr.remarks?`
    <div style="margin-bottom:12px;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:11px;color:#475569">
      <b>📝 General Remarks:</b> ${dpr.remarks}
    </div>`:""}

    ${dpr.hasAccident?`
    <div style="margin-bottom:14px;padding:12px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;color:#991b1b">
      <div style="font-weight:700;font-size:12px;margin-bottom:4px">🚨 Site Incident / Accident Report</div>
      <div style="font-size:11px;margin-bottom:4px"><b>Severity:</b> ${dpr.accidentSeverity||"Minor"} | <b>Workers Involved:</b> ${dpr.accidentWorkers||"—"}</div>
      <div style="font-size:11px;margin-bottom:8px"><b>Details:</b> ${dpr.accidentDesc||"—"}</div>
      ${accidentPhotos?`<div><b style="font-size:10px;text-transform:uppercase;color:#b91c1c">Accident Photos:</b><br><div style="margin-top:6px;display:flex;flex-wrap:wrap">${accidentPhotos}</div></div>`:""}
    </div>`:""}

    ${sitePhotos?`
    <div style="margin-bottom:14px">
      <div style="font-weight:700;font-size:11px;color:#334155;text-transform:uppercase;margin-bottom:6px">📷 Site Photos</div>
      <div style="display:flex;flex-wrap:wrap">${sitePhotos}</div>
    </div>`:""}

    <div style="margin-top:36px;display:flex;justify-content:space-between;padding-top:14px;border-top:1px solid #e2e8f0;font-size:10px;color:#64748b">
      <div style="text-align:center"><div style="height:35px"></div>Site Supervisor</div>
      <div style="text-align:center"><div style="height:35px"></div>Project Manager</div>
      <div style="text-align:center"><div style="height:35px"></div>Client Representative</div>
    </div>
  </div>

  <div class=noprint style="text-align:center;padding:16px"><button onclick="window.print()" style="background:#0284c7;color:#fff;border:none;padding:10px 28px;border-radius:6px;font-weight:700;cursor:pointer;margin-right:10px">Print / Save PDF</button><button onclick="window.close()" style="background:#e2e8f0;border:none;padding:10px 20px;border-radius:6px;font-weight:700;cursor:pointer">Close</button></div>
  </body></html>`;

  openPrint(html, "DPR_"+dpr.date);
};

/* ══════════ CONFIDENTIAL COST & PROFIT SHEET GENERATOR ══════════ */
const genConfidentialCostSheet=(qtn,co,opts={})=>{
  const n=v=>Number(v||0).toLocaleString("en-IN");
  const c=cS(qtn);
  const revenue = c.basic || 0;
  const bbsEntries = qtn.bbsEntries || [];
  const totalRebarKg = bbsEntries.reduce((a,b)=>a+(Number(b.totalKg)||0),0);
  const totalRebarMT = (totalRebarKg/1000).toFixed(3);
  const steelRatePerMT = 56000;
  const rebarCost = (totalRebarKg/1000)*steelRatePerMT;
  
  const matCost = Math.round(revenue * 0.45) + Math.round(rebarCost);
  const labCost = Math.round(revenue * 0.25);
  const macCost = Math.round(revenue * 0.10);
  const overheadCost = Math.round(revenue * 0.05);
  const totalDirectCost = matCost + labCost + macCost + overheadCost;
  const grossProfit = Math.max(0, revenue - totalDirectCost);
  const profitMarginPct = revenue ? ((grossProfit / revenue) * 100).toFixed(1) : "0.0";

  const bbsRows = bbsEntries.map((b,i)=>`
    <tr>
      <td>${i+1}</td>
      <td><b>${b.barMark||"—"}</b> (${b.element||"Element"})</td>
      <td style="text-align:center">${b.dia||12} mm</td>
      <td style="text-align:center">${b.shape||"Straight"}</td>
      <td style="text-align:right">${b.numBars||1} × ${b.numMembers||1}</td>
      <td style="text-align:right">${Number(b.cutLength||0).toFixed(3)} m</td>
      <td style="text-align:right;font-weight:700;color:#0284c7">${Number(b.totalKg||0).toFixed(1)} kg</td>
    </tr>
  `).join("") || "<tr><td colspan=7 style='text-align:center;color:#94a3b8'>No BBS schedules recorded</td></tr>";

  const html = `<!DOCTYPE html><html><head><meta charset=utf-8><title>Confidential Cost Sheet - ${qtn.estNo||qtn.qtnNo||qtn.id}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#0f172a;margin:0;padding:24px;background:#f8fafc}
    .page{max-width:880px;margin:0 auto;background:#fff;padding:32px;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:1px solid #cbd5e1;border-radius:8px}
    table{width:100%;border-collapse:collapse;margin:12px 0;font-size:11px}
    th{background:#0f172a;color:#f8fafc;padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase}
    td{padding:7px 10px;border-bottom:1px solid #f1f5f9}
    .conf-banner{background:#b91c1c;color:#fff;padding:8px 14px;border-radius:6px;font-weight:700;font-size:11px;text-align:center;letter-spacing:1px;margin-bottom:16px}
    @media print{.noprint{display:none}body{background:#fff;padding:0}.page{box-shadow:none;border:none;margin:0;padding:20px}}
  </style></head><body>
  <div class=page>
    <div class=conf-banner>🔒 STRICTLY CONFIDENTIAL — FOR INTERNAL MANAGEMENT &amp; OWNER REVIEW ONLY</div>
    
    <div style="display:flex;justify-content:space-between;border-bottom:2px solid #b91c1c;padding-bottom:12px;margin-bottom:14px">
      <div>
        <h2 style="margin:0;color:#0f172a;font-size:20px">${co.name||"Site Ledger"}</h2>
        <p style="margin:2px 0;color:#64748b;font-size:11px">${co.addr||""}<br>Internal Profit &amp; Cost Analysis Document</p>
      </div>
      <div style="text-align:right">
        <h3 style="margin:0;color:#b91c1c;font-size:16px">COST &amp; PROFIT PROJECTION</h3>
        <p style="margin:4px 0;font-weight:700">Ref: ${qtn.estNo||qtn.qtnNo||qtn.id}</p>
        <p style="margin:0;color:#64748b;font-size:11px">Date: ${qtn.date}</p>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;background:#f8fafc;padding:12px 14px;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:16px">
      <div>
        <b style="color:#64748b;font-size:10px;text-transform:uppercase">Client & Project Target</b>
        <div style="font-size:13px;font-weight:700;margin-top:2px">${qtn.client||"—"}</div>
        <div style="color:#475569;font-size:11px">Site: <b>${opts.siteName||"—"}</b></div>
        <div style="color:#475569;font-size:11px">Job Scope: <b>${qtn.desc||"—"}</b></div>
      </div>
      <div>
        <b style="color:#64748b;font-size:10px;text-transform:uppercase">Target Profitability</b>
        <div style="font-size:18px;font-weight:800;color:#059669;margin-top:2px">₹${n(grossProfit)} <span style="font-size:12px;color:#166534">(${profitMarginPct}% Margin)</span></div>
        <div style="color:#475569;font-size:11px">Total Contract Quoted: <b>₹${n(revenue)}</b></div>
      </div>
    </div>

    <div style="margin-bottom:16px">
      <div style="font-weight:700;font-size:11px;color:#0f172a;text-transform:uppercase;margin-bottom:6px">📊 Cost Analysis &amp; Profit Summary</div>
      <table>
        <thead><tr><th>Component</th><th style="text-align:center">Percentage</th><th style="text-align:right">Budget Amount (₹)</th><th>Remarks</th></tr></thead>
        <tbody>
          <tr><td><b>Total Quoted Revenue (Basic)</b></td><td style="text-align:center">100.0%</td><td style="text-align:right;font-weight:700">₹${n(revenue)}</td><td style="color:#64748b">Client Billing Value</td></tr>
          <tr><td>Material Budget (BOM & Steel)</td><td style="text-align:center">~45%</td><td style="text-align:right;color:#0284c7">₹${n(matCost)}</td><td style="color:#64748b">Includes Rebar Steel @ ₹${n(steelRatePerMT)}/MT</td></tr>
          <tr><td>Labour & Subcontract Budget</td><td style="text-align:center">~25%</td><td style="text-align:right;color:#7c3aed">₹${n(labCost)}</td><td style="color:#64748b">Direct skilled & unskilled site wages</td></tr>
          <tr><td>Machinery & Equipment Hire</td><td style="text-align:center">~10%</td><td style="text-align:right;color:#ea580c">₹${n(macCost)}</td><td style="color:#64748b">Fuel, hiring, maintenance</td></tr>
          <tr><td>Site Overheads & Safety Contingency</td><td style="text-align:center">~5%</td><td style="text-align:right;color:#475569">₹${n(overheadCost)}</td><td style="color:#64748b">Site office, electricity, insurance</td></tr>
          <tr style="background:#f1f5f9;font-weight:700"><td>Total Projected Direct Cost</td><td style="text-align:center">${revenue?((totalDirectCost/revenue)*100).toFixed(1):0}%</td><td style="text-align:right;color:#dc2626">₹${n(totalDirectCost)}</td><td>Base Execution Cost</td></tr>
          <tr style="background:#f0fdf4;font-weight:700;font-size:13px"><td style="color:#166534">Projected Net Gross Profit</td><td style="text-align:center;color:#166534">${profitMarginPct}%</td><td style="text-align:right;color:#166534">₹${n(grossProfit)}</td><td style="color:#166534">Executive Clearance Target</td></tr>
        </tbody>
      </table>
    </div>

    <div style="margin-bottom:16px">
      <div style="font-weight:700;font-size:11px;color:#0f172a;text-transform:uppercase;margin-bottom:4px">🔩 Bar Bending Schedule (BBS) Reinforcement Summary</div>
      <div style="font-size:11px;color:#475569;margin-bottom:6px">Total Steel Weight: <b>${totalRebarKg.toFixed(1)} kg (${totalRebarMT} MT)</b> | Projected Rebar Cost: <b>₹${n(rebarCost)}</b></div>
      <table>
        <thead><tr><th>#</th><th>Bar Mark & Element</th><th style="text-align:center">Dia</th><th style="text-align:center">Shape</th><th style="text-align:right">Total Bars</th><th style="text-align:right">Cut Length</th><th style="text-align:right">Total Weight</th></tr></thead>
        <tbody>${bbsRows}</tbody>
      </table>
    </div>

    <div style="margin-top:36px;display:flex;justify-content:space-between;padding-top:16px;border-top:1px solid #e2e8f0;font-size:10px;color:#64748b">
      <div><b>Prepared by:</b> Cost Estimator</div>
      <div><b>Reviewed by:</b> Project Manager</div>
      <div><b>Approved by:</b> Managing Director / Owner</div>
    </div>
  </div>

  <div class=noprint style="text-align:center;padding:16px"><button onclick="window.print()" style="background:#b91c1c;color:#fff;border:none;padding:10px 28px;border-radius:6px;font-weight:700;cursor:pointer;margin-right:10px">Print / Save Confidential PDF</button><button onclick="window.close()" style="background:#e2e8f0;border:none;padding:10px 20px;border-radius:6px;font-weight:700;cursor:pointer">Close</button></div>
  </body></html>`;

  openPrint(html, "CostSheet_"+(qtn.estNo||qtn.qtnNo||qtn.id));
};

/* ══════════ JOB ORDER 2-PAGE PRINT GENERATOR ══════════ */
const genJOPrint=(jo,co,opts={})=>{
  const n=v=>Number(v||0).toLocaleString("en-IN");
  const so = opts.so || {};
  const tasks = jo.tasks || [];
  const totalMat = tasks.reduce((a,t)=>a+(Number(t.matBudget)||0),0);
  const totalLab = tasks.reduce((a,t)=>a+(Number(t.labBudget)||0),0);
  const totalMac = tasks.reduce((a,t)=>a+(Number(t.macBudget)||0),0);
  const grandTotal = totalMat + totalLab + totalMac;

  const page1TaskRows = tasks.map((t,i)=>`
    <tr>
      <td>${i+1}</td>
      <td><b>${t.name||"—"}</b></td>
      <td>${t.phase||"General"}</td>
      <td style="text-align:right;font-weight:700">${t.qty||1} ${t.unit||""}</td>
      <td style="text-align:center">${t.estStartDate||"—"}</td>
      <td style="text-align:center">${t.estEndDate||"—"}</td>
      <td style="text-align:right">₹${n(t.matBudget)}</td>
      <td style="text-align:right">₹${n(t.labBudget)}</td>
      <td style="text-align:right">₹${n(t.macBudget)}</td>
      <td style="text-align:right;font-weight:700">₹${n((Number(t.matBudget)||0)+(Number(t.labBudget)||0)+(Number(t.macBudget)||0))}</td>
    </tr>
  `).join("");

  const wbsTaskRows = tasks.map((t,i)=>{
    const qty = Number(t.qty)||1;
    const cementBags = Math.round(qty * 3.5);
    const sandCft = Math.round(qty * 7.5);
    const aggCft = Math.round(qty * 14);
    const steelKg = Math.round(qty * 18);
    const masonDays = (qty * 0.4).toFixed(1);
    const carpenterDays = (qty * 0.25).toFixed(1);
    const helperDays = (qty * 1.2).toFixed(1);
    const mixerHours = (qty * 0.5).toFixed(1);
    const vibratorHours = (qty * 0.4).toFixed(1);

    return `
      <tr>
        <td style="font-weight:700">${i+1}. ${t.name}</td>
        <td style="text-align:right;font-weight:700">${qty} ${t.unit||""}</td>
        <td>${t.estStartDate||"—"} to ${t.estEndDate||"—"}</td>
        <td style="font-size:10px">Cement: <b>${cementBags} bags</b><br>Sand: <b>${sandCft} cft</b><br>Agg: <b>${aggCft} cft</b><br>Steel: <b>${steelKg} kg</b></td>
        <td style="font-size:10px">Mason: <b>${masonDays} d</b><br>Carpenter: <b>${carpenterDays} d</b><br>Helper: <b>${helperDays} d</b></td>
        <td style="font-size:10px">Mixer: <b>${mixerHours} hrs</b><br>Vibrator: <b>${vibratorHours} hrs</b></td>
      </tr>
    `;
  }).join("");

  const html = `<!DOCTYPE html><html><head><meta charset=utf-8><title>Job Order - ${jo.joNo||jo.id}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#0f172a;margin:0;padding:24px;background:#f8fafc}
    .page{max-width:900px;margin:0 auto 30px;background:#fff;padding:32px;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:1px solid #e2e8f0;border-radius:8px}
    .page2{page-break-before:always;margin-top:30px}
    table{width:100%;border-collapse:collapse;margin:12px 0;font-size:11px}
    th{background:#0f172a;color:#f8fafc;padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase}
    td{padding:7px 10px;border-bottom:1px solid #f1f5f9}
    .hdr{display:flex;justify-content:space-between;border-bottom:2px solid #7c3aed;padding-bottom:12px;margin-bottom:14px}
    @media print{.noprint{display:none}body{background:#fff;padding:0}.page{box-shadow:none;border:none;margin:0;padding:20px}}
  </style></head><body>
  <div class=page>
    <div class=hdr>
      <div>
        <h2 style="margin:0;color:#0f172a;font-size:20px">${co.name||"Site Ledger"}</h2>
        <p style="margin:2px 0;color:#64748b;font-size:11px">${co.addr||""}<br>GSTIN: <b>${co.gst||""}</b></p>
      </div>
      <div style="text-align:right">
        <h3 style="margin:0;color:#7c3aed;font-size:16px">PROJECT JOB ORDER</h3>
        <p style="margin:4px 0;font-family:monospace;font-weight:700;font-size:14px">${jo.joNo||jo.id}</p>
        <p style="margin:0;color:#64748b;font-size:11px">Date: ${jo.date}</p>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;background:#f8fafc;padding:12px 14px;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:14px">
      <div>
        <b style="color:#64748b;font-size:10px;text-transform:uppercase">Project & Site</b>
        <div style="font-size:13px;font-weight:700;margin-top:2px">${opts.siteName||"—"}</div>
        <div style="color:#475569;font-size:11px">Client: <b>${opts.clientName||so.client||"—"}</b></div>
        <div style="color:#475569;font-size:11px">Sale Order Ref: <b>${so.soNo||jo.soId||"—"}</b></div>
      </div>
      <div>
        <b style="color:#64748b;font-size:10px;text-transform:uppercase">Budgets Summary</b>
        <div style="font-size:16px;font-weight:800;color:#7c3aed;margin-top:2px">₹${n(grandTotal)}</div>
        <div style="color:#475569;font-size:11px">Mat: <b>₹${n(totalMat)}</b> | Lab: <b>₹${n(totalLab)}</b> | Mac: <b>₹${n(totalMac)}</b></div>
      </div>
    </div>

    ${jo.specialInstructions?`
    <div style="margin-bottom:12px;padding:10px 14px;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:6px;font-size:11px;color:#5b21b6">
      <b>📌 Special Instructions / Guidelines:</b> ${jo.specialInstructions}
    </div>`:""}

    <div style="margin-bottom:14px">
      <div style="font-weight:700;font-size:11px;color:#0f172a;text-transform:uppercase;margin-bottom:4px">📋 Task Breakdown &amp; Budgets</div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Task Description</th>
            <th>Phase</th>
            <th style="text-align:right">Exec Qty</th>
            <th style="text-align:center">Start</th>
            <th style="text-align:center">End</th>
            <th style="text-align:right">Mat (₹)</th>
            <th style="text-align:right">Lab (₹)</th>
            <th style="text-align:right">Mac (₹)</th>
            <th style="text-align:right">Total (₹)</th>
          </tr>
        </thead>
        <tbody>${page1TaskRows}</tbody>
        <tfoot>
          <tr style="background:#0f172a;color:#fff;font-weight:700">
            <td colspan=6 style="text-align:right;color:#a78bfa">Total Budget:</td>
            <td style="text-align:right">₹${n(totalMat)}</td>
            <td style="text-align:right">₹${n(totalLab)}</td>
            <td style="text-align:right">₹${n(totalMac)}</td>
            <td style="text-align:right;color:#a78bfa">₹${n(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div style="margin-top:36px;display:flex;justify-content:space-between;padding-top:16px;border-top:1px solid #e2e8f0;font-size:10px;color:#64748b">
      <div>Project In-charge</div>
      <div>Site Engineer</div>
      <div>Managing Director</div>
    </div>
  </div>

  <!-- PAGE 2: WORK BREAKDOWN STRUCTURE (WBS) -->
  <div class="page page2">
    <div class=hdr>
      <div>
        <h2 style="margin:0;color:#0f172a;font-size:18px">WORK BREAKDOWN STRUCTURE (WBS)</h2>
        <p style="margin:2px 0;color:#64748b;font-size:11px">Detailed Engineering &amp; Resource Breakdown — Job Order: <b>${jo.joNo||jo.id}</b></p>
      </div>
      <div style="text-align:right;color:#7c3aed;font-weight:700">Page 2 — WBS Analysis</div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:#f8fafc;padding:10px 14px;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:14px;font-size:11px">
      <div>
        <div><b>Name of Job:</b> ${so.desc||opts.jobName||"—"}</div>
        <div><b>Client Details:</b> ${opts.clientName||so.client||"—"} (${opts.clientGst||"—"})</div>
        <div><b>Site Details:</b> ${opts.siteName||"—"}</div>
      </div>
      <div>
        <div><b>Our Job Order No. &amp; Date:</b> ${jo.joNo||jo.id} dt. ${jo.date}</div>
        <div><b>Client Work Order No. &amp; Date:</b> ${so.clientWONo||"Pending"} ${so.clientWODate?"dt. "+so.clientWODate:""}</div>
        <div><b>Sale Order Ref:</b> ${so.soNo||jo.soId||"—"}</div>
      </div>
    </div>

    <div style="margin-bottom:14px">
      <div style="font-weight:700;font-size:11px;color:#0f172a;text-transform:uppercase;margin-bottom:4px">🏗 BOQ, BOM &amp; Resource Quantity Estimation</div>
      <table>
        <thead>
          <tr>
            <th>BOQ Task Item</th>
            <th style="text-align:right">BOQ Qty</th>
            <th>Duration</th>
            <th>BOM Material Est. (Calculated)</th>
            <th>Labour Estimation (Man-Days)</th>
            <th>Machinery Estimation (Hours)</th>
          </tr>
        </thead>
        <tbody>${wbsTaskRows}</tbody>
      </table>
    </div>

    <div style="margin-top:20px;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:11px">
      <b>BBS Reinforcement Drawings &amp; Schedules:</b> As detailed in linked Quotation / Sale Order schedule. All rebar cutting &amp; bending strictly in accordance with IS:2502 code of practice.
    </div>

    <div style="margin-top:36px;display:flex;justify-content:space-between;padding-top:16px;border-top:1px solid #e2e8f0;font-size:10px;color:#64748b">
      <div>Planning Engineer</div>
      <div>Project Manager</div>
      <div>Quality Assurance Lead</div>
    </div>
  </div>

  <div class=noprint style="text-align:center;padding:16px"><button onclick="window.print()" style="background:#7c3aed;color:#fff;border:none;padding:10px 28px;border-radius:6px;font-weight:700;cursor:pointer;margin-right:10px">Print 2-Page Job Order</button><button onclick="window.close()" style="background:#e2e8f0;border:none;padding:10px 20px;border-radius:6px;font-weight:700;cursor:pointer">Close</button></div>
  </body></html>`;

  openPrint(html, "JobOrder_"+(jo.joNo||jo.id));
};

const downloadDocx=(filename="Site_Ledger_Report.docx",htmlContent="")=>{
  const header="<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><title>Document</title><style>body{font-family:Calibri,Arial;font-size:11pt;margin:1in}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:6px}</style></head><body>";
  const footer="</body></html>";
  const blob=new Blob(['\ufeff'+header+htmlContent+footer],{type:'application/msword'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();
};

const downloadXlsx=(filename="Site_Ledger_Data.xlsx",csvContent="")=>{
  const blob=new Blob(['\ufeff'+csvContent],{type:'application/vnd.ms-excel;charset=utf-8;'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();
};

const downloadPptx=(filename="Site_Ledger_Presentation.html",slidesHtml="")=>{
  const blob=new Blob(['\ufeff'+slidesHtml],{type:'text/html'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();
};

/* ══════════ DESIGN SYSTEM ══════════ */
const ss={
  card:{background:C.cd,borderRadius:10,border:BD,boxShadow:C.isLight?"0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)":"0 4px 20px rgba(0,0,0,.35)"},
  th:{padding:"10px 12px",color:C.isLight?"#0F172A":"#F8FAFC",fontSize:11,fontFamily:"inherit",fontWeight:700,textAlign:"left",borderBottom:"2px solid "+C.br,borderRight:"1px solid "+C.br,whiteSpace:"nowrap",textTransform:"uppercase",letterSpacing:0.5,background:C.isLight?"#F1F5F9":"#162032"},
  td:{padding:"9px 12px",fontSize:12,color:C.text,borderBottom:"1px solid "+C.br,borderRight:"1px solid "+C.br,lineHeight:1.5,fontWeight:500},
  inp:{background:C.isLight?"#FFFFFF":"#0B0F19",border:"1px solid "+C.br,borderRadius:6,color:C.text,padding:"8px 10px",fontSize:12,width:"100%",marginBottom:8,outline:"none",boxSizing:"border-box",fontFamily:"inherit",transition:"border-color .15s"},
  lbl:{display:"block",color:C.textSub,fontSize:10,fontFamily:"inherit",marginBottom:3,letterSpacing:0.5,textTransform:"uppercase",fontWeight:700},
};
const TT={background:C.isLight?"#FFFFFF":"#0A1223",border:BD,borderRadius:8,fontSize:11,color:C.text};

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

function Login({onLogin}){
  const[u,setU]=useState("");
  const[p,setP]=useState("");
  const[err,setErr]=useState("");
  const go=()=>{
    const m = loadMasters() || INIT_M;
    const users = (m && m.users && m.users.length) ? m.users : INIT_M.users;
    const usr = users.find(x => (x.username||"").trim().toLowerCase() === (u||"").trim().toLowerCase() && x.password === p);
    if(usr) onLogin(usr);
    else setErr("Invalid credentials");
  };
  return <div style={{minHeight:"100vh",background:`radial-gradient(ellipse at 20% 50%,#0F1D33,${C.dk})`,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(circle at 2px 2px,rgba(96,165,250,.04) 1px,transparent 0)",backgroundSize:"32px 32px",pointerEvents:"none"}}/><div style={{...ss.card,padding:44,width:400,textAlign:"center",boxShadow:"0 32px 80px rgba(0,0,0,.7)",position:"relative",background:"linear-gradient(135deg,#0E1628,#0A1223)"}}><div style={{position:"absolute",top:-1,left:"50%",transform:"translateX(-50%)",width:"60%",height:2,background:"linear-gradient(90deg,transparent,#F59E0B,transparent)",borderRadius:2}}/><div style={{width:64,height:64,background:"linear-gradient(135deg,rgba(245,158,11,.2),rgba(245,158,11,.05))",borderRadius:16,border:"1px solid rgba(245,158,11,.3)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:30}}>🏗</div><div style={{color:C.or,fontFamily:"monospace",fontWeight:800,fontSize:26,letterSpacing:4,marginBottom:4}}>SITE LEDGER</div><div style={{color:"#334155",fontSize:11,marginBottom:32,letterSpacing:1}}>v12 — Civil Contractor ERP</div><div style={{textAlign:"left",background:"#060C1A",borderRadius:10,padding:16,border:BD}}><F label="Username"><Inp val={u} onChange={setU} placeholder="Username"/></F><F label="Password"><input type="password" style={{...ss.inp,marginBottom:0}} value={p} onChange={e=>setP(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="Password"/></F></div>{err&&<div style={{color:C.rd,fontSize:11,margin:"10px 0",padding:"8px 12px",background:"rgba(248,113,113,.08)",borderRadius:7,border:"1px solid rgba(248,113,113,.2)"}}>{err}</div>}<div style={{marginTop:14}}><Btn full onClick={go}>LOGIN →</Btn></div></div></div>;
}

const INIT_WC=[
  {id:"wc1",siteId:"s1",policyNo:"WC/2025/001",insurer:"New India Assurance",sumAssured:5000000,premium:25000,startDate:"2025-04-01",expiryDate:"2026-03-31"},
  {id:"wc2",siteId:"s2",policyNo:"WC/2025/002",insurer:"Oriental Insurance",sumAssured:3000000,premium:15000,startDate:"2025-04-01",expiryDate:"2026-03-31"},
];

function BackupRestoreModal({isOpen, onClose, data, setData, masters, setMasters, settings, setSettings, isEmergency, user}){
  const [activeTab, setActiveTab] = useState("file");
  const [snapshots, setSnapshots] = useState(getSnapshots);
  const [snapLabel, setSnapLabel] = useState("");
  const [pasteCode, setPasteCode] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [previewData, setPreviewData] = useState(null);

  const refreshSnaps = () => setSnapshots(getSnapshots());

  const handleDownloadJson = () => {
    const meta = {
      exportedAt: new Date().toISOString(),
      version: "v12",
      appName: "Site Ledger ERP",
      user: (user||{}).name || "Admin",
      records: {
        sales: (data.sales||[]).length,
        purchases: (data.purchases||[]).length,
        jobOrders: (data.jobOrders||[]).length,
        dpr: (data.dpr||[]).length,
        vouchers: (data.vouchers||[]).length,
        sites: (masters.sites||[]).length,
        users: (masters.users||[]).length,
      }
    };
    const backupObj = { meta, data, masters, settings };
    const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    const dStr = new Date().toISOString().slice(0,10);
    const tStr = new Date().toTimeString().slice(0,5).replace(":", "-");
    a.href = URL.createObjectURL(blob);
    a.download = `SiteLedger_Backup_${dStr}_${tStr}.json`;
    a.click();
    setStatusMsg("Backup JSON downloaded successfully.");
  };

  const handleFileSelect = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!parsed.data && !parsed.masters) {
          alert("Invalid backup file format: missing data or masters.");
          return;
        }
        setPreviewData(parsed);
      } catch (err) {
        alert("Failed to parse JSON backup file: " + err.message);
      }
    };
    reader.readAsText(f);
  };

  const applyRestoration = (backupObj, mode = "overwrite") => {
    try {
      saveSnapshot("Safety auto-save before restore");
      let nextData = data;
      let nextMasters = masters;
      let nextSettings = settings;

      if (mode === "overwrite") {
        if (backupObj.data) nextData = backupObj.data;
        if (backupObj.masters) nextMasters = backupObj.masters;
        if (backupObj.settings) nextSettings = backupObj.settings;
      } else {
        if (backupObj.data) {
          nextData = { ...data };
          Object.keys(backupObj.data).forEach(k => {
            if (Array.isArray(backupObj.data[k])) {
              const existingIds = new Set((nextData[k]||[]).map(x=>x.id));
              const newItems = backupObj.data[k].filter(x=>!existingIds.has(x.id));
              nextData[k] = [...(nextData[k]||[]), ...newItems];
            }
          });
        }
        if (backupObj.masters) {
          nextMasters = { ...masters };
          Object.keys(backupObj.masters).forEach(k => {
            if (Array.isArray(backupObj.masters[k])) {
              const existingKeys = new Set((nextMasters[k]||[]).map(x=>x.id||x.name));
              const newItems = backupObj.masters[k].filter(x=>!existingKeys.has(x.id||x.name));
              nextMasters[k] = [...(nextMasters[k]||[]), ...newItems];
            }
          });
        }
      }

      setData(nextData);
      persistData(nextData);
      setMasters(nextMasters);
      persistMasters(nextMasters);
      if (backupObj.settings) {
        setSettings(nextSettings);
        saveSettings(nextSettings);
      }
      refreshSnaps();
      setPreviewData(null);
      alert("✅ Data successfully restored! Changes have been permanently saved.");
      if (isEmergency) window.location.reload();
      else onClose();
    } catch (e) {
      alert("Error restoring data: " + e.message);
    }
  };

  const handleTakeSnapshot = () => {
    const lbl = snapLabel.trim() || ("Checkpoint " + new Date().toLocaleTimeString());
    const res = saveSnapshot(lbl, data, masters, settings);
    if (res) {
      setSnapLabel("");
      refreshSnaps();
      setStatusMsg("Local snapshot checkpoint created successfully!");
    }
  };

  const handleCopyClipboard = () => {
    const payload = JSON.stringify({
      meta: { exportedAt: new Date().toISOString(), type: "clipboard" },
      data,
      masters,
      settings
    });
    navigator.clipboard.writeText(payload).then(()=>{
      setStatusMsg("Full backup copied to clipboard! You can paste and save it anywhere.");
      alert("✅ System backup copied to clipboard! You can send it via email/chat or store it safely.");
    }).catch(()=>{
      alert("Clipboard access not available in this browser context.");
    });
  };

  const handlePasteRestore = () => {
    if (!pasteCode.trim()) return alert("Please paste backup code first.");
    try {
      const parsed = JSON.parse(pasteCode.trim());
      applyRestoration(parsed, "overwrite");
    } catch (e) {
      alert("Invalid backup string: " + e.message);
    }
  };

  const handleExportCsv = (type) => {
    const exportMap = {
      sales: { name: "Sales_Invoices.csv", arr: data.sales },
      purchases: { name: "Purchase_Bills.csv", arr: data.purchases },
      dpr: { name: "DPR_Daily_Progress.csv", arr: data.dpr },
      jobOrders: { name: "Job_Orders.csv", arr: data.jobOrders },
      inventory: { name: "Inventory_Stock.csv", arr: data.inventory },
      attendance: { name: "HR_Attendance.csv", arr: data.attendance },
      vouchers: { name: "Vouchers_Ledger.csv", arr: data.vouchers },
      sites: { name: "Masters_Sites.csv", arr: masters.sites },
      clients: { name: "Masters_Clients.csv", arr: masters.clients },
      vendors: { name: "Masters_Vendors.csv", arr: masters.vendors },
      items: { name: "Masters_Items.csv", arr: masters.items },
      services: { name: "Masters_Services.csv", arr: masters.services },
    };
    const item = exportMap[type];
    if (!item || !item.arr || !item.arr.length) return alert("No records available to export for " + type);
    const keys = Object.keys(item.arr[0]);
    const lines = [
      keys.join(","),
      ...item.arr.map(row => keys.map(k => {
        let val = row[k];
        if (typeof val === "object" && val !== null) val = JSON.stringify(val);
        val = String(val ?? "").replace(/"/g, '""');
        return `"${val}"`;
      }).join(","))
    ];
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = item.name;
    a.click();
    setStatusMsg(`Downloaded ${item.name}`);
  };

  const bTabs = [
    { id: "file", label: "📦 File Backup & Restore", icon: "📁" },
    { id: "snapshots", label: `📸 Local Snapshots (${snapshots.length})`, icon: "⚡" },
    { id: "clipboard", label: "📋 Clipboard / Code", icon: "📋" },
    { id: "csv", label: "📊 Excel / CSV Packs", icon: "📊" },
    { id: "reset", label: "⚠️ Disaster Recovery & Reset", icon: "🛠" },
  ];

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(2,6,23,0.85)",backdropFilter:"blur(6px)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{...ss.card,width:800,maxWidth:"96vw",maxHeight:"90vh",display:"flex",flexDirection:"column",background:"#08101E",border:"1px solid "+C.or,boxShadow:"0 25px 60px rgba(0,0,0,0.8)",borderRadius:12,overflow:"hidden"}}>
        <div style={{padding:"16px 20px",borderBottom:"1px solid #1E2D45",display:"flex",alignItems:"center",justifyContent:"space-between",background:"linear-gradient(90deg,#0A152A,#060D1A)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:22}}>💾</span>
            <div>
              <div style={{color:C.or,fontWeight:800,fontSize:15,fontFamily:"monospace",letterSpacing:1}}>
                {isEmergency ? "DISASTER RECOVERY & SYSTEM RESTORE" : "BACKUP & RESTORE DATA MANAGEMENT"}
              </div>
              <div style={{color:C.gr,fontSize:10}}>Complete Data Persistence, Checkpoints & Export Engine</div>
            </div>
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:C.si,fontSize:18,cursor:"pointer",fontWeight:700}}>✕</button>
        </div>

        <div style={{display:"flex",background:"#060B14",borderBottom:"1px solid #16233B",overflowX:"auto"}}>
          {bTabs.map(t=>{
            const active = activeTab === t.id;
            return (
              <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
                padding:"10px 16px",
                background:active?"linear-gradient(180deg,#0F1E38,#0A152A)":"transparent",
                border:"none",
                borderBottom:active?("2px solid "+C.or):"2px solid transparent",
                color:active?C.or:C.si,
                cursor:"pointer",
                fontFamily:"monospace",
                fontSize:11,
                fontWeight:active?700:400,
                display:"flex",
                alignItems:"center",
                gap:6,
                whiteSpace:"nowrap"
              }}>
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{flex:1,overflowY:"auto",padding:20}}>
          {statusMsg && (
            <div style={{marginBottom:14,padding:"8px 14px",borderRadius:6,background:G(C.gn,0.1),border:"1px solid "+G(C.gn,0.3),color:C.gn,fontSize:11,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span>{statusMsg}</span>
              <button onClick={()=>setStatusMsg("")} style={{background:"none",border:"none",color:C.gn,cursor:"pointer",fontSize:10}}>✕</button>
            </div>
          )}

          {activeTab==="file" && <div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <div style={{...ss.card,padding:16,background:"#0B1526",border:"1px solid #1E2D45"}}>
                <div style={{color:C.tl,fontWeight:700,fontSize:13,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                  <span>⬇</span> <span>Download Full System Image</span>
                </div>
                <div style={{color:C.si,fontSize:11,lineHeight:1.5,marginBottom:14}}>
                  Creates a complete, uncompressed JSON backup containing all project transactions, financial ledgers, job orders, DPR logs, input rates, and master databases.
                </div>
                <div style={{background:"#060C18",padding:10,borderRadius:6,border:"1px solid #142238",marginBottom:14,fontSize:10,color:C.gr}}>
                  <div>• Sales & Orders: {(data.sales||[]).length + (data.saleOrders||[]).length} records</div>
                  <div>• Purchases & Bills: {(data.purchases||[]).length + (data.purchaseOrders||[]).length} records</div>
                  <div>• Job Orders & DPRs: {(data.jobOrders||[]).length + (data.dpr||[]).length} records</div>
                  <div>• Masters (Sites, Clients, Items...): {Object.values(masters).reduce((a,b)=>a+(Array.isArray(b)?b.length:0),0)} records</div>
                </div>
                <Btn full onClick={handleDownloadJson} color={C.tl} icon="⬇">Download JSON Backup</Btn>
              </div>

              <div style={{...ss.card,padding:16,background:"#0B1526",border:"1px solid #1E2D45"}}>
                <div style={{color:C.gn,fontWeight:700,fontSize:13,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                  <span>⬆</span> <span>Restore From Backup File</span>
                </div>
                <div style={{color:C.si,fontSize:11,lineHeight:1.5,marginBottom:14}}>
                  Upload any previously downloaded <code style={{color:C.or}}>.json</code> backup file to restore records. A safety checkpoint is automatically created before applying changes.
                </div>
                <label style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"10px 16px",borderRadius:8,border:`1px dashed ${C.gn}`,background:G(C.gn,0.08),color:C.gn,cursor:"pointer",fontFamily:"monospace",fontSize:12,fontWeight:700,marginBottom:12}}>
                  <span>📂</span> Click to Browse / Select Backup JSON
                  <input type="file" accept=".json" style={{display:"none"}} onChange={handleFileSelect}/>
                </label>
                {previewData && (
                  <div style={{background:"#060C18",padding:12,borderRadius:8,border:"1px solid "+C.or}}>
                    <div style={{color:C.or,fontWeight:700,fontSize:11,marginBottom:6}}>🔍 Backup File Verification</div>
                    <div style={{color:C.si,fontSize:10,marginBottom:10}}>
                      Exported At: <b>{(previewData.meta||{}).exportedAt || "Unknown date"}</b><br/>
                      Sales: {(previewData.data?.sales||[]).length} | Purchases: {(previewData.data?.purchases||[]).length} | DPR: {(previewData.data?.dpr||[]).length} | Sites: {(previewData.masters?.sites||[]).length}
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>applyRestoration(previewData, "overwrite")} style={{flex:1,padding:"7px 10px",borderRadius:6,background:C.gn,color:"#000",border:"none",fontWeight:700,cursor:"pointer",fontSize:11}}>
                        ✓ Full Overwrite Restore
                      </button>
                      <button onClick={()=>applyRestoration(previewData, "merge")} style={{flex:1,padding:"7px 10px",borderRadius:6,background:G(C.bl,0.2),color:C.bl,border:"1px solid "+C.bl,fontWeight:700,cursor:"pointer",fontSize:11}}>
                        🔄 Smart Merge
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>}

          {activeTab==="snapshots" && <div>
            <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center"}}>
              <input
                style={{...ss.inp,marginBottom:0,flex:1}}
                placeholder="Snapshot label (e.g. 'Before submitting tender quote' or 'End of Week')..."
                value={snapLabel}
                onChange={e=>setSnapLabel(e.target.value)}
              />
              <Btn onClick={handleTakeSnapshot} color={C.or} icon="📸">Save Snapshot Now</Btn>
            </div>

            <div style={{...ss.card,padding:0,overflow:"hidden",background:"#091122",border:"1px solid #1E2D45"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead>
                  <tr style={{background:"#060C1A",borderBottom:"1px solid #1E2D45"}}>
                    <th style={{...ss.th,padding:"10px 12px"}}>Snapshot Name</th>
                    <th style={{...ss.th,padding:"10px 12px"}}>Timestamp</th>
                    <th style={{...ss.th,padding:"10px 12px"}}>Records</th>
                    <th style={{...ss.th,padding:"10px 12px",textAlign:"right"}}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.length===0 && (
                    <tr>
                      <td colSpan={4} style={{padding:24,textAlign:"center",color:C.gr}}>
                        No saved checkpoints found in this browser. Take a snapshot to create an instant rollback point!
                      </td>
                    </tr>
                  )}
                  {snapshots.map(s=>(
                    <tr key={s.id} style={{borderBottom:"1px solid #142238"}}>
                      <td style={{...ss.td,fontWeight:700,color:"#F1F5F9"}}>{s.label}</td>
                      <td style={{...ss.td,color:C.si,fontFamily:"monospace"}}>{new Date(s.date).toLocaleString()}</td>
                      <td style={{...ss.td,color:C.tl}}>{s.recordCount} records</td>
                      <td style={{...ss.td,textAlign:"right"}}>
                        <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                          <button onClick={()=>{
                            if (window.confirm(`Restore state to "${s.label}"? Your current data will be saved to a pre-restore checkpoint first.`)) {
                              applyRestoration(s.payload, "overwrite");
                            }
                          }} style={{padding:"4px 8px",borderRadius:4,background:G(C.gn,0.15),border:"1px solid "+C.gn,color:C.gn,cursor:"pointer",fontSize:10,fontWeight:700}}>
                            ⚡ Restore
                          </button>
                          <button onClick={()=>{
                            const blob = new Blob([JSON.stringify(s.payload, null, 2)], { type: "application/json" });
                            const a = document.createElement("a");
                            a.href = URL.createObjectURL(blob);
                            a.download = `Snapshot_${s.label.replace(/\s+/g,"_")}_${s.id}.json`;
                            a.click();
                          }} style={{padding:"4px 8px",borderRadius:4,background:G(C.bl,0.15),border:"1px solid "+C.bl,color:C.bl,cursor:"pointer",fontSize:10}}>
                            ⬇ Download
                          </button>
                          <button onClick={()=>{
                            if (window.confirm(`Delete snapshot checkpoint "${s.label}"?`)) {
                              deleteSnapshot(s.id);
                              refreshSnaps();
                            }
                          }} style={{padding:"4px 8px",borderRadius:4,background:G(C.rd,0.15),border:"1px solid "+C.rd,color:C.rd,cursor:"pointer",fontSize:10}}>
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>}

          {activeTab==="clipboard" && <div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <div style={{...ss.card,padding:16,background:"#0B1526",border:"1px solid #1E2D45"}}>
                <div style={{color:C.pu,fontWeight:700,fontSize:13,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                  <span>📋</span> <span>Copy Backup Code</span>
                </div>
                <div style={{color:C.si,fontSize:11,lineHeight:1.5,marginBottom:12}}>
                  Copies the entire ERP database into a single encoded string. Ideal for instantly copying into an email, WhatsApp note, or Google Drive document without needing file storage.
                </div>
                <Btn full onClick={handleCopyClipboard} color={C.pu} icon="📋">Copy Backup String to Clipboard</Btn>
              </div>

              <div style={{...ss.card,padding:16,background:"#0B1526",border:"1px solid #1E2D45"}}>
                <div style={{color:C.or,fontWeight:700,fontSize:13,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                  <span>📥</span> <span>Paste &amp; Restore</span>
                </div>
                <div style={{color:C.si,fontSize:11,lineHeight:1.5,marginBottom:8}}>
                  Paste a previously copied backup string into the box below and click restore.
                </div>
                <textarea
                  rows={4}
                  style={{width:"100%",background:"#060C18",border:"1px solid #1E2D45",borderRadius:6,padding:8,color:"#F1F5F9",fontSize:10,fontFamily:"monospace",marginBottom:10,boxSizing:"border-box",outline:"none"}}
                  placeholder="Paste backup string here..."
                  value={pasteCode}
                  onChange={e=>setPasteCode(e.target.value)}
                />
                <Btn full onClick={handlePasteRestore} color={C.or} icon="🔄">Restore from Pasted Code</Btn>
              </div>
            </div>
          </div>}

          {activeTab==="csv" && <div>
            <div style={{color:C.si,fontSize:11,marginBottom:14}}>
              Export individual transactional tables or master modules directly to standard <b>Comma-Separated Values (CSV)</b> format compatible with Microsoft Excel, Google Sheets, Tally, and Zoho.
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:12}}>
              {[
                { id: "sales", title: "Sales Invoices", icon: "💰", color: C.gn, count: (data.sales||[]).length },
                { id: "purchases", title: "Purchases & Bills", icon: "🛒", color: C.rd, count: (data.purchases||[]).length },
                { id: "dpr", title: "Daily Progress (DPR)", icon: "📋", color: C.bl, count: (data.dpr||[]).length },
                { id: "jobOrders", title: "Job Orders & WBS", icon: "🏗", color: C.or, count: (data.jobOrders||[]).length },
                { id: "inventory", title: "Inventory Stock", icon: "📦", color: "#FB923C", count: (data.inventory||[]).length },
                { id: "attendance", title: "HR Attendance", icon: "👷", color: C.pu, count: (data.attendance||[]).length },
                { id: "vouchers", title: "Vouchers & Cash", icon: "🏦", color: C.tl, count: (data.vouchers||[]).length },
                { id: "sites", title: "Project Sites Master", icon: "📍", color: C.bl, count: (masters.sites||[]).length },
                { id: "clients", title: "Clients Master", icon: "🏢", color: C.gn, count: (masters.clients||[]).length },
                { id: "vendors", title: "Vendors Master", icon: "🚛", color: C.rd, count: (masters.vendors||[]).length },
                { id: "items", title: "Items Master", icon: "🧱", color: C.or, count: (masters.items||[]).length },
                { id: "services", title: "Services Master", icon: "🛠", color: C.pu, count: (masters.services||[]).length },
              ].map(card=>(
                <div key={card.id} style={{...ss.card,padding:14,background:"#0B1526",border:"1px solid #1E2D45",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{color:card.color,fontWeight:700,fontSize:12,display:"flex",alignItems:"center",gap:6}}>
                      <span>{card.icon}</span> <span>{card.title}</span>
                    </div>
                    <div style={{color:C.gr,fontSize:10,marginTop:2}}>{card.count} records</div>
                  </div>
                  <button onClick={()=>handleExportCsv(card.id)} style={{padding:"6px 12px",borderRadius:6,background:G(card.color,0.12),border:"1px solid "+card.color,color:card.color,fontSize:11,cursor:"pointer",fontFamily:"monospace",fontWeight:700}}>
                    CSV ⬇
                  </button>
                </div>
              ))}
            </div>
            <div style={{marginTop:16,textAlign:"center"}}>
              <Btn onClick={()=>{
                ["sales","purchases","dpr","jobOrders","inventory","attendance","vouchers","sites","clients","vendors","items","services"].forEach(k=>handleExportCsv(k));
              }} color={C.tl} icon="📦">Export All Tables to CSV in 1-Click</Btn>
            </div>
          </div>}

          {activeTab==="reset" && <div>
            <div style={{...ss.card,padding:16,background:"#0B1526",border:"1px solid #1E2D45",marginBottom:16}}>
              <div style={{color:C.or,fontWeight:700,fontSize:13,marginBottom:8}}>📊 Browser Storage &amp; Database Health</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,fontSize:11}}>
                <div style={{background:"#060C18",padding:10,borderRadius:6}}>
                  <div style={{color:C.gr,fontSize:9}}>TRANSACTION RECORDS</div>
                  <div style={{color:C.gn,fontSize:16,fontWeight:800,fontFamily:"monospace"}}>{Object.values(data).reduce((a,b)=>a+(Array.isArray(b)?b.length:0),0)}</div>
                </div>
                <div style={{background:"#060C18",padding:10,borderRadius:6}}>
                  <div style={{color:C.gr,fontSize:9}}>MASTER RECORDS</div>
                  <div style={{color:C.bl,fontSize:16,fontWeight:800,fontFamily:"monospace"}}>{Object.values(masters).reduce((a,b)=>a+(Array.isArray(b)?b.length:0),0)}</div>
                </div>
                <div style={{background:"#060C18",padding:10,borderRadius:6}}>
                  <div style={{color:C.gr,fontSize:9}}>SAVED CHECKPOINTS</div>
                  <div style={{color:C.pu,fontSize:16,fontWeight:800,fontFamily:"monospace"}}>{snapshots.length}</div>
                </div>
                <div style={{background:"#060C18",padding:10,borderRadius:6}}>
                  <div style={{color:C.gr,fontSize:9}}>STORAGE STATUS</div>
                  <div style={{color:C.tl,fontSize:16,fontWeight:800,fontFamily:"monospace"}}>Online &amp; Sync</div>
                </div>
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <div style={{...ss.card,padding:16,background:G(C.rd,0.06),border:"1px solid "+G(C.rd,0.3)}}>
                <div style={{color:C.rd,fontWeight:700,fontSize:13,marginBottom:6}}>🗑 Clear Transactions Only</div>
                <div style={{color:C.si,fontSize:11,marginBottom:12}}>
                  Resets invoices, bills, DPR, and financial vouchers to clean zero, but keeps all Sites, Clients, Vendors, Items, and Rates intact.
                </div>
                <Btn full onClick={()=>{
                  if (window.confirm("Are you sure you want to clear transactions? A safety snapshot will be created automatically.")) {
                    saveSnapshot("Pre-reset transactions backup");
                    setData(INIT_D);
                    persistData(INIT_D);
                    refreshSnaps();
                    alert("Transactions reset to initial state. Masters preserved.");
                  }
                }} color={C.rd} icon="🗑">Clear Transactions (Keep Masters)</Btn>
              </div>

              <div style={{...ss.card,padding:16,background:G(C.or,0.06),border:"1px solid "+G(C.or,0.3)}}>
                <div style={{color:C.or,fontWeight:700,fontSize:13,marginBottom:6}}>🏭 Factory Reset Sample Data</div>
                <div style={{color:C.si,fontSize:11,marginBottom:12}}>
                  Restores original initial sample data for both transactions and masters. Creates a safety backup before resetting.
                </div>
                <Btn full onClick={()=>{
                  if (window.confirm("Reset entire system to factory sample data? An automatic safety snapshot will be saved first.")) {
                    saveSnapshot("Pre-factory reset backup");
                    setData(INIT_D);
                    persistData(INIT_D);
                    setMasters(INIT_M);
                    persistMasters(INIT_M);
                    refreshSnaps();
                    alert("System restored to initial sample state.");
                  }
                }} color={C.or} icon="🏭">Factory Reset Sample Data</Btn>
              </div>
            </div>
          </div>}
        </div>
      </div>
    </div>
  );
}

export default function App(){
  const[user,setUser]=useState(getSessionUser);
  const[settings,setSettings]=useState(getSettings);
  const[showEmergencyRestore,setShowEmergencyRestore]=useState(false);

  const handleLogin=(u)=>{
    saveSessionUser(u);
    setUser(u);
  };

  const handleLogout=()=>{
    saveSnapshot("Auto-Save before Logout");
    clearSessionUser();
    setUser(null);
  };

  if(!user) return <Login onLogin={handleLogin}/>;

  return <Main user={user} onLogout={handleLogout} settings={settings} setSettings={v=>{setSettings(v);saveSettings(v);}}/>;
};

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
  {id:"sitedocs",l:"Site Docs",icon:"📁",color:"#60A5FA",desc:"Drawings & Office Docs"},
  {id:"masters",l:"Masters",icon:"⚙",color:"#64748B",desc:"Master Data"},
  {id:"settings",l:"Settings",icon:"🎨",color:"#94A3B8",desc:"Themes & Preferences"},
  {id:"calc",l:"Civil Calc",icon:"🔢",color:"#34D399",desc:"Engineering Calculators"},
];

function Main({user,onLogout,settings,setSettings}){
  C=mkColors(settings.accent||DEF_SETTINGS.accent, settings.theme||DEF_SETTINGS.theme);
  const[site,setSite]=useState("ALL");
  const[tab,setTab]=useState("dash");
  const[salesSub,setSalesSub]=useState("jo");
  const[dprSub,setDprSub]=useState("dpr");
  const[purchSub,setPurchSub]=useState("pr");
  const[showSoRecon,setShowSoRecon]=useState(false);
  const[viewJo,setViewJo]=useState(null);
  const[viewPr,setViewPr]=useState(null);
  const[viewCcs,setViewCcs]=useState(null);
  const[hrSub,setHrSub]=useState("att");
  const[invSub,setInvSub]=useState("stock");
  const[accSub,setAccSub]=useState("vouchers");
  const[chqFilter,setChqFilter]=useState("All");
  const[ttFilter,setTtFilter]=useState("All");
  const[issueFilter,setIssueFilter]=useState("All");
  const[oiSub,setOiSub]=useState("list");
  const[calcSub,setCalcSub]=useState("reinforcement");
  const[calcInputs,setCalcInputs]=useState({});
  const[showAI,setShowAI]=useState(false);
  const[aiQuery,setAiQuery]=useState("");
  const[aiHistory,setAiHistory]=useState([
    {role:"assistant",text:"Hello! I am your Site Ledger AI Assistant. Ask me anything about your project costs, material stocks, labour status, or rate analysis."}
  ]);
  const[newNoteText,setNewNoteText]=useState("");
  const ci=(k,v)=>setCalcInputs(p=>({...p,[k]:+v||0}));

  /* Image picker helper — returns base64 data URL */
  const pickImage=(cb)=>{const inp=document.createElement("input");inp.type="file";inp.accept="image/*";inp.onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>cb(ev.target.result);r.readAsDataURL(f);};inp.click();};
  const[repSub,setRepSub]=useState("pl");
  const[mTab,setMTab]=useState("sites");
  const[showKPIs,setShowKPIs]=useState(true);
  const[data,setData]=useState(()=>{const d=loadData()||INIT_D;if(!d.wcPolicies)d.wcPolicies=INIT_WC;return d;});
  const[masters,setMasters]=useState(()=>loadMasters()||INIT_M);
  const[showBackupModal,setShowBackupModal]=useState(false);
  const[modal,setModal]=useState(null);
  const[form,setForm]=useState({});
  const[del,setDel]=useState(null);
  const[editTds,setEditTds]=useState(null);
  const[viewDoc,setViewDoc]=useState(null);
  const[ledEnt,setLedEnt]=useState("client");
  const[ledName,setLedName]=useState("NHAI");
  const[fSt,setFSt]=useState("All");
  const[dbDate,setDbDate]=useState("2025-02-17");
  const[dprSite,setDprSite]=useState("all");
  const[rpFrom,setRpFrom]=useState("2025-01-01");
  const[rpTo,setRpTo]=useState("2025-03-31");

  useEffect(()=>{persistData(data);},[data]);
  useEffect(()=>{persistMasters(masters);},[masters]);

  const sf=(f,v)=>setForm(p=>({...p,[f]:v}));
  const co=masters.company;
  const userModAccess=user.moduleAccess||ROLE_ACCESS[user.role]||[];
  const can=t=>userModAccess.includes(t);

  const upd=(key,fn)=>{
    setData(p=>{
      const nextArr = fn(p[key]||[]);
      const n = {...p, [key]: nextArr};
      persistData(n);
      return n;
    });
  };
  const updM=(key,fn)=>{
    setMasters(p=>{
      const nextArr = fn(p[key]||[]);
      const n = {...p, [key]: nextArr};
      persistMasters(n);
      return n;
    });
  };

  const isApprover = ["Admin", "Manager", "Owner", "Site Manager"].includes(user.role);
  const checkApproval = (action, targetType, targetKey, payload, targetId) => {
    if (isApprover) return false;
    if (!settings.strictApproval && (action === "add" || action === "edit" || action === "receive_pay")) return false;
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
      estimate:{field:"estNo",prefix:"QTN",arr:data.estimates},
      qtn:{field:"estNo",prefix:"QTN",arr:data.estimates},
      proforma:{field:"pfNo",prefix:"PRO",arr:data.proforma},
      debitNote:{field:"dnNo",prefix:"DN",arr:data.debitNotes},
      otherincome:{field:"oiNo",prefix:"OI",arr:data.otherIncome},
      po:{field:"poNo",prefix:"PO",arr:data.purchaseOrders},
      creditNote:{field:"cnNo",prefix:"CN",arr:data.creditNotes},
      vouchers:{field:"vNo",prefix:extra&&extra.vtype==="in"?"VCI":"VCO",arr:data.vouchers},
      jo:{field:"joNo",prefix:"JO",arr:data.jobOrders},
      pr:{field:"prNo",prefix:"PR",arr:data.purchaseRequisitions},
      ccs:{field:"ccsNo",prefix:"CCS",arr:data.ccs},
      matreceipt:{field:"grnNo",prefix:extra&&extra.docType==="SRN"?"SRN":"GRN",arr:data.materialReceipts},
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

  const fData=useMemo(()=>{if(site==="ALL")return data;const f={};["sales","saleOrders","purchases","purchaseOrders","expenses","payroll","attendance","dpr","materialReceipts","estimates","proforma","debitNotes","creditNotes","jobOrders","purchaseRequisitions","issues","siteDocs","otherIncome","transfers","ccs"].forEach(k=>{f[k]=(data[k]||[]).filter(x=>!x.siteId||x.siteId===site);});return{...data,...f};},[data,site]);
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
    const invNo=nextDocNo("INV", data.sales||[], "inv");
    const today=new Date().toISOString().slice(0,10);
    setForm({date:today,inv:invNo,siteId:so.siteId,soId:so.id,client:so.client,tds:so.tds||2,desc:so.desc,lineItems:(so.lineItems||[]).map(li=>({...li,disc:0}))});
    setModal({t:"txn",mod:"sales"});
  };

  /* Convert Sale Order → Job Order with quantity cap (Prompt 7m) */
  const convertSoToJo=so=>{
    const existingJOs = (data.jobOrders||[]).filter(j=>j.soId===so.id);
    const tasks = (so.lineItems||[]).map((li, idx)=>{
      const alreadyAlloc = existingJOs.flatMap(j=>j.tasks||[]).filter(t=>t.soLineIdx===idx).reduce((a,b)=>a+(Number(b.qty)||0),0);
      const soQty = Number(li.qty)||0;
      const remainingQty = Math.max(0, soQty - alreadyAlloc);
      const unitRate = Number(li.rate)||0;
      const basicVal = remainingQty * unitRate;
      return {
        id: uid() + idx,
        name: li.desc || li.item || ("Task " + (idx+1)),
        unit: li.unit || "Nos",
        soQty,
        alreadyAllocated: alreadyAlloc,
        qty: remainingQty,
        maxQty: remainingQty,
        soLineIdx: idx,
        phase: "Site Preparation",
        estStartDate: new Date().toISOString().slice(0,10),
        estEndDate: "",
        matBudget: Math.round(basicVal * 0.45),
        labBudget: Math.round(basicVal * 0.25),
        macBudget: Math.round(basicVal * 0.10)
      };
    });

    const availableTasks = tasks.filter(t=>t.maxQty > 0);
    if(availableTasks.length === 0) {
      return alert("All line item quantities for Sale Order " + (so.soNo||so.id) + " have already been 100% allocated to existing Job Orders.");
    }

    const newJoNo = nextDocNo("JO", data.jobOrders||[], "joNo");
    setForm({
      date: new Date().toISOString().slice(0,10),
      joNo: newJoNo,
      soId: so.id,
      siteId: so.siteId,
      client: so.client,
      jobName: so.desc,
      tasks: availableTasks,
      specialInstructions: ""
    });
    setModal({t:"txn", mod:"jo"});
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
  
  /* JO progress for DPR */
  const getJoProgress=joId=>{if(!joId)return[];const jo=(data.jobOrders||[]).find(j=>j.id===joId);if(!jo)return[];return(jo.tasks||[]).map(t=>{const completed=(data.dpr||[]).filter(d=>d.jobOrderId===joId).reduce((a,d)=>{const e=(d.entries||[]).find(en=>en.taskId===t.id);return a+(e?e.completedQty:0);},0);return{desc:t.name,unit:t.unit,estimated:t.qty,completed:Math.round(completed*100)/100,balance:Math.max(0,t.qty-completed)};});};

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

  const SITE_LIST=[
    {id:"ALL",name:"All Sites"},
    {id:"OFFICE",name:"🏢 Head Office"},
    ...masters.sites.map(s=>({id:s.id,name:s.name}))
  ];
  const siteOpts=[{v:"",l:"Select Site"},{v:"CONSULTANCY",l:"🎓 Consultancy"},{v:"OFFICE",l:"🏢 Head Office"},{v:"GODOWN",l:"🏭 Godown"},...masters.sites.map(s=>({v:s.id,l:s.name}))];
  const bankOpts=masters.banks.map(b=>({v:b.id,l:b.name}));
  const pettyOpts=masters.pettyCash.map(p=>({v:p.id,l:p.name}));
  const gOpts=[0,5,12,18,28];
  const TABS=MOD_GROUPS.filter(t=>can(t.id));
  const MTABS=[
    {k:"sites",l:"Sites"},
    {k:"clients",l:"Clients"},
    {k:"vendors",l:"Vendors"},
    {k:"uom",l:"UOM"},
    {k:"inputRates",l:"Input Rates"},
    {k:"items",l:"Items"},
    {k:"services",l:"Services"},
    {k:"labours",l:"HR"},
    {k:"machinery",l:"Machinery"},
    {k:"banks",l:"Banks"},
    {k:"pettyCash",l:"Petty Cash"},
    {k:"godowns",l:"Godowns"},
    {k:"users",l:"Users"},
    {k:"expenseCats",l:"Exp.Cats"},
    {k:"company",l:"Company"}
  ];
  const curTab=TABS.find(t=>t.id===tab)||TABS[0]||{};

  /* Print handlers for reports */
  const printPL=()=>{const rows=[["INCOME","",true],["Basic Revenue",INR(rk.tB),false],["GST Output",INR(rk.tG),false],["","",false],["COST OF WORK","",true],["Materials",INR(rk.pB),false],["Expenses",INR(rk.tE),false],["Payroll",INR(rk.tP),false],["Total Cost",INR(rk.pB+rk.tE+rk.tP),false],["","",false],["GROSS PROFIT",INR(rk.profit),true],["Margin",rk.margin+"%",true]];const trs=rows.map(([l,v,h])=>l?"<tr><td style=\"padding:6px 10px;border-bottom:1px solid #f1f5f9;font-weight:"+(h?700:400)+";color:"+(h?"#F59E0B":"#333")+"\">" +l+"</td><td style=\"padding:6px 10px;text-align:right;font-weight:"+(h?700:400)+"\">" +v+"</td></tr>":"<tr><td colspan=2 style=\"padding:4px\"></td></tr>").join("");genGenericPrint("Profit & Loss Statement","<table style=\"width:100%;border-collapse:collapse\">"+trs+"</table><div style=\"padding:10px;background:#f8fafc;border-radius:4px;margin-top:10px;font-size:11px;color:#64748b\">Period: "+rpFrom+" to "+rpTo+"</div>",co);};
  const printBS=()=>{const bs=balanceSheet;const mkRow=(l,v)=>"<div style=\"display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f1f5f9\"><span>"+l+"</span><span style=\"font-weight:600\">"+v+"</span></div>";const assets=[["Bank & Cash",INR(bs.bankBal+bs.pettyBal)],["Accounts Receivable",INR(bs.receivables)],["Inventory",INR(bs.invValue)],["Loans Given",INR(bs.loansGiven)]].map(([l,v])=>mkRow(l,v)).join("");const liabs=[["Accounts Payable",INR(bs.payables)],["Loans Borrowed",INR(bs.loansBorrowed)],["GST Payable",INR(bs.gstPayable)],["TDS Payable",INR(bs.tdsPayable)]].map(([l,v])=>mkRow(l,v)).join("");const equityRow=mkRow("Net Equity","<span style=\"color:"+(bs.equity>=0?"#34D399":"#F87171")+"\">"+INR(bs.equity)+"</span>");const html="<div style=\"display:grid;grid-template-columns:1fr 1fr;gap:20px\"><div><h3 style=\"color:#34D399;margin:0 0 10px\">ASSETS</h3>"+assets+"<div style=\"display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid #34D399;font-weight:700;font-size:14px\"><span>Total Assets</span><span style=\"color:#34D399\">"+INR(bs.totalAssets)+"</span></div></div><div><h3 style=\"color:#F87171;margin:0 0 10px\">LIABILITIES &amp; EQUITY</h3>"+liabs+equityRow+"<div style=\"display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid #F87171;font-weight:700;font-size:14px\"><span>Total L+E</span><span style=\"color:#F87171\">"+INR(bs.totalLiab+Math.max(0,bs.equity))+"</span></div></div></div>";genGenericPrint("Balance Sheet",html,co);};
  const printLedger=()=>{const trs=ledger.map(r=>"<tr><td style=\"padding:5px 8px;border-bottom:1px solid #f1f5f9\">"+r.date+"</td><td>"+r.ref+"</td><td>"+r.desc+"</td><td style=\"text-align:right\">"+(r.dr>0?INR(r.dr):"—")+"</td><td style=\"text-align:right\">"+(r.cr>0?INR(r.cr):"—")+"</td><td style=\"text-align:right;font-weight:700\">"+INR(r.bal)+"</td></tr>").join("");const ths=["Date","Ref","Description","Debit","Credit","Balance"].map(h=>"<th style=\"padding:7px 10px;text-align:left\">"+h+"</th>").join("");genGenericPrint("Account Ledger — "+ledName,"<table style=\"width:100%;border-collapse:collapse\"><thead><tr style=\"background:#060C1A;color:#F59E0B\">"+ths+"</tr></thead><tbody>"+trs+"</tbody></table>",co);};
  const printDayBook=()=>{const trs=dayBookEntries.map(e=>"<tr><td style=\"padding:5px 8px;border-bottom:1px solid #f1f5f9\">"+e.module+"</td><td>"+e.party+"</td><td>"+e.desc+"</td><td style=\"color:"+(e.type==="income"?"#34D399":"#F87171")+";font-weight:600\">"+(e.type==="income"?"IN":"OUT")+"</td><td style=\"text-align:right;font-weight:700\">"+INR(e.amt)+"</td></tr>").join("");const ths=["Module","Party","Description","Flow","Amount"].map(h=>"<th style=\"padding:7px 10px;text-align:left\">"+h+"</th>").join("");genGenericPrint("Day Book — "+dbDate,"<table style=\"width:100%;border-collapse:collapse\"><thead><tr style=\"background:#060C1A;color:#F59E0B\">"+ths+"</tr></thead><tbody>"+trs+"</tbody></table>",co);};

  /* ══════════════════ RENDER ══════════════════ */
  const fStyle=settings.font==="sans"?"'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif":settings.font==="serif"?"Georgia,serif":"'Courier New',monospace";
  return <div style={{height:"100vh",overflow:"hidden",display:"flex",flexDirection:"column",background:C.bg1,color:C.text,fontFamily:fStyle,fontSize:settings.fontSize||12}}>
    {/* TOP BAR */}
    <div style={{background:C.isLight?"linear-gradient(90deg,#FFFFFF,#F8FAFC)":"linear-gradient(90deg,#060C1A,#0A1223)",borderBottom:"1px solid "+C.br,padding:"0 20px",display:"flex",alignItems:"center",gap:12,height:56,position:"sticky",top:0,zIndex:100,boxShadow:"0 4px 20px rgba(0,0,0,.15)"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:38,height:38,background:`linear-gradient(135deg,${G(C.or,0.2)},${G(C.or,0.05)})`,borderRadius:9,border:`1px solid ${G(C.or,0.3)}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🏗</div><div><div style={{color:C.or,fontWeight:800,fontSize:15,letterSpacing:3,lineHeight:1}}>SITE LEDGER</div><div style={{color:C.gr,fontSize:9,letterSpacing:1}}>CIVIL ERP v12</div></div></div>
      <div style={{flex:1}}/><Clock/>
      <div style={{width:1,background:C.br,height:26}}/>
      
      {/* Day / Night Mode Toggle */}
      <button onClick={()=>{
        const nextTheme=settings.theme==="light"?"dark":"light";
        setSettings({...settings,theme:nextTheme});
        saveSettings({...settings,theme:nextTheme});
      }} title="Toggle Day/Night Mode" style={{padding:"6px 12px",borderRadius:8,border:"1px solid "+C.br,background:C.isLight?"#F1F5F9":"rgba(255,255,255,0.05)",color:C.or,cursor:"pointer",fontSize:12,fontFamily:"monospace",fontWeight:700,display:"flex",alignItems:"center",gap:6}}>
        <span>{settings.theme==="light"?"☀️ Day":"🌙 Night"}</span>
      </button>

      {/* AI Assistant Pill */}
      <button onClick={()=>setShowAI(!showAI)} title="Open Site Ledger AI Assistant" style={{padding:"6px 14px",borderRadius:20,border:"1px solid "+C.tl,background:G(C.tl,0.12),color:C.tl,cursor:"pointer",fontSize:12,fontFamily:"monospace",fontWeight:700,display:"flex",alignItems:"center",gap:6,boxShadow:"0 0 12px "+G(C.tl,0.3)}}>
        <span>✨ AI Assistant</span>
      </button>

      <div style={{width:1,background:C.br,height:26}}/>
      <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:32,height:32,borderRadius:"50%",background:`linear-gradient(135deg,${G(C.pu,0.3)},${G(C.bl,0.2)})`,border:`1px solid ${G(C.pu,0.4)}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>👤</div><div><div style={{color:C.text,fontSize:12,fontWeight:700}}>{user.name}</div><div style={{color:C.gr,fontSize:10}}>{user.role}</div></div></div>
      <button onClick={onLogout} style={{padding:"6px 14px",borderRadius:8,border:"1px solid rgba(248,113,113,.3)",background:"rgba(248,113,113,.08)",color:C.rd,cursor:"pointer",fontSize:11,fontFamily:"monospace",fontWeight:700}}>↩ Logout</button>
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
            {tab==="dpr"&&dprSub==="dpr"&&site!=="ALL"&&<Btn onClick={()=>openAdd("dpr")} color={C.bl} icon="＋">Add DPR</Btn>}
            {tab==="dpr"&&dprSub==="issues"&&<Btn onClick={()=>openAdd("issue")} color={C.rd} icon="⚠️">Report Issue</Btn>}
            {tab==="sales"&&salesSub==="so"&&site!=="ALL"&&<Btn onClick={()=>openAdd("so")} color={C.gn} icon="＋">Sale Order</Btn>}
            {tab==="sales"&&salesSub==="inv"&&site!=="ALL"&&<Btn onClick={()=>openAdd("sales")} color={C.gn} icon="＋">Invoice</Btn>}
            {tab==="sales"&&salesSub==="est"&&site!=="ALL"&&<Btn onClick={()=>openAdd("estimate")} color={C.gn} icon="＋">New Quotation</Btn>}
            {tab==="sales"&&salesSub==="proforma"&&site!=="ALL"&&<Btn onClick={()=>openAdd("proforma")} color={C.gn} icon="＋">Proforma</Btn>}
            {tab==="sales"&&salesSub==="dn"&&site!=="ALL"&&<Btn onClick={()=>openAdd("debitNote")} color={C.rd} icon="＋">Debit Note</Btn>}
            {tab==="sales"&&salesSub==="otherincome"&&<Btn onClick={()=>openAdd("otherincome")} color={C.tl} icon="＋">Add Income</Btn>}
            {tab==="purchase"&&purchSub==="pr"&&site!=="ALL"&&<Btn onClick={()=>openAdd("pr")} color={C.rd} icon="＋">New PR</Btn>}
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
            {tab==="sitedocs"&&<Btn onClick={()=>{
              const name=prompt("Enter Document Name (e.g. Pile Load Test Report Rev-1.pdf):");
              if(!name)return;
              const type=prompt("Document Type (PDF / DWG / DOCX / XLSX):","PDF");
              const newDoc={id:uid(),siteId:site==="ALL"?(masters.sites[0]||{}).id||"s1":site,name,type:type||"PDF",date:new Date().toISOString().slice(0,10),size:"2.4 MB"};
              upd("siteDocs",arr=>[...arr,newDoc]);
            }} color={C.tl} icon="＋">Upload Document</Btn>}
            {tab==="masters"&&can("masters")&&<Btn onClick={()=>openMAdd(mTab)} color={C.or} icon="＋">Add</Btn>}
          </div>
        </div>
        <div style={{padding:"0 18px 24px"}}>

        {/* ══ DASHBOARD ══ */}
        {tab==="dash"&&<div>
          {/* Pending Approvals */}
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

          {/* 1. Site Status & Cashflow Health Alert (Role-gated: Admin, Manager, Accountant, Owner) */}
          {["Admin", "Manager", "Accountant", "Owner"].includes(user.role) && (()=>{
            const liquidFunds = (k.totalBankBal||0) + (k.totalPettyBal||0);
            const pendingReceivables = (data.sales||[]).reduce((a,s)=>a+Math.max(0, cS(s).net - (s.paidAmt||0)),0);
            const pendingPayables = (data.purchases||[]).reduce((a,p)=>a+Math.max(0, cP(p).tot - (p.paidAmt||0)),0) + (data.expenses||[]).reduce((a,e)=>a+Math.max(0, e.amt - (e.paidAmt||0)),0);
            const openAccidents = (data.issues||[]).filter(i=>i.isAccident && i.status!=="Resolved").length;
            const openIssues = (data.issues||[]).filter(i=>i.status==="Open").length;
            const healthStatus = liquidFunds > pendingPayables ? "Healthy" : liquidFunds > 0 ? "Moderate" : "Critical Liquidity";
            const healthColor = healthStatus === "Healthy" ? C.gn : healthStatus === "Moderate" ? C.or : C.rd;

            return (
              <div style={{...ss.card, padding:16, marginBottom:14, background: "linear-gradient(135deg, rgba(14,22,40,0.95), rgba(10,18,35,0.95))", borderLeft: `4px solid ${healthColor}`}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10, marginBottom:12}}>
                  <div>
                    <span style={{color:C.si, fontSize:10, textTransform:"uppercase", letterSpacing:1.5, fontWeight:700}}>Executive Site Status &amp; Cashflow Health Monitor</span>
                    <div style={{display:"flex", alignItems:"center", gap:8, marginTop:2}}>
                      <h3 style={{margin:0, color:"#F8FAFC", fontSize:15, fontWeight:700}}>Corporate Liquidity: <span style={{color:healthColor}}>{healthStatus}</span></h3>
                      <span style={{padding:"2px 8px", borderRadius:12, background:G(healthColor,0.15), color:healthColor, fontSize:10, fontWeight:700, fontFamily:"monospace"}}>Role: {user.role}</span>
                    </div>
                  </div>
                  <div style={{display:"flex", gap:10, alignItems:"center"}}>
                    {openAccidents > 0 && <span style={{padding:"4px 10px", borderRadius:6, background:G(C.rd,0.2), color:C.rd, border:"1px solid "+C.rd, fontSize:11, fontWeight:700, display:"flex", alignItems:"center", gap:4}}>🚨 {openAccidents} Open Accident Alert</span>}
                    {openIssues > 0 && <span style={{padding:"4px 10px", borderRadius:6, background:G(C.or,0.15), color:C.or, border:"1px solid "+C.or, fontSize:11, fontWeight:700}}>⚠️ {openIssues} Active Site Issues</span>}
                  </div>
                </div>

                <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:10, paddingTop:8, borderTop:"1px solid #1A2840"}}>
                  <div>
                    <div style={{color:C.si, fontSize:10}}>Total Liquid Funds</div>
                    <div style={{color:C.tl, fontSize:16, fontWeight:700, fontFamily:"monospace"}}>{INR(liquidFunds)}</div>
                    <div style={{color:C.gr, fontSize:9, marginTop:2}}>Bank + Petty Cash</div>
                  </div>
                  <div>
                    <div style={{color:C.si, fontSize:10}}>Pending Receivables</div>
                    <div style={{color:C.gn, fontSize:16, fontWeight:700, fontFamily:"monospace"}}>{INR(pendingReceivables)}</div>
                    <div style={{color:C.gr, fontSize:9, marginTop:2}}>Client Invoices due</div>
                  </div>
                  <div>
                    <div style={{color:C.si, fontSize:10}}>Pending Payables</div>
                    <div style={{color:C.rd, fontSize:16, fontWeight:700, fontFamily:"monospace"}}>{INR(pendingPayables)}</div>
                    <div style={{color:C.gr, fontSize:9, marginTop:2}}>Vendor bills &amp; expenses</div>
                  </div>
                  <div>
                    <div style={{color:C.si, fontSize:10}}>Active Project Sites</div>
                    <div style={{color:C.pu, fontSize:16, fontWeight:700, fontFamily:"monospace"}}>{masters.sites.filter(s=>s.status==="Active").length} Sites</div>
                    <div style={{color:C.gr, fontSize:9, marginTop:2}}>{(data.jobOrders||[]).length} Active Job Orders</div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 2. Financial KPIs */}
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

          {/* 3. Mini-Gantt & Job Order Completion status */}
          <div style={{...ss.card, padding:14, marginBottom:14, background:"linear-gradient(135deg,#0E1628,#0A1223)"}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10}}>
              <div>
                <span style={{color:C.si,fontSize:10,letterSpacing:1,textTransform:"uppercase",fontWeight:700}}>Job Orders — Mini-GANTT &amp; Budget Tracking</span>
                <div style={{color:C.gr, fontSize:10}}>Phase breakdown &amp; real-time progress vs allocated budgets</div>
              </div>
              <Btn sm onClick={()=>{setTab("dpr");setDprSub("gantt");}} color={C.bl}>Full GANTT Schedule →</Btn>
            </div>

            {(fData.jobOrders||[]).length === 0 ? <div style={{color:C.gr, fontSize:11, padding:12, textAlign:"center"}}>No active Job Orders found.</div> :
              (fData.jobOrders||[]).map(jo => {
                const so = (data.saleOrders||[]).find(s=>s.id===jo.soId);
                const totMatB = jo.tasks?.reduce((a,t)=>a+(Number(t.matBudget)||0),0)||0;
                const totLabB = jo.tasks?.reduce((a,t)=>a+(Number(t.labBudget)||0),0)||0;
                const totMacB = jo.tasks?.reduce((a,t)=>a+(Number(t.macBudget)||0),0)||0;
                const totBudget = totMatB + totLabB + totMacB;
                const actMat = (data.purchases||[]).filter(p=>p.jobOrderId===jo.id).reduce((a,p)=>a+((p.qty||0)*(p.rate||0)*(1+(p.gst||18)/100)),0);
                const actLab = (data.payroll||[]).filter(p=>p.jobOrderId===jo.id).reduce((a,p)=>a+(cW(p).gr),0);
                const actMac = (data.expenses||[]).filter(e=>e.jobOrderId===jo.id).reduce((a,e)=>a+(Number(e.amt)||0),0);
                const totAct = actMat + actLab + actMac;
                const isOverrun = totBudget > 0 && totAct > totBudget;

                const phases = [
                  {name:"Site Preparation", color:C.tl},
                  {name:"Foundation & Sub-Structure", color:C.or},
                  {name:"Super Structure", color:C.pu},
                  {name:"Finishing & MEP", color:C.gn}
                ];

                return (
                  <div key={jo.id} style={{marginBottom:12, paddingBottom:12, borderBottom:"1px solid #1A2840"}}>
                    <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8, flexWrap:"wrap", gap:6}}>
                      <div>
                        <span style={{color:C.pu, fontWeight:700, fontSize:13}}>{jo.joNo}</span>
                        <span style={{color:C.si, fontSize:11, marginLeft:8}}>📍 {sName(jo.siteId)}</span>
                        {so && <span style={{color:C.gr, fontSize:10, marginLeft:8}}>({so.desc})</span>}
                        {isOverrun && <span style={{marginLeft:8, padding:"2px 6px", borderRadius:4, background:G(C.rd,0.2), color:C.rd, fontSize:9, fontWeight:700}}>⚠ COST OVERRUN ({Math.round(((totAct-totBudget)/totBudget)*100)}%)</span>}
                      </div>
                      <div style={{textAlign:"right"}}>
                        <span style={{color:C.si, fontSize:10}}>Budget: </span>
                        <b style={{color:C.or, fontSize:12}}>{INR(totBudget)}</b>
                        <span style={{color:C.si, fontSize:10, marginLeft:8}}>Actual: </span>
                        <b style={{color:isOverrun?C.rd:C.gn, fontSize:12}}>{INR(totAct)}</b>
                      </div>
                    </div>

                    {/* Mini-Gantt phase progress bars */}
                    <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:8}}>
                      {phases.map(ph => {
                        const phaseTasks = (jo.tasks||[]).filter(t => (t.phase||"").toLowerCase().includes(ph.name.toLowerCase().slice(0,6)));
                        let donePct = 0;
                        if(phaseTasks.length > 0) {
                          const totEst = phaseTasks.reduce((a,t)=>a+(Number(t.qty)||1),0);
                          const totDone = phaseTasks.reduce((a,t)=>{
                            const cDone = (data.dpr||[]).filter(d=>d.jobOrderId===jo.id).flatMap(d=>d.entries||[]).filter(e=>e.taskId===t.id).reduce((s,e)=>s+(Number(e.completedQty)||0),0);
                            return a + cDone;
                          },0);
                          donePct = Math.min(100, Math.round((totDone/totEst)*100));
                        }
                        return (
                          <div key={ph.name} style={{background:"#060C1A", padding:"6px 8px", borderRadius:6, border:"1px solid #162236"}}>
                            <div style={{display:"flex", justifyContent:"space-between", fontSize:9, color:C.si, marginBottom:3}}>
                              <span style={{whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{ph.name}</span>
                              <b style={{color:ph.color}}>{donePct}%</b>
                            </div>
                            <div style={{height:5, background:"#0E1628", borderRadius:3}}>
                              <div style={{height:"100%", width:donePct+"%", background:ph.color, borderRadius:3}}/>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            }
          </div>

          {/* 4. Pending Issues & Accidents summary widget */}
          <div style={{...ss.card, padding:14, marginBottom:14, background:"linear-gradient(135deg,#0E1628,#0A1223)"}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10}}>
              <div>
                <span style={{color:C.si,fontSize:10,letterSpacing:1,textTransform:"uppercase",fontWeight:700}}>Site Safety &amp; Pending Issues Summary</span>
                <div style={{color:C.gr, fontSize:10}}>Hazard tracking, incident reporting and assigned action items</div>
              </div>
              <Btn sm onClick={()=>{setTab("dpr");setDprSub("issues");}} color={C.rd}>Manage Issues &amp; Accidents →</Btn>
            </div>

            <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:8, marginBottom:10}}>
              <div style={{background:"#060C1A", padding:"8px 12px", borderRadius:6, border:"1px solid #162236", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                <div><div style={{color:C.si, fontSize:10}}>Open Issues</div><div style={{color:C.or, fontSize:16, fontWeight:700}}>{(data.issues||[]).filter(i=>i.status==="Open").length}</div></div>
                <span style={{fontSize:20}}>⚠️</span>
              </div>
              <div style={{background:"#060C1A", padding:"8px 12px", borderRadius:6, border:"1px solid #162236", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                <div><div style={{color:C.si, fontSize:10}}>High Priority</div><div style={{color:C.rd, fontSize:16, fontWeight:700}}>{(data.issues||[]).filter(i=>i.priority==="High" && i.status!=="Resolved").length}</div></div>
                <span style={{fontSize:20}}>🔥</span>
              </div>
              <div style={{background:"#060C1A", padding:"8px 12px", borderRadius:6, border:"1px solid #162236", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                <div><div style={{color:C.si, fontSize:10}}>Reported Accidents</div><div style={{color:C.rd, fontSize:16, fontWeight:700}}>{(data.issues||[]).filter(i=>i.isAccident).length}</div></div>
                <span style={{fontSize:20}}>🚨</span>
              </div>
            </div>

            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
              {(data.issues||[]).slice(0,4).map(iss => (
                <div key={iss.id} style={{padding:"8px 10px", background:"#060C1A", borderRadius:6, border:iss.isAccident?"1px solid "+G(C.rd,0.4):"1px solid #162236", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                  <div>
                    <div style={{display:"flex", alignItems:"center", gap:6}}>
                      {iss.isAccident && <span style={{color:C.rd, fontSize:10, fontWeight:700}}>🚨 ACCIDENT</span>}
                      <b style={{color:"#E2E8F0", fontSize:11}}>{iss.title}</b>
                    </div>
                    <div style={{color:C.gr, fontSize:9, marginTop:2}}>📍 {sName(iss.siteId)} · Assigned: {iss.assignedTo} · Due: {iss.dueDate}</div>
                  </div>
                  <Tag c={iss.status==="Resolved"?"g":iss.priority==="High"?"r":"o"} ch={iss.status}/>
                </div>
              ))}
            </div>
          </div>

          {/* 5. Charts & Sticky Notes widget */}
          <div style={{display:"grid", gridTemplateColumns:"2fr 1fr", gap:12, marginBottom:14}}>
            {/* Charts Left Column */}
            <div>
              <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:12,marginBottom:12}}>
                <MiniCalendar/>
                <div style={{...ss.card,padding:14,background:"linear-gradient(135deg,#0E1628,#0A1223)"}}>
                  <div style={{color:C.si,fontSize:10,marginBottom:10,letterSpacing:1,textTransform:"uppercase"}}>Financial Year {getFYStr()}</div>
                  {[["Revenue",INR(k.tB),C.tl],["Expenses",INR(k.pB+k.tE),C.rd],["Payroll",INR(k.tP),C.pu],["Profit",INR(k.profit),k.profit>=0?C.gn:C.rd]].map(([l,v,c])=><div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #0A1223"}}><span style={{color:C.si,fontSize:11}}>{l}</span><span style={{color:c,fontWeight:700,fontFamily:"monospace"}}>{v}</span></div>)}
                </div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div style={{...ss.card,padding:16}}>
                  <div style={{color:C.si,fontSize:10,letterSpacing:1,marginBottom:12,textTransform:"uppercase"}}>Monthly Revenue / Cost / Profit</div>
                  <ResponsiveContainer width="100%" height={170}><BarChart data={mChart} barGap={3}><XAxis dataKey="mo" tick={{fill:"#334155",fontSize:9}} axisLine={false} tickLine={false}/><YAxis tick={{fill:"#334155",fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>"₹"+Math.round(v/100000)+"L"}/><Tooltip formatter={v=>INR(v)} contentStyle={TT}/><Bar dataKey="rev" fill={C.tl} radius={[4,4,0,0]} name="Revenue"/><Bar dataKey="cost" fill={C.rd} radius={[4,4,0,0]} name="Cost"/><Bar dataKey="profit" fill={C.or} radius={[4,4,0,0]} name="Profit"/></BarChart></ResponsiveContainer>
                </div>
                <div style={{...ss.card,padding:16}}>
                  <div style={{color:C.si,fontSize:10,letterSpacing:1,marginBottom:12,textTransform:"uppercase"}}>Expense Breakdown</div>
                  <ResponsiveContainer width="100%" height={160}><PieChart><Pie data={ePie} cx="50%" cy="50%" outerRadius={60} dataKey="value" label={({name,percent})=>name+" "+(percent*100).toFixed(0)+"%"} labelLine={false} fontSize={9}>{ePie.map((_,i)=><Cell key={i} fill={PC[i%PC.length]}/>)}</Pie><Tooltip formatter={v=>INR(v)} contentStyle={TT}/></PieChart></ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Sticky Notes Right Column */}
            <div style={{...ss.card, padding:14, background:"linear-gradient(135deg,#0E1628,#0A1223)", display:"flex", flexDirection:"column"}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10}}>
                <div style={{color:C.or, fontWeight:700, fontSize:12, display:"flex", alignItems:"center", gap:6}}>
                  <span>📌</span> Sticky Notes &amp; Quick Reminders
                </div>
                <span style={{color:C.gr, fontSize:10}}>{(data.stickyNotes||[]).length} notes</span>
              </div>

              {/* Add Note Form */}
              <div style={{marginBottom:10, padding:8, background:"#060C1A", borderRadius:8, border:"1px solid #1A2840"}}>
                <textarea
                  style={{width:"100%", background:"transparent", border:"none", color:"#E2E8F0", fontSize:11, fontFamily:"monospace", outline:"none", resize:"none", height:46}}
                  placeholder="Type a quick site note or reminder..."
                  value={newNoteText}
                  onChange={e=>setNewNoteText(e.target.value)}
                />
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:4}}>
                  <div style={{display:"flex", gap:4}}>
                    {["#FEF08A","#BAE6FD","#BBF7D0","#FBCFE8"].map(bg=>(
                      <div key={bg} onClick={()=>{
                        if(!newNoteText.trim()) return;
                        const n={id:uid(), text:newNoteText.trim(), color:bg, date:new Date().toISOString().slice(0,10)};
                        upd("stickyNotes", arr=>[n, ...arr]);
                        setNewNoteText("");
                      }} style={{width:16, height:16, borderRadius:"50%", background:bg, cursor:"pointer", border:"1px solid rgba(0,0,0,0.2)"}} title="Add note in this color"/>
                    ))}
                  </div>
                  <Btn sm onClick={()=>{
                    if(!newNoteText.trim()) return;
                    const n={id:uid(), text:newNoteText.trim(), color:"#FEF08A", date:new Date().toISOString().slice(0,10)};
                    upd("stickyNotes", arr=>[n, ...arr]);
                    setNewNoteText("");
                  }} color={C.or}>+ Add</Btn>
                </div>
              </div>

              {/* Note Cards List */}
              <div style={{flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:8, maxHeight:380}}>
                {(data.stickyNotes||[]).length === 0 ? <div style={{color:C.gr, fontSize:10, textAlign:"center", padding:20}}>No notes yet. Add one above!</div> :
                  (data.stickyNotes||[]).map(note => (
                    <div key={note.id} style={{background:note.color||"#FEF08A", color:"#1E293B", padding:"8px 10px", borderRadius:6, position:"relative", boxShadow:"0 2px 6px rgba(0,0,0,0.15)"}}>
                      <button onClick={()=>upd("stickyNotes", arr=>arr.filter(n=>n.id!==note.id))} style={{position:"absolute", top:4, right:6, background:"transparent", border:"none", color:"#64748B", cursor:"pointer", fontSize:11, fontWeight:700}}>✕</button>
                      <div style={{fontSize:11, lineHeight:1.3, paddingRight:14, whiteSpace:"pre-wrap"}}>{note.text}</div>
                      <div style={{fontSize:8, color:"#64748B", marginTop:4, textAlign:"right"}}>{note.date}</div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </div>}

        {/* ══ DPR (Punched against Job Order | GANTT Chart | Issues & Accidents) ══ */}
        {tab==="dpr"&&<div>
          <SubTabs val={dprSub} onChange={setDprSub} tabs={[{v:"dpr",l:"DPR Entries",icon:"📋"},{v:"gantt",l:"GANTT Chart",icon:"📊"},{v:"issues",l:"Issues & Accidents",icon:"⚠️"}]}/>
          
          {dprSub==="dpr"&&<div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
              <Sel val={dprSite} onChange={setDprSite} opts={[{v:"all",l:"All Sites"},...masters.sites.map(s=>({v:s.id,l:s.name}))]}/>
              <Btn onClick={()=>openAdd("dpr")} color={C.bl} icon="＋">Add DPR (against Job Order)</Btn>
            </div>
            {(data.dpr||[]).filter(d=>dprSite==="all"||d.siteId===dprSite).map((d,di)=>{
              const jo=(data.jobOrders||[]).find(j=>j.id===d.jobOrderId);
              const so=jo?(data.saleOrders||[]).find(s=>s.id===jo.soId):(data.saleOrders||[]).find(s=>s.id===d.soId);
              const catBreakdown = d.workerCats ? Object.entries(d.workerCats).filter(([_,v])=>Number(v)>0).map(([k,v])=>`${k.charAt(0).toUpperCase()+k.slice(1)}: ${v}`).join(" | ") : "";
              return(
                <div key={di} style={{...ss.card,marginBottom:14,overflow:"hidden"}}>
                  <div style={{padding:"10px 16px",borderBottom:BD,display:"flex",justifyContent:"space-between",alignItems:"center",background:G(C.bl,0.06)}}>
                    <div>
                      <span style={{color:C.or,fontWeight:700,fontSize:12}}>DPR — {d.date}</span>
                      <span style={{color:C.gr,fontSize:10,marginLeft:10}}>{sName(d.siteId)}</span>
                      {jo&&<span style={{color:C.pu,fontSize:10,marginLeft:10}}>JO: <b>{jo.joNo}</b></span>}
                      {so&&<span style={{color:C.tl,fontSize:10,marginLeft:10}}>SO: {so.desc}</span>}
                      {d.hasAccident&&<span style={{background:"rgba(248,113,113,.2)",color:C.rd,padding:"2px 8px",borderRadius:4,fontSize:9,fontWeight:700,marginLeft:8}}>🚨 ACCIDENT REPORTED</span>}
                    </div>
                    <div style={{display:"flex",gap:12,fontSize:10}}>
                      <span style={{color:C.si}}>Supervisor: <b style={{color:C.pu}}>{d.supervisor}</b></span>
                      <span style={{color:C.si}}>Workers: <b style={{color:C.tl}}>{d.workers||0}</b>{catBreakdown ? <span style={{color:C.gr,marginLeft:4}}>({catBreakdown})</span> : ""}</span>
                      <span style={{color:C.si}}>Weather: <span style={{color:C.bl}}>{d.weather}</span></span>
                    </div>
                  </div>
                  {d.hasAccident&&<div style={{padding:"8px 16px",background:"rgba(248,113,113,.08)",borderBottom:BD,fontSize:11,color:C.rd}}>
                    <b>Incident details:</b> {d.accidentSeverity||"Incident"} — {d.accidentDesc||"—"} (Workers: {d.accidentWorkers||"—"})
                    {d.accidentImages&&d.accidentImages.length>0&&<div style={{display:"flex",gap:8,marginTop:6,flexWrap:"wrap"}}>
                      {d.accidentImages.map((img,idx)=><img key={idx} src={img} style={{height:48,borderRadius:4,objectFit:"cover",border:"1px solid "+C.rd,cursor:"pointer"}} onClick={()=>window.open(img,"_blank")}/>)}
                    </div>}
                  </div>}
                  {d.clientInstructions&&<div style={{padding:"7px 16px",background:G(C.or,0.05),borderBottom:BD,fontSize:11}}><span style={{color:C.or,fontWeight:700}}>📌 Client Instructions: </span><span style={{color:"#CBD5E1"}}>{d.clientInstructions}</span></div>}
                  <table style={{borderCollapse:"collapse",width:"100%",fontSize:11}}>
                    <thead><tr style={{background:"#060C1A"}}><th style={ss.th}>Type</th><th style={ss.th}>Item / Service</th><th style={ss.th}>Completed Qty</th><th style={ss.th}>Unit</th><th style={ss.th}>Remarks</th></tr></thead>
                    <tbody>{(d.entries||[]).map((e,i)=><tr key={i}><td style={ss.td}><Tag c={e.type==="service"?"b":"o"} ch={e.type}/></td><td style={ss.td}>{e.name}</td><td style={{...ss.td,color:C.gn,fontWeight:700}}>{e.completedQty}</td><td style={ss.td}>{e.unit}</td><td style={{...ss.td,color:C.gr}}>{e.remarks}</td></tr>)}</tbody>
                  </table>
                  {d.jobOrderId&&jo&&<div style={{padding:"8px 16px",borderTop:BD,background:G(C.tl,0.04)}}>
                    <div style={{color:C.tl,fontSize:10,fontWeight:700,marginBottom:6,letterSpacing:1}}>JOB ORDER PROGRESS TRACKER</div>
                    {getJoProgress(d.jobOrderId).map((p,i)=>{const pct=p.estimated?Math.min(100,Math.round(p.completed/p.estimated*100)):0;return <div key={i} style={{marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:3}}><span style={{color:C.si}}>{p.desc}</span><span style={{color:C.gr}}>Est: {p.estimated} {p.unit} | Done: <b style={{color:C.gn}}>{p.completed}</b> | Balance: <b style={{color:C.rd}}>{p.balance}</b></span></div>
                      <div style={{height:5,background:"#0A1223",borderRadius:3}}><div style={{height:"100%",width:pct+"%",background:`linear-gradient(90deg,${C.tl},${G(C.tl,0.5)})`,borderRadius:3}}/></div>
                      <div style={{color:"#1E2D45",fontSize:9,marginTop:1}}>{pct}% complete</div>
                    </div>;})}
                  </div>}
                  {d.remarks&&<div style={{padding:"7px 16px",fontSize:11,color:"#4B6180",borderTop:BD}}>📝 {d.remarks}</div>}
                  {(d.images||[]).length>0&&<div style={{padding:"8px 16px",borderTop:BD,display:"flex",gap:8,flexWrap:"wrap"}}>{d.images.map((img,i)=><img key={i} src={img} style={{height:64,borderRadius:6,objectFit:"cover",border:"1px solid "+C.br,cursor:"pointer"}} onClick={()=>window.open(img,"_blank")}/>)}</div>}
                  <div style={{padding:"8px 16px",borderTop:BD,display:"flex",gap:6,justifyContent:"flex-end"}}>
                    <button onClick={()=>genDPRPrint(d, co, {siteName:sName(d.siteId), joNo:jo?.joNo, clientName:so?.client})} style={{padding:"4px 12px",borderRadius:6,border:"1px solid rgba(2,132,199,.4)",background:"rgba(2,132,199,.12)",color:C.bl,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>🖨 Print DPR</button>
                    <button onClick={()=>openEdit("dpr",d)} style={{padding:"4px 12px",borderRadius:6,border:"1px solid rgba(245,158,11,.3)",background:"rgba(245,158,11,.1)",color:C.or,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>✎ Edit DPR</button>
                    <button onClick={()=>setDel({key:"dpr",id:d.id,label:"DPR — "+d.date})} style={{padding:"4px 12px",borderRadius:6,border:"1px solid rgba(248,113,113,.3)",background:"rgba(248,113,113,.1)",color:C.rd,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>🗑 Delete</button>
                  </div>
                </div>
              );
            })}
          </div>}

          {/* TAB 2: INTERACTIVE GANTT CHART (2nd tab as requested) */}
          {dprSub==="gantt"&&<div>
            <div style={{...ss.card,padding:16}}>
              <div style={{color:C.or,fontWeight:700,fontSize:13,marginBottom:12}}>📊 Construction Project Timeline &amp; Task GANTT Schedule</div>
              {(data.jobOrders||[]).length===0?<div style={{color:"#334155",padding:24,textAlign:"center"}}>No Job Orders available for Gantt tracking</div>:(data.jobOrders||[]).map((jo,joi)=>{
                const so=(data.saleOrders||[]).find(s=>s.id===jo.soId);
                const tasks=jo.tasks||[];
                return <div key={joi} style={{marginBottom:20,borderBottom:"1px solid #1E2D45",paddingBottom:16}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <div>
                      <b style={{color:C.pu,fontSize:13}}>{jo.joNo}</b> <span style={{color:C.text,fontSize:12}}>— {so?so.desc:sName(jo.siteId)}</span>
                    </div>
                    <span style={{color:C.gr,fontSize:10}}>Site: {sName(jo.siteId)} · {tasks.length} tasks</span>
                  </div>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
                      <thead><tr style={{background:"#060C1A"}}><th style={{...ss.th,padding:"6px 8px"}}>Phase</th><th style={{...ss.th,padding:"6px 8px"}}>Task</th><th style={{...ss.th,padding:"6px 8px"}}>Start</th><th style={{...ss.th,padding:"6px 8px"}}>End</th><th style={{...ss.th,padding:"6px 8px",width:"45%"}}>Gantt Progress Bar</th></tr></thead>
                      <tbody>{tasks.map((t,ti)=>{
                        const doneQty=(data.dpr||[]).filter(dp=>dp.jobOrderId===jo.id).flatMap(dp=>dp.entries||[]).filter(en=>en.name===t.name).reduce((a,b)=>a+(Number(b.completedQty)||0),0);
                        const pct=t.qty?Math.min(100,Math.round((doneQty/t.qty)*100)):0;
                        const phaseColor=t.phase?.includes("Prep")?C.tl:t.phase?.includes("Foundation")?C.or:t.phase?.includes("Super")?C.pu:C.gn;
                        return <tr key={ti} style={{borderBottom:"1px solid #0A1223"}}>
                          <td style={{...ss.td,padding:"6px 8px"}}><span style={{color:phaseColor,fontWeight:700}}>{t.phase}</span></td>
                          <td style={{...ss.td,padding:"6px 8px"}}><b>{t.name}</b></td>
                          <td style={{...ss.td,padding:"6px 8px",color:C.gr}}>{t.estStartDate||"—"}</td>
                          <td style={{...ss.td,padding:"6px 8px",color:C.gr}}>{t.estEndDate||"—"}</td>
                          <td style={{...ss.td,padding:"6px 8px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <div style={{flex:1,height:12,background:"#060C1A",borderRadius:6,overflow:"hidden",position:"relative"}}>
                                <div style={{height:"100%",width:`${Math.max(pct,15)}%`,background:`linear-gradient(90deg,${phaseColor},${G(phaseColor,0.6)})`,borderRadius:6}}/>
                              </div>
                              <span style={{fontFamily:"monospace",fontWeight:700,color:phaseColor,width:40}}>{pct}%</span>
                            </div>
                          </td>
                        </tr>;
                      })}</tbody>
                    </table>
                  </div>
                </div>;
              })}
            </div>
          </div>}

          {/* TAB 3: ISSUES & ACCIDENTS TRACKER (3rd tab as requested) */}
          {dprSub==="issues"&&<div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
              <div style={{display:"flex",gap:6}}>
                {["All","Open","Resolved","Rejected"].map(st=>(
                  <button key={st} onClick={()=>setIssueFilter(st)} style={{padding:"5px 14px",borderRadius:20,border:"1px solid "+(issueFilter===st?C.or:"#1E2D45"),background:issueFilter===st?G(C.or,0.15):"transparent",color:issueFilter===st?C.or:C.gr,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:issueFilter===st?700:400}}>{st}</button>
                ))}
              </div>
              <Btn onClick={()=>openAdd("issue")} color={C.rd} icon="⚠️">+ Report Issue / Accident</Btn>
            </div>
            <div style={{...ss.card,overflowX:"auto"}}>
              <table style={{borderCollapse:"collapse",width:"100%"}}>
                <thead><tr style={{background:"#060C1A"}}>{["Title","Site","Priority","Due Date","Status","Assigned To","Created By","Created At","Safety Flag","Actions"].map(h=><th key={h} style={ss.th}>{h}</th>)}</tr></thead>
                <tbody>{(data.issues||[]).filter(iss=>issueFilter==="All"||iss.status===issueFilter).length===0?<tr><td colSpan={10} style={{...ss.td,textAlign:"center",color:"#334155",padding:32}}>No issues recorded</td></tr>:(data.issues||[]).filter(iss=>issueFilter==="All"||iss.status===issueFilter).map((iss,idx)=>{
                  return <tr key={idx} onMouseEnter={e=>e.currentTarget.style.background="#0A1223"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                    <td style={ss.td}><b>{iss.title}</b><div style={{fontSize:10,color:C.gr}}>{iss.desc}</div></td>
                    <td style={ss.td}>{sName(iss.siteId)}</td>
                    <td style={ss.td}><Tag c={iss.priority==="Critical"||iss.priority==="High"?"r":iss.priority==="Medium"?"o":"g"} ch={iss.priority}/></td>
                    <td style={ss.td}><span style={{color:iss.status==="Open"&&new Date(iss.dueDate)<new Date()?C.rd:C.text}}>{iss.dueDate}</span></td>
                    <td style={ss.td}><Tag c={iss.status==="Resolved"?"g":iss.status==="Rejected"?"r":"o"} ch={iss.status}/></td>
                    <td style={ss.td}>{iss.assignedTo||"—"}</td>
                    <td style={ss.td}>{iss.createdBy}</td>
                    <td style={ss.td}><span style={{color:C.gr,fontSize:10}}>{iss.createdAt}</span></td>
                    <td style={ss.td}>{iss.isAccident?<span style={{background:"rgba(248,113,113,.2)",color:C.rd,padding:"2px 6px",borderRadius:4,fontSize:9,fontWeight:700}}>🚨 Accident</span>:<span style={{color:C.gr,fontSize:10}}>Normal</span>}</td>
                    <td style={ss.td}><div style={{display:"flex",gap:4}}>
                      {iss.status==="Open"&&<button onClick={()=>upd("issues",arr=>arr.map(x=>x.id===iss.id?{...x,status:"Resolved"}:x))} style={{padding:"3px 8px",borderRadius:5,border:"1px solid "+C.gn,background:G(C.gn,0.1),color:C.gn,cursor:"pointer",fontSize:9,fontFamily:"monospace"}}>Resolve</button>}
                      <button onClick={()=>openEdit("issue",iss)} style={{padding:"3px 8px",borderRadius:5,border:"1px solid "+C.or,background:G(C.or,0.1),color:C.or,cursor:"pointer",fontSize:9,fontFamily:"monospace"}}>Edit</button>
                      <button onClick={()=>setDel({key:"issues",id:iss.id,label:iss.title})} style={{padding:"3px 8px",borderRadius:5,border:"1px solid "+C.rd,background:G(C.rd,0.1),color:C.rd,cursor:"pointer",fontSize:9,fontFamily:"monospace"}}>Del</button>
                    </div></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </div>}
        </div>}

        {/* ══ SALES (Job Orders | Sale Orders | Invoices | Other Incomes | Quotations | Proforma | Debit Notes) ══ */}
        {tab==="sales"&&<div>
          <SubTabs val={salesSub} onChange={setSalesSub} tabs={[
            {v:"jo",l:"Job Orders",icon:"📋"},
            {v:"so",l:"Sale Orders",icon:"📑"},
            {v:"inv",l:"Invoices",icon:"🧾"},
            {v:"otherincome",l:"Other Incomes",icon:"💹"},
            {v:"est",l:"Quotations",icon:"📝"},
            {v:"proforma",l:"Proforma",icon:"📄"},
            {v:"dn",l:"Debit Notes",icon:"⬆"}
          ]}/>

          {/* TAB 1: JOB ORDERS & WBS */}
          {salesSub==="jo"&&<div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
              <div style={{color:C.si,fontSize:11}}>Job Orders define site execution tasks, work breakdown structure (WBS), and budget ceilings derived from Sale Orders.</div>
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
                    <td style={ss.td}>{so ? so.client+" — "+so.desc : (r.client ? r.client+" — "+(r.jobName||"") : "—")}</td>
                    <td style={ss.td}>{sName(r.siteId)}</td>
                    <td style={ss.td}><b style={{color:C.or}}>{INR(totalMat+totalLab+totalMac)}</b></td>
                    <td style={ss.td}>{r.tasks?.length||0} Tasks</td>
                    <td style={ss.td}><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      <button onClick={()=>setViewJo(r)} style={{padding:"3px 8px",borderRadius:6,border:"1px solid "+C.tl,background:G(C.tl,0.1),color:C.tl,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>👁 View</button>
                      <button onClick={()=>genJOPrint(r,co,{siteName:sName(r.siteId),so:(data.saleOrders||[]).find(s=>s.id===r.soId),clientName:r.client})} style={{padding:"3px 8px",borderRadius:6,border:"1px solid "+C.pu,background:G(C.pu,0.1),color:C.pu,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>🖨 Print JO</button>
                      <button onClick={()=>openEdit("jo",r)} style={{padding:"3px 8px",borderRadius:6,border:"1px solid rgba(245,158,11,.3)",background:"rgba(245,158,11,.1)",color:C.or,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Edit</button>
                      <button onClick={()=>setDel({key:"jobOrders",id:r.id,label:r.joNo})} style={{padding:"3px 8px",borderRadius:6,border:"1px solid rgba(248,113,113,.3)",background:"rgba(248,113,113,.1)",color:C.rd,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Del</button>
                    </div></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </div>}

          {/* TAB 2: SALE ORDERS WITH CUMULATIVE RECONCILIATION */}
          {salesSub==="so"&&<div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
              <div style={{color:C.si,fontSize:11}}>Sale Orders contracted with clients with line-item task allocations and cumulative quantity capping.</div>
              <div style={{display:"flex",gap:8}}>
                <Btn onClick={()=>setShowSoRecon(!showSoRecon)} color={C.bl} icon="⚖">{showSoRecon?"Hide Reconciliation":"📊 Sale Orders Reconciliation Matrix"}</Btn>
                <Btn onClick={()=>openAdd("so")} color={C.gn} icon="➕">New Sale Order</Btn>
              </div>
            </div>

            {/* Prompt 7u: Comprehensive Sale Orders Reconciliation Matrix */}
            {showSoRecon && (
              <div style={{...ss.card,padding:14,marginBottom:14,background:"linear-gradient(135deg,#0E1628,#0A1223)",border:"1px solid "+C.bl}}>
                <div style={{color:C.bl,fontWeight:700,fontSize:13,marginBottom:8}}>⚖ Sale Orders &amp; Work Execution Reconciliation Sheet</div>
                <div style={{overflowX:"auto"}}>
                  <table style={{borderCollapse:"collapse",width:"100%",fontSize:10}}>
                    <thead><tr style={{background:"#060C1A"}}>{["Sale Order & Client","Line Item / Scope","SO Qty","Executed in Job Orders","Remaining JO Qty","Billed in Invoices","Invoice Details","Balance to Bill"].map(h=><th key={h} style={ss.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {(fData.saleOrders||[]).flatMap((so)=>{
                        return (so.lineItems||[]).map((li,idx)=>{
                          const soQty = Number(li.qty)||0;
                          const executedJO = (data.jobOrders||[]).filter(j=>j.soId===so.id).flatMap(j=>j.tasks||[]).filter(t=>t.soLineIdx===idx).reduce((a,b)=>a+(Number(b.qty)||0),0);
                          const remJO = Math.max(0, soQty - executedJO);
                          const linkedInvs = (data.sales||[]).filter(s=>s.soId===so.id && s.lineItems && s.lineItems[idx]);
                          const billed = linkedInvs.reduce((a,s)=>a+(Number(s.lineItems[idx].qty)||0),0);
                          const invDetails = linkedInvs.map(s=>`${s.inv} (${s.lineItems[idx].qty} ${li.unit||""})`).join(", ") || "None";
                          const balToBill = Math.max(0, soQty - billed);
                          return <tr key={so.id+"_"+idx} onMouseEnter={e=>e.currentTarget.style.background="#0A1223"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                            <td style={ss.td}><b>{so.soNo||so.id}</b><div style={{fontSize:9,color:C.gr}}>{so.client}</div></td>
                            <td style={ss.td}><b>{li.desc||li.item}</b></td>
                            <td style={{...ss.td,color:C.or,fontWeight:700}}>{soQty} {li.unit}</td>
                            <td style={{...ss.td,color:C.gn,fontWeight:700}}>{executedJO} {li.unit}</td>
                            <td style={{...ss.td,color:remJO>0?C.rd:C.gr}}>{remJO} {li.unit}</td>
                            <td style={{...ss.td,color:C.tl,fontWeight:700}}>{billed} {li.unit}</td>
                            <td style={{...ss.td,fontSize:9,color:C.si}}>{invDetails}</td>
                            <td style={{...ss.td,color:balToBill>0?C.rd:C.gn,fontWeight:700}}>{balToBill} {li.unit}</td>
                          </tr>;
                        });
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

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
                      <button onClick={()=>convertSoToJo(r)} style={{padding:"3px 8px",borderRadius:6,border:"1px solid rgba(245,158,11,.4)",background:"rgba(245,158,11,.12)",color:C.or,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700,whiteSpace:"nowrap"}}>→ Job Order</button>
                      {r.status==="Active"&&<button onClick={()=>convertSoToInv(r)} style={{padding:"3px 8px",borderRadius:6,border:"1px solid rgba(52,211,153,.4)",background:"rgba(52,211,153,.12)",color:C.gn,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700,whiteSpace:"nowrap"}}>→ Invoice</button>}
                      <button onClick={()=>setModal({t:"soProgress",so:r})} style={{padding:"3px 8px",borderRadius:6,border:"1px solid rgba(45,212,191,.3)",background:"rgba(45,212,191,.1)",color:C.tl,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>📊</button>
                      <button onClick={()=>{genInv({...r,inv:r.id},co,masters.clients.find(c=>c.name===r.client),{isEstimate:true,siteName:sName(r.siteId),soObj:r});}} style={{padding:"3px 8px",borderRadius:6,border:"1px solid rgba(167,139,250,.3)",background:"rgba(167,139,250,.1)",color:C.pu,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>🖨</button>
                      <button onClick={()=>openEdit("so",r)} style={{padding:"3px 8px",borderRadius:6,border:"1px solid rgba(245,158,11,.3)",background:"rgba(245,158,11,.1)",color:C.or,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Edit</button>
                      <button onClick={()=>setDel({key:"saleOrders",id:r.id,label:r.desc})} style={{padding:"3px 8px",borderRadius:6,border:"1px solid rgba(248,113,113,.3)",background:"rgba(248,113,113,.1)",color:C.rd,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Del</button>
                    </div></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </div>}

          {/* TAB 3: INVOICES */}
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
              onPrint={i=>{
                const e=byStatus(fData.sales||[],s=>cS(s).net)[i];
                const so=(data.saleOrders||[]).find(s=>s.id===e.soId);
                const jo=(data.jobOrders||[]).find(j=>j.id===(e.joId||e.jobOrderId)||(e.soId&&j.soId===e.soId));
                const cl=masters.clients.find(c=>c.name===e.client);
                const abst=so?getSoProgress(e.soId).map((p,idx)=>{const il=e.lineItems&&e.lineItems[idx];return{...p,thisBill:il?il.qty:0};}):null;
                genInv(e,co,cl,{soAbstract:abst,siteName:sName(e.siteId),soObj:so,joObj:jo});
              }}
              csvName="sales"/>
          </div>}

          {/* TAB 4: OTHER INCOME */}
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

          {/* TAB 5: QUOTATIONS */}
          {salesSub==="est"&&<div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
              <div style={{color:C.si,fontSize:11}}>Client Quotations with locked rates, detailed BOQ, BOM, BBS &amp; Profit Projections.</div>
              <Btn onClick={()=>openAdd("estimate")} color={C.gn} icon="＋">New Quotation</Btn>
            </div>
            <Tbl cols={["Date","Site","Client","Quotation No","Description","Value","Validity","Status","Actions"]}
              rows={(fData.estimates||[]).map(r=>{const li=calcLI(r.lineItems||[]);return[
                r.date,
                sName(r.siteId),
                r.client,
                <b key="e" style={{color:C.pu}}>{r.estNo||r.qtnNo}</b>,
                r.desc,
                <b key="v" style={{color:C.or}}>{INR(li.total)}</b>,
                r.validTill||"—",
                <Tag key="s" c={r.status==="Approved"?"g":r.status==="Sent"?"b":"o"} ch={r.status||"Draft"}/>,
                <div key="act" style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  <button onClick={()=>{
                    const newSO = {
                      id: uid(),
                      soNo: nextDocNo("SO", data.saleOrders||[], "soNo"),
                      date: new Date().toISOString().slice(0,10),
                      siteId: r.siteId,
                      client: r.client,
                      desc: "Converted from Quotation " + (r.estNo||r.qtnNo) + " — " + r.desc,
                      lineItems: r.lineItems||[],
                      status: "Active",
                      convertedInvs: []
                    };
                    upd("saleOrders", arr=>[...arr, newSO]);
                    upd("estimates", arr=>arr.map(x=>x.id===r.id?{...x, status:"Approved", convertedSoId:newSO.id}:x));
                    alert("Quotation converted to Sale Order " + newSO.soNo + "!");
                  }} style={{padding:"2px 8px",borderRadius:5,border:"1px solid "+C.gn,background:G(C.gn,0.1),color:C.gn,cursor:"pointer",fontSize:9,fontFamily:"monospace"}}>Convert SO</button>
                  <button onClick={()=>{
                    const soObj = (data.saleOrders||[]).find(s=>s.id===r.convertedSoId);
                    const cl = masters.clients.find(c=>c.name===r.client);
                    genInv(r, co, cl, {isEstimate:true, siteName:sName(r.siteId), soObj});
                  }} style={{padding:"2px 6px",borderRadius:5,border:"1px solid "+C.or,background:"transparent",color:C.or,cursor:"pointer",fontSize:9,fontFamily:"monospace"}}>Print</button>
                  {["Admin","Manager","Owner"].includes(user.role) && (
                    <button onClick={()=>genConfidentialCostSheet(r, co, {siteName:sName(r.siteId)})} style={{padding:"2px 8px",borderRadius:5,border:"1px solid "+C.pu,background:G(C.pu,0.1),color:C.pu,cursor:"pointer",fontSize:9,fontFamily:"monospace",fontWeight:700}}>🔒 Cost & Profit</button>
                  )}
                </div>
              ];})}
              onEdit={i=>openEdit("estimate",fData.estimates[i])}
              onDel={i=>setDel({key:"estimates",id:fData.estimates[i].id,label:fData.estimates[i].desc})}
              csvName="quotations"/>
          </div>}

          {/* TAB 6: PROFORMA */}
          {salesSub==="proforma"&&<div>
            <Tbl cols={["Date","Site","Client","PF No","Description","Value","Valid Till"]}
              rows={(fData.proforma||[]).map(r=>{const li=calcLI(r.lineItems||[]);return[r.date,sName(r.siteId),r.client,<b key="p" style={{color:C.pu}}>{r.pfNo}</b>,r.desc,<b key="v" style={{color:C.or}}>{INR(li.total)}</b>,r.validTill||"—"];})}
              onEdit={i=>openEdit("proforma",fData.proforma[i])}
              onDel={i=>setDel({key:"proforma",id:fData.proforma[i].id,label:fData.proforma[i].desc})}
              onPrint={i=>{const e=fData.proforma[i];genInv(e,co,masters.clients.find(c=>c.name===e.client),{isProforma:true});}}
              csvName="proforma"/>
          </div>}

          {/* TAB 7: DEBIT NOTES */}
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
        </div>}

        {/* ══ PURCHASE (PR | PO | Bills | Expenses | CN | Input Rates | Reconciliation) ══ */}
        {tab==="purchase"&&<div>
          <SubTabs val={purchSub} onChange={setPurchSub} tabs={[
            {v:"pr",l:"Purchase Requisitions",icon:"📝"},
            {v:"ccs",l:"Commercial Comparison (CCS)",icon:"📊"},
            {v:"po",l:"Purchase Orders",icon:"📋"},
            {v:"bills",l:"Purchase Bills",icon:"🧾"},
            {v:"exp",l:"Expenses",icon:"🔧"},
            {v:"cn",l:"Credit Notes",icon:"⬇"},
            {v:"inputRates",l:"Input Rates & Rates Memory",icon:"🏷"},
            {v:"reconcile",l:"PO Reconciliation",icon:"⚖"}
          ]}/>

          {/* TAB 1: PURCHASE REQUISITIONS (PR) */}
          {purchSub==="pr"&&<div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
              <div style={{color:C.si,fontSize:11}}>Purchase Requisitions auto-load from Job Order Bill of Materials (BOM) with budget cap controls.</div>
              <Btn onClick={()=>openAdd("pr")} color={C.rd} icon="＋">New Requisition (PR)</Btn>
            </div>
            <div style={{...ss.card,overflowX:"auto"}}>
              <table style={{borderCollapse:"collapse",width:"100%"}}>
                <thead><tr style={{background:"#060C1A"}}>{["PR No","Date","Site","Job Order","Material / Service","Req. Qty","Req. Date","Generated By","Approved By","Status","Actions"].map(h=><th key={h} style={ss.th}>{h}</th>)}</tr></thead>
                <tbody>{(data.purchaseRequisitions||[]).length===0?<tr><td colSpan={11} style={{...ss.td,textAlign:"center",color:"#334155",padding:32}}>No Purchase Requisitions</td></tr>:(data.purchaseRequisitions||[]).map((pr,idx)=>{
                  const jo=(data.jobOrders||[]).find(j=>j.id===pr.joId);
                  const isApprover=["Admin","Manager","Owner","Site Manager"].includes(user.role);
                  return <tr key={idx} onMouseEnter={e=>e.currentTarget.style.background="#0A1223"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                    <td style={ss.td}><b style={{color:C.pu}}>{pr.prNo||pr.id}</b></td>
                    <td style={ss.td}>{pr.date}</td>
                    <td style={ss.td}>{sName(pr.siteId)}</td>
                    <td style={ss.td}>{jo ? jo.joNo : pr.joId||"—"}</td>
                    <td style={ss.td}><b>{pr.material}</b><div style={{fontSize:9,color:C.gr}}>{pr.reason||"—"}</div></td>
                    <td style={{...ss.td,color:C.or,fontWeight:700}}>{pr.qty} {pr.unit}</td>
                    <td style={ss.td}>{pr.reqByDate}</td>
                    <td style={ss.td}>{pr.generatedBy}</td>
                    <td style={ss.td}>{pr.approvedBy||<span style={{color:C.gr}}>Pending</span>}</td>
                    <td style={ss.td}><Tag c={pr.status==="Approved"?"g":pr.status==="Rejected"?"r":pr.status==="Converted to PO"?"b":"o"} ch={pr.status}/></td>
                    <td style={ss.td}><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      {isApprover && pr.status==="Pending" && (
                        <>
                          <button onClick={()=>upd("purchaseRequisitions",arr=>arr.map(x=>x.id===pr.id?{...x,status:"Approved",approvedBy:user.name}:x))} style={{padding:"2px 7px",borderRadius:5,border:"1px solid "+C.gn,background:G(C.gn,0.1),color:C.gn,cursor:"pointer",fontSize:9,fontFamily:"monospace"}}>Approve</button>
                          <button onClick={()=>upd("purchaseRequisitions",arr=>arr.map(x=>x.id===pr.id?{...x,status:"Rejected",approvedBy:user.name}:x))} style={{padding:"2px 7px",borderRadius:5,border:"1px solid "+C.rd,background:G(C.rd,0.1),color:C.rd,cursor:"pointer",fontSize:9,fontFamily:"monospace"}}>Reject</button>
                          <button onClick={()=>upd("purchaseRequisitions",arr=>arr.map(x=>x.id===pr.id?{...x,status:"Hold"}:x))} style={{padding:"2px 7px",borderRadius:5,border:"1px solid "+C.or,background:G(C.or,0.1),color:C.or,cursor:"pointer",fontSize:9,fontFamily:"monospace"}}>Hold</button>
                        </>
                      )}
                      <button onClick={()=>setViewPr(pr)} style={{padding:"2px 8px",borderRadius:5,border:"1px solid "+C.tl,background:G(C.tl,0.1),color:C.tl,cursor:"pointer",fontSize:9,fontFamily:"monospace",fontWeight:700}}>👁 View</button>
                      <button onClick={()=>openEdit("pr",pr)} style={{padding:"2px 6px",borderRadius:5,border:"1px solid "+C.or,background:"transparent",color:C.or,cursor:"pointer",fontSize:9,fontFamily:"monospace"}}>Edit</button>
                      <button onClick={()=>setDel({key:"purchaseRequisitions",id:pr.id,label:pr.prNo||pr.material})} style={{padding:"2px 6px",borderRadius:5,border:"1px solid "+C.rd,background:"transparent",color:C.rd,cursor:"pointer",fontSize:9,fontFamily:"monospace"}}>Del</button>
                    </div></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </div>}

          {/* TAB 2: COMMERCIAL COMPARISON SHEET (CCS) */}
          {purchSub==="ccs"&&<div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
              <div style={{color:C.si,fontSize:11}}>Commercial Comparison Sheet (CCS) evaluates multiple vendor quotes against PR based on Landed Rates, Delivery, Payment Terms, and Past Rates Memory. Automatically generates L1, L2, L3 bidder rankings.</div>
              <Btn onClick={()=>openAdd("ccs")} color={C.or} icon="➕">New Comparison (CCS)</Btn>
            </div>
            <div style={{...ss.card,overflowX:"auto"}}>
              <table style={{borderCollapse:"collapse",width:"100%"}}>
                <thead><tr style={{background:"#060C1A"}}>{["Date","CCS No","PR Ref","Site","Material & Qty","Evaluated Quotes & Ranks","Recommended L1","Status","Actions"].map(h=><th key={h} style={ss.th}>{h}</th>)}</tr></thead>
                <tbody>{(data.ccs||[]).length===0?<tr><td colSpan={9} style={{...ss.td,textAlign:"center",color:"#334155",padding:32}}>No Commercial Comparison Sheets</td></tr>:(data.ccs||[]).map((r,idx)=>{
                  const quotes = r.quotes||[];
                  const l1 = quotes.find(q=>q.rank==="L1"||q.isL1) || quotes[0] || {};
                  return <tr key={idx} onMouseEnter={e=>e.currentTarget.style.background="#0A1223"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                    <td style={ss.td}>{r.date}</td>
                    <td style={ss.td}><b style={{color:C.pu}}>{r.ccsNo||r.id}</b></td>
                    <td style={ss.td}>{r.prNo||r.prId||"—"}</td>
                    <td style={ss.td}>{sName(r.siteId)}</td>
                    <td style={ss.td}><b>{r.material}</b><div style={{fontSize:10,color:C.or}}>{r.qty} {r.unit}</div></td>
                    <td style={ss.td}>
                      <div style={{fontSize:10}}>
                        {quotes.map((q,qi)=><div key={qi} style={{display:"flex",gap:4,alignItems:"center",marginBottom:2}}>
                          <Tag c={q.rank==="L1"||q.isL1?"g":"o"} ch={q.rank||("L"+(qi+1))}/>
                          <span style={{color:C.text}}>{q.vendor}:</span>
                          <b style={{color:C.tl}}>{INR(q.landedRate||Math.round(q.rate*(1+(q.gst||18)/100)))}</b>
                          <span style={{color:C.gr,fontSize:9}}>({q.deliveryDays||"—"}d)</span>
                        </div>)}
                      </div>
                    </td>
                    <td style={ss.td}>
                      <span style={{color:C.gn,fontWeight:700}}>⭐ {r.selectedVendor||l1.vendor||"—"}</span>
                      <div style={{fontSize:9,color:C.si}}>Landed: {INR(l1.landedRate||Math.round((l1.rate||0)*(1+(l1.gst||18)/100)))}</div>
                    </td>
                    <td style={ss.td}><Tag c={r.status==="PO Issued"?"b":"g"} ch={r.status||"Evaluated"}/></td>
                    <td style={ss.td}><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      <button onClick={()=>setViewCcs(r)} style={{padding:"3px 8px",borderRadius:5,border:"1px solid "+C.tl,background:G(C.tl,0.1),color:C.tl,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>👁 View</button>
                      <button onClick={()=>printCCS(r,co)} style={{padding:"3px 8px",borderRadius:5,border:"1px solid "+C.or,background:G(C.or,0.1),color:C.or,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>🖨 Print</button>
                      {r.status!=="PO Issued" && (
                        <button onClick={()=>{
                          const chosenQuote = l1;
                          setForm({
                            date: new Date().toISOString().slice(0,10),
                            poNo: nextDocNo("PO", data.purchaseOrders||[], "poNo"),
                            siteId: r.siteId,
                            vendor: chosenQuote.vendor || r.selectedVendor,
                            prId: r.prId,
                            prNo: r.prNo,
                            ccsId: r.id,
                            ccsNo: r.ccsNo,
                            bidderRank: chosenQuote.rank || "L1",
                            landedRate: chosenQuote.landedRate,
                            deliveryDays: chosenQuote.deliveryDays,
                            paymentTerms: chosenQuote.paymentTerms,
                            status: "Active",
                            desc: `Procurement against ${r.prNo||"PR"} as per evaluated CCS ${r.ccsNo} (${chosenQuote.rank||"L1"} Bidder)`,
                            vendorNote: `Issued under CCS ${r.ccsNo} (${chosenQuote.rank||"L1"} Rank). Delivery within ${chosenQuote.deliveryDays||7} days. Terms: ${chosenQuote.paymentTerms||"Credit 30d"}.`,
                            lineItems: [{
                              item: r.material,
                              desc: r.material,
                              hsn: "72142000",
                              prQty: Number(r.qty)||1,
                              qty: Number(r.qty)||1,
                              unit: r.unit||"Nos",
                              rate: chosenQuote.rate||500,
                              gst: chosenQuote.gst||18,
                              disc: 0
                            }]
                          });
                          setModal({t:"txn", mod:"po"});
                        }} style={{padding:"3px 8px",borderRadius:5,border:"1px solid "+C.gn,background:G(C.gn,0.15),color:C.gn,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700,whiteSpace:"nowrap"}}>📑 Issue PO</button>
                      )}
                      <button onClick={()=>setDel({key:"ccs",id:r.id,label:r.ccsNo||r.material})} style={{padding:"3px 6px",borderRadius:5,border:"1px solid "+C.rd,background:"transparent",color:C.rd,cursor:"pointer",fontSize:10,fontFamily:"monospace"}}>Del</button>
                    </div></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </div>}

          {/* TAB 3: PURCHASE ORDERS (PO) WITH 2-PAGE PRINT */}
          {purchSub==="po"&&<div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
              <div style={{color:C.si,fontSize:11}}>Purchase Orders feature automated 2-page print layout with complete PR vs PO vs GRN vs Invoiced reconciliation.</div>
              <Btn onClick={()=>{ alert("Purchase Orders can only be issued through the CCS (Commercial Comparison Sheet) tab after evaluating vendor bids. Redirecting to CCS tab..."); setPurchSub("ccs"); }} color={C.or} icon="📊">New PO via CCS</Btn>
            </div>
            <Tbl cols={["Date","PO Number","Site","Vendor","Description","Order Value","Received","Pending","Status","Actions"]}
              rows={(fData.purchaseOrders||[]).map(r=>{const li=calcLI(r.lineItems||[]);const tv=li.total||0;const recv=(fData.purchases||[]).filter(p=>p.poId===r.id).reduce((a,p)=>a+cP(p).b,0);return[
                r.date,
                <b key="po" style={{color:C.pu}}>{r.poNo||r.id}</b>,
                sName(r.siteId),
                r.vendor,
                r.desc,
                <b key="t" style={{color:C.or}}>{INR(tv)}</b>,
                <span key="r" style={{color:C.gn}}>{INR(recv)}</span>,
                <span key="p" style={{color:C.rd}}>{INR(tv-recv)}</span>,
                <Tag key="s" c={r.status==="Active"?"g":"r"} ch={r.status}/>,
                <div key="act" style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  <button onClick={()=>genPOPrint(r,co,masters.vendors.find(v=>v.name===r.vendor),{dataRef:data,siteName:sName(r.siteId)})} style={{padding:"3px 8px",borderRadius:5,border:"1px solid "+C.pu,background:G(C.pu,0.1),color:C.pu,cursor:"pointer",fontSize:9,fontFamily:"monospace",fontWeight:700}}>🖨 2-Page PO</button>
                  <button onClick={()=>openAdd("matreceipt",{poId:r.id,siteId:r.siteId,vendor:r.vendor,item:r.lineItems?.[0]?.item||"",qty:r.lineItems?.[0]?.qty||1,unit:r.lineItems?.[0]?.unit||"Nos",rate:r.lineItems?.[0]?.rate||0,gst:r.lineItems?.[0]?.gst||18,docType:"GRN"})} style={{padding:"3px 8px",borderRadius:5,border:"1px solid "+C.gn,background:G(C.gn,0.1),color:C.gn,cursor:"pointer",fontSize:9,fontFamily:"monospace",fontWeight:700}}>📦 GRN</button>
                  <button onClick={()=>openAdd("matreceipt",{poId:r.id,siteId:r.siteId,vendor:r.vendor,item:r.lineItems?.[0]?.item||"",qty:r.lineItems?.[0]?.qty||1,unit:r.lineItems?.[0]?.unit||"Nos",rate:r.lineItems?.[0]?.rate||0,gst:r.lineItems?.[0]?.gst||18,docType:"SRN"})} style={{padding:"3px 8px",borderRadius:5,border:"1px solid "+C.tl,background:G(C.tl,0.1),color:C.tl,cursor:"pointer",fontSize:9,fontFamily:"monospace",fontWeight:700}}>🛠 SRN</button>
                </div>
              ];})}
              onEdit={i=>openEdit("po",fData.purchaseOrders[i])} onDel={i=>setDel({key:"purchaseOrders",id:fData.purchaseOrders[i].id,label:fData.purchaseOrders[i].desc})}
              csvName="purchase_orders"/>
          </div>}

          {/* TAB 3: PURCHASE BILLS (WITH ITC GRN LOCK) */}
          {purchSub==="bills"&&<div>
            <div style={{...ss.card,padding:"10px 14px",marginBottom:10,background:G(C.gn,0.06),border:"1px solid "+G(C.gn,0.2),display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{color:C.gn,fontSize:11}}>💡 ITC Claim Rule: 'Claim ITC' button is displayed strictly after GRN entry is punched and 100% quantity is received on site.</span>
              <span style={{color:C.or,fontWeight:700,fontSize:11}}>Pending ITC: {INR((fData.purchases||[]).filter(p=>!p.itcClaimed).reduce((a,p)=>a+cP(p).ga,0))}</span>
            </div>
            <SFilt val={fSt} onChange={setFSt}/>
            <div style={{...ss.card,overflowX:"auto"}}>
              <table style={{borderCollapse:"collapse",width:"100%"}}>
                <thead><tr style={{background:"#060C1A"}}>{["Date","Site","Vendor","Item","HSN","Qty","Rate","Basic","GST%","Total","ITC Status","Paid","Balance","Status","Actions"].map(h=><th key={h} style={ss.th}>{h}</th>)}</tr></thead>
                <tbody>{byStatus(fData.purchases||[],p=>cP(p).tot).length===0?<tr><td colSpan={15} style={{...ss.td,textAlign:"center",color:"#334155",padding:32}}>No bills</td></tr>:byStatus(fData.purchases||[],p=>cP(p).tot).map((r,idx)=>{
                  const c=cP(r),bal=c.tot-(r.paidAmt||0),st=pSt(r.paidAmt||0,c.tot);
                  // Check if GRN received qty for this item is >= purchase bill qty
                  const grnRecv=(data.materialReceipts||[]).filter(m=>(m.poId && m.poId===r.poId) || (m.item||"").toLowerCase()===(r.item||"").toLowerCase()).reduce((a,m)=>a+(Number(m.qty)||0),0);
                  const isGRNComplete = grnRecv >= (Number(r.qty)||0) && grnRecv > 0;

                  return <tr key={idx} onMouseEnter={e=>e.currentTarget.style.background="#0A1223"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                    <td style={ss.td}>{r.date}</td><td style={ss.td}>{sName(r.siteId)}</td><td style={ss.td}>{r.vendor}</td><td style={ss.td}>{r.item}</td>
                    <td style={ss.td}><span style={{color:C.gr,fontSize:10}}>{r.hsn||"—"}</span></td>
                    <td style={ss.td}>{r.qty}</td><td style={ss.td}>{INR(r.rate)}</td><td style={ss.td}>{INR(c.b)}</td>
                    <td style={ss.td}><Tag c="o" ch={r.gst+"%"}/></td>
                    <td style={ss.td}><b style={{color:C.or}}>{INR(c.tot)}</b></td>
                    <td style={ss.td}>
                      {r.itcClaimed ? (
                        <Tag c="g" ch="Claimed"/>
                      ) : isGRNComplete ? (
                        <Tag c="o" ch="Ready to Claim"/>
                      ) : (
                        <span style={{color:C.gr,fontSize:9}}>Await GRN ({grnRecv}/{r.qty})</span>
                      )}
                    </td>
                    <td style={ss.td}><span style={{color:C.gn}}>{INR(r.paidAmt||0)}</span></td>
                    <td style={ss.td}><b style={{color:bal>0?C.rd:C.gn}}>{INR(bal)}</b></td>
                    <td style={ss.td}><Tag c={st==="Paid"?"g":st==="Partial"?"o":"r"} ch={st}/></td>
                    <td style={ss.td}><div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                      {!r.itcClaimed && isGRNComplete && (
                        <button onClick={()=>upd("purchases",arr=>arr.map(x=>x.id===r.id?{...x,itcClaimed:true}:x))} style={{padding:"3px 8px",borderRadius:5,border:"1px solid rgba(52,211,153,.4)",background:"rgba(52,211,153,.1)",color:C.gn,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700,whiteSpace:"nowrap"}}>✓ Claim ITC</button>
                      )}
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

          {/* TAB 4: EXPENSES */}
          {purchSub==="exp"&&<div><SFilt val={fSt} onChange={setFSt}/>
            <Tbl cols={["Date","Site","Category","Description","Amount","Paid","Balance","Status"]}
              rows={byStatus(fData.expenses||[],e=>e.amt).map(r=>{const bal=r.amt-(r.paidAmt||0),st=pSt(r.paidAmt||0,r.amt);return[r.date,sName(r.siteId),<Tag key="c" c="p" ch={r.cat}/>,r.desc,<b key="a" style={{color:C.or}}>{INR(r.amt)}</b>,<span key="p" style={{color:C.gn}}>{INR(r.paidAmt||0)}</span>,<b key="b" style={{color:bal>0?C.rd:C.gn}}>{INR(bal)}</b>,<Tag key="s" c={st==="Paid"?"g":st==="Partial"?"o":"r"} ch={st}/>];})}
              foot={["","","","Total",INR(k.tE),"","",""]}
              onEdit={i=>openEdit("exp",byStatus(fData.expenses||[],e=>e.amt)[i])}
              onDel={i=>{const e=byStatus(fData.expenses||[],e=>e.amt)[i];setDel({key:"expenses",id:e.id,label:e.desc});}}
              onRcv={i=>openRcv("expenses",byStatus(fData.expenses||[],e=>e.amt)[i])} csvName="expenses"/>
          </div>}

          {/* TAB 5: CREDIT NOTES */}
          {purchSub==="cn"&&<div>
            <div style={{...ss.card,padding:"8px 14px",marginBottom:10,background:G(C.gn,0.07),border:`1px solid ${G(C.gn,0.2)}`}}><span style={{color:C.gn,fontSize:11}}>Credit Notes reduce the amount payable to vendor — material returns, quality rejections, or price corrections.</span></div>
            <Tbl cols={["Date","Site","Vendor","CN No","Bill Ref","Reason","Value","Paid","Balance","Status"]}
              rows={byStatus(fData.creditNotes||[],cn=>calcLI(cn.lineItems||[]).total).map(r=>{const tot=calcLI(r.lineItems||[]).total,bal=tot-(r.paidAmt||0),st=pSt(r.paidAmt||0,tot);return[r.date,sName(r.siteId),r.vendor,<b key="c" style={{color:C.gn}}>{r.cnNo}</b>,<span key="ref" style={{color:C.gr,fontSize:10}}>{r.billRef||"—"}</span>,r.reason,<b key="v" style={{color:C.or}}>{INR(tot)}</b>,<span key="p" style={{color:C.gn}}>{INR(r.paidAmt||0)}</span>,<b key="b" style={{color:bal>0?C.rd:C.gn}}>{INR(bal)}</b>,<Tag key="s" c={st==="Paid"?"g":st==="Partial"?"o":"r"} ch={st}/>];})}
              onEdit={i=>openEdit("creditNote",byStatus(fData.creditNotes||[],cn=>calcLI(cn.lineItems||[]).total)[i])}
              onDel={i=>{const e=byStatus(fData.creditNotes||[],cn=>calcLI(cn.lineItems||[]).total)[i];setDel({key:"creditNotes",id:e.id,label:e.cnNo});}}
              onRcv={i=>openRcv("creditNotes",byStatus(fData.creditNotes||[],cn=>calcLI(cn.lineItems||[]).total)[i])} csvName="credit_notes"/>
          </div>}

          {/* TAB 6: INPUT RATES & VENDOR RATE MEMORY */}
          {purchSub==="inputRates"&&<div>
            <div style={{...ss.card,padding:"10px 14px",marginBottom:10,background:G(C.or,0.06),border:"1px solid "+G(C.or,0.2),fontSize:11,color:C.or}}>
              💡 <b>Input Rates &amp; Vendor Rate Memory</b>: Retains real historical prices quoted by vendors across projects to empower strategic procurement.
            </div>
            <MTbl cols={["Type","Item / Input Service","UOM","Standard Rate","GST%","Vendor Rate Memory"]} rows={(masters.inputRates||[]).map(r=>[
              <Tag key="t" c={r.type==="material"?"o":r.type==="service"?"b":r.type==="labour"?"p":"g"} ch={r.type.toUpperCase()}/>,
              <b key="n">{r.name}</b>,
              r.uom,
              <span key="r" style={{color:C.gn,fontWeight:700}}>{INR(r.rate)}</span>,
              r.gst+"%",
              <div key="m" style={{fontSize:10,color:C.si}}>
                {(r.vendorRateMemory||[]).map((v,vi)=><div key={vi}>{v.vendor}: <b style={{color:C.or}}>{INR(v.rate)}</b> <span style={{color:C.gr}}>({v.date})</span></div>)}
              </div>
            ])} onEdit={i=>openMEdit("inputRates",i)} onDel={i=>setDel({key:"inputRates",idx:i,isM:true,label:masters.inputRates[i].name})}/>
          </div>}

          {/* TAB 7: PO RECONCILIATION MATRIX */}
          {purchSub==="reconcile"&&<div>
            <div style={{...ss.card,padding:14,marginBottom:12,background:"linear-gradient(135deg,#0E1628,#0A1223)"}}>
              <div style={{color:C.or,fontWeight:700,fontSize:13,marginBottom:10}}>⚖ Comprehensive PO &amp; Vendor Procurement Reconciliation Matrix</div>
              <div style={{overflowX:"auto"}}>
                <table style={{borderCollapse:"collapse",width:"100%",fontSize:10}}>
                  <thead><tr style={{background:"#060C1A"}}>{["PO Number","Vendor","Project","Job Order","Ordered","Received","Billed","Net Billed","Paid","Outstanding","GRN / Ref","Discrepancy","Status"].map(h=><th key={h} style={ss.th}>{h}</th>)}</tr></thead>
                  <tbody>{(data.purchaseOrders||[]).map((po,pi)=>{
                    const jo=(data.jobOrders||[]).find(j=>j.id===po.jobOrderId);
                    const bills=(data.purchases||[]).filter(p=>p.poId===po.id);
                    const grns=(data.materialReceipts||[]).filter(m=>m.poId===po.id);
                    const ordQty=(po.lineItems||[]).reduce((a,li)=>a+(Number(li.qty)||0),0);
                    const ordVal=(po.lineItems||[]).reduce((a,li)=>a+((Number(li.qty)||0)*(Number(li.rate)||0)*(1+(li.gst||18)/100)),0);
                    const recvQty=grns.reduce((a,g)=>a+(Number(g.qty)||0),0);
                    const billedVal=bills.reduce((a,b)=>a+cP(b).tot,0);
                    const paidVal=bills.reduce((a,b)=>a+(Number(b.paidAmt)||0),0);
                    const outVal=Math.max(0,billedVal-paidVal);
                    const disc=ordQty-recvQty;

                    return <tr key={pi} onMouseEnter={e=>e.currentTarget.style.background="#0A1223"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                      <td style={ss.td}><b style={{color:C.pu}}>{po.poNo||po.id}</b></td>
                      <td style={ss.td}><b>{po.vendor}</b></td>
                      <td style={ss.td}>{sName(po.siteId)}</td>
                      <td style={ss.td}>{jo ? jo.joNo : "—"}</td>
                      <td style={{...ss.td,color:C.or,fontWeight:700}}>{ordQty} nos ({INR(ordVal)})</td>
                      <td style={{...ss.td,color:C.gn}}>{recvQty} nos</td>
                      <td style={ss.td}>{INR(billedVal)}</td>
                      <td style={{...ss.td,fontWeight:700}}>{INR(billedVal)}</td>
                      <td style={{...ss.td,color:C.gn}}>{INR(paidVal)}</td>
                      <td style={{...ss.td,color:outVal>0?C.rd:C.gn,fontWeight:700}}>{INR(outVal)}</td>
                      <td style={ss.td}>{grns.map(g=>g.grnNo).join(", ")||"—"}</td>
                      <td style={ss.td}>{disc > 0 ? <span style={{color:C.rd}}>Short {disc}</span> : <span style={{color:C.gn}}>Matched</span>}</td>
                      <td style={ss.td}><Tag c={po.status==="Active"?"g":"o"} ch={po.status||"Active"}/></td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
            </div>
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

        {/* ══ INVENTORY (Stock | Godowns | GRN | Transfers | Reconciliation) ══ */}
        {tab==="inventory"&&<div>
          <SubTabs val={invSub} onChange={setInvSub} tabs={[
            {v:"stock",l:"Stock",icon:"📦"},
            {v:"godown",l:"Godowns",icon:"🏭"},
            {v:"recv",l:"GRN Entries",icon:"📥"},
            {v:"transfer",l:"Transfers",icon:"↔"},
            {v:"reconcile",l:"Inventory Reconciliation",icon:"⚖"}
          ]}/>
          {invSub==="stock"&&<Tbl cols={["Location","Type","Item","Unit","Opening","Rcvd","Used","Closing","Min","Status","Rate","Value"]}
            rows={(data.inventory||[]).map(r=>{const low=r.close<=r.min;return[r.locType==="site"?sName(r.locId):gName(r.locId),<Tag key="t" c={r.locType==="site"?"b":"o"} ch={r.locType}/>,<b key="i" style={{color:low?C.rd:"#CBD5E1"}}>{r.item}</b>,r.unit,r.open,<span key="rv" style={{color:C.tl}}>{r.recv}</span>,<span key="u" style={{color:C.rd}}>{r.used}</span>,<b key="cl" style={{color:low?C.rd:C.or}}>{r.close}</b>,r.min,<Tag key="s" c={low?"r":"g"} ch={low?"LOW":"OK"}/>,INR(r.rate),<b key="v" style={{color:C.tl}}>{INR(r.close*r.rate)}</b>];})}
            foot={["","","","","","","","","","","Total",INR((data.inventory||[]).reduce((a,b)=>a+b.close*b.rate,0))]}
            onEdit={i=>openEdit("inventory",data.inventory[i])} onDel={i=>setDel({key:"inventory",id:data.inventory[i].id,label:data.inventory[i].item})} csvName="inventory"/>}
          {invSub==="godown"&&<div>{masters.godowns.map(g=><div key={g.id} style={{...ss.card,marginBottom:12,overflow:"hidden"}}><div style={{padding:"8px 14px",borderBottom:BD,background:G(C.bl,0.05)}}><b style={{color:C.or}}>{g.name}</b><span style={{color:C.gr,fontSize:10,marginLeft:10}}>{g.loc}</span></div><table style={{borderCollapse:"collapse",width:"100%",fontSize:11}}><thead><tr style={{background:"#060C1A"}}>{["Item","Unit","Opening","Rcvd","Issued","Closing","Min","Status","Value"].map(h=><th key={h} style={ss.th}>{h}</th>)}</tr></thead><tbody>{(data.inventory||[]).filter(i=>i.locType==="godown"&&i.locId===g.id).map((i,idx)=>{const low=i.close<=i.min;return <tr key={idx}><td style={ss.td}>{i.item}</td><td style={ss.td}>{i.unit}</td><td style={ss.td}>{i.open}</td><td style={{...ss.td,color:C.tl}}>{i.recv}</td><td style={{...ss.td,color:C.rd}}>{i.used}</td><td style={{...ss.td,color:low?C.rd:C.or,fontWeight:700}}>{i.close}</td><td style={ss.td}>{i.min}</td><td style={ss.td}><Tag c={low?"r":"g"} ch={low?"LOW":"OK"}/></td><td style={{...ss.td,color:C.tl,fontWeight:700}}>{INR(i.close*i.rate)}</td></tr>;})}</tbody></table></div>)}</div>}
          {invSub==="recv"&&<div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:10}}>
              <Btn onClick={()=>openAdd("matreceipt")} color={C.or} icon="＋">New GRN Entry</Btn>
            </div>
            <Tbl cols={["Date","GRN No","Location","Vendor","Item","Qty","Unit","Rate","GST","Total Value","Action"]}
              rows={(data.materialReceipts||[]).map(r=>[
                r.date,
                <b key="g" style={{color:C.pu}}>{r.grnNo}</b>,
                r.locType==="site"?sName(r.locId):gName(r.locId),
                r.vendor,
                r.item,
                <b key="q" style={{color:C.gn}}>{r.qty}</b>,
                r.unit,
                INR(r.rate),
                r.gst+"%",
                <b key="t" style={{color:C.or}}>{INR((r.qty||0)*(r.rate||0)*(1+(r.gst||0)/100))}</b>,
                <button key="pr" onClick={()=>printGRN(r,co,{locName:sName(r.locId)})} style={{padding:"3px 8px",borderRadius:5,border:"1px solid "+C.tl,background:G(C.tl,0.1),color:C.tl,cursor:"pointer",fontSize:9,fontFamily:"monospace",fontWeight:700}}>🖨 Print GRN</button>
              ])}
              onEdit={i=>openEdit("matreceipt",data.materialReceipts[i])} onDel={i=>setDel({key:"materialReceipts",id:data.materialReceipts[i].id,label:data.materialReceipts[i].item})} csvName="material_receipts"/>
          </div>}
          {invSub==="transfer"&&<div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:10}}>
              <Btn onClick={()=>openAdd("transfers")} color={C.or} icon="＋">New Stock Transfer</Btn>
            </div>
            <Tbl cols={["Date","From","From Loc","To","To Loc","Item","Qty","Unit","Value","Transfer Status","Action"]}
              rows={(data.stockTransfers||[]).map(r=>[
                r.date,
                <Tag key="ft" c={r.fromType==="site"?"b":"o"} ch={r.fromType}/>,
                r.fromType==="site"?sName(r.fromId):gName(r.fromId),
                <Tag key="tt" c={r.toType==="site"?"b":"o"} ch={r.toType}/>,
                r.toType==="site"?sName(r.toId):gName(r.toId),
                r.item,
                r.qty,
                r.unit,
                <b key="v" style={{color:C.tl}}>{INR((r.qty||0)*(r.rate||0))}</b>,
                <Tag key="st" c={r.status==="Received at Destination"?"g":r.status==="Returned to Origin"?"r":"b"} ch={r.status||"In Transit"}/>,
                <button key="pr" onClick={()=>printStockTransfer(r,co,{fromName:sName(r.fromId),toName:sName(r.toId)})} style={{padding:"3px 8px",borderRadius:5,border:"1px solid "+C.bl,background:G(C.bl,0.1),color:C.bl,cursor:"pointer",fontSize:9,fontFamily:"monospace",fontWeight:700}}>🖨 Print Pass</button>
              ])}
              onEdit={i=>openEdit("transfers",data.stockTransfers[i])} onDel={i=>setDel({key:"stockTransfers",id:data.stockTransfers[i].id,label:data.stockTransfers[i].item})} csvName="transfers"/>
          </div>}

          {/* TAB 5: INVENTORY RECONCILIATION */}
          {invSub==="reconcile"&&<div>
            <div style={{...ss.card,padding:14,marginBottom:12,background:"linear-gradient(135deg,#0E1628,#0A1223)"}}>
              <div style={{color:C.or,fontWeight:700,fontSize:13,marginBottom:10}}>⚖ Comprehensive Material Inventory &amp; Stock Reconciliation</div>
              <div style={{overflowX:"auto"}}>
                <table style={{borderCollapse:"collapse",width:"100%",fontSize:10}}>
                  <thead><tr style={{background:"#060C1A"}}>{["Material Name","Category","Project","Unit","Price / Unit","Ordered Qty","Total Received","Total Consumed","Current Stock","Expected Stock","Variance Qty","Discrepancy","Inventory Value","Last Restocked","Status"].map(h=><th key={h} style={ss.th}>{h}</th>)}</tr></thead>
                  <tbody>{(data.inventory||[]).map((iv,ivi)=>{
                    const ordQty=(data.purchaseOrders||[]).flatMap(p=>p.lineItems||[]).filter(li=>(li.item||li.desc||"").toLowerCase().includes((iv.item||"").toLowerCase())).reduce((a,li)=>a+(Number(li.qty)||0),0);
                    const recvQty=iv.recv||0;
                    const usedQty=iv.used||0;
                    const curStock=iv.close||0;
                    const expStock=(iv.open||0)+recvQty-usedQty;
                    const variance=curStock-expStock;
                    const val=curStock*(iv.rate||0);
                    const low=curStock<=iv.min;

                    return <tr key={ivi} onMouseEnter={e=>e.currentTarget.style.background="#0A1223"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                      <td style={ss.td}><b>{iv.item}</b></td>
                      <td style={ss.td}><Tag c="o" ch={iv.locType==="godown"?"Godown Item":"Site Material"}/></td>
                      <td style={ss.td}>{iv.locType==="site"?sName(iv.locId):gName(iv.locId)}</td>
                      <td style={ss.td}>{iv.unit}</td>
                      <td style={ss.td}>{INR(iv.rate)}</td>
                      <td style={ss.td}>{ordQty} {iv.unit}</td>
                      <td style={{...ss.td,color:C.tl}}>{recvQty} {iv.unit}</td>
                      <td style={{...ss.td,color:C.rd}}>{usedQty} {iv.unit}</td>
                      <td style={{...ss.td,fontWeight:700,color:low?C.rd:C.gn}}>{curStock} {iv.unit}</td>
                      <td style={ss.td}>{expStock} {iv.unit}</td>
                      <td style={{...ss.td,color:variance===0?C.gn:C.rd,fontWeight:700}}>{variance} {iv.unit}</td>
                      <td style={ss.td}>{variance===0?<span style={{color:C.gn}}>Matched</span>:<span style={{color:C.rd}}>Variance {variance}</span>}</td>
                      <td style={{...ss.td,color:C.or,fontWeight:700}}>{INR(val)}</td>
                      <td style={ss.td}>2025-02-15</td>
                      <td style={ss.td}><Tag c={low?"r":"g"} ch={low?"LOW STOCK":"HEALTHY"}/></td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
            </div>
          </div>}
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
                    <td style={ss.td}><div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                      <button onClick={()=>openCheque(c)} style={{padding:"3px 9px",borderRadius:6,border:"1px solid rgba(245,158,11,.3)",background:"rgba(245,158,11,.1)",color:C.or,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Edit</button>
                      {c.status==="Pending"&&<button onClick={()=>{upd("cheques",arr=>arr.map(x=>x.id===c.id?{...x,status:"Cleared"}:x));}} style={{padding:"3px 9px",borderRadius:6,border:"1px solid rgba(52,211,153,.3)",background:"rgba(52,211,153,.1)",color:C.gn,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Clear</button>}
                      {c.status==="Pending"&&<button onClick={()=>{upd("cheques",arr=>arr.map(x=>x.id===c.id?{...x,status:"Bounced"}:x));}} style={{padding:"3px 9px",borderRadius:6,border:"1px solid rgba(248,113,113,.3)",background:"rgba(248,113,113,.1)",color:C.rd,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Bounce</button>}
                      <button onClick={()=>setDel({key:"cheques",id:c.id,label:c.chequeNo+" ("+c.party+")"})} style={{padding:"3px 9px",borderRadius:6,border:"1px solid rgba(248,113,113,.3)",background:"rgba(248,113,113,.1)",color:C.rd,cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Del</button>
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
                    <div style={{display:"flex",gap:4,alignItems:"center"}}>
                      <Tag c={r.status==="Deducted"?"g":r.status==="Filed"?"b":"o"} ch={r.status}/>
                      <button onClick={()=>setEditTds(r)} style={{padding:"2px 7px",borderRadius:5,border:"1px solid "+C.or,background:G(C.or,0.1),color:C.or,cursor:"pointer",fontSize:9,fontFamily:"monospace",fontWeight:700}}>Edit</button>
                      <button onClick={()=>setDel({key:"tdsTcs",id:r.id,label:r.party+" - "+r.section+" ("+INR(r.taxAmt)+")"})} style={{padding:"2px 7px",borderRadius:5,border:"1px solid "+C.rd,background:G(C.rd,0.1),color:C.rd,cursor:"pointer",fontSize:9,fontFamily:"monospace",fontWeight:700}}>Del</button>
                    </div>
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

            {/* EDIT TDS MODAL */}
            {editTds && (
              <Modal title={"EDIT TDS / TCS ENTRY — "+editTds.party} onClose={()=>setEditTds(null)}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
                  <F label="Type"><Sel val={editTds.txnType||"tds"} onChange={v=>setEditTds({...editTds,txnType:v})} opts={[{v:"tds",l:"TDS"},{v:"tcs",l:"TCS"}]}/></F>
                  <F label="Direction"><Sel val={editTds.direction||"receivable"} onChange={v=>setEditTds({...editTds,direction:v})} opts={[{v:"receivable",l:"Receivable (from client)"},{v:"payable",l:"Payable (to govt)"}]}/></F>
                  <F label="Party / Name"><Inp val={editTds.party||""} onChange={v=>setEditTds({...editTds,party:v})}/></F>
                  <F label="Invoice / Bill Ref"><Inp val={editTds.refInv||""} onChange={v=>setEditTds({...editTds,refInv:v})}/></F>
                  <F label="Section"><Sel val={editTds.section||"194C"} onChange={v=>setEditTds({...editTds,section:v})} opts={["194C","194J","194I","194Q","206C","Other"]}/></F>
                  <F label="Status"><Sel val={editTds.status||"Pending"} onChange={v=>setEditTds({...editTds,status:v})} opts={["Pending","Deducted","Filed"]}/></F>
                  <F label="Base Amount"><Num val={editTds.baseAmt||0} onChange={v=>setEditTds({...editTds,baseAmt:v})}/></F>
                  <F label="Tax Amount"><Num val={editTds.taxAmt||0} onChange={v=>setEditTds({...editTds,taxAmt:v})}/></F>
                  <F label="Date"><Inp val={editTds.date||""} onChange={v=>setEditTds({...editTds,date:v})} type="date"/></F>
                  <F label="Challan No"><Inp val={editTds.challNo||""} onChange={v=>setEditTds({...editTds,challNo:v})}/></F>
                </div>
                <div style={{marginTop:14}}>
                  <Btn full onClick={()=>{
                    upd("tdsTcs", arr=>arr.map(x=>x.id===editTds.id?editTds:x));
                    setEditTds(null);
                  }}>Save TDS Changes</Btn>
                </div>
              </Modal>
            )}
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

            {/* SEPARATE PR, PO, WO PROCUREMENT & CONTRACT TRACKING FOR THIS PARTY */}
            <div style={{...ss.card,padding:16,marginTop:16}}>
              <div style={{color:C.or,fontWeight:700,fontSize:12,marginBottom:10}}>📋 Procurement &amp; Work Orders History — {ledName}</div>
              <div style={{overflowX:"auto"}}>
                <table style={{borderCollapse:"collapse",width:"100%",fontSize:10}}>
                  <thead><tr style={{background:"#060C1A"}}>{["Doc Ref","Entity / Vendor","Project","Status","Ordered","Received","Billed","Net Billed","Paid","Outstanding","GRN / INVOICE","Discrepancy","Status"].map(h=><th key={h} style={ss.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {/* Related POs */}
                    {(data.purchaseOrders||[]).filter(p=>ledEnt==="vendor"?p.vendor===ledName:(data.saleOrders||[]).some(s=>s.client===ledName&&s.id===p.soId)).map((po,pi)=>{
                      const bills=(data.purchases||[]).filter(p=>p.poId===po.id);
                      const grns=(data.materialReceipts||[]).filter(m=>m.poId===po.id);
                      const ordVal=(po.lineItems||[]).reduce((a,li)=>a+((Number(li.qty)||0)*(Number(li.rate)||0)*(1+(li.gst||18)/100)),0);
                      const ordQty=(po.lineItems||[]).reduce((a,li)=>a+(Number(li.qty)||0),0);
                      const recvQty=grns.reduce((a,g)=>a+(Number(g.qty)||0),0);
                      const billedVal=bills.reduce((a,b)=>a+cP(b).tot,0);
                      const paidVal=bills.reduce((a,b)=>a+(Number(b.paidAmt)||0),0);
                      const outVal=Math.max(0,billedVal-paidVal);
                      const disc=ordQty-recvQty;
                      return <tr key={"po"+pi}>
                        <td style={ss.td}><b style={{color:C.pu}}>{po.poNo||po.id}</b></td>
                        <td style={ss.td}>{po.vendor}</td>
                        <td style={ss.td}>{sName(po.siteId)}</td>
                        <td style={ss.td}><Tag c="b" ch="PO"/></td>
                        <td style={{...ss.td,color:C.or,fontWeight:700}}>{INR(ordVal)}</td>
                        <td style={{...ss.td,color:C.gn}}>{recvQty} items</td>
                        <td style={ss.td}>{INR(billedVal)}</td>
                        <td style={{...ss.td,fontWeight:700}}>{INR(billedVal)}</td>
                        <td style={{...ss.td,color:C.gn}}>{INR(paidVal)}</td>
                        <td style={{...ss.td,color:outVal>0?C.rd:C.gn,fontWeight:700}}>{INR(outVal)}</td>
                        <td style={ss.td}>{grns.map(g=>g.grnNo).join(", ")||"—"}</td>
                        <td style={ss.td}>{disc>0?<span style={{color:C.rd}}>Short {disc}</span>:<span style={{color:C.gn}}>Matched</span>}</td>
                        <td style={ss.td}><Tag c={po.status==="Active"?"g":"o"} ch={po.status}/></td>
                      </tr>;
                    })}
                    {/* Related Sale Orders / Job Orders */}
                    {(data.saleOrders||[]).filter(s=>ledEnt==="client"?s.client===ledName:false).map((so,si)=>{
                      const billed=(data.sales||[]).filter(s=>s.soId===so.id).reduce((a,s)=>a+cS(s).basic,0);
                      const tv=calcLI(so.lineItems||[]).total||0;
                      return <tr key={"so"+si}>
                        <td style={ss.td}><b style={{color:C.tl}}>{so.soNo||so.id}</b></td>
                        <td style={ss.td}>{so.client}</td>
                        <td style={ss.td}>{sName(so.siteId)}</td>
                        <td style={ss.td}><Tag c="g" ch="Sale Order"/></td>
                        <td style={{...ss.td,color:C.or,fontWeight:700}}>{INR(tv)}</td>
                        <td style={ss.td}>N/A</td>
                        <td style={ss.td}>{INR(billed)}</td>
                        <td style={{...ss.td,fontWeight:700}}>{INR(billed)}</td>
                        <td style={{...ss.td,color:C.gn}}>—</td>
                        <td style={{...ss.td,color:C.rd,fontWeight:700}}>{INR(tv-billed)}</td>
                        <td style={ss.td}>—</td>
                        <td style={ss.td}><span style={{color:C.gn}}>Active</span></td>
                        <td style={ss.td}><Tag c={so.status==="Active"?"g":"o"} ch={so.status}/></td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </div>
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

        {/* ══ SITE DOCUMENTS & OFFICE TEMPLATE GENERATORS ══ */}
        {tab==="sitedocs"&&<div>
          <div style={{...ss.card,padding:16,marginBottom:14,background:"linear-gradient(135deg,#0E1628,#0A1223)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,marginBottom:12}}>
              <div>
                <h3 style={{margin:0,color:C.or,fontSize:14}}>📁 Site Documents &amp; Office Generator</h3>
                <p style={{margin:"2px 0 0",color:C.si,fontSize:11}}>Manage architectural drawings, structural specs, and generate instant executive Word, Excel, and PowerPoint reports.</p>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <Btn onClick={()=>{
                  const repHtml=`<h1>Site Ledger Executive Project Report</h1><p>Date: ${new Date().toLocaleDateString()}</p><h2>1. Financial Health</h2><p>Revenue: ${INR(k.tB)} | Gross Profit: ${INR(k.profit)} (Margin: ${k.margin}%)</p><p>Bank Balance: ${INR(k.totalBankBal)} | Material Cost: ${INR(k.pB)}</p><h2>2. Active Job Orders</h2><table><tr><th>Job Order</th><th>Site</th><th>Budget</th><th>Tasks</th></tr>${(data.jobOrders||[]).map(j=>`<tr><td>${j.joNo}</td><td>${sName(j.siteId)}</td><td>₹${(j.tasks||[]).reduce((a,t)=>a+(Number(t.matBudget)||0)+(Number(t.labBudget)||0)+(Number(t.macBudget)||0),0)}</td><td>${j.tasks?.length||0} tasks</td></tr>`).join("")}</table><h2>3. Issues & Site Hazards</h2><table><tr><th>Title</th><th>Priority</th><th>Due Date</th><th>Status</th></tr>${(data.issues||[]).map(iss=>`<tr><td>${iss.title}</td><td>${iss.priority}</td><td>${iss.dueDate}</td><td>${iss.status}</td></tr>`).join("")}</table>`;
                  downloadDocx("Site_Executive_Report_"+(new Date().toISOString().slice(0,10))+".docx", repHtml);
                }} color={C.bl} icon="📄">Export Word (.docx)</Btn>

                <Btn onClick={()=>{
                  let csv="Type,Ref,Entity,Site,Amount,Status,Date\r\n";
                  (data.sales||[]).forEach(s=>csv+=`Sale Invoice,${s.inv},"${s.client}","${sName(s.siteId)}",${cS(s).net},${s.status||"Active"},${s.date}\r\n`);
                  (data.purchases||[]).forEach(p=>csv+=`Purchase Bill,${p.billNo||p.id},"${p.vendor}","${sName(p.siteId)}",${cP(p).tot},${p.itcClaimed?"Claimed":"Pending"},${p.date}\r\n`);
                  (data.expenses||[]).forEach(e=>csv+=`Site Expense,${e.id},"${e.cat}","${sName(e.siteId)}",${e.amt},Paid,${e.date}\r\n`);
                  (data.jobOrders||[]).forEach(j=>csv+=`Job Order,${j.joNo},Job Order,"${sName(j.siteId)}",${(j.tasks||[]).reduce((a,t)=>a+(Number(t.matBudget)||0),0)},Active,${j.date}\r\n`);
                  downloadXlsx("Site_Ledger_Financial_Summary.xlsx", csv);
                }} color={C.gn} icon="📊">Export Excel (.xlsx)</Btn>

                <Btn onClick={()=>{
                  const slides=`<!DOCTYPE html><html><head><meta charset=utf-8><title>Site Ledger Presentation</title><style>body{font-family:Arial,sans-serif;margin:0;background:#060c1a;color:#fff}.slide{height:100vh;padding:60px 80px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;border-bottom:2px solid #f59e0b}h1{font-size:36px;color:#f59e0b}h2{font-size:24px;color:#60a5fa}p{font-size:18px;color:#cbd5e1;line-height:1.6}.metric{font-size:32px;font-weight:bold;color:#34d399}</style></head><body><div class=slide><h1>${co.name||"Site Ledger"} — Project Review</h1><h2>Civil Contractor Executive Management Deck</h2><p>Date: ${new Date().toLocaleDateString()}</p></div><div class=slide><h1>Financial Overview</h1><p>Revenue from Operations: <span class=metric>${INR(k.tB)}</span></p><p>Total Net Profit: <span class=metric style="color:#f59e0b">${INR(k.profit)}</span> (Margin: ${k.margin}%)</p><p>Current Liquid Bank Balance: <span class=metric style="color:#60a5fa">${INR(k.totalBankBal)}</span></p></div><div class=slide><h1>Job Orders & Operations</h1><p>Active Job Orders: <b>${(data.jobOrders||[]).length} orders</b> across sites.</p><p>Recorded Material Inventory: <b>${(data.inventory||[]).length} stocked lines</b>.</p></div></body></html>`;
                  downloadPptx("Site_Executive_Presentation.html", slides);
                }} color={C.or} icon="📽">Export Presentation (.pptx)</Btn>

                <Btn onClick={()=>{
                  const name=prompt("Enter Document Name (e.g. Pile Load Test Report Rev-1.pdf):");
                  if(!name)return;
                  const type=prompt("Document Type (PDF / DWG / DOCX / XLSX):","PDF");
                  const newDoc={id:uid(),siteId:site==="ALL"?(masters.sites[0]||{}).id||"s1":site,name,type:type||"PDF",date:new Date().toISOString().slice(0,10),size:"2.4 MB"};
                  upd("siteDocs",arr=>[...arr,newDoc]);
                }} color={C.pu} icon="＋">Upload Document</Btn>
              </div>
            </div>
          </div>

          <div style={{...ss.card,overflowX:"auto"}}>
            <table style={{borderCollapse:"collapse",width:"100%"}}>
              <thead><tr style={{background:"#060C1A"}}>{["Document Title","Site / Project","File Type","Date Uploaded","File Size","Actions"].map(h=><th key={h} style={ss.th}>{h}</th>)}</tr></thead>
              <tbody>{(data.siteDocs||[]).filter(d=>site==="ALL"||d.siteId===site).length===0?<tr><td colSpan={6} style={{...ss.td,textAlign:"center",color:"#334155",padding:32}}>No documents uploaded for this site</td></tr>:(data.siteDocs||[]).filter(d=>site==="ALL"||d.siteId===site).map((doc,i)=><tr key={i} onMouseEnter={e=>e.currentTarget.style.background="#0A1223"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                <td style={ss.td}><b>📄 {doc.name}</b></td>
                <td style={ss.td}>{sName(doc.siteId)}</td>
                <td style={ss.td}><Tag c={doc.type==="PDF"?"r":doc.type==="DOCX"?"b":doc.type==="XLSX"?"g":"o"} ch={doc.type}/></td>
                <td style={ss.td}>{doc.date}</td>
                <td style={ss.td}><span style={{color:C.gr,fontSize:10}}>{doc.size}</span></td>
                <td style={ss.td}><div style={{display:"flex",gap:4}}>
                  <button onClick={()=>setViewDoc(doc)} style={{padding:"3px 8px",borderRadius:5,border:"1px solid "+C.tl,background:G(C.tl,0.1),color:C.tl,cursor:"pointer",fontSize:9,fontFamily:"monospace",fontWeight:700}}>View</button>
                  <button onClick={()=>{const b=new Blob([`Mock file content for ${doc.name}`],{type:"text/plain"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=doc.name;a.click();}} style={{padding:"3px 8px",borderRadius:5,border:"1px solid "+C.or,background:G(C.or,0.1),color:C.or,cursor:"pointer",fontSize:9,fontFamily:"monospace"}}>Download</button>
                  <button onClick={()=>upd("siteDocs",arr=>arr.filter(x=>x.id!==doc.id))} style={{padding:"3px 8px",borderRadius:5,border:"1px solid "+C.rd,background:G(C.rd,0.1),color:C.rd,cursor:"pointer",fontSize:9,fontFamily:"monospace"}}>Delete</button>
                </div></td>
              </tr>)}</tbody>
            </table>
          </div>

          {/* DOCUMENT VIEWER MODAL */}
          {viewDoc && (
            <Modal title={"📄 DOCUMENT VIEWER — "+viewDoc.name} onClose={()=>setViewDoc(null)} wide>
              <div style={{background:C.isLight?"#F8FAFC":"#0A1223",padding:14,borderRadius:8,border:"1px solid "+C.br,marginBottom:14}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,fontSize:11}}>
                  <div><span style={{color:C.si,fontSize:10,display:"block",textTransform:"uppercase"}}>Site / Project</span><b>{sName(viewDoc.siteId)}</b></div>
                  <div><span style={{color:C.si,fontSize:10,display:"block",textTransform:"uppercase"}}>File Type</span><Tag c={viewDoc.type==="PDF"?"r":viewDoc.type==="DOCX"?"b":viewDoc.type==="XLSX"?"g":"o"} ch={viewDoc.type}/></div>
                  <div><span style={{color:C.si,fontSize:10,display:"block",textTransform:"uppercase"}}>Upload Date</span><b>{viewDoc.date}</b></div>
                  <div><span style={{color:C.si,fontSize:10,display:"block",textTransform:"uppercase"}}>File Size</span><b>{viewDoc.size}</b></div>
                </div>
              </div>
              <div style={{minHeight:260,background:C.isLight?"#FFFFFF":"#060C1A",border:"1px solid "+C.br,borderRadius:8,padding:20,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center"}}>
                <div style={{fontSize:48,marginBottom:12}}>📐</div>
                <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:6}}>{viewDoc.name}</div>
                <div style={{fontSize:12,color:C.textSub,maxWidth:480,lineHeight:1.6}}>
                  Engineering Blueprint &amp; Technical Site Document Viewer. Registered and verified for site {sName(viewDoc.siteId)}.
                </div>
                <div style={{marginTop:16,display:"flex",gap:10}}>
                  <Btn onClick={()=>{
                    const printHtml = `<div style="padding:30px;font-family:Arial,sans-serif"><h2>${viewDoc.name}</h2><p>Site: ${sName(viewDoc.siteId)} | Date: ${viewDoc.date} | Type: ${viewDoc.type}</p><div style="border:2px dashed #999;height:400px;display:flex;align-items:center;justify-content:center;font-size:20px;color:#666">Technical Blueprint / Document Content</div></div>`;
                    openPrint(printWrapper(printHtml, viewDoc.name, co), viewDoc.name);
                  }} color={C.or} icon="🖨">Print Document</Btn>
                  <Btn onClick={()=>{
                    const b=new Blob([`Site Document Content for ${viewDoc.name}\nSite: ${sName(viewDoc.siteId)}\nDate: ${viewDoc.date}`],{type:"text/plain"});
                    const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=viewDoc.name;a.click();
                  }} color={C.tl} icon="⬇">Download</Btn>
                </div>
              </div>
            </Modal>
          )}
        </div>}

        {/* ══ MASTERS ══ */}
        {tab==="masters"&&can("masters")&&<div>
          <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:14,padding:6,background:"#060C1A",borderRadius:10,width:"fit-content"}}>
            {MTABS.map(t=><button key={t.k} onClick={()=>setMTab(t.k)} style={{padding:"5px 14px",borderRadius:7,border:"none",fontFamily:"monospace",fontSize:10,fontWeight:mTab===t.k?700:400,cursor:"pointer",background:mTab===t.k?"linear-gradient(135deg,#1E2D45,#162236)":"transparent",color:mTab===t.k?C.or:C.gr,borderBottom:"2px solid "+(mTab===t.k?C.or:"transparent")}}>{t.l}</button>)}
          </div>
          {mTab==="uom"&&<MTbl cols={["Name of UOM","Parameter","Conversion Factor","Base Unit"]} rows={(masters.uom||[]).map(r=>[<b key="n" style={{color:C.tl}}>{r.name}</b>,<Tag key="p" c="b" ch={r.param}/>,r.factor,r.baseUnit||"—"])} onEdit={i=>openMEdit("uom",i)} onDel={i=>setDel({key:"uom",idx:i,isM:true,label:masters.uom[i].name})}/>}
          {mTab==="inputRates"&&<div>
            <div style={{...ss.card,padding:"10px 14px",marginBottom:10,background:G(C.or,0.06),border:"1px solid "+G(C.or,0.2),fontSize:11,color:C.or}}>
              💡 <b>Input Rates Master</b>: Feeds directly into Rate Analysis &amp; Cost Analysis for all Items and Services. Vendor rate memory is automatically updated with each purchase.
            </div>
            <MTbl cols={["Type","Item / Service","UOM","Standard Rate","GST%","Vendor Rate Memory"]} rows={(masters.inputRates||[]).map(r=>[
              <Tag key="t" c={r.type==="material"?"o":r.type==="service"?"b":r.type==="labour"?"p":"g"} ch={r.type.toUpperCase()}/>,
              <b key="n">{r.name}</b>,
              r.uom,
              <span key="r" style={{color:C.gn,fontWeight:700}}>{INR(r.rate)}</span>,
              r.gst+"%",
              <div key="m" style={{fontSize:10,color:C.si}}>
                {(r.vendorRateMemory||[]).map((v,vi)=><div key={vi}>{v.vendor}: <b style={{color:C.or}}>{INR(v.rate)}</b> <span style={{color:C.gr}}>({v.date})</span></div>)}
              </div>
            ])} onEdit={i=>openMEdit("inputRates",i)} onDel={i=>setDel({key:"inputRates",idx:i,isM:true,label:masters.inputRates[i].name})}/>
          </div>}
          {mTab==="sites"&&<MTbl cols={["Name","Client","Location","Status"]} rows={masters.sites.map(r=>[r.name,r.client,r.loc,<Tag key="s" c={r.status==="Active"?"g":"r"} ch={r.status}/>])} onEdit={i=>openMEdit("sites",i)} onDel={i=>setDel({key:"sites",idx:i,isM:true,label:masters.sites[i].name})}/>}
          {mTab==="clients"&&<MTbl cols={["Name","Contact","Phone","GST","Bill To","Ship To"]} rows={masters.clients.map(r=>[r.name,r.contact,r.phone,<span key="g" style={{color:C.gr,fontSize:10}}>{r.gst}</span>,r.billTo||"—",r.shipTo||"—"])} onEdit={i=>openMEdit("clients",i)} onDel={i=>setDel({key:"clients",idx:i,isM:true,label:masters.clients[i].name})}/>}
          {mTab==="vendors"&&<MTbl cols={["Name","Contact","Phone","Category","GST"]} rows={masters.vendors.map(r=>[r.name,r.contact,r.phone,<Tag key="c" c="b" ch={r.cat}/>,<span key="g" style={{color:C.gr,fontSize:10}}>{r.gst}</span>])} onEdit={i=>openMEdit("vendors",i)} onDel={i=>setDel({key:"vendors",idx:i,isM:true,label:masters.vendors[i].name})}/>}
          {mTab==="items"&&<MTbl cols={["Name","Unit","Category","HSN","Standard Rate","Rate Analysis Status"]} rows={masters.items.map(r=>[r.name,r.unit,<Tag key="c" c="o" ch={r.cat}/>,<b key="h" style={{color:C.tl}}>{r.hsn}</b>,INR(r.rate),<Tag key="ra" c={r.rateAnalysis?"g":"o"} ch={r.rateAnalysis?"Analyzed":"Basic"}/>])} onEdit={i=>openMEdit("items",i)} onDel={i=>setDel({key:"items",idx:i,isM:true,label:masters.items[i].name})}/>}
          {mTab==="services"&&<MTbl cols={["Name","Unit","Category","SAC Code","Standard Rate","GST","Rate Analysis Status"]} rows={masters.services.map(r=>[r.name,r.unit,<Tag key="c" c="p" ch={r.cat}/>,<b key="s" style={{color:C.tl}}>{r.sac}</b>,INR(r.rate),r.gst+"%",<Tag key="ra" c={r.rateAnalysis?"g":"o"} ch={r.rateAnalysis?"Analyzed":"Basic"}/>])} onEdit={i=>openMEdit("services",i)} onDel={i=>setDel({key:"services",idx:i,isM:true,label:masters.services[i].name})}/>}
          {mTab==="labours"&&<MTbl cols={["Photo","Name","Role","Site","Phone","Wage","PF","KYC"]} rows={masters.labours.map(r=>[r.photo?<img key="ph" src={r.photo} style={{width:32,height:32,objectFit:"cover",borderRadius:"50%",border:"1px solid "+C.br}}/>:<span key="ph" style={{fontSize:20}}>👤</span>,<b key="n">{r.name}</b>,<Tag key="r" c="p" ch={r.role}/>,sName(r.siteId),r.phone,INR(r.wage),<Tag key="p" c={r.pf?"g":"r"} ch={r.pf?"Yes":"No"}/>,r.kyc?<Tag key="k" c="g" ch="Verified"/>:<Tag key="k" c="r" ch="Pending"/>])} onEdit={i=>openMEdit("labours",i)} onDel={i=>setDel({key:"labours",idx:i,isM:true,label:masters.labours[i].name})}/>}
          {mTab==="machinery"&&<MTbl cols={["Machine","Type","Ownership","HSN","Reg","Status"]} rows={masters.machinery.map(r=>[r.name,<Tag key="t" c="b" ch={r.type}/>,<Tag key="o" c={r.owner==="Owned"?"g":"o"} ch={r.owner}/>,<b key="h" style={{color:C.tl}}>{r.hsn||"—"}</b>,r.reg,<Tag key="s" c={r.status==="Active"?"g":r.status==="Maintenance"?"o":"r"} ch={r.status}/>])} onEdit={i=>openMEdit("machinery",i)} onDel={i=>setDel({key:"machinery",idx:i,isM:true,label:masters.machinery[i].name})}/>}
          {mTab==="banks"&&<MTbl cols={["Name","Account No","IFSC","Branch","Opening"]} rows={masters.banks.map(r=>[r.name,r.accNo,r.ifsc,r.branch,INR(r.openBal)])} onEdit={i=>openMEdit("banks",i)} onDel={i=>setDel({key:"banks",idx:i,isM:true,label:masters.banks[i].name})}/>}
          {mTab==="pettyCash"&&<MTbl cols={["Name","Keeper","Opening Balance"]} rows={masters.pettyCash.map(r=>[r.name,r.keeper,INR(r.openBal)])} onEdit={i=>openMEdit("pettyCash",i)} onDel={i=>setDel({key:"pettyCash",idx:i,isM:true,label:masters.pettyCash[i].name})}/>}
          {mTab==="godowns"&&<MTbl cols={["Name","Location","Keeper"]} rows={masters.godowns.map(r=>[r.name,r.loc,r.keeper])} onEdit={i=>openMEdit("godowns",i)} onDel={i=>setDel({key:"godowns",idx:i,isM:true,label:masters.godowns[i].name})}/>}
          {mTab==="users"&&<MTbl cols={["Name","Username","Role","Module Access"]} rows={masters.users.map(r=>[r.name,r.username,<Tag key="r" c="p" ch={r.role}/>,<span key="a" style={{color:C.gr,fontSize:10}}>{(r.moduleAccess||[]).length} modules</span>])} onEdit={i=>openMEdit("users",i)} onDel={i=>setDel({key:"users",idx:i,isM:true,label:masters.users[i].name})}/>}
          {mTab==="expenseCats"&&<div><div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>{(masters.expenseCats||[]).map((c,i)=><Tag key={i} c="p" ch={c}/>)}</div><div style={{display:"flex",gap:8}}><input style={{...ss.inp,marginBottom:0,flex:1}} placeholder="New category..." id="newcat"/><Btn onClick={()=>{const v=document.getElementById("newcat").value.trim();if(v)updM("expenseCats",arr=>[...arr,v]);document.getElementById("newcat").value="";}} color={C.or} icon="＋">Add</Btn><Btn onClick={()=>updM("expenseCats",arr=>arr.slice(0,-1))} color={C.rd}>Remove Last</Btn></div></div>}
          {mTab==="company"&&<div style={{...ss.card,padding:18}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
              <div>
                <div style={{color:C.or,fontWeight:700,fontSize:12,marginBottom:10}}>🏢 Company Details</div>
                {[["Company Name",co.name],["Address",co.addr],["GST",co.gst],["Phone",co.phone],["Email",co.email],["Bank",co.bank],["Account No",co.acc],["IFSC",co.ifsc],["Branch",co.branch],["Signatory",co.sign]].map(([l,v])=><div key={l} style={{display:"flex",padding:"6px 0",borderBottom:"1px solid "+C.br}}><span style={{color:C.si,fontSize:10,width:120,flexShrink:0,textTransform:"uppercase"}}>{l}</span><span style={{color:C.text,fontSize:11}}>{v||"—"}</span></div>)}
              </div>
              <div>
                <div style={{color:C.pu,fontWeight:700,fontSize:12,marginBottom:10}}>👥 Directors, Partners &amp; Investors</div>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead><tr style={{background:"#060C1A"}}><th style={ss.th}>Type</th><th style={ss.th}>Name</th><th style={ss.th}>Share %</th><th style={ss.th}>Investment</th></tr></thead>
                  <tbody>{(co.stakeholders||[]).map((s,si)=><tr key={si}><td style={ss.td}><Tag c="p" ch={s.type}/></td><td style={ss.td}><b>{s.name}</b></td><td style={{...ss.td,color:C.or,fontWeight:700}}>{s.sharePct}%</td><td style={{...ss.td,color:C.gn,fontWeight:700}}>{INR(s.investAmt)}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
            <div style={{marginTop:14}}><Btn onClick={()=>{setForm({...masters.company});setModal({t:"master",key:"company"});}} color={C.or} icon="✎">Edit Company &amp; Stakeholders</Btn></div>
          </div>}
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
              <F label="Font Size"><Sel val={settings.fontSize||12} onChange={v=>setSettings({...settings,fontSize:+v})} opts={[{v:11,l:"Small (11px)"},{v:12,l:"Medium (12px)"},{v:14,l:"Large (14px)"},{v:16,l:"X-Large (16px)"},{v:20,l:"Jumbo (20px)"},{v:24,l:"Accessible (24px)"}]}/></F>
              <F label="Approval Mode">
                <div style={{display:"flex",gap:8,alignItems:"center",marginTop:4}}>
                  <button onClick={()=>{const n={...settings,strictApproval:!settings.strictApproval};setSettings(n);saveSettings(n);}} style={{padding:"6px 12px",borderRadius:6,border:"1px solid "+(settings.strictApproval?C.or:"#1E2D45"),background:settings.strictApproval?G(C.or,0.15):"#060C1A",color:settings.strictApproval?C.or:C.gr,cursor:"pointer",fontFamily:"monospace",fontSize:11,fontWeight:700}}>
                    {settings.strictApproval ? "🔒 Strict Approval (Queue All Data)" : "⚡ Instant Save (Direct DB Persistence)"}
                  </button>
                </div>
              </F>
              <div style={{marginTop:14,display:"flex",gap:8}}>
                <Btn onClick={()=>saveSettings(settings)} color={C.gn} icon="💾">Save Settings</Btn>
                <Btn onClick={()=>{const d=DEF_SETTINGS;setSettings(d);saveSettings(d);}} color={C.gr}>Reset Defaults</Btn>
              </div>
            </div>
            <div style={{...ss.card,padding:20}}>
              <div style={{color:C.or,fontWeight:700,marginBottom:16,fontSize:12,borderBottom:BD,paddingBottom:10}}>💾 Backup &amp; Data Recovery Hub</div>
              <div style={{marginBottom:14,padding:"10px 14px",background:G(C.gn,0.07),borderRadius:8,border:`1px solid ${G(C.gn,0.2)}`}}>
                <div style={{color:C.gn,fontWeight:700,fontSize:11,marginBottom:4}}>⚡ Persistent Synchronous Storage Active</div>
                <div style={{color:C.si,fontSize:10}}>All transaction entries and master changes are instantly preserved across browser sessions, reloads, and logouts.</div>
              </div>
              <div style={{display:"flex",gap:8,flexDirection:"column"}}>
                <Btn onClick={()=>setShowBackupModal(true)} color={C.or} icon="🛡️" full>Open Backup &amp; Restore Center (5 Options)</Btn>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:4}}>
                  <Btn onClick={()=>{
                    const meta={exportedAt:new Date().toISOString(),version:"v12",appName:"Site Ledger ERP"};
                    const blob=new Blob([JSON.stringify({meta,data,masters,settings},null,2)],{type:"application/json"});
                    const a=document.createElement("a");
                    a.href=URL.createObjectURL(blob);
                    a.download="SiteLedger_Backup_"+(new Date().toISOString().slice(0,10))+".json";
                    a.click();
                  }} color={C.tl} icon="⬇" full>JSON Backup</Btn>
                  <Btn onClick={()=>{
                    const lbl="Checkpoint "+(new Date().toLocaleTimeString());
                    saveSnapshot(lbl,data,masters,settings);
                    alert("📸 Checkpoint snapshot '"+lbl+"' saved in browser!");
                  }} color={C.pu} icon="📸" full>Save Snapshot</Btn>
                </div>
                <Btn onClick={()=>{
                  if(window.confirm("Clear all transactions? Your masters will be safely preserved.")) {
                    saveSnapshot("Pre-reset backup",data,masters,settings);
                    setData(INIT_D);
                    persistData(INIT_D);
                    alert("Transactions reset. Masters kept intact.");
                  }
                }} color={C.rd} icon="🗑" full>Reset Transactions (Keep Masters)</Btn>
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
        {!modal.isSale && (
          <div style={{marginTop:8,borderTop:"1px solid #1E2D45",paddingTop:8}}>
            <div style={{color:C.rd,fontSize:10,fontWeight:700,marginBottom:4}}>OTHER VENDOR DEDUCTIONS (Retention, Penalties, Material Rejections)</div>
            <GR cols="1.5fr 1fr">
              <F label="Deduction Remark / Reason"><Inp val={form.payDedRemark||""} onChange={v=>sf("payDedRemark",v)} placeholder="e.g. 5% Retention Money / Quality Penalty"/></F>
              <F label="Deduction Amount (₹)"><Num val={form.payDedAmt||0} onChange={v=>sf("payDedAmt",v)}/></F>
            </GR>
          </div>
        )}
        {(form.rcvTds>0||form.rcvTcs>0||form.payDedAmt>0)&&<div style={{color:C.si,fontSize:10,marginTop:4}}>Net cash {modal.isSale?"received":"paid"}: <b style={{color:C.or}}>{INR(Math.max(0,(Number(form.payAdd)||0)-(form.rcvTds||0)-(form.rcvTcs||0)-(Number(form.payDedAmt)||0)))}</b></div>}
      </div>
      <Btn full onClick={()=>{
        const extraDed=Number(form.payDedAmt)||0;
        if(extraDed>0 && !modal.isSale) {
          // Adjust payable balance by adding deduction to bill paid amount
          form._add = (Number(form.payAdd)||0) + extraDed;
          // Record deduction note in vouchers/ledger
          upd("vouchers",arr=>[...arr,{id:uid(),date:form.payDate,vtype:"out",party:form.client||form.vendor||form.name||"",partyType:"vendor",siteId:form.siteId||"",amt:extraDed,via:"other",accountId:"deduction",desc:`Deduction: ${form.payDedRemark||"Deduction on bill"} (${form.billNo||form.inv||form.item||""})`,ref:"DED"}]);
        }
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
      const TITLES={sales:"SALES INVOICE",so:"SALE ORDER",estimate:"ESTIMATE / QUOTATION",proforma:"PROFORMA INVOICE",debitNote:"DEBIT NOTE",creditNote:"CREDIT NOTE",purch:"PURCHASE BILL",po:"PURCHASE ORDER",exp:"EXPENSE",pay:"PAYROLL",att:"ATTENDANCE",vouchers:"VOUCHER",contra:"CONTRA ENTRY",loans:"LOAN",transfers:"STOCK TRANSFER",matreceipt:form.docType==="SRN"?"SERVICE RECEIVED NOTE (SRN)":"GOODS RECEIVED NOTE (GRN)",inventory:"INVENTORY ENTRY",dpr:"DAILY PROGRESS REPORT",jo:"JOB ORDER & WBS",ccs:"COMMERCIAL COMPARISON SHEET (CCS)"};
      const tt=(isEdit?"EDIT — ":"NEW — ")+(TITLES[mod]||mod.toUpperCase());
      const isWide=["purch","exp","pay","att","loans","transfers","matreceipt","dpr","debitNote","creditNote"].includes(mod);
      const isXWide=["sales","so","po","estimate","proforma","jo","ccs"].includes(mod);
      return <Modal title={tt} onClose={()=>setModal(null)} wide={isWide} xwide={isXWide}>

        {/* SALES INVOICE */}
        {mod==="sales"&&<div>
          <GR cols="1fr 1fr"><F label="Date"><Inp val={form.date} onChange={v=>sf("date",v)} type="date"/></F><F label="Invoice No"><Inp val={form.inv} onChange={v=>sf("inv",v)} placeholder="INV/001/26-27"/></F></GR>
          <GR cols="1fr 1fr">
            <F label="Site"><Sel val={form.siteId} onChange={v=>sf("siteId",v)} opts={siteOpts}/></F>
            <F label="Link Sale Order"><Sel val={form.soId||""} onChange={v=>{
              sf("soId",v);
              const so=(data.saleOrders||[]).find(s=>s.id===v);
              if(so){
                sf("siteId",so.siteId);
                sf("client",so.client);
                if(!form.desc) sf("desc",so.desc);
              }
            }} opts={[{v:"",l:"None (Direct)"},...(data.saleOrders||[]).map(s=>({v:s.id,l:s.client+" — "+s.desc}))]}/></F>
          </GR>
          <GR cols="1fr 1fr">
            <F label="Link Job Order (Optional)"><Sel val={form.joId||""} onChange={v=>{
              sf("joId",v);
              const jo=(data.jobOrders||[]).find(j=>j.id===v);
              if(jo){
                sf("soId",jo.soId);
                sf("siteId",jo.siteId);
                sf("client",jo.client);
                if(jo.jobName&&!form.desc) sf("desc",jo.jobName);
              }
            }} opts={[{v:"",l:"None (Direct)"},...(data.jobOrders||[]).map(j=>({v:j.id,l:j.joNo+" — "+(j.jobName||j.client||sName(j.siteId))}))]}/></F>
            <F label="Client"><Sel val={form.client||""} onChange={v=>sf("client",v)} opts={[{v:"",l:"Select Client"},...masters.clients.map(c=>c.name)]}/></F>
          </GR>
          <GR cols="1fr 1fr">
            <F label="TDS %"><Sel val={form.tds||2} onChange={v=>sf("tds",+v)} opts={[0,1,2,5,10]}/></F>
            <F label="Invoice Type"><Sel val={form.invoiceType||"RA"} onChange={v=>sf("invoiceType",v)} opts={[{v:"RA",l:"Running Account (RA)"},{v:"Final",l:"Final Invoice"},{v:"Supplementary",l:"Supplementary"}]}/></F>
          </GR>

          {/* Prompt 7v: Live Line-Item Billing Guidance (SO Qty, Executed, Prev Billed, Balance to Bill) */}
          {(()=>{
            const linkedSo = (data.saleOrders||[]).find(s=>s.id===form.soId);
            const linkedJo = (data.jobOrders||[]).find(j=>j.id===form.joId);
            if(!linkedSo && !linkedJo) return null;
            const soLines = linkedSo ? (linkedSo.lineItems||[]) : [];
            if(!soLines.length) return null;
            return <div style={{...ss.card,padding:10,marginBottom:12,background:"#060C1A",border:"1px solid "+C.tl}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <span style={{color:C.tl,fontWeight:700,fontSize:11}}>📊 Live Line-Item Billing Reconciliation (SO vs Executed vs Balance)</span>
                <span style={{color:C.gr,fontSize:9}}>{linkedSo?`SO: ${linkedSo.soNo||linkedSo.id}`:""} {linkedJo?`| JO: ${linkedJo.joNo}`:""}</span>
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
                  <thead><tr style={{background:"#0E1729"}}>
                    <th style={{...ss.th,padding:"4px 6px"}}>#</th>
                    <th style={{...ss.th,padding:"4px 6px"}}>Scope / Description</th>
                    <th style={{...ss.th,padding:"4px 6px",textAlign:"right"}}>SO Qty</th>
                    <th style={{...ss.th,padding:"4px 6px",textAlign:"right"}}>Executed Qty</th>
                    <th style={{...ss.th,padding:"4px 6px",textAlign:"right"}}>Prev Billed</th>
                    <th style={{...ss.th,padding:"4px 6px",textAlign:"right"}}>Balance to Bill</th>
                    <th style={{...ss.th,padding:"4px 6px",textAlign:"center"}}>Action</th>
                  </tr></thead>
                  <tbody>{soLines.map((li,idx)=>{
                    const executed = (data.dpr||[]).filter(d=>d.soId===linkedSo.id || (linkedJo && d.jobOrderId===linkedJo.id)).reduce((a,d)=>{
                      const e=(d.entries||[]).find(en=>en.soLineIdx===idx || (en.name||"").toLowerCase().includes((li.desc||"").toLowerCase()));
                      return a+(Number(e?e.completedQty:0)||0);
                    },0);
                    const prevBilled = (data.sales||[]).filter(s=>s.id!==modal.oid && s.soId===linkedSo.id).reduce((a,inv)=>{
                      const il=(inv.lineItems||[])[idx];
                      return a+(Number(il?il.qty:0)||0);
                    },0);
                    const soQty = Number(li.qty)||0;
                    const balToBill = Math.max(0, soQty - prevBilled);
                    return <tr key={idx} style={{borderBottom:"1px solid #1A2840"}}>
                      <td style={{...ss.td,padding:"4px 6px"}}>{idx+1}</td>
                      <td style={{...ss.td,padding:"4px 6px"}}><b>{li.desc||li.item}</b></td>
                      <td style={{...ss.td,padding:"4px 6px",textAlign:"right",color:C.text}}>{soQty} {li.unit}</td>
                      <td style={{...ss.td,padding:"4px 6px",textAlign:"right",color:C.gn,fontWeight:700}}>{executed} {li.unit}</td>
                      <td style={{...ss.td,padding:"4px 6px",textAlign:"right",color:C.si}}>{prevBilled} {li.unit}</td>
                      <td style={{...ss.td,padding:"4px 6px",textAlign:"right",color:balToBill>0?C.or:C.gn,fontWeight:700}}>{balToBill} {li.unit}</td>
                      <td style={{...ss.td,padding:"4px 6px",textAlign:"center"}}>
                        <button type="button" onClick={()=>{
                          const newLI = [...liItems];
                          if(newLI[idx]) {
                            newLI[idx] = { ...newLI[idx], desc: li.desc||li.item, hsn: li.hsn||"995411", unit: li.unit, rate: li.rate||0, gst: li.gst||18, qty: balToBill > 0 ? balToBill : soQty };
                          } else {
                            newLI.push({ desc: li.desc||li.item, hsn: li.hsn||"995411", unit: li.unit, rate: li.rate||0, gst: li.gst||18, qty: balToBill > 0 ? balToBill : soQty, disc: 0 });
                          }
                          sf("lineItems", newLI);
                        }} style={{padding:"2px 6px",borderRadius:4,border:"1px solid "+C.tl,background:G(C.tl,0.1),color:C.tl,fontSize:9,cursor:"pointer",fontFamily:"monospace"}}>Bill Balance</button>
                      </td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
            </div>;
          })()}

          <LineItemsEditor items={liItems} onChange={v=>sf("lineItems",v)} type="service" serviceOpts={masters.services} itemOpts={masters.items} gstOpts={gOpts} showDiscount showHSN/>
          <GR cols="2fr 1fr"><F label="Description (summary)"><Inp val={form.desc} onChange={v=>sf("desc",v)}/></F>
          <div style={{...ss.card,padding:"10px 12px",textAlign:"right",background:"#060C1A"}}><div style={{color:C.si,fontSize:9}}>NET PAYABLE (after TDS)</div><div style={{color:C.or,fontWeight:700,fontFamily:"monospace",fontSize:14}}>{INR(calcLI(liItems).basic*(1-(form.tds||2)/100)+calcLI(liItems).gstAmt)}</div></div></GR>
          <GR cols="1fr 1fr"><F label="Client Work Order No"><Inp val={form.clientWONo||""} onChange={v=>sf("clientWONo",v)} placeholder="WO/2025/001"/></F><F label="Client WO Date"><Inp val={form.clientWODate||""} onChange={v=>sf("clientWODate",v)} type="date"/></F></GR>
          <F label="E-Way Bill No"><Inp val={form.eWayBill||""} onChange={v=>sf("eWayBill",v)} placeholder="EWB-XXXXXXXXXXXXXXXXX"/></F>
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

        {/* JOB ORDER (Prompt 7n, 7o, 7p, 7q) */}
        {mod==="jo"&&<div>
          <GR cols="1fr 1fr"><F label="Date"><Inp val={form.date} onChange={v=>sf("date",v)} type="date"/></F><F label="Job Order No"><Inp val={form.joNo} onChange={v=>sf("joNo",v)} placeholder="JO/001/26-27"/></F></GR>
          <GR cols="1fr 1fr">
            <F label="Link Sale Order">
              <Sel val={form.soId||""} onChange={v=>{
                sf("soId",v);
                const so = (data.saleOrders||[]).find(s=>s.id===v);
                if(so) {
                  sf("siteId", so.siteId);
                  sf("client", so.client);
                  sf("jobName", so.desc);
                  const existingJOs = (data.jobOrders||[]).filter(j=>j.soId===so.id && j.id!==modal.oid);
                  const newTasks = (so.lineItems||[]).map((li,i)=>{
                    const alreadyAlloc = existingJOs.flatMap(j=>j.tasks||[]).filter(t=>t.soLineIdx===i).reduce((a,b)=>a+(Number(b.qty)||0),0);
                    const soQty = Number(li.qty)||1;
                    const avail = Math.max(0, soQty - alreadyAlloc);
                    const rate = Number(li.rate)||1000;
                    const val = avail * rate;
                    return {
                      id: uid()+i,
                      soLineIdx: i,
                      name: li.desc || li.item || ("Task " + (i+1)),
                      unit: li.unit || "Nos",
                      soQty,
                      alreadyAllocated: alreadyAlloc,
                      maxQty: avail,
                      qty: avail,
                      unitRate: rate,
                      phase: i===0?"Site Preparation":i===1?"Foundation & Sub-Structure":"Super Structure & RCC",
                      estStartDate: form.date||new Date().toISOString().slice(0,10),
                      estEndDate: "",
                      matBudget: Math.round(val * 0.45),
                      labBudget: Math.round(val * 0.25),
                      macBudget: Math.round(val * 0.10)
                    };
                  });
                  sf("tasks", newTasks);
                }
              }} opts={[{v:"",l:"Select Sale Order"},...(data.saleOrders||[]).map(s=>({v:s.id,l:s.client+" — "+s.desc}))]}/>
            </F>
            <F label="Site"><Sel val={form.siteId} onChange={v=>sf("siteId",v)} opts={siteOpts}/></F>
          </GR>
          <GR cols="1fr 1fr">
            <F label="Job Description / Name of Job"><Inp val={form.jobName||""} onChange={v=>sf("jobName",v)} placeholder="e.g. NH-48 Full Contract — Zone A Foundation"/></F>
            <F label="Client Name"><Inp val={form.client||""} onChange={v=>sf("client",v)} placeholder="Client name"/></F>
          </GR>

          {/* Prompt 7o & 7p: Task Allocations with SO Qty, Max Available Qty, This JO Qty, and Auto-Budgets */}
          {form.tasks && form.tasks.length > 0 && <div style={{...ss.card, padding:10, marginTop:10, overflowX:"auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div>
                <span style={{color:C.or, fontWeight:700, fontSize:11}}>Task Allocations &amp; Budgets (Auto-Generated from Cost Analysis)</span>
                <span style={{color:C.gr, fontSize:9, marginLeft:8}}>Quantities strictly capped to Sale Order balance</span>
              </div>
              <button type="button" onClick={()=>{
                sf("tasks", [...form.tasks, {id:uid(), name:"", qty:1, maxQty:999999, soQty:1, unit:"Nos", phase:"Finishing & MEP", estStartDate:form.date||new Date().toISOString().slice(0,10), estEndDate:"", matBudget:0, labBudget:0, macBudget:0}]);
              }} style={{padding:"3px 8px",borderRadius:5,border:"1px solid "+C.br,background:"transparent",color:C.gr,fontSize:9,cursor:"pointer"}}>+ Add Custom Task</button>
            </div>
            <table style={{borderCollapse:"collapse", width:"100%", fontSize:10}}>
              <thead><tr style={{background:"#060C1A"}}>
                <th style={{...ss.th, padding:"6px 4px"}}>Phase</th>
                <th style={{...ss.th, padding:"6px 4px"}}>Task Name</th>
                <th style={{...ss.th, padding:"6px 4px", textAlign:"right"}}>SO Qty</th>
                <th style={{...ss.th, padding:"6px 4px", textAlign:"right"}}>Max Avail</th>
                <th style={{...ss.th, padding:"6px 4px", textAlign:"right", color:C.or}}>This JO Qty</th>
                <th style={{...ss.th, padding:"6px 4px"}}>Start Date</th>
                <th style={{...ss.th, padding:"6px 4px"}}>End Date</th>
                <th style={{...ss.th, padding:"6px 4px", textAlign:"right"}}>Mat. Budget</th>
                <th style={{...ss.th, padding:"6px 4px", textAlign:"right"}}>Lab. Budget</th>
                <th style={{...ss.th, padding:"6px 4px", textAlign:"right"}}>Mac. Budget</th>
                <th style={{...ss.th, padding:"6px 4px"}}></th>
              </tr></thead>
              <tbody>{form.tasks.map((t,i)=>{
                const isOver = t.maxQty != null && Number(t.qty) > Number(t.maxQty);
                return <tr key={i} style={{background:isOver?"rgba(248,113,113,0.1)":"transparent"}}>
                  <td style={{...ss.td, padding:"4px"}}><Sel val={t.phase} onChange={v=>sf("tasks", form.tasks.map((x,idx)=>idx===i?{...x, phase:v}:x))} opts={["Site Preparation","Foundation & Sub-Structure","Super Structure & RCC","Finishing & MEP"]}/></td>
                  <td style={{...ss.td, padding:"4px"}}><Inp val={t.name} onChange={v=>sf("tasks", form.tasks.map((x,idx)=>idx===i?{...x, name:v}:x))}/></td>
                  <td style={{...ss.td, padding:"4px", textAlign:"right", color:C.si}}>{t.soQty != null ? `${t.soQty} ${t.unit}` : "—"}</td>
                  <td style={{...ss.td, padding:"4px", textAlign:"right", color:C.gn, fontWeight:700}}>{t.maxQty != null ? `${t.maxQty} ${t.unit}` : "—"}</td>
                  <td style={{...ss.td, padding:"4px", textAlign:"right"}}>
                    <input
                      type="number"
                      style={{...ss.inp, marginBottom:0, fontSize:10, width:75, textAlign:"right", border:isOver?"1px solid "+C.rd:"1px solid #1E2D45", color:isOver?C.rd:C.or, fontWeight:700}}
                      value={t.qty}
                      onChange={e=>{
                        const nQty = Number(e.target.value)||0;
                        const curRate = t.unitRate || 1000;
                        const nextVal = nQty * curRate;
                        sf("tasks", form.tasks.map((x,idx)=>idx===i?{
                          ...x,
                          qty: nQty,
                          matBudget: Math.round(nextVal * 0.45),
                          labBudget: Math.round(nextVal * 0.25),
                          macBudget: Math.round(nextVal * 0.10)
                        }:x));
                      }}
                    />
                  </td>
                  <td style={{...ss.td, padding:"4px"}}><Inp type="date" val={t.estStartDate} onChange={v=>sf("tasks", form.tasks.map((x,idx)=>idx===i?{...x, estStartDate:v}:x))}/></td>
                  <td style={{...ss.td, padding:"4px"}}><Inp type="date" val={t.estEndDate} onChange={v=>sf("tasks", form.tasks.map((x,idx)=>idx===i?{...x, estEndDate:v}:x))}/></td>
                  <td style={{...ss.td, padding:"4px"}}><Num val={t.matBudget} onChange={v=>sf("tasks", form.tasks.map((x,idx)=>idx===i?{...x, matBudget:v}:x))}/></td>
                  <td style={{...ss.td, padding:"4px"}}><Num val={t.labBudget} onChange={v=>sf("tasks", form.tasks.map((x,idx)=>idx===i?{...x, labBudget:v}:x))}/></td>
                  <td style={{...ss.td, padding:"4px"}}><Num val={t.macBudget} onChange={v=>sf("tasks", form.tasks.map((x,idx)=>idx===i?{...x, macBudget:v}:x))}/></td>
                  <td style={{...ss.td, padding:"4px"}}><button type="button" onClick={()=>sf("tasks",form.tasks.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:C.rd,cursor:"pointer",fontWeight:700}}>✕</button></td>
                </tr>;
              })}</tbody>
            </table>
            <div style={{marginTop:8, display:"flex", justifyContent:"space-between", background:"#060C1A", padding:"8px 12px", borderRadius:4, fontSize:11}}>
              <span style={{color:C.tl, fontWeight:700}}>Total Mat Budget: {INR(form.tasks.reduce((a,x)=>a+(Number(x.matBudget)||0),0))}</span>
              <span style={{color:C.pu, fontWeight:700}}>Total Lab Budget: {INR(form.tasks.reduce((a,x)=>a+(Number(x.labBudget)||0),0))}</span>
              <span style={{color:C.or, fontWeight:700}}>Total Mac Budget: {INR(form.tasks.reduce((a,x)=>a+(Number(x.macBudget)||0),0))}</span>
              <span style={{color:C.gn, fontWeight:700}}>Total Est. Cost: {INR(form.tasks.reduce((a,x)=>a+(Number(x.matBudget)||0)+(Number(x.labBudget)||0)+(Number(x.macBudget)||0),0))}</span>
            </div>
          </div>}

          {/* Prompt 7q: Special Instructions in Job Order */}
          <div style={{marginTop:10}}>
            <F label="Special Instructions / Scope of Work Notes">
              <textarea
                style={{...ss.inp, height:60, fontFamily:"monospace", fontSize:11}}
                value={form.specialInstructions||""}
                onChange={e=>sf("specialInstructions",e.target.value)}
                placeholder="Safety precautions, structural tolerances (IS 456), quality test certificate requirements, staging & shuttering norms..."
              />
            </F>
          </div>

          <div style={{marginTop:12}}>
            <Btn full onClick={()=>{
              const overTask = (form.tasks||[]).find(t => t.maxQty != null && Number(t.qty) > Number(t.maxQty));
              if(overTask) {
                return alert(`Validation Error: Quantity for task "${overTask.name}" (${overTask.qty}) exceeds available Sale Order balance (${overTask.maxQty}). Please adjust quantity.`);
              }
              saveRec("jobOrders",form);
              setModal(null);
              setForm({});
            }}>Save Job Order</Btn>
          </div>
        </div>}

        {/* QUOTATION (WITH BBS, BOQ, BOM, LABOUR & MACHINE ESTIMATION & PROFIT ANALYSIS) */}
        {mod==="estimate"&&(()=>{
          const isMgmt = ["Admin", "Manager", "Owner"].includes(user.role);
          const bbsEntries = form.bbsEntries||[];
          const totalRebarKg = bbsEntries.reduce((a,b)=>a+(Number(b.totalKg)||0),0);
          const totalRebarMT = (totalRebarKg/1000).toFixed(3);
          const steelRatePerMT = 56000;
          const rebarCost = (totalRebarKg/1000)*steelRatePerMT;
          const basicOrderValue = calcLI(liItems).basic;
          const projectedMatCost = Math.round(basicOrderValue * 0.45) + Math.round(rebarCost);
          const projectedLabCost = Math.round(basicOrderValue * 0.25);
          const projectedMacCost = Math.round(basicOrderValue * 0.10);
          const totalEstCost = projectedMatCost + projectedLabCost + projectedMacCost;
          const projectedProfit = Math.max(0, basicOrderValue - totalEstCost);
          const profitPct = basicOrderValue ? ((projectedProfit/basicOrderValue)*100).toFixed(1) : 0;

          return <div>
            <div style={{display:"flex",gap:4,marginBottom:12,borderBottom:BD,paddingBottom:6}}>
              {["details","items","bbs","management"].map(tb=>(
                <button key={tb} onClick={()=>sf("_qtnTab",tb)} style={{
                  padding:"5px 12px",borderRadius:6,border:"none",fontFamily:"monospace",fontSize:11,fontWeight:700,cursor:"pointer",
                  background:(form._qtnTab||"details")===tb?C.or:"transparent",color:(form._qtnTab||"details")===tb?C.dk:C.gr
                }}>
                  {tb==="details"?"1. Header & Party":tb==="items"?"2. Line Items & Measurements":tb==="bbs"?"3. Bar Bending Schedule (BBS)":"4. BOQ / BOM & Profit Projections"}
                </button>
              ))}
            </div>

            {/* TAB 1: DETAILS & DRAWING ATTACHMENTS */}
            {(!form._qtnTab || form._qtnTab==="details")&&<div>
              <GR cols="1fr 1fr"><F label="Quotation Date"><Inp val={form.date} onChange={v=>sf("date",v)} type="date"/></F><F label="Quotation No"><Inp val={form.estNo||form.qtnNo} onChange={v=>sf("estNo",v)} placeholder="QTN/001/25-26"/></F></GR>
              <GR cols="1fr 1fr"><F label="Site / Project"><Sel val={form.siteId} onChange={v=>sf("siteId",v)} opts={siteOpts}/></F><F label="Client Name"><Sel val={form.client||""} onChange={v=>{
                sf("client",v);
                const cObj=masters.clients.find(c=>c.name===v);
                if(cObj) { sf("contactPerson", cObj.contact||""); sf("contactPhone", cObj.phone||""); }
              }} opts={[{v:"",l:"Select Client"},...masters.clients.map(c=>c.name)]}/></F></GR>
              <GR cols="1fr 1fr"><F label="Contact Person"><Inp val={form.contactPerson||""} onChange={v=>sf("contactPerson",v)} placeholder="e.g. Chief Engineer"/></F><F label="Contact Phone"><Inp val={form.contactPhone||""} onChange={v=>sf("contactPhone",v)} placeholder="e.g. 9876543210"/></F></GR>
              <GR cols="1fr 1fr"><F label="Quotation Validity Till"><Inp val={form.validTill} onChange={v=>sf("validTill",v)} type="date"/></F><F label="Quotation Status"><Sel val={form.status||"Draft"} onChange={v=>sf("status",v)} opts={["Draft","Sent","Approved","Rejected"]}/></F></GR>
              <F label="Job Description / Scope of Work"><Inp val={form.desc} onChange={v=>sf("desc",v)} placeholder="Detailed job scope & conditions..."/></F>
              <F label="Terms and Conditions (Appears on Quotation Print)">
                <textarea
                  style={{...ss.inp, height:60, fontFamily:"monospace", fontSize:11}}
                  value={form.terms||""}
                  onChange={e=>sf("terms",e.target.value)}
                  placeholder={"1. Payment terms: 30 days from RA bill submission\n2. Taxes: GST extra as applicable at actuals\n3. Price validity: 30 days from date of quotation\n4. Water & electricity provided by client at single point"}
                />
              </F>
              <F label="Attach Client Drawings / Technical Documents">
                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:6}}>
                  {(form.drawings||[]).map((dw,di)=><div key={di} style={{padding:"4px 8px",borderRadius:6,border:"1px solid "+C.tl,background:G(C.tl,0.1),fontSize:10,display:"flex",alignItems:"center",gap:6}}>
                    <span>📄 {dw.name||"Drawing "+(di+1)}</span>
                    <button onClick={()=>sf("drawings",(form.drawings||[]).filter((_,j)=>j!==di))} style={{background:"none",border:"none",color:C.rd,cursor:"pointer"}}>✕</button>
                  </div>)}
                  <button onClick={()=>{
                    const name = prompt("Enter Drawing Name / Ref No (e.g. DWG-RCC-Pier-01):");
                    if(name) sf("drawings",[...(form.drawings||[]),{name,date:new Date().toISOString().slice(0,10)}]);
                  }} style={{padding:"4px 10px",borderRadius:6,border:"1px dashed "+C.br,background:"transparent",color:C.gr,cursor:"pointer",fontSize:10,fontFamily:"monospace"}}>+ Attach Drawing Ref</button>
                </div>
              </F>
            </div>}

            {/* TAB 2: LINE ITEMS & MEASUREMENTS */}
            {form._qtnTab==="items"&&<div>
              <div style={{...ss.card,padding:10,marginBottom:10,background:G(C.gn,0.06),border:"1px solid "+G(C.gn,0.2),fontSize:11,color:C.gn}}>
                💡 Select Items or Services from Masters. Rates can be auto-loaded directly from the active <b>Rate Analysis</b> module.
              </div>
              <LineItemsEditor items={liItems} onChange={v=>sf("lineItems",v)} type="service" serviceOpts={masters.services} itemOpts={masters.items} gstOpts={gOpts} showDiscount showHSN/>
              <div style={{...ss.card,padding:10,marginTop:10,background:"#060C1A"}}>
                <div style={{color:C.or,fontWeight:700,fontSize:11,marginBottom:6}}>📐 Detailed Measurement &amp; Deduction Sheet</div>
                {(form.measurements||[]).map((m,mi)=><div key={mi} style={{display:"grid",gridTemplateColumns:"2fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr auto",gap:4,marginBottom:4}}>
                  <input style={{...ss.inp,marginBottom:0,fontSize:10}} value={m.desc||""} onChange={e=>{const n=[...(form.measurements||[])];n[mi]={...n[mi],desc:e.target.value};sf("measurements",n);}} placeholder="Description / Grid"/>
                  <input type="number" style={{...ss.inp,marginBottom:0,fontSize:10}} value={m.nos||1} onChange={e=>{const n=[...(form.measurements||[])];n[mi]={...n[mi],nos:+e.target.value};sf("measurements",n);}} placeholder="Nos"/>
                  <input type="number" style={{...ss.inp,marginBottom:0,fontSize:10}} value={m.l||0} onChange={e=>{const n=[...(form.measurements||[])];n[mi]={...n[mi],l:+e.target.value};sf("measurements",n);}} placeholder="L (m)"/>
                  <input type="number" style={{...ss.inp,marginBottom:0,fontSize:10}} value={m.b||0} onChange={e=>{const n=[...(form.measurements||[])];n[mi]={...n[mi],b:+e.target.value};sf("measurements",n);}} placeholder="B (m)"/>
                  <input type="number" style={{...ss.inp,marginBottom:0,fontSize:10}} value={m.d||0} onChange={e=>{const n=[...(form.measurements||[])];n[mi]={...n[mi],d:+e.target.value};sf("measurements",n);}} placeholder="D (m)"/>
                  <div style={{color:C.tl,fontWeight:700,fontSize:11,paddingTop:8}}>{((m.nos||1)*(m.l||0)*(m.b||1)*(m.d||1)).toFixed(2)}</div>
                  <button onClick={()=>sf("measurements",(form.measurements||[]).filter((_,j)=>j!==mi))} style={{background:"none",border:"none",color:C.rd,cursor:"pointer"}}>✕</button>
                </div>)}
                <button onClick={()=>sf("measurements",[...(form.measurements||[]),{desc:"",nos:1,l:1,b:1,d:1}])} style={{padding:"4px 10px",borderRadius:6,border:"1px solid "+C.br,background:"transparent",color:C.gr,cursor:"pointer",fontSize:10,fontFamily:"monospace"}}>+ Add Measurement Row</button>
              </div>
            </div>}

            {/* TAB 3: BAR BENDING SCHEDULE (BBS) */}
            {form._qtnTab==="bbs"&&<div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div>
                  <span style={{color:C.or,fontWeight:700,fontSize:12}}>🔩 BAR BENDING SCHEDULE (BBS) SUB-MODULE</span>
                  <div style={{color:C.si,fontSize:10}}>Calculates rebar cut lengths, bend deductions ($1d$ to $4d$), rebar shapes, and total tonnage for BOM/BOQ.</div>
                </div>
                <button onClick={()=>{
                  const n = [...bbsEntries, {
                    id:uid(), element:"Beam", barMark:"B-01 Bottom Bar", dia:16, shape:"L-Bend",
                    a:3.5, b:0.3, c:0.3, d:0, numBars:4, numMembers:2, cutLength:4.036, totalKg:51.04
                  }];
                  sf("bbsEntries", n);
                }} style={{padding:"5px 12px",borderRadius:6,background:C.or,color:"#000",border:"none",fontWeight:700,fontSize:11,cursor:"pointer"}}>+ Add Rebar Schedule</button>
              </div>

              {bbsEntries.map((b,bi)=>{
                // Calculation formulas as per IS 2502
                const dia = Number(b.dia||12);
                const a = Number(b.a||0);
                const bDim = Number(b.b||0);
                const cDim = Number(b.c||0);
                const numBars = Number(b.numBars||1);
                const numMembers = Number(b.numMembers||1);
                const totalBars = numBars * numMembers;
                
                // Cut length calculation by shape
                let cl = a;
                let bendDeductM = 0;
                if(b.shape==="Straight") { cl = a; }
                else if(b.shape==="L-Bend") {
                  bendDeductM = (2 * dia) / 1000; // 90 deg bend = 2d
                  cl = (a + bDim) - bendDeductM;
                } else if(b.shape==="U-Bend") {
                  bendDeductM = (4 * dia) / 1000; // 180 deg hook
                  cl = (a + 2*bDim) - bendDeductM;
                } else if(b.shape==="Cranked") {
                  cl = a + (0.42 * bDim); // 45 deg crank
                } else if(b.shape==="Stirrup") {
                  cl = (2 * (a + bDim)) + (24 * dia / 1000) - (5 * 2 * dia / 1000); // 135 deg hooks with deductions
                }
                const unitWeightKgM = (dia * dia) / 162.2;
                const totWeightKg = cl * totalBars * unitWeightKgM;

                return <div key={bi} style={{...ss.card,padding:12,marginBottom:10,background:"#060C1A",border:"1px solid "+C.br}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1.5fr 0.8fr 1.2fr auto",gap:6,marginBottom:8}}>
                    <select style={{...ss.inp,marginBottom:0,fontSize:10}} value={b.element} onChange={e=>{const n=[...bbsEntries];n[bi]={...n[bi],element:e.target.value};sf("bbsEntries",n);}}>
                      {["Footing","Column","Beam","Slab","Retaining Wall","Staircase"].map(el=><option key={el} value={el}>{el}</option>)}
                    </select>
                    <input style={{...ss.inp,marginBottom:0,fontSize:10}} value={b.barMark} onChange={e=>{const n=[...bbsEntries];n[bi]={...n[bi],barMark:e.target.value};sf("bbsEntries",n);}} placeholder="Bar Mark / Description"/>
                    <select style={{...ss.inp,marginBottom:0,fontSize:10}} value={b.dia} onChange={e=>{const n=[...bbsEntries];n[bi]={...n[bi],dia:+e.target.value};sf("bbsEntries",n);}}>
                      {[8,10,12,16,20,25,32].map(d=><option key={d} value={d}>{d} mm</option>)}
                    </select>
                    <select style={{...ss.inp,marginBottom:0,fontSize:10}} value={b.shape} onChange={e=>{const n=[...bbsEntries];n[bi]={...n[bi],shape:e.target.value};sf("bbsEntries",n);}}>
                      {["Straight","L-Bend","U-Bend","Cranked","Stirrup"].map(sh=><option key={sh} value={sh}>{sh}</option>)}
                    </select>
                    <button onClick={()=>{sf("bbsEntries",bbsEntries.filter((_,j)=>j!==bi));}} style={{background:"none",border:"none",color:C.rd,cursor:"pointer",fontWeight:700}}>✕</button>
                  </div>

                  <div style={{display:"grid",gridTemplateColumns:"120px 1fr 1fr 1fr 1fr 1fr 1fr",gap:8,alignItems:"center"}}>
                    {/* SVG Rebar Bend Drawing */}
                    <div style={{width:110,height:55,background:"#0A1223",borderRadius:6,border:"1px solid "+C.br,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <svg width="100" height="45" viewBox="0 0 100 45">
                        {b.shape==="Straight"&&<line x1="10" y1="22" x2="90" y2="22" stroke={C.or} strokeWidth="3"/>}
                        {b.shape==="L-Bend"&&<polyline points="15,10 15,35 85,35" fill="none" stroke={C.or} strokeWidth="3"/>}
                        {b.shape==="U-Bend"&&<path d="M 15 15 L 15 35 A 8 8 0 0 0 31 35 L 31 20" fill="none" stroke={C.or} strokeWidth="3"/>}
                        {b.shape==="Cranked"&&<polyline points="10,32 35,32 55,14 90,14" fill="none" stroke={C.or} strokeWidth="3"/>}
                        {b.shape==="Stirrup"&&<rect x="20" y="8" width="60" height="28" rx="3" fill="none" stroke={C.or} strokeWidth="2.5"/>}
                      </svg>
                    </div>

                    <div><label style={{fontSize:9,color:C.si}}>Main a (m)</label><input type="number" style={{...ss.inp,marginBottom:0,fontSize:10}} value={b.a||0} onChange={e=>{const n=[...bbsEntries];n[bi]={...n[bi],a:+e.target.value};sf("bbsEntries",n);}}/></div>
                    <div><label style={{fontSize:9,color:C.si}}>Bend b (m)</label><input type="number" style={{...ss.inp,marginBottom:0,fontSize:10}} value={b.b||0} onChange={e=>{const n=[...bbsEntries];n[bi]={...n[bi],b:+e.target.value};sf("bbsEntries",n);}}/></div>
                    <div><label style={{fontSize:9,color:C.si}}>No. of Bars</label><input type="number" style={{...ss.inp,marginBottom:0,fontSize:10}} value={b.numBars||1} onChange={e=>{const n=[...bbsEntries];n[bi]={...n[bi],numBars:+e.target.value};sf("bbsEntries",n);}}/></div>
                    <div><label style={{fontSize:9,color:C.si}}>No. Members</label><input type="number" style={{...ss.inp,marginBottom:0,fontSize:10}} value={b.numMembers||1} onChange={e=>{const n=[...bbsEntries];n[bi]={...n[bi],numMembers:+e.target.value};sf("bbsEntries",n);}}/></div>
                    <div><label style={{fontSize:9,color:C.si}}>Cut Length</label><div style={{color:C.tl,fontWeight:700,fontSize:11,paddingTop:4}}>{cl.toFixed(3)} m</div></div>
                    <div><label style={{fontSize:9,color:C.si}}>Total Weight</label><div style={{color:C.gn,fontWeight:700,fontSize:11,paddingTop:4}}>{totWeightKg.toFixed(2)} kg</div></div>
                  </div>
                </div>;
              })}

              <div style={{...ss.card,padding:12,background:"linear-gradient(135deg,#0E1628,#0A1223)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <span style={{color:C.si,fontSize:11}}>Total Rebar Weight: </span>
                  <b style={{color:C.gn,fontSize:14}}>{totalRebarKg.toFixed(2)} kg</b> &nbsp;(<b style={{color:C.or}}>{totalRebarMT} MT</b>)
                </div>
                <div>
                  <span style={{color:C.si,fontSize:11}}>Estimated Rebar Cost (@ ₹56,000/MT): </span>
                  <b style={{color:C.tl,fontSize:14}}>{INR(rebarCost)}</b>
                </div>
              </div>
            </div>}

            {/* TAB 4: MANAGEMENT ONLY (BOQ, BOM, LABOUR, MACHINE & PROJECTED PROFIT) */}
            {form._qtnTab==="management"&&<div>
              {!isMgmt ? (
                <div style={{padding:20,color:C.rd,textAlign:"center"}}>Access restricted to Admin, Manager and Owner.</div>
              ) : (
                <div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
                    <KCard icon="📑" label="Quotation Value" value={INR(basicOrderValue)} color={C.or}/>
                    <KCard icon="🧱" label="Projected Mat. Cost" value={INR(projectedMatCost)} color={C.tl}/>
                    <KCard icon="👷" label="Projected Lab. Cost" value={INR(projectedLabCost)} color={C.pu}/>
                    <KCard icon="🎯" label="Projected Profit" value={INR(projectedProfit)} sub={"Margin "+profitPct+"%"} color={projectedProfit>0?C.gn:C.rd}/>
                  </div>

                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                    <div style={{...ss.card,padding:14}}>
                      <div style={{color:C.or,fontWeight:700,fontSize:11,marginBottom:8}}>📦 Bill of Materials (BOM) Breakdown</div>
                      <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #1E2D45",fontSize:10}}>
                        <span>TMT Steel Reinforcement (from BBS)</span>
                        <b style={{color:C.gn}}>{totalRebarMT} MT ({INR(rebarCost)})</b>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #1E2D45",fontSize:10}}>
                        <span>Binding Wire &amp; Rolling Margin (3%)</span>
                        <b>{Math.round(totalRebarKg * 0.03)} kg</b>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #1E2D45",fontSize:10}}>
                        <span>Cement &amp; Aggregates (Structural Est.)</span>
                        <b>~{Math.round(basicOrderValue*0.35/400)} Bags / CFT eq.</b>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:10}}>
                        <span>Auxiliary Consumables &amp; Shuttering</span>
                        <b>Lump sum (5%)</b>
                      </div>
                    </div>

                    <div style={{...ss.card,padding:14}}>
                      <div style={{color:C.pu,fontWeight:700,fontSize:11,marginBottom:8}}>🚜 Labour &amp; Tools / Machinery Estimation</div>
                      <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #1E2D45",fontSize:10}}>
                        <span>Bar Bending &amp; Shuttering Crew</span>
                        <b>~{Math.round(basicOrderValue*0.15/800)} ManDays</b>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #1E2D45",fontSize:10}}>
                        <span>Masons &amp; Helpers Concreting Crew</span>
                        <b>~{Math.round(basicOrderValue*0.10/650)} ManDays</b>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #1E2D45",fontSize:10}}>
                        <span>Concrete Mixer &amp; Vibrators Hire</span>
                        <b>~{Math.round(projectedMacCost*0.6)} ₹</b>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:10}}>
                        <span>Excavation / Crane Machinery Hire</span>
                        <b>~{Math.round(projectedMacCost*0.4)} ₹</b>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>}

            <div style={{marginTop:16}}>
              <Btn full onClick={()=>{saveRec("estimates",form);setModal(null);setForm({});}}>Save Quotation</Btn>
            </div>
          </div>;
        })()}

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

        {/* PURCHASE ORDER (Prompt 8d, 8e, 8f, 8g) */}
        {mod==="po"&&<div>
          {/* Linked PR & CCS Banner */}
          {(form.ccsId || form.prId) && (
            <div style={{...ss.card,padding:10,marginBottom:12,background:"#060C1A",border:"1px solid "+C.or}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <span style={{color:C.or,fontWeight:700,fontSize:11}}>📑 Linked Commercial Comparison (CCS) &amp; PR Reference</span>
                <span style={{color:C.gn,fontSize:10,fontWeight:700}}>Awarded to: {form.vendor} ({form.bidderRank||"L1 Bidder"})</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,fontSize:10}}>
                <div><span style={{color:C.si}}>PR No:</span> <b>{form.prNo||form.prId||"—"}</b></div>
                <div><span style={{color:C.si}}>CCS Ref:</span> <b>{form.ccsNo||form.ccsId||"—"}</b></div>
                <div><span style={{color:C.si}}>Landed Rate:</span> <b style={{color:C.tl}}>{INR(form.landedRate||0)}</b></div>
                <div><span style={{color:C.si}}>Delivery:</span> <b>{form.deliveryDays||7} Days</b></div>
              </div>
              {form.paymentTerms&&<div style={{fontSize:10,color:C.gr,marginTop:4}}>Payment Terms: <b style={{color:C.text}}>{form.paymentTerms}</b></div>}
            </div>
          )}

          <GR cols="1fr 1fr"><F label="Date"><Inp val={form.date} onChange={v=>sf("date",v)} type="date"/></F><F label="PO Number"><Inp val={form.poNo||""} onChange={v=>sf("poNo",v)} placeholder="PO/001/26-27"/></F></GR>
          <GR cols="1fr 1fr">
            <F label="Site"><Sel val={form.siteId} onChange={v=>sf("siteId",v)} opts={siteOpts}/></F>
            <F label="Vendor"><Sel val={form.vendor||""} onChange={v=>sf("vendor",v)} opts={[{v:"",l:"Select Vendor"},...masters.vendors.map(v=>v.name)]}/></F>
          </GR>
          <GR cols="1fr 1fr">
            <F label="Link Purchase Requisition (PR)"><Sel val={form.prId||""} onChange={v=>{
              sf("prId",v);
              const pr=(data.purchaseRequisitions||[]).find(p=>p.id===v);
              if(pr){
                sf("prNo",pr.prNo);
                sf("siteId",pr.siteId);
                if(pr.material){
                  sf("lineItems",[{item:pr.material,desc:pr.material,hsn:"72142000",qty:pr.qty||1,unit:pr.unit||"Nos",rate:500,gst:18,disc:0}]);
                }
              }
            }} opts={[{v:"",l:"None (Direct)"},...(data.purchaseRequisitions||[]).map(p=>({v:p.id,l:p.prNo+" — "+p.material+" ("+p.qty+" "+p.unit+")"}))]}/></F>
            <F label="Status"><Sel val={form.status||"Active"} onChange={v=>sf("status",v)} opts={["Active","Completed","Cancelled"]}/></F>
          </GR>

          <F label="Description / Scope of Supply"><Inp val={form.desc} onChange={v=>sf("desc",v)} placeholder="Material supply description"/></F>
          
          {/* Prompt 8f: Provide option to differ the quantity of line items */}
          <div style={{marginBottom:6}}>
            <span style={{fontSize:10,color:C.gr}}>💡 You can adjust/differ line-item quantities and rates as agreed with the vendor:</span>
          </div>
          <LineItemsEditor items={liItems} onChange={v=>sf("lineItems",v)} type="item" serviceOpts={masters.services} itemOpts={masters.items} gstOpts={gOpts} showHSN/>

          <div style={{...ss.card,padding:"10px 12px",textAlign:"right",background:"#060C1A",marginTop:6,marginBottom:10}}>
            <div style={{color:C.si,fontSize:9}}>PURCHASE ORDER VALUE</div>
            <div style={{color:C.or,fontWeight:700,fontFamily:"monospace",fontSize:14}}>{INR(liTotal)}</div>
          </div>

          {/* Prompt 8g: Provide option to attach Vendor Note */}
          <F label="Vendor Note / Special Instructions">
            <textarea
              style={{...ss.inp,height:55,fontFamily:"monospace",fontSize:11}}
              value={form.vendorNote||""}
              onChange={e=>sf("vendorNote",e.target.value)}
              placeholder="Delivery schedule, loading/unloading, test certificates required upon delivery, gate pass instructions..."
            />
          </F>

          <Btn full onClick={()=>{saveRec("purchaseOrders",form);setModal(null);setForm({});}}>Save Purchase Order</Btn>
        </div>}

        {/* PURCHASE BILL (Prompt 8j) */}
        {mod==="purch"&&(()=>{
          const poList = data.purchaseOrders||[];
          const selPo = poList.find(p=>p.id===form.poId);
          const receipts = (data.materialReceipts||[]).filter(m=>m.poId===form.poId);
          const hasReceipt = receipts.length > 0;

          return <div>
            <GR cols="1fr 1fr">
              <F label="Date"><Inp val={form.date} onChange={v=>sf("date",v)} type="date"/></F>
              <F label="Supplier Bill / Invoice No"><Inp val={form.billNo||""} onChange={v=>sf("billNo",v)} placeholder="e.g. SIL/2025/901"/></F>
            </GR>

            {/* Step 1: Select Purchase Order (Mandatory for verification) */}
            <F label="Select Purchase Order (Mandatory: Verifies PR &amp; GRN/SRN)">
              <Sel val={form.poId||""} onChange={v=>{
                sf("poId",v);
                const po=poList.find(p=>p.id===v);
                if(po){
                  sf("siteId",po.siteId);
                  sf("vendor",po.vendor);
                  sf("prId",po.prId||"");
                  sf("prNo",po.prNo||"");
                  sf("jobOrderId",po.jobOrderId||"");
                  if(po.lineItems?.length){
                    const li=po.lineItems[0];
                    sf("item",li.item||li.desc);
                    sf("qty",li.qty);
                    sf("unit",li.unit||"Nos");
                    sf("rate",li.rate);
                    sf("gst",li.gst||18);
                    sf("hsn",li.hsn||"");
                  }
                }
              }} opts={[{v:"",l:"Select Purchase Order (Autofills PR & details)"},...poList.map(p=>({v:p.id,l:`${p.poNo||p.id} — ${p.vendor} (${sName(p.siteId)})`}))]}/>
            </F>

            {/* Prompt 8j: Check if GRN or SRN are punched */}
            {form.poId && (
              <div style={{marginBottom:12}}>
                {hasReceipt ? (
                  <div style={{padding:"8px 12px",borderRadius:6,background:"rgba(52,211,153,0.1)",border:"1px solid "+C.gn,color:C.gn,fontSize:11}}>
                    ✅ <b>Goods / Services Receipt Verified:</b> Received on site under receipt(s): <b>{receipts.map(r=>`${r.grnNo||r.id} (${r.qty} ${r.unit})`).join(", ")}</b>. Eligible for booking Purchase Invoice.
                  </div>
                ) : (
                  <div style={{padding:"10px 14px",borderRadius:6,background:"rgba(248,113,113,0.12)",border:"1px solid "+C.rd,color:C.rd,fontSize:11}}>
                    ⛔ <b>Internal Control Block:</b> Neither GRN (Goods Received Note) nor SRN (Service Received Note) has been punched for PO <b>{selPo?.poNo||form.poId}</b>.
                    <div style={{marginTop:4,fontSize:10,color:C.text}}>Under company accounting guidelines, Purchase Invoice CANNOT be booked without formal GRN/SRN punch verifying actual delivery at site. Please punch GRN/SRN first from the PO list.</div>
                  </div>
                )}
              </div>
            )}

            <GR cols="1fr 1fr">
              <F label="Site"><Sel val={form.siteId} onChange={v=>sf("siteId",v)} opts={siteOpts}/></F>
              <F label="Vendor"><Sel val={form.vendor||""} onChange={v=>sf("vendor",v)} opts={[{v:"",l:"Select Vendor"},...masters.vendors.map(v=>v.name)]}/></F>
            </GR>
            <GR cols="1fr 1fr">
              <F label="Item / Description"><Sel val={form.item||""} onChange={v=>{sf("item",v);const it=masters.items.find(i=>i.name===v);if(it){sf("unit",it.unit);sf("rate",it.rate);sf("gst",it.gst||18);sf("hsn",it.hsn||"");}}} opts={[{v:"",l:"Select Item"},...masters.items.map(i=>i.name)]}/></F>
              <F label="HSN Code"><Inp val={form.hsn||""} onChange={v=>sf("hsn",v)} placeholder="HSN / SAC code"/></F>
            </GR>
            <GR cols="1fr 1fr 1fr">
              <F label="Qty Received/Billed"><Num val={form.qty} onChange={v=>sf("qty",v)}/></F>
              <F label="Unit"><Inp val={form.unit||""} onChange={v=>sf("unit",v)}/></F>
              <F label="Rate"><Num val={form.rate} onChange={v=>sf("rate",v)}/></F>
            </GR>
            <GR cols="1fr 1fr 1fr">
              <F label="Item Category"><Sel val={form.itemCategory||"Goods"} onChange={v=>sf("itemCategory",v)} opts={[{v:"Goods",l:"Goods"},{v:"Services",l:"Services"},{v:"Capital Goods",l:"Capital Goods"}]}/></F>
              <F label="ITC Eligibility"><Sel val={form.itcEligible!==false?"eligible":"ineligible"} onChange={v=>sf("itcEligible",v==="eligible")} opts={[{v:"eligible",l:"Eligible for ITC"},{v:"ineligible",l:"Ineligible for ITC"}]}/></F>
              <F label="GST %"><Sel val={form.gst||18} onChange={v=>sf("gst",+v)} opts={gOpts}/></F>
            </GR>
            <GR cols="1fr 1fr">
              <F label="ITC Claim Status"><Sel val={form.itcClaimed?"yes":"no"} onChange={v=>sf("itcClaimed",v==="yes")} opts={[{v:"no",l:"Pending Claim"},{v:"yes",l:"Claimed"}]}/></F>
              <F label="Vehicle / Transport No"><Inp val={form.vehicleNo||""} onChange={v=>sf("vehicleNo",v)} placeholder="MH-12-AB-1234"/></F>
            </GR>

            {form.qty>0&&form.rate>0&&<div style={{background:G(C.rd,0.07),borderRadius:7,padding:"8px 12px",marginBottom:8,border:"1px solid "+G(C.rd,0.2)}}>{[["Basic",INR((form.qty||0)*(form.rate||0)),"#E2E8F0"],["GST",INR((form.qty||0)*(form.rate||0)*(form.gst||18)/100),C.or],["Total",INR((form.qty||0)*(form.rate||0)*(1+(form.gst||18)/100)),C.rd]].map(([l,v,c],i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span style={{color:C.si}}>{l}</span><span style={{color:c,fontWeight:i===2?700:400,fontFamily:"monospace"}}>{v}</span></div>)}</div>}

            {/* Prompt 8j: Multi-Document Uploader (Purchase Invoice, Delivery Challan, EWB, Weighment slip, Royalties, Test Certificates, Warranty Card) */}
            <div style={{...ss.card,padding:12,marginBottom:12,background:"#060C1A",border:"1px solid "+C.br}}>
              <div style={{color:C.or,fontWeight:700,fontSize:11,marginBottom:8}}>📎 Relevant Purchase Documents Upload</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(130px, 1fr))",gap:8}}>
                {[
                  {k:"doc_invoice",l:"Purchase Invoice"},
                  {k:"doc_challan",l:"Delivery Challan"},
                  {k:"doc_ewb",l:"E-Way Bill (EWB)"},
                  {k:"doc_weighment",l:"Weighment Slip"},
                  {k:"doc_royalty",l:"Royalty Pass"},
                  {k:"doc_test_cert",l:"Test Certificate"},
                  {k:"doc_warranty",l:"Warranty Card"}
                ].map(d=>(
                  <div key={d.k} style={{background:"#0E1729",padding:8,borderRadius:6,border:"1px solid #1E2D45",textAlign:"center"}}>
                    <div style={{fontSize:9,color:C.si,marginBottom:4,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{d.l}</div>
                    {form[d.k] ? (
                      <div style={{position:"relative",width:"100%",height:50,marginBottom:4}}>
                        <img src={form[d.k]} style={{width:"100%",height:50,objectFit:"cover",borderRadius:4,border:"1px solid "+C.tl}}/>
                        <button type="button" onClick={()=>sf(d.k,null)} style={{position:"absolute",top:-4,right:-4,background:C.rd,border:"none",borderRadius:"50%",width:16,height:16,color:"white",cursor:"pointer",fontSize:10}}>✕</button>
                      </div>
                    ) : (
                      <button type="button" onClick={()=>pickImage(url=>sf(d.k,url))} style={{width:"100%",height:50,borderRadius:4,border:"1px dashed "+C.br,background:"transparent",color:C.gr,cursor:"pointer",fontSize:9,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}>
                        <span style={{fontSize:14}}>📷</span> Upload
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Btn full onClick={()=>{
              if(form.poId && !hasReceipt) {
                return alert("Cannot book Purchase Invoice! In accordance with internal controls, a Goods Received Note (GRN) or Service Received Note (SRN) must be punched for this Purchase Order first.");
              }
              saveTxn("purchases");
            }}>Save Purchase Bill</Btn>
          </div>;
        })()}

        {/* COMMERCIAL COMPARISON SHEET (CCS) MODAL (Prompt 8c) */}
        {mod==="ccs"&&(()=>{
          const prList = data.purchaseRequisitions||[];
          const quotes = form.quotes || [
            {vendor:(masters.vendors[0]||{}).name||"",rate:55000,gst:18,deliveryDays:7,paymentTerms:"Credit 30d",pastRate:56000,remarks:"Primary vendor quote"},
            {vendor:(masters.vendors[1]||{}).name||"",rate:57000,gst:18,deliveryDays:5,paymentTerms:"Credit 45d",pastRate:58000,remarks:"Alternative quote"}
          ];

          // Compute landed rates and ranks
          const scoredQuotes = quotes.map((q)=>{
            const landed = Math.round((Number(q.rate)||0) * (1 + (Number(q.gst)||18)/100));
            return { ...q, landedRate: landed };
          });
          const sorted = [...scoredQuotes].sort((a,b)=>(a.landedRate||999999)-(b.landedRate||999999));
          const quotesWithRank = scoredQuotes.map(q=>{
            const rankIdx = sorted.findIndex(s=>(s.vendor===q.vendor && s.rate===q.rate));
            const rank = "L" + (rankIdx + 1);
            return { ...q, rank, isL1: rankIdx === 0 };
          });
          const l1Vendor = sorted[0]?.vendor || "";

          return <div>
            <GR cols="1fr 1fr">
              <F label="CCS Date"><Inp val={form.date||new Date().toISOString().slice(0,10)} onChange={v=>sf("date",v)} type="date"/></F>
              <F label="CCS Number"><Inp val={form.ccsNo||""} onChange={v=>sf("ccsNo",v)} placeholder="CCS/001/26-27"/></F>
            </GR>
            <GR cols="1fr 1fr">
              <F label="Select Purchase Requisition (PR)">
                <Sel val={form.prId||""} onChange={v=>{
                  sf("prId",v);
                  const pr = prList.find(p=>p.id===v);
                  if(pr){
                    sf("prNo", pr.prNo);
                    sf("material", pr.material);
                    sf("qty", pr.qty);
                    sf("unit", pr.unit);
                    sf("siteId", pr.siteId);
                  }
                }} opts={[{v:"",l:"Select PR to compare quotes"},...prList.map(p=>({v:p.id,l:`${p.prNo} — ${p.material} (${p.qty} ${p.unit})`}))]}/>
              </F>
              <F label="Site"><Sel val={form.siteId} onChange={v=>sf("siteId",v)} opts={siteOpts}/></F>
            </GR>
            <GR cols="1.5fr 1fr">
              <F label="Material / Scope"><Inp val={form.material||""} onChange={v=>sf("material",v)}/></F>
              <F label="Requisition Qty"><div style={{display:"flex",gap:4}}><Num val={form.qty||0} onChange={v=>sf("qty",v)}/><Inp val={form.unit||"Nos"} onChange={v=>sf("unit",v)}/></div></F>
            </GR>

            {/* Vendor Quotes Comparison Matrix */}
            <div style={{...ss.card,padding:12,marginBottom:12,background:"#060C1A",border:"1px solid "+C.or}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div>
                  <span style={{color:C.or,fontWeight:700,fontSize:11}}>Vendor Quotes Evaluation (Auto L1/L2/L3 Ranking)</span>
                  <span style={{color:C.gr,fontSize:9,marginLeft:8}}>Compares quoted rates, landed cost, delivery, payment terms &amp; past rates</span>
                </div>
                {quotes.length < 4 && (
                  <button type="button" onClick={()=>{
                    sf("quotes", [...quotes, {vendor:"",rate:0,gst:18,deliveryDays:7,paymentTerms:"Credit 30d",pastRate:0,remarks:""}]);
                  }} style={{padding:"3px 8px",borderRadius:5,border:"1px solid "+C.or,background:G(C.or,0.1),color:C.or,fontSize:9,cursor:"pointer"}}>+ Add Vendor Quote</button>
                )}
              </div>

              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
                  <thead><tr style={{background:"#0E1729"}}>
                    <th style={{...ss.th,padding:"6px 4px"}}>Vendor</th>
                    <th style={{...ss.th,padding:"6px 4px",textAlign:"right"}}>Quoted Rate (₹)</th>
                    <th style={{...ss.th,padding:"6px 4px",textAlign:"center"}}>GST%</th>
                    <th style={{...ss.th,padding:"6px 4px",textAlign:"right",color:C.tl}}>Landed Rate</th>
                    <th style={{...ss.th,padding:"6px 4px",textAlign:"center"}}>Delivery</th>
                    <th style={{...ss.th,padding:"6px 4px"}}>Payment Terms</th>
                    <th style={{...ss.th,padding:"6px 4px",textAlign:"right"}}>Past Rate</th>
                    <th style={{...ss.th,padding:"6px 4px",textAlign:"center"}}>Rank</th>
                    <th style={{...ss.th,padding:"6px 4px"}}>Remarks / Terms</th>
                    <th style={{...ss.th,padding:"6px 4px"}}></th>
                  </tr></thead>
                  <tbody>{quotesWithRank.map((q,i)=>(
                    <tr key={i} style={{background:q.isL1?"rgba(52,211,153,0.06)":"transparent",borderBottom:"1px solid #1A2840"}}>
                      <td style={{...ss.td,padding:"4px"}}>
                        <Sel val={q.vendor} onChange={v=>{
                          const n=[...quotes];
                          const pastMatch = (masters.inputRates||[]).flatMap(ir=>ir.vendorRateMemory||[]).find(vrm=>vrm.vendor===v);
                          n[i]={...n[i],vendor:v,pastRate:pastMatch?pastMatch.rate:n[i].pastRate};
                          sf("quotes",n);
                        }} opts={[{v:"",l:"Select Vendor"},...masters.vendors.map(v=>v.name)]}/>
                      </td>
                      <td style={{...ss.td,padding:"4px",textAlign:"right"}}>
                        <Num val={q.rate} onChange={v=>{const n=[...quotes];n[i]={...n[i],rate:v};sf("quotes",n);}}/>
                      </td>
                      <td style={{...ss.td,padding:"4px",textAlign:"center"}}>
                        <Sel val={q.gst||18} onChange={v=>{const n=[...quotes];n[i]={...n[i],gst:+v};sf("quotes",n);}} opts={gOpts}/>
                      </td>
                      <td style={{...ss.td,padding:"4px",textAlign:"right",color:C.tl,fontWeight:700}}>
                        {INR(q.landedRate)}
                      </td>
                      <td style={{...ss.td,padding:"4px",textAlign:"center"}}>
                        <input type="number" style={{...ss.inp,marginBottom:0,fontSize:10,width:45,textAlign:"center"}} value={q.deliveryDays||7} onChange={e=>{const n=[...quotes];n[i]={...n[i],deliveryDays:+e.target.value};sf("quotes",n);}}/>
                      </td>
                      <td style={{...ss.td,padding:"4px"}}>
                        <Inp val={q.paymentTerms||"Credit 30d"} onChange={v=>{const n=[...quotes];n[i]={...n[i],paymentTerms:v};sf("quotes",n);}}/>
                      </td>
                      <td style={{...ss.td,padding:"4px",textAlign:"right",color:C.si}}>
                        <Num val={q.pastRate||0} onChange={v=>{const n=[...quotes];n[i]={...n[i],pastRate:v};sf("quotes",n);}}/>
                      </td>
                      <td style={{...ss.td,padding:"4px",textAlign:"center"}}>
                        <Tag c={q.isL1?"g":"o"} ch={q.rank}/>
                      </td>
                      <td style={{...ss.td,padding:"4px"}}>
                        <Inp val={q.remarks||""} onChange={v=>{const n=[...quotes];n[i]={...n[i],remarks:v};sf("quotes",n);}} placeholder="Notes, quality, terms"/>
                      </td>
                      <td style={{...ss.td,padding:"4px"}}>
                        {quotes.length > 2 && <button type="button" onClick={()=>{sf("quotes",quotes.filter((_,j)=>j!==i));}} style={{background:"none",border:"none",color:C.rd,cursor:"pointer",fontWeight:700}}>✕</button>}
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>

              {l1Vendor && (
                <div style={{marginTop:10,padding:"8px 12px",borderRadius:6,background:"rgba(52,211,153,0.1)",border:"1px solid "+C.gn,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{color:C.gn,fontSize:11,fontWeight:700}}>⭐ Recommended Bidder: {l1Vendor} (L1 Lowest Landed Cost)</span>
                  <span style={{color:C.si,fontSize:10}}>Complies with PR specifications and delivery timeframe</span>
                </div>
              )}
            </div>

            <Btn full onClick={()=>{
              if(!form.material) return alert("Please specify material / PR scope");
              const evaluatedData = {
                ...form,
                quotes: quotesWithRank,
                selectedVendor: l1Vendor,
                status: "Evaluated"
              };
              saveRec("ccs", evaluatedData);
              setModal(null);
              setForm({});
            }}>Save Commercial Comparison Sheet</Btn>
          </div>;
        })()}

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
          <GR cols="1fr 1fr">
            <F label="Transfer Status"><Sel val={form.status||"In Transit"} onChange={v=>sf("status",v)} opts={["In Transit","Received at Destination","Returned to Origin"]}/></F>
            <F label="Description"><Inp val={form.desc||""} onChange={v=>sf("desc",v)} placeholder="Purpose / vehicle details"/></F>
          </GR>
          <Btn full onClick={()=>saveTxn("stockTransfers")}>Save Transfer</Btn>
        </div>}

        {/* MATERIAL RECEIPT (GRN - autoloads from Purchase Order) */}
        {mod==="matreceipt"&&(()=>{
          const poList=(data.purchaseOrders||[]);
          const selPO=poList.find(p=>p.id===form.poId);
          const poLines=selPO?(selPO.lineItems||[]):[];

          return <div>
            <GR cols="1fr 1fr">
              <F label={form.docType==="SRN"?"SRN Number":"GRN Number"}><Inp val={form.grnNo||""} onChange={v=>sf("grnNo",v)} placeholder={form.docType==="SRN"?"SRN/001/26-27":"GRN/001/26-27"}/></F>
              <F label="Date"><Inp val={form.date||""} onChange={v=>sf("date",v)} type="date"/></F>
            </GR>
            <F label="Select Purchase Order (Required - Autoloads PO items & details)">
              <Sel val={form.poId||""} onChange={v=>{
                sf("poId",v);
                const po=poList.find(p=>p.id===v);
                if(po) {
                  sf("vendor", po.vendor);
                  sf("locType", "site");
                  sf("locId", po.siteId);
                  sf("siteId", po.siteId);
                  if(po.lineItems?.length) {
                    const firstItem=po.lineItems[0];
                    sf("item", firstItem.item||firstItem.desc);
                    sf("poQty", firstItem.qty);
                    sf("qty", firstItem.qty);
                    sf("unit", firstItem.unit||"Nos");
                    sf("rate", firstItem.rate||0);
                    sf("gst", firstItem.gst||18);
                  }
                }
              }} opts={[{v:"",l:"Select Purchase Order"},...poList.map(p=>({v:p.id,l:`${p.poNo||p.id} — ${p.vendor} (${sName(p.siteId)})`}))]}/>
            </F>
            <GR cols="1fr 1fr">
              <F label="Vendor"><Inp val={form.vendor||""} onChange={v=>sf("vendor",v)}/></F>
              <F label="Delivery Destination">
                <Sel val={form.locId||""} onChange={v=>sf("locId",v)} opts={form.locType==="godown"?masters.godowns.map(g=>({v:g.id,l:g.name})):masters.sites.map(s=>({v:s.id,l:s.name}))}/>
              </F>
            </GR>
            {poLines.length>0 ? (
              <F label="PO Line Item">
                <Sel val={form.item||""} onChange={v=>{
                  sf("item",v);
                  const matched=poLines.find(li=>(li.item||li.desc)===v);
                  if(matched) {
                    sf("poQty", matched.qty);
                    sf("qty", matched.qty);
                    sf("unit", matched.unit);
                    sf("rate", matched.rate);
                    sf("gst", matched.gst||18);
                  }
                }} opts={poLines.map(li=>({v:li.item||li.desc,l:`${li.item||li.desc} (PO Qty: ${li.qty} ${li.unit})`}))}/>
              </F>
            ) : (
              <F label="Item / Description"><Inp val={form.item||""} onChange={v=>sf("item",v)}/></F>
            )}
            <GR cols="1fr 1fr 1fr">
              <F label="PO Order Qty"><Num val={form.poQty||0} onChange={v=>sf("poQty",v)} placeholder="0"/></F>
              <F label="Actually Received Qty"><Num val={form.qty||0} onChange={v=>sf("qty",v)}/></F>
              <F label="Unit"><Inp val={form.unit||"Nos"} onChange={v=>sf("unit",v)}/></F>
            </GR>
            <GR cols="1fr 1fr">
              <F label="Rate"><Num val={form.rate||0} onChange={v=>sf("rate",v)}/></F>
              <F label="GST %"><Sel val={form.gst||18} onChange={v=>sf("gst",+v)} opts={gOpts}/></F>
            </GR>
            <F label="Inspection Remarks & Quality Notes"><Inp val={form.remarks||""} onChange={v=>sf("remarks",v)} placeholder="Condition, weight check, shortfall, damages..."/></F>
            <Btn full onClick={()=>{
              if(!form.item||!form.qty) return alert("Please specify item and received quantity");
              saveTxn("materialReceipts");
            }}>{form.docType==="SRN"?"Save Service Received Note (SRN)":"Save Material Receipt (GRN)"}</Btn>
          </div>;
        })()}

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

        {/* DPR (punched against Job Order with live PO & site stock balances and accident reporting) */}
        {mod==="dpr"&&<div>
          <GR cols="1fr 1fr"><F label="Date"><Inp val={form.date||""} onChange={v=>sf("date",v)} type="date"/></F><F label="Site"><Sel val={form.siteId||""} onChange={v=>sf("siteId",v)} opts={siteOpts}/></F></GR>
          <GR cols="1fr 1fr">
            <F label="Link Job Order (Required)">
              <Sel val={form.jobOrderId||""} onChange={v=>{
                sf("jobOrderId",v);
                const jo=(data.jobOrders||[]).find(j=>j.id===v);
                if(jo){
                  sf("soId", jo.soId);
                  sf("siteId", jo.siteId);
                  const entries=(jo.tasks||[]).map((t,idx)=>({type:"service",name:t.name,taskId:t.id,soLineIdx:idx,completedQty:0,unit:t.unit,remarks:""}));
                  sf("entries",entries);
                }
              }} opts={[{v:"",l:"Select Job Order"},...(data.jobOrders||[]).filter(j=>!form.siteId || j.siteId===form.siteId).map(j=>({v:j.id,l:j.joNo+" — "+sName(j.siteId)}))]}/>
            </F>
            <F label="Supervisor"><Sel val={form.supervisor||""} onChange={v=>sf("supervisor",v)} opts={[{v:"",l:"Select Supervisor"},...masters.labours.filter(l=>l.role==="Supervisor").map(l=>l.name)]}/></F>
          </GR>
          <F label="Weather Condition"><Sel val={form.weather||"Clear"} onChange={v=>sf("weather",v)} opts={["Clear","Cloudy","Rain","Hot","Cold"]}/></F>
          
          {/* CATEGORY-WISE WORKER ATTENDANCE (Prompt 6b) */}
          {(()=>{
            const cats = form.workerCats || { mason: 0, carpenter: 0, welder: 0, helper: 0, supervisor: 0, operator: 0, other: 0 };
            const totalWorkers = Object.values(cats).reduce((a,b)=>a+(Number(b)||0), 0);
            const siteLabours = (masters.labours||[]).filter(l=>!form.siteId||l.siteId===form.siteId||l.role);
            return <div style={{...ss.card,padding:12,marginBottom:12,background:"#060C1A",border:"1px solid "+C.br}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div>
                  <span style={{color:C.tl,fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:.5}}>👷 Workers on Site (Category-wise Attendance)</span>
                  <span style={{color:C.si,fontSize:10,marginLeft:8}}>Total Headcount: <b style={{color:C.or,fontSize:12}}>{totalWorkers}</b></span>
                </div>
                <button type="button" onClick={()=>sf("_showLabourPunch",!form._showLabourPunch)} style={{padding:"3px 8px",borderRadius:5,border:"1px solid "+C.br,background:"transparent",color:C.gr,cursor:"pointer",fontSize:10,fontFamily:"monospace"}}>
                  {form._showLabourPunch ? "▲ Hide Individual Attendance" : "▼ Punch Site Labours Directly"}
                </button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:6}}>
                {[
                  ["mason","Masons (Raj Mistri)"],
                  ["carpenter","Carpenters / Fitters"],
                  ["welder","Welders / Fabricators"],
                  ["helper","Helpers / Unskilled"],
                  ["supervisor","Site Supervisors"],
                  ["operator","Machine Operators"],
                  ["other","Other Site Staff"]
                ].map(([k,label])=>(
                  <div key={k} style={{background:"#0A1223",padding:"6px 8px",borderRadius:6,border:"1px solid "+C.br}}>
                    <div style={{fontSize:9,color:C.si,marginBottom:2}}>{label}</div>
                    <input type="number" min="0" style={{...ss.inp,marginBottom:0,fontSize:11,fontWeight:700,padding:"4px 6px"}} value={cats[k]||0} onChange={ev=>{
                      const nw = { ...cats, [k]: Math.max(0, +ev.target.value) };
                      sf("workerCats", nw);
                      sf("workers", Object.values(nw).reduce((a,b)=>a+(Number(b)||0), 0));
                    }}/>
                  </div>
                ))}
              </div>
              {form._showLabourPunch && <div style={{marginTop:8,padding:"8px 10px",background:"#0A1223",borderRadius:6,border:"1px dashed "+C.br}}>
                <div style={{color:C.si,fontSize:10,marginBottom:6,fontWeight:600}}>Select attendance for registered site workforce:</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,maxHeight:140,overflowY:"auto"}}>
                  {siteLabours.map(l=>{
                    const cur = (form.labourAtt||{})[l.id] || "absent";
                    return <div key={l.id} style={{padding:"4px 6px",background:"#060C1A",borderRadius:4,fontSize:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span><b>{l.name}</b> <small style={{color:C.gr}}>({l.role})</small></span>
                      <div style={{display:"flex",gap:2}}>
                        {["P","A"].map(st=>(
                          <button key={st} type="button" onClick={()=>{
                            const nAtt = { ...(form.labourAtt||{}), [l.id]: st };
                            sf("labourAtt", nAtt);
                            const roleKey = (l.role||"").toLowerCase().includes("mason")?"mason":(l.role||"").toLowerCase().includes("carpenter")?"carpenter":(l.role||"").toLowerCase().includes("welder")?"welder":(l.role||"").toLowerCase().includes("super")?"supervisor":(l.role||"").toLowerCase().includes("operator")?"operator":"helper";
                            const pCount = Object.entries(nAtt).filter(([id,val])=>val==="P" && (siteLabours.find(x=>x.id===id)?.role||"").toLowerCase().includes(roleKey.slice(0,4))).length;
                            const nw = { ...cats, [roleKey]: pCount };
                            sf("workerCats", nw);
                            sf("workers", Object.values(nw).reduce((a,b)=>a+(Number(b)||0), 0));
                          }} style={{padding:"2px 5px",borderRadius:3,border:"none",cursor:"pointer",fontSize:9,fontWeight:700,background:cur===st?(st==="P"?C.gn:C.rd):"#1E2D45",color:"#fff"}}>{st}</button>
                        ))}
                      </div>
                    </div>;
                  })}
                </div>
              </div>}
            </div>;
          })()}

          <F label="Client / Engineer Instructions"><Inp val={form.clientInstructions||""} onChange={v=>sf("clientInstructions",v)} placeholder="Instructions received from client / engineer / architect today..."/></F>
          <F label="Day Remarks"><Inp val={form.remarks||""} onChange={v=>sf("remarks",v)} placeholder="Overall progress summary..."/></F>

          {/* ACCIDENT REPORTING IN DPR WITH MULTIPLE PHOTOS (Prompt 6a) */}
          <div style={{...ss.card,padding:12,marginBottom:12,background:form.hasAccident?"rgba(248,113,113,.1)":"#060C1A",border:"1px solid "+(form.hasAccident?C.rd:C.br)}}>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",color:form.hasAccident?C.rd:C.si,fontWeight:700,fontSize:11}}>
              <input type="checkbox" checked={!!form.hasAccident} onChange={e=>sf("hasAccident",e.target.checked)}/>
              🚨 Report Site Incident / Accident
            </label>
            {form.hasAccident && <div style={{marginTop:8}}>
              <GR cols="1fr 1fr">
                <F label="Severity Level"><Sel val={form.accidentSeverity||"Minor"} onChange={v=>sf("accidentSeverity",v)} opts={["Near Miss","Minor First Aid","Medical Treatment","Lost Time Injury","Fatal"]}/></F>
                <F label="Workers Involved"><Inp val={form.accidentWorkers||""} onChange={v=>sf("accidentWorkers",v)} placeholder="Worker names..."/></F>
              </GR>
              <F label="Incident Details & Corrective Action"><Inp val={form.accidentDesc||""} onChange={v=>sf("accidentDesc",v)} placeholder="What happened, immediate aid given, preventive measure taken..."/></F>
              <F label="Incident / Accident Photos (Multiple photos)">
                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:6}}>
                  {(form.accidentImages||[]).map((img,i)=><div key={i} style={{position:"relative",width:72,height:72}}>
                    <img src={img} style={{width:72,height:72,objectFit:"cover",borderRadius:6,border:"1px solid "+C.rd}}/>
                    <button type="button" onClick={()=>sf("accidentImages",(form.accidentImages||[]).filter((_,j)=>j!==i))} style={{position:"absolute",top:-4,right:-4,background:C.rd,border:"none",borderRadius:"50%",width:18,height:18,color:"white",cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center"}}>x</button>
                  </div>)}
                  <button type="button" onClick={()=>pickImage(url=>sf("accidentImages",[...(form.accidentImages||[]),url]))} style={{width:72,height:72,borderRadius:6,border:"2px dashed "+C.rd,background:"transparent",color:C.rd,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,fontSize:10,fontFamily:"monospace"}}>
                    <span style={{fontSize:20}}>📷</span>Add Photo
                  </button>
                </div>
              </F>
            </div>}
          </div>

          <div style={{...ss.card,padding:12,marginBottom:10,background:"#060C1A"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div>
                <span style={{color:C.si,fontSize:10,textTransform:"uppercase",letterSpacing:.5}}>Work Progress Entries</span>
                <span style={{color:C.gr,fontSize:9,marginLeft:8}}>Live balance qty displayed per row</span>
              </div>
              <button style={{padding:"4px 12px",borderRadius:6,border:"1px solid "+C.br,background:"transparent",color:C.gr,cursor:"pointer",fontFamily:"monospace",fontSize:10,fontWeight:700}} onClick={()=>sf("entries",[...(form.entries||[]),{type:"service",name:"",taskId:null,completedQty:0,unit:"",remarks:""}])}>+ Add Row</button>
            </div>
            {(form.entries||[]).map((e,i)=>{
              const jo=form.jobOrderId?(data.jobOrders||[]).find(j=>j.id===form.jobOrderId):null;
              
              /* Live Balance calculation: If service: PO/task balance; If item: site inventory balance */
              let balanceBadge = null;
              if(e.type==="service") {
                const poMatching=(data.purchaseOrders||[]).filter(p=>!form.siteId||p.siteId===form.siteId);
                const matchingPOLine=poMatching.flatMap(p=>p.lineItems||[]).find(li=>(li.item||li.desc||"").toLowerCase().includes((e.name||"").toLowerCase()));
                if(matchingPOLine) {
                  balanceBadge = <span style={{color:C.tl,fontSize:9}}>PO Bal: <b>{matchingPOLine.qty} {matchingPOLine.unit}</b></span>;
                } else if(jo) {
                  const task=(jo.tasks||[]).find(t=>t.name===e.name||t.id===e.taskId);
                  if(task) {
                    const doneQty=(data.dpr||[]).filter(dp=>dp.jobOrderId===jo.id).flatMap(dp=>dp.entries||[]).filter(en=>en.name===task.name).reduce((a,b)=>a+(Number(b.completedQty)||0),0);
                    balanceBadge = <span style={{color:C.gn,fontSize:9}}>JO Bal: <b>{Math.max(0,(task.qty||1)-doneQty)} {task.unit}</b></span>;
                  }
                }
              } else if(e.type==="item") {
                const invItem=(data.inventory||[]).find(iv=>iv.locType==="site"&&iv.locId===(form.siteId||jo?.siteId)&&(iv.item||"").toLowerCase().includes((e.name||"").toLowerCase()));
                if(invItem) {
                  balanceBadge = <span style={{color:invItem.close<=invItem.min?C.rd:C.or,fontSize:9}}>Site Stock: <b>{invItem.close} {invItem.unit}</b></span>;
                } else {
                  balanceBadge = <span style={{color:C.gr,fontSize:9}}>Stock: 0</span>;
                }
              }

              return <div key={i} style={{display:"grid",gridTemplateColumns:"70px 2fr 1fr 1fr 1fr 120px auto",gap:5,marginBottom:6,alignItems:"center"}}>
                <select style={{...ss.inp,marginBottom:0,fontSize:10}} value={e.type} onChange={ev=>{const ne=[...(form.entries||[])];ne[i]={...ne[i],type:ev.target.value};sf("entries",ne);}}><option value="service">Service</option><option value="item">Item</option></select>
                {jo&&e.type==="service"?<select style={{...ss.inp,marginBottom:0}} value={e.taskId||""} onChange={ev=>{
                  const ne=[...(form.entries||[])];
                  const tId=ev.target.value;
                  const task=(jo.tasks||[]).find(t=>t.id===tId);
                  const idx=(jo.tasks||[]).findIndex(t=>t.id===tId);
                  ne[i]={...ne[i],taskId:tId,soLineIdx:idx>=0?idx:null,name:task?task.name:ne[i].name,unit:task?task.unit:ne[i].unit};
                  sf("entries",ne);
                }}><option value="">Custom Task</option>{(jo.tasks||[]).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>:<input style={{...ss.inp,marginBottom:0}} value={e.name} onChange={ev=>{const ne=[...(form.entries||[])];ne[i]={...ne[i],name:ev.target.value};sf("entries",ne);}} placeholder="Name"/>}
                <input type="number" style={{...ss.inp,marginBottom:0}} value={e.completedQty||0} onChange={ev=>{const ne=[...(form.entries||[])];ne[i]={...ne[i],completedQty:+ev.target.value};sf("entries",ne);}} placeholder="Qty Done"/>
                <input style={{...ss.inp,marginBottom:0}} value={e.unit||""} onChange={ev=>{const ne=[...(form.entries||[])];ne[i]={...ne[i],unit:ev.target.value};sf("entries",ne);}} placeholder="Unit"/>
                <input style={{...ss.inp,marginBottom:0}} value={e.remarks||""} onChange={ev=>{const ne=[...(form.entries||[])];ne[i]={...ne[i],remarks:ev.target.value};sf("entries",ne);}} placeholder="Remarks"/>
                <div style={{padding:"2px 6px",background:"#0A1223",borderRadius:4,textAlign:"center"}}>{balanceBadge||<span style={{color:C.gr,fontSize:9}}>—</span>}</div>
                <button onClick={()=>sf("entries",(form.entries||[]).filter((_,j)=>j!==i))} style={{background:"rgba(248,113,113,.1)",border:"1px solid rgba(248,113,113,.2)",color:C.rd,cursor:"pointer",fontSize:12,padding:"4px 7px",borderRadius:5}}>x</button>
              </div>;
            })}
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
          <Btn full onClick={()=>{
            if(!form.jobOrderId) return alert("Please select a Job Order. DPR must be punched against a Job Order.");
            (form.consumedItems||[]).forEach(ci=>{if(!ci.item||!ci.qty)return;upd("inventory",arr=>arr.map(inv=>inv.item===ci.item&&inv.locType===ci.locType?{...inv,used:(inv.used||0)+ci.qty,close:Math.max(0,(inv.close||0)-ci.qty)}:inv));});
            if(form.hasAccident) {
              const iss={id:uid(),title:"Accident: "+(form.accidentSeverity||"Minor incident"),desc:(form.accidentDesc||"Reported during DPR")+(form.accidentWorkers?" (Workers: "+form.accidentWorkers+")":""),priority:"High",dueDate:form.date||new Date().toISOString().slice(0,10),status:"Open",createdBy:form.supervisor||user.name,assignedTo:"Admin User",createdAt:form.date||new Date().toISOString().slice(0,10),siteId:form.siteId,isAccident:true,images:form.accidentImages||[]};
              upd("issues",arr=>[...arr,iss]);
            }
            if(form.labourAtt && Object.keys(form.labourAtt).length > 0) {
              const attEntries = Object.entries(form.labourAtt).map(([lid, status])=>{
                const lab = (masters.labours||[]).find(l=>l.id===lid);
                return {id:uid(), labourId:lid, name:lab?.name||lid, date:form.date||new Date().toISOString().slice(0,10), siteId:form.siteId, present:status==="P", status:status==="P"?"Present":"Absent"};
              });
              upd("attendance", arr=>[...arr, ...attEntries]);
            }
            saveTxn("dpr");
          }}>Save DPR</Btn>
        </div>}

        {/* ISSUE / ACCIDENT MODAL */}
        {mod==="issue"&&<div>
          <F label="Issue Title"><Inp val={form.title||""} onChange={v=>sf("title",v)} placeholder="e.g. Scaffolding loose at column C4"/></F>
          <GR cols="1fr 1fr">
            <F label="Site"><Sel val={form.siteId||""} onChange={v=>sf("siteId",v)} opts={siteOpts}/></F>
            <F label="Priority"><Sel val={form.priority||"Medium"} onChange={v=>sf("priority",v)} opts={["Low","Medium","High","Critical"]}/></F>
          </GR>
          <GR cols="1fr 1fr">
            <F label="Due Date"><Inp type="date" val={form.dueDate||""} onChange={v=>sf("dueDate",v)}/></F>
            <F label="Current Status"><Sel val={form.status||"Open"} onChange={v=>sf("status",v)} opts={["Open","In Progress","Resolved","Rejected"]}/></F>
          </GR>
          <GR cols="1fr 1fr">
            <F label="Assigned To"><Sel val={form.assignedTo||""} onChange={v=>sf("assignedTo",v)} opts={[{v:"",l:"Select Assignee"},...masters.users.map(u=>u.name),...masters.labours.map(l=>l.name)]}/></F>
            <F label="Created By"><Inp val={form.createdBy||user.name} onChange={v=>sf("createdBy",v)}/></F>
          </GR>
          <F label="Issue Description"><Inp val={form.desc||""} onChange={v=>sf("desc",v)} placeholder="Full details, cause and required remediation"/></F>
          <div style={{marginBottom:10}}>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",color:C.rd,fontWeight:700,fontSize:11}}>
              <input type="checkbox" checked={!!form.isAccident} onChange={e=>sf("isAccident",e.target.checked)}/>
              Mark as Safety Hazard / Accident
            </label>
          </div>
          <Btn full onClick={()=>{
            if(!form.title) return alert("Please enter an issue title");
            saveRec("issues",{...form, createdAt: form.createdAt||new Date().toISOString().slice(0,10)});
            setModal(null);
            setForm({});
          }}>Save Issue</Btn>
        </div>}

        {/* PURCHASE REQUISITION MODAL */}
        {mod==="pr"&&(()=>{
          const jo=(data.jobOrders||[]).find(j=>j.id===form.joId);
          // BOM Material list from Job Order tasks
          const bomMaterials=jo?(jo.tasks||[]).map(t=>({name:t.name, qty:t.qty||10, unit:t.unit||"Nos", budget:t.matBudget||0})) : masters.items.map(it=>({name:it.name, qty:999, unit:it.unit, budget:it.rate*10}));
          const selectedBOM=bomMaterials.find(b=>b.name===form.material)||{};
          const maxAllowedQty=selectedBOM.qty||999999;
          const isManagerOrHigher=["Owner","Admin","Manager","Site Manager"].includes(user.role);

          return <div>
            <GR cols="1fr 1fr">
              <F label="PR Number"><Inp val={form.prNo||""} onChange={v=>sf("prNo",v)}/></F>
              <F label="Date"><Inp type="date" val={form.date||""} onChange={v=>sf("date",v)}/></F>
            </GR>
            <GR cols="1fr 1fr">
              <F label="Site"><Sel val={form.siteId||""} onChange={v=>sf("siteId",v)} opts={siteOpts}/></F>
              <F label="Job Order (Autoloads BOM)">
                <Sel val={form.joId||""} onChange={v=>{
                  sf("joId",v);
                  const matchedJo=(data.jobOrders||[]).find(j=>j.id===v);
                  if(matchedJo) {
                    sf("siteId", matchedJo.siteId);
                    if(matchedJo.tasks?.length) {
                      sf("material", matchedJo.tasks[0].name);
                      sf("unit", matchedJo.tasks[0].unit||"Nos");
                    }
                  }
                }} opts={[{v:"",l:"Select Job Order"},...(data.jobOrders||[]).filter(j=>!form.siteId||j.siteId===form.siteId).map(j=>({v:j.id,l:j.joNo+" — "+sName(j.siteId)}))]}/>
              </F>
            </GR>
            <GR cols="1.5fr 1fr">
              <F label="Input Material / Service (from BOM)">
                <Sel val={form.material||""} onChange={v=>{
                  sf("material",v);
                  const bm=bomMaterials.find(b=>b.name===v);
                  if(bm) sf("unit",bm.unit);
                }} opts={bomMaterials.map(b=>({v:b.name,l:`${b.name} (BOM Max: ${b.qty} ${b.unit})`}))}/>
              </F>
              <F label="Required Qty">
                <Num val={form.qty||0} onChange={v=>sf("qty",v)}/>
              </F>
            </GR>
            {form.qty > maxAllowedQty && (
              <div style={{padding:"8px 12px",background:"rgba(248,113,113,.1)",borderRadius:6,border:"1px solid "+C.rd,color:C.rd,fontSize:10,marginBottom:8}}>
                ⚠ <b>Quantity Cap Warning:</b> Requested quantity ({form.qty}) exceeds BOM budget limit ({maxAllowedQty} {selectedBOM.unit}).
                {!isManagerOrHigher ? " Only Owner, Admin or Site Manager can revise and approve." : " As Manager/Admin, saving will revise BOM allocation."}
              </div>
            )}
            <GR cols="1fr 1fr">
              <F label="Unit"><Inp val={form.unit||"Nos"} onChange={v=>sf("unit",v)}/></F>
              <F label="Required By Date"><Inp type="date" val={form.reqByDate||""} onChange={v=>sf("reqByDate",v)}/></F>
            </GR>
            <F label="Reason for Requisition"><Inp val={form.reason||""} onChange={v=>sf("reason",v)} placeholder="e.g. Pillar casting phase 1 reinforcement"/></F>
            <GR cols="1fr 1fr">
              <F label="Generated By"><Inp val={form.generatedBy||user.name} onChange={v=>sf("generatedBy",v)}/></F>
              <F label="Approved By"><Inp val={form.approvedBy||""} onChange={v=>sf("approvedBy",v)} placeholder="Approval signatory"/></F>
            </GR>
            <GR cols="1fr 1fr">
              <F label="Status"><Sel val={form.status||"Pending"} onChange={v=>sf("status",v)} opts={["Pending","Approved","Rejected","Hold","Converted to PO"]}/></F>
              <F label="Remarks"><Inp val={form.remarks||""} onChange={v=>sf("remarks",v)} placeholder="Urgency, vendor preference..."/></F>
            </GR>
            <Btn full onClick={()=>{
              if(!form.material||!form.qty) return alert("Please specify material and quantity");
              if(form.qty > maxAllowedQty && !isManagerOrHigher) return alert("Quantity exceeds BOM allocation! Approval by Manager, Admin or Owner is required.");
              saveRec("purchaseRequisitions",form);
              setModal(null);
              setForm({});
            }}>Save Purchase Requisition</Btn>
          </div>;
        })()}

      </Modal>;
    })()}

    {/* ═══════════ MASTER MODALS ═══════════ */}
    {modal&&modal.t==="master"&&<Modal title={(modal.oidx!=null?"EDIT — ":"ADD — ")+modal.key.toUpperCase()} onClose={()=>setModal(null)}>
      {modal.key==="sites"&&<div><F label="Name"><Inp val={form.name||""} onChange={v=>sf("name",v)}/></F><F label="Client"><Sel val={form.client||""} onChange={v=>sf("client",v)} opts={[{v:"",l:"Select Client"},...masters.clients.map(c=>({v:c.name,l:c.name}))]}/></F><F label="Location"><Inp val={form.loc||""} onChange={v=>sf("loc",v)}/></F><F label="Status"><Sel val={form.status||"Active"} onChange={v=>sf("status",v)} opts={["Active","Completed","On Hold"]}/></F><Btn full onClick={()=>{saveM("sites",form);setModal(null);}}>Save Site</Btn></div>}
      {modal.key==="clients"&&<div>
        <F label="Name"><Inp val={form.name||""} onChange={v=>sf("name",v)}/></F>
        <F label="Contact Person"><Inp val={form.contact||""} onChange={v=>sf("contact",v)}/></F>
        <F label="Phone"><Inp val={form.phone||""} onChange={v=>sf("phone",v)}/></F>
        <F label="GST Number"><Inp val={form.gst||""} onChange={v=>sf("gst",v)}/></F>
        <F label="Bill To Address"><Inp val={form.billTo||""} onChange={v=>{sf("billTo",v);if(form.sameAsBillTo)sf("shipTo",v);}} placeholder="Registered / billing address"/></F>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
            <label style={ss.lbl}>Ship To Address</label>
            <label style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:10,color:C.or,cursor:"pointer",fontWeight:700}}>
              <input type="checkbox" checked={!!form.sameAsBillTo} onChange={e=>{
                const checked=e.target.checked;
                sf("sameAsBillTo",checked);
                if(checked) sf("shipTo",form.billTo||"");
              }}/> Same as Bill to Address
            </label>
          </div>
          <Inp val={form.shipTo||""} onChange={v=>sf("shipTo",v)} placeholder="Site / delivery address"/>
        </div>
        <Btn full onClick={()=>{saveM("clients",form);setModal(null);}}>Save Client</Btn>
      </div>}
      {modal.key==="vendors"&&<div>
        <GR cols="1fr 1fr"><F label="Name"><Inp val={form.name||""} onChange={v=>sf("name",v)}/></F><F label="Category"><Sel val={form.cat||""} onChange={v=>sf("cat",v)} opts={["Select","Sub-Contractor","Equipment Vendor","Material Supplier","Service Provider","Consultant","Other"]}/></F></GR>
        <GR cols="1fr 1fr">
          <F label="Sub-Category">
            <Sel val={form.subCat||"Goods/ Material"} onChange={v=>sf("subCat",v)} opts={["Goods/ Material","Services","Both Goods & Services"]}/>
          </F>
          <F label="Payment Terms"><Sel val={form.terms||""} onChange={v=>sf("terms",v)} opts={["Select","Advance","Credit 15 Days","Credit 30 Days","Credit 45 Days","Credit 60 Days","Credit 90 Days"]}/></F>
        </GR>
        <GR cols="1fr 1fr"><F label="Does Vendor have GST Number?"><Sel val={form.hasGst||(form.gst?"yes":"no")} onChange={v=>{sf("hasGst",v);if(v==="no")sf("gst","");}} opts={[{v:"yes",l:"Yes"},{v:"no",l:"No"}]}/></F><F label="PAN Number"><Inp val={form.pan||""} onChange={v=>sf("pan",v)} placeholder="e.g. ABCDE1234F"/></F></GR>
        {(form.hasGst||(form.gst?"yes":"no"))==="yes"&&<F label="GST Number"><Inp val={form.gst||""} onChange={v=>sf("gst",v)} placeholder="15-digit GSTIN"/></F>}
        <GR cols="1fr 1fr"><F label="Contact Person"><Inp val={form.contact||""} onChange={v=>sf("contact",v)}/></F><F label="Phone"><Inp val={form.phone||""} onChange={v=>sf("phone",v)}/></F></GR>
        <GR cols="1fr 1fr"><F label="Email"><Inp val={form.email||""} onChange={v=>sf("email",v)}/></F><F label="Address"><Inp val={form.address||""} onChange={v=>sf("address",v)}/></F></GR>
        <GR cols="1fr 1fr"><F label="TDS Applicable"><Sel val={form.tdsApp?"yes":"no"} onChange={v=>sf("tdsApp",v==="yes")} opts={[{v:"no",l:"No"},{v:"yes",l:"Yes"}]}/></F><F label="TCS Applicable"><Sel val={form.tcsApp?"yes":"no"} onChange={v=>sf("tcsApp",v==="yes")} opts={[{v:"no",l:"No"},{v:"yes",l:"Yes"}]}/></F></GR>
        <div style={{color:C.or,fontSize:10,marginTop:6,marginBottom:6,fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>Banking Details</div>
        <GR cols="1fr 1fr"><F label="Bank Name"><Inp val={form.bankName||""} onChange={v=>sf("bankName",v)}/></F><F label="Account No"><Inp val={form.bankAccount||""} onChange={v=>sf("bankAccount",v)}/></F></GR>
        <F label="IFSC Code"><Inp val={form.ifsc||""} onChange={v=>sf("ifsc",v)}/></F>
        <Btn full onClick={()=>{saveM("vendors",form);setModal(null);}}>Save Vendor</Btn>
      </div>}
      {modal.key==="uom"&&<div>
        <F label="Name of UOM"><Inp val={form.name||""} onChange={v=>sf("name",v)} placeholder="e.g. Cum, Sqm, MT, CFT, Nos"/></F>
        <F label="Parameter">
          <Sel val={form.param||"Volume"} onChange={v=>sf("param",v)} opts={["Length","Weight","Density","Volume","Area","Pressure","Temperature","Numbers","ManDays","Time","Current","Voltage"]}/>
        </F>
        <GR cols="1fr 1fr">
          <F label="Measurement Factor (Multiplier to base unit)"><Num val={form.factor||1} onChange={v=>sf("factor",v)}/></F>
          <F label="Base Unit Reference"><Inp val={form.baseUnit||""} onChange={v=>sf("baseUnit",v)} placeholder="e.g. Cum, Kg, Sqm, Nos"/></F>
        </GR>
        <Btn full onClick={()=>{saveM("uom",form);setModal(null);}}>Save UOM</Btn>
      </div>}
      {modal.key==="inputRates"&&<div>
        <F label="Rate Type"><Sel val={form.type||"material"} onChange={v=>sf("type",v)} opts={[{v:"material",l:"Raw Material (Goods)"},{v:"service",l:"Input Service / Work"},{v:"machinery",l:"Tools & Machinery Hire / Depreciation"},{v:"labour",l:"Labour Rate (Category Wise)"},{v:"transport",l:"Transport Rate"}]}/></F>
        <F label="Name / Description"><Inp val={form.name||""} onChange={v=>sf("name",v)} placeholder="e.g. TMT Steel 12mm, JCB Hire, Mason..."/></F>
        <GR cols="1fr 1fr">
          <F label="UOM"><Sel val={form.uom||""} onChange={v=>sf("uom",v)} opts={[{v:"",l:"Select UOM"},...(masters.uom||[]).map(u=>({v:u.name,l:u.name+" ("+u.param+")"}))]}/></F>
          <F label="Input Rate (₹)"><Num val={form.rate} onChange={v=>sf("rate",v)}/></F>
        </GR>
        <F label="GST Rate %"><Sel val={form.gst||18} onChange={v=>sf("gst",+v)} opts={gOpts}/></F>
        <div style={{...ss.card,padding:10,marginTop:6,marginBottom:10,background:"#060C1A"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <span style={{color:C.si,fontSize:10,textTransform:"uppercase"}}>Vendor Rate Memory</span>
            <button style={{padding:"3px 8px",borderRadius:4,border:"1px solid "+C.br,background:"transparent",color:C.gr,fontSize:9,cursor:"pointer"}} onClick={()=>sf("vendorRateMemory",[...(form.vendorRateMemory||[]),{vendor:(masters.vendors[0]||{}).name||"",rate:form.rate||0,date:new Date().toISOString().slice(0,10)}])}>+ Add Vendor</button>
          </div>
          {(form.vendorRateMemory||[]).map((vrm,vi)=><div key={vi} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr auto",gap:4,marginBottom:4}}>
            <select style={{...ss.inp,marginBottom:0,fontSize:10}} value={vrm.vendor} onChange={e=>{const n=[...(form.vendorRateMemory||[])];n[vi]={...n[vi],vendor:e.target.value};sf("vendorRateMemory",n);}}>{masters.vendors.map(v=><option key={v.id} value={v.name}>{v.name}</option>)}</select>
            <input type="number" style={{...ss.inp,marginBottom:0,fontSize:10}} value={vrm.rate} onChange={e=>{const n=[...(form.vendorRateMemory||[])];n[vi]={...n[vi],rate:+e.target.value};sf("vendorRateMemory",n);}} placeholder="Rate"/>
            <input type="date" style={{...ss.inp,marginBottom:0,fontSize:10}} value={vrm.date} onChange={e=>{const n=[...(form.vendorRateMemory||[])];n[vi]={...n[vi],date:e.target.value};sf("vendorRateMemory",n);}}/>
            <button onClick={()=>{sf("vendorRateMemory",(form.vendorRateMemory||[]).filter((_,j)=>j!==vi));}} style={{background:"transparent",border:"none",color:C.rd,cursor:"pointer"}}>✕</button>
          </div>)}
        </div>
        <Btn full onClick={()=>{saveM("inputRates",form);setModal(null);}}>Save Input Rate</Btn>
      </div>}
      {modal.key==="items"&&<div>
        <GR cols="1fr 1fr"><F label="Item Category"><Inp val={form.cat||""} onChange={v=>sf("cat",v)} placeholder="e.g. Steel, Cement, Aggregate..."/></F><F label="Item Name"><Inp val={form.name||""} onChange={v=>sf("name",v)}/></F></GR>
        <F label="Item Description"><Inp val={form.desc||""} onChange={v=>sf("desc",v)} placeholder="Full technical specifications..."/></F>
        <GR cols="1fr 1fr 1fr">
          <F label="Unit of Measurement"><Sel val={form.unit||""} onChange={v=>sf("unit",v)} opts={[{v:"",l:"Select"},...(masters.uom||[]).map(u=>u.name)]}/></F>
          <F label="HSN Code"><Inp val={form.hsn||""} onChange={v=>sf("hsn",v)} placeholder="8-digit HSN"/></F>
          <F label="Est. Time Required"><Inp val={form.estTime||""} onChange={v=>sf("estTime",v)} placeholder="e.g. 2 Days, 5 Hours"/></F>
        </GR>
        <div style={{...ss.card,padding:12,marginTop:6,marginBottom:10,background:"#060C1A",border:"1px solid "+C.or}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{color:C.or,fontWeight:700,fontSize:11}}>⚙ RATE &amp; COST ANALYSIS SUB-MODULE</span>
            <button style={{padding:"3px 8px",borderRadius:4,border:"1px solid "+C.or,background:G(C.or,0.1),color:C.or,fontSize:10,cursor:"pointer"}} onClick={()=>{
              const lines = form.analysisLines||[];
              sf("analysisLines",[...lines,{inputItem:(masters.inputRates[0]||{}).name||"",qty:1,uom:(masters.inputRates[0]||{}).uom||"",rate:(masters.inputRates[0]||{}).rate||0}]);
            }}>+ Add Input Element</button>
          </div>
          {(form.analysisLines||[]).map((al,ai)=><div key={ai} style={{display:"grid",gridTemplateColumns:"2fr 0.8fr 0.8fr 1fr auto",gap:4,marginBottom:6,alignItems:"center"}}>
            <select style={{...ss.inp,marginBottom:0,fontSize:10}} value={al.inputItem} onChange={e=>{
              const item = (masters.inputRates||[]).find(x=>x.name===e.target.value);
              const n=[...(form.analysisLines||[])];
              n[ai]={...n[ai],inputItem:e.target.value,rate:item?item.rate:al.rate,uom:item?item.uom:al.uom};
              sf("analysisLines",n);
            }}>{masters.inputRates.map(ir=><option key={ir.id} value={ir.name}>[{ir.type.slice(0,3).toUpperCase()}] {ir.name}</option>)}</select>
            <input type="number" style={{...ss.inp,marginBottom:0,fontSize:10}} value={al.qty} onChange={e=>{const n=[...(form.analysisLines||[])];n[ai]={...n[ai],qty:+e.target.value};sf("analysisLines",n);}} placeholder="Qty"/>
            <input style={{...ss.inp,marginBottom:0,fontSize:10}} value={al.uom} readOnly/>
            <input type="number" style={{...ss.inp,marginBottom:0,fontSize:10}} value={al.rate} onChange={e=>{const n=[...(form.analysisLines||[])];n[ai]={...n[ai],rate:+e.target.value};sf("analysisLines",n);}} placeholder="Rate"/>
            <button onClick={()=>sf("analysisLines",(form.analysisLines||[]).filter((_,j)=>j!==ai))} style={{background:"transparent",border:"none",color:C.rd,cursor:"pointer"}}>✕</button>
          </div>)}
          {(()=>{
            const lines=form.analysisLines||[];
            const directCost=lines.reduce((a,b)=>a+(b.qty||0)*(b.rate||0),0);
            const margin=(form.marginPct||15);
            const finalComputedRate=Math.round(directCost*(1+margin/100));
            return <div style={{borderTop:"1px solid #1E2D45",paddingTop:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:10,color:C.si}}>Direct Cost: <b>{INR(directCost)}</b> + Contractor Margin: <input type="number" style={{...ss.inp,width:44,display:"inline",margin:0,padding:2}} value={margin} onChange={e=>sf("marginPct",+e.target.value)}/>%</span>
              <button onClick={()=>{sf("rate",finalComputedRate);sf("rateAnalysis",true);}} style={{padding:"3px 8px",borderRadius:5,background:C.gn,color:"#000",border:"none",fontWeight:700,fontSize:10,cursor:"pointer"}}>Apply Rate: {INR(finalComputedRate)}</button>
            </div>;
          })()}
        </div>
        <GR cols="1fr 1fr"><F label="Final Standard Rate (₹)"><Num val={form.rate} onChange={v=>sf("rate",v)}/></F><F label="Rate Analysis Done?"><Sel val={form.rateAnalysis?"yes":"no"} onChange={v=>sf("rateAnalysis",v==="yes")} opts={[{v:"yes",l:"Yes (Analyzed)"},{v:"no",l:"No (Basic)"}]}/></F></GR>
        <Btn full onClick={()=>{saveM("items",form);setModal(null);}}>Save Item</Btn>
      </div>}
      {modal.key==="services"&&<div>
        <GR cols="1fr 1fr"><F label="Service Category"><Inp val={form.cat||""} onChange={v=>sf("cat",v)} placeholder="e.g. Civil, MEP, Finishing..."/></F><F label="Service Name"><Inp val={form.name||""} onChange={v=>sf("name",v)}/></F></GR>
        <F label="Service Description"><Inp val={form.desc||""} onChange={v=>sf("desc",v)}/></F>
        <GR cols="1fr 1fr 1fr">
          <F label="Unit of Measurement"><Sel val={form.unit||""} onChange={v=>sf("unit",v)} opts={[{v:"",l:"Select"},...(masters.uom||[]).map(u=>u.name)]}/></F>
          <F label="SAC Code"><Inp val={form.sac||""} onChange={v=>sf("sac",v)} placeholder="6-digit SAC"/></F>
          <F label="Est. Time Required"><Inp val={form.estTime||""} onChange={v=>sf("estTime",v)} placeholder="e.g. 5 Days"/></F>
        </GR>
        <F label="GST %"><Sel val={form.gst||18} onChange={v=>sf("gst",+v)} opts={gOpts}/></F>
        <div style={{...ss.card,padding:12,marginTop:6,marginBottom:10,background:"#060C1A",border:"1px solid "+C.tl}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{color:C.tl,fontWeight:700,fontSize:11}}>⚙ RATE &amp; COST ANALYSIS (GOODS &amp; SERVICES)</span>
            <button style={{padding:"3px 8px",borderRadius:4,border:"1px solid "+C.tl,background:G(C.tl,0.1),color:C.tl,fontSize:10,cursor:"pointer"}} onClick={()=>{
              const lines = form.analysisLines||[];
              sf("analysisLines",[...lines,{inputItem:(masters.inputRates[0]||{}).name||"",qty:1,uom:(masters.inputRates[0]||{}).uom||"",rate:(masters.inputRates[0]||{}).rate||0}]);
            }}>+ Add Input Element</button>
          </div>
          {(form.analysisLines||[]).map((al,ai)=><div key={ai} style={{display:"grid",gridTemplateColumns:"2fr 0.8fr 0.8fr 1fr auto",gap:4,marginBottom:6,alignItems:"center"}}>
            <select style={{...ss.inp,marginBottom:0,fontSize:10}} value={al.inputItem} onChange={e=>{
              const item = (masters.inputRates||[]).find(x=>x.name===e.target.value);
              const n=[...(form.analysisLines||[])];
              n[ai]={...n[ai],inputItem:e.target.value,rate:item?item.rate:al.rate,uom:item?item.uom:al.uom};
              sf("analysisLines",n);
            }}>{masters.inputRates.map(ir=><option key={ir.id} value={ir.name}>[{ir.type.slice(0,3).toUpperCase()}] {ir.name}</option>)}</select>
            <input type="number" style={{...ss.inp,marginBottom:0,fontSize:10}} value={al.qty} onChange={e=>{const n=[...(form.analysisLines||[])];n[ai]={...n[ai],qty:+e.target.value};sf("analysisLines",n);}} placeholder="Qty"/>
            <input style={{...ss.inp,marginBottom:0,fontSize:10}} value={al.uom} readOnly/>
            <input type="number" style={{...ss.inp,marginBottom:0,fontSize:10}} value={al.rate} onChange={e=>{const n=[...(form.analysisLines||[])];n[ai]={...n[ai],rate:+e.target.value};sf("analysisLines",n);}} placeholder="Rate"/>
            <button onClick={()=>sf("analysisLines",(form.analysisLines||[]).filter((_,j)=>j!==ai))} style={{background:"transparent",border:"none",color:C.rd,cursor:"pointer"}}>✕</button>
          </div>)}
          {(()=>{
            const lines=form.analysisLines||[];
            const directCost=lines.reduce((a,b)=>a+(b.qty||0)*(b.rate||0),0);
            const margin=(form.marginPct||15);
            const finalComputedRate=Math.round(directCost*(1+margin/100));
            return <div style={{borderTop:"1px solid #1E2D45",paddingTop:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:10,color:C.si}}>Cost: <b>{INR(directCost)}</b> + Margin: <input type="number" style={{...ss.inp,width:44,display:"inline",margin:0,padding:2}} value={margin} onChange={e=>sf("marginPct",+e.target.value)}/>%</span>
              <button onClick={()=>{sf("rate",finalComputedRate);sf("rateAnalysis",true);}} style={{padding:"3px 8px",borderRadius:5,background:C.tl,color:"#000",border:"none",fontWeight:700,fontSize:10,cursor:"pointer"}}>Apply Rate: {INR(finalComputedRate)}</button>
            </div>;
          })()}
        </div>
        <GR cols="1fr 1fr"><F label="Final Standard Rate (₹)"><Num val={form.rate} onChange={v=>sf("rate",v)}/></F><F label="Rate Analysis Done?"><Sel val={form.rateAnalysis?"yes":"no"} onChange={v=>sf("rateAnalysis",v==="yes")} opts={[{v:"yes",l:"Yes (Analyzed)"},{v:"no",l:"No (Basic)"}]}/></F></GR>
        <Btn full onClick={()=>{saveM("services",form);setModal(null);}}>Save Service</Btn>
      </div>}
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
        <GR cols="1fr 1fr">
          <F label="Aadhaar Card No."><Inp val={form.aadhaar||""} onChange={v=>sf("aadhaar",v)} placeholder="XXXX-XXXX-XXXX"/></F>
          <F label="PAN Card No."><Inp val={form.pan||""} onChange={v=>sf("pan",v)} placeholder="ABCDE1234F"/></F>
        </GR>
        <F label="KYC Documents (Multiple docs — Aadhaar, PAN, Bank Passbook, etc.)">
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
            {(form.kycDocs||[]).map((img,i)=><div key={i} style={{position:"relative",width:80,height:60}}>
              <img src={img} style={{width:80,height:60,objectFit:"cover",borderRadius:5,border:"1px solid "+C.br}}/>
              <button onClick={()=>sf("kycDocs",(form.kycDocs||[]).filter((_,j)=>j!==i))} style={{position:"absolute",top:-4,right:-4,background:C.rd,border:"none",borderRadius:"50%",width:16,height:16,color:"white",cursor:"pointer",fontSize:10}}>x</button>
            </div>)}
            <button onClick={()=>pickImage(url=>sf("kycDocs",[...(form.kycDocs||[]),url]))} style={{width:80,height:60,borderRadius:5,border:"2px dashed "+C.br,background:"transparent",color:C.gr,cursor:"pointer",fontSize:10,fontFamily:"monospace",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}><span style={{fontSize:18}}>🪪</span>Add Doc</button>
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
      {modal.key==="pettyCash"&&<div><F label="Name"><Inp val={form.name||""} onChange={v=>sf("name",v)}/></F><F label="Keeper Name"><Sel val={form.keeper||""} onChange={v=>sf("keeper",v)} opts={[{v:"",l:"Select Keeper from HR"},...masters.labours.map(l=>({v:l.name,l:l.name+" ("+l.role+")"}))]}/></F><F label="Opening Balance"><Num val={form.openBal} onChange={v=>sf("openBal",v)}/></F><Btn full onClick={()=>{saveM("pettyCash",form);setModal(null);}}>Save Petty Cash</Btn></div>}
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
      {modal.key==="company"&&<div>
        <GR cols="1fr 1fr"><F label="Company Name"><Inp val={form.name||""} onChange={v=>sf("name",v)}/></F><F label="GST Number"><Inp val={form.gst||""} onChange={v=>sf("gst",v)}/></F></GR>
        <GR cols="1fr 1fr">
          <F label="Type of Company">
            <Sel val={form.companyType||"Pvt. Ltd."} onChange={v=>sf("companyType",v)} opts={["Proprietor","Partnership","LLP","OPC","Pvt. Ltd.","Public Ltd.","Joint Venture / Other"]}/>
          </F>
          <F label="Company PAN"><Inp val={form.pan||""} onChange={v=>sf("pan",v)} placeholder="e.g. AABCC1234D"/></F>
        </GR>
        <F label="Address"><Inp val={form.addr||""} onChange={v=>sf("addr",v)}/></F>
        <GR cols="1fr 1fr"><F label="Phone"><Inp val={form.phone||""} onChange={v=>sf("phone",v)}/></F><F label="Email"><Inp val={form.email||""} onChange={v=>sf("email",v)}/></F></GR>
        <GR cols="1fr 1fr"><F label="Bank Name"><Inp val={form.bank||""} onChange={v=>sf("bank",v)}/></F><F label="Account No"><Inp val={form.acc||""} onChange={v=>sf("acc",v)}/></F></GR>
        <GR cols="1fr 1fr"><F label="IFSC"><Inp val={form.ifsc||""} onChange={v=>sf("ifsc",v)}/></F><F label="Branch"><Inp val={form.branch||""} onChange={v=>sf("branch",v)}/></F></GR>
        <F label="Authorised Signatory"><Inp val={form.sign||""} onChange={v=>sf("sign",v)}/></F>
        <div style={{...ss.card,padding:12,marginTop:6,marginBottom:10,background:"#060C1A",border:"1px solid "+C.pu}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{color:C.pu,fontWeight:700,fontSize:11}}>👥 COMPANY DIRECTORS, PARTNERS &amp; INVESTORS</span>
            <button style={{padding:"3px 8px",borderRadius:4,border:"1px solid "+C.pu,background:G(C.pu,0.1),color:C.pu,fontSize:10,cursor:"pointer"}} onClick={()=>{
              const stks=form.stakeholders||[];
              sf("stakeholders",[...stks,{id:uid(),type:"Director",name:"",sharePct:10,investAmt:500000,pan:"",phone:""}]);
            }}>+ Add Stakeholder</button>
          </div>
          {(form.stakeholders||[]).map((s,si)=><div key={si} style={{display:"grid",gridTemplateColumns:"1fr 1.5fr 0.8fr 1.2fr 1fr auto",gap:4,marginBottom:6,alignItems:"center"}}>
            <select style={{...ss.inp,marginBottom:0,fontSize:10}} value={s.type} onChange={e=>{const n=[...(form.stakeholders||[])];n[si]={...n[si],type:e.target.value};sf("stakeholders",n);}}><option value="Director">Director</option><option value="Partner">Partner</option><option value="Investor">Investor</option></select>
            <input style={{...ss.inp,marginBottom:0,fontSize:10}} value={s.name} onChange={e=>{const n=[...(form.stakeholders||[])];n[si]={...n[si],name:e.target.value};sf("stakeholders",n);}} placeholder="Name"/>
            <input type="number" style={{...ss.inp,marginBottom:0,fontSize:10}} value={s.sharePct} onChange={e=>{const n=[...(form.stakeholders||[])];n[si]={...n[si],sharePct:+e.target.value};sf("stakeholders",n);}} placeholder="Share%"/>
            <input type="number" style={{...ss.inp,marginBottom:0,fontSize:10}} value={s.investAmt} onChange={e=>{const n=[...(form.stakeholders||[])];n[si]={...n[si],investAmt:+e.target.value};sf("stakeholders",n);}} placeholder="Investment ₹"/>
            <input style={{...ss.inp,marginBottom:0,fontSize:10}} value={s.pan} onChange={e=>{const n=[...(form.stakeholders||[])];n[si]={...n[si],pan:e.target.value};sf("stakeholders",n);}} placeholder="PAN"/>
            <button onClick={()=>sf("stakeholders",(form.stakeholders||[]).filter((_,j)=>j!==si))} style={{background:"transparent",border:"none",color:C.rd,cursor:"pointer"}}>✕</button>
          </div>)}
        </div>
        <F label="Company Logo">
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

    {/* ══ VIEW JOB ORDER MODAL (Prompt 7r) ══ */}
    {viewJo && (()=>{
      const so = (data.saleOrders||[]).find(s=>s.id===viewJo.soId);
      const tasks = viewJo.tasks||[];
      const totalMat = tasks.reduce((a,t)=>a+(Number(t.matBudget)||0),0);
      const totalLab = tasks.reduce((a,t)=>a+(Number(t.labBudget)||0),0);
      const totalMac = tasks.reduce((a,t)=>a+(Number(t.macBudget)||0),0);
      const grandTotal = totalMat + totalLab + totalMac;

      return <Modal title={"JOB ORDER & WORK BREAKDOWN STRUCTURE — " + (viewJo.joNo||viewJo.id)} onClose={()=>setViewJo(null)} xwide>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,padding:"10px 14px",background:"#060C1A",borderRadius:8,border:"1px solid "+C.tl}}>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:C.tl}}>{viewJo.jobName || so?.desc || "Site Execution Work Order"}</div>
            <div style={{fontSize:11,color:C.si,marginTop:2}}>Client: <b>{viewJo.client || so?.client || "—"}</b> · Site: <b>{sName(viewJo.siteId)}</b> · Date: <b>{viewJo.date}</b></div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>genJOPrint(viewJo, masters.company, {siteName:sName(viewJo.siteId), so, clientName:viewJo.client})} style={{padding:"6px 14px",borderRadius:6,border:"none",background:C.pu,color:"#fff",cursor:"pointer",fontWeight:700,fontSize:11,fontFamily:"monospace"}}>🖨 Print Job Order</button>
            <button onClick={()=>setViewJo(null)} style={{padding:"6px 14px",borderRadius:6,border:"1px solid #1E2D45",background:"transparent",color:C.gr,cursor:"pointer",fontSize:11}}>Close</button>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
          <KCard icon="🧱" label="Material Budget" value={INR(totalMat)} color={C.tl}/>
          <KCard icon="👷" label="Labour Budget" value={INR(totalLab)} color={C.pu}/>
          <KCard icon="🚜" label="Machinery Budget" value={INR(totalMac)} color={C.or}/>
          <KCard icon="🎯" label="Total Job Budget" value={INR(grandTotal)} color={C.gn}/>
        </div>

        {viewJo.specialInstructions && (
          <div style={{padding:"10px 14px",borderRadius:6,background:G(C.or,0.06),border:"1px solid "+G(C.or,0.2),marginBottom:14,fontSize:11}}>
            <span style={{color:C.or,fontWeight:700}}>Special Instructions: </span>
            <span style={{color:C.text}}>{viewJo.specialInstructions}</span>
          </div>
        )}

        <div style={{...ss.card,overflowX:"auto",marginBottom:14}}>
          <div style={{color:C.or,fontWeight:700,fontSize:12,padding:"8px 12px",borderBottom:"1px solid #1A2840"}}>Work Breakdown Structure (WBS) &amp; Itemwise Budget Ceilings</div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
            <thead><tr style={{background:"#060C1A"}}>
              <th style={{...ss.th,padding:"6px 8px"}}>#</th>
              <th style={{...ss.th,padding:"6px 8px"}}>Phase</th>
              <th style={{...ss.th,padding:"6px 8px"}}>Task Name</th>
              <th style={{...ss.th,padding:"6px 8px",textAlign:"right"}}>Allocated Qty</th>
              <th style={{...ss.th,padding:"6px 8px"}}>Schedule</th>
              <th style={{...ss.th,padding:"6px 8px",textAlign:"right"}}>Mat. Budget</th>
              <th style={{...ss.th,padding:"6px 8px",textAlign:"right"}}>Lab. Budget</th>
              <th style={{...ss.th,padding:"6px 8px",textAlign:"right"}}>Mac. Budget</th>
              <th style={{...ss.th,padding:"6px 8px",textAlign:"right"}}>Total Est.</th>
            </tr></thead>
            <tbody>{tasks.map((t,idx)=>{
              const rowTot = (Number(t.matBudget)||0) + (Number(t.labBudget)||0) + (Number(t.macBudget)||0);
              return <tr key={idx} style={{borderBottom:"1px solid #1A2840"}}>
                <td style={{...ss.td,padding:"6px 8px"}}>{idx+1}</td>
                <td style={{...ss.td,padding:"6px 8px"}}><span style={{color:C.tl,fontWeight:700}}>{t.phase}</span></td>
                <td style={{...ss.td,padding:"6px 8px"}}><b>{t.name}</b></td>
                <td style={{...ss.td,padding:"6px 8px",textAlign:"right",color:C.or,fontWeight:700}}>{t.qty} {t.unit}</td>
                <td style={{...ss.td,padding:"6px 8px",color:C.gr}}>{t.estStartDate||"—"} to {t.estEndDate||"—"}</td>
                <td style={{...ss.td,padding:"6px 8px",textAlign:"right"}}>{INR(t.matBudget||0)}</td>
                <td style={{...ss.td,padding:"6px 8px",textAlign:"right"}}>{INR(t.labBudget||0)}</td>
                <td style={{...ss.td,padding:"6px 8px",textAlign:"right"}}>{INR(t.macBudget||0)}</td>
                <td style={{...ss.td,padding:"6px 8px",textAlign:"right",fontWeight:700,color:C.gn}}>{INR(rowTot)}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </Modal>;
    })()}

    {/* ══ VIEW PURCHASE REQUISITION MODAL (Prompt 8a) ══ */}
    {viewPr && (
      <Modal title={"PURCHASE REQUISITION — " + (viewPr.prNo||viewPr.id)} onClose={()=>setViewPr(null)}>
        <div style={{padding:"12px 14px",background:"#060C1A",borderRadius:8,border:"1px solid "+C.tl,marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <span style={{fontSize:15,fontWeight:700,color:C.or}}>{viewPr.material}</span>
              <div style={{fontSize:11,color:C.si,marginTop:2}}>Site: <b>{sName(viewPr.siteId)}</b> · Date: <b>{viewPr.date}</b></div>
            </div>
            <Tag c={viewPr.status==="Approved"?"g":viewPr.status==="Rejected"?"r":"o"} ch={viewPr.status||"Pending"}/>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
          <KCard icon="📦" label="Requisition Qty" value={`${viewPr.qty} ${viewPr.unit||""}`} color={C.or}/>
          <KCard icon="📅" label="Required By" value={viewPr.reqByDate||"—"} color={C.tl}/>
          <KCard icon="👷" label="Raised By" value={viewPr.generatedBy||"Site"} color={C.pu}/>
        </div>
        <div style={{...ss.card,padding:12,marginBottom:12,background:"#060C1A",fontSize:11,display:"flex",flexDirection:"column",gap:6}}>
          <div><span style={{color:C.si}}>Reason for Requisition:</span> <b style={{color:C.text}}>{viewPr.reason||"—"}</b></div>
          <div><span style={{color:C.si}}>Linked Job Order:</span> <b style={{color:C.text}}>{viewPr.joId?((data.jobOrders||[]).find(j=>j.id===viewPr.joId)?.joNo||viewPr.joId):"—"}</b></div>
          <div><span style={{color:C.si}}>Approved By:</span> <b style={{color:viewPr.approvedBy?C.gn:C.rd}}>{viewPr.approvedBy||"Pending Approval"}</b></div>
          <div><span style={{color:C.si}}>Remarks / Preferred Terms:</span> <span style={{color:C.text}}>{viewPr.remarks||"—"}</span></div>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
          <Btn onClick={()=>setViewPr(null)}>Close</Btn>
        </div>
      </Modal>
    )}

    {/* ══ VIEW COMMERCIAL COMPARISON SHEET (CCS) MODAL (Prompt 8c) ══ */}
    {viewCcs && (()=>{
      const quotes = viewCcs.quotes||[];
      const l1 = quotes.find(q=>q.rank==="L1"||q.isL1) || quotes[0] || {};

      return <Modal title={"COMMERCIAL COMPARISON SHEET — " + (viewCcs.ccsNo||viewCcs.id)} onClose={()=>setViewCcs(null)} xwide>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,padding:"10px 14px",background:"#060C1A",borderRadius:8,border:"1px solid "+C.or}}>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:C.or}}>{viewCcs.material} — Commercial Evaluation</div>
            <div style={{fontSize:11,color:C.si,marginTop:2}}>PR Ref: <b>{viewCcs.prNo||viewCcs.prId||"—"}</b> · Requisition Qty: <b>{viewCcs.qty} {viewCcs.unit}</b> · Site: <b>{sName(viewCcs.siteId)}</b> · Date: <b>{viewCcs.date}</b></div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>printCCS(viewCcs, masters.company)} style={{padding:"6px 14px",borderRadius:6,border:"none",background:C.or,color:"#000",cursor:"pointer",fontWeight:700,fontSize:11,fontFamily:"monospace"}}>🖨 Print CCS</button>
            {viewCcs.status!=="PO Issued" && (
              <button onClick={()=>{
                const chosenQuote = l1;
                setForm({
                  date: new Date().toISOString().slice(0,10),
                  poNo: nextDocNo("PO", data.purchaseOrders||[], "poNo"),
                  siteId: viewCcs.siteId,
                  vendor: chosenQuote.vendor || viewCcs.selectedVendor,
                  prId: viewCcs.prId,
                  prNo: viewCcs.prNo,
                  ccsId: viewCcs.id,
                  ccsNo: viewCcs.ccsNo,
                  bidderRank: chosenQuote.rank || "L1",
                  landedRate: chosenQuote.landedRate,
                  deliveryDays: chosenQuote.deliveryDays,
                  paymentTerms: chosenQuote.paymentTerms,
                  status: "Active",
                  desc: `Procurement against ${viewCcs.prNo||"PR"} as per evaluated CCS ${viewCcs.ccsNo} (${chosenQuote.rank||"L1"} Bidder)`,
                  vendorNote: `Issued under CCS ${viewCcs.ccsNo} (${chosenQuote.rank||"L1"} Rank). Delivery within ${chosenQuote.deliveryDays||7} days. Terms: ${chosenQuote.paymentTerms||"Credit 30d"}.`,
                  lineItems: [{
                    item: viewCcs.material,
                    desc: viewCcs.material,
                    hsn: "72142000",
                    prQty: Number(viewCcs.qty)||1,
                    qty: Number(viewCcs.qty)||1,
                    unit: viewCcs.unit||"Nos",
                    rate: chosenQuote.rate||500,
                    gst: chosenQuote.gst||18,
                    disc: 0
                  }]
                });
                setViewCcs(null);
                setModal({t:"txn", mod:"po"});
              }} style={{padding:"6px 14px",borderRadius:6,border:"none",background:C.gn,color:"#000",cursor:"pointer",fontWeight:700,fontSize:11,fontFamily:"monospace"}}>📑 Issue Purchase Order</button>
            )}
            <button onClick={()=>setViewCcs(null)} style={{padding:"6px 14px",borderRadius:6,border:"1px solid #1E2D45",background:"transparent",color:C.gr,cursor:"pointer",fontSize:11}}>Close</button>
          </div>
        </div>

        <div style={{...ss.card,padding:12,marginBottom:14,background:"rgba(52,211,153,0.08)",border:"1px solid "+C.gn,fontSize:11,color:C.gn}}>
          💡 <b>Strategic Recommendation:</b> Vendor <b>{viewCcs.selectedVendor||l1.vendor||"L1 Bidder"}</b> is recommended for purchase order award based on lowest landed cost evaluation (₹{Number(l1.landedRate||0).toLocaleString("en-IN")}/{viewCcs.unit}), verified delivery schedule ({l1.deliveryDays||7} days), and compliance with PR specifications.
        </div>

        <div style={{...ss.card,overflowX:"auto",marginBottom:14}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead><tr style={{background:"#060C1A"}}>
              <th style={{...ss.th,padding:"7px 10px"}}>Rank</th>
              <th style={{...ss.th,padding:"7px 10px"}}>Vendor / Bidder</th>
              <th style={{...ss.th,padding:"7px 10px",textAlign:"right"}}>Quoted Rate</th>
              <th style={{...ss.th,padding:"7px 10px",textAlign:"center"}}>GST%</th>
              <th style={{...ss.th,padding:"7px 10px",textAlign:"right",color:C.tl}}>Landed Rate</th>
              <th style={{...ss.th,padding:"7px 10px",textAlign:"center"}}>Delivery</th>
              <th style={{...ss.th,padding:"7px 10px"}}>Payment Terms</th>
              <th style={{...ss.th,padding:"7px 10px",textAlign:"right"}}>Past Rate</th>
              <th style={{...ss.th,padding:"7px 10px"}}>Remarks &amp; Conditions</th>
            </tr></thead>
            <tbody>{quotes.map((q,idx)=>{
              const isL1 = q.rank==="L1" || q.isL1;
              return <tr key={idx} style={{background:isL1?"rgba(52,211,153,0.06)":"transparent",borderBottom:"1px solid #1A2840"}}>
                <td style={{...ss.td,padding:"7px 10px"}}><Tag c={isL1?"g":"o"} ch={q.rank||("L"+(idx+1))}/></td>
                <td style={{...ss.td,padding:"7px 10px"}}><b>{q.vendor}</b>{isL1&&<span style={{color:C.gn,marginLeft:6,fontSize:10}}>⭐ Recommended</span>}</td>
                <td style={{...ss.td,padding:"7px 10px",textAlign:"right"}}>{INR(q.rate)}</td>
                <td style={{...ss.td,padding:"7px 10px",textAlign:"center"}}>{q.gst||18}%</td>
                <td style={{...ss.td,padding:"7px 10px",textAlign:"right",color:C.tl,fontWeight:700}}>{INR(q.landedRate||Math.round((q.rate||0)*(1+(q.gst||18)/100)))}</td>
                <td style={{...ss.td,padding:"7px 10px",textAlign:"center"}}>{q.deliveryDays||"—"} Days</td>
                <td style={{...ss.td,padding:"7px 10px"}}>{q.paymentTerms||"—"}</td>
                <td style={{...ss.td,padding:"7px 10px",textAlign:"right",color:C.si}}>{INR(q.pastRate||0)}</td>
                <td style={{...ss.td,padding:"7px 10px",color:C.gr}}>{q.remarks||"—"}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </Modal>;
    })()}

    {showBackupModal && (
      <BackupRestoreModal
        isOpen={true}
        onClose={()=>setShowBackupModal(false)}
        data={data}
        setData={setData}
        masters={masters}
        setMasters={setMasters}
        settings={settings}
        setSettings={setSettings}
        user={user}
      />
    )}

    {/* ══ AI ASSISTANT DRAWER ══ */}
    {showAI && <div style={{position:"fixed", top:0, right:0, bottom:0, width:420, maxWidth:"90vw", background:"#091122", borderLeft:"1px solid "+G(C.tl,0.3), boxShadow:"-10px 0 40px rgba(0,0,0,0.7)", zIndex:200, display:"flex", flexDirection:"column"}}>
      <div style={{padding:"14px 18px", borderBottom:"1px solid #1E2D45", display:"flex", justifyContent:"space-between", alignItems:"center", background:"linear-gradient(135deg,#0E1B33,#091122)"}}>
        <div style={{display:"flex", alignItems:"center", gap:8}}>
          <span style={{fontSize:20}}>✨</span>
          <div>
            <div style={{color:C.tl, fontWeight:700, fontSize:13}}>SITE LEDGER AI ASSISTANT</div>
            <div style={{color:C.gr, fontSize:9}}>Civil Project &amp; Finance Co-Pilot</div>
          </div>
        </div>
        <button onClick={()=>setShowAI(false)} style={{background:"transparent", border:"none", color:C.gr, fontSize:18, cursor:"pointer"}}>✕</button>
      </div>

      {/* Suggested Query Chips */}
      <div style={{padding:"10px 14px", borderBottom:"1px solid #162236", display:"flex", gap:6, overflowX:"auto"}}>
        {[
          {l:"🏦 Bank Balances", q:"What is our total bank balance and cash in hand?"},
          {l:"📦 Material Stocks", q:"What is the current stock of materials?"},
          {l:"💰 Profit & Margins", q:"Show our revenue, gross profit and margin summary."},
          {l:"⚠️ Safety & Issues", q:"Are there any open accidents or critical site issues?"},
          {l:"📊 Job Order Budgets", q:"What is our Job Order budget and cost status?"}
        ].map((chip,ci)=>(
          <button key={ci} onClick={()=>{
            const userMsg = {role:"user", text:chip.q};
            let reply = "";
            const qLower = chip.q.toLowerCase();
            if(qLower.includes("bank") || qLower.includes("cash")) {
              reply = `🏦 Liquid Cash & Bank Position:\n- Total Bank Balances: ${INR(k.totalBankBal)}\n- Petty Cash: ${INR(k.totalPettyBal)}\n- Total Available Liquidity: ${INR(k.totalBankBal + k.totalPettyBal)}\nAccounts: ${masters.banks.map(b=>b.name+": "+INR(getBankBal(data.bankTxns||[],masters.banks,b.id))).join(", ")}`;
            } else if(qLower.includes("stock") || qLower.includes("material")) {
              reply = `📦 Current Inventory Highlights:\n${(data.inventory||[]).slice(0,5).map(iv=>`- ${iv.item}: ${iv.close} ${iv.unit} (Min: ${iv.min})`).join("\n")}\nTotal recorded stock value: ${INR((data.inventory||[]).reduce((a,i)=>a+(i.close||0)*(i.rate||0),0))}`;
            } else if(qLower.includes("profit") || qLower.includes("margin") || qLower.includes("revenue")) {
              reply = `💰 Financial Performance (FY):\n- Revenue: ${INR(k.tB)}\n- Material Purchases: ${INR(k.pB)}\n- Operating Expenses: ${INR(k.tE)}\n- Labour Payroll: ${INR(k.tP)}\n- Gross Profit: ${INR(k.profit)} (Margin: ${k.margin}%)`;
            } else if(qLower.includes("accident") || qLower.includes("issue") || qLower.includes("safety")) {
              const openIss = (data.issues||[]).filter(i=>i.status!=="Resolved");
              reply = `⚠️ Safety & Issues Report:\n- Open Issues: ${openIss.length}\n- Accidents Recorded: ${(data.issues||[]).filter(i=>i.isAccident).length}\nRecent:\n${openIss.slice(0,3).map(i=>`- [${i.priority}] ${i.title} (${sName(i.siteId)}) - Due: ${i.dueDate}`).join("\n")}`;
            } else if(qLower.includes("job order") || qLower.includes("budget")) {
              const joList = data.jobOrders||[];
              reply = `📊 Active Job Orders (${joList.length}):\n${joList.map(j=>{
                const b = (j.tasks||[]).reduce((a,t)=>a+(Number(t.matBudget)||0)+(Number(t.labBudget)||0)+(Number(t.macBudget)||0),0);
                return `- ${j.joNo} (${sName(j.siteId)}): Budget ${INR(b)}`;
              }).join("\n")}`;
            }
            setAiHistory(h=>[...h, userMsg, {role:"assistant", text:reply}]);
          }} style={{padding:"4px 8px", borderRadius:12, border:"1px solid #1E2D45", background:"#060C1A", color:C.si, fontSize:9, fontFamily:"monospace", cursor:"pointer", whiteSpace:"nowrap"}}>
            {chip.l}
          </button>
        ))}
      </div>

      {/* Message History */}
      <div style={{flex:1, padding:14, overflowY:"auto", display:"flex", flexDirection:"column", gap:10}}>
        {aiHistory.map((msg,mi)=>(
          <div key={mi} style={{alignSelf:msg.role==="user"?"flex-end":"flex-start", maxWidth:"88%", padding:"8px 12px", borderRadius:8, background:msg.role==="user"?G(C.tl,0.2):"#0E1729", border:msg.role==="user"?"1px solid "+C.tl:"1px solid #1E2D45", color:"#E2E8F0", fontSize:11, lineHeight:1.4, whiteSpace:"pre-wrap"}}>
            <div style={{fontSize:9, color:msg.role==="user"?C.tl:C.or, fontWeight:700, marginBottom:3}}>{msg.role==="user"?"You":"Civil AI"}</div>
            {msg.text}
          </div>
        ))}
      </div>

      {/* Input area */}
      <div style={{padding:12, borderTop:"1px solid #1E2D45", background:"#060C1A", display:"flex", gap:8}}>
        <input
          style={{flex:1, background:"#0A1223", border:"1px solid #1E2D45", borderRadius:6, padding:"8px 10px", color:"#E2E8F0", fontSize:11, fontFamily:"monospace", outline:"none"}}
          placeholder="Ask AI about stocks, costs, issues..."
          value={aiQuery}
          onChange={e=>setAiQuery(e.target.value)}
          onKeyDown={e=>{
            if(e.key==="Enter" && aiQuery.trim()) {
              const q = aiQuery.trim();
              const userMsg = {role:"user", text:q};
              setAiQuery("");
              const qLower = q.toLowerCase();
              let reply = `Here is what I found for "${q}":\n`;
              if(qLower.includes("bank") || qLower.includes("cash") || qLower.includes("balance")) {
                reply += `Total liquid funds are ${INR(k.totalBankBal + k.totalPettyBal)} across ${masters.banks.length} banks and ${masters.pettyCash.length} petty cash books.`;
              } else if(qLower.includes("profit") || qLower.includes("margin") || qLower.includes("rev")) {
                reply += `Current revenue is ${INR(k.tB)} with gross profit ${INR(k.profit)} (${k.margin}% margin).`;
              } else if(qLower.includes("steel") || qLower.includes("cement") || qLower.includes("stock") || qLower.includes("inventory")) {
                const matched = (data.inventory||[]).filter(i=>(i.item||"").toLowerCase().includes(qLower.replace("stock","").trim()));
                if(matched.length>0) reply += matched.map(m=>`- ${m.item}: ${m.close} ${m.unit} on hand`).join("\n");
                else reply += `Total ${data.inventory?.length||0} inventory items recorded with cumulative value of ${INR((data.inventory||[]).reduce((a,i)=>a+(i.close||0)*(i.rate||0),0))}.`;
              } else if(qLower.includes("issue") || qLower.includes("accident") || qLower.includes("safety")) {
                reply += `There are ${(data.issues||[]).filter(i=>i.status==="Open").length} open issues and ${(data.issues||[]).filter(i=>i.isAccident).length} accidents recorded.`;
              } else {
                reply += `Project financial summary: Revenue ${INR(k.tB)}, Expenses ${INR(k.tE)}, Materials ${INR(k.pB)}, Active Sites ${masters.sites.length}.`;
              }
              setAiHistory(h=>[...h, userMsg, {role:"assistant", text:reply}]);
            }
          }}
        />
        <Btn onClick={()=>{
          if(!aiQuery.trim()) return;
          const q = aiQuery.trim();
          const userMsg = {role:"user", text:q};
          setAiQuery("");
          const qLower = q.toLowerCase();
          let reply = `Here is what I found for "${q}":\n`;
          if(qLower.includes("bank") || qLower.includes("cash") || qLower.includes("balance")) {
            reply += `Total liquid funds are ${INR(k.totalBankBal + k.totalPettyBal)} across ${masters.banks.length} banks and ${masters.pettyCash.length} petty cash books.`;
          } else if(qLower.includes("profit") || qLower.includes("margin") || qLower.includes("rev")) {
            reply += `Current revenue is ${INR(k.tB)} with gross profit ${INR(k.profit)} (${k.margin}% margin).`;
          } else if(qLower.includes("steel") || qLower.includes("cement") || qLower.includes("stock") || qLower.includes("inventory")) {
            const matched = (data.inventory||[]).filter(i=>(i.item||"").toLowerCase().includes(qLower.replace("stock","").trim()));
            if(matched.length>0) reply += matched.map(m=>`- ${m.item}: ${m.close} ${m.unit} on hand`).join("\n");
            else reply += `Total ${data.inventory?.length||0} inventory items recorded with cumulative value of ${INR((data.inventory||[]).reduce((a,i)=>a+(i.close||0)*(i.rate||0),0))}.`;
          } else if(qLower.includes("issue") || qLower.includes("accident") || qLower.includes("safety")) {
            reply += `There are ${(data.issues||[]).filter(i=>i.status==="Open").length} open issues and ${(data.issues||[]).filter(i=>i.isAccident).length} accidents recorded.`;
          } else {
            reply += `Project financial summary: Revenue ${INR(k.tB)}, Expenses ${INR(k.tE)}, Materials ${INR(k.pB)}, Active Sites ${masters.sites.length}.`;
          }
          setAiHistory(h=>[...h, userMsg, {role:"assistant", text:reply}]);
        }} color={C.tl}>Ask</Btn>
      </div>
    </div>}
  </div>;
}
