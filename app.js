const SUPABASE_URL = ["https://", "cnjgoixunkygvwbuifiy", ".supabase.co"].join("");
const SUPABASE_KEY = "sb_publishable_llm2wWoQpOl3oj1xJFkRfA_Fd69Aj8J";

let authToken = null;
let isSignupMode = false;
let currentFamily = null;
let currentUser = null;
let studentsCache = [];
let assignmentsCache = [];
let submissionsCache = [];
let achievementsCache = [];

async function sbAuth(endpoint, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${endpoint}`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || data.message || "Authentication failed");
  return data;
}

async function sbQuery(table, { method = "GET", query = "", body = null, single = false } = {}) {
  const headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${authToken || SUPABASE_KEY}`,
    "Content-Type": "application/json"
  };
  if (method === "POST" || method === "PATCH") {
    headers["Prefer"] = "return=representation";
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query ? "?" + query : ""}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });

  const text = await res.text();
  let data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error((data && data.message) || "Database error");
  if (single && Array.isArray(data)) return data.at(0) || null;

  return data;
}

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

async function handleParentAuth() {
  const errEl = document.getElementById("authError");
  const btn = document.getElementById("parentSubmitBtn");
  errEl.innerText = "";
  const rawLogin = document.getElementById("parentEmail").value.trim().toLowerCase();
  const password = document.getElementById("parentPassword").value;

    if (!rawLogin || !password) return (errEl.innerText = "Please enter your email or User ID and password.");
  const email = rawLogin.includes("@") ? rawLogin : rawLogin.replace(/[^a-z0-9._-]/g, "") + "@globalprephigh.org";

  try {
    btn.disabled = true;
    btn.innerText = "Connecting...";

    if (isSignupMode) {
      const fullName = document.getElementById("parentName").value.trim();
      const academyName = document.getElementById("academyName").value.trim();
      if (!fullName || !academyName) throw new Error("Please enter your name and Academy name.");

      const authData = await sbAuth("signup", { email, password });
      const userObj = authData.user || authData;
      if (!userObj || !userObj.id) throw new Error("Check your email to confirm your account, or disable Email Confirmation in Supabase Auth settings.");
      if (authData.access_token) authToken = authData.access_token;

      const inviteCode = generateInviteCode();
      const famData = await sbQuery("families", {
        method: "POST",
        body: { family_name: academyName, invite_code: inviteCode },
        single: true
      });

      const profData = await sbQuery("profiles", {
        method: "POST",
        body: { id: userObj.id, family_id: famData.id, full_name: fullName, role: "parent" },
        single: true
      });

      currentFamily = famData;
      currentUser = profData;
      await loadParentDashboard();
    } else {
      const authData = await sbAuth("token?grant_type=password", { email, password });
      authToken = authData.access_token;

      const profData = await sbQuery("profiles", {
        query: `id=eq.${authData.user.id}&select=*`,
        single: true
      });
      if (!profData) throw new Error("Profile not found for this account.");

      const famData = await sbQuery("families", {
        query: `id=eq.${profData.family_id}&select=*`,
        single: true
      });

      currentUser = profData;
      currentFamily = famData;
      await loadParentDashboard();
    }
  } catch (err) {
    errEl.innerText = err.message;
  } finally {
    btn.disabled = false;
    btn.innerText = isSignupMode ? "Create Academy & Sign In" : "Sign In";
  }
}
function toggleAccountModal(show) {
  const modal = document.getElementById("accountModal");
  if (!modal) return;
  modal.classList.toggle("hidden", !show);
  modal.style.display = show ? "flex" : "none";
}

async function recoverParentPassword(e) {
  if (e) e.preventDefault();
  const raw = document.getElementById("parentEmail").value.trim().toLowerCase();
  if (!raw) return alert("Enter your Email Address (or short User ID) in the box above first, then click Forgot Password.");
  if (!raw.includes("@")) {
    return alert("Short User IDs (like '" + raw + "') do not have an inbox for password reset emails. Please sign in with your User ID or contact your academy administrator to reset it.");
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: raw })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.msg || data.error_description || "Could not send password reset email.");
    }
    alert("Password reset link sent to " + raw + "! Please check your email inbox.");
  } catch (err) {
    alert(err.message);
  }
}

async function updateParentCredentials(mode) {
  const payload = {};
    if (mode === "login") {
    const raw = document.getElementById("newParentLogin").value.trim().toLowerCase();
    if (!raw) return alert("Enter a new short User ID or email address.");
    payload.email = raw.includes("@") ? raw : raw.replace(/[^a-z0-9._-]/g, "") + "@globalprephigh.org";
    } else {
    const pw = document.getElementById("newParentPassword").value;
    if (!pw || pw.length < 6) return alert("Password must be at least 6 characters.");
    payload.password = pw;
  }

  try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: "PUT",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json"
      },

      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.msg || data.error_description || "Could not update account.");
    document.getElementById("newParentLogin").value = "";
    document.getElementById("newParentPassword").value = "";
    alert(mode === "login"
      ? "Login updated! Next time you sign in, you can use your new short User ID or email."
      : "Password updated successfully!");
  } catch (err) {
    alert(err.message);
  }
}

async function handleStudentLogin() {
  const errEl = document.getElementById("authError");
  errEl.innerText = "";
  const code = document.getElementById("stuInviteCode").value.trim().toUpperCase();
  const username = document.getElementById("stuUsername").value.trim().toLowerCase();
  const pin = document.getElementById("stuPin").value.trim();

  if (!code || !username || !pin) return (errEl.innerText = "Fill in Invite Code, Username, and PIN.");

  try {
    const fam = await sbQuery("families", {
      query: `invite_code=eq.${encodeURIComponent(code)}&select=*`,
      single: true
    });
    if (!fam) return (errEl.innerText = "Invalid Academy Invite Code.");

    const stu = await sbQuery("profiles", {
      query: `family_id=eq.${fam.id}&username=eq.${encodeURIComponent(username)}&pin=eq.${encodeURIComponent(pin)}&role=eq.student&select=*`,
      single: true
    });
    if (!stu) return (errEl.innerText = "Incorrect Username or PIN.");

    currentFamily = fam;
    currentUser = stu;
    await loadStudentDashboard();
  } catch (err) {
    errEl.innerText = err.message;
  }
}

function saveSession(role) {
  localStorage.setItem("gph_session", JSON.stringify({
    role,
    authToken,
    currentFamily,
    currentUser
  }));
}

function logout() {
  localStorage.removeItem("gph_session");
  location.reload();
}

async function loadParentDashboard() {
  saveSession("parent");
  document.getElementById("authSection").classList.add("hidden");
  document.getElementById("parentDashboard").classList.remove("hidden");
  document.getElementById("logoutBtn").classList.remove("hidden");
    const acctBtn = document.getElementById("accountSettingsBtn");
  if (acctBtn) acctBtn.classList.remove("hidden");
  
  document.getElementById("dashAcademyName").innerText = currentFamily.family_name;
  document.getElementById("dashInviteCode").innerText = currentFamily.invite_code;

  ["q1s","q1e","q2s","q2e","q3s","q3e","q4s","q4e"].forEach(id => {
    const map = {q1s:"q1_start",q1e:"q1_end",q2s:"q2_start",q2e:"q2_end",q3s:"q3_start",q3e:"q3_end",q4s:"q4_start",q4e:"q4_end"};
    if (currentFamily[map[id]]) document.getElementById(id).value = currentFamily[map[id]];
  });

  await refreshFamilyData();
  populateCurriculumDropdown();
}

function showParentView(viewName, btn) {
  document.querySelectorAll(".p-view").forEach(el => el.classList.add("hidden"));
  document.getElementById("pView-" + viewName).classList.remove("hidden");
  document.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
  btn.classList.add("active");
  if (viewName === "transcript") renderOfficialRecords();
}

async function refreshFamilyData() {
  studentsCache = (await sbQuery("profiles", {
    query: `family_id=eq.${currentFamily.id}&role=eq.student&select=*`
  })) || [];

  assignmentsCache = (await sbQuery("assignments", {
    query: `family_id=eq.${currentFamily.id}&select=*&order=created_at.desc`
  })) || [];

  submissionsCache = (await sbQuery("submissions", { query: `select=*` })) || [];

  achievementsCache = (await sbQuery("achievements", {
    query: `family_id=eq.${currentFamily.id}&select=*&order=date_completed.desc`
  })) || [];

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

  try {
    await sbQuery("profiles", {
      method: "POST",
      body: { family_id: currentFamily.id, full_name, grade_level, expected_grad_year, username, pin, role: "student" }
    });
    document.getElementById("newStuName").value = "";
    document.getElementById("newStuUser").value = "";
    document.getElementById("newStuPin").value = "";
    await refreshFamilyData();
  } catch (err) {
    alert(err.message);
  }
}

function previewStudentPortal(stuId) {
  const stu = studentsCache.find(s => s.id === stuId);
  if (!stu) return;
  window.parentBackupUser = currentUser;
  currentUser = stu;
  document.getElementById("parentDashboard").classList.add("hidden");
  loadStudentDashboard(true);
}

function exitStudentPreview() {
  if (window.parentBackupUser) {
    currentUser = window.parentBackupUser;
    window.parentBackupUser = null;
    document.getElementById("studentDashboard").classList.add("hidden");
    const banner = document.getElementById("previewBanner");
    if (banner) banner.remove();
    loadParentDashboard();
  }
}

function renderStudents() {
  const list = document.getElementById("studentList");
  const selects = ["assignStudentSelect", "achStudentSelect", "transStudentSelect"];
  list.innerHTML = studentsCache.map(s => {
    const safeName = (s.full_name || "").replace(/'/g, "\\'");
    const safeGrade = (s.grade_level || "9th").replace(/'/g, "\\'");
    const safeUser = (s.username || "").replace(/'/g, "\\'");
    const safePin = (s.pin || "").replace(/'/g, "\\'");
    const gradVal = s.expected_grad_year || s.grad_year || "";
    return '<div class="item-card" style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;"><div><strong>' + s.full_name + '</strong> <span class="badge">' + s.grade_level + '</span><br><small class="muted">User: <code>' + s.username + '</code> &bull; PIN: <code>' + s.pin + '</code> &bull; Grad: ' + gradVal + '</small></div><div style="display:flex; gap:6px; flex-shrink:0;"><button type="button" class="btn-outline" style="width:auto; color:#1d4ed8; border-color:#bfdbfe; padding:4px 8px; font-size:12px;" onclick="previewStudentPortal(\'' + s.id + '\')">👀 Preview</button><button type="button" class="btn-outline" style="width:auto; color:#1e293b; padding:4px 8px; font-size:12px;" onclick="editStudent(\'' + s.id + '\',\'' + safeName + '\',\'' + safeGrade + '\',\'' + safeUser + '\',\'' + safePin + '\',\'' + gradVal + '\')">✏️ Edit</button><button type="button" class="btn-outline" style="width:auto; color:#b91c1c; border-color:#fecaca; padding:4px 8px; font-size:12px;" onclick="deleteStudent(\'' + s.id + '\',\'' + safeName + '\')">🗑️</button></div></div>';
  }).join("") || "<p class='muted'>No students enrolled yet.</p>";

  const options = studentsCache.map(s => '<option value="' + s.id + '">' + s.full_name + ' (' + s.grade_level + ')</option>').join("");
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = options;
  });
}

async function editStudent(id, oldName, oldGrade, oldUser, oldPin, oldGrad) {
  const full_name = prompt("Edit Student Full Legal Name:", oldName);
  if (full_name === null) return;
  const grade_level = prompt("Edit Grade Level (9th, 10th, 11th, or 12th):", oldGrade);
  if (grade_level === null) return;
  const username = prompt("Edit Student Login Username:", oldUser);
  if (username === null) return;
  const pin = prompt("Edit 4-Digit Student PIN:", oldPin);
  if (pin === null) return;
  const grad_year = prompt("Edit Expected Graduation Year:", oldGrad);
  if (grad_year === null) return;
  try {
    await sbQuery("profiles", {
      method: "PATCH",
      query: `id=eq.${id}`,
      body: {
        full_name: full_name.trim() || oldName,
        grade_level: grade_level.trim() || oldGrade,
        username: username.trim().toLowerCase() || oldUser,
        pin: pin.trim() || oldPin,
        expected_grad_year: parseInt(grad_year, 10) || parseInt(oldGrad, 10) || 2028
      }
    });
    await refreshFamilyData();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteStudent(id, name) {
  if (!confirm(`Remove ${name} from your academy?`)) return;
  try {
    await sbQuery("profiles", { method: "DELETE", query: `id=eq.${id}` });
    await refreshFamilyData();
  } catch (err) {
    alert(err.message);
  }
}

async function saveQuarters() {
  try {
    const updates = {
      q1_start: document.getElementById("q1s").value || null,
      q1_end: document.getElementById("q1e").value || null,
      q2_start: document.getElementById("q2s").value || null,
      q2_end: document.getElementById("q2e").value || null,
      q3_start: document.getElementById("q3s").value || null,
      q3_end: document.getElementById("q3e").value || null,
      q4_start: document.getElementById("q4s").value || null,
      q4_end: document.getElementById("q4e").value || null
    };
    const updated = await sbQuery("families", {
      method: "PATCH",
      query: `id=eq.${currentFamily.id}`,
      body: updates,
      single: true
    });
    if (updated) currentFamily = updated;
    alert("Custom quarter dates saved!");
  } catch (err) {
    alert(err.message);
  }
}

function populateCurriculumDropdown() {
  const box = document.getElementById("electiveChecklist");
  if (!box) return;

  const fallbackElectives = [
    { subject: "Personal Financial Literacy & Investing", credits: 0.5 },
    { subject: "Stock Market, Equities & Wealth Strategy", credits: 0.5 },
    { subject: "Honors Economics & Global Markets", credits: 0.5 },
    { subject: "Computer Science & Web Coding", credits: 1.0 },
    { subject: "Travel Photography & Visual Storytelling", credits: 0.5 },
    { subject: "Studio Art & Design", credits: 0.5 },
    { subject: "Automotive & Applied Mechanics", credits: 0.5 },
    { subject: "Entrepreneurship & Remote Startup Lab", credits: 0.5 },
    { subject: "Marine Biology & Ocean Conservation", credits: 0.5 },
    { subject: "World Culinary Arts & Food Science", credits: 0.5 },
    { subject: "Psychology & Human Behavior", credits: 0.5 },
    { subject: "Public Speaking, Rhetoric & Debate", credits: 0.5 },
    { subject: "Digital Graphic Design & Brand Identity", credits: 0.5 },
    { subject: "Health, Nutrition & Travel First Aid", credits: 0.5 },
    { subject: "Architecture & Global Urban Design", credits: 0.5 }
  ];

    const coreNames = [
    "Honors English Literature", "Honors English Literature I (9th)", "Honors World Literature (10th)", "Honors American Literature (11th)", "Honors British & Global Literature (12th)",
    "Honors Algebra I", "Honors Algebra I (9th)", "Honors Geometry (10th)", "Honors Algebra II (11th)", "Honors Pre-Calculus & Statistics (12th)",
    "Honors Biology", "Honors Biology (9th)", "Honors Chemistry (10th)", "Honors Physics (11th)", "Honors Environmental & Marine Science (12th)",
    "Honors World History", "Honors World History (9th)", "Honors Modern World & U.S. History (10th)", "Honors U.S. History (11th)", "Honors U.S. Government & Macroeconomics (12th)"
  ];

  const langNames = ["Honors Mandarin Chinese I", "Honors Hindi I", "Honors Spanish I", "Honors French I"];

  let list = fallbackElectives;
  if (typeof HONORS_CURRICULUM !== "undefined" && Array.isArray(HONORS_CURRICULUM)) {
    const seen = new Set();
    const fromCurr = [];
    HONORS_CURRICULUM.forEach(m => {
      if (!coreNames.includes(m.subject) && !langNames.includes(m.subject) && !seen.has(m.subject)) {
        seen.add(m.subject);
        fromCurr.push({ subject: m.subject, credits: m.credits || 0.5 });
      }
    });
    if (fromCurr.length) list = fromCurr;
  }

  box.innerHTML = list.map(e =>
    '<label style="display:flex; align-items:center; gap:8px; padding:6px 8px; background:#ffffff; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:4px; cursor:pointer;">' +
    '<input type="checkbox" class="course-pick-cb" value="' + e.subject + '" style="width:auto; margin:0;" />' +
    '<span style="flex:1; font-weight:600;">' + e.subject + '</span>' +
    '<small class="muted">' + e.credits + ' Cr</small>' +
    '</label>'
  ).join("");
}

async function enrollSelectedCourses() {
  const catalog = window.HONORS_CURRICULUM || (typeof HONORS_CURRICULUM !== "undefined" ? HONORS_CURRICULUM : []);
  if (!catalog.length) return alert("Course catalog is empty—please refresh the page once.");

  const student_id = document.getElementById("assignStudentSelect").value;
  const quarter = document.getElementById("assignQuarter").value;
  const langSubject = document.getElementById("assignLanguageSelect").value;
  const loc = document.getElementById("assignLocation").value.trim();
  const pickedElectives = Array.from(document.querySelectorAll(".course-pick-cb:checked")).map(cb => cb.value);

  if (!student_id) return alert("Please add or select a student first.");
  if (!pickedElectives.length) return alert("Please select at least 1 required elective before enrolling.");

  const stu = (studentsCache || []).find(s => s.id === student_id);
  const g = stu ? String(stu.grade_level) : "9th";

  let gradeTrack = [
    { base: "Honors English Literature", target: "Honors English Literature I (9th)" },
    { base: "Honors Algebra I", target: "Honors Algebra I (9th)" },
    { base: "Honors Biology", target: "Honors Biology (9th)" },
    { base: "Honors World History", target: "Honors World History (9th)" }
  ];

  if (g.startsWith("10")) {
    gradeTrack = [
      { base: "Honors English Literature", target: "Honors World Literature (10th)" },
      { base: "Honors Algebra I", target: "Honors Geometry (10th)" },
      { base: "Honors Biology", target: "Honors Chemistry (10th)" },
      { base: "Honors World History", target: "Honors Modern World & U.S. History (10th)" }
    ];
  } else if (g.startsWith("11")) {
    gradeTrack = [
      { base: "Honors English Literature", target: "Honors American Literature (11th)" },
      { base: "Honors Algebra I", target: "Honors Algebra II (11th)" },
      { base: "Honors Biology", target: "Honors Physics (11th)" },
      { base: "Honors World History", target: "Honors U.S. History (11th)" }
    ];
  } else if (g.startsWith("12")) {
    gradeTrack = [
      { base: "Honors English Literature", target: "Honors British & Global Literature (12th)" },
      { base: "Honors Algebra I", target: "Honors Pre-Calculus & Statistics (12th)" },
      { base: "Honors Biology", target: "Honors Environmental & Marine Science (12th)" },
      { base: "Honors World History", target: "Honors U.S. Government & Macroeconomics (12th)" }
    ];
  }

  const coursesToEnroll = [];
  gradeTrack.forEach(item => {
    const found = catalog.find(c => c.subject === item.target) || catalog.find(c => c.subject === item.base);
    if (found) coursesToEnroll.push({ ...found, subject: item.target });
  });

  const extraSubjects = [langSubject, ...pickedElectives];
  extraSubjects.forEach(sub => {
    const found = catalog.find(c => c.subject === sub);
    if (found) coursesToEnroll.push(found);
  });

  if (!coursesToEnroll.length) return alert("No matching courses found in catalog.");

  try {
    for (const course of coursesToEnroll) {
      const m = Array.isArray(course.modules) ? course.modules : course;
      const titleText = loc ? `[${quarter} • ${loc}] ${m.title}` : `[${quarter}] ${m.title}`;
      await sbQuery("assignments", {
        method: "POST",
        body: {
          family_id: currentFamily.id,
          student_id,
          quarter,
          subject: course.subject,
          course_level: course.course_level || "Honors",
          credits: course.credits || 1.0,
          title: titleText,
          description: m.description || "",
          resource_url: m.resource_url || ""
        }
      });
    }
    alert(`Enrolled ${stu ? stu.full_name : "student"} in ${coursesToEnroll.length} Honors courses (4 Core + ${langSubject} + ${pickedElectives.length} Elective${pickedElectives.length > 1 ? "s" : ""})!`);
    const drawer = document.getElementById("enrollmentDrawer");
    if (drawer) drawer.classList.add("hidden");
    setGradingStudentFilter(student_id);
    await refreshFamilyData();
  } catch (err) {
    alert(err.message);
  }
}


async function assignExtraPractice() {
  const student_id = document.getElementById("assignStudentSelect").value;
  const subject = document.getElementById("extraSubject").value.trim();
  const description = document.getElementById("extraDesc").value.trim();
  const quarter = document.getElementById("assignQuarter").value;
  if (!student_id || !subject || !description) return alert("Select a student and enter Subject and Instructions.");

  try {
    await sbQuery("assignments", {
      method: "POST",
      body: {
        family_id: currentFamily.id,
        student_id,
        subject,
        course_level: "Honors",
        quarter,
        credits: 0.0,
        title: "Extra Practice / Instructor Note",
        description
      }
    });
    document.getElementById("extraSubject").value = "";
    document.getElementById("extraDesc").value = "";
    await refreshFamilyData();
    alert("Extra practice added!");
  } catch (err) {
    alert(err.message);
  }
}

async function deleteAssignment(id) {
  if (!confirm("Remove this module from the student's course list?")) return;
  try {
    await sbQuery("submissions", { method: "DELETE", query: `assignment_id=eq.${id}` });
    await sbQuery("assignments", { method: "DELETE", query: `id=eq.${id}` });
    await refreshFamilyData();
  } catch (err) {
    alert(err.message);
  }
}

let activeGradingStudentId = "ALL";

function setGradingStudentFilter(stuId) {
  activeGradingStudentId = stuId;
  const sel = document.getElementById("assignStudentSelect");
  if (sel && stuId !== "ALL") sel.value = stuId;
  renderGradingQueue();
}

function renderGradingQueue() {
  const pillsEl = document.getElementById("gradingStudentPills");
  if (pillsEl) {
    if (activeGradingStudentId === "ALL" && studentsCache.length) {
      activeGradingStudentId = studentsCache[0].id;
    }
    pillsEl.innerHTML = studentsCache.map(s => {
      const isAct = s.id === activeGradingStudentId;
      return '<button type="button" class="' + (isAct ? 'btn-primary' : 'btn-outline') + '" style="width:auto; padding:4px 12px; font-size:13px;' + (isAct ? '' : ' color:#1e293b;') + '" onclick="setGradingStudentFilter(\'' + s.id + '\')">' + s.full_name + ' (' + s.grade_level + ')</button>';
    }).join("") + (studentsCache.length > 1 ? '<button type="button" class="' + (activeGradingStudentId === 'ALL' ? 'btn-primary' : 'btn-outline') + '" style="width:auto; padding:4px 10px; font-size:12px;' + (activeGradingStudentId === 'ALL' ? '' : ' color:#1e293b;') + '" onclick="setGradingStudentFilter(\'ALL\')">All</button>' : '');
  }

  const container = document.getElementById("parentAssignmentList");
  const filtered = activeGradingStudentId === "ALL"
    ? assignmentsCache
    : assignmentsCache.filter(a => a.student_id === activeGradingStudentId);

  if (!filtered.length) {
    container.innerHTML = "<p class='muted'>No courses enrolled for this student yet. Click <b>+ Enroll / Add Courses</b> above to enroll them.</p>";
    return;
  }
  const catalog = window.HONORS_CURRICULUM || (typeof HONORS_CURRICULUM !== "undefined" ? HONORS_CURRICULUM : []);
  container.innerHTML = filtered.map(a => {
    const stu = studentsCache.find(s => s.id === a.student_id);
    const sub = submissionsCache.find(s => s.assignment_id === a.id);
    const gradeVal = sub && sub.grade ? sub.grade : "";
    const fbVal = sub && sub.parent_feedback ? sub.parent_feedback : "";
    const dueText = a.due_date ? " &bull; Due: <b>" + a.due_date + "</b>" : "";
    const cleanTitle = a.title.replace(/^\[[^\]]+\]\s*/, "");
    const catMatch = catalog.find(c => c.subject === a.subject);
    const modMatch = catMatch && Array.isArray(catMatch.modules) ? catMatch.modules[0] : catMatch;
    const resolvedKey = a.answer_key || (modMatch && modMatch.answer_key) || (catMatch && catMatch.answer_key) || "Review student thesis/calculations for accuracy, textual evidence, and complete explanation of steps.";
    const keyBox = '<details style="background:#fef9c3; border:1px solid #fde047; padding:8px 10px; border-radius:6px; margin-top:6px;"><summary style="cursor:pointer; font-weight:700; color:#854d0e; font-size:13px;">🔑 Parent Answer Key &amp; Grading Rubric</summary><div style="margin-top:6px; font-size:13px; color:#713f12;">' + resolvedKey + '</div></details>';
    const subWork = sub && (sub.student_notes || sub.submission_link)
      ? '<div style="background:#f1f5f9; padding:8px; border-radius:6px; margin-top:6px;"><small><b>Student Work:</b> ' + (sub.student_notes || "") + (sub.submission_link ? ' <a href="' + sub.submission_link + '" target="_blank">Open Link ↗</a>' : '') + '</small></div>'
      : '<small class="muted">Awaiting student submission</small>';

    return '<div class="item-card"><div style="display:flex; justify-content:space-between; align-items:flex-start;"><div><span class="badge">' + a.quarter + '</span> <strong>' + a.subject + ': ' + cleanTitle + '</strong><br><small class="muted">Student: <b>' + (stu ? stu.full_name : "Student") + '</b> &bull; ' + a.course_level + ' (' + a.credits + ' cr)' + dueText + '</small></div></div>' + keyBox + subWork + '<div class="row-2" style="margin-top:8px;"><input type="text" id="grade-' + a.id + '" value="' + gradeVal + '" placeholder="Grade (e.g., A or 95%)" /><input type="text" id="fb-' + a.id + '" value="' + fbVal + '" placeholder="Parent feedback..." /></div><button class="btn-primary" style="margin-top:6px; width:auto;" onclick="saveGrade(\'' + a.id + '\',\'' + a.student_id + '\')">Save Grade</button></div>';
  }).join("");
}


async function saveGrade(assignment_id, student_id) {
  const grade = document.getElementById("grade-" + assignment_id).value.trim().toUpperCase();
  const parent_feedback = document.getElementById("fb-" + assignment_id).value.trim();
  if (!grade) return alert("Enter a grade first.");
  try {
    const existing = submissionsCache.find(s => s.assignment_id === assignment_id);
    if (existing) {
      await sbQuery("submissions", {
        method: "PATCH",
        query: `id=eq.${existing.id}`,
        body: { grade, parent_feedback, status: "Graded" }
      });
    } else {
      await sbQuery("submissions", {
        method: "POST",
        body: { assignment_id, student_id, grade, parent_feedback, status: "Graded" }
      });
    }
    await refreshFamilyData();
    alert("Grade & feedback saved!");
  } catch (err) {
    alert(err.message);
  }
}

async function addAchievement() {
  async function deleteAchievement(id) {
  if (!confirm("Remove this certification/milestone from the student's record?")) return;
  try {
    await sbQuery("achievements", { method: "DELETE", query: `id=eq.${id}` });
    await loadParentDashboard();
  } catch (err) {
    alert(err.message);
  }
}

async function editAchievement(id, oldTitle, oldLoc, oldMetric) {
  const title = prompt("Edit Title / Credential:", oldTitle);
  if (title === null) return;
  const location = prompt("Edit Location / Organization:", oldLoc || "");
  if (location === null) return;
  const metric = prompt("Edit Hours / Cert # / Metric:", oldMetric || "");
  if (metric === null) return;
  try {
    await sbQuery("achievements", {
      method: "PATCH",
      query: `id=eq.${id}`,
      body: { title: title.trim() || oldTitle, location: location.trim(), metric: metric.trim() }
    });
    await loadParentDashboard();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteCourseAssignment(id) {
  if (!confirm("Remove this course from the student's transcript and active schedule?")) return;
  try {
    await sbQuery("assignments", { method: "DELETE", query: `id=eq.${id}` });
    await loadParentDashboard();
  } catch (err) {
    alert(err.message);
  }
}

async function editCourseAssignment(id, oldSubject, oldLevel, oldCredits) {
  const subject = prompt("Edit Course Name:", oldSubject);
  if (subject === null) return;
  const course_level = prompt("Edit Level (Honors, Regular, or AP):", oldLevel || "Honors");
  if (course_level === null) return;
  const creditsStr = prompt("Edit Credit Value (e.g., 1.0 or 0.5):", String(oldCredits || 1.0));
  if (creditsStr === null) return;
  try {
    await sbQuery("assignments", {
      method: "PATCH",
      query: `id=eq.${id}`,
      body: {
        subject: subject.trim() || oldSubject,
        course_level: course_level.trim() || oldLevel,
        credits: parseFloat(creditsStr) || oldCredits
      }
    });
    await loadParentDashboard();
  } catch (err) {
    alert(err.message);
  }
}

  const student_id = document.getElementById("achStudentSelect").value;
  const type = document.getElementById("achType").value;
  const title = document.getElementById("achTitle").value.trim();
  const location = document.getElementById("achLocation").value.trim();
  const metric = document.getElementById("achMetric").value.trim();

  if (!student_id || !title) return alert("Select a student and enter a title.");

  try {
    await sbQuery("achievements", {
      method: "POST",
      body: {
        family_id: currentFamily.id,
        student_id,
        type,
        title,
        location,
        metric,
        date_completed: new Date().toISOString().split("T")[0]
      }
    });
    document.getElementById("achTitle").value = "";
    document.getElementById("achLocation").value = "";
    document.getElementById("achMetric").value = "";
    await refreshFamilyData();
  } catch (err) {
    alert(err.message);
  }
}

function renderAchievements() {
  const container = document.getElementById("parentAchievementList");
  container.innerHTML = achievementsCache.map(ac => {
    const stu = studentsCache.find(s => s.id === ac.student_id);
    const loc = ac.location ? " &bull; 📍 " + ac.location : "";
    const met = ac.metric ? " &bull; " + ac.metric : "";
    const safeTitle = (ac.title || "").replace(/'/g, "\\'");
    const safeLoc = (ac.location || "").replace(/'/g, "\\'");
    const safeMet = (ac.metric || "").replace(/'/g, "\\'");
    return '<div class="item-card" style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;"><div><strong>[' + ac.type + '] ' + ac.title + '</strong><br><small class="muted">' + (stu ? stu.full_name : "Student") + loc + met + '</small></div><div style="display:flex; gap:6px; flex-shrink:0;"><button type="button" class="btn-outline" style="width:auto; color:#1e293b; padding:4px 8px; font-size:12px;" onclick="editAchievement(\'' + ac.id + '\',\'' + safeTitle + '\',\'' + safeLoc + '\',\'' + safeMet + '\')">✏️ Edit</button><button type="button" class="btn-outline" style="width:auto; color:#b91c1c; border-color:#fecaca; padding:4px 8px; font-size:12px;" onclick="deleteAchievement(\'' + ac.id + '\')">🗑️ Remove</button></div></div>';
  }).join("") || "<p class='muted'>No travel study, certifications, or service logged yet.</p>";
}

async function deleteAchievement(id) {
  if (!confirm("Remove this certification/milestone from the student's record?")) return;
  try {
    await sbQuery("achievements", { method: "DELETE", query: `id=eq.${id}` });
    await refreshFamilyData();
    renderOfficialRecords();
  } catch (err) {
    alert(err.message);
  }
}

async function editAchievement(id, oldTitle, oldLoc, oldMetric) {
  const title = prompt("Edit Title / Credential:", oldTitle);
  if (title === null) return;
  const location = prompt("Edit Location / Organization:", oldLoc || "");
  if (location === null) return;
  const metric = prompt("Edit Hours / Cert # / Metric:", oldMetric || "");
  if (metric === null) return;
  try {
    await sbQuery("achievements", {
      method: "PATCH",
      query: `id=eq.${id}`,
      body: { title: title.trim() || oldTitle, location: location.trim(), metric: metric.trim() }
    });
    await refreshFamilyData();
    renderOfficialRecords();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteTranscriptCourse(studentId, subject, level) {
  if (!confirm(`Remove "${subject} (${level})" from this student's transcript and active schedule?`)) return;
  try {
    const matches = assignmentsCache.filter(a => a.student_id === studentId && a.subject === subject && a.course_level === level);
    for (const m of matches) {
      await sbQuery("assignments", { method: "DELETE", query: `id=eq.${m.id}` });
    }
    await refreshFamilyData();
    renderOfficialRecords();
  } catch (err) {
    alert(err.message);
  }
}

async function editTranscriptCourse(studentId, oldSubject, oldLevel, oldCredits) {
  const subject = prompt("Edit Course Name:", oldSubject);
  if (subject === null) return;
  const course_level = prompt("Edit Course Level (Honors, Regular, or AP):", oldLevel || "Honors");
  if (course_level === null) return;
  const creditsStr = prompt("Edit Credit Value (e.g., 1.0 or 0.5):", String(oldCredits || 1.0));
  if (creditsStr === null) return;
  try {
    const matches = assignmentsCache.filter(a => a.student_id === studentId && a.subject === oldSubject && a.course_level === oldLevel);
    for (const m of matches) {
      await sbQuery("assignments", {
        method: "PATCH",
        query: `id=eq.${m.id}`,
        body: {
          subject: subject.trim() || oldSubject,
          course_level: course_level.trim() || oldLevel,
          credits: parseFloat(creditsStr) || oldCredits
        }
      });
    }
    await refreshFamilyData();
    renderOfficialRecords();
  } catch (err) {
    alert(err.message);
  }
}


function parseGradePercent(g) {
  if (!g) return null;
  const clean = g.trim().toUpperCase().replace("%", "");
  if (!isNaN(parseFloat(clean))) return parseFloat(clean);
  const letterMap = { "A+": 98, "A": 95, "A-": 91.5, "B+": 88, "B": 85, "B-": 81.5, "C+": 78, "C": 75, "C-": 71.5, "D+": 68, "D": 65, "F": 55 };
  return letterMap[clean] !== undefined ? letterMap[clean] : null;
}

function percentToLetterAndPoints(pct) {
  if (pct >= 93) return { letter: "A", pts: 4.0 };
  if (pct >= 90) return { letter: "A-", pts: 3.7 };
  if (pct >= 87) return { letter: "B+", pts: 3.3 };
  if (pct >= 83) return { letter: "B", pts: 3.0 };
  if (pct >= 80) return { letter: "B-", pts: 2.7 };
  if (pct >= 77) return { letter: "C+", pts: 2.3 };
  if (pct >= 73) return { letter: "C", pts: 2.0 };
  if (pct >= 70) return { letter: "C-", pts: 1.7 };
  if (pct >= 60) return { letter: "D", pts: 1.0 };
  return { letter: "F", pts: 0.0 };
}

function renderOfficialRecords() {
  const stuId = document.getElementById("transStudentSelect").value;
  const stu = studentsCache.find(s => s.id === stuId);
  const preview = document.getElementById("officialDocsPreview");
  if (!stu) {
    preview.innerHTML = "<p class='muted'>Add a student first to generate their Transcript & Diploma.</p>";
    return;
  }

  const stuAssigns = assignmentsCache.filter(a => a.student_id === stu.id);
  const stuAchs = achievementsCache.filter(a => a.student_id === stu.id);
  const todayStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const courseMap = {};
  stuAssigns.forEach(a => {
    const key = a.quarter + "||" + a.subject + "||" + a.course_level;
    if (!courseMap[key]) {
      courseMap[key] = {
        quarter: a.quarter,
        subject: a.subject,
        course_level: a.course_level,
        credits: parseFloat(a.credits) || 1.0,
        scores: []
      };
    }
    const sub = submissionsCache.find(s => s.assignment_id === a.id);
    const pct = sub && sub.grade ? parseGradePercent(sub.grade) : null;
    if (pct !== null) courseMap[key].scores.push(pct);
  });

  let totalCredits = 0;
  let weightedPoints = 0;
  let unweightedPoints = 0;

    const courseRank = (sub) => {
    const s = (sub || "").toLowerCase();
    if (s.includes("english") || s.includes("literature") || s.includes("algebra") || s.includes("geometry") || s.includes("calculus") || s.includes("biology") || s.includes("chemistry") || s.includes("physics") || s.includes("history") || s.includes("government") || s.includes("economics")) return 1;
    if (s.includes("mandarin") || s.includes("chinese") || s.includes("hindi") || s.includes("spanish") || s.includes("french") || s.includes("japanese") || s.includes("german")) return 2;
    return 3;
  };
  const sortedCourses = Object.values(courseMap).sort((a, b) => courseRank(a.subject) - courseRank(b.subject));
  const rows = sortedCourses.map(c => {

    let gradeDisplay = "In Progress";
    let crEarned = "—";
    if (c.scores.length > 0) {
      const avgPct = c.scores.reduce((sum, v) => sum + v, 0) / c.scores.length;
      const { letter, pts } = percentToLetterAndPoints(avgPct);
      const boost = c.course_level.includes("AP") ? 1.0 : c.course_level.includes("Honors") ? 0.5 : 0;
      totalCredits += c.credits;
      unweightedPoints += pts * c.credits;
      weightedPoints += (pts + boost) * c.credits;
      gradeDisplay = letter + " (" + avgPct.toFixed(0) + "%)";
      crEarned = c.credits.toFixed(2);
       }
    const safeSub = (c.subject || "").replace(/'/g, "\\'");
    const safeLvl = (c.course_level || "Honors").replace(/'/g, "\\'");
    const actionBtns = '<span class="no-print" style="margin-left:8px; display:inline-flex; gap:4px;"><button type="button" class="btn-outline" style="width:auto; color:#1e293b; padding:2px 6px; font-size:11px;" onclick="editTranscriptCourse(\'' + stu.id + '\',\'' + safeSub + '\',\'' + safeLvl + '\',' + c.credits + ')">✏️</button><button type="button" class="btn-outline" style="width:auto; color:#b91c1c; border-color:#fecaca; padding:2px 6px; font-size:11px;" onclick="deleteTranscriptCourse(\'' + stu.id + '\',\'' + safeSub + '\',\'' + safeLvl + '\')">🗑️</button></span>';
    return '<tr><td style="padding:8px 10px; border-bottom:1px solid #cbd5e1;">' + c.quarter + '</td><td style="padding:8px 10px; border-bottom:1px solid #cbd5e1;">' + c.subject + actionBtns + '</td><td style="padding:8px 10px; border-bottom:1px solid #cbd5e1;">' + c.course_level + '</td><td style="padding:8px 10px; border-bottom:1px solid #cbd5e1;">' + gradeDisplay + '</td><td style="padding:8px 10px; border-bottom:1px solid #cbd5e1;">' + crEarned + '</td></tr>';
  }).join("");


  const weightedGpa = totalCredits > 0 ? (weightedPoints / totalCredits).toFixed(2) : "N/A";
  const unweightedGpa = totalCredits > 0 ? (unweightedPoints / totalCredits).toFixed(2) : "N/A";

  const achSection = stuAchs.length
    ? '<div style="margin-top:18px; border-top:1px solid #94a3b8; padding-top:12px;"><div style="font-size:12px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#1e293b; margin-bottom:6px;">Honors Enrichment, Field Studies &amp; Certifications</div><ul style="margin:0; padding-left:20px; font-size:13px; line-height:1.6;">' + stuAchs.map(x => '<li><strong>' + x.type + ':</strong> ' + x.title + (x.location ? ' — <em>' + x.location + '</em>' : '') + (x.metric ? ' (' + x.metric + ')' : '') + '</li>').join("") + '</ul></div>'
    : "";

  const transcriptHtml =
    '<div style="font-family: Georgia, \'Times New Roman\', serif; color:#0f172a; background:#ffffff; border:2px solid #0f172a; padding:32px; border-radius:4px; margin-bottom:32px; box-shadow:0 2px 8px rgba(0,0,0,0.06);">' +
      '<div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px double #0f172a; padding-bottom:14px; margin-bottom:18px;">' +
        '<div>' +
          '<div style="font-size:22px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase;">' + currentFamily.family_name + '</div>' +
          '<div style="font-size:12px; letter-spacing:1px; text-transform:uppercase; color:#334155; margin-top:2px;">Office of the Registrar &bull; Official High School Academic Transcript</div>' +
        '</div>' +
        '<div style="border:1.5px solid #0f172a; padding:6px 12px; text-align:center; font-size:11px; letter-spacing:0.8px; text-transform:uppercase;">' +
          '<strong>Official Record</strong><br>Issued: ' + todayStr +
        '</div>' +
      '</div>' +

      '<table style="width:100%; border-collapse:collapse; font-size:13px; margin-bottom:18px; background:#f8fafc; border:1px solid #cbd5e1;">' +
        '<tr>' +
          '<td style="padding:8px 12px; border-right:1px solid #cbd5e1;"><strong>Student Legal Name:</strong> ' + stu.full_name + '</td>' +
          '<td style="padding:8px 12px; border-right:1px solid #cbd5e1;"><strong>Grade Level:</strong> ' + stu.grade_level + '</td>' +
          '<td style="padding:8px 12px;"><strong>Expected Graduation:</strong> Class of ' + stu.expected_grad_year + '</td>' +
        '</tr>' +
        '<tr style="border-top:1px solid #cbd5e1;">' +
          '<td style="padding:8px 12px; border-right:1px solid #cbd5e1;"><strong>Weighted Cumulative GPA:</strong> ' + weightedGpa + '</td>' +
          '<td style="padding:8px 12px; border-right:1px solid #cbd5e1;"><strong>Unweighted GPA:</strong> ' + unweightedGpa + '</td>' +
          '<td style="padding:8px 12px;"><strong>Total Credits Earned:</strong> ' + totalCredits.toFixed(2) + '</td>' +
        '</tr>' +
      '</table>' +

      '<table style="width:100%; border-collapse:collapse; font-size:13px; border:1px solid #94a3b8;">' +
        '<thead>' +
          '<tr style="background:#1e293b; color:#ffffff; text-transform:uppercase; font-size:11px; letter-spacing:0.8px;">' +
            '<th style="padding:9px 10px; text-align:left;">Term</th>' +
            '<th style="padding:9px 10px; text-align:left;">Course Title</th>' +
            '<th style="padding:9px 10px; text-align:left;">Course Level</th>' +
            '<th style="padding:9px 10px; text-align:center;">Attempted</th>' +
            '<th style="padding:9px 10px; text-align:center;">Earned</th>' +
            '<th style="padding:9px 10px; text-align:center;">Final Grade</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' +
          (rows || '<tr><td colspan="6" style="padding:14px; text-align:center; color:#64748b;">No coursework recorded yet.</td></tr>') +
        '</tbody>' +
      '</table>' +

      achSection +

      '<div style="margin-top:16px; padding:8px 12px; background:#f8fafc; border:1px solid #cbd5e1; font-size:11px; color:#334155;">' +
        '<strong>Grading &amp; Weighting Scale:</strong> A (90–100) = 4.0 &bull; B (80–89) = 3.0 &bull; C (70–79) = 2.0 &bull; D (60–69) = 1.0 &bull; F (&lt;60) = 0.0. Honors courses receive +0.50 quality-point weight; AP courses receive +1.00 quality-point weight. 1.00 Carnegie Unit = 120–150 instructional hours.' +
      '</div>' +

      '<div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:32px; font-size:13px;">' +
        '<div>_________________________________________<br><span style="font-size:11px; text-transform:uppercase; letter-spacing:0.8px; color:#334155;">Signature of Registrar / Principal Administrator</span></div>' +
        '<div>______________________<br><span style="font-size:11px; text-transform:uppercase; letter-spacing:0.8px; color:#334155;">Date Certified</span></div>' +
      '</div>' +
    '</div>';

      const diplomaHtml =
    '<div style="font-family: Georgia, \'Times New Roman\', serif; color:#0f172a; background:#fffdf9; border:6px double #1e293b; padding:40px 32px; text-align:center; border-radius:4px; box-shadow:0 2px 10px rgba(0,0,0,0.06);">' +
      '<div style="border:1px solid #94a3b8; padding:28px 24px;">' +
        '<div style="font-size:12px; letter-spacing:2.5px; text-transform:uppercase; color:#475569; margin-bottom:6px;">In Recognition of Academic Achievement</div>' +
        '<div style="font-size:26px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#0f172a;">' + currentFamily.family_name + '</div>' +
        '<div style="width:120px; height:2px; background:#b45309; margin:14px auto;"></div>' +
        '<p style="font-size:15px; font-style:italic; color:#334155; margin:12px 0;">This certifies that</p>' +
        '<div style="font-size:28px; font-weight:700; letter-spacing:1px; color:#0f172a; margin:8px 0 14px 0;">' + stu.full_name + '</div>' +
        '<p style="font-size:14px; line-height:1.7; max-width:540px; margin:0 auto; color:#1e293b;">has satisfactorily completed the prescribed Course of Study required for Secondary Graduation and is hereby awarded this</p>' +
        '<div style="font-size:22px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:#1e293b; margin:18px 0 6px 0;">High School Diploma</div>' +
                '<div style="font-size:14px; letter-spacing:1px; color:#334155;">Class of ' + stu.expected_grad_year + '</div>' +
        '<div style="display:flex; justify-content:space-around; align-items:flex-end; margin-top:44px; gap:24px;">' +
          '<div style="font-size:12px;">______________________________<br><span style="font-size:11px; text-transform:uppercase; letter-spacing:0.8px; color:#475569;">Head of School / Administrator</span></div>' +
          '<div style="font-size:12px;">______________________________<br><span style="font-size:11px; text-transform:uppercase; letter-spacing:0.8px; color:#475569;">Academic Registrar</span></div>' +
        '</div>' +
      '</div>' +
    '</div>';

  preview.innerHTML = transcriptHtml + diplomaHtml;
}

function getYouTubeEmbed(url) {
  const base = ["https://www.", "youtube-nocookie.com", "/embed/"].join("");
  if (url.startsWith("yt:")) return base + url.slice(3).trim();
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([A-Za-z0-9_-]{11})/);
  return m ? base + m.at(1) : null;
}

function toggleMissionStep(assignId, stepIdx) {
  const key = "gph_steps_" + assignId;
  const saved = JSON.parse(localStorage.getItem(key) || "{}");
  saved[stepIdx] = !saved[stepIdx];
  localStorage.setItem(key, JSON.stringify(saved));
  const boxes = document.querySelectorAll(".step-cb-" + assignId);
  const checked = Array.from(boxes).filter(b => b.checked).length;
  const pct = Math.round((checked / boxes.length) * 100);
  const bar = document.getElementById("prog-bar-" + assignId);
  const lbl = document.getElementById("prog-lbl-" + assignId);
  if (bar) bar.style.width = pct + "%";
  if (lbl) lbl.innerText = pct === 100 ? "100% Complete! Ready to Submit 🏆" : pct + "% Mission Progress";
}

function checkQuizAnswer(assignId, qIdx, chosenIdx, correctIdx) {
  const resEl = document.getElementById("quiz-res-" + assignId + "-" + qIdx);
  if (!resEl) return;
  if (chosenIdx === correctIdx) {
    resEl.innerHTML = "<span style='color:#15803d; font-weight:600;'>✅ Spot on! +10 Honors XP</span>";
  } else {
    resEl.innerHTML = "<span style='color:#b91c1c; font-weight:600;'>❌ Not quite — rewatch/reread and try again!</span>";
  }
}

let stuActiveAssignsCache = [];
let stuSubsCache = [];
let selectedStuSubjectIdx = 0;

function switchStudentTab(tabName, btn) {
  document.querySelectorAll("#studentDashboard .tab-btn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  document.querySelectorAll(".s-view").forEach(v => v.classList.add("hidden"));
  const target = document.getElementById("sView-" + tabName);
  if (target) target.classList.remove("hidden");
}

function getSubjectMediaPack(subject) {
  const s = (subject || "").toLowerCase();
  if (s.includes("english") || s.includes("literature")) {
    return { yt: "https://youtube.com", link: "https://openstax.org", label: "OpenStax Humanities & Literature Reader" };
  }
  if (s.includes("algebra") || s.includes("geometry") || s.includes("calculus") || s.includes("math")) {
    return { yt: "https://youtube.com", link: "https://desmos.com", label: "Interactive Desmos Graphing Lab" };
  }
  if (s.includes("biology") || s.includes("chemistry") || s.includes("physics") || s.includes("science") || s.includes("marine")) {
    return { yt: "https://youtube.com", link: "https://colorado.edu", label: "PhET Interactive Science Simulations" };
  }
  if (s.includes("history") || s.includes("government") || s.includes("economics")) {
    return { yt: "https://youtube.com", link: "https://openstax.org", label: "OpenStax World & U.S. History Textbook" };
  }
  if (s.includes("mandarin") || s.includes("chinese")) {
    return { yt: "https://youtube.com", link: "https://yellowbridge.com", label: "Interactive Mandarin Pinyin & Stroke Lab" };
  }
  if (s.includes("hindi")) {
    return { yt: "https://youtube.com", link: "https://learning-hindi.com", label: "Interactive Hindi Devanagari & Audio Guide" };
  }
  if (s.includes("spanish")) {
    return { yt: "https://youtube.com", link: "https://spanishdict.com", label: "Interactive Spanish Grammar & Audio Lab" };
  }
  if (s.includes("french")) {
    return { yt: "https://youtube.com", link: "https://lawlessfrench.com", label: "Interactive French Pronunciation & Grammar Lab" };
  }
  if (s.includes("stock") || s.includes("financial") || s.includes("entrepreneurship")) {
    return { yt: "https://youtube.com", link: "https://investopedia.com", label: "Investopedia Virtual Stock Market Simulator" };
  }
  if (s.includes("computer") || s.includes("coding")) {
    return { yt: "https://youtube.com", link: "https://khanacademy.org", label: "Interactive Coding Sandbox & Tutorials" };
  }
  return { yt: "https://youtube.com", link: "https://khanacademy.org", label: "Interactive Reference & Study Guide" };
}
function selectStudentSubject(idx) {
  selectedStuSubjectIdx = idx;
  renderStudentTodayPane();
}

function renderStudentTodayPane() {
  const tabsEl = document.getElementById("stuSubjectTabs");
  const paneEl = document.getElementById("stuActiveLessonPane");
  const progEl = document.getElementById("stuTodayProgress");
  if (!tabsEl || !paneEl) return;

  if (!stuActiveAssignsCache.length) {
    tabsEl.innerHTML = "";
    if (progEl) progEl.innerText = "0 / 0 Completed";
    paneEl.innerHTML = "<div class='card'><p class='muted'>All enrolled lessons for this term are complete—or ask your parent to enroll your courses! 🎉</p></div>";
    return;
  }

  if (selectedStuSubjectIdx >= stuActiveAssignsCache.length) selectedStuSubjectIdx = 0;

  let doneToday = 0;
  tabsEl.innerHTML = stuActiveAssignsCache.map((a, idx) => {
    const sub = stuSubsCache.find(x => x.assignment_id === a.id);
    const isDone = sub && (sub.status === "Submitted" || sub.status === "Graded");
    if (isDone) doneToday++;
    const isAct = idx === selectedStuSubjectIdx;
    return '<button type="button" class="' + (isAct ? 'btn-primary' : 'btn-outline') + '" style="width:auto; padding:6px 12px; font-size:13px;' + (isAct ? '' : ' color:#1e293b;') + '" onclick="selectStudentSubject(' + idx + ')">' + (isDone ? '✅ ' : '📘 ') + a.subject + '</button>';
  }).join("");

  if (progEl) progEl.innerText = doneToday + " / " + stuActiveAssignsCache.length + " Submitted";

  const a = stuActiveAssignsCache[selectedStuSubjectIdx];
  const sub = stuSubsCache.find(x => x.assignment_id === a.id);
  const statusText = sub && sub.grade ? "Graded: " + sub.grade : sub ? "Submitted ✓" : "Today's Active Lesson";
  const dueBadge = a.due_date ? " &bull; Due: <b>" + a.due_date + "</b>" : "";
  const cleanTitle = a.title.replace(/^\[[^\]]+\]\s*/, "");
  const catalog = window.HONORS_CURRICULUM || (typeof HONORS_CURRICULUM !== "undefined" ? HONORS_CURRICULUM : []);
  const currMod = catalog.find(m => m.subject === a.subject || a.subject.startsWith(m.subject));
  const pack = getSubjectMediaPack(a.subject);

  let embedUrl = pack.yt;
  let extLinksHtml = "";
  const rawLinks = a.resource_url ? a.resource_url.split(/[\r\n,]+/).map(u => u.trim()).filter(Boolean) : [];
  rawLinks.forEach(u => {
    const cleanU = u.startsWith("pdf:") ? u.slice(4).trim() : u;
    const yt = typeof getYouTubeEmbed === "function" ? getYouTubeEmbed(cleanU) : null;
    if (yt) {
      embedUrl = yt;
    } else if (cleanU.startsWith("http://") || cleanU.startsWith("https://")) {
      extLinksHtml += '<a href="' + cleanU + '" target="_blank" rel="noopener" class="btn-outline" style="width:auto; color:#1e293b; display:inline-block; margin:4px 6px 4px 0;">🔗 Open Course Reference ↗</a>';
    }
  });
  if (!extLinksHtml) {
    extLinksHtml = '<a href="' + pack.link + '" target="_blank" rel="noopener" class="btn-outline" style="width:auto; color:#1e293b; display:inline-block; margin:4px 0;">🔗 ' + pack.label + ' ↗</a>';
  }

  const videoBlock = '<div style="margin:12px 0;"><div style="font-weight:700; font-size:13px; color:#0f172a; margin-bottom:6px;">🎬 Watch Lesson Video Right Here (No Leaving Page):</div><div style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:8px; border:1px solid #cbd5e1; background:#000;"><iframe src="' + embedUrl + '" style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div></div>';

  const steps = ["Watch Inline Video Lesson", "Read Lesson Notes & Interactive Resource", "Complete Self-Check Quiz & Submit Work"];
  const savedSteps = JSON.parse(localStorage.getItem("gph_steps_" + a.id) || "{}");
  const doneCount = steps.filter((_, i) => savedSteps[i]).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  const checklistHtml = '<div style="background:#f8fafc; border:1px solid #e2e8f0; padding:10px; border-radius:8px; margin:10px 0;"><div style="display:flex; justify-content:space-between; font-size:12px; font-weight:700; margin-bottom:6px;"><span>📋 Today\'s Lesson Checklist</span><span id="pct-' + a.id + '">' + pct + '% Complete</span></div>' + steps.map((st, idx) => '<label style="display:flex; align-items:center; gap:8px; font-weight:normal; margin:4px 0; cursor:pointer;"><input type="checkbox" style="width:auto; margin:0;" ' + (savedSteps[idx] ? 'checked' : '') + ' onchange="toggleLessonStep(\'' + a.id + '\',' + idx + ',' + steps.length + ',this.checked)" /> <span>' + st + '</span></label>').join("") + '</div>';

  const quizHtml = currMod && currMod.quiz && currMod.quiz.length
    ? '<div style="background:#fffbeb; border:1px solid #fde68a; padding:10px; border-radius:8px; margin:10px 0;"><strong style="color:#92400e;">⚡ Quick Self-Check Quiz:</strong>' + currMod.quiz.map((qz, qi) => '<div style="margin-top:8px;"><div style="font-size:13px; font-weight:600;">' + (qi + 1) + '. ' + qz.q + '</div>' + qz.options.map((opt, oi) => '<label style="display:block; font-weight:normal; font-size:13px; margin:3px 0 3px 12px; cursor:pointer;"><input type="radio" name="qz-' + a.id + '-' + qi + '" style="width:auto; margin-right:6px;" onclick="checkInlineQuiz(\'' + a.id + '\',' + qi + ',' + oi + ',' + qz.answer + ')" />' + opt + '</label>').join("") + '<div id="qz-fb-' + a.id + '-' + qi + '" style="font-size:12px; font-weight:700; margin-left:12px;"></div></div>').join("") + '</div>'
    : "";

  const fbHtml = sub && sub.parent_feedback ? '<div style="background:#ecfdf5; padding:8px; border-radius:6px; margin-top:8px;"><small><b>Parent Feedback:</b> ' + sub.parent_feedback + '</small></div>' : '';

  paneEl.innerHTML = '<div class="card"><div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px;"><div><span class="badge">' + a.quarter + '</span> <strong>' + a.subject + ': ' + cleanTitle + '</strong><br><small class="muted">' + a.course_level + ' (' + a.credits + ' cr)' + dueBadge + '</small></div><span class="badge" style="background:#dbeafe; color:#1e40af;">' + statusText + '</span></div><p style="margin:10px 0; font-size:14px; line-height:1.5;">' + (a.description || "") + '</p>' + videoBlock + '<div style="margin:8px 0;">' + extLinksHtml + '</div>' + checklistHtml + quizHtml + fbHtml + '<div style="margin-top:12px;"><label><b>✍️ Submit Today\'s Reflection, Calculations, or Essay Response:</b></label><textarea id="subnote-' + a.id + '" rows="3" placeholder="Write your answers, summary, or reflection here...">' + (sub && sub.student_notes ? sub.student_notes : '') + '</textarea><label style="margin-top:8px;">📸 Snap or Upload Photo of Handwritten Work / Lab / Project (Optional)</label><input type="file" id="subphoto-' + a.id + '" accept="image/*" style="padding:6px; background:#f8fafc;" />' + (sub && sub.submission_link ? '<div style="margin-top:6px;"><a href="' + sub.submission_link + '" target="_blank" style="font-size:12px;">📎 View Uploaded Work Photo ↗</a></div>' : '') + '<button class="btn-primary" style="margin-top:10px; width:auto;" onclick="submitWork(\'' + a.id + '\')">Submit Today\'s Work</button></div></div>';
}
async function loadStudentDashboard(isPreview = false) {
  if (!isPreview) saveSession("student");
  document.getElementById("authSection").classList.add("hidden");
  document.getElementById("studentDashboard").classList.remove("hidden");
  document.getElementById("logoutBtn").classList.remove("hidden");

  let banner = document.getElementById("previewBanner");
  if (isPreview) {
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "previewBanner";
      banner.style.cssText = "background:#fef08a; border:1px solid #eab308; padding:10px 14px; border-radius:8px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center;";
      banner.innerHTML = '<span><b>👀 Parent Preview Mode</b> – Viewing as ' + currentUser.full_name + '</span><button class="btn-primary" style="width:auto;" onclick="exitStudentPreview()">← Back to Parent Portal</button>';
      document.getElementById("studentDashboard").prepend(banner);
    }
  } else if (banner) {
    banner.remove();
  }

  document.getElementById("stuDashWelcome").innerText = "Welcome, " + currentUser.full_name;
  document.getElementById("stuDashMeta").innerText = currentFamily.family_name + " • " + currentUser.grade_level + " Grade • Class of " + (currentUser.grad_year || "");

  const allAssigns = (await sbQuery("assignments", {
    query: `student_id=eq.${currentUser.id}&select=*&order=created_at.asc`
  })) || [];
  const subs = (await sbQuery("submissions", {
    query: `student_id=eq.${currentUser.id}&select=*`
  })) || [];
  const achs = (await sbQuery("achievements", {
    query: `student_id=eq.${currentUser.id}&select=*`
  })) || [];

  stuSubsCache = subs;

  const bySubject = {};
  allAssigns.forEach(a => {
    if (!bySubject[a.subject]) bySubject[a.subject] = [];
    bySubject[a.subject].push(a);
  });

  const activeAssigns = [];
  Object.keys(bySubject).forEach(subj => {
    const seq = bySubject[subj];
    const nextItem = seq.find(item => {
      const s = subs.find(x => x.assignment_id === item.id);
      return !(s && s.grade);
    }) || seq[seq.length - 1];
    if (nextItem) activeAssigns.push(nextItem);
  });

  stuActiveAssignsCache = activeAssigns;
  renderStudentTodayPane();

  const syllabusEl = document.getElementById("stuSyllabusList");
  if (syllabusEl) {
    syllabusEl.innerHTML = Object.keys(bySubject).map(subj => {
      const items = bySubject[subj];
      const first = items[0];
      return '<div class="item-card"><div style="display:flex; justify-content:space-between; align-items:center;"><strong>📘 ' + subj + '</strong><span class="badge">' + first.quarter + ' &bull; ' + first.course_level + ' (' + first.credits + ' cr)</span></div><p class="muted" style="margin:6px 0;">' + (first.description || "Honors Quarter Syllabus & Mastery Roadmap") + '</p><div style="font-size:13px; background:#f8fafc; padding:8px; border-radius:6px;"><b>Planned Term Sequence:</b><ul style="margin:4px 0 0 18px;">' + items.map((m, i) => '<li>Week ' + (i * 3 + 1) + '–' + (i * 3 + 3) + ': ' + m.title.replace(/^\[[^\]]+\]\s*/, "") + '</li>').join("") + '</ul></div></div>';
    }).join("") || "<p class='muted'>No quarter syllabus items enrolled yet.</p>";
  }

  const gradesEl = document.getElementById("stuGradesList");
  const gpaBadge = document.getElementById("stuGpaBadge");
  if (gradesEl) {
    let ptsSum = 0;
    let crSum = 0;
    gradesEl.innerHTML = allAssigns.map(a => {
      const sub = subs.find(s => s.assignment_id === a.id);
      const gr = sub && sub.grade ? sub.grade : "In Progress";
      if (sub && sub.grade && typeof gradeToPoints === "function") {
        const cr = parseFloat(a.credits) || 1.0;
        ptsSum += gradeToPoints(sub.grade, a.course_level) * cr;
        crSum += cr;
      }
      const fb = sub && sub.parent_feedback ? '<div style="margin-top:4px; font-size:13px; color:#15803d;"><b>Teacher Note:</b> ' + sub.parent_feedback + '</div>' : '';
      return '<div class="item-card"><div style="display:flex; justify-content:space-between; align-items:center;"><div><strong>' + a.subject + '</strong> <small class="muted">(' + a.quarter + ' &bull; ' + a.credits + ' cr)</small><br><small class="muted">' + a.title.replace(/^\[[^\]]+\]\s*/, "") + '</small></div><span class="badge" style="font-size:13px;">' + gr + '</span></div>' + fb + '</div>';
    }).join("") || "<p class='muted'>No graded coursework yet.</p>";
    if (gpaBadge) gpaBadge.innerText = "Cumulative GPA: " + (crSum > 0 ? (ptsSum / crSum).toFixed(2) : "—");
  }

  document.getElementById("studentPortfolioList").innerHTML = achs.map(ac => {
    const met = ac.metric ? " &bull; " + ac.metric : "";
    const loc = ac.location ? " &bull; 📍 " + ac.location : "";
    return '<div class="item-card"><strong>[' + ac.type + '] ' + ac.title + '</strong><br><small class="muted">' + loc + met + '</small></div>';
  }).join("") || "<p class='muted'>No travel study or certifications logged yet.</p>";
}

async function compressPhotoToDataUrl(file) {

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxW = 900;
        const scale = img.width > maxW ? maxW / img.width : 1;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function submitWork(assignment_id) {
  const notes = document.getElementById("subnote-" + assignment_id).value.trim();
  const photoInput = document.getElementById("subphoto-" + assignment_id);
  let link = "";
  if (photoInput && photoInput.files && photoInput.files[0]) {
    link = await compressPhotoToDataUrl(photoInput.files[0]);
  }
  try {
    const existing = await sbQuery("submissions", {
      query: `assignment_id=eq.${assignment_id}&student_id=eq.${currentUser.id}&select=*`,
      single: true
    });
    const finalLink = link || (existing && existing.submission_link ? existing.submission_link : "");
    if (existing) {
      await sbQuery("submissions", {
        method: "PATCH",
        query: `id=eq.${existing.id}`,
        body: { student_notes: notes, submission_link: finalLink, status: "Submitted" }
      });
    } else {
      await sbQuery("submissions", {
        method: "POST",
        body: { assignment_id, student_id: currentUser.id, student_notes: notes, submission_link: finalLink, status: "Submitted" }
      });
    }
    await loadStudentDashboard(document.getElementById("previewBanner") && !document.getElementById("previewBanner").classList.contains("hidden"));
  } catch (err) {
    alert(err.message);
  }
}


window.addEventListener("DOMContentLoaded", async () => {
  const saved = localStorage.getItem("gph_session");
  if (!saved) return;
  try {
    const session = JSON.parse(saved);
    authToken = session.authToken || null;
    currentFamily = session.currentFamily;
    currentUser = session.currentUser;
    if (session.role === "parent" && currentFamily && currentUser) {
      await loadParentDashboard();
    } else if (session.role === "student" && currentFamily && currentUser) {
      await loadStudentDashboard();
    }
  } catch (e) {
    localStorage.removeItem("gph_session");
  }
});

const BRAIN_BREAKS = [
  { type: "😂 Clean Nerd Joke", prompt: "Why was the obtuse angle always so frustrated?", reveal: "Because it was never right!" },
  { type: "😂 Clean Nerd Joke", prompt: "Why did the biologist break up with the physicist?", reveal: "They had no chemistry." },
  { type: "🧩 60-Second Riddle", prompt: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?", reveal: "An echo!" },
  { type: "🧩 60-Second Riddle", prompt: "What has cities, but no houses; mountains, but no trees; and water, but no fish?", reveal: "A map (every worldschooler's best friend)!" },
  { type: "🤔 Traveler's Would You Rather", prompt: "Would you rather have a free lifetime pass to every museum in the world OR a free lifetime rail pass across every continent?", reveal: "No wrong answer—pitch your choice to your parent at lunch!" },
  { type: "🤔 Traveler's Would You Rather", prompt: "Would you rather time-travel for 24 hours to Ancient Babylon (1750 BCE) OR 100 years into the future?", reveal: "Bonus thought: Which one would be safer without modern Wi-Fi?" },
  { type: "⚡ Optional 2-Minute Movement Reset", prompt: "Optional Physical Reset (skip or adapt freely for any mobility or health need): Stand up, reach both arms overhead for 10 seconds, roll your shoulders back 5 times, and take 3 slow deep breaths away from your screen.", reveal: "Brain oxygen refilled—you're ready to crush your next step!" }
];

function revealBrainBreak() {
  const el = document.getElementById("bbReveal");
  if (el) el.classList.remove("hidden");
}

function triggerBrainBreak() {
  const box = document.getElementById("brainBreakBox");
  const item = BRAIN_BREAKS[Math.floor(Math.random() * BRAIN_BREAKS.length)];
  box.classList.remove("hidden");
  box.innerHTML =
    '<div style="display:flex; justify-content:space-between; align-items:center;"><strong>' + item.type + '</strong><button type="button" style="background:none; border:none; font-size:16px; cursor:pointer;" onclick="this.closest(\'#brainBreakBox\').classList.add(\'hidden\')">✕</button></div>' +
    '<p style="margin:8px 0;">' + item.prompt + '</p>' +
    '<button type="button" class="btn-outline" style="width:auto; color:#1e293b; font-size:12px;" onclick="revealBrainBreak()">👀 Show Punchline / Answer</button>' +
    '<p id="bbReveal" class="hidden" style="margin-top:8px; font-weight:700; color:#15803d;">' + item.reveal + '</p>';
}


function toggleMathToolkit() {
  const box = document.getElementById("mathToolkitBox");
  box.classList.toggle("hidden");
  if (!box.classList.contains("hidden")) drawBackpackLine();
}

function runBackpackCalc() {
  const raw = document.getElementById("calcDisplay").value.trim();
  const out = document.getElementById("calcResult");
  if (!raw) return;
  try {
    const safeExpr = raw.replace(/\^/g, "**");
    if (!/^[0-9+\-*/().\s*]+$/.test(safeExpr)) throw new Error("Use numbers and + - * / ^ ( ) only.");
    const val = Function('"use strict"; return (' + safeExpr + ')')();
    out.innerText = "Result: " + val;
  } catch (e) {
    out.innerText = "Check expression: " + e.message;
  }
}

function drawBackpackLine() {
  const canvas = document.getElementById("slopeCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const m = parseFloat(document.getElementById("graphM").value) || 0;
  const b = parseFloat(document.getElementById("graphB").value) || 0;
  const w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2, scale = 15;

  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += scale) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y <= h; y += scale) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();

  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  const xMin = -cx / scale, xMax = cx / scale;
  ctx.moveTo(0, cy - (m * xMin + b) * scale);
  ctx.lineTo(w, cy - (m * xMax + b) * scale);
  ctx.stroke();
}

