const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let token = localStorage.getItem("stg_token") || "";
let currentUser = null, currentTimetable = null, authMode = "login";
let toastTimer;
function toast(message) { const el=$("#toast"); el.textContent=message; el.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),3200); }
async function api(url, options={}) {
  const headers={"Content-Type":"application/json",...(options.headers||{})};
  if(token) headers.Authorization=`Bearer ${token}`;
  const res=await fetch(url,{...options,headers});
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error||"Request failed.");
  return data;
}
function showAuth(mode="login") {
  authMode=mode; $("#authView").classList.remove("hidden"); $("#appView").classList.add("hidden");
  $$(".tab").forEach(b=>b.classList.toggle("active",b.dataset.auth===mode));
  $("#nameWrap").classList.toggle("hidden",mode!=="register");
  $("#name").required=mode==="register";
  $("#authSubmit").innerHTML=mode==="login"?"Sign in <span>→</span>":"Create account <span>→</span>";
}
function showApp() { $("#authView").classList.add("hidden"); $("#appView").classList.remove("hidden"); $("#sideName").textContent=currentUser.name; $("#sideEmail").textContent=currentUser.email; $("#avatar").textContent=currentUser.name.charAt(0).toUpperCase(); $("#todayLabel").textContent=new Intl.DateTimeFormat("en-IN",{weekday:"short",day:"numeric",month:"short"}).format(new Date()); navigate("dashboard"); refreshSchedules(); }
function navigate(view) {
  ["dashboard","builder","saved","result"].forEach(v=>$(`#${v}View`).classList.toggle("hidden",v!==view));
  $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  $("#pageTitle").textContent=({dashboard:"Dashboard",builder:"Create timetable",saved:"Saved schedules",result:"Timetable preview"})[view];
  if(view==="saved") refreshSchedules();
}
async function refreshSchedules() {
  try { const {timetables}=await api("/api/timetables"); $("#statSchedules").textContent=timetables.length; renderScheduleList(timetables.slice(0,3),"recentList"); renderScheduleList(timetables,"allSchedules"); }
  catch(e){toast(e.message);}
}
function renderScheduleList(items,target) {
  const el=$(`#${target}`);
  if(!items.length){el.className="schedule-list empty-state";el.textContent="No schedules yet. Create your first timetable to see it here.";return;}
  el.className="schedule-list";
  el.innerHTML=items.map(t=>`<article class="schedule-item"><div><strong>${escapeHTML(t.title)}</strong><small>${new Date(t.generatedAt).toLocaleString()} · ${t.days.length} days · ${t.slots.length} periods/day</small></div><div><button data-open="${t.id}">Open schedule</button><button class="delete" data-delete="${t.id}">Delete</button></div></article>`).join("");
}
function escapeHTML(value){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function addSubject(name="",teacher="",periods=3,type="Theory") {
  const row=document.createElement("div");row.className="subject-row";
  row.innerHTML=`<div class="field"><label>Subject</label><input class="sub-name" placeholder="e.g. Mathematics" value="${escapeHTML(name)}"></div><div class="field"><label>Faculty</label><input class="sub-teacher" placeholder="Faculty name" value="${escapeHTML(teacher)}"></div><div class="field"><label>Periods</label><input class="sub-periods" type="number" min="1" max="10" value="${periods}"></div><div class="field type-field"><label>Type</label><select class="sub-type"><option ${type==="Theory"?"selected":""}>Theory</option><option ${type==="Lab"?"selected":""}>Lab</option><option ${type==="Tutorial"?"selected":""}>Tutorial</option></select></div><button class="remove-row" type="button" title="Remove subject">×</button>`;
  $("#subjectRows").append(row); updateSubjectCount();
}
function updateSubjectCount(){const n=$$(".subject-row").length;$("#subjectCount").textContent=`${n} subject${n===1?"":"s"}`;}
function collectChecked(selector){return $$(selector).filter(x=>x.checked).map(x=>x.value);}
function renderTimetable(t) {
  currentTimetable=t; $("#resultTitle").textContent=t.title; $("#resultMeta").textContent=`Generated ${new Date(t.generatedAt).toLocaleString()} · ${t.days.length} days`;
  const cells=new Map(t.grid.map(c=>[`${c.day}|${c.slot}`,c]));
  let html=`<table class="timetable"><thead><tr><th>TIME</th>${t.days.map(d=>`<th>${d.slice(0,3).toUpperCase()}</th>`).join("")}</tr></thead><tbody>`;
  for(const slot of t.slots){html+=`<tr><td>${escapeHTML(slot)}</td>`;for(const day of t.days){const c=cells.get(`${day}|${slot}`);html+=c&&c.subject?`<td class="lesson"><strong>${escapeHTML(c.subject)}</strong><small>${escapeHTML(c.teacher)} · ${escapeHTML(c.room)}</small></td>`:`<td class="free">—</td>`;}html+="</tr>";}
  html+="</tbody></table>";$("#timetableWrap").innerHTML=html;navigate("result");
}
$("#authForm").addEventListener("submit",async e=>{e.preventDefault();const payload={email:$("#email").value,password:$("#password").value};if(authMode==="register")payload.name=$("#name").value;try{const data=await api(`/api/${authMode}`,{method:"POST",body:JSON.stringify(payload)});token=data.token;localStorage.setItem("stg_token",token);currentUser=data.user;showApp();toast(authMode==="login"?"Welcome back!":"Account created successfully.");}catch(err){toast(err.message);}});
$$(".tab").forEach(b=>b.addEventListener("click",()=>showAuth(b.dataset.auth)));
$$(".nav-item").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.view)));
$$("[data-go='saved']").forEach(b=>b.addEventListener("click",()=>navigate("saved")));
$("#newTop").addEventListener("click",()=>navigate("builder"));$("#startCreate").addEventListener("click",()=>navigate("builder"));$("#backBuilder").addEventListener("click",()=>navigate("builder"));
$("#addSubject").addEventListener("click",()=>addSubject());
$("#subjectRows").addEventListener("click",e=>{if(e.target.classList.contains("remove-row")){e.target.closest(".subject-row").remove();updateSubjectCount();}});
$("#generate").addEventListener("click",async()=>{
 const subjects=$$(".subject-row").map(r=>({name:r.querySelector(".sub-name").value,teacher:r.querySelector(".sub-teacher").value,periods:r.querySelector(".sub-periods").value,type:r.querySelector(".sub-type").value})).filter(s=>s.name.trim());
 const days=collectChecked("#dayChoices input"),slots=collectChecked("#slotChoices input"),rooms=$("#rooms").value.split(",").map(s=>s.trim()).filter(Boolean);
 if(!subjects.length)return toast("Add at least one subject.");
 if(!days.length||!slots.length)return toast("Choose at least one day and one period.");
 try{const data=await api("/api/generate",{method:"POST",body:JSON.stringify({title:$("#scheduleTitle").value,subjects,days,slots,rooms})});renderTimetable(data.timetable);refreshSchedules();toast("Your timetable was generated and saved.");}catch(e){toast(e.message);}
});
$("#printBtn").addEventListener("click",()=>window.print());
$("#logout").addEventListener("click",async()=>{try{await api("/api/logout",{method:"POST"});}catch{}token="";localStorage.removeItem("stg_token");currentUser=null;showAuth();toast("Signed out.");});
document.addEventListener("click",async e=>{
 const open=e.target.closest("[data-open]");if(open){try{const {timetables}=await api("/api/timetables");const t=timetables.find(x=>x.id===open.dataset.open);if(t)renderTimetable(t);}catch(err){toast(err.message);}}
 const del=e.target.closest("[data-delete]");if(del&&confirm("Delete this timetable?")){try{await api(`/api/timetables/${del.dataset.delete}`,{method:"DELETE"});refreshSchedules();toast("Timetable deleted.");}catch(err){toast(err.message);}}
});
(async function init(){addSubject("Mathematics","Dr. Rao",4,"Theory");addSubject("Database Management","Ms. Priya",3,"Theory");addSubject("Operating Systems","Mr. Kumar",3,"Theory");addSubject("Web Technology","Ms. Anu",3,"Lab");addSubject("Computer Networks","Dr. Ravi",3,"Theory");try{const data=await api("/api/me");currentUser=data.user;showApp();}catch{token="";localStorage.removeItem("stg_token");showAuth();}})();
