const { createClient } = supabase;
const db = createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY);

let currentUser = null;
let currentProfile = null;
let isSignup = false;
let campaigns = [];

const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

function toast(msg){
  const t=$("toast"); t.textContent=msg; t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),3000);
}

function openModal(id){$(id).classList.remove("hidden")}
function closeModal(id){$(id).classList.add("hidden")}

function setView(view){
  $$(".view").forEach(v=>v.classList.remove("active"));
  const el=$(view+"View"); if(el) el.classList.add("active");
  $$(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  window.scrollTo({top:0,behavior:"smooth"});
  if(view==="my-applications") loadMyApplications();
  if(view==="profile") fillProfile();
  if(view==="admin") loadAdmin();
}

function updateAuthUI(){
  $$(".auth-only").forEach(e=>e.classList.toggle("hidden",!currentUser));
  $$(".admin-only").forEach(e=>e.classList.toggle("hidden",!currentProfile || currentProfile.role!=="admin"));
  $("authBtn").textContent=currentUser ? "تسجيل الخروج" : "تسجيل الدخول";
}

async function loadSession(){
  const {data:{session}}=await db.auth.getSession();
  currentUser=session?.user||null;
  await loadProfile();
  updateAuthUI();
  await loadCampaigns();
}

async function loadProfile(){
  if(!currentUser){currentProfile=null;return}
  const {data,error}=await db.from("profiles").select("*").eq("id",currentUser.id).maybeSingle();
  if(error) console.error(error);
  currentProfile=data||null;
}

async function loadCampaigns(){
  const {data,error}=await db.from("campaigns").select("*");
if(error){toast("خطأ: "+error.message);console.error(error);return}
  campaigns=data||[];
  renderCampaigns(campaigns.slice(0,3),"featuredCampaigns");
  renderCampaigns(campaigns,"allCampaigns");
  $("homeCampaignCount").textContent=campaigns.length;
  $("homeOpenCount").textContent=campaigns.filter(c=>c.status==="مفتوحة").length;
  $("homeFilledCount").textContent=campaigns.reduce((n,c)=>n+(c.filled||0),0);
}

function renderCampaigns(list,targetId){
  const target=$(targetId);
  if(!target)return;
  if(!list.length){target.innerHTML='<div class="campaign"><h3>لا توجد فرص حاليًا</h3><p>ستظهر الفرص الجديدة هنا عند إضافتها.</p></div>';return}
  target.innerHTML=list.map(c=>{
    const remaining=Math.max((c.seats||0)-(c.filled||0),0);
    const disabled=c.status!=="مفتوحة" || remaining<=0;
    return `<article class="campaign">
      <div class="campaign-icon">${c.icon||"✦"}</div>
      <h3>${escapeHtml(c.title)}</h3>
      <p>${escapeHtml(c.description||"")}</p>
      <div class="meta">
        <span class="tag">📅 ${formatDate(c.event_date)}</span>
        <span class="tag">📍 ${escapeHtml(c.location||"")}</span>
      </div>
      <div class="campaign-foot">
        <span class="seats">${remaining} مقعد متاح من ${c.seats}</span>
        <button class="small-btn" ${disabled?"disabled":""} onclick="startApplication('${c.id}')">${disabled?"غير متاحة":"تقديم"}</button>
      </div>
    </article>`
  }).join("");
}

function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function formatDate(d){return new Intl.DateTimeFormat("ar-SA",{dateStyle:"medium"}).format(new Date(d+"T00:00:00"))}

async function startApplication(id){
  if(!currentUser){openModal("authModal");toast("سجّلي الدخول أولًا للتقديم");return}
  const c=campaigns.find(x=>x.id===id);
  if(!c)return;
  $("applyCampaignId").value=id;
  $("applyTitle").textContent=`التقديم: ${c.title}`;
  $("applyName").value=currentProfile?.full_name||"";
  $("applyCenter").value=currentProfile?.center||"";
  openModal("applyModal");
}

async function submitApplication(e){
  e.preventDefault();
  if(!currentUser){toast("سجّلي الدخول أولًا");return}
  const payload={
    campaign_id:$("applyCampaignId").value,
    user_id:currentUser.id,
    full_name:$("applyName").value.trim(),
    center:$("applyCenter").value.trim(),
    compensation:$("applyCompensation").value,
    note:$("applyNote").value.trim()
  };
  const {error}=await db.from("applications").insert(payload);
  if(error){
    if(error.code==="23505") toast("سبق أن قدمتِ على هذه الحملة");
    else toast("تعذر إرسال الطلب");
    console.error(error); return;
  }
  closeModal("applyModal"); toast("تم إرسال طلب التطوع بنجاح 🌷");
  $("applyForm").reset();
  await loadCampaigns();
}

async function loadMyApplications(){
  if(!currentUser)return;
  const {data,error}=await db.from("applications").select("*, campaigns(title,event_date,location)").eq("user_id",currentUser.id).order("created_at",{ascending:false});
  const target=$("applicationsList");
  if(error){target.innerHTML="<div class='campaign'>تعذر تحميل الطلبات.</div>";return}
  if(!data?.length){target.innerHTML="<div class='campaign'><h3>لا توجد طلبات بعد</h3><p>ابدئي باستعراض الفرص التطوعية.</p><button class='primary-btn' data-view='campaigns'>استعراض الفرص</button></div>";return}
  target.innerHTML=data.map(a=>`<div class="application">
    <div><h3>${escapeHtml(a.campaigns?.title||"حملة")}</h3><small>${formatDate(a.campaigns?.event_date)} • ${escapeHtml(a.campaigns?.location||"")}</small><p>التعويض: ${escapeHtml(a.compensation)}</p></div>
    <span class="status ${statusClass(a.status)}">${escapeHtml(a.status)}</span>
  </div>`).join("");
}
function statusClass(s){return s==="مقبول"?"status-accepted":s==="مرفوض"?"status-rejected":s==="مكتمل"?"status-complete":"status-review"}

function fillProfile(){
  if(!currentProfile)return;
  $("profileName").value=currentProfile.full_name||"";
  $("profileCenter").value=currentProfile.center||"";
}

async function saveProfile(e){
  e.preventDefault();
  if(!currentUser)return;
  const {error}=await db.from("profiles").update({full_name:$("profileName").value.trim(),center:$("profileCenter").value.trim()}).eq("id",currentUser.id);
  if(error){toast("تعذر حفظ البيانات");return}
  await loadProfile(); toast("تم حفظ البيانات");
}

async function loadAdmin(){
  if(!currentProfile || currentProfile.role!=="admin"){setView("home");toast("هذه الصفحة للمشرف فقط");return}
  const [{data:cs,error:e1},{data:apps,error:e2}]=await Promise.all([
    db.from("campaigns").select("*").order("event_date",{ascending:true}),
    db.from("applications").select("*, campaigns(title)").order("created_at",{ascending:false})
  ]);
  if(e1||e2){toast("تعذر تحميل لوحة التحكم");return}
  $("adminCampaigns").textContent=cs?.length||0;
  $("adminApplications").textContent=apps?.length||0;
  $("adminAccepted").textContent=apps?.filter(a=>a.status==="مقبول"||a.status==="مكتمل").length||0;
  $("adminCampaignList").innerHTML=(cs||[]).map(c=>`<div class="admin-row">
    <div><b>${escapeHtml(c.title)}</b><small>${formatDate(c.event_date)} • ${escapeHtml(c.location||"")} • ${c.filled}/${c.seats}</small></div>
    <div class="admin-buttons"><button class="danger" onclick="closeCampaign('${c.id}')">إغلاق</button></div>
  </div>`).join("")||"<p>لا توجد حملات.</p>";
  $("adminApplicationList").innerHTML=(apps||[]).map(a=>`<div class="admin-row">
    <div><b>${escapeHtml(a.full_name)}</b><small>${escapeHtml(a.campaigns?.title||"")} • ${escapeHtml(a.center)} • ${escapeHtml(a.compensation)}</small></div>
    <div class="admin-buttons">
      ${a.status==="قيد المراجعة"?`<button class="success" onclick="setApplicationStatus('${a.id}','مقبول')">قبول</button><button class="danger" onclick="setApplicationStatus('${a.id}','مرفوض')">رفض</button>`:""}
      ${a.status==="مقبول"?`<button class="success" onclick="setApplicationStatus('${a.id}','مكتمل')">تسجيل كمكتمل</button>`:""}
      <span class="status ${statusClass(a.status)}">${escapeHtml(a.status)}</span>
    </div>
  </div>`).join("")||"<p>لا توجد طلبات.</p>";
}

async function setApplicationStatus(id,status){
  const {error}=await db.from("applications").update({status}).eq("id",id);
  if(error){toast("تعذر تحديث الطلب");console.error(error);return}
  toast("تم تحديث حالة الطلب"); await loadAdmin(); await loadCampaigns();
}
async function closeCampaign(id){
  const {error}=await db.from("campaigns").update({status:"مغلقة"}).eq("id",id);
  if(error){toast("تعذر إغلاق الحملة");return}
  toast("تم إغلاق الحملة"); await loadAdmin(); await loadCampaigns();
}

async function createCampaign(e){
  e.preventDefault();
  const payload={title:$("cTitle").value.trim(),description:$("cDescription").value.trim(),event_date:$("cDate").value,location:$("cLocation").value.trim(),seats:Number($("cSeats").value),filled:0,status:"مفتوحة",icon:"✦"};
  const {error}=await db.from("campaigns").insert(payload);
  if(error){toast("تعذر إنشاء الحملة");console.error(error);return}
  closeModal("campaignModal"); $("campaignForm").reset(); toast("تم إنشاء الحملة"); await loadAdmin(); await loadCampaigns();
}

async function authSubmit(e){
  e.preventDefault();
  const email=$("authEmail").value.trim(), password=$("authPassword").value;
  if(isSignup){
    const full_name=$("authName").value.trim(), center=$("authCenter").value.trim();
    if(!full_name||!center){toast("أكملي البيانات");return}
    const {data,error}=await db.auth.signUp({email,password,options:{data:{full_name,center}}});
    if(error){toast(error.message);return}
    if(data.user && !data.session) toast("تم إنشاء الحساب. تحققي من بريدك الإلكتروني لتفعيل الحساب.");
    else toast("تم إنشاء الحساب بنجاح");
    if(data.session){currentUser=data.user;await loadProfile();updateAuthUI();}
    closeModal("authModal");
  }else{
    const {data,error}=await db.auth.signInWithPassword({email,password});
    if(error){toast("البريد أو كلمة المرور غير صحيحة");return}
    currentUser=data.user; await loadProfile(); updateAuthUI(); closeModal("authModal"); toast("مرحبًا بك 🌷");
  }
}

async function signOut(){
  await db.auth.signOut(); currentUser=null; currentProfile=null; updateAuthUI(); setView("home"); toast("تم تسجيل الخروج");
}

function toggleAuth(){
  isSignup=!isSignup;
  $("authTitle").textContent=isSignup?"إنشاء حساب متطوع":"تسجيل الدخول";
  $("authSubmit").textContent=isSignup?"إنشاء الحساب":"دخول";
  $("toggleAuthMode").textContent=isSignup?"لديك حساب؟ تسجيل الدخول":"ليس لديك حساب؟ إنشاء حساب";
  $("signupFields").classList.toggle("hidden",!isSignup);
  $("authName").required=isSignup; $("authCenter").required=isSignup;
}

$$("[data-view]").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
$$("[data-close]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.close)));
$("authBtn").addEventListener("click",()=>currentUser?signOut():openModal("authModal"));
$("heroLoginBtn").addEventListener("click",()=>currentUser?setView("profile"):openModal("authModal"));
$("toggleAuthMode").addEventListener("click",toggleAuth);
$("authForm").addEventListener("submit",authSubmit);
$("applyForm").addEventListener("submit",submitApplication);
$("profileForm").addEventListener("submit",saveProfile);
$("newCampaignBtn").addEventListener("click",()=>openModal("campaignModal"));
$("campaignForm").addEventListener("submit",createCampaign);
$("refreshAdminBtn").addEventListener("click",loadAdmin);
$("searchInput").addEventListener("input",filterCampaigns);
$("statusFilter").addEventListener("change",filterCampaigns);

function filterCampaigns(){
  const q=$("searchInput").value.trim().toLowerCase(), st=$("statusFilter").value;
  renderCampaigns(campaigns.filter(c=>(st==="all"||c.status===st)&&(`${c.title} ${c.location} ${c.description}`.toLowerCase().includes(q))),"allCampaigns");
}

db.auth.onAuthStateChange(async (_event,session)=>{
  currentUser=session?.user||null;
  await loadProfile();
  updateAuthUI();
});

loadSession();
