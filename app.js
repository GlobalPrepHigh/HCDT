// ⚠️ PASTE YOUR TWO SUPABASE KEYS INSIDE THE QUOTES BELOW:
const SUPABASE_URL = "https://supabase.co";
const SUPABASE_KEY = "sb_publishable_llm2wWoQpOl3oj1xJFkRfA_Fd69Aj8J";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let isSignupMode = false;
let currentFamily = null;
let currentUser = null;
let studentsCache = [];
let assignmentsCache = [];
let submissionsCache = [];
let achievementsCache = [];

// --- AUTH UI ---
function switchAuthTab(role) {
  document.getElementById("authError").innerText = "";
  document.getElementById("tabParent").classList.toggle("active", role === "parent");
  document.getElementById("tabStudent").classList.toggle("active", role === "student");
  document.getElementById("parentAuthForm").classList.toggle("hidden", role !== "parent");
  document.getElementById("studentAuthForm").classList.toggle("hidden", role !== "student");
}

function toggleParentMode(e) {
  e.preventDefault();
  isSignupMode = !isSignupMode;
  document.getElementById("signupExtraFields").classList.toggle("hidden", !isSignupMode);
  document.getElementById("parentAuthTitle").innerText = isSignupMode ? "Create Free Academy Account" : "Parent / Administrator Login";
  document.getElementById("parentSubmitBtn").innerText = isSignupMode ? "Create Academy & Sign In" : "Sign In";
  document.getElementById("toggleAuthText").innerText = isSignupMode ? "Already have an account?" : "New traveling family?";
  document.getElementById("toggleAuthLink").innerText = isSignupMode ? "Sign In" : "Create Free Academy Account";
}

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// --- PARENT LOGIN / SIGNUP ---
async function handleParentAuth() {
  const errEl = document.getElementById("authError");
  errEl.innerText = "";
  const email = document.getElementById("parentEmail").value.trim();
  const password = document.getElementById("parentPassword").value;

  if (!email || !password) return (errEl.innerText = "Please enter email and password.");

  if (isSignupMode) {
    const fullName = document.getElementById("parentName").value.trim();
    const academyName = document.getElementById("academyName").value.trim();
    if (!fullName || !academyName) return (errEl.innerText = "Please enter your name and Academy name.");

    const { data: authData, error: authErr } = await db.auth.signUp({ email, password });
    if (authErr) return (errEl.innerText = authErr.message);

    const inviteCode = generateInviteCode();
    const { data: famData, error: famErr } = await db
      .from("families")
      .insert([{ family_name: academyName, invite_code: inviteCode }])
      .select()
      .single();
    if (famErr) return (errEl.innerText = famErr.message);

    const { data: profData, error: profErr } = await db
      .from("profiles")
      .insert([{ id: authData.user.id, family_id: famData.id, full_name: fullName, role: "parent" }])
      .select()
      .single();
    if (profErr) return (errEl.innerText = profErr.message);

    currentFamily = famData;
    currentUser = profData;
    loadParentDashboard();
  } else {
    const { data: authData, error: authErr } = await db.auth.signInWithPassword({ email, password });
    if (authErr) return (errEl.innerText = authErr.message);

    const { data: profData } = await db.from("profiles").select("*").eq("id", authData.user.id).single();
    const { data: famData } = await db.from("families").select("*").eq("id", profData.family_id).single();

    currentUser = profData;
    currentFamily = famData;
    loadParentDashboard();
  }
}

// --- STUDENT PIN LOGIN ---
async function handleStudentLogin() {
  const errEl = document.getElementById("authError");
  errEl.innerText = "";
  const code = document.getElementById("stuInviteCode").value.trim().toUpperCase();
  const username = document.getElementById("stuUsername").value.trim().toLowerCase();
  const pin = document.getElementById("stuPin").value.trim();

  if (!code || !username || !pin) return (errEl.innerText = "Fill in Invite Code, Username, and PIN.");

  const { data: fam } = await db.from("families").select("*").eq("invite_code", code).single();
  if (!fam) return (errEl.innerText = "Invalid Academy Invite Code.");

  const { data: stu } = await db
    .from("profiles")
    .select("*")
    .eq("family_id", fam.id)
    .eq("username", username)
    .eq("pin", pin)
    .eq("role", "student")
    .single();

  if (!stu) return (errEl.innerText = "Incorrect Username or PIN.");

  currentFamily = fam;
  currentUser = stu;
  loadStudentDashboard();
}

function logout() {
  db.auth.signOut();
  location.reload();
}

// --- PARENT DASHBOARD ---
async function loadParentDashboard() {
  document.getElementById("authSection").classList.add("hidden");
  document.getElementById("parentDashboard").classList.remove("hidden");
  document.getElementById("logoutBtn").classList.remove("hidden");

  document.getElementById("dashAcademyName").innerText = currentFamily.family_name;
  document.getElementById("dashInviteCode").innerText = currentFamily.invite_code;

  ["q1s","q1e","q2s","q2e","q3s","q3e","q4s","q4e"].forEach(id => {
    const map = {q1s:"q1_start",q1e:"q1_end",q2s:"q2_start",q2e:"q2_end",q3s:"q3_start",q3e:"q3_end",q4s:"q4_start",q4e:"q4_end"};
    if (currentFamily[map[id]]) document.getElementById(id).value = currentFamily[map[id]];
  });

  await refreshFamilyData();
}

function showParentView(viewName, btn) {
  document.querySelectorAll(".p-view").forEach(el => el.classList.add("hidden"));
  document.getElementById("pView-" + viewName).classList.remove("hidden");
  document.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
  btn.classList.add("active");
  if (viewName === "transcript") renderOfficialRecords();
}

async function refreshFamilyData() {
  const { data: profs } = await db.from("profiles").select("*").eq("family_id", currentFamily.id).eq("role", "student");
  studentsCache = profs || [];

  const { data: assigns } = await db.from("assignments").select("*").eq("family_id", currentFamily.id).order("created_at", { ascending: false });
  assignmentsCache = assigns || [];

  const { data: subs } = await db.from("submissions").select("*");
  submissionsCache = subs || [];

  const { data: achs } = await db.from("achievements").select("*").eq("family_id", currentFamily.id).order("date_completed", { ascending: false });
  achievementsCache = achs || [];

  renderStudents();
  renderGradingQueue();
  renderAchievements();
}

async function addStudent() {
  const full_name = document.getElementById("newStuName").value.trim();
  const grade_level = document.getElementById("newStuGrade").value;
  const expected_grad_year = parseInt(document.getElementById("newStuGradYear").value) || 2028;
  const username = document.getElementById("newStuUser").value.trim().toLowerCase();
  const pin = document.getElementById("newStuPin").value.trim();

  if (!full_name || !username || pin.length !== 4) return alert("Enter full name, username, and a 4-digit PIN.");

  await db.from("profiles").insert([{
    family_id: currentFamily.id, full_name, grade_level, expected_grad_year, username, pin, role: "student"
  }]);

  document.getElementById("newStuName").value = "";
  document.getElementById("newStuUser").value = "";
  document.getElementById("newStuPin").value = "";
  await refreshFamilyData();
}

function renderStudents() {
  const list = document.getElementById("studentList");
  const selects = ["assignStudentSelect", "achStudentSelect", "transStudentSelect"];
  list.innerHTML = studentsCache.map(s => `
    <div class="item-card">
      <strong>${s.full_name}</strong> (${s.grade_level} Grade • Class of ${s.expected_grad_year})<br>
      <small class="muted">Student Login: Username <b>${s.username}</b> | PIN <b>${s.pin}</b></small>
    </div>
  `).join("") || "<p class='muted'>No students added yet.</p>";

  const options = studentsCache.map(s => `<option value="${s.id}">${s.full_name} (${s.grade_level})</option>`).join("");
  selects.forEach(id => (document.getElementById(id).innerHTML = options));
}

async function saveQuarters() {
  await db.from("families").update({
    q1_start: document.getElementById("q1s").value || null, q1_end: document.getElementById("q1e").value || null,
    q2_start: document.getElementById("q2s").value || null, q2_end: document.getElementById("q2e").value || null,
    q3_start: document.getElementById("q3s").value || null, q3_end: document.getElementById("q3e").value || null,
    q4_start: document.getElementById("q4s").value || null, q4_end: document.getElementById("q4e").value || null
  }).eq("id", currentFamily.id);
  alert("Quarter dates saved!");
}

async function createAssignment() {
  const student_id = document.getElementById("assignStudentSelect").value;
  const subject = document.getElementById("assignSubject").value.trim();
  const course_level = document.getElementById("assignLevel").value;
  const quarter = document.getElementById("assignQuarter").value;
  const credits = parseFloat(document.getElementById("assignCredits").value);
  const title = document.getElementById("assignTitle").value.trim();
  const description = document.getElementById("assignDesc").value.trim();
  const location_tag = document.getElementById("assignLocation").value.trim();

  if (!student_id || !subject || !title) return alert("Select a student and enter Subject & Title.");

  await db.from("assignments").insert([{
    family_id: currentFamily.id, student_id, subject, course_level, quarter, credits, title, description, location_tag
  }]);

  document.getElementById("assignTitle").value = "";
  document.getElementById("assignDesc").value = "";
  alert("Assignment posted to student portal!");
  await refreshFamilyData();
}

function renderGradingQueue() {
  const queue = document.getElementById("gradingQueue");
