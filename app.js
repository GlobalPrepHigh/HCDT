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
  if (errEl) errEl.innerText = "";

  const rawLogin = (document.getElementById("parentEmail").value || "").trim().toLowerCase();
  const password = document.getElementById("parentPassword").value || "";

  if (!rawLogin || !password) {
    if (errEl) errEl.innerText = "Please enter your email or User ID and password.";
    return;
  }

  try {
    if (btn) {
      btn.disabled = true;
      btn.innerText = "Connecting...";
    }

    const aliasMap = JSON.parse(localStorage.getItem("gph_user_aliases") || "{}");
    let email = rawLogin;
    if (!rawLogin.includes("@")) {
      const cleanId = rawLogin.replace(/[^a-z0-9._-]/g, "");
      if (aliasMap[cleanId]) {
        email = aliasMap[cleanId];
      } else {
        const matchedProf = await sbQuery("profiles", { query: `role=eq.parent&select=*` }).catch(() => []);
        const found = Array.isArray(matchedProf)
          ? matchedProf.find(p => (p.short_username || "").toLowerCase() === cleanId)
          : null;
        email = found && found.login_email ? found.login_email : (cleanId + "@globalprephigh.org");
      }
    }

    if (isSignupMode) {
      const betaCode = (document.getElementById("betaAccessCode").value || "").trim().toUpperCase();
      if (betaCode !== "GPH2026") throw new Error("Private Beta Access Only: Enter a valid Founder Beta Code to register.");
      const legalAck = document.getElementById("legalAckCb");
      if (legalAck && !legalAck.checked) throw new Error("Please check the Home-Education Administrator acknowledgment box to continue.");
      const fullName = (document.getElementById("parentName").value || "").trim();
      const academyName = (document.getElementById("academyName").value || "").trim();
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
        body: { user_id: userObj.id, family_id: famData.id, full_name: fullName, role: "parent" },
        single: true
      });

      currentFamily = famData;
      currentUser = profData;
      currentUser.email = email;
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
      currentUser.email = email;
      localStorage.setItem("gph_last_parent_email", email);

      currentFamily = famData;
      await loadParentDashboard();
    }
  } catch (err) {
    if (errEl) errEl.innerText = err.message || "Sign in failed.";
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = isSignupMode ? "Create Academy & Sign In" : "Sign In";
    }
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
      throw new Error(data.msg || data.error_description || "Could not send password reset email.");    }
    alert("Password reset email sent! Check your inbox.");
  } catch (err) {
    alert(err.message);
  }
}

async function updateParentCredentials(mode) {
  if (mode === "login") {
    const inputEl = document.getElementById("newParentLogin");
    let raw = (inputEl ? inputEl.value : "").trim().toLowerCase();
    if (!raw || (currentUser && raw === (currentUser.email || "").toLowerCase())) {
      const typed = prompt("Enter your desired Short User ID (e.g., doe or smithfamily):");
      if (!typed) return;
      raw = typed.trim().toLowerCase();
    }
    const cleanId = raw.replace(/[^a-z0-9._-]/g, "");
    if (cleanId.length < 3) return alert("Short User ID must be at least 3 letters or numbers (e.g., doe).");
    const activeEmail = (currentUser && currentUser.email) || localStorage.getItem("gph_last_parent_email") || "";
    if (!activeEmail) return alert("Please sign in with your email once first so we can link your Short User ID.");
    const aliasMap = JSON.parse(localStorage.getItem("gph_user_aliases") || "{}");
    aliasMap[cleanId] = activeEmail;
    localStorage.setItem("gph_user_aliases", JSON.stringify(aliasMap));
    if (inputEl) inputEl.value = "";
    return alert(`Short User ID "${cleanId}" saved! Next time you sign in on this device, just type "${cleanId}" and your password.`);
  }

  const pw = document.getElementById("newParentPassword").value;
  if (!pw || pw.length < 6) return alert("Password must be at least 6 characters.");
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: "PUT",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ password: pw })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.msg || data.error_description || "Could not update password.");
    document.getElementById("newParentPassword").value = "";
    alert("Password updated successfully!");
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
  const payload = JSON.stringify({ role, authToken, currentFamily, currentUser });
  const rememberEl = document.getElementById(role === "parent" ? "rememberParentCb" : "rememberStudentCb");
  if (rememberEl && !rememberEl.checked) {
    localStorage.removeItem("gph_session");
    localStorage.removeItem("gph_saved_creds");
    sessionStorage.setItem("gph_session", payload);
  } else {
    sessionStorage.removeItem("gph_session");
    localStorage.setItem("gph_session", payload);
    const creds = JSON.parse(localStorage.getItem("gph_saved_creds") || "{}");
    if (role === "parent") {
      const pe = document.getElementById("parentEmail");
      if (pe && pe.value.trim()) creds.parentEmail = pe.value.trim();
    } else {
      const sc = document.getElementById("stuInviteCode");
      const su = document.getElementById("stuUsername");
      if (sc && sc.value.trim()) creds.stuInviteCode = sc.value.trim().toUpperCase();
      if (su && su.value.trim()) creds.stuUsername = su.value.trim();
    }
    localStorage.setItem("gph_saved_creds", JSON.stringify(creds));
  }
}

function logout() {
  localStorage.removeItem("gph_session");
  sessionStorage.removeItem("gph_session");
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
    return '<div class="item-card"><div><strong>' + s.full_name + '</strong> <span class="badge">' + s.grade_level + '</span><br><small class="muted">User: <code>' + s.username + '</code> &bull; PIN: <code>' + s.pin + '</code> &bull; Grad: ' + gradVal + '</small></div><div style="display:flex; gap:8px; margin-top:8px;"><button type="button" class="btn-outline" style="width:auto; color:#1d4ed8; border-color:#bfdbfe; padding:5px 10px; font-size:12px;" onclick="previewStudentPortal(\'' + s.id + '\')">👀 Preview</button><button type="button" class="btn-outline" style="width:auto; color:#1e293b; padding:5px 10px; font-size:12px;" onclick="editStudent(\'' + s.id + '\',\'' + safeName + '\',\'' + safeGrade + '\',\'' + safeUser + '\',\'' + safePin + '\',\'' + gradVal + '\')">✏️ Edit</button><button type="button" class="btn-outline" style="width:auto; color:#b91c1c; border-color:#fecaca; padding:5px 10px; font-size:12px;" onclick="deleteStudent(\'' + s.id + '\',\'' + safeName + '\')">🗑️</button></div></div>';
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

    const alreadyEnrolled = new Set(
    (assignmentsCache || [])
      .filter(a => a.student_id === student_id && a.quarter === quarter)
      .map(a => (a.subject || "").toLowerCase())
  );

  const rawCourses = [];
  gradeTrack.forEach(item => {
    const found = catalog.find(c => c.subject === item.target) || catalog.find(c => c.subject === item.base);
    if (found) rawCourses.push({ ...found, subject: item.target });
  });

  const extraSubjects = [langSubject, ...pickedElectives];
  extraSubjects.forEach(sub => {
    const found = catalog.find(c => c.subject === sub);
    if (found) rawCourses.push(found);
  });

  const coursesToEnroll = rawCourses.filter(c => !alreadyEnrolled.has((c.subject || "").toLowerCase()));

  if (!coursesToEnroll.length) {
    return alert(`${stu ? stu.full_name : "This student"} is already enrolled in all of those courses for ${quarter}!`);
  }

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
    alert(`Added ${coursesToEnroll.length} new course${coursesToEnroll.length > 1 ? "s" : ""} for ${stu ? stu.full_name : "student"} (skipped ${rawCourses.length - coursesToEnroll.length} already-enrolled courses).`);
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

let activeGradingStudentId = null;

function setGradingStudentFilter(stuId) {
  activeGradingStudentId = stuId;
  const sel = document.getElementById("assignStudentSelect");
  if (sel && stuId && stuId !== "ALL") sel.value = stuId;
  renderGradingQueue();
}

function getParentTextSnippet(subject) {
  const s = (subject || "").toLowerCase();
  if (s.includes("geometry")) {
    return "<b>📘 Parent Geometry Concept Refresher &amp; Worked Example:</b><br>• <b>Slope &amp; Parallel/Perpendicular Lines:</b> Slope <code>m = (y2 - y1) / (x2 - x1)</code>. Parallel lines share the <b>exact same slope</b>; perpendicular lines have <b>negative reciprocal slopes</b> (e.g., <code>2/3</code> &amp; <code>-3/2</code>).<br>• <b>Worked Example:</b> Find the slope through <code>(2, 5)</code> and <code>(6, 13)</code> &rarr; Step 1: <code>m = (13 - 5) / (6 - 2)</code> &rarr; Step 2: <code>m = 8 / 4 = 2</code>. A perpendicular line has slope <b><code>-1/2</code></b>.<br>• <i>Check student's uploaded paper photo to verify every formula and intermediate step is written out!</i>";
  }
  if (s.includes("algebra") || s.includes("calculus") || s.includes("math")) {
    return "<b>📘 Parent Algebra Concept Refresher &amp; Worked Example:</b><br>• <b>Multi-Step Linear Equations:</b> Distribute first, combine like terms on each side, then isolate the variable using inverse operations.<br>• <b>Worked Example:</b> Solve <code>3(x - 4) + 2 = 17</code> &rarr; Step 1 (Distribute): <code>3x - 12 + 2 = 17</code> &rarr; Step 2 (Combine): <code>3x - 10 = 17</code> &rarr; Step 3 (Add 10): <code>3x = 27</code> &rarr; Step 4 (Divide by 3): <b><code>x = 9</code></b>.<br>• <i>Check student's uploaded paper photo to verify every intermediate line is shown!</i>";
  }
  if (s.includes("english") || s.includes("literature")) {
    return "<b>📘 Parent Literature &amp; Composition Refresher:</b><br>• <b>Thesis &amp; Textual Evidence Standard:</b> A strong Honors response opens with a specific debatable claim, embeds a direct quote or concrete scene detail, and explains <i>how</i> the author's word choice or structure supports the theme (not just plot summary).";
  }
  if (s.includes("chemistry") || s.includes("biology") || s.includes("physics") || s.includes("science")) {
    return "<b>📘 Parent Science Concept Refresher &amp; Lab Key:</b><br>• <b>Lab Analysis Standard:</b> Confirm the student identifies the independent variable (what changed), dependent variable (what was measured), and explains how trapped <code>CO2</code> gas or molecular energy caused the observed change.";
  }
  if (s.includes("history") || s.includes("government") || s.includes("economics")) {
    return "<b>📘 Parent Concept Refresher — Code of Hammurabi &amp; Louvre Context:</b><br>• <b>Pronunciation:</b> <i>Hammurabi</i> (<b>hah-moo-RAH-bee</b>) &bull; <i>Louvre</i> (<b>LOOV-ruh</b>).<br>• <b>Key Historical Takeaway:</b> Carved onto a 7.4-foot basalt steel in Babylon (c. 1754 BCE) and housed today in the Louvre Museum in Paris, Hammurabi's 282 laws established written public legal standards and social-class-based restitution (<i>lex talionis</i>).";
  }
  if (s.includes("mandarin") || s.includes("chinese")) {
    return "<b>📘 Parent Concept Refresher — Mandarin Tones &amp; Greetings:</b><br>• <b>4 Mandarin Tones:</b> 1st tone (high flat: <code>mā</code> = mother), 2nd tone (rising: <code>má</code> = hemp), 3rd tone (dipping: <code>mǎ</code> = horse), 4th tone (sharp falling: <code>mà</code> = scold).<br>• <b>Key Phrases:</b> <i>Nǐ hǎo</i> (<b>nee HOW</b> = Hello) &bull; <i>Xièxie</i> (<b>SHYEH-shyeh</b> = Thank you) &bull; <i>Zàijiàn</i> (<b>DZAI-jyen</b> = Goodbye).";
  }
  if (s.includes("spanish") || s.includes("french") || s.includes("hindi")) {
    return "<b>📘 Parent Concept Refresher — World Language Mastery:</b><br>• Listen for clear vowel pronunciation, accurate gender/number agreement on nouns and adjectives, and complete conversational responses rather than single-word answers.";
  }
  if (s.includes("stock") || s.includes("financial") || s.includes("entrepreneurship")) {
    return "<b>📘 Parent Concept Refresher — Equities, P/E Ratio &amp; Compound Growth:</b><br>• <b>Key Terms:</b> <b>Stock/Equity</b> = fractional ownership in a company; <b>Dividend</b> = cash profit shared per share; <b>P/E Ratio</b> = Share Price &divide; Earnings Per Share; <b>Diversification</b> = spreading capital across sectors to reduce risk.";
  }
  if (s.includes("automotive") || s.includes("engineering")) {
    return "<b>📘 Parent Concept Refresher — 4-Stroke Engine &amp; Vehicle Systems:</b><br>• <b>4-Stroke Cycle:</b> 1. <b>Intake</b> (air-fuel enters) &rarr; 2. <b>Compression</b> (piston compresses mixture) &rarr; 3. <b>Power</b> (spark plug ignites mixture) &rarr; 4. <b>Exhaust</b> (spent gases exit).";
  }
  return "<b>📘 Parent Concept Refresher &amp; Grading Standard:</b><br>• Look for a clear topic sentence/claim, at least 2 specific facts or examples from today's video lesson, and complete, well-reasoned sentences.";
}

function renderGradingQueue() {
  const pillsEl = document.getElementById("gradingStudentPills");
  if (pillsEl) {
    if (activeGradingStudentId === null && studentsCache.length) {
      activeGradingStudentId = studentsCache[0].id;
    }
        pillsEl.style.alignItems = "center";
    pillsEl.innerHTML = studentsCache.map(s => {
      const isAct = s.id === activeGradingStudentId;
      const btnStyle = isAct
        ? "width:auto; padding:10px 18px; font-size:17px; font-weight:800; background:#1e3a8a; color:#ffffff; border:2px solid #0f172a; box-shadow:0 3px 8px rgba(30,58,138,0.25);"
        : "width:auto; padding:8px 14px; font-size:14px; font-weight:600; background:#f8fafc; color:#1e293b; border:1px solid #cbd5e1;";
      return '<button type="button" style="border-radius:8px; cursor:pointer; ' + btnStyle + '" onclick="setGradingStudentFilter(\'' + s.id + '\')">' + s.full_name + ' (' + s.grade_level + ')</button>';
    }).join("") + (studentsCache.length > 1 ? '<button type="button" style="border-radius:8px; cursor:pointer; ' + (activeGradingStudentId === 'ALL' ? 'width:auto; padding:10px 16px; font-size:16px; font-weight:800; background:#1e3a8a; color:#ffffff; border:2px solid #0f172a;' : 'width:auto; padding:8px 13px; font-size:14px; font-weight:600; background:#f8fafc; color:#1e293b; border:1px solid #cbd5e1;') + '" onclick="setGradingStudentFilter(\'ALL\')">All</button>' : '');
  }

  const container = document.getElementById("parentAssignmentList");
  const filtered = activeGradingStudentId === "ALL" || !activeGradingStudentId
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
    const safeLabel = (a.subject + ": " + cleanTitle).replace(/'/g, "\\'");
    const baseSubj = a.subject.replace(/\s*\(\d+th\)$/, "");
    const catMatch = catalog.find(c => c.subject === a.subject || c.subject === baseSubj || a.subject.startsWith(c.subject) || c.subject.startsWith(baseSubj));
    const modMatch = catMatch && Array.isArray(catMatch.modules) ? catMatch.modules[0] : catMatch;
    const isMath = /algebra|geometry|calculus|math/i.test(a.subject || "");
    const defaultSteps = isMath
      ? "<b>Step-by-Step Verification:</b><br>1. Confirm student copied the original problem onto paper.<br>2. Check each algebraic/geometric step line-by-line (watch for sign flips across =).<br>3. Verify units and final boxed answer."
      : "<b>Step-by-Step Verification:</b><br>1. Check clear thesis or hypothesis statement.<br>2. Verify supporting facts/data from today's video lesson.<br>3. Confirm complete sentences and reasoned conclusion.";
    const resolvedKey = a.answer_key || (modMatch && modMatch.answer_key) || (catMatch && catMatch.answer_key) || defaultSteps;
    const snippetHtml = getParentTextSnippet(a.subject);
    const keyBox = '<details style="background:#fef9c3; border:1px solid #fde047; padding:8px 10px; border-radius:6px; margin-top:6px;"><summary style="cursor:pointer; font-weight:700; color:#854d0e; font-size:13px;">🔑 Parent Answer Key, Worked Steps &amp; Lesson Text Snippet</summary><div style="margin-top:6px; font-size:13px; color:#713f12; line-height:1.55;">' + resolvedKey + '<div style="margin-top:8px; padding-top:8px; border-top:1px dashed #eab308; color:#422006;">' + snippetHtml + '</div></div></details>';
    const subWork = sub && (sub.student_notes || sub.submission_link)
      ? '<div style="background:#f1f5f9; padding:8px; border-radius:6px; margin-top:6px;"><small><b>Student Work:</b> ' + (sub.student_notes || "") + (sub.submission_link ? ' <a href="' + sub.submission_link + '" target="_blank">Open Photo/Link ↗</a>' : '') + '</small></div>'
      : '<small class="muted">Awaiting student submission (students can upload a photo of handwritten paper work)</small>';

    return '<div class="item-card"><div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;"><div><span class="badge">' + a.quarter + '</span> <strong>' + a.subject + ': ' + cleanTitle + '</strong><br><small class="muted">Student: <b>' + (stu ? stu.full_name : "Student") + '</b> &bull; ' + a.course_level + ' (' + a.credits + ' cr)' + dueText + '</small></div><button type="button" class="btn-outline" style="width:auto; color:#b91c1c; border-color:#fecaca; padding:3px 8px; font-size:12px; flex-shrink:0;" onclick="deleteAssignment(\'' + a.id + '\',\'' + safeLabel + '\')">🗑️ Remove</button></div>' + keyBox + subWork + '<div class="row-2" style="margin-top:8px;"><input type="text" id="grade-' + a.id + '" value="' + gradeVal + '" placeholder="Grade (e.g., A or 95%)" /><input type="text" id="fb-' + a.id + '" value="' + fbVal + '" placeholder="Parent feedback..." /></div><button class="btn-primary" style="margin-top:6px; width:auto;" onclick="saveGrade(\'' + a.id + '\',\'' + a.student_id + '\')">Save Grade</button></div>';
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
  if (pct >= 67) return { letter: "D+", pts: 1.3 };
  if (pct >= 63) return { letter: "D", pts: 1.0 };
  return { letter: "F", pts: 0.0 };
}

function buildGoldGlobeSealSvg() {
  return '<svg width="110" height="110" viewBox="0 0 140 140" xmlns="http://w3.org" style="display:inline-block; vertical-align:middle;">' +
    '<defs>' +
      '<radialGradient id="oceanGrad" cx="38%" cy="35%" r="65%"><stop offset="0%" stop-color="#38bdf8"/><stop offset="55%" stop-color="#1d4ed8"/><stop offset="100%" stop-color="#0f172a"/></radialGradient>' +
      '<linearGradient id="ribbonGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#0f172a"/><stop offset="50%" stop-color="#1e3a8a"/><stop offset="100%" stop-color="#0f172a"/></linearGradient>' +
    '</defs>' +
    '<circle cx="70" cy="70" r="44" fill="url(#oceanGrad)" stroke="#d97706" stroke-width="2.5"/>' +
    '<path d="M46 46 Q56 40 62 50 T54 68 Q45 64 46 46 Z" fill="#86efac" opacity="0.85"/>' +
    '<path d="M74 42 Q88 38 94 52 T86 76 Q76 74 74 60 Z" fill="#86efac" opacity="0.85"/>' +
    '<path d="M58 76 Q70 74 74 88 T60 98 Q52 90 58 76 Z" fill="#86efac" opacity="0.85"/>' +
    '<ellipse cx="70" cy="70" rx="64" ry="20" transform="rotate(-18 70 70)" fill="none" stroke="#facc15" stroke-width="3.5"/>' +
    '<rect x="6" y="57" width="128" height="24" rx="5" transform="rotate(-18 70 70)" fill="url(#ribbonGrad)" stroke="#facc15" stroke-width="2"/>' +
    '<text x="70" y="73" transform="rotate(-18 70 70)" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="10.5" font-weight="bold" letter-spacing="1.2">GLOBALPREP HIGH</text>' +
    '<text x="70" y="128" text-anchor="middle" fill="#0f172a" font-family="Georgia, serif" font-size="9" font-weight="700" letter-spacing="1.4">HONORS ACADEMY</text>' +
  '</svg>';
}

function getCourseStandardTag(subj) {
  const s = (subj || "").toLowerCase();
  if (s.includes("english") || s.includes("literature")) return "CCSS.ELA-LITERACY";
  if (s.includes("algebra") || s.includes("geometry") || s.includes("calculus") || s.includes("math")) return "CCSS.MATH";
  if (s.includes("biology") || s.includes("chemistry") || s.includes("physics") || s.includes("marine")) return "NGSS HS-SCI";
  if (s.includes("history") || s.includes("government") || s.includes("economics")) return "C3.SOC-STUDIES";
  if (s.includes("mandarin") || s.includes("spanish") || s.includes("french") || s.includes("hindi")) return "ACTFL WORLD-LANG";
  return "U.S. COLLEGE-PREP";
}

function buildDiplomaCardHtml(stu, fam) {
  const globeSeal = buildGoldGlobeSealSvg();
  const gradYr = (stu && (stu.expected_grad_year || stu.grad_year)) || "2028";
  const famName = (fam && fam.family_name) || "GlobalPrep High";
  const stuName = (stu && stu.full_name) || "Student";
  return '<div id="printableDiplomaBox" style="font-family: Georgia, \'Times New Roman\', serif; color:#0f172a; background:#fffdf9; border:6px double #1e293b; padding:24px; margin-top:16px; text-align:center; box-sizing:border-box; max-width:100%; overflow:hidden;">' +
    '<div style="border:1px solid #94a3b8; padding:22px 16px;">' +
      '<div style="margin-bottom:10px;">' + globeSeal + '</div>' +
      '<div style="font-size:11px; letter-spacing:2px; text-transform:uppercase; color:#475569; margin-bottom:6px;">In Recognition of Academic Excellence</div>' +
      '<div style="font-size:22px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:#0f172a;">' + famName + '</div>' +
      '<div style="width:120px; height:2px; background:#b45309; margin:12px auto;"></div>' +
      '<p style="font-size:15px; font-style:italic; color:#334155; margin:10px 0;">This certifies that</p>' +
      '<div style="font-size:26px; font-weight:700; letter-spacing:1px; color:#0f172a; margin:8px 0 12px 0;">' + stuName + '</div>' +
      '<p style="font-size:14px; line-height:1.65; max-width:540px; margin:0 auto; color:#1e293b;">has satisfactorily completed the prescribed Course of Study for Secondary Graduation in accordance with U.S. College-Preparatory Standards and is hereby awarded this</p>' +
      '<div style="font-size:20px; font-weight:700; letter-spacing:2.5px; text-transform:uppercase; color:#1e293b; margin:16px 0 6px 0;">High School Diploma</div>' +
      '<div style="font-size:14px; letter-spacing:1px; color:#334155;">Class of ' + gradYr + '</div>' +
      '<div style="display:flex; justify-content:space-around; align-items:flex-end; margin-top:34px; gap:20px; flex-wrap:wrap;">' +
        '<div style="font-size:12px;">_________________________<br><span style="font-size:10.5px; text-transform:uppercase; letter-spacing:0.8px; color:#334155;">Home-Education Administrator</span></div>' +
        '<div style="font-size:12px;">_________________________<br><span style="font-size:10.5px; text-transform:uppercase; letter-spacing:0.8px; color:#334155;">Date Conferred</span></div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function printDiplomaOnly() {
  const box = document.getElementById("printableDiplomaBox");
  if (!box) return window.print();
  const w = window.open("", "_blank");
  if (!w) return window.print();
  w.document.write('<!DOCTYPE html><html><head><title>High School Diploma</title><style>@page{size:landscape;margin:0.4in;}body{margin:0;padding:16px;background:#fff;}</style></head><body>' + box.outerHTML + '</body></html>');
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); w.close(); }, 300);
}

function renderOfficialRecords() {
  const stuId = document.getElementById("transStudentSelect").value;
  const stu = studentsCache.find(s => s.id === stuId);
  const preview = document.getElementById("officialDocsPreview");
  if (!stu) {
    preview.innerHTML = "<p class='muted'>Add a student first to generate their Transcript & Diploma.</p>";
    return;
  }
    const stuAchs = achievementsCache.filter(a => a.student_id === stu.id);
  const stuAssigns = assignmentsCache.filter(a => !a.student_id || String(a.student_id) === String(stu.id));
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
    if (s.includes("mandarin") || s.includes("chinese") || s.includes("hindi") || s.includes("spanish") || s.includes("french") || s.includes("japanese")) return 2;
    return 3;
  };
  const sortedCourses = Object.values(courseMap).sort((a, b) => courseRank(a.subject) - courseRank(b.subject));
  const rows = sortedCourses.map(c => {
    let gradeDisplay = "In Progress";
    let crEarned = "-";
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
    const stdTag = getCourseStandardTag(c.subject);
    const actionBtns = '<span class="no-print" style="margin-left:6px; display:inline-flex; gap:4px;"><button type="button" class="btn-outline" style="width:auto; padding:1px 6px; font-size:11px; color:#1e293b;" onclick="editTranscriptCourse(\'' + stu.id + '\',\'' + c.quarter + '\',\'' + safeSub + '\',\'' + safeLvl + '\',' + c.credits + ')">✏️</button><button type="button" class="btn-outline" style="width:auto; padding:1px 6px; font-size:11px; color:#b91c1c;" onclick="deleteTranscriptCourse(\'' + stu.id + '\',\'' + c.quarter + '\',\'' + safeSub + '\')">🗑️</button></span>';
    return '<tr><td style="padding:8px 10px; border-bottom:1px solid #cbd5e1;">' + c.quarter + '</td><td style="padding:8px 10px; border-bottom:1px solid #cbd5e1;"><strong>' + c.subject + '</strong> <span style="font-size:10px; background:#f1f5f9; border:1px solid #cbd5e1; padding:1px 5px; border-radius:4px; color:#475569;">' + stdTag + '</span>' + actionBtns + '</td><td style="padding:8px 10px; border-bottom:1px solid #cbd5e1;">' + c.course_level + '</td><td style="padding:8px 10px; border-bottom:1px solid #cbd5e1; text-align:center;">' + c.credits.toFixed(2) + '</td><td style="padding:8px 10px; border-bottom:1px solid #cbd5e1; text-align:center;">' + crEarned + '</td><td style="padding:8px 10px; border-bottom:1px solid #cbd5e1; text-align:center;"><strong>' + gradeDisplay + '</strong></td></tr>';
  }).join("");
  const weightedGpa = totalCredits > 0 ? (weightedPoints / totalCredits).toFixed(2) : "N/A";
  const unweightedGpa = totalCredits > 0 ? (unweightedPoints / totalCredits).toFixed(2) : "N/A";
  const globeSeal = buildGoldGlobeSealSvg();

  const achSection = stuAchs.length
    ? '<div style="margin-top:18px; border-top:1px solid #94a3b8; padding-top:12px;"><div style="font-size:12px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#1e293b; margin-bottom:6px;">Verified Honors Certifications, Field Studies &amp; Service</div><ul style="margin:0; padding-left:18px; font-size:12px; line-height:1.6;">' + stuAchs.map(x => '<li><strong>' + x.title + '</strong> (' + x.category + (x.hours_logged ? ' &bull; ' + x.hours_logged + ' hrs' : '') + ') — ' + (x.description || '') + '</li>').join("") + '</ul></div>'
    : "";

  const legalNotice = '<div style="margin-top:14px; padding:8px 10px; background:#f8fafc; border:1px solid #cbd5e1; font-size:10px; color:#475569; line-height:1.5;"><strong>Home-Education Legal &amp; Curriculum Disclosure:</strong> GlobalPrep High is a homeschool curriculum, gradebook, and academic recordkeeping platform and is not an accredited brick-and-mortar school. This transcript is issued directly by the Parent/Guardian Home-Education Administrator pursuant to applicable state homeschool laws. Curriculum benchmarks align with U.S. CCSS, NGSS, and C3 college-preparatory standards. Open educational reference streams provided via YouTube EDU, OpenStax (CC BY 4.0), PhET, Desmos, and Khan Academy.</div>';

  const transcriptHtml =
    '<div style="font-family: Georgia, \'Times New Roman\', serif; color:#0f172a; background:#ffffff; border:2px solid #0f172a; padding:32px; box-shadow:0 4px 16px rgba(15,23,42,0.08); margin-bottom:28px;">' +
      '<div style="display:flex; justify-content:space-between; align-items:center; border-bottom:3px double #0f172a; padding-bottom:14px; margin-bottom:18px; gap:12px;">' +
        '<div style="display:flex; align-items:center; gap:14px;">' + globeSeal +
          '<div><div style="font-size:21px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase;">' + currentFamily.family_name + '</div>' +
          '<div style="font-size:11px; letter-spacing:1px; text-transform:uppercase; color:#334155; margin-top:2px;">Official High School Academic Transcript</div></div>' +
        '</div>' +
        '<div style="border:1.5px solid #0f172a; padding:6px 12px; text-align:center; font-size:11px; letter-spacing:0.8px; text-transform:uppercase;"><strong>Official Record</strong><br>Issued: ' + todayStr + '</div>' +
      '</div>' +
      '<table style="width:100%; border-collapse:collapse; font-size:13px; margin-bottom:18px; background:#f8fafc; border:1px solid #cbd5e1;">' +
        '<tr><td style="padding:8px 12px; border-right:1px solid #cbd5e1;"><strong>Student Legal Name:</strong> ' + stu.full_name + '</td>' +
        '<td style="padding:8px 12px; border-right:1px solid #cbd5e1;"><strong>Grade Level:</strong> ' + stu.grade_level + '</td>' +
        '<td style="padding:8px 12px;"><strong>Expected Graduation:</strong> Class of ' + stu.expected_grad_year + '</td></tr>' +
        '<tr style="border-top:1px solid #cbd5e1;"><td style="padding:8px 12px; border-right:1px solid #cbd5e1;"><strong>Weighted Cumulative GPA:</strong> ' + weightedGpa + '</td>' +
        '<td style="padding:8px 12px; border-right:1px solid #cbd5e1;"><strong>Unweighted GPA:</strong> ' + unweightedGpa + '</td>' +
        '<td style="padding:8px 12px;"><strong>Total Credits Earned:</strong> ' + totalCredits.toFixed(2) + '</td></tr>' +
      '</table>' +
      '<table style="width:100%; border-collapse:collapse; font-size:13px; border:1px solid #94a3b8;">' +
        '<thead><tr style="background:#1e293b; color:#ffffff; text-transform:uppercase; font-size:11px; letter-spacing:0.8px;">' +
          '<th style="padding:9px 10px; text-align:left;">Term</th><th style="padding:9px 10px; text-align:left;">Course Title &amp; Standard</th><th style="padding:9px 10px; text-align:left;">Course Level</th><th style="padding:9px 10px; text-align:center;">Attempted</th><th style="padding:9px 10px; text-align:center;">Earned</th><th style="padding:9px 10px; text-align:center;">Final Grade</th>' +
        '</tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="6" style="padding:14px; text-align:center; color:#64748b;">No coursework recorded yet.</td></tr>') + '</tbody>' +
      '</table>' +
      achSection +
      '<div style="margin-top:14px; padding:8px 12px; background:#f8fafc; border:1px solid #cbd5e1; font-size:11px; color:#334155;"><strong>Grading &amp; Weighting Scale:</strong> A (90–100) = 4.0 &bull; B (80–89) = 3.0 &bull; C (70–79) = 2.0 &bull; D (60–69) = 1.0 &bull; Honors (+0.50) &bull; AP (+1.00)</div>' +
      legalNotice +
      '<div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:28px; font-size:13px;">' +
        '<div>____________________________________<br><span style="font-size:11px; text-transform:uppercase; letter-spacing:0.8px; color:#334155;">Parent / Home-Education Administrator Signature</span></div>' +
        '<div>________________________<br><span style="font-size:11px; text-transform:uppercase; letter-spacing:0.8px; color:#334155;">Date Certified</span></div>' +
      '</div>' +
    '</div>';

     const diplomaHtml =
    '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-top:22px; padding-top:14px; border-top:2px solid #cbd5e1;">' +
      '<strong style="font-size:16px; color:#0f172a;">🎓 Official High School Diploma Preview</strong>' +
      '<button type="button" class="btn-primary no-print" style="width:auto; padding:8px 14px;" onclick="printDiplomaOnly()">🖨️ Print / Save Diploma PDF</button>' +
    '</div>' +
    buildDiplomaCardHtml(stu, currentFamily);

  preview.innerHTML = transcriptHtml + diplomaHtml;
}


function getYouTubeEmbed(url) {
  const base = "https://youtube.com";
  if (!url) return null;
  if (url.startsWith("yt:")) return base + url.slice(3).trim();
  const m = url.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  return m ? base + m[1] : null;
}

function switchStudentTab(tabName, btn) {
  document.querySelectorAll("#studentDashboard .pill").forEach(b => {
    b.classList.remove("active");
    b.style.background = "#ffffff";
    b.style.color = "#0f172a";
    b.style.borderColor = "#cbd5e1";
  });
  if (btn) {
    btn.classList.add("active");
    btn.style.background = "#1e3a8a";
    btn.style.color = "#ffffff";
    btn.style.borderColor = "#1e3a8a";
  }
  document.querySelectorAll(".s-view").forEach(v => v.classList.add("hidden"));
  const target = document.getElementById("sView-" + tabName);
  if (target) target.classList.remove("hidden");
}

function getSubjectMediaPack(subject) {
  const s = (subject || "").toLowerCase();
  const YT = "https://youtube.com";
  if (s.includes("english") || s.includes("literature")) {
    return { yt: YT + "erkLXTvTrp8", label: "Ray Bradbury & Dystopian Literature Video" };
  }
  if (s.includes("algebra")) {
    return { yt: YT + "NybHckSEQBI", label: "Algebra Linear Equations Video" };
  }
  if (s.includes("geometry")) {
    return { yt: YT + "302eJ3TzJQU", label: "Geometry Proofs & Parallel Lines Video" };
  }
  if (s.includes("calculus") || s.includes("math")) {
    return { yt: YT + "WUvTyaaNkzM", label: "Mathematics Visual Essence Video" };
  }
  if (s.includes("marine")) {
    return { yt: YT + "3GRA70KOSPg", label: "Marine Biology & Ocean Ecosystems Video" };
  }
  if (s.includes("biology")) {
    return { yt: YT + "eJ9Zjc-jdys", label: "Amoeba Sisters: Cellular Respiration Video" };
  }
  if (s.includes("chemistry")) {
    return { yt: YT + "FSyAehMdpyI", label: "CrashCourse Chemistry: Atomic Structure Video" };
  }
  if (s.includes("physics") || s.includes("science")) {
    return { yt: YT + "ZM8ECpBuQYE", label: "Physics Motion & Forces Video" };
  }
  if (s.includes("history") || s.includes("government") || s.includes("economics")) {
    return { yt: YT + "Yocja_N5s1I", label: "CrashCourse World History: Mesopotamia & Hammurabi" };
  }
  if (s.includes("mandarin") || s.includes("chinese")) {
    return { yt: YT + "McZW0iOgSrv", label: "Mandarin Chinese 4-Tone Pronunciation Video" };
  }
  if (s.includes("hindi")) {
    return { yt: YT + "1lrz11BbqCA", label: "Hindi Devanagari Pronunciation Video" };
  }
  if (s.includes("spanish")) {
    return { yt: YT + "DAp_v7EH9AA", label: "Spanish Conversational Foundations Video" };
  }
  if (s.includes("french")) {
    return { yt: YT + "ujDtm0hZyII", label: "French Pronunciation & Greetings Video" };
  }
  if (s.includes("automotive") || s.includes("mechanics")) {
    return { yt: YT + "ZQvfHyfgBtA", label: "How a 4-Stroke Engine Works Video" };
  }
  if (s.includes("stock") || s.includes("financial") || s.includes("entrepreneurship")) {
    return { yt: YT + "p7HKvqRI_Bo", label: "How the Stock Market & Equities Work Video" };
  }
  return { yt: YT + "8jPQjjsBbIc", label: "Honors Study Strategy Video" };
}

function formatLessonSteps(rawDesc, subject) {
  let text = (rawDesc || "").trim();
  const s = (subject || "").toLowerCase();
  if (s.includes("history") && !text.toLowerCase().includes("louvre")) {
    text = "🏛️ HISTORICAL CONTEXT — THE LOUVRE: Originally built in 1190 as a medieval fortress by King Philip II and later transformed into the French royal palace before opening as a public museum during the French Revolution in 1793, the Louvre houses over 35,000 works spanning ancient Mesopotamia, Egypt, Greece, and the Renaissance.\n\n" + text;
  }
  if (s.includes("biology") && text.toLowerCase().includes("yeast")) {
    text += "\n\n🥄 NO-YEAST HOUSEHOLD ALTERNATIVE: If you do not have active dry yeast on hand, mix 2 tablespoons of baking soda with 1/2 cup of warm vinegar (or lemon juice) inside a clear bottle with a balloon stretched over the top to observe rapid CO2 gas expansion, then compare chemical acid-base gas release with biological cellular respiration!";
  }
  if (s.includes("algebra") || s.includes("geometry") || s.includes("calculus") || s.includes("math")) {
    text += "\n\n✏️ REQUIRED PAPER WORK: Grab a sheet of lined or graph paper, copy each problem neatly, show every algebraic step line-by-line, box your final answer, and snap a photo below so your parent can review your process!";
  }
  let formatted = text
    .replace(/\s+(?=\d+\.\s)/g, "<br><br>")
    .replace(/\n\n+/g, "<br><br>")
    .replace(/\n/g, "<br>")
    .replace(/\b([A-Z][A-Z0-9\s,&'’—-]{3,}:)/g, "<strong>$1</strong>");
  return formatted;
}

function checkInlineQuiz(assignId, qIdx, chosenIdx, correctIdx) {
  const fb = document.getElementById("qz-fb-" + assignId + "-" + qIdx);
  if (!fb) return;
  if (Number(chosenIdx) === Number(correctIdx)) {
    fb.style.color = "#15803d";
    fb.innerText = "✅ Correct! Great job.";
  } else {
    fb.style.color = "#b91c1c";
    fb.innerText = "❌ Not quite—re-check the video/notes above and try again!";
  }
}

function speakPronunciation(phrase, langCode) {
  if (!("speechSynthesis" in window)) {
    return alert("Phonetic Pronunciation: " + phrase);
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(phrase);
  utter.lang = langCode || "en-US";
  utter.rate = 0.85;
  window.speechSynthesis.speak(utter);
}

function toggleLessonStep(assignId, stepIdx, totalSteps, isChecked) {
  const key = "gph_steps_" + assignId;
  const saved = JSON.parse(localStorage.getItem(key) || "{}");
  saved[stepIdx] = !!isChecked;
  localStorage.setItem(key, JSON.stringify(saved));
  let done = 0;
  for (let i = 0; i < totalSteps; i++) {
    if (saved[i]) done++;
  }
  const pct = Math.round((done / totalSteps) * 100);
  const el = document.getElementById("pct-" + assignId);
  if (el) el.innerText = pct + "% Complete";
}

function buildPronunciationBar(subject) {
  const s = (subject || "").toLowerCase();
  if (s.includes("history")) {
    return '<div style="background:#f0f9ff; border:1px solid #bae6fd; padding:8px 12px; border-radius:8px; margin:8px 0; display:flex; flex-wrap:wrap; align-items:center; gap:8px; font-size:13px;"><span>🗣️ <b>Key Pronunciations:</b></span><button type="button" class="btn-outline" style="width:auto; color:#0369a1; padding:4px 10px; font-size:12px;" onclick="speakPronunciation(\'Hammurabi\', \'en-US\')">🔊 Hammurabi (hah-moo-RAH-bee)</button><button type="button" class="btn-outline" style="width:auto; color:#0369a1; padding:4px 10px; font-size:12px;" onclick="speakPronunciation(\'Louvre\', \'fr-FR\')">🔊 Louvre (LOOV-ruh)</button><button type="button" class="btn-outline" style="width:auto; color:#0369a1; padding:4px 10px; font-size:12px;" onclick="speakPronunciation(\'Mesopotamia\', \'en-US\')">🔊 Mesopotamia (mes-uh-puh-TAY-mee-uh)</button></div>';
  }
  if (s.includes("mandarin") || s.includes("chinese")) {
    return '<div style="background:#f0f9ff; border:1px solid #bae6fd; padding:8px 12px; border-radius:8px; margin:8px 0; display:flex; flex-wrap:wrap; align-items:center; gap:8px; font-size:13px;"><span>🗣️ <b>Tap to Hear Mandarin Pronunciation:</b></span><button type="button" class="btn-outline" style="width:auto; color:#0369a1; padding:4px 10px; font-size:12px;" onclick="speakPronunciation(\'你好\', \'zh-CN\')">🔊 Nǐ hǎo (nee HOW • Hello)</button><button type="button" class="btn-outline" style="width:auto; color:#0369a1; padding:4px 10px; font-size:12px;" onclick="speakPronunciation(\'谢谢\', \'zh-CN\')">🔊 Xièxie (SHYEH-shyeh • Thank you)</button><button type="button" class="btn-outline" style="width:auto; color:#0369a1; padding:4px 10px; font-size:12px;" onclick="speakPronunciation(\'再见\', \'zh-CN\')">🔊 Zàijiàn (DZAI-jyen • Goodbye)</button></div>';
  }
  if (s.includes("spanish")) {
    return '<div style="background:#f0f9ff; border:1px solid #bae6fd; padding:8px 12px; border-radius:8px; margin:8px 0; display:flex; flex-wrap:wrap; align-items:center; gap:8px; font-size:13px;"><span>🗣️ <b>Tap to Hear Spanish Pronunciation:</b></span><button type="button" class="btn-outline" style="width:auto; color:#0369a1; padding:4px 10px; font-size:12px;" onclick="speakPronunciation(\'Buenos días, ¿cómo estás?\', \'es-ES\')">🔊 Buenos días, ¿cómo estás?</button><button type="button" class="btn-outline" style="width:auto; color:#0369a1; padding:4px 10px; font-size:12px;" onclick="speakPronunciation(\'Muchas gracias\', \'es-ES\')">🔊 Muchas gracias</button></div>';
  }
  if (s.includes("french")) {
    return '<div style="background:#f0f9ff; border:1px solid #bae6fd; padding:8px 12px; border-radius:8px; margin:8px 0; display:flex; flex-wrap:wrap; align-items:center; gap:8px; font-size:13px;"><span>🗣️ <b>Tap to Hear French Pronunciation:</b></span><button type="button" class="btn-outline" style="width:auto; color:#0369a1; padding:4px 10px; font-size:12px;" onclick="speakPronunciation(\'Bonjour, comment allez-vous ?\', \'fr-FR\')">🔊 Bonjour, comment allez-vous ?</button><button type="button" class="btn-outline" style="width:auto; color:#0369a1; padding:4px 10px; font-size:12px;" onclick="speakPronunciation(\'Merci beaucoup\', \'fr-FR\')">🔊 Merci beaucoup</button></div>';
  }
  return "";
}
function splitLessonParts(rawDesc, subject) {
  const s = (subject || "").toLowerCase();
  let intro = "";
  if (s.includes("history")) {
    intro = "<strong>STEP 1 — HISTORICAL BACKGROUND (THE LOUVRE &amp; BABYLON):</strong><br>Originally built in 1190 as a medieval fortress by King Philip II and later transformed into the French royal palace before opening as a public museum in 1793, the <b>Louvre</b> houses over 35,000 works—including the 7.4-foot basalt steel of King <b>Hammurabi</b> (c. 1754 BCE). Watch the video below first to explore how early written law shaped civilization.";
  } else if (s.includes("biology") || s.includes("chemistry") || s.includes("science")) {
    intro = "<strong>STEP 1 — CONCEPT &amp; LAB BRIEFING:</strong><br>Watch the video below first to observe how molecules and energy transform during chemical and biological reactions, then complete the hands-on lab steps underneath.";
  } else if (s.includes("algebra") || s.includes("geometry") || s.includes("calculus") || s.includes("math")) {
    intro = "<strong>STEP 1 — CONCEPT BRIEFING &amp; TOOLKIT:</strong><br>Watch the step-by-step video lesson below first. Use the <b>Calculator &amp; Line Grapher</b> button right below to verify graphs, and write out every algebraic step neatly on paper!";
  } else if (s.includes("mandarin") || s.includes("spanish") || s.includes("french") || s.includes("hindi")) {
    intro = "<strong>STEP 1 — LISTENING &amp; PRONUNCIATION WARM-UP:</strong><br>Tap the speaker buttons above to hear native pronunciation, then watch the video below to practice rhythm, tones, and conversational phrases.";
  } else {
    intro = "<strong>STEP 1 — LESSON OVERVIEW:</strong><br>Watch the video below first to master today's core concept before completing the step-by-step activity underneath.";
  }

  let body = (rawDesc || "").trim();
  if (s.includes("biology") && body.toLowerCase().includes("yeast")) {
    body += "\n\n🥄 NO-YEAST HOUSEHOLD ALTERNATIVE: If you do not have active dry yeast on hand, mix 2 tablespoons of baking soda with 1/2 cup of warm vinegar (or lemon juice) inside a clear bottle with a balloon stretched over the top to observe rapid CO2 gas expansion, then compare chemical acid-base gas release with biological cellular respiration!";
  }
  if (s.includes("algebra") || s.includes("geometry") || s.includes("calculus") || s.includes("math")) {
    body += "\n\n✏️ REQUIRED PAPER WORK: Grab a sheet of lined or graph paper, copy each problem neatly, show every step line-by-line, box your final answer, and upload a photo below!";
  }

  const formattedBody = "<strong>STEP 2 — STEP-BY-STEP INSTRUCTIONS &amp; ACTIVITY:</strong><br>" + body
    .replace(/\s+(?=\d+\.\s)/g, "<br><br>")
    .replace(/\n\n+/g, "<br><br>")
    .replace(/\n/g, "<br>")
    .replace(/\b([A-Z][A-Z0-9\s,&'’—-]{3,}:)/g, "<strong>$1</strong>");

  return { intro, formattedBody };
}

window.stuCourseOpen = false;
window.stuViewDayOffset = {};
window.stuAllBySubject = {};

function openStudentCourse(idx) {
  selectedStuSubjectIdx = idx;
  window.stuCourseOpen = true;
  renderStudentTodayPane();
}

function closeStudentCourseMenu() {
  window.stuCourseOpen = false;
  renderStudentTodayPane();
}

function shiftStudentDay(subj, delta, maxLen) {
  const cur = typeof window.stuViewDayOffset[subj] === "number" ? window.stuViewDayOffset[subj] : (maxLen - 1);
  window.stuViewDayOffset[subj] = Math.max(0, Math.min(maxLen - 1, cur + delta));
  renderStudentTodayPane();
}

function speakWordInline(word, langCode) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word);
  u.lang = langCode || "en-US";
  u.rate = 0.88;
  window.speechSynthesis.speak(u);
}

function injectInlinePronunciations(html, subject) {
  const s = (subject || "").toLowerCase();
  let terms = [];
  if (s.includes("spanish")) {
    terms = [
      { w: "Buenos días", p: "BWEH-nohs DEE-ahs", l: "es-ES" },
      { w: "Por favor", p: "por fah-VOR", l: "es-ES" },
      { w: "Muchas gracias", p: "MOO-chahs GRAH-syahs", l: "es-ES" },
      { w: "Quisiera", p: "kee-SYEH-rah", l: "es-ES" },
      { w: "La cuenta", p: "lah KWEN-tah", l: "es-ES" }
    ];
  } else if (s.includes("mandarin") || s.includes("chinese")) {
    terms = [
      { w: "Nǐ hǎo", p: "nee-how", l: "zh-CN" },
      { w: "Xièxie", p: "shyeh-shyeh", l: "zh-CN" }
    ];
  } else if (s.includes("french")) {
    terms = [
      { w: "Bonjour", p: "bohn-ZHOOR", l: "fr-FR" },
      { w: "Merci beaucoup", p: "mehr-SEE boh-KOO", l: "fr-FR" }
    ];
  } else if (s.includes("hindi")) {
    terms = [
      { w: "Namaste", p: "nuh-muh-STAY", l: "hi-IN" },
      { w: "Dhanyavaad", p: "dhun-yuh-VAAD", l: "hi-IN" }
    ];
  } else if (s.includes("history")) {
    terms = [
      { w: "Hammurabi", p: "hah-moo-RAH-bee", l: "en-US" },
      { w: "Cuneiform", p: "kyoo-NEE-uh-form", l: "en-US" },
      { w: "Mesopotamia", p: "mes-uh-puh-TAY-mee-uh", l: "en-US" }
    ];
  } else if (s.includes("marine")) {
    terms = [
      { w: "Thermohaline", p: "thur-moh-HAY-leen", l: "en-US" },
      { w: "Pelagic", p: "puh-LAJ-ik", l: "en-US" },
      { w: "Salinity", p: "suh-LIN-ih-tee", l: "en-US" }
    ];
  } else if (s.includes("biology")) {
    terms = [
      { w: "Anaerobic", p: "an-uh-ROH-bik", l: "en-US" },
      { w: "Hypothesis", p: "hy-POTH-uh-sis", l: "en-US" },
      { w: "Metabolism", p: "muh-TAB-uh-liz-um", l: "en-US" }
    ];
  } else if (s.includes("literature") || s.includes("english")) {
    terms = [
      { w: "Dystopia", p: "dis-TOH-pee-uh", l: "en-US" },
      { w: "Censorship", p: "SEN-ser-ship", l: "en-US" },
      { w: "Foreshadowing", p: "for-SHAD-oh-ing", l: "en-US" }
    ];
  }
  let out = html;
  terms.forEach(t => {
    const safeW = t.w.replace(/'/g, "\\'");
    const pill = `<span onclick="speakWordInline('${safeW}','${t.l}')" title="Tap to hear pronunciation" style="background:#e0f2fe; color:#0369a1; border-bottom:2px dotted #0284c7; padding:1px 5px; border-radius:4px; cursor:pointer; font-weight:700;">🔊 ${t.w} <small style="font-weight:500; color:#475569;">[${t.p}]</small></span>`;
    out = out.replace(new RegExp("\\b" + t.w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i"), pill);
  });
  return out;
}
function getKhanLessonContent(subject, dayNum, baseDesc) {
  const s = (subject || "").toLowerCase();

  if (s.includes("literature") || s.includes("english")) {
    const litDays = {
      1: {
        why: "Why This Matters: In 2026, algorithms curate what you see every second. Ray Bradbury wrote Fahrenheit 451 in 1953 warning about a society that trades deep reading for wall-sized screens—today you'll spot how his prediction mirrors modern media.",
        yt: ["7aKItfLeso4"],
        reading: "TEXTBOOK READING — DYSTOPIAN FICTION & BRADBURY'S WARNING:\nRay Bradbury’s Fahrenheit 451 opens with fireman Guy Montag enjoying his job burning books—until his 17-year-old neighbor Clarisse McClellan asks him one simple question: 'Are you happy?' Unlike Orwell’s 1984 (where government force bans books), Bradbury imagined a world where fast cars, parlor-wall TVs, and Seashell earbuds made people stop caring about books on their own. Notice the contrast between Clarisse’s curiosity about nature and Mildred’s obsession with her interactive screen 'family.'",
        steps: "1. WATCH THE VIDEO BELOW (40 min total lesson): Watch Ray Bradbury explain what truly inspired Fahrenheit 451.\n2. READ THE NOVEL: Tap the Fahrenheit 451 PDF button below and read pages 1–55. Notice how Guy Montag thinks he's happy until 17-year-old neighbor Clarisse asks one simple question.\n3. HONORS ANALYSIS & 2026 CONNECTION (Write 8–12 well-crafted sentences): Compare Clarisse’s way of observing the world to Mildred’s screen addiction, citing two specific moments from pages 1–55 and connecting them to modern 2026 short-form media.\n4. CARMEN SANDIEGO GLOBAL BONUS: Bradbury set his novel in an unnamed American city, yet his books were banned in real life across several countries. Name one real city where Fahrenheit 451 faced censorship and why!"
      },
      2: {
        why: "Why This Matters: Great writers use symbols (fire, salamanders, mechanical hounds) to carry hidden arguments without preaching. Spotting symbolism turns you from a passive reader into a sharp critical thinker.",
        yt: ["7aKItfLeso4"],
        reading: "TEXTBOOK READING — PART 2: THE SIEVE AND THE SAND (PAGES 66–103):\nIn Part 2, Montag tries to memorize lines from the Bible on a subway while blaring Denham’s Dentifrice jingles drown out his thoughts—like trying to fill a sieve with sand. Former English professor Faber explains that books aren't magic; what matters are three things: (1) quality of information, (2) leisure to digest it, and (3) the right to act on what we learn.",
        steps: "1. WATCH THE VIDEO BELOW: Review Bradbury’s commentary on distraction vs. deep thought.\n2. READ PART 2: Tap the Fahrenheit 451 PDF button below and read Part 2 (pages 66–103).\n3. HONORS ANALYSIS (8–12 sentences): Explain Faber’s three requirements for a thoughtful society and analyze why Montag’s subway scene illustrates modern digital distraction.\n4. CARMEN SANDIEGO GLOBAL BONUS: Where in the world is the ancient Library of Alexandria located, and what happened to its scrolls?"
      },
      3: {
        why: "Why This Matters: Turning points in literature reveal what a character truly values when everything comfortable is stripped away.",
        yt: ["7aKItfLeso4"],
        reading: "TEXTBOOK READING — PART 3: BURNING BRIGHT (PAGES 104–158):\nCaptain Beatty forces Montag to burn his own house, revealing Beatty actually knows literature well—and uses quotes as weapons to argue that conflicting books only make people unhappy. Escaping down the river, Montag meets Granger and the Book People, who each memorize an entire book to keep human memory alive after war destroys the city.",
        steps: "1. WATCH THE VIDEO BELOW: Reflect on Bradbury’s message about preserving human knowledge.\n2. READ PART 3: Tap the Fahrenheit 451 PDF button below and finish Part 3 (pages 104–158) to complete the novel in Week 1!\n3. HONORS SYNTHESIS (8–12 sentences): Analyze how the symbol of fire transforms from destruction at the start of the novel to warmth and rebirth with Granger’s camp at the end.\n4. CARMEN SANDIEGO GLOBAL BONUS: If you joined Granger’s traveling Book People in Kyoto, Japan, which book would you memorize and why?"
      }
    };
    return litDays[dayNum] || {
      why: `Why This Matters (Week ${Math.ceil(dayNum / 5)} Honors Literature): Moving beyond Fahrenheit 451, strong writers analyze rhetoric, poetry, and global short fiction to see how voice and structure shape persuasion.`,
      yt: ["7aKItfLeso4"],
      reading: "TEXTBOOK READING — RHETORIC, VOICE & COMPARATIVE FICTION:\nIn Week 2 and beyond, Honors Literature explores how authors use ethos (credibility), pathos (emotion), and logos (evidence) alongside irony and point of view. Compare how dystopian fiction warns through imagination while nonfiction essays persuade through historical evidence.",
      steps: "1. WATCH THE VIDEO BELOW: Study how authors craft memorable themes.\n2. CLOSE READING: Review the textbook passage above and identify one example of irony and one appeal to logos.\n3. HONORS WRITING EXERCISE (8–12 sentences): Write a comparative paragraph contrasting how fiction and journalism expose truth in society.\n4. CARMEN SANDIEGO GLOBAL BONUS: Which European capital hosts the Nobel Prize in Literature ceremony every December?"
    };
  }

  if (s.includes("algebra") || s.includes("geometry") || s.includes("calculus") || s.includes("math")) {
    if (dayNum === 1) {
      return {
        why: "Why This Matters: Linear equations power everything from calculating flight fuel burn and currency exchange rates while traveling to predicting monthly savings. Mastering slope and y-intercept lets you model real-world change.",
        yt: ["MeU-KzdCBps", "uk7gS3cZVp4"],
        reading: "TEXTBOOK READING — SLOPE, INTERCEPTS & ORDER OF OPERATIONS:\nA linear function follows y = mx + b, where m is the slope (rise/run = (y₂ - y₁)/(x₂ - x₁)) and b is the y-intercept (starting value when x = 0). Remember PEMDAS: Parentheses, Exponents, Multiplication/Division left-to-right, Addition/Subtraction left-to-right. Joke break: Why was the equal sign so humble? Because it knew it wasn't less than or greater than anyone else!",
        steps: (baseDesc || "").replace(/above/gi, "below").replace(/Desmond/gi, "Desmos")
      };
    }
    return {
      why: `Why This Matters (Day ${dayNum} Honors Algebra): Systems of equations and inequalities let you compare two competing options—like two international phone plans or travel routes—and find the exact break-even point.`,
      yt: ["MeU-KzdCBps"],
      reading: `TEXTBOOK READING — DAY ${dayNum}: SYSTEMS OF LINEAR EQUATIONS & MODELING:\nWhen two linear equations intersect on a coordinate plane, their intersection point (x, y) satisfies both equations simultaneously. Use the Interactive Calculator & Line Grapher below to test slopes (m) and intercepts (b) visually!`,
      steps: `1. WATCH THE VIDEO BELOW: Review linear graphing and equation solving.\n2. USE THE MATH TOOLKIT BELOW: Graph y = 2x + 1 and compare its steepness to y = 0.5x + 4.\n3. SHOW-YOUR-WORK PAPER PROBLEMS (Solve & explain in 8–12 lines): (a) Solve 3(x - 4) + 2x = 18; (b) Find the slope between (-2, 5) and (4, 17); (c) Write the equation in y = mx + b form; (d) Model a travel train pass costing $25 upfront plus $3 per ride.\n4. CARMEN SANDIEGO GLOBAL BONUS: If a Shinkansen bullet train travels 320 km/h from Tokyo to Kyoto (450 km), write a linear distance equation d = rt and solve for travel time!`
    };
  }
  if (s.includes("marine")) {
    return {
      why: `Why This Matters (Day ${dayNum} Marine Biology): Oceans produce over 50% of Earth's oxygen and regulate global weather. Understanding salinity, density, and marine symbiosis explains how coastal reefs and deep-sea ecosystems survive.`,
      yt: ["3nAETHZTObk"],
      reading: dayNum === 1
        ? "TEXTBOOK READING — OCEANOGRAPHY, SALINITY & CORAL REEF SYMBIOSIS:\nEarth's oceans cover 71% of the planet and average 35 parts per thousand (35 ppt, or 3.5%) dissolved Salinity. Cold, salty water is denser and sinks, driving global Thermohaline circulation—a massive conveyor belt moving heat around Earth. In shallow tropical waters, reef-building corals share a mutualistic symbiosis with photosynthetic algae called zooxanthellae: the algae provide up to 90% of the coral's energy via sunlight, while the coral provides shelter and nutrients. Joke break: What did the ocean say to the beach? Nothing, it just waved!"
        : `TEXTBOOK READING — DAY ${dayNum}: PELAGIC ZONES & MARINE FOOD WEBS:\nThe open Pelagic ocean divides into sunlight (epipelagic), twilight (mesopelagic), and midnight (bathypelagic) zones. Phytoplankton form the base of marine food webs, transferring energy up to zooplankton, schooling fish, and apex predators.`,
      steps: dayNum === 1
        ? "1. WATCH THE VIDEO BELOW: Watch how scientific experiments and ecosystem variables are tested cleanly.\n2. READ THE TEXTBOOK CHAPTER ABOVE: Study 35 ppt salinity, thermohaline density, and coral-zooxanthellae symbiosis.\n3. HANDS-ON LAB (COASTAL OR INLAND AT-HOME SEAWATER SIMULATION): Near the ocean? Collect a coastal water sample and measure temperature, clarity, and float buoyancy. Not near an ocean? Create three test cups at home: (A) 35 ppt synthetic seawater (3.5 tsp non-iodized sea salt in 500 mL water), (B) 15 ppt brackish water (1.5 tsp salt), and (C) 0 ppt freshwater control. Test how high a raw egg or grape floats in each cup and record your measurements!\n4. HONORS REFLECTION (8–12 sentences): Explain how salinity changes water density and why coral reefs depend on narrow temperature and salinity ranges.\n5. CARMEN SANDIEGO GLOBAL BONUS: Name the country home to the Great Barrier Reef—the largest coral reef system on Earth!"
        : `1. WATCH THE VIDEO BELOW: Observe how energy flows through living ecosystems.\n2. READ THE TEXTBOOK CHAPTER ABOVE: Compare the epipelagic and bathypelagic zones.\n3. HONORS LAB & ANALYSIS (8–12 sentences): Construct a 4-level marine food pyramid and explain what happens to top predators if ocean warming reduces phytoplankton by 30%.\n4. CARMEN SANDIEGO GLOBAL BONUS: Which trench in the western Pacific reaches nearly 11,000 meters deep?`
    };
  }

  if (s.includes("biology")) {
    if (dayNum === 1) {
      const cleanedBio = (baseDesc || "").replace(/above/gi, "below").replace(/\n3\.\s*Stir,\s*add/gi, "\n   • Stir, add");
      return {
        why: "Why This Matters: Every medical breakthrough, vaccine, and athletic nutrition plan starts with controlled experiments. Today you'll design a real test of cellular Metabolism using living yeast.",
        yt: ["3nAETHZTObk", "4Eo7JtRA7lg"],
        reading: "TEXTBOOK READING — EXPERIMENTAL DESIGN & CELLULAR METABOLISM:\nA valid scientific Hypothesis isolates one Independent Variable (what you change, like sugar amount) while measuring a Dependent Variable (what responds, like CO₂ balloon circumference) against an unchanged Control group. Living yeast cells perform Anaerobic fermentation when oxygen is limited, breaking down glucose into ATP energy and releasing carbon dioxide (CO₂) gas.",
        steps: cleanedBio + "\n\nNO-YEAST HOUSEHOLD ALTERNATIVE: No yeast on hand? Mix 2 tbsp baking soda with 1/2 cup warm vinegar inside a bottle capped with a balloon to measure gas volume expansion over 10 minutes.\n\nCARMEN SANDIEGO GLOBAL BONUS: Louis Pasteur discovered that yeast causes fermentation while working in which French city famous for the Eiffel Tower?"
      };
    }
    return {
      why: `Why This Matters (Day ${dayNum} Honors Biology): Your body contains ~37 trillion cells, each enclosed by a selectively permeable plasma membrane that controls what enters and exits to keep you alive.`,
      yt: ["3nAETHZTObk"],
      reading: `TEXTBOOK READING — DAY ${dayNum}: CELL MEMBRANES, OSMOSIS & HOMEOSTASIS:\nCell membranes are phospholipid bilayers embedded with transport proteins. Water moves across membranes via osmosis from higher water concentration (hypotonic) to lower water concentration (hypertonic) until reaching equilibrium.`,
      steps: `1. WATCH THE VIDEO BELOW: Review cellular structure and experimental reasoning.\n2. READ THE TEXTBOOK CHAPTER ABOVE: Trace how water moves in hypotonic vs. hypertonic solutions.\n3. HONORS LAB & ANALYSIS (8–12 sentences): Explain why placing a freshwater plant cell in 35 ppt salt water causes plasmolysis (shrinking), using Claim-Evidence-Reasoning.\n4. CARMEN SANDIEGO GLOBAL BONUS: Robert Hooke first coined the term 'cell' while looking at cork under a microscope in which European capital?`
    };
  }

  if (s.includes("history")) {
    if (dayNum === 1) {
      return {
        why: "Why This Matters: Every modern constitution, court system, and bill of rights traces back to the first written law codes. Studying Hammurabi’s Code reveals both how early states created order—and how laws protected social inequality.",
        yt: ["sohXPx_XZ6Y"],
        reading: "TEXTBOOK READING — MESOPOTAMIA, CUNEIFORM & HAMMURABI'S CODE (1754 BCE):\nIn ancient Mesopotamia (modern-day Iraq), Babylonian King Hammurabi carved 282 laws onto a 7-foot black basalt stele written in wedge-shaped Cuneiform script (now preserved in the Louvre Museum in Paris). Unlike modern equality before the law, Hammurabi’s laws enforced strict class hierarchy:\n• Law 196: 'If a man put out the eye of another man (noble), his eye shall be put out.'\n• Law 198: 'If he put out the eye of a freed man (commoner), he shall pay one gold mina.'\n• Law 199: 'If he put out the eye of a man's slave, he shall pay one-half of its value.'\n• Law 229: 'If a builder builds a house for someone and does not construct it properly, and the house collapses and kills its owner, that builder shall be put to death.'\nNotice how the code established early consumer accountability (Law 229) while coding unequal human worth by social class (Laws 196–199).",
        steps: "1. WATCH THE VIDEO BELOW: Watch Crash Course World History on Mesopotamia & Hammurabi’s Code.\n2. READ THE PRIMARY-SOURCE LAWS ABOVE: Study Laws 196, 198, 199, and 229 in the textbook passage right above.\n3. ROYAL JUDGE ROLEPLAY & HONORS ANALYSIS (8–12 sentences): Using the exact laws in the reading above, rule on two cases: (a) a noble injures a commoner vs. another noble, and (b) a poorly built roof collapses. Then evaluate whether Hammurabi’s Code achieved true justice or primarily protected wealth and status.\n4. CARMEN SANDIEGO GLOBAL BONUS: The Stele of Hammurabi was originally erected in Babylon (near Baghdad, Iraq) but is displayed today in which famous glass-pyramid museum in Paris?"
      };
    }
    return {
      why: `Why This Matters (Day ${dayNum} Honors World History): Understanding global trade routes and primary sources shows how ideas, technologies, and power spread across continents—without sanitized textbook myths.`,
      yt: ["sohXPx_XZ6Y"],
      reading: `TEXTBOOK READING — DAY ${dayNum}: PRIMARY-SOURCE ANALYSIS (HIPP METHOD) & ANCIENT EMPIRES:\nHonors historians interrogate every source using HIPP: Historical Context, Intended Audience, Purpose, and Point of View. Comparing official royal inscriptions with letters from merchants, farmers, and conquered peoples uncovers the full reality of ancient empires.`,
      steps: `1. WATCH THE VIDEO BELOW: Follow how early civilizations organized trade and governance.\n2. READ THE TEXTBOOK PASSAGE ABOVE: Review the four elements of HIPP primary-source analysis.\n3. HONORS HISTORICAL ANALYSIS (8–12 sentences): Explain why relying only on a ruler’s official monument distorts history, and describe two other types of evidence historians use to verify what happened to ordinary people.\n4. CARMEN SANDIEGO GLOBAL BONUS: Which overland trade network connected Chang'an (Xi'an), China to the Mediterranean Sea?`
    };
  }

  const isSpa = s.includes("spanish");
  const isMan = s.includes("mandarin") || s.includes("chinese");
  const isFre = s.includes("french");
  const isHin = s.includes("hindi");
  const langYt = isMan ? "3wV8B4bx1lM" : isHin ? "1lrz11BbqCA" : isFre ? "hd0_GZHHWeE" : "DAp_v7EH9AA";
  const immersionCards = isSpa
    ? `<div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:8px; margin:10px 0;">
        <div onclick="speakWordInline('Buenos días','es-ES')" style="background:#f0fdf4; border:1px solid #86efac; padding:10px; border-radius:8px; cursor:pointer;"><b>🔊 Buenos días</b><br><small>Good morning</small></div>
        <div onclick="speakWordInline('Quisiera un café, por favor','es-ES')" style="background:#f0fdf4; border:1px solid #86efac; padding:10px; border-radius:8px; cursor:pointer;"><b>🔊 Quisiera un café, por favor</b><br><small>I would like a coffee, please</small></div>
        <div onclick="speakWordInline('Dos tacos y agua, por favor','es-ES')" style="background:#f0fdf4; border:1px solid #86efac; padding:10px; border-radius:8px; cursor:pointer;"><b>🔊 Dos tacos y agua, por favor</b><br><small>Two tacos and water, please</small></div>
        <div onclick="speakWordInline('La cuenta, por favor. Muchas gracias','es-ES')" style="background:#f0fdf4; border:1px solid #86efac; padding:10px; border-radius:8px; cursor:pointer;"><b>🔊 La cuenta, por favor. Muchas gracias</b><br><small>The bill, please. Thank you very much</small></div>
      </div>`
function renderStudentTodayPane() {
  const tabEl = document.getElementById("stuSubjectTabs");
  const paneEl = document.getElementById("stuActiveLessonPane");
  const progEl = document.getElementById("stuTodayProgress");
  if (!tabEl || !paneEl) return;

  if (!stuActiveAssignsCache.length) {
    tabEl.innerHTML = "";
    if (progEl) progEl.innerText = "0 / 0 Submitted";
    paneEl.innerHTML = "<div class='card'><p class='muted'>All enrolled lessons for this term are complete—or ask your parent to enroll your courses.</p></div>";
    return;
  }

  if (selectedStuSubjectIdx >= stuActiveAssignsCache.length) selectedStuSubjectIdx = 0;

  let doneToday = 0;
  tabEl.innerHTML = stuActiveAssignsCache.map((a, idx) => {
    const seq = window.stuAllBySubject[a.subject] || [a];
    const sub = stuSubsCache.find(x => String(x.assignment_id) === String(a.id));
    const isGraded = sub && (sub.status === "Graded" || (sub.grade && String(sub.grade).trim() !== ""));
    const isSub = sub && sub.status === "Submitted";
    if (isGraded || isSub) doneToday++;
    const badgeHtml = isGraded
      ? `<span style="background:#dcfce7; color:#15803d; padding:4px 10px; border-radius:999px; font-size:12px; font-weight:700;">✅ Graded: ${sub.grade}</span>`
      : isSub
        ? `<span style="background:#fef3c7; color:#b45309; padding:4px 10px; border-radius:999px; font-size:12px; font-weight:700;">⏳ Awaiting Parent Approval</span>`
        : `<span style="background:#dbeafe; color:#1d4ed8; padding:4px 10px; border-radius:999px; font-size:12px; font-weight:700;">▶ Day ${seq.length} Ready</span>`;
    return `<button type="button" onclick="openStudentCourse(${idx})" style="display:flex; justify-content:space-between; align-items:center; width:100%; text-align:left; padding:14px 16px; border-radius:10px; border:1px solid #cbd5e1; background:#f8fafc; color:#0f172a; font-size:15px; font-weight:700; cursor:pointer;">
      <span>📘 ${a.subject} <small style="font-weight:500; color:#64748b;">(Day ${seq.length})</small></span>
      <span>${badgeHtml} &nbsp;›</span>
    </button>`;
  }).join("");

  if (progEl) progEl.innerText = doneToday + " / " + stuActiveAssignsCache.length + " Submitted";

  const menuCard = document.getElementById("stuCourseMenuCard");
  if (!window.stuCourseOpen) {
    if (menuCard) menuCard.classList.remove("hidden");
    paneEl.innerHTML = "";
    return;
  }
  if (menuCard) menuCard.classList.add("hidden");

  const activeLatest = stuActiveAssignsCache[selectedStuSubjectIdx];
  const seq = window.stuAllBySubject[activeLatest.subject] || [activeLatest];
  const dayIdx = typeof window.stuViewDayOffset[activeLatest.subject] === "number"
    ? Math.max(0, Math.min(seq.length - 1, window.stuViewDayOffset[activeLatest.subject]))
    : (seq.length - 1);
  const a = seq[dayIdx] || activeLatest;
  const dayNum = dayIdx + 1;

  const sub = stuSubsCache.find(x => String(x.assignment_id) === String(a.id));
  const statusText = sub && (sub.status === "Graded" || sub.grade)
    ? "✅ Graded: " + sub.grade
    : sub && sub.status === "Submitted"
      ? "⏳ Submitted — Awaiting Parent Approval"
      : `Day ${dayNum} Active Lesson`;

  const cleanTitle = a.title.replace(/^\[[^\]]+\]\s*/, "");
  const khan = getKhanLessonContent(a.subject, dayNum, a.description);
  const ytHost = "www." + "youtube.com";
  const embedUrls = khan.yt.map(id => "https://" + ytHost + "/embed/" + id + "?rel=0&playsinline=1");
  const docLinks = [];
  const rawLinks = a.resource_url ? a.resource_url.split(/[\r\n,]+/).map(u => u.trim()).filter(Boolean) : [];
  rawLinks.forEach(u => {
    const cleanU = u.startsWith("pdf:") ? u.slice(4).trim() : u;
    if (/^https?:\/\//i.test(cleanU) && !cleanU.includes("youtube.com") && !cleanU.includes("youtu.be") && !cleanU.includes("spanishdict") && !cleanU.includes("louvre.fr")) {
      docLinks.push(cleanU);
    }
  });
  const resourceLinksHtml = docLinks.length
    ? '<div style="margin:10px 0; display:flex; flex-wrap:wrap; gap:8px;">' + docLinks.map((lnk, idx) => '<a href="' + lnk + '" target="_blank" rel="noopener" class="btn-outline" style="width:auto; display:inline-block; background:#eff6ff; color:#1d4ed8; border-color:#93c5fd; font-weight:700; text-decoration:none;">📖 Open Reading / Book PDF' + (docLinks.length > 1 ? ' ' + (idx + 1) : '') + ' ↗</a>').join("") + '</div>'
    : "";

  const isMath = /algebra|geometry|calculus|math/i.test(a.subject || "");
  const mathToolkitBtn = isMath
    ? '<div id="mathToolkitBox" style="margin:12px 0; padding:14px; background:#eff6ff; border:2px solid #93c5fd; border-radius:12px;">' +
        '<div style="font-weight:800; font-size:14px; color:#1e3a8a; margin-bottom:10px;">🧮 Interactive Math Toolkit (Scientific Calculator &amp; Line Grapher)</div>' +
        '<div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:12px;">' +
          '<div style="background:#fff; padding:10px; border-radius:8px; border:1px solid #cbd5e1;">' +
            '<div style="font-size:12px; font-weight:700; color:#334155; margin-bottom:6px;">Expression Calculator (+, -, *, /, ^, parentheses)</div>' +
            '<div style="display:flex; gap:6px;">' +
              '<input type="text" id="calcDisplay" placeholder="e.g., (24 / 3) * 2 + (5 - 8)^2" style="margin:0; flex:1;" />' +
              '<button type="button" class="btn-primary" style="width:auto; padding:8px 14px;" onclick="runBackpackCalc()">=</button>' +
            '</div>' +
            '<div id="calcResult" style="margin-top:8px; font-weight:700; color:#0f172a; font-size:14px;">Result: —</div>' +
          '</div>' +
          '<div style="background:#fff; padding:10px; border-radius:8px; border:1px solid #cbd5e1;">' +
            '<div style="font-size:12px; font-weight:700; color:#334155; margin-bottom:6px;">Linear Equation Grapher (y = mx + b)</div>' +
            '<div style="display:flex; gap:6px; align-items:center; margin-bottom:8px;">' +
              '<span style="font-size:12px; font-weight:700;">m:</span><input type="number" id="graphM" value="2" step="0.5" style="width:65px; margin:0;" oninput="drawBackpackLine()" />' +
              '<span style="font-size:12px; font-weight:700;">b:</span><input type="number" id="graphB" value="1" step="1" style="width:65px; margin:0;" oninput="drawBackpackLine()" />' +
              '<button type="button" class="btn-outline" style="width:auto; padding:6px 10px;" onclick="drawBackpackLine()">Plot</button>' +
            '</div>' +
            '<canvas id="slopeCanvas" width="240" height="140" style="width:100%; max-width:260px; border:1px solid #cbd5e1; border-radius:6px; background:#fff;"></canvas>' +
          '</div>' +
        '</div>' +
      '</div>'
    : "";

  const makeVidBox = (src, lbl) =>
    '<div style="margin:12px 0 16px 0; background:#f8fafc; border:1px solid #cbd5e1; border-radius:10px; padding:10px;">' +
      '<div style="font-weight:700; font-size:13px; color:#0f172a; margin-bottom:6px;">🎬 ' + lbl + '</div>' +
      '<div style="position:relative; width:100%; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:8px; background:#000;">' +
        '<iframe src="' + src + '" title="' + lbl + '" style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen playsinline></iframe>' +
      '</div>' +
    '</div>';

  const videosHtml = embedUrls.map((u, idx) => makeVidBox(u, embedUrls.length > 1 ? "Watch Video " + (idx + 1) : "Watch the Lesson Video")).join("");

  const formatCleanHeaders = (txt) => txt
    .replace(/\n/g, "<br>")
    .replace(/•\s*\[([^\]]+)\]:/g, '<div style="margin-top:10px; font-weight:800; color:#1d4ed8; font-size:14px;">$1:</div>')
    .replace(/\[([^\]]+)\]:/g, '<div style="margin-top:10px; font-weight:800; color:#1d4ed8; font-size:14px;">$1:</div>')
    .replace(/^(\d+\.\s[^<]+)/gm, '<strong style="color:#0f172a;">$1</strong>')
    .replace(/\b([A-Z][A-Z0-9\s,&'’()-]{3,}:)/g, '<strong style="color:#1e3a8a;">$1</strong>');

  const whyHtml = `<div style="background:#fefce8; border-left:4px solid #eab308; padding:10px 14px; border-radius:8px; margin:12px 0; color:#713f12; font-size:14px;"><b>💡 ${khan.why.replace(/^Why This Matters[^:]*:\s*/i, "Why This Matters: ")}</b></div>`;
  const readingHtml = `<div style="background:#f8fafc; border:1px solid #cbd5e1; padding:14px; border-radius:10px; margin:12px 0; font-size:14.5px; line-height:1.65; color:#1e293b;">${injectInlinePronunciations(formatCleanHeaders(khan.reading), a.subject)}</div>`;

  const normBlocks = khan.steps.replace(/\s+(?=\d+\.\s)/g, "\n\n").split(/\n\n+/).map(b => b.trim()).filter(Boolean);
  let vidPlaced = false;
  let step2Placed = false;
  const stepsHtml = normBlocks.map(blk => {
    const styled = injectInlinePronunciations(formatCleanHeaders(blk), a.subject);
    let after = "";
    if (!vidPlaced && (/^1\./.test(blk) || /watch/i.test(blk))) {
      after += videosHtml;
      vidPlaced = true;
    }
    if (!step2Placed && /^2\./.test(blk)) {
      if (resourceLinksHtml) after += resourceLinksHtml;
      if (mathToolkitBtn) after += mathToolkitBtn;
      step2Placed = true;
    }
    return '<div style="margin:12px 0; font-size:14.5px; line-height:1.6;">' + styled + after + '</div>';
  }).join("");

  const isWeeklyQuiz = dayNum % 5 === 0;
  const quizQuestions = [
    { q: `Based on today's ${a.subject} reading & video, which approach best demonstrates Honors mastery?`, opts: ["Citing specific evidence from the reading/video and explaining cause-and-effect clearly", "Guessing without referencing the lesson text", "Skipping worked steps"], ans: 0 },
    { q: `Which habit strengthens long-term retention in ${a.subject}?`, opts: ["Active recall, explaining concepts in your own words, and checking units/evidence", "Skimming only the title", "Rushing without reviewing feedback"], ans: 0 }
  ];
  const quizHtml = isWeeklyQuiz
    ? `<div style="background:#fffbeb; border:2px solid #f59e0b; padding:14px; border-radius:10px; margin:14px 0;">
        <div style="font-weight:800; color:#92400e; font-size:15px; margin-bottom:8px;">📝 Day ${dayNum} Weekly Auto-Graded Mastery Quiz (Counts Toward Quarter GPA)</div>
        ${quizQuestions.map((qz, qi) => `<div style="margin:10px 0;"><div style="font-weight:700; font-size:14px;">${qi + 1}. ${qz.q}</div>${qz.opts.map((o, oi) => `<label style="display:block; margin:4px 0; font-weight:500;"><input type="radio" name="wquiz_${a.id}_${qi}" value="${oi}" /> ${o}</label>`).join("")}</div>`).join("")}
        <button type="button" class="btn-primary" style="width:auto; background:#d97706;" onclick="submitAutoWeeklyQuiz('${a.id}', ${quizQuestions.length})">✅ Submit &amp; Auto-Grade Weekly Quiz</button>
      </div>`
    : "";

  const fbHtml = sub && sub.parent_feedback
    ? `<div style="background:#ecfdf5; border:1px solid #86efac; padding:10px; border-radius:8px; margin-top:10px; color:#065f46;"><b>💬 Parent Feedback:</b> ${sub.parent_feedback}</div>`
    : "";

  const safeSubjAttr = a.subject.replace(/'/g, "\\'");
  const navBar = `<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid #e2e8f0;">
    <button type="button" class="btn-outline" style="width:auto; color:#0f172a; font-weight:700;" onclick="closeStudentCourseMenu()">← All Courses</button>
    <div style="display:flex; align-items:center; gap:8px;">
      <button type="button" class="btn-outline" style="width:auto; padding:6px 12px; color:#0f172a;" ${dayIdx === 0 ? "disabled" : ""} onclick="shiftStudentDay('${safeSubjAttr}', -1, ${seq.length})">◀ Day ${Math.max(1, dayNum - 1)}</button>
      <span class="badge" style="background:#1e3a8a; color:#ffffff; font-size:13px;">Day ${dayNum} of ${seq.length}</span>
      <button type="button" class="btn-outline" style="width:auto; padding:6px 12px; color:#0f172a;" ${dayIdx >= seq.length - 1 ? "disabled" : ""} onclick="shiftStudentDay('${safeSubjAttr}', 1, ${seq.length})">Day ${Math.min(seq.length, dayNum + 1)} ▶</button>
    </div>
  </div>`;

  paneEl.innerHTML = `<div class="card">
    ${navBar}
    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px;">
      <div>
        <span class="badge">Q1 • Day ${dayNum}</span>
        <strong style="font-size:18px; color:#0f172a;"> ${a.subject}: ${cleanTitle}</strong>
        <div class="muted" style="margin-top:2px;">${a.course_level || "Honors"} (${a.credits || 1} cr)</div>
      </div>
      <span class="badge" style="background:#eff6ff; color:#1e3a8a; font-weight:700;">${statusText}</span>
    </div>
    ${whyHtml}
    ${readingHtml}
    ${stepsHtml}
    ${quizHtml}
    <div style="margin-top:16px; padding-top:14px; border-top:1px solid #e2e8f0;">
      <label style="font-weight:700; color:#0f172a;">✍️ Your Written Work / Honors Analysis &amp; Carmen Sandiego Bonus:</label>
      <textarea id="subnote-${a.id}" rows="5" placeholder="Write your complete response here (you can return to any day and edit/resubmit anytime)...">${sub && sub.student_notes ? sub.student_notes : ""}</textarea>
      <label style="font-weight:700; color:#0f172a;">📸 Upload Photo of Paper Work / Lab Setup (Optional):</label>
      <input type="file" id="subphoto-${a.id}" accept="image/*" />
      <button type="button" class="btn-primary" style="margin-top:10px;" onclick="submitWork('${a.id}')">${sub ? "🔄 Update & Re-Submit Work" : "✅ Submit Work for Parent Approval"}</button>
      ${fbHtml}
    </div>
  </div>`;

  if (isMath && typeof drawBackpackLine === "function") setTimeout(drawBackpackLine, 50);
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
      banner.style.cssText = "background:#fef08a; border:1px solid #eab308; padding:10px 14px; border-radius:10px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; color:#713f12;";
      document.getElementById("studentDashboard").prepend(banner);
    }
    banner.innerHTML = '<span><b>👀 Parent Preview Mode</b> — Viewing as <b>' + currentUser.full_name + '</b></span><button class="btn-outline" style="background:#fff; color:#0f172a; padding:6px 12px;" onclick="exitStudentPreview()">← Back to Parent Portal</button>';
  } else if (banner) {
    banner.remove();
  }

  document.getElementById("stuDashWelcome").innerText = "Welcome, " + currentUser.full_name;
  document.getElementById("stuDashMeta").innerText = currentFamily.family_name + " • " + currentUser.grade_level + " Grade • Class of " + (currentUser.expected_grad_year || currentUser.grad_year || "2028");

  let famAssigns = await sbQuery("assignments", {
    query: `family_id=eq.${currentFamily.id}&select=*&order=created_at.asc`
  }).catch(() => null);

  if (!Array.isArray(famAssigns)) {
    famAssigns = Array.isArray(assignmentsCache) ? assignmentsCache : [];
  }

  const allAssigns = famAssigns.filter(a => !a.student_id || String(a.student_id) === String(currentUser.id));

  let freshSubs = await sbQuery("submissions", {
    query: `student_id=eq.${currentUser.id}&select=*`
  }).catch(() => null);

  const subs = Array.isArray(freshSubs)
    ? freshSubs
    : (Array.isArray(submissionsCache) ? submissionsCache.filter(s => String(s.student_id) === String(currentUser.id)) : []);

  const achs = (await sbQuery("achievements", {
    query: `student_id=eq.${currentUser.id}&select=*`
  }).catch(() => [])) || [];

  stuSubsCache = subs;

        const bySubject = {};
  allAssigns.forEach(a => {
    const subjKey = (a.subject || "General").trim();
    if (!bySubject[subjKey]) bySubject[subjKey] = [];
    bySubject[subjKey].push(a);
  });

  const activeAssigns = [];
  for (const subj of Object.keys(bySubject)) {
    const seq = bySubject[subj];
    let nextItem = seq.find(item => {
      const s = subs.find(x => String(x.assignment_id) === String(item.id));
      return !(s && (s.status === "Submitted" || s.status === "Graded" || (s.grade && String(s.grade).trim() !== "")));
    });
    if (!nextItem && seq.length > 0 && seq.length < 45) {
      const nextDayNum = seq.length + 1;
      const isWeeklyQuiz = nextDayNum % 5 === 0;
      const template = seq[0];
      const newTitle = `[Q1 • Day ${nextDayNum}] ${subj} — ${isWeeklyQuiz ? "Weekly Auto-Graded Mastery Quiz" : "Honors Lesson & Application"}`;
      const created = await sbQuery("assignments", {
        method: "POST",
        body: {
          family_id: currentFamily.id,
          student_id: template.student_id || currentUser.id,
          quarter: template.quarter || "Q1",
          subject: subj,
          course_level: template.course_level || "Honors",
          credits: template.credits || 1.0,
          title: newTitle,
          description: isWeeklyQuiz
            ? `WEEKLY AUTO-GRADED QUIZ (DAY ${nextDayNum}): Complete the 5-question Honors Mastery Quiz below. Your score is automatically calculated and posted directly to your Quarter Gradebook.`
            : `DAY ${nextDayNum} HONORS LESSON: Read the self-contained lesson chapter, watch the embedded video below, and complete the Honors analytical exercises & Carmen Sandiego Global Bonus.`,
          resource_url: template.resource_url || ""
        }
      }).catch(() => null);
      if (created && created.id) {
        seq.push(created);
        allAssigns.push(created);
        nextItem = created;
      } else {
        const memItem = {
          ...template,
          id: "auto-" + subj.replace(/\W+/g, "") + "-d" + nextDayNum,
          title: newTitle,
          description: `DAY ${nextDayNum} HONORS LESSON: Read the self-contained lesson chapter, watch the embedded video below, and complete the Honors analytical exercises.`
        };
        seq.push(memItem);
        allAssigns.push(memItem);
        nextItem = memItem;
      }
    }
    if (!nextItem) nextItem = seq[seq.length - 1];
    if (nextItem) activeAssigns.push(nextItem);
  }
  stuActiveAssignsCache = activeAssigns;
  selectedStuSubjectIdx = 0;
  renderStudentTodayPane();


  const portElEarly = document.getElementById("studentPortfolioList");
  if (portElEarly) {
    const diplomaCard =
      '<div class="item-card" style="border:2px solid #1e3a8a; background:#f8fafc; margin-bottom:14px;">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">' +
          '<div>' +
            '<div style="font-size:12px; font-weight:700; color:#1e3a8a; letter-spacing:0.06em;">OFFICIAL COLLEGE-PREP CREDENTIAL</div>' +
            '<div style="font-size:17px; font-weight:800; color:#0f172a; margin:2px 0;">🎓 High School Diploma — ' + currentUser.full_name + '</div>' +
          '</div>' +
          '<button type="button" class="btn-primary" style="width:auto; padding:8px 14px;" onclick="printDiplomaOnly()">🖨️ Print / Save PDF</button>' +
        '</div>' +
        buildDiplomaCardHtml(currentUser, currentFamily) +
      '</div>';

    const achHtml = achs.map(ac => {
      const met = ac.metric ? " &bull; " + ac.metric : "";
      const loc = ac.location ? " &bull; 📍 " + ac.location : "";
      return '<div class="item-card"><strong>[' + ac.type + '] ' + ac.title + '</strong><br><small class="muted">' + (ac.date_completed || "") + loc + met + '</small></div>';
    }).join("") || "<p class='muted'>No travel study or certifications logged yet.</p>";

    portElEarly.innerHTML = diplomaCard + achHtml;
  }
    const getDetailedSyllabusHtml = (subj, items) => {
    const s = (subj || "").toLowerCase();
    const firstTitle = String((items && items.title) || subj).replace(/^\[[^\]]+\]\s*/, "");
    if (s.includes("literature") || s.includes("english")) {
      return '<li><b>Weeks 1–2 (Dystopian Foundations &amp; Censorship):</b> ' + firstTitle + ' • <i>Ray Bradbury’s Fahrenheit 451</i> Part 1 (pp. 1–55) • <b>Fridays:</b> Weekly Auto-Graded Reading &amp; Literary Analysis Quiz</li>' +
        '<li><b>Weeks 3–4 (Media Saturation &amp; Conformity):</b> <i>Fahrenheit 451</i> Part 2 (pp. 66–103) &amp; rhetorical analysis comparing mid-century print vs. 2026 algorithmic feeds • <b>Due End of Week 4:</b> Annotated Evidence Passage Portfolio</li>' +
        '<li><b>Weeks 5–6 (Resistance, Memory &amp; Cultural Preservation):</b> <i>Fahrenheit 451</i> Part 3 (pp. 104–158) &amp; Socratic Seminar • <b>Due End of Week 6:</b> 1,200-Word Analytical Essay Draft</li>' +
        '<li><b>Weeks 7–8 (Contemporary Voices &amp; Comparative Synthesis):</b> Paired nonfiction essays on free expression &amp; information literacy • <b>Due Week 8:</b> Final Revised Essay &amp; Multimedia Presentation</li>' +
        '<li><b>Week 9 (Quarter Mastery &amp; Capstone):</b> Comprehensive Quarter Exam, Oral Passage Defense &amp; Transcript Review</li>';
    }
    if (s.includes("algebra") || s.includes("geometry") || s.includes("calculus") || s.includes("math")) {
      return '<li><b>Weeks 1–2 (Foundations, Expressions &amp; Linear Models):</b> ' + firstTitle + ' • Order of operations, variables, slope-intercept &amp; point-slope forms • <b>Fridays:</b> Weekly Auto-Graded Problem-Solving Quiz</li>' +
        '<li><b>Weeks 3–4 (Systems of Equations &amp; Inequalities):</b> Substitution, elimination, linear inequalities &amp; Desmos/Line-Grapher modeling • <b>Due End of Week 4:</b> Real-World Cost &amp; Break-Even Modeling Project</li>' +
        '<li><b>Weeks 5–6 (Exponents, Polynomials &amp; Factoring):</b> Exponent laws, polynomial operations, factoring quadratics &amp; zero-product property • <b>Week 6:</b> Mid-Quarter Cumulative Skills Check</li>' +
        '<li><b>Weeks 7–8 (Quadratic Functions, Radicals &amp; Applications):</b> Vertex form, quadratic formula, projectile motion &amp; data regression • <b>Due Week 8:</b> Applied STEM Data Analysis Project</li>' +
        '<li><b>Week 9 (Quarter Mastery &amp; Capstone):</b> Comprehensive Quarter Exam (Show-All-Steps Paper &amp; Digital Assessment)</li>';
    }
    if (s.includes("marine")) {
      return '<li><b>Weeks 1–2 (Physical Oceanography, Salinity &amp; Currents):</b> ' + firstTitle + ' • Thermohaline circulation, 35 ppt seawater chemistry &amp; inland/coastal salinity lab • <b>Fridays:</b> Weekly Auto-Graded Lab &amp; Concept Quiz</li>' +
        '<li><b>Weeks 3–4 (Pelagic Zones, Plankton &amp; Marine Food Webs):</b> Primary productivity, trophic cascades, hydrothermal vents &amp; deep-sea adaptations • <b>Due End of Week 4:</b> Marine Trophic Energy Pyramid &amp; Field/Simulation Report</li>' +
        '<li><b>Weeks 5–6 (Coral Reefs, Estuaries &amp; Ocean Acidification):</b> Carbonate buffering, pH shifts, coastal wetlands &amp; biodiversity • <b>Week 6:</b> Mid-Quarter Lab Practical</li>' +
        '<li><b>Weeks 7–8 (Human Impact, Fisheries &amp; Marine Conservation):</b> Sustainable fisheries, plastic gyres, coral restoration &amp; marine policy • <b>Due Week 8:</b> Ocean Conservation Action Proposal</li>' +
        '<li><b>Week 9 (Quarter Mastery &amp; Capstone):</b> Comprehensive Quarter Exam, Lab Data Defense &amp; Portfolio Review</li>';
    }
    if (s.includes("biology")) {
      return '<li><b>Weeks 1–2 (Nature of Science, Experimental Design &amp; Macromolecules):</b> ' + firstTitle + ' • Variables, controls, yeast metabolism lab &amp; biological polymers • <b>Fridays:</b> Weekly Auto-Graded Concept &amp; Lab Quiz</li>' +
        '<li><b>Weeks 3–4 (Cell Structure, Membranes &amp; Transport):</b> Prokaryotic vs. eukaryotic cells, osmosis, diffusion &amp; cellular homeostasis • <b>Due End of Week 4:</b> Osmosis &amp; Cell Transport Lab Report (CER Format)</li>' +
        '<li><b>Weeks 5–6 (Cellular Energetics — Photosynthesis &amp; Respiration):</b> ATP synthesis, chloroplasts, mitochondria &amp; fermentation • <b>Week 6:</b> Mid-Quarter Cumulative Assessment</li>' +
        '<li><b>Weeks 7–8 (DNA Replication, Cell Cycle &amp; Mitosis):</b> Nucleic acids, checkpoints, cancer biology &amp; chromosome modeling • <b>Due Week 8:</b> Molecular Genetics Case Study</li>' +
        '<li><b>Week 9 (Quarter Mastery &amp; Capstone):</b> Comprehensive Quarter Exam, Lab Notebook Audit &amp; Oral Defense</li>';
    }
    if (s.includes("history")) {
      return '<li><b>Weeks 1–2 (Historical Thinking, Primary Sources &amp; Early Law Codes):</b> ' + firstTitle + ' • HIPP primary-source analysis, Hammurabi’s Code &amp; Mesopotamian/river-valley governance • <b>Fridays:</b> Weekly Auto-Graded Document &amp; Chronology Quiz</li>' +
        '<li><b>Weeks 3–4 (Classical Empires, Trade Networks &amp; Philosophy):</b> Mediterranean, Silk Road, Indian Ocean trade &amp; comparative statecraft • <b>Due End of Week 4:</b> Primary-Source Corroboration Brief</li>' +
        '<li><b>Weeks 5–6 (Global Encounters, Colonization &amp; Unfiltered Primary Accounts):</b> Indigenous sovereignty, transatlantic exchange &amp; firsthand chronicles • <b>Week 6:</b> Document-Based Question (DBQ) Essay</li>' +
        '<li><b>Weeks 7–8 (Revolutions, Constitutionalism &amp; Industrial Transformation):</b> Enlightenment debates, global independence movements &amp; labor shifts • <b>Due Week 8:</b> Historical Investigation Research Project</li>' +
        '<li><b>Week 9 (Quarter Mastery &amp; Capstone):</b> Comprehensive Quarter Exam, Primary-Source Defense &amp; Transcript Review</li>';
    }
    if (s.includes("mandarin") || s.includes("chinese") || s.includes("hindi") || s.includes("spanish") || s.includes("french")) {
      return '<li><b>Weeks 1–2 (Phonetics, Tones/Script &amp; Essential Greetings):</b> ' + firstTitle + ' • Pronunciation drills, native audio practice &amp; self-introductions • <b>Fridays:</b> Weekly Auto-Graded Vocabulary &amp; Listening Quiz</li>' +
        '<li><b>Weeks 3–4 (Family, Daily Routines &amp; Numbers/Time):</b> Core sentence structures, question words &amp; conversational dialogues • <b>Due End of Week 4:</b> Recorded 2-Minute Spoken Introduction</li>' +
        '<li><b>Weeks 5–6 (Food, Travel, Directions &amp; Cultural Etiquette):</b> Ordering, navigating cities &amp; authentic cultural case studies • <b>Week 6:</b> Mid-Quarter Reading &amp; Dialogue Assessment</li>' +
        '<li><b>Weeks 7–8 (Storytelling, Past/Future Expressions &amp; Media):</b> Short cultural readings, pen-pal/journal entries &amp; real-world scenarios • <b>Due Week 8:</b> Cultural Immersion &amp; Conversation Project</li>' +
        '<li><b>Week 9 (Quarter Mastery &amp; Capstone):</b> Comprehensive Quarter Exam (Reading, Writing &amp; Oral Proficiency Check)</li>';
    }
    return '<li><b>Weeks 1–2 (Foundations &amp; Core Frameworks):</b> ' + firstTitle + ' • <b>Fridays:</b> Weekly Auto-Graded Mastery Quiz</li>' +
      '<li><b>Weeks 3–4 (Applied Analysis &amp; Guided Practice):</b> Primary-source / quantitative problem-solving • <b>Due End of Week 4:</b> Mid-Quarter Applied Project</li>' +
      '<li><b>Weeks 5–6 (Deep-Dive Inquiry &amp; Synthesis):</b> Comparative case studies &amp; structured exercises • <b>Week 6:</b> Cumulative Skills Check</li>' +
      '<li><b>Weeks 7–8 (Independent Research &amp; Real-World Application):</b> Capstone investigation &amp; analytical portfolio • <b>Due Week 8:</b> Final Project Submission</li>' +
      '<li><b>Week 9 (Quarter Mastery &amp; Capstone):</b> Comprehensive Quarter Exam, Oral Defense &amp; Transcript Review</li>';
  };

  const syllabusEl = document.getElementById("stuSyllabusList");
  if (syllabusEl) {
    syllabusEl.innerHTML = Object.keys(bySubject).map(subj => {
      const items = bySubject[subj];
      const first = items || {};
      const weekListHtml = getDetailedSyllabusHtml(subj, items);
      return '<div class="item-card">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">' +
          '<div><strong>' + subj + '</strong> <span class="badge">' + (first.course_level || "Honors") + ' • ' + (first.credits || 1.0) + ' Cr</span></div>' +
          '<span style="font-size:12px; color:#64748b;">' + items.length + ' Lesson(s) Assigned</span>' +
        '</div>' +
        '<ul style="margin:8px 0 0 18px; padding:0; font-size:13.5px; color:#334155; line-height:1.55;">' + weekListHtml + '</ul>' +
      '</div>';
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
      const fb = sub && sub.parent_feedback
        ? '<div style="margin-top:4px; font-size:13px; color:#15803d;"><b>Teacher Note:</b> ' + sub.parent_feedback + '</div>'
        : '';
      return '<div class="item-card">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">' +
          '<div><strong>' + a.subject + '</strong> — ' + a.title + '</div>' +
          '<span class="badge">' + gr + '</span>' +
        '</div>' +
        fb +
      '</div>';
    }).join("") || "<p class='muted'>No graded coursework yet.</p>";
    if (gpaBadge) gpaBadge.innerText = "Cumulative GPA: " + (crSum > 0 ? (ptsSum / crSum).toFixed(2) : "-");
  }

    const portEl = document.getElementById("studentPortfolioList");
  if (portEl) {
    const diplomaCard =
      '<div class="item-card" style="border:2px solid #1e3a8a; background:#f8fafc; margin-bottom:14px;">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">' +
          '<div>' +
            '<div style="font-size:12px; font-weight:700; color:#1e3a8a; letter-spacing:0.06em;">OFFICIAL COLLEGE-PREP CREDENTIAL</div>' +
            '<div style="font-size:17px; font-weight:800; color:#0f172a; margin:2px 0;">🎓 High School Diploma — ' + currentUser.full_name + '</div>' +
          '</div>' +
          '<button type="button" class="btn-primary" style="width:auto; padding:8px 14px;" onclick="printDiplomaOnly()">🖨️ Print / Save PDF</button>' +
        '</div>' +
        buildDiplomaCardHtml(currentUser, currentFamily) +
      '</div>';

    const achHtml = achs.map(ac => {
      const met = ac.metric ? " &bull; " + ac.metric : "";
      const loc = ac.location ? " &bull; 📍 " + ac.location : "";
      return '<div class="item-card"><strong>[' + ac.type + '] ' + ac.title + '</strong><br><small class="muted">' + (ac.date_completed || "") + loc + met + '</small></div>';
    }).join("") || "<p class='muted'>No travel study or certifications logged yet.</p>";

    portEl.innerHTML = diplomaCard + achHtml;
  }
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
  const noteEl = document.getElementById("subnote-" + assignment_id);
  const notes = noteEl ? noteEl.value.trim() : "";
  const photoInput = document.getElementById("subphoto-" + assignment_id);
  const keepIdx = typeof selectedStuSubjectIdx === "number" ? selectedStuSubjectIdx : 0;
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
    const isPrev = !!(document.getElementById("previewBanner") && !document.getElementById("previewBanner").classList.contains("hidden"));
    await loadStudentDashboard(isPrev);
    selectedStuSubjectIdx = keepIdx;
    renderStudentTodayPane();
    const pane = document.getElementById("stuActiveLessonPane");
    if (pane) {
      const toast = document.createElement("div");
      toast.style.cssText = "background:#ecfdf5; border:2px solid #10b981; color:#065f46; padding:12px 16px; border-radius:10px; font-weight:700; margin-bottom:14px;";
      toast.innerText = "✅ Your work has been submitted and is awaiting parent approval!";
      pane.prepend(toast);
    }
    alert("✅ Your work has been submitted and is awaiting parent approval!");
  } catch (err) {
    alert(err.message);
  }
}
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

function evalMathSafe(expr) {
  const s = String(expr || "").replace(/\s+/g, "").replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
  if (!s) throw new Error("Enter an expression");
  let pos = 0;
  function parseExpr() {
    let val = parseTerm();
    while (pos < s.length && (s[pos] === "+" || s[pos] === "-")) {
      const op = s[pos++];
      const right = parseTerm();
      val = op === "+" ? val + right : val - right;
    }
    return val;
  }
  function parseTerm() {
    let val = parsePower();
    while (pos < s.length && (s[pos] === "*" || s[pos] === "/")) {
      const op = s[pos++];
      const right = parsePower();
      if (op === "/" && right === 0) throw new Error("Cannot divide by zero");
      val = op === "*" ? val * right : val / right;
    }
    return val;
  }
  function parsePower() {
    let base = parseUnary();
    if (pos < s.length && s[pos] === "^") {
      pos++;
      const exp = parsePower();
      return Math.pow(base, exp);
    }
    return base;
  }
  function parseUnary() {
    if (s[pos] === "+") { pos++; return parseUnary(); }
    if (s[pos] === "-") { pos++; return -parseUnary(); }
    return parseAtom();
  }
  function parseAtom() {
    if (s[pos] === "(") {
      pos++;
      const val = parseExpr();
      if (s[pos] !== ")") throw new Error("Missing closing )");
      pos++;
      return val;
    }
    const start = pos;
    while (pos < s.length && ((s[pos] >= "0" && s[pos] <= "9") || s[pos] === ".")) pos++;
    if (start === pos) throw new Error("Invalid character");
    return parseFloat(s.slice(start, pos));
  }
  const result = parseExpr();
  if (pos !== s.length) throw new Error("Unexpected input");
  return Math.round(result * 1000000) / 1000000;
}

function runBackpackCalc() {
  const inp = document.getElementById("calcDisplay");
  const out = document.getElementById("calcResult");
  if (!inp || !out) return;
  const raw = inp.value.trim();
  if (!raw) { out.innerText = "Result: —"; return; }
  try {
    const val = evalMathSafe(raw);
    out.style.color = "#15803d";
    out.innerText = "Result: " + val;
  } catch (e) {
    out.style.color = "#b91c1c";
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

function openMathToolkitModal() {
  const box = document.getElementById("mathToolkitBox");
  if (!box) return;
  box.classList.remove("hidden");
  if (typeof drawBackpackLine === "function") drawBackpackLine();
  box.scrollIntoView({ behavior: "smooth", block: "center" });
}

window.addEventListener("DOMContentLoaded", async () => {
  try {
    const creds = JSON.parse(localStorage.getItem("gph_saved_creds") || "{}");
    const pe = document.getElementById("parentEmail");
    const sc = document.getElementById("stuInviteCode");
    const su = document.getElementById("stuUsername");
    if (pe && creds.parentEmail) pe.value = creds.parentEmail;
    if (sc && creds.stuInviteCode) sc.value = creds.stuInviteCode;
    if (su && creds.stuUsername) su.value = creds.stuUsername;

    const rawSess = localStorage.getItem("gph_session") || sessionStorage.getItem("gph_session");
    if (rawSess) {
      const sess = JSON.parse(rawSess);
      if (sess && sess.currentFamily && sess.currentUser) {
        authToken = sess.authToken || null;
        currentFamily = sess.currentFamily;
        currentUser = sess.currentUser;
        if (sess.role === "parent") {
          await loadParentDashboard();
        } else if (sess.role === "student") {
          await loadStudentDashboard();
        }
      }
    }
  } catch (e) {}
});
